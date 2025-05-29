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
  private speechQueue: string[] = [];
  private isSpeaking: boolean = false;
  private debugMode: boolean = true; // Enable debug logging

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private utteranceStartTime: number = 0;
  private minSpeakTime: number = 500; // Minimum time in ms to speak before allowing interruption
  private interruptionDelay: number = 300; // Grace period before interrupting
  private pendingMessage: string | null = null;
  private interruptionTimer: number | null = null;
  private hasLeftWorkspace: boolean = false;


  /**
   * Constructs a new ScreenReader instance.
   * @param workspace The Blockly workspace to attach to.
   */
  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace;
    this.debugLog('Initializing ScreenReader...');

    // Initialize speech synthesis properly
    this.initializeSpeechSynthesis();

    // Initialize all event listeners
    this.initEventListeners();

    // Setup workspace cursor listener
    this.setupWorkspaceCursorListener();

    // Setup Blockly-specific field listeners
    this.setupBlocklyFieldListeners();

    this.setupColorPickerListeners();


    // // Announce that screen reader is ready
    // setTimeout(() => {
    //   this.speak('Screen reader enabled. Press Tab to navigate between controls. Use arrow keys within menus.');
    // }, 500);
  }
  /**
   * Initialize speech synthesis with proper voice loading
   */
  private initializeSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      // Force voices to load
      let voices = window.speechSynthesis.getVoices();

      if (voices.length === 0) {
        // Voices not loaded yet, wait for them
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          this.debugLog(`Loaded ${voices.length} voices`);
          this.testSpeechAfterVoicesLoaded();
        };
      } else {
        this.testSpeechAfterVoicesLoaded();
      }
    }
  }



  /**
   * Test speech after voices are loaded
   */
  private testSpeechAfterVoicesLoaded(): void {
    // Test speech once voices are definitely loaded
    setTimeout(() => {
      this.speak('Screen reader enabled. Press Tab to navigate between controls. Use arrow keys within menus.');
    }, 100);
  }

  /**
   * Test if speech synthesis is working
   */
  private testSpeechSynthesis(): void {
    this.debugLog('Testing speech synthesis...');

    if (!('speechSynthesis' in window)) {
      this.debugLog('ERROR: speechSynthesis not available in this browser');
      return;
    }

    this.debugLog('speechSynthesis is available');

    // Test basic speech
    try {
      const testUtterance = new SpeechSynthesisUtterance('Screen reader test');
      testUtterance.rate = 1.7;
      testUtterance.pitch = 1.0;
      testUtterance.volume = 1.0;

      testUtterance.onstart = () => this.debugLog('Test speech started successfully');
      testUtterance.onend = () => this.debugLog('Test speech ended successfully');
      testUtterance.onerror = (event) => this.debugLog(`Test speech error: ${event.error}`);

      window.speechSynthesis.speak(testUtterance);
      this.debugLog('Test speech initiated');
    } catch (error) {
      this.debugLog(`ERROR: Failed to create test utterance: ${error}`);
    }
  }

  /**
   * Debug logging function
   */
  private debugLog(message: string): void {
    if (this.debugMode) {
      console.log(`[ScreenReader] ${message}`);
    }
  }

  private setupDropdownNavigation(): void {
    this.debugLog('Setting up dropdown navigation listeners...');



    // Generic handler for all select elements
    // Generic handler for all select elements
    const handleSelectNavigation = (select: HTMLSelectElement) => {
      // Mark as handled to prevent duplicate announcements
      if (select.hasAttribute('data-dropdown-handled')) {
        return;
      }
      select.setAttribute('data-dropdown-handled', 'true');

      // Announce when dropdown receives focus
      select.addEventListener('focus', () => {
        const label = this.findLabelForElement(select);
        const currentOption = select.options[select.selectedIndex]?.text || 'No selection';
        this.speak(`${label} dropdown. Currently selected: ${currentOption}. Use arrow keys to navigate options.`);
      });

      // Announce when selection changes
      select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex]?.text;
        const label = this.findLabelForElement(select);
        if (selectedOption) {
          this.speak(`${label} changed to ${selectedOption}`);
        }
      });
    };

    // Setup for emoji dropdown (if it exists in the workspace)
    const emojiDropdown = document.querySelector('select#emoji') as HTMLSelectElement;
    if (emojiDropdown) {
      this.debugLog('Found emoji dropdown');

      // Custom handling for emoji dropdown to announce emoji names
      emojiDropdown.addEventListener('focus', () => {
        const currentEmoji = emojiDropdown.value;
        const emojiName = this.getEmojiName(currentEmoji);
        this.speak(`Emoji dropdown. Currently selected: ${emojiName}. Use arrow keys to navigate options.`);
      });

      emojiDropdown.addEventListener('keydown', (e) => {
        setTimeout(() => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const selectedEmoji = emojiDropdown.value;
            const emojiName = this.getEmojiName(selectedEmoji);
            this.speak(emojiName);
          }
        }, 10);
      });

      emojiDropdown.addEventListener('change', () => {
        const selectedEmoji = emojiDropdown.value;
        const emojiName = this.getEmojiName(selectedEmoji);
        this.speak(`Emoji changed to ${emojiName}`);
      });
    }

    // Setup for scenario dropdown
    const scenarioDropdown = document.getElementById('scenario') as HTMLSelectElement;
    if (scenarioDropdown) {
      this.debugLog('Found scenario dropdown');
      handleSelectNavigation(scenarioDropdown);
    }

    // Setup for toolbox dropdown
    const toolboxDropdown = document.getElementById('toolbox') as HTMLSelectElement;
    if (toolboxDropdown) {
      this.debugLog('Found toolbox dropdown');
      handleSelectNavigation(toolboxDropdown);
    }

    // Setup for renderer dropdown
    const rendererDropdown = document.getElementById('renderer') as HTMLSelectElement;
    if (rendererDropdown) {
      this.debugLog('Found renderer dropdown');
      handleSelectNavigation(rendererDropdown);
    }

    // Also handle any dropdowns that might be dynamically created in the workspace
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.UI && (event as any).element === 'field') {
        // A field editor might have opened
        setTimeout(() => {
          const activeDropdown = document.querySelector('select:focus') as HTMLSelectElement;
          if (activeDropdown && !activeDropdown.hasAttribute('data-screen-reader-setup')) {
            activeDropdown.setAttribute('data-screen-reader-setup', 'true');
            this.debugLog('Setting up dynamically created dropdown');
            handleSelectNavigation(activeDropdown);
          }
        }, 100);
      }

      if (event.type === Blockly.Events.UI) {
        // Cast to any first to access properties, since Blockly.Events.UI might not have full typing
        const uiEvent = event as any;
        if (uiEvent.element === 'click' || uiEvent.element === 'field') {
          this.debugLog('UI event detected, checking for color picker');

          // Check for color picker with a delay
          setTimeout(() => {
            const dropdownDiv = document.querySelector('.blocklyDropDownDiv:not([style*="display: none"])') as HTMLElement;
            if (dropdownDiv) {
              this.detectAndHandleColorPicker(dropdownDiv);
            }

            const widgetDiv = document.querySelector('.blocklyWidgetDiv:not([style*="display: none"])') as HTMLElement;
            if (widgetDiv) {
              this.detectAndHandleColorPicker(widgetDiv);
            }
          }, 200);
        }
      }
    });
  }

  // Helper method to get friendly names for emojis
  private getEmojiName(emoji: string): string {
    const emojiMap: { [key: string]: string } = {
      '❤️': 'red heart',
      '✨': 'sparkles',
      '🐻': 'bear face',
      '🌟': 'glowing star',
      '🌈': 'rainbow',
      '🎈': 'balloon',
      '🎨': 'artist palette',
      '🌺': 'hibiscus flower',
      '🦋': 'butterfly',
      '🌙': 'crescent moon'
    };

    return emojiMap[emoji] || `emoji ${emoji}`;
  }


  /**
   * Initialize event listeners for workspace changes.
   */
  private initEventListeners(): void {
    this.debugLog('Initializing event listeners...');

    // Add a keyboard event listener to detect Tab key navigation
    document.addEventListener('keydown', (e) => {
      // Check if Tab key was pressed
      if (e.key === 'Tab') {
        this.debugLog('Tab key detected');
        // Give a small delay to let the focus settle
        // Mark that we might be leaving the workspace
        const currentActive = document.activeElement;
        if (currentActive === this.workspace.getParentSvg() ||
          this.workspace.getParentSvg().contains(currentActive as Node)) {
          // We're currently in the workspace, so tabbing might take us out
          this.hasLeftWorkspace = true;
        }

        setTimeout(() => {
          // Check what element is now focused
          const activeElement = document.activeElement;
          this.debugLog(`Active element after Tab: ${activeElement?.tagName} ${activeElement?.id}`);

          // Check if the toolbox has focus
          const toolboxElement = getToolboxElement(this.workspace);
          if (toolboxElement && toolboxElement.contains(activeElement)) {
            this.speak("Toolbox focused.");
          }
        }, 100);
      }
    });

    this.setupDropdownNavigation();

    // Listen for block selection changes
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
        this.speak("Block deleted");
      } else if (event.type === Blockly.Events.BLOCK_CHANGE) {
        const changeEvent = event as Blockly.Events.BlockChange;
        this.debugLog(`Block changed: ${changeEvent.blockId}`);
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
      this.debugLog('Workspace focused');

      // Always announce workspace focus
      this.speak("Workspace focused. Use arrow keys to navigate blocks.");

      // If we're coming back to the workspace after leaving, reset the last node ID
      if (this.hasLeftWorkspace) {
        this.lastWorkspaceNodeId = null;
        this.hasLeftWorkspace = false;
        this.debugLog('Reset lastWorkspaceNodeId because returning to workspace');
      }
    });

    workspaceElement.addEventListener('blur', () => {
      this.debugLog('Workspace blurred');
      this.hasLeftWorkspace = true;
    });

    // Flyout focus
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

    /**
 * Improved focus event handling for better form control announcements
 * Replace the existing focusin event listener in screen_reader.ts
 */

    // 4. Update the focusin event listener to skip already-handled dropdowns
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      this.debugLog(`Focus changed to: ${target.tagName} ${target.id || target.className || 'unnamed'}`);

      // Skip if this element has already been handled by specific handlers
      if (target.hasAttribute('data-dropdown-handled') ||
        target.hasAttribute('data-screen-reader-handled')) {
        return;
      }

      // Handle different types of form controls
      switch (target.tagName) {
        case 'BUTTON':
          const buttonText = target.textContent?.trim() || target.getAttribute('aria-label') || 'Unknown button';
          this.speak(`Button: ${buttonText}`);
          break;

        case 'SELECT':
          // Only announce if not already handled by setupDropdownNavigation
          const select = target as HTMLSelectElement;
          if (!select.hasAttribute('data-dropdown-handled')) {
            const selectLabel = this.findLabelForElement(select);
            const currentSelection = select.options[select.selectedIndex]?.text || 'No selection';

            // Check if this is a Blockly field dropdown
            if (select.classList.contains('blocklyDropdown') || select.closest('.blocklyDropdownDiv')) {
              this.speak(`Block dropdown: ${selectLabel || 'Field selector'}. Currently: ${currentSelection}. Use arrow keys to navigate.`);
            } else {
              this.speak(`${selectLabel} dropdown. Currently selected: ${currentSelection}. Use arrow keys to navigate.`);
            }
          }
          break;
        case 'INPUT':
          const input = target as HTMLInputElement;
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
          break;

        case 'TEXTAREA':
          const textarea = target as HTMLTextAreaElement;
          const textareaLabel = this.findLabelForElement(textarea);
          const textContent = textarea.value || 'Empty';
          this.speak(`Text area: ${textareaLabel}. Current content: ${textContent}`);
          break;

        default:
          // Check if it's a focusable div or other element with a role
          const role = target.getAttribute('role');
          const ariaLabel = target.getAttribute('aria-label');

          if (role || ariaLabel) {
            this.speak(`${role || 'Element'}: ${ariaLabel || 'Interactive element'}`);
          }
          // Don't announce every div focus, only meaningful ones
          break;
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
    this.debugLog('Setting up workspace cursor listener...');

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

          // Check if workspace has focus - if not, we might need to re-announce when it regains focus
          const workspaceHasFocus = document.activeElement === this.workspace.getParentSvg() ||
            this.workspace.getParentSvg().contains(document.activeElement as Node);

          if (this.lastWorkspaceNodeId !== currentNodeId ||
            (workspaceHasFocus && this.hasLeftWorkspace)) {
            this.lastWorkspaceNodeId = currentNodeId;
            this.announceNode(curNode);

            // Reset the flag if we've announced after returning
            if (this.hasLeftWorkspace && workspaceHasFocus) {
              this.hasLeftWorkspace = false;
            }
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
    // Use high priority for block selection announcements too
    this.speakHighPriority(`Selected ${description}`);
  }


  /**
   * Support for Blockly dropdown fields within blocks
   * Add this to the screen_reader.ts file
   */

  // Update the setupBlocklyFieldListeners method to better detect color pickers
  private setupBlocklyFieldListeners(): void {
    this.debugLog('Setting up Blockly field listeners...');

    // Listen for when Blockly dropdown divs are shown
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check if it's a Blockly dropdown menu
              if (node.classList.contains('blocklyDropdownMenu') ||
                node.querySelector('.blocklyDropdownMenu')) {
                this.handleBlocklyDropdownMenu(node);
              }

              // Check if it's a Blockly widget div with dropdown
              if (node.classList.contains('blocklyWidgetDiv') &&
                node.querySelector('select')) {
                const select = node.querySelector('select') as HTMLSelectElement;
                this.handleBlocklyDropdownSelect(select);
              }

              // Check for color picker elements - look for any dropdown div
              if (node.classList.contains('blocklyDropDownDiv') ||
                node.classList.contains('blocklyWidgetDiv')) {
                // Use a slight delay to ensure the color picker is fully rendered
                setTimeout(() => {
                  this.detectAndHandleColorPicker(node);
                }, 100);
              }
            }
          });
        }
      });
    });

    // Observe the body for dropdown additions
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // New method to detect color picker more reliably
  private detectAndHandleColorPicker(element: HTMLElement): void {
    this.debugLog('Detecting color picker in element');

    // Look for color cells with various possible selectors
    const colorCells = element.querySelectorAll(
      '[role="button"][style*="background-color"], ' +
      '[role="button"][style*="background"], ' +
      '.blocklyColourCell, ' +
      '[class*="colour"][role="button"], ' +
      '[class*="color"][role="button"]'
    );

    if (colorCells.length > 0) {
      this.debugLog(`Found color picker with ${colorCells.length} color cells`);
      this.handleColorPicker(element);
    }
  }

  // Handle Blockly dropdown menus (div-based dropdowns)
  private handleBlocklyDropdownMenu(menuElement: HTMLElement): void {
    this.debugLog('Blockly dropdown menu detected');

    const menuItems = menuElement.querySelectorAll('.blocklyMenuItem');
    if (menuItems.length > 0) {
      this.speak(`Dropdown menu opened with ${menuItems.length} options. Use arrow keys to navigate.`);

      // Add keyboard navigation announcements
      menuElement.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          setTimeout(() => {
            const focusedItem = menuElement.querySelector('.blocklyMenuItemHighlight');
            if (focusedItem) {
              const itemText = focusedItem.textContent?.trim() || 'Unknown option';
              this.speak(itemText);
            }
          }, 10);
        }
      });
    }
  }

  // Handle Blockly select dropdowns
  private handleBlocklyDropdownSelect(select: HTMLSelectElement): void {
    if (select.hasAttribute('data-screen-reader-handled')) {
      return; // Already set up
    }

    select.setAttribute('data-screen-reader-handled', 'true');
    this.debugLog('Setting up Blockly select dropdown');

    // Get the field name from the block
    const fieldName = this.getFieldNameFromDropdown(select);

    select.addEventListener('focus', () => {
      const currentValue = select.options[select.selectedIndex]?.text || 'No selection';
      this.speak(`${fieldName} dropdown. Currently: ${currentValue}. Use arrow keys to change.`);
    });

    select.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        setTimeout(() => {
          const newValue = select.options[select.selectedIndex]?.text;
          if (newValue) {
            this.speak(newValue);
          }
        }, 10);
      }
    });
  }

  // Helper to get field name from context
  private getFieldNameFromDropdown(element: HTMLElement): string {
    // Try to determine what kind of dropdown this is
    const widgetDiv = element.closest('.blocklyWidgetDiv');
    if (widgetDiv) {
      // Check if we can determine the field type from classes or data attributes
      const classList = element.className;

      if (classList.includes('emoji')) return 'Emoji';
      if (classList.includes('colour') || classList.includes('color')) return 'Color';
      if (classList.includes('angle')) return 'Angle';
      if (classList.includes('variable')) return 'Variable';

      // Try to get from aria-label
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
    }

    return 'Field';
  }

  /**
   * Get a human-readable description of a block.
   * @param block The block to describe.
   * @returns A description string.
   */
  /**
 * Enhanced getBlockDescription method to include field values
 * Replace the existing getBlockDescription method in screen_reader.ts
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
      const emojiName = this.getEmojiName(emoji);
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

    // Enhanced: Add field information for blocks with dropdowns or other editable fields
    const fields = block.inputList
      .flatMap(input => input.fieldRow)
      .filter(field => field.EDITABLE && field.getValue);

    let baseDescription = blockType.replace(/_/g, ' ');

    if (fields.length > 0) {
      const fieldDescriptions = fields.map(field => {
        const fieldName = field.name || 'field';
        let fieldValue = '';

        // Get appropriate field value based on field type
        if (field.getText) {
          fieldValue = field.getText();
        } else {
          fieldValue = String(field.getValue());
        }

        // Special handling for dropdown fields with emojis
        if (fieldName === 'emoji' && fieldValue) {
          fieldValue = this.getEmojiName(fieldValue);
        }

        // Special handling for color fields
        if ((fieldName.toLowerCase().includes('color') || fieldName.toLowerCase().includes('colour')) &&
          fieldValue.startsWith('#')) {
          fieldValue = this.getColorNameFromHex(fieldValue);
        }

        return `${fieldName}: ${fieldValue}`;
      }).join(', ');

      return `${baseDescription} block with ${fieldDescriptions}`;
    }

    // Default description
    return baseDescription + " block";
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

  private setupColorPickerListeners(): void {
    this.debugLog('Setting up color picker listeners...');

    // Listen for when color picker divs are shown
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              // Check if it's a color picker dropdown
              if (node.classList.contains('blocklyDropdownDiv') ||
                node.querySelector('.blocklyColourTable')) {
                this.handleColorPicker(node);
              }
            }
          });
        }
      });
    });

    // Observe the body for color picker additions
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Handle color picker navigation
  private handleColorPicker(pickerElement: HTMLElement): void {
    this.debugLog('Handling color picker');

    // Announce when color picker opens
    this.speak('Color picker opened. Use arrow keys to navigate colors. Press Enter to select.');

    // Find all elements that look like color cells
    const colorCells = pickerElement.querySelectorAll(
      '[role="button"][style*="background-color"], ' +
      '[role="button"][style*="background"], ' +
      '.blocklyColourCell, ' +
      '[class*="colour"][role="button"], ' +
      '[class*="color"][role="button"]'
    );

    this.debugLog(`Found ${colorCells.length} color cells`);

    // Set up hover listeners for each cell
    colorCells.forEach((cell) => {
      if (cell instanceof HTMLElement) {
        // Mouse hover
        cell.addEventListener('mouseenter', () => {
          const color = this.getColorFromCell(cell);
          if (color) {
            this.debugLog(`Mouse hover on color: ${color}`);
            this.speak(color);
          }
        });

        // Click listener
        cell.addEventListener('click', () => {
          const color = this.getColorFromCell(cell);
          if (color) {
            this.speak(`Selected ${color}`);
          }
        });
      }
    });

    // Handle keyboard navigation with multiple event strategies
    const handleKeyboardNavigation = (e: Event) => {
      if (!(e instanceof KeyboardEvent)) return;

      if (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') {
        this.debugLog(`Key pressed in color picker: ${e.key}`);

        // Use a timeout to let Blockly update the UI
        setTimeout(() => {
          // Try multiple strategies to find the currently focused color
          let focusedCell: HTMLElement | null = null;

          // Strategy 1: Look for element with focus
          const activeElement = document.activeElement;
          if (activeElement && activeElement.getAttribute('role') === 'button' &&
            pickerElement.contains(activeElement)) {
            focusedCell = activeElement as HTMLElement;
          }

          // Strategy 2: Look for aria-selected
          if (!focusedCell) {
            focusedCell = pickerElement.querySelector('[aria-selected="true"]') as HTMLElement;
          }

          // Strategy 3: Look for focused class
          if (!focusedCell) {
            focusedCell = pickerElement.querySelector('.blocklyColourHighlighted, .blocklyColourSelected') as HTMLElement;
          }

          // Strategy 4: Look for focused element within color cells
          if (!focusedCell) {
            colorCells.forEach((cell) => {
              if (cell === document.activeElement) {
                focusedCell = cell as HTMLElement;
              }
            });
          }

          if (focusedCell) {
            const color = this.getColorFromCell(focusedCell);
            if (color) {
              this.debugLog(`Keyboard navigation to color: ${color}`);
              if (e.key === 'Enter' || e.key === ' ') {
                this.speak(`Selected ${color}`);
              } else {
                this.speak(color);
              }
            }
          } else {
            this.debugLog('Could not find focused color cell');
          }
        }, 100);
      }
    };

    // Add keyboard listeners to multiple elements to catch events
    pickerElement.addEventListener('keydown', handleKeyboardNavigation, true);

    // Also add to document temporarily while color picker is open
    const documentHandler = (e: Event) => {
      if (pickerElement.style.display !== 'none' && pickerElement.offsetParent !== null) {
        handleKeyboardNavigation(e);
      } else {
        // Remove handler if picker is closed
        document.removeEventListener('keydown', documentHandler, true);
      }
    };

    document.addEventListener('keydown', documentHandler, true);

    // Monitor focus changes within the picker
    pickerElement.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('role') === 'button') {
        const color = this.getColorFromCell(target);
        if (color) {
          this.debugLog(`Focus moved to color: ${color}`);
          this.speak(color);
        }
      }
    });
  }

  // Get color name from a color cell element
  // Enhanced color extraction from cell
  private getColorFromCell(cell: HTMLElement): string | null {
    this.debugLog('Getting color from cell');

    // Method 1: Direct style attribute
    const style = cell.getAttribute('style');
    if (style) {
      const bgMatch = style.match(/background(?:-color)?:\s*([^;]+)/i);
      if (bgMatch) {
        const colorValue = bgMatch[1].trim();
        this.debugLog(`Found color in style attribute: ${colorValue}`);

        if (colorValue.startsWith('#')) {
          return this.getColorNameFromHex(colorValue);
        } else if (colorValue.startsWith('rgb')) {
          const hexColor = this.rgbToHex(colorValue);
          if (hexColor) {
            return this.getColorNameFromHex(hexColor);
          }
        }
      }
    }

    // Method 2: Computed style
    const computedStyle = window.getComputedStyle(cell);
    const bgColor = computedStyle.backgroundColor;
    if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
      const hexColor = this.rgbToHex(bgColor);
      if (hexColor) {
        this.debugLog(`Got color from computed style: ${hexColor}`);
        return this.getColorNameFromHex(hexColor);
      }
    }

    // Method 3: Data attributes
    const dataColor = cell.getAttribute('data-colour') ||
      cell.getAttribute('data-color') ||
      cell.getAttribute('title');
    if (dataColor && dataColor.startsWith('#')) {
      this.debugLog(`Got color from data attribute: ${dataColor}`);
      return this.getColorNameFromHex(dataColor);
    }

    // Method 4: Child elements
    const colorDiv = cell.querySelector('[style*="background"]') as HTMLElement;
    if (colorDiv) {
      return this.getColorFromCell(colorDiv);
    }

    this.debugLog('Could not extract color from cell');
    return null;
  }


  // Convert RGB color string to hex
  private rgbToHex(rgb: string): string | null {
    // Handle hex colors that are already in the right format
    if (rgb.startsWith('#')) {
      return rgb;
    }

    // Handle rgb(r, g, b) format
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);

      const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    return null;
  }


  /**
    * Enhanced speak method with intelligent interruption
    * Replace the existing speak method
    */
  // Update the speak method to clear pending messages for high priority announcements
  private speak(message: string, priority: 'high' | 'normal' = 'normal'): void {
    // Log to console for debugging
    this.debugLog(`Speaking: ${message} (priority: ${priority})`);

    if (!('speechSynthesis' in window)) {
      this.debugLog('speechSynthesis not available');
      return;
    }

    // If there's a pending interruption, clear it
    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer);
      this.interruptionTimer = null;
    }

    // IMPORTANT: Clear pending messages for high priority announcements
    // This prevents old navigation messages from playing when you stop moving
    if (priority === 'high') {
      this.pendingMessage = null;
    }

    // Check if we should interrupt the current speech
    if (this.currentUtterance && window.speechSynthesis.speaking) {
      const timeSpoken = Date.now() - this.utteranceStartTime;

      // For high priority messages, interrupt more aggressively
      if (priority === 'high' && timeSpoken > 200) {
        // High priority can interrupt after just 200ms
        this.interruptCurrentAndSpeak(message);
        return;
      }

      // If the current message has been speaking for less than minimum time
      if (timeSpoken < this.minSpeakTime) {
        // Queue this message to be spoken after a delay
        this.debugLog(`Delaying new message, current has only played for ${timeSpoken}ms`);

        this.pendingMessage = message;
        this.interruptionTimer = window.setTimeout(() => {
          this.interruptCurrentAndSpeak(message);
        }, this.minSpeakTime - timeSpoken + this.interruptionDelay);

        return;
      } else {
        // Current message has played long enough, interrupt it
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

    // Clear any pending message since we're interrupting with a new one
    this.pendingMessage = null;

    // Cancel current speech
    window.speechSynthesis.cancel();
    this.currentUtterance = null;

    // Small delay to ensure cancellation is processed
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

      // Set properties for better screen reader experience
      utterance.rate = 1.7; // Slightly faster than default
      utterance.pitch = 1.0; // Normal pitch
      utterance.volume = 1.0; // Full volume

      // Track the current utterance and start time
      this.currentUtterance = utterance;
      this.utteranceStartTime = Date.now();

      // Add event listeners
      utterance.onstart = () => {
        this.debugLog(`Speech started: "${message}"`);
        this.isSpeaking = true;
      };

      utterance.onend = () => {
        this.debugLog(`Speech ended: "${message}"`);
        this.isSpeaking = false;
        this.currentUtterance = null;

        // Check if there's a pending message
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

      // Speak the utterance
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      this.debugLog(`Error creating speech utterance: ${error}`);
    }
  }

  /**
  * Force speak a message by clearing everything first (use sparingly)
  * Update the existing forceSpeek method
  */
  public forceSpeek(message: string): void {
    if ('speechSynthesis' in window) {
      // Clear any pending interruptions
      if (this.interruptionTimer) {
        clearTimeout(this.interruptionTimer);
        this.interruptionTimer = null;
      }

      // Clear pending messages
      this.pendingMessage = null;

      // Cancel all speech
      window.speechSynthesis.cancel();
      this.currentUtterance = null;

      // Speak after a short delay
      setTimeout(() => this.speakImmediate(message), 100);
    }
  }

  /**
   * Announce a high-priority message (interrupts more aggressively)
   */
  private speakHighPriority(message: string): void {
    this.speak(message, 'high');
  }

  /**
   * Update announceNode to use priority speech for navigation
   */
  private announceNode(node: Blockly.ASTNode): void {
    const type = node.getType();
    const location = node.getLocation();

    // ALL navigation announcements should be high priority to clear pending messages
    if (type === Blockly.ASTNode.types.BLOCK) {
      const block = location as Blockly.Block;
      if (block) {
        // Make announceBlock use high priority
        const description = this.getBlockDescription(block);
        this.speakHighPriority(`Selected ${description}`);
      } else {
        this.speakHighPriority("Unknown block");
      }
    } else if (type === Blockly.ASTNode.types.WORKSPACE) {
      this.speakHighPriority("Workspace. Use arrow keys to navigate blocks.");
    } else if (type === Blockly.ASTNode.types.STACK) {
      const block = location as Blockly.Block;
      if (block) {
        this.speakHighPriority(`Block stack starting with ${this.getBlockDescription(block)}`);
      } else {
        this.speakHighPriority("Unknown block stack");
      }
    } else if (node.isConnection()) {
      const connection = location as Blockly.Connection;
      const block = connection.getSourceBlock();

      if (!block) {
        this.speakHighPriority("Connection on unknown block");
        return;
      }

      // All connection announcements should also be high priority during navigation
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
      const block = field.getSourceBlock();
      if (block) {
        this.speakHighPriority(`Field ${field.name} with value ${field.getText()}`);
      } else {
        this.speakHighPriority(`Field ${field.name} with value ${field.getText()} on unknown block`);
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

  /**
   * Update the dispose method to clean up timers
   */
  public dispose(): void {
    this.debugLog('Disposing screen reader...');

    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }

    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer);
      this.interruptionTimer = null;
    }

    // Cancel any pending speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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

}