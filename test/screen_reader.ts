/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import { getToolboxElement, getFlyoutElement } from '../src/workspace_utilities';

/**
 * A simple screen reader implementation for Blockly that announces actions.
 */
export class ScreenReader {
  private workspace: Blockly.WorkspaceSvg;
  private lastAnnouncedBlockId: string | null = null;
  private cursorInterval: number | null = null;
  private lastWorkspaceNodeId: string | null = null;

  /**
   * Constructs a new ScreenReader instance.
   * @param workspace The Blockly workspace to attach to.
   */
  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace;
    this.initEventListeners();

    // Announce that screen reader is active
    this.speak("Screen reader enabled");
    this.setupWorkspaceCursorListener();
  }

  /**
   * Initialize event listeners for workspace changes.
   */
  private initEventListeners(): void {
    // Add a keyboard event listener to detect Tab key navigation
    document.addEventListener('keydown', (e) => {
      // Check if Tab key was pressed
      if (e.key === 'Tab') {
        // Give a small delay to let the focus settle
        setTimeout(() => {
          // Check what element is now focused
          const activeElement = document.activeElement;

          // Check if the toolbox has focus
          const toolboxElement = getToolboxElement(this.workspace);
          if (toolboxElement && toolboxElement.contains(activeElement)) {
            this.speak("Toolbox focused. Use up and down arrows to navigate categories.");
          }
        }, 100);
      }
    });

    // Listen for block selection changes
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) {
        const selectedEvent = event as Blockly.Events.Selected;
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
        if (createEvent.blockId) {
          const block = this.workspace.getBlockById(createEvent.blockId);
          if (block) {
            this.speak(`${this.getBlockDescription(block)} added to the workspace`);
          }
        }
      } else if (event.type === Blockly.Events.BLOCK_DELETE) {
        this.speak("Block deleted");
      } else if (event.type === Blockly.Events.BLOCK_CHANGE) {
        const changeEvent = event as Blockly.Events.BlockChange;
        if (changeEvent.blockId) {
          const block = this.workspace.getBlockById(changeEvent.blockId);
          if (block) {
            this.speak(`Changed ${this.getBlockDescription(block)}`);
          }
        }
      }
    });


    // Listen for focus changes between major UI components
    // Workspace focus
    const workspaceElement = this.workspace.getParentSvg();
    workspaceElement.addEventListener('focus', () => {
      this.speak("Workspace focused. Use arrow keys to navigate blocks.");
      this.lastWorkspaceNodeId = null; // Reset to ensure next node will be announced
    });

    // Flyout focus
    const flyoutElement = getFlyoutElement(this.workspace);
    if (flyoutElement) {
      flyoutElement.addEventListener('focus', () => {
        this.speak("Blocks menu focused. Use up and down arrows to navigate blocks.");
      });

      // Listen for flyout events
      const flyout = this.workspace.getFlyout();
      if (flyout) {
        const flyoutWorkspace = flyout.getWorkspace();

        // Check for cursor changes in the flyout workspace
        setInterval(() => {
          const cursor = flyoutWorkspace.getCursor();
          if (cursor) {
            const curNode = cursor.getCurNode();
            if (curNode) {
              const block = curNode.getSourceBlock();
              if (block) {
                // Store the last announced block ID to avoid repeating
                if (!this.lastAnnouncedBlockId || this.lastAnnouncedBlockId !== block.id) {
                  this.lastAnnouncedBlockId = block.id;
                  this.speak(`${this.getBlockDescription(block)}`);
                }
              }
            }
          }
        }, 500); // Check every 500ms 

        // Listen for cursor movements in the flyout
        flyoutWorkspace.addChangeListener((event: Blockly.Events.Abstract) => {
          // Check for SELECTED events (when a block is selected)
          if (event.type === Blockly.Events.SELECTED) {
            const selectedEvent = event as Blockly.Events.Selected;
            if (selectedEvent.newElementId) {
              const block = flyoutWorkspace.getBlockById(selectedEvent.newElementId);
              if (block) {
                this.speak(`${this.getBlockDescription(block)}`);
              }
            }
          }

          // Also check for UI events that might indicate block navigation
          if (event.type === Blockly.Events.UI &&
            (event as any).element === 'selected' &&
            (event as any).newValue) {
            const blockId = (event as any).newValue;
            const block = flyoutWorkspace.getBlockById(blockId);
            if (block) {
              this.speak(`${this.getBlockDescription(block)}`);
            }
          }
        });
      }
    }

    // Listen for button and form element focus
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON') {
        this.speak(`Button: ${target.textContent || target.id || 'Unknown button'}`);
      } else if (target.tagName === 'SELECT') {
        const select = target as HTMLSelectElement;
        this.speak(`Dropdown: ${target.id || 'Unknown dropdown'}. Currently selected: ${select.options[select.selectedIndex].text}`);
      } else if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        const checkbox = target as HTMLInputElement;
        const checkboxLabel = this.findLabelForElement(checkbox);
        this.speak(`Checkbox: ${checkboxLabel}. ${checkbox.checked ? 'Checked' : 'Not checked'}`);
      }
    });


    // Listen specifically for the "Disable stack connections" checkbox
    const noStackCheckbox = document.getElementById('noStack');
    if (noStackCheckbox) {
      noStackCheckbox.addEventListener('change', (e) => {
        const checkbox = e.target as HTMLInputElement;
        this.speak(`Disable stack connections: ${checkbox.checked ? 'Checked' : 'Unchecked'}`);
      });
    }
  }

  /**
 * Set up an interval to check for workspace cursor movements
 */
  private setupWorkspaceCursorListener(): void {
    // Clear any existing interval
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }

    // Set up an interval to check for cursor changes in the main workspace
    this.cursorInterval = window.setInterval(() => {
      const cursor = this.workspace.getCursor();
      if (cursor) {
        const curNode = cursor.getCurNode();
        if (curNode) {
          // Track if we've already announced this node
          const currentNodeId = this.getNodeIdentifier(curNode);

          if (this.lastWorkspaceNodeId !== currentNodeId) {
            this.lastWorkspaceNodeId = currentNodeId;
            this.announceNode(curNode);
          }
        }
      }
    }, 250); // Check every 250ms for better responsiveness
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
    } else {
      return `unknown-${type}`;
    }
  }
  /**
 * Announce information about a specific AST node
 */
  private announceNode(node: Blockly.ASTNode): void {
    const type = node.getType();
    const location = node.getLocation();

    if (type === Blockly.ASTNode.types.BLOCK) {
      const block = location as Blockly.Block;
      if (block) {
        this.announceBlock(block);
      } else {
        this.speak("Unknown block");
      }
    } else if (type === Blockly.ASTNode.types.WORKSPACE) {
      this.speak("Workspace. Use arrow keys to navigate blocks.");
    } else if (type === Blockly.ASTNode.types.STACK) {
      const block = location as Blockly.Block;
      if (block) {
        this.speak(`Block stack starting with ${this.getBlockDescription(block)}`);
      } else {
        this.speak("Unknown block stack");
      }
    } else if (node.isConnection()) {
      const connection = location as Blockly.Connection;
      const block = connection.getSourceBlock();

      if (!block) {
        this.speak("Connection on unknown block");
        return;
      }

      if (connection.type === Blockly.PREVIOUS_STATEMENT) {
        this.speak(`Top of ${this.getBlockDescription(block)}`);
      } else if (connection.type === Blockly.NEXT_STATEMENT) {
        this.speak(`Bottom of ${this.getBlockDescription(block)}. Connect a block here.`);
      } else if (connection.type === Blockly.OUTPUT_VALUE) {
        this.speak(`Output connection of ${this.getBlockDescription(block)}`);
      } else if (connection.type === Blockly.INPUT_VALUE) {
        this.speak(`Value input on ${this.getBlockDescription(block)}. Connect a value here.`);
      }
    } else if (type === Blockly.ASTNode.types.FIELD) {
      const field = location as Blockly.Field;
      const block = field.getSourceBlock();
      if (block) {
        this.speak(`Field ${field.name} with value ${field.getText()}`);
      } else {
        this.speak(`Field ${field.name} with value ${field.getText()} on unknown block`);
      }
    } else if (type === Blockly.ASTNode.types.INPUT) {
      const input = location as Blockly.Input;
      const block = input.getSourceBlock();
      if (block) {
        this.speak(`Input ${input.name} on ${this.getBlockDescription(block)}`);
      } else {
        this.speak(`Input ${input.name} on unknown block`);
      }
    } else {
      this.speak(`Unknown element type: ${type}`);
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

    // Fallback to the element's id or a generic description
    return element.id || "Unnamed element";
  }

  /**
   * Announce information about a specific block.
   * @param block The block to announce.
   */
  public announceBlock(block: Blockly.Block): void {
    const description = this.getBlockDescription(block);
    this.speak(`Selected ${description}`);
  }

  /**
   * Get a human-readable description of a block.
   * @param block The block to describe.
   * @returns A description string.
   */
  private getBlockDescription(block: Blockly.Block): string {
    // Get the type of the block
    const blockType = block.type;

    // For certain block types, provide more specific descriptions
    if (blockType === 'p5_setup') {
      return "Setup block";
    } else if (blockType === 'p5_draw') {
      return "Draw block";
    } else if (blockType === 'p5_canvas') {
      const width = block.getFieldValue('WIDTH');
      const height = block.getFieldValue('HEIGHT');
      return `Create Canvas with width ${width} and height ${height}`;
    } else if (blockType === 'math_number') {
      const value = block.getFieldValue('NUM');
      return `Number block with value ${value}`;
    } else if (blockType === 'draw_emoji') {
      const emoji = block.getFieldValue('emoji');
      let emojiName = "emoji";
      if (emoji === '❤️') emojiName = "heart";
      else if (emoji === '✨') emojiName = "sparkle";
      else if (emoji === '🐻') emojiName = "bear";
      return `Draw ${emojiName}`;
    } else if (blockType === 'simple_circle') {
      // Try to get the color from the connected color block
      let colorName = "colored";

      try {
        const colorInput = block.getInput('COLOR');
        if (colorInput && colorInput.connection && colorInput.connection.targetBlock()) {
          const colorBlock = colorInput.connection.targetBlock();
          if (colorBlock && colorBlock.type === 'colour_picker') {
            const colorHex = colorBlock.getFieldValue('COLOUR');
            colorName = this.getColorNameFromHex(colorHex);
          }
        }
      } catch (e) {
        console.log("Error getting circle color:", e);
      }

      return `Draw ${colorName} circle`;
    } else if (blockType === 'p5_background_color') {
      // Try to get the color from the connected color block
      let colorName = "selected";

      try {
        const colorInput = block.getInput('COLOR');
        if (colorInput && colorInput.connection && colorInput.connection.targetBlock()) {
          const colorBlock = colorInput.connection.targetBlock();
          if (colorBlock && colorBlock.type === 'colour_picker') {
            const colorHex = colorBlock.getFieldValue('COLOUR');
            colorName = this.getColorNameFromHex(colorHex);
          }
        }
      } catch (e) {
        console.log("Error getting background color:", e);
      }

      return `Set background color to ${colorName}`;
    } else if (blockType === 'write_text_without_shadow') {
      const text = block.getFieldValue('TEXT');
      return `Write text "${text}" without shadow`;
    } else if (blockType === 'write_text_with_shadow') {
      // Try to determine the text content
      let textContent = "selected text";

      try {
        const textInput = block.getInput('TEXT');
        if (textInput && textInput.connection && textInput.connection.targetBlock()) {
          const textBlock = textInput.connection.targetBlock();
          if (textBlock && (textBlock.type === 'text' || textBlock.type === 'text_only')) {
            textContent = textBlock.getFieldValue('TEXT');
          }
        }
      } catch (e) {
        console.log("Error getting shadow text:", e);
      }

      return `Write text "${textContent}" with shadow`;
    } else if (blockType === 'colour_random') {
      return "Generate random color";
    } else if (blockType === 'colour_picker') {
      const colorHex = block.getFieldValue('COLOUR');
      const colorName = this.getColorNameFromHex(colorHex);
      return `Color: ${colorName}`;
    }

    // Default description based on block type
    const readableType = blockType.replace(/_/g, ' ');
    return readableType + " block";
  }

  // Convert hex color to a name
  private getColorNameFromHex(hexColor: string): string {
    // Remove # if present
    hexColor = hexColor.replace('#', '').toLowerCase();

    // Extended color mapping
    const colorMap: { [key: string]: string } = {
      'ff0000': 'red',
      'ff4500': 'orange-red',
      'ffa500': 'orange',
      'ffff00': 'yellow',
      'adff2f': 'green-yellow',
      '00ff00': 'green',
      '008000': 'dark green',
      '00ffff': 'cyan',
      '0000ff': 'blue',
      '000080': 'navy blue',
      '4b0082': 'indigo',
      '800080': 'purple',
      '9400d3': 'dark violet',
      'ff00ff': 'magenta',
      'ff1493': 'deep pink',
      'ffffff': 'white',
      '000000': 'black',
      'c0c0c0': 'silver',
      '808080': 'gray',
      'a52a2a': 'brown',
      'f0e68c': 'khaki',
      'd2b48c': 'tan',
      '9932cc': 'dark orchid',
      '98fb98': 'pale green',
      'dda0dd': 'plum',
      'f5f5dc': 'beige',
      'ffe4c4': 'bisque',
      'ffc0cb': 'pink'
    };

    // Check if the hex color is in our map
    if (colorMap[hexColor]) {
      return colorMap[hexColor];
    }

    // For unknown colors, try to categorize them by their components
    try {
      // Parse the hex color into RGB components
      const r = parseInt(hexColor.substr(0, 2), 16);
      const g = parseInt(hexColor.substr(2, 2), 16);
      const b = parseInt(hexColor.substr(4, 2), 16);

      // Check which component is dominant
      if (r > g && r > b) {
        if (g > b) return r - g > 50 ? 'reddish orange' : 'orange red';
        return r - b > 50 ? 'bright red' : 'reddish purple';
      } else if (g > r && g > b) {
        if (r > b) return g - r > 50 ? 'yellowish green' : 'yellow green';
        return g - b > 50 ? 'bright green' : 'greenish blue';
      } else if (b > r && b > g) {
        if (r > g) return b - r > 50 ? 'bluish purple' : 'purple blue';
        return b - g > 50 ? 'bright blue' : 'teal blue';
      } else if (r === g && g === b) {
        // Grayscale
        if (r > 200) return 'light gray';
        if (r > 100) return 'gray';
        return 'dark gray';
      }
    } catch (e) {
      console.log("Error parsing color:", e);
    }

    // If all else fails
    return 'custom color';
  }

  /**
   * Speak a message using browser's speech synthesis without canceling previous speech.
   * @param message The message to announce.
   */
  private speak(message: string): void {
    // Log to console for debugging
    console.log(`Screen reader: ${message}`);

    // Use the Web Speech API
    if ('speechSynthesis' in window) {
      // Remove this line that's causing the issue:
      // window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(message);
      // Set properties for better screen reader experience
      utterance.rate = 1.7; // Slightly faster than default
      utterance.pitch = 1.0; // Normal pitch
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
 * Dispose of resources used by the screen reader
 */
  public dispose(): void {
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }
  }
}