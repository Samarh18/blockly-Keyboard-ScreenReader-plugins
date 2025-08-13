/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import { getToolboxElement, getFlyoutElement } from '../keyboard-navigation/workspace_utilities';
import { getBlockMessage } from './block_descriptions';
import { SpeechSettings } from './settings_dialog';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface MenuObservers {
  menuObserver: MutationObserver | null;
  contextMenuObserver: MutationObserver | null;
}

interface FieldEditingListener {
  input: HTMLInputElement;
  lastValue: string;
  keydownListener: (e: KeyboardEvent) => void;
  inputListener: (e: Event) => void;
}

interface BlockPosition {
  index: number;
  total: number;
}

// ============================================================================
// SCREEN READER CLASS
// ============================================================================

/**
 * A comprehensive screen reader implementation for Blockly that announces actions,
 * handles navigation feedback, and provides speech synthesis capabilities.
 */
export class ScreenReader {
  // -------------------------------------------------------------------------
  // CORE PROPERTIES
  // -------------------------------------------------------------------------
  private workspace: Blockly.WorkspaceSvg;
  private settings: SpeechSettings;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private debugMode: boolean = true;

  // -------------------------------------------------------------------------
  // SPEECH SYNTHESIS PROPERTIES
  // -------------------------------------------------------------------------
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private utteranceStartTime: number = 0;
  private minSpeakTime: number = 500; // Minimum time in ms to speak before allowing interruption
  private interruptionDelay: number = 300; // Grace period before interrupting
  private pendingMessage: string | null = null;
  private interruptionTimer: number | null = null;
  private isSpeaking: boolean = false;

  // -------------------------------------------------------------------------
  // NAVIGATION AND STATE TRACKING PROPERTIES
  // -------------------------------------------------------------------------
  private lastAnnouncedBlockId: string | null = null;
  private lastWorkspaceNodeId: string | null = null;
  private hasLeftWorkspace: boolean = false;
  private cursorInterval: number | null = null;

  // -------------------------------------------------------------------------
  // MENU AND UI INTERACTION PROPERTIES
  // -------------------------------------------------------------------------
  private menuObservers?: MenuObservers;
  private fieldEditingListeners: Map<string, FieldEditingListener> = new Map();

  // -------------------------------------------------------------------------
  // SPECIAL STATE FLAGS
  // -------------------------------------------------------------------------
  private isDeletingAll: boolean = false;

  // ============================================================================
  // CONSTRUCTOR AND INITIALIZATION
  // ============================================================================

  /**
   * Constructs a new ScreenReader instance.
   * @param workspace The Blockly workspace to attach to.
   */
  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace;
    this.debugLog('Initializing ScreenReader...');

    // Initialize speech synthesis
    this.initializeSpeechSynthesis();

    // Load and apply settings
    this.settings = this.loadSettings();
    this.applyVoiceSettings();

    // Initialize all event listeners
    this.initEventListeners();

    // Setup workspace cursor and field editing listeners
    this.setupWorkspaceCursorListener();
    this.setupFieldEditingListeners();
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  /**
   * Load settings from localStorage with defaults
   */
  private loadSettings(): SpeechSettings {
    const saved = localStorage.getItem('blockly-screenreader-settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved settings, using defaults');
      }
    }
    return this.getDefaultSettings();
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): SpeechSettings {
    return {
      enabled: true,
      rate: 1.7,
      pitch: 1.0,
      volume: 1.0,
      voiceIndex: 0
    };
  }

  /**
   * Apply voice settings
   */
  private applyVoiceSettings(): void {
    const voices = window.speechSynthesis.getVoices();
    this.selectedVoice = voices[this.settings.voiceIndex] || voices[0] || null;
  }

  /**
   * Update settings (called from settings dialog)
   */
  public updateSettings(newSettings: SpeechSettings): void {
    this.settings = { ...newSettings };
    this.setEnabled(newSettings.enabled);
    this.applyVoiceSettings();
  }

  /**
   * Test speech settings with a message
   */
  public testSpeechSettings(message: string): void {
    this.forceSpeek(message);
  }

  /**
   * Enable or disable the screen reader
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      // Cancel any pending speech when disabled
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.currentUtterance = null;
      this.pendingMessage = null;
    }
  }

  /**
   * Check if screen reader is enabled
   */
  public isScreenReaderEnabled(): boolean {
    return this.isEnabled;
  }

  // ============================================================================
  // SPEECH SYNTHESIS CORE
  // ============================================================================

  /**
   * Initialize speech synthesis with proper voice loading
   */
  private initializeSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      let voices = window.speechSynthesis.getVoices();

      if (voices.length === 0) {
        // Voices not loaded yet, wait for them
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          this.debugLog(`Loaded ${voices.length} voices`);
          this.applyVoiceSettings();
          this.testSpeechAfterVoicesLoaded();
        };
      } else {
        this.applyVoiceSettings();
        this.testSpeechAfterVoicesLoaded();
      }
    }
  }

  /**
   * Test speech after voices are loaded
   */
  private testSpeechAfterVoicesLoaded(): void {
    setTimeout(() => {
      this.speak('Screen reader enabled. Press Tab to navigate between controls. Use arrow keys within menus.');
    }, 100);
  }

  /**
   * Enhanced speak method with intelligent interruption
   */
  private speak(message: string, priority: 'high' | 'normal' = 'normal'): void {
    this.debugLog(`Speaking: ${message} (priority: ${priority})`);

    if (!('speechSynthesis' in window) || !this.isEnabled) {
      return;
    }

    // Clear interruption timer if exists
    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer);
      this.interruptionTimer = null;
    }

    // Clear pending messages for high priority announcements
    if (priority === 'high') {
      this.pendingMessage = null;
    }

    // Handle current speech interruption
    if (this.currentUtterance && window.speechSynthesis.speaking) {
      const timeSpoken = Date.now() - this.utteranceStartTime;

      if (priority === 'high' && timeSpoken > 200) {
        this.interruptCurrentAndSpeak(message);
        return;
      }

      if (timeSpoken < this.minSpeakTime) {
        this.pendingMessage = message;
        this.interruptionTimer = window.setTimeout(() => {
          this.interruptCurrentAndSpeak(message);
        }, this.minSpeakTime - timeSpoken + this.interruptionDelay);
        return;
      } else {
        this.interruptCurrentAndSpeak(message);
        return;
      }
    }

    // No current speech, speak immediately
    this.speakImmediate(message);
  }

  /**
   * Interrupt current speech and speak new message
   */
  private interruptCurrentAndSpeak(message: string): void {
    this.debugLog('Interrupting current speech');
    this.pendingMessage = null;
    window.speechSynthesis.cancel();
    this.currentUtterance = null;

    setTimeout(() => {
      this.speakImmediate(message);
    }, 50);
  }

  /**
   * Immediately speak a message
   */
  private speakImmediate(message: string): void {
    try {
      const utterance = new SpeechSynthesisUtterance(message);

      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.volume = this.settings.volume;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      this.currentUtterance = utterance;
      this.utteranceStartTime = Date.now();

      utterance.onstart = () => {
        this.debugLog(`Speech started: "${message}"`);
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.debugLog(`Speech ended: "${message}"`);
        this.isSpeaking = false;
        this.currentUtterance = null;

        if (this.pendingMessage) {
          const pending = this.pendingMessage;
          this.pendingMessage = null;
          this.speak(pending);
        }
      };

      utterance.onerror = (event) => {
        this.debugLog(`Speech error: ${event.error} for message: "${message}"`);
        this.isSpeaking = false;
        this.currentUtterance = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      this.debugLog(`Error creating speech utterance: ${error}`);
    }
  }

  /**
   * Force speak a message by clearing everything first (use sparingly)
   */
  public forceSpeek(message: string): void {
    if (!this.isEnabled) {
      this.debugLog(`Force speech blocked - screen reader disabled: "${message}"`);
      return;
    }

    if ('speechSynthesis' in window) {
      if (this.interruptionTimer) {
        clearTimeout(this.interruptionTimer);
        this.interruptionTimer = null;
      }

      this.pendingMessage = null;
      window.speechSynthesis.cancel();
      this.currentUtterance = null;

      setTimeout(() => this.speakImmediate(message), 100);
    }
  }

  /**
   * Announce a high-priority message (interrupts more aggressively)
   */
  public speakHighPriority(message: string): void {
    this.speak(message, 'high');
  }

  /**
   * Reset speech synthesis if it gets stuck
   */
  public resetSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        this.speak('Speech synthesis reset');
      }, 200);
    }
  }

  // ============================================================================
  // TEXT PROCESSING AND SYMBOL CONVERSION
  // ============================================================================

  /**
   * Convert mathematical and special symbols to readable text
   */
  private cleanTextForScreenReader(text: string): string {
    // Remove invisible Unicode characters
    let cleanText = text
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .trim();

    // Handle complex mathematical expressions first
    if (cleanText === '10^') return '10 to the power of';
    if (cleanText === 'e^') return 'e to the power of';

    // Handle sqrt() function format
    if (cleanText.startsWith('sqrt(') && cleanText.endsWith(')')) {
      const content = cleanText.slice(5, -1);
      if (content === '2') return 'square root of 2';
      if (content === '1/2') return 'square root of one half';
      return `square root of ${content}`;
    }

    // Handle # symbol in context
    if (cleanText.includes('#')) {
      cleanText = cleanText
        .replace(/^#/, 'number')
        .replace(/\s#\s/g, ' number ')
        .replace(/\s#$/g, ' number')
        .replace(/#\sfrom\sthe\send/g, 'number from the end')
        .replace(/#\sfrom\send/g, 'number from end')
        .replace(/#\sfrom\start/g, 'number from start');

      if (cleanText !== text.trim()) return cleanText;
    }

    // Handle mathematical functions with parentheses
    if (cleanText.includes('(') && cleanText.includes(')')) {
      cleanText = cleanText
        .replace(/^sin\(/i, 'sine of ')
        .replace(/^cos\(/i, 'cosine of ')
        .replace(/^tan\(/i, 'tangent of ')
        .replace(/^asin\(/i, 'arcsine of ')
        .replace(/^acos\(/i, 'arccosine of ')
        .replace(/^atan\(/i, 'arctangent of ')
        .replace(/^ln\(/i, 'natural logarithm of ')
        .replace(/^log\(/i, 'logarithm of ')
        .replace(/^abs\(/i, 'absolute value of ')
        .replace(/\)$/, '');
      return cleanText;
    }

    // Mathematical operators and symbols
    const symbolMap: { [key: string]: string } = {
      '#': 'number',
      '<=': 'less than or equal', '≤': 'less than or equal',
      '>=': 'greater than or equal', '≥': 'greater than or equal',
      '≠': 'not equal', '!=': 'not equal',
      '=': 'equals', '<': 'less than', '>': 'greater than',
      '+': 'plus', '-': 'minus', '×': 'times', '*': 'times',
      '÷': 'divided by', '/': 'divided by', '^': 'to the power of',
      '√': 'square root', '∛': 'cube root',
      '&&': 'and', '||': 'or', '∧': 'and', '∨': 'or',
      '¬': 'not', '!': 'not',
      'π': 'pi', 'e': 'e', '∞': 'infinity', 'φ': 'phi',
      '%': 'percent', '°': 'degrees',
      '∈': 'is in', '∉': 'is not in', '∅': 'empty set',
      'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta',
      'θ': 'theta', 'λ': 'lambda', 'μ': 'mu', 'σ': 'sigma',
      'Σ': 'sum', 'Π': 'product'
    };

    // Check for exact match
    if (symbolMap[cleanText]) return symbolMap[cleanText];

    // Handle subscript and superscript
    let readableText = cleanText
      .replace(/₀/g, ' sub 0').replace(/₁/g, ' sub 1').replace(/₂/g, ' sub 2')
      .replace(/₃/g, ' sub 3').replace(/₄/g, ' sub 4').replace(/₅/g, ' sub 5')
      .replace(/₆/g, ' sub 6').replace(/₇/g, ' sub 7').replace(/₈/g, ' sub 8')
      .replace(/₉/g, ' sub 9').replace(/²/g, ' squared').replace(/³/g, ' cubed')
      .replace(/ⁿ/g, ' to the n').replace(/ˣ/g, ' to the x');

    return readableText || text;
  }

  /**
   * Helper method to get friendly names for emojis
   */
  private getEmojiName(emoji: string): string {
    const emojiMap: { [key: string]: string } = {
      '❤️': 'red heart', '✨': 'sparkles', '🻠': 'bear face',
      '🌟': 'glowing star', '🌈': 'rainbow', '🎈': 'balloon',
      '🎨': 'artist palette', '🌺': 'hibiscus flower',
      '🦋': 'butterfly', '🌙': 'crescent moon'
    };
    return emojiMap[emoji] || `emoji ${emoji}`;
  }

  /**
   * Convert hex color to a readable name
   */
  private getColorNameFromHex(hexColor: string): string {
    hexColor = hexColor.replace('#', '').toLowerCase();

    const colorMap: { [key: string]: string } = {
      'ff0000': 'red', 'ff4500': 'orange-red', 'ffa500': 'orange',
      'ffff00': 'yellow', '00ff00': 'green', '008000': 'dark green',
      '00ffff': 'cyan', '0000ff': 'blue', '000080': 'navy blue',
      '4b0082': 'indigo', '800080': 'purple', '9400d3': 'dark violet',
      'ff00ff': 'magenta', 'ff1493': 'deep pink', 'ffffff': 'white',
      '000000': 'black', 'c0c0c0': 'silver', '808080': 'gray',
      'a52a2a': 'brown', 'ffc0cb': 'pink'
    };

    if (colorMap[hexColor]) return colorMap[hexColor];

    // Categorize by RGB components for unknown colors
    try {
      const r = parseInt(hexColor.substr(0, 2), 16);
      const g = parseInt(hexColor.substr(2, 2), 16);
      const b = parseInt(hexColor.substr(4, 2), 16);

      if (r > g && r > b) {
        return g > b ? (r - g > 50 ? 'reddish orange' : 'orange red') :
          (r - b > 50 ? 'bright red' : 'reddish purple');
      } else if (g > r && g > b) {
        return r > b ? (g - r > 50 ? 'yellowish green' : 'yellow green') :
          (g - b > 50 ? 'bright green' : 'greenish blue');
      } else if (b > r && b > g) {
        return r > g ? (b - r > 50 ? 'bluish purple' : 'purple blue') :
          (b - g > 50 ? 'bright blue' : 'teal blue');
      } else if (r === g && g === b) {
        return r > 200 ? 'light gray' : r > 100 ? 'gray' : 'dark gray';
      }
    } catch (e) {
      console.log("Error parsing color:", e);
    }

    return 'custom color';
  }

  // ============================================================================
  // BLOCK DESCRIPTION AND NAVIGATION
  // ============================================================================

  /**
   * Enhanced getBlockDescription method to include field values
   */
  private getBlockDescription(block: Blockly.Block): string {
    // Get variables from workspace for context
    const workspace = block.workspace;
    const variableMap = workspace.getVariableMap();
    const allVariables = variableMap.getAllVariables();

    const variables = allVariables.map(variable => ({
      name: variable.getName(),
      id: variable.getId()
    }));

    // Try to get description from block_descriptions
    const detailedDescription = getBlockMessage(block, variables);

    // If we got a meaningful description, use it
    if (!detailedDescription.startsWith('Block of type')) {
      return detailedDescription;
    }

    // Fall back to specific p5 descriptions
    const blockType = block.type;

    // Handle specific block types
    if (blockType === 'p5_setup') return "Setup block";
    if (blockType === 'p5_draw') return "Draw block";

    if (blockType === 'p5_canvas') {
      const width = block.getFieldValue('WIDTH');
      const height = block.getFieldValue('HEIGHT');
      return `Create Canvas with width ${width} and height ${height}`;
    }

    if (blockType === 'math_number') {
      const value = block.getFieldValue('NUM');
      return `Number block with value ${value}`;
    }

    if (blockType === 'draw_emoji') {
      const emoji = block.getFieldValue('emoji');
      const emojiName = this.getEmojiName(emoji);
      return `Draw ${emojiName}`;
    }

    // Handle blocks with color connections
    if (blockType === 'simple_circle') {
      let colorName = "colored";
      try {
        const colorInput = block.getInput('COLOR');
        if (colorInput?.connection?.targetBlock()) {
          const colorBlock = colorInput.connection.targetBlock();
          if (colorBlock?.type === 'colour_picker') {
            const colorHex = colorBlock.getFieldValue('COLOUR');
            colorName = this.getColorNameFromHex(colorHex);
          }
        }
      } catch (e) {
        console.log("Error getting circle color:", e);
      }
      return `Draw ${colorName} circle`;
    }

    if (blockType === 'colour_picker') {
      const colorHex = block.getFieldValue('COLOUR');
      const colorName = this.getColorNameFromHex(colorHex);
      return `Color: ${colorName}`;
    }

    // Add field information for blocks with dropdowns or other editable fields
    const fields = block.inputList
      .flatMap(input => input.fieldRow)
      .filter(field => field.EDITABLE && field.getValue);

    let baseDescription = blockType.replace(/_/g, ' ');

    if (fields.length > 0) {
      const fieldDescriptions = fields.map(field => {
        const fieldName = field.name || 'field';
        let fieldValue = field.getText ? field.getText() : String(field.getValue());

        // Special handling for different field types
        if (fieldName === 'emoji' && fieldValue) {
          fieldValue = this.getEmojiName(fieldValue);
        }

        if ((fieldName.toLowerCase().includes('color') || fieldName.toLowerCase().includes('colour')) &&
          fieldValue.startsWith('#')) {
          fieldValue = this.getColorNameFromHex(fieldValue);
        }

        return `${fieldName}: ${fieldValue}`;
      }).join(', ');

      return `${baseDescription} block with ${fieldDescriptions}`;
    }

    return baseDescription + " block";
  }

  /**
   * Get the position of a block within the flyout
   */
  private getBlockPositionInFlyout(block: Blockly.BlockSvg): BlockPosition | null {
    const flyout = this.workspace.getFlyout();
    if (!flyout) return null;

    const flyoutWorkspace = flyout.getWorkspace();
    const flyoutBlocks = flyoutWorkspace.getTopBlocks(false);

    const currentIndex = flyoutBlocks.findIndex(b => b.id === block.id);
    if (currentIndex === -1) return null;

    return {
      index: currentIndex + 1, // 1-based indexing
      total: flyoutBlocks.length
    };
  }

  /**
   * Announce information about a specific block.
   */
  public announceBlock(block: Blockly.Block): void {
    const description = this.getBlockDescription(block);

    // Check if we're in the flyout
    const blockSvg = block as Blockly.BlockSvg;
    if (blockSvg.workspace.isFlyout) {
      const position = this.getBlockPositionInFlyout(blockSvg);
      if (position) {
        this.speakHighPriority(`${description}, ${position.index} of ${position.total}`);
        return;
      }
    }

    this.speakHighPriority(`Selected ${description}`);
  }

  // ============================================================================
  // NAVIGATION AND CURSOR MANAGEMENT
  // ============================================================================

  /**
   * Set up an interval to check for workspace cursor movements
   */
  private setupWorkspaceCursorListener(): void {
    this.debugLog('Setting up workspace cursor listener...');

    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }

    this.cursorInterval = window.setInterval(() => {
      const cursor = this.workspace.getCursor();
      if (cursor) {
        const curNode = cursor.getCurNode();
        if (curNode) {
          const currentNodeId = this.getNodeIdentifier(curNode);
          const workspaceHasFocus = document.activeElement === this.workspace.getParentSvg() ||
            this.workspace.getParentSvg().contains(document.activeElement as Node);

          if (this.lastWorkspaceNodeId !== currentNodeId ||
            (workspaceHasFocus && this.hasLeftWorkspace)) {
            this.lastWorkspaceNodeId = currentNodeId;
            this.announceNode(curNode);

            if (this.hasLeftWorkspace && workspaceHasFocus) {
              this.hasLeftWorkspace = false;
            }
          }
        }
      }
    }, 250);
  }

  /**
   * Generate a unique identifier for a node to avoid repeating announcements
   */
  private getNodeIdentifier(node: Blockly.ASTNode): string {
    const type = node.getType();
    const location = node.getLocation();

    if (type === Blockly.ASTNode.types.BLOCK) {
      const block = location as Blockly.Block;
      return `block-${block?.id || 'unknown'}`;
    } else if (type === Blockly.ASTNode.types.WORKSPACE) {
      return 'workspace';
    } else if (type === Blockly.ASTNode.types.STACK) {
      const block = location as Blockly.Block;
      return `stack-${block?.id || 'unknown'}`;
    } else if (node.isConnection()) {
      const connection = location as Blockly.Connection;
      const block = connection.getSourceBlock();
      return `connection-${block?.id || 'unknown'}-${connection.type}`;
    } else if (type === Blockly.ASTNode.types.FIELD) {
      const field = location as Blockly.Field;
      const block = field.getSourceBlock();
      return `field-${block?.id || 'unknown'}-${field.name}`;
    } else if (type === Blockly.ASTNode.types.INPUT) {
      const input = location as Blockly.Input;
      const block = input.getSourceBlock();
      return `input-${block?.id || 'unknown'}-${input.name}`;
    }
    return `unknown-${type}`;
  }

  /**
   * Announce navigation information for different node types
   */
  private announceNode(node: Blockly.ASTNode): void {
    const type = node.getType();
    const location = node.getLocation();

    if (type === Blockly.ASTNode.types.BLOCK || type === Blockly.ASTNode.types.STACK) {
      const block = location as Blockly.BlockSvg;

      if (block) {
        const description = this.getBlockDescription(block);

        if (block.workspace.isFlyout) {
          const position = this.getBlockPositionInFlyout(block);
          if (position) {
            this.speakHighPriority(`${description}, ${position.index} of ${position.total}`);
            return;
          }
        }

        this.speakHighPriority(`Selected ${description}`);
      } else {
        this.speakHighPriority("Unknown block");
      }
    } else if (type === Blockly.ASTNode.types.WORKSPACE) {
      this.speakHighPriority("Workspace. Use arrow keys to navigate blocks.");
    } else if (node.isConnection()) {
      const connection = location as Blockly.Connection;
      const block = connection.getSourceBlock();

      if (!block) {
        this.speakHighPriority("Connection on unknown block");
        return;
      }

      if (connection.type === Blockly.PREVIOUS_STATEMENT) {
        this.speakHighPriority(`Top of ${this.getBlockDescription(block)}`);
      } else if (connection.type === Blockly.NEXT_STATEMENT) {
        this.speakHighPriority(`Bottom of ${this.getBlockDescription(block)}. Connect a block here.`);
      } else if (connection.type === Blockly.OUTPUT_VALUE) {
        this.speakHighPriority(`Output connection of ${this.getBlockDescription(block)}`);
      } else if (connection.type === Blockly.INPUT_VALUE) {
        this.speakHighPriority(`Value input on ${this.getBlockDescription(block)}. Connect a value here.`);
      }
    } else if (type === Blockly.ASTNode.types.FIELD) {
      const field = location as Blockly.Field;
      let fieldValue = field.getText();
      fieldValue = this.cleanTextForScreenReader(fieldValue);

      const isDropdown = field instanceof Blockly.FieldDropdown;
      if (isDropdown) {
        this.speakHighPriority(`Dropdown with value ${fieldValue}. Press Enter to open menu.`);
      } else {
        this.speakHighPriority(`Field with value ${fieldValue}`);
      }
    } else if (type === Blockly.ASTNode.types.INPUT) {
      const input = location as Blockly.Input;
      const block = input.getSourceBlock();
      if (block) {
        this.speakHighPriority(`Input ${input.name} on ${this.getBlockDescription(block)}`);
      } else {
        this.speakHighPriority(`Input ${input.name} on unknown block`);
      }
    } else {
      this.speakHighPriority(`Unknown element type: ${type}`);
    }
  }

  // ============================================================================
  // EVENT LISTENERS AND UI INTERACTION
  // ============================================================================

  /**
   * Initialize event listeners for workspace changes.
   */
  private initEventListeners(): void {
    this.debugLog('Initializing event listeners...');

    this.setupComprehensiveMenuListeners();
    this.setupToolboxSelectionListener();
    this.setupDropdownNavigation();
    this.setupKeyboardShortcuts();
    this.setupWorkspaceEventListeners();
    this.setupFocusEventListeners();
  }

  /**
   * Set up keyboard shortcut listeners
   */
  private setupKeyboardShortcuts(): void {
    // Tab key navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.debugLog('Tab key detected');
        const currentActive = document.activeElement;
        if (currentActive === this.workspace.getParentSvg() ||
          this.workspace.getParentSvg().contains(currentActive as Node)) {
          this.hasLeftWorkspace = true;
        }

        setTimeout(() => {
          const activeElement = document.activeElement;
          this.debugLog(`Active element after Tab: ${activeElement?.tagName} ${activeElement?.id}`);
        }, 100);
      }
    });

    // Workspace action shortcuts (C for cleanup, D for delete all)
    document.addEventListener('keydown', (e) => {
      const workspaceHasFocus = document.activeElement === this.workspace.getParentSvg() ||
        this.workspace.getParentSvg().contains(document.activeElement as Node);

      if (!workspaceHasFocus || e.ctrlKey || e.metaKey || e.altKey || this.workspace.options.readOnly) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'c':
          const blocksToClean = this.workspace.getTopBlocks(false).length;
          if (blocksToClean > 0) {
            setTimeout(() => {
              this.forceSpeek(`Cleaned up workspace. blocks organized.`);
            }, 150);
          }
          break;

        case 'd':
          this.isDeletingAll = true;
          this.forceSpeek('All blocks are deleted');
          setTimeout(() => {
            this.isDeletingAll = false;
          }, 1000);
          break;
      }
    });
  }

  /**
   * Set up workspace event listeners for block operations
   */
  private setupWorkspaceEventListeners(): void {
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) {
        const selectedEvent = event as Blockly.Events.Selected;
        this.debugLog(`Block selected: ${selectedEvent.newElementId}`);
        if (selectedEvent.newElementId) {
          const block = this.workspace.getBlockById(selectedEvent.newElementId);
          if (block) {
            this.announceBlock(block);
          }
        } else {
          this.speak("No block selected");
        }
      } else if (event.type === Blockly.Events.BLOCK_CREATE) {
        const createEvent = event as Blockly.Events.BlockCreate;
        this.debugLog(`Block created: ${createEvent.blockId}`);
        if (createEvent.blockId) {
          const block = this.workspace.getBlockById(createEvent.blockId);
          if (block) {
            this.speak(`${this.getBlockDescription(block)} added to the workspace`);
          }
        }
      } else if (event.type === Blockly.Events.BLOCK_DELETE) {
        this.debugLog('Block deleted');
        if (!this.isDeletingAll) {
          this.speak("Block deleted");
        }
      } else if (event.type === Blockly.Events.BLOCK_CHANGE) {
        const changeEvent = event as Blockly.Events.BlockChange;
        this.debugLog(`Block changed: ${changeEvent.blockId}`);
        if (changeEvent.blockId) {
          const block = this.workspace.getBlockById(changeEvent.blockId);
          if (block) {
            this.speak(`Block changed to ${this.getBlockDescription(block)}`);
          }
        }
      }
    });

    // Setup flyout listeners
    const flyout = this.workspace.getFlyout();
    if (flyout) {
      const flyoutWorkspace = flyout.getWorkspace();
      setInterval(() => {
        const cursor = flyoutWorkspace.getCursor();
        if (cursor) {
          const curNode = cursor.getCurNode();
          if (curNode) {
            const block = curNode.getSourceBlock();
            if (block && (!this.lastAnnouncedBlockId || this.lastAnnouncedBlockId !== block.id)) {
              this.lastAnnouncedBlockId = block.id;
              const blockSvg = block as Blockly.BlockSvg;
              const position = this.getBlockPositionInFlyout(blockSvg);
              const blockDescription = this.getBlockDescription(block);

              if (position) {
                this.speak(`${blockDescription}, ${position.index} of ${position.total}`);
              } else {
                this.speak(blockDescription);
              }
            }
          }
        }
      }, 500);
    }
  }

  // ============================================================================
  // MENU AND DROPDOWN NAVIGATION
  // ============================================================================

  /**
   * Set up comprehensive Blockly menu listeners with better symbol handling
   */
  private setupComprehensiveMenuListeners(): void {
    this.debugLog('Setting up comprehensive menu listeners...');

    let menuObserver: MutationObserver | null = null;
    let lastAnnouncedMenuItem: string = '';
    let menuItemCount: number = 0;
    let currentMenuIndex: number = -1;
    let monitorInterval: number | null = null;
    let isMenuOpen: boolean = false;
    let hasAnnouncedMenuOpen: boolean = false;

    const getMenuItemText = (element: Element): string => {
      let text = '';
      const contentSpan = element.querySelector('.blocklyMenuItemContent');

      if (contentSpan) {
        text = contentSpan.textContent?.trim() || '';
        if (!text || text === 'sqrt') {
          const innerHTML = contentSpan.innerHTML;
          text = innerHTML.replace(/<[^>]*>/g, '').trim();
        }
      }

      if (!text || text === 'sqrt') {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let textContent = '';
        let node;
        while (node = walker.nextNode()) {
          if (node.nodeValue) {
            textContent += node.nodeValue;
          }
        }
        if (textContent.trim()) {
          text = textContent.trim();
        }
      }

      if (!text || text === 'sqrt') {
        text = element.textContent?.trim() || '';
      }

      this.debugLog(`Raw menu text: "${text}"`);
      text = text.replace(/\s*\(.*?\)\s*$/, '').trim();
      const converted = this.cleanTextForScreenReader(text);

      if (text !== converted) {
        this.debugLog(`Converting "${text}" to "${converted}"`);
      }

      return converted || 'Unknown menu item';
    };

    const announceMenuItem = (item: Element, index: number, total: number) => {
      let text = getMenuItemText(item);

      // Special handling for sqrt items
      if (text === 'sqrt' || text === '√') {
        const fullText = item.textContent?.trim() || '';
        this.debugLog(`Full element text for sqrt item: "${fullText}"`);

        if (fullText.includes('sqrt(2)') || fullText.includes('√2')) {
          text = 'square root of 2';
        } else if (fullText.includes('sqrt(1/2)') || fullText.includes('√½')) {
          text = 'square root of one half';
        } else if (fullText.includes('sqrt')) {
          const match = fullText.match(/sqrt\(([^)]+)\)/);
          if (match && match[1]) {
            text = `square root of ${match[1]}`;
          }
        }
      }

      const isDisabled = item.classList.contains('blocklyMenuItemDisabled') ||
        item.classList.contains('blocklyContextMenuDisabled');
      const announcementKey = `${text}-${index}`;

      if (announcementKey !== lastAnnouncedMenuItem) {
        lastAnnouncedMenuItem = announcementKey;
        const position = total > 1 ? `, ${index + 1} of ${total}` : '';
        const status = isDisabled ? ' (disabled)' : '';
        this.speakHighPriority(`${text}${status}${position}`);
      }
    };

    const monitorDropdownMenu = () => {
      const dropdownDiv = document.querySelector('.blocklyDropDownDiv') as HTMLElement;

      if (dropdownDiv && dropdownDiv.style.display !== 'none') {
        const menuItems = dropdownDiv.querySelectorAll('.blocklyMenuItem');
        const newMenuItemCount = menuItems.length;

        if (newMenuItemCount !== menuItemCount) {
          menuItemCount = newMenuItemCount;
        }

        const highlightedItem = dropdownDiv.querySelector('.blocklyMenuItemHighlight');
        if (highlightedItem) {
          const index = Array.from(menuItems).indexOf(highlightedItem);
          if (index !== -1 && index !== currentMenuIndex) {
            currentMenuIndex = index;
            announceMenuItem(highlightedItem, index, menuItemCount);
          }
        }
      } else if (isMenuOpen) {
        isMenuOpen = false;
        hasAnnouncedMenuOpen = false;
        lastAnnouncedMenuItem = '';
        currentMenuIndex = -1;
        this.speak('Menu closed');
        if (monitorInterval) {
          clearInterval(monitorInterval);
          monitorInterval = null;
        }
      }
    };

    // Set up mutation observer
    menuObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target instanceof HTMLElement) {
          if (mutation.target.classList.contains('blocklyDropDownDiv')) {
            const isVisible = mutation.target.style.display !== 'none';

            if (isVisible && !isMenuOpen) {
              isMenuOpen = true;
              hasAnnouncedMenuOpen = false;
              lastAnnouncedMenuItem = '';
              currentMenuIndex = -1;

              if (!hasAnnouncedMenuOpen) {
                hasAnnouncedMenuOpen = true;
                setTimeout(() => {
                  const menuItems = (mutation.target as HTMLElement).querySelectorAll('.blocklyMenuItem');
                  const itemCount = menuItems.length;

                  if (itemCount > 0) {
                    this.speak(`Menu opened with ${itemCount} items. Use arrow keys to navigate.`);

                    if (monitorInterval) {
                      clearInterval(monitorInterval);
                      monitorInterval = null;
                    }

                    monitorInterval = window.setInterval(monitorDropdownMenu, 50);

                    setTimeout(() => {
                      if (monitorInterval) {
                        clearInterval(monitorInterval);
                        monitorInterval = null;
                      }
                    }, 30000);
                  }
                }, 100);
              }
            }
          }
        }

        if (mutation.type === 'attributes' &&
          mutation.attributeName === 'class' &&
          isMenuOpen) {
          const target = mutation.target as HTMLElement;
          if (target.classList.contains('blocklyMenuItem') &&
            target.classList.contains('blocklyMenuItemHighlight')) {
            const menuItems = target.parentElement?.querySelectorAll('.blocklyMenuItem');
            if (menuItems) {
              const index = Array.from(menuItems).indexOf(target);
              if (index !== -1 && index !== currentMenuIndex) {
                currentMenuIndex = index;
                announceMenuItem(target, index, menuItems.length);
              }
            }
          }
        }
      });
    });

    menuObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Enhanced keyboard navigation for menus
    document.addEventListener('keydown', (e) => {
      if (!isMenuOpen) return;

      const dropdownDiv = document.querySelector('.blocklyDropDownDiv') as HTMLElement;
      const dropdownVisible = dropdownDiv?.style.display !== 'none';

      if (dropdownVisible) {
        if (e.key === 'Escape') {
          this.speak('Closing menu');
        } else if (e.key === 'Enter' || e.key === ' ') {
          const highlightedItem = document.querySelector('.blocklyMenuItemHighlight');
          if (highlightedItem) {
            const itemText = getMenuItemText(highlightedItem);
            this.speak(`Selected ${itemText}`);
          }
        }
      }
    });

    this.menuObservers = { menuObserver, contextMenuObserver: null };
  }

  /**
   * Set up listener for toolbox selection changes
   */
  private setupToolboxSelectionListener(): void {
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) {
        const selectEvent = event as Blockly.Events.ToolboxItemSelect;
        const toolbox = this.workspace.getToolbox();

        if (!toolbox || !(toolbox instanceof Blockly.Toolbox)) return;

        const selectedItem = toolbox.getSelectedItem();
        if (selectedItem && 'getName' in selectedItem && typeof selectedItem.getName === 'function') {
          const categoryName = selectedItem.getName();
          const firstLetter = categoryName.charAt(0).toUpperCase();
          const allItems = toolbox.getToolboxItems();
          const matchingItems = allItems.filter((item: Blockly.IToolboxItem) => {
            if ('getName' in item && typeof item.getName === 'function') {
              return item.getName().toUpperCase().startsWith(firstLetter) && item.isSelectable();
            }
            return false;
          });

          if (matchingItems.length > 1) {
            const currentIndex = matchingItems.findIndex((item: Blockly.IToolboxItem) => item === selectedItem) + 1;
            this.speakHighPriority(
              `${categoryName} category, ${currentIndex} of ${matchingItems.length} starting with ${firstLetter}`
            );
          } else {
            this.speakHighPriority(`${categoryName} category selected`);
          }
        }
      }
    });
  }

  /**
   * Set up dropdown navigation for form controls
   */
  private setupDropdownNavigation(): void {
    this.debugLog('Setting up dropdown navigation listeners...');

    const handleSelectNavigation = (select: HTMLSelectElement) => {
      if (select.hasAttribute('data-dropdown-handled')) return;
      select.setAttribute('data-dropdown-handled', 'true');

      select.addEventListener('focus', () => {
        const label = this.findLabelForElement(select);
        const currentOption = select.options[select.selectedIndex]?.text || 'No selection';
        this.speak(`${label} dropdown. Currently selected: ${currentOption}. Use arrow keys to navigate options.`);
      });

      select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex]?.text;
        const label = this.findLabelForElement(select);
        if (selectedOption) {
          this.speak(`${label} changed to ${selectedOption}`);
        }
      });
    };

    // Setup for various dropdowns
    ['scenario', 'toolbox', 'renderer'].forEach(id => {
      const dropdown = document.getElementById(id) as HTMLSelectElement;
      if (dropdown) {
        this.debugLog(`Found ${id} dropdown`);
        handleSelectNavigation(dropdown);
      }
    });
  }

  /**
   * Set up comprehensive focus event handling
   */
  private setupFocusEventListeners(): void {
    const flyoutElement = getFlyoutElement(this.workspace);
    if (flyoutElement) {
      flyoutElement.addEventListener('focus', () => {
        this.debugLog('Flyout focused');
        this.speak("Blocks menu focused.");
        this.hasLeftWorkspace = true;
      });

      flyoutElement.addEventListener('blur', () => {
        this.debugLog('Flyout blurred');
      });
    }

    // General focus event handling
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      this.debugLog(`Focus changed to: ${target.tagName} ${target.id || target.className || 'unnamed'}`);

      if (target.hasAttribute('data-dropdown-handled') ||
        target.hasAttribute('data-screen-reader-handled')) {
        return;
      }

      // Handle toolbox category group
      if (target.classList.contains('blocklyToolboxCategoryGroup') &&
        target.getAttribute('role') === 'tree') {
        const selectedItem = target.querySelector('[aria-selected="true"]');
        const categoryName = selectedItem?.textContent?.trim() || 'first category';
        this.speak(`Blocks menu categories. ${categoryName} selected. Use arrow keys to navigate.`);

        if (!target.hasAttribute('data-arrow-handler')) {
          target.setAttribute('data-arrow-handler', 'true');
          target.addEventListener('keydown', (event) => {
            const ke = event as KeyboardEvent;
            if (ke.key === 'ArrowUp' || ke.key === 'ArrowDown') {
              setTimeout(() => {
                const newSelected = target.querySelector('[aria-selected="true"]');
                if (newSelected) {
                  this.speak(newSelected.textContent?.trim() || 'Unknown category');
                }
              }, 50);
            }
          });
        }
        return;
      }

      // Handle different form controls
      this.handleFormControlFocus(target);
    });

    // Handle "Disable stack connections" checkbox specifically
    const noStackCheckbox = document.getElementById('noStack');
    if (noStackCheckbox) {
      noStackCheckbox.addEventListener('change', (e) => {
        const checkbox = e.target as HTMLInputElement;
        this.speak(`Disable stack connections: ${checkbox.checked ? 'Checked' : 'Unchecked'}`);
      });
    }
  }

  /**
   * Handle focus events for different form control types
   */
  private handleFormControlFocus(target: HTMLElement): void {
    switch (target.tagName) {
      case 'BUTTON':
        const buttonText = target.textContent?.trim() || target.getAttribute('aria-label') || 'Unknown button';
        this.speak(`${buttonText} button`);
        break;

      case 'SELECT':
        const select = target as HTMLSelectElement;
        if (!select.hasAttribute('data-dropdown-handled')) {
          const selectLabel = this.findLabelForElement(select);
          const currentSelection = select.options[select.selectedIndex]?.text || 'No selection';

          if (select.classList.contains('blocklyDropdown') || select.closest('.blocklyDropdownDiv')) {
            this.speak(`Block dropdown: ${selectLabel || 'Field selector'}. Currently: ${currentSelection}. Use arrow keys to navigate.`);
          } else {
            this.speak(`${selectLabel} dropdown. Currently selected: ${currentSelection}. Use arrow keys to navigate.`);
          }
        }
        break;

      case 'INPUT':
        this.handleInputFocus(target as HTMLInputElement);
        break;

      case 'TEXTAREA':
        const textarea = target as HTMLTextAreaElement;
        const textareaLabel = this.findLabelForElement(textarea);
        const textContent = textarea.value || 'Empty';
        this.speak(`Text area: ${textareaLabel}. Current content: ${textContent}`);
        break;
    }
  }

  /**
   * Handle focus events for input elements
   */
  private handleInputFocus(input: HTMLInputElement): void {
    const inputLabel = this.findLabelForElement(input);

    switch (input.type) {
      case 'checkbox':
        const checkboxState = input.checked ? 'Checked' : 'Not checked';
        this.speak(`Checkbox: ${inputLabel}. ${checkboxState}. Press space to toggle.`);
        break;

      case 'radio':
        const radioState = input.checked ? 'Selected' : 'Not selected';
        this.speak(`Radio button: ${inputLabel}. ${radioState}`);
        break;

      case 'text':
      case 'number':
        const currentValue = input.value || 'Empty';
        this.speak(`${input.type === 'number' ? 'Number' : 'Text'} input: ${inputLabel}. Current value: ${currentValue}`);
        break;

      default:
        this.speak(`Input field: ${inputLabel || input.type}`);
    }
  }

  /**
   * Find the label text for a form element
   */
  private findLabelForElement(element: HTMLElement): string {
    // Try to find a label with a matching 'for' attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }

    // Try to find a parent label element
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'LABEL' && parent.textContent) {
        return parent.textContent.trim();
      }
      parent = parent.parentElement;
    }

    return element.id || "Unnamed element";
  }

  // ============================================================================
  // FIELD EDITING SUPPORT
  // ============================================================================

  /**
   * Set up field editing listeners for text and number inputs
   */
  private setupFieldEditingListeners(): void {
    this.debugLog('Setting up field editing listeners...');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const inputs = node.querySelectorAll('input[type="text"], input[type="number"]');
            inputs.forEach((input) => {
              if (input instanceof HTMLInputElement && input.classList.contains('blocklyHtmlInput')) {
                this.attachFieldEditingListener(input);
              }
            });

            if (node instanceof HTMLInputElement && node.classList.contains('blocklyHtmlInput')) {
              this.attachFieldEditingListener(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Attach editing listeners to a specific input field
   */
  private attachFieldEditingListener(input: HTMLInputElement): void {
    const inputId = this.generateInputId(input);

    if (this.fieldEditingListeners.has(inputId)) return;

    this.debugLog(`Attaching field editing listener to input: ${inputId}`);

    let lastValue = input.value;
    let isBackspaceOrDelete = false;

    const keydownListener = (e: KeyboardEvent) => {
      isBackspaceOrDelete = e.key === 'Backspace' || e.key === 'Delete';
      lastValue = input.value;
    };

    const inputListener = (e: Event) => {
      const currentValue = input.value;
      this.announceFieldChange(lastValue, currentValue, isBackspaceOrDelete);
      lastValue = currentValue;
      isBackspaceOrDelete = false;
    };

    this.fieldEditingListeners.set(inputId, {
      input,
      lastValue,
      keydownListener,
      inputListener
    });

    input.addEventListener('keydown', keydownListener);
    input.addEventListener('input', inputListener);

    const cleanupListener = () => {
      this.removeFieldEditingListener(inputId);
    };

    input.addEventListener('blur', cleanupListener);
    input.addEventListener('remove', cleanupListener);
  }

  /**
   * Generate a unique ID for an input field
   */
  private generateInputId(input: HTMLInputElement): string {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Announce the character that was added or removed from a field
   */
  private announceFieldChange(oldValue: string, newValue: string, wasDelete: boolean): void {
    this.debugLog(`Field change: "${oldValue}" -> "${newValue}", wasDelete: ${wasDelete}`);

    // Handle deletion
    if (newValue.length < oldValue.length) {
      const deletedChars = oldValue.slice(newValue.length);
      for (const char of deletedChars) {
        const announcement = this.getCharacterAnnouncement(char);
        this.speakHighPriority(`Deleted ${announcement}`);
      }
      return;
    }

    // Handle addition
    if (newValue.length > oldValue.length) {
      const addedChars = newValue.slice(oldValue.length);
      for (const char of addedChars) {
        const announcement = this.getCharacterAnnouncement(char);
        this.speakHighPriority(announcement);
      }
      return;
    }

    // Handle replacement (same length but different content)
    if (oldValue !== newValue && oldValue.length === newValue.length) {
      for (let i = 0; i < newValue.length; i++) {
        if (oldValue[i] !== newValue[i]) {
          const announcement = this.getCharacterAnnouncement(newValue[i]);
          this.speakHighPriority(announcement);
          break;
        }
      }
    }
  }

  /**
   * Get the screen reader announcement for a character
   */
  private getCharacterAnnouncement(char: string): string {
    const numbers: { [key: string]: string } = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
    };

    const specialChars: { [key: string]: string } = {
      '.': 'dot', ',': 'comma', '-': 'minus', '+': 'plus', ' ': 'space',
      '(': 'left parenthesis', ')': 'right parenthesis', '[': 'left bracket',
      ']': 'right bracket', '{': 'left brace', '}': 'right brace',
      '=': 'equals', '<': 'less than', '>': 'greater than', '/': 'slash',
      '\\': 'backslash', '*': 'asterisk', '%': 'percent', '#': 'hash',
      '@': 'at', '&': 'ampersand', '!': 'exclamation', '?': 'question mark',
      ':': 'colon', ';': 'semicolon', '"': 'quote', "'": 'apostrophe',
      '`': 'backtick', '~': 'tilde', '^': 'caret', '_': 'underscore', '|': 'pipe'
    };

    if (numbers[char]) return numbers[char];
    if (specialChars[char]) return specialChars[char];
    if (/[a-zA-Z]/.test(char)) return char.toLowerCase();
    return char;
  }

  /**
   * Remove field editing listener for a specific input
   */
  private removeFieldEditingListener(inputId: string): void {
    const listener = this.fieldEditingListeners.get(inputId);
    if (listener) {
      listener.input.removeEventListener('keydown', listener.keydownListener);
      listener.input.removeEventListener('input', listener.inputListener);
      this.fieldEditingListeners.delete(inputId);
      this.debugLog(`Removed field editing listener: ${inputId}`);
    }
  }

  /**
   * Clean up all field editing listeners
   */
  private disposeFieldEditingListeners(): void {
    this.fieldEditingListeners.forEach((listener, inputId) => {
      this.removeFieldEditingListener(inputId);
    });
    this.fieldEditingListeners.clear();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Debug logging function
   */
  private debugLog(message: string): void {
    if (this.debugMode) {
      console.log(`[ScreenReader] ${message}`);
    }
  }

  // ============================================================================
  // CLEANUP AND DISPOSAL
  // ============================================================================

  /**
   * Dispose of the screen reader and clean up all listeners
   */
  public dispose(): void {
    this.debugLog('Disposing screen reader...');

    this.disposeFieldEditingListeners();

    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }

    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer);
      this.interruptionTimer = null;
    }

    // Clean up menu observers
    if (this.menuObservers) {
      if (this.menuObservers.menuObserver) {
        this.menuObservers.menuObserver.disconnect();
      }
      if (this.menuObservers.contextMenuObserver) {
        this.menuObservers.contextMenuObserver.disconnect();
      }
    }

    // Cancel any pending speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}