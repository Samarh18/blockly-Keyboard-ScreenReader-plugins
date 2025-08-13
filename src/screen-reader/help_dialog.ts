/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly/core';
import { ScreenReader } from './screen_reader';

/**
 * Class for handling the help dialog - follows the same pattern as SettingsDialog.
 */
export class HelpDialog {
  outputDiv: HTMLElement | null;
  modalContainer: HTMLElement | null;
  helpDialog: HTMLDialogElement | null;
  open: boolean;
  closeButton: HTMLElement | null;
  private screenReader: ScreenReader;
  private hasOpenedBefore: boolean = false;

  /**
   * Constructor for help dialog.
   */
  constructor(screenReader: ScreenReader) {
    this.screenReader = screenReader;

    // For help, we'll use a div named 'help'
    this.outputDiv = document.getElementById('help');

    this.open = false;
    this.modalContainer = null;
    this.helpDialog = null;
    this.closeButton = null;

    // Check if this is the first visit
    this.hasOpenedBefore = localStorage.getItem('help-dialog-opened') === 'true';
  }

  /**
   * Open help dialog automatically on first visit
   */
  autoOpenOnFirstVisit() {
    if (!this.hasOpenedBefore) {
      // Delay to ensure page is fully loaded
      setTimeout(() => {
        this.toggle();
        // Mark as opened
        localStorage.setItem('help-dialog-opened', 'true');
        this.hasOpenedBefore = true;

        // IMPORTANT: Enable speech synthesis after user interaction
        this.enableSpeechAfterUserInteraction();
      }, 1000);
    }
  }

  /**
   * Enable speech synthesis after user interaction
   */
  private enableSpeechAfterUserInteraction() {
    // Create a silent utterance to "prime" the speech synthesis
    const silentUtterance = new SpeechSynthesisUtterance('');
    silentUtterance.volume = 0;
    speechSynthesis.speak(silentUtterance);

    // Now test with actual speech
    setTimeout(() => {
      this.screenReader.testSpeechSettings('Speech synthesis is now enabled. Help dialog opened automatically on first visit.');
    }, 100);
  }

  /**
   * Toggle help dialog open/closed
   */
  toggle() {
    if (this.modalContainer && this.helpDialog) {
      if (this.helpDialog.hasAttribute('open')) {
        this.helpDialog.close();
      } else {
        this.helpDialog.showModal();

        // Focus the dialog container itself, not any content inside
        const container = this.helpDialog.querySelector('.help-container') as HTMLElement;
        if (container) {
          container.focus();
        }

        setTimeout(() => {
          this.screenReader.forceSpeek(
            'Help guide opened. Use Tab to navigate. Press Escape to close.'
          );
        }, 100);
      }
    }
  }

  /**
   * Close the help dialog
   */
  private closeDialog(): void {
    this.helpDialog?.close();
    this.screenReader.forceSpeek('Help guide closed.');
  }

  /**
   * Create the help modal content
   */
  createModalContent() {
    const modalContents = `
    <div class="modal-container">
      <dialog class="help-modal">
        <div class="help-container" tabindex="0">
          <div class="header">
            <button class="close-modal" aria-label="Close help">
              <span class="material-symbols-outlined">close</span>
            </button>
            <h1>Blockly Accessibility Guide</h1>
            <p class="help-subtitle">Learn how to navigate and use Blockly with keyboard and screen reader</p>
          </div>
          
          <div class="help-content">
            <div class="help-section">
              <h2 tabindex="0">Getting Started</h2>
              <p tabindex="0"><strong>Initial Navigation:</strong> Use Tab key to navigate between main interface areas: workspace, toolbox, and controls.</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Global Shortcuts (Work from anywhere)</h2>
              <p tabindex="0"><strong>B key</strong> - Open and focus the toolbox and blocks menu</p>
              <p tabindex="0"><strong>R key</strong> - Focus the Run Code button</p>
              <p tabindex="0"><strong>W key</strong> - Focus the workspace for block editing</p>
              <p tabindex="0"><strong>S key</strong> - Focus the Settings button</p>
              <p tabindex="0"><strong>H key</strong> - Focus the Help button</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Workspace Shortcuts (Work only when focusing on workspace)</h2>
              <p tabindex="0"><strong>C key</strong> - Clean up workspace and organize blocks automatically</p>
              <p tabindex="0"><strong>D key</strong> - Delete all blocks from workspace</p>
              <p tabindex="0"><strong>Auto-cleanup:</strong> Workspace automatically organizes when blocks are added or removed</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Basic Movement</h2>
              <p tabindex="0"><strong>Arrow Keys</strong> - Navigate between blocks, connections, and fields</p>
              <p tabindex="0"><strong>Enter key</strong> - Activate the current selection and open dropdowns or edit fields</p>
              <p tabindex="0"><strong>Escape key</strong> - Exit current context, close menus, and return to workspace</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Screen Reader Settings</h2>
              <p tabindex="0">Access settings by pressing S key to focus the Settings button, then Enter key to open the settings window</p>
              <p tabindex="0"><strong>Enable Screen Reader:</strong> Toggle checkbox with Space key</p>
              <p tabindex="0"><strong>Speech Rate:</strong> Adjust with Left and Right arrow keys</p>
              <p tabindex="0"><strong>Speech Pitch:</strong> Adjust with Left and Right arrow keys</p>
              <p tabindex="0"><strong>Speech Volume:</strong> Adjust with Left and Right arrow keys</p>
              <p tabindex="0"><strong>Voice Selection:</strong> Browse available voices with Up and Down arrow keys</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Toolbox Navigation</h2>
              <h3 tabindex="0">Category Navigation</h3>
              <p tabindex="0"><strong>Arrow Keys</strong> - Navigate between categories like Logic, Math, Text</p>
              <p tabindex="0"><strong>First Letter Navigation:</strong> Press first letter of category name</p>
              <h3 tabindex="0">Block Selection in Flyout</h3>
              <p tabindex="0"><strong>Arrow Keys</strong> - Navigate through available blocks</p>
              <p tabindex="0"><strong>Enter key</strong> - Add selected block to workspace</p>
              <p tabindex="0"><strong>Escape key</strong> - Return to toolbox categories</p>
            </div>

            <div class="help-section">
              <h2 tabindex="0">Connecting Blocks</h2>
              <p tabindex="0"><strong>Step 1:</strong> Navigate to Connection Location - Use arrow keys to move cursor to connection point or input slot</p>
              <p tabindex="0"><strong>Step 2:</strong> Open Block Menu - Press Enter key to automatically open blocks menu</p>
              <p tabindex="0"><strong>Step 3:</strong> Select Block - Navigate through menu and select desired block with Enter key</p>
              <p tabindex="0"><strong>Step 4:</strong> Automatic Connection - Selected block connects automatically to your indicated position</p>
            </div>

            <div class="action-buttons">
              <button id="test-speech" class="test-button">Test Speech</button>
              <button id="close-help" class="close-button">Close Help Guide</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>`;

    if (this.outputDiv) {
      this.outputDiv.innerHTML = modalContents;
      this.modalContainer = this.outputDiv.querySelector('.modal-container');
      this.helpDialog = this.outputDiv.querySelector('.help-modal');
      this.closeButton = this.outputDiv.querySelector('.close-modal');

      this.setupEventListeners();
    }
  }

  /**
   * Set up event listeners for the help dialog
   */
  private setupEventListeners(): void {
    // Close button
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.closeDialog();
      });
    }

    // Close help button
    const closeHelpButton = document.getElementById('close-help');
    closeHelpButton?.addEventListener('click', () => {
      this.closeDialog();
    });

    // Test speech button
    const testSpeechButton = document.getElementById('test-speech');
    testSpeechButton?.addEventListener('click', () => {
      this.screenReader.forceSpeek('Speech synthesis test. This is how your screen reader sounds.');
    });

    // Escape key to close
    this.helpDialog?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDialog();
      }
    });

    // Click outside to close
    this.helpDialog?.addEventListener('click', (e) => {
      if (e.target === this.helpDialog) {
        this.closeDialog();
      }
    });

    // Announce content only when specifically focused, not when dialog opens
    const focusableElements = this.outputDiv?.querySelectorAll('[tabindex="0"]:not(.help-container)');
    focusableElements?.forEach(element => {
      element.addEventListener('focus', () => {
        // Only announce if this element was focused by user navigation, not dialog opening
        if (document.activeElement === element) {
          const elementText = element.textContent?.trim() || 'Content';
          // Clean up the text for better screen reader announcement
          const cleanText = elementText.replace(/\s+/g, ' ').substring(0, 200);
          this.screenReader.forceSpeek(cleanText);
        }
      });
    });

    // Special handling for the help container - don't read content when first focused
    const helpContainer = this.outputDiv?.querySelector('.help-container');
    if (helpContainer) {
      helpContainer.addEventListener('focus', (e) => {
        // Only announce the dialog state, not the content
        // The toggle() method already handles the opening announcement
      });
    }
  }

  /**
   * Install the help dialog
   */
  install() {
    // Create the modal content
    this.createModalContent();

    // NOTE: H key shortcut is now handled by global_shortcuts.ts
    // which focuses the help button, and the button click opens this dialog

    // Auto-open on first visit
    this.autoOpenOnFirstVisit();
  }

  /**
   * Uninstall the help dialog
   */
  uninstall() {
    // NOTE: No shortcut to unregister since H key is handled by global_shortcuts.ts
  }
}

/**
 * Register CSS for the help dialog - following the same pattern as settings
 */
Blockly.Css.register(`
.help-modal {
  border: 1px solid var(--shortcut-modal-border-color, #9aa0a6);
  border-radius: 12px;
  box-shadow: 6px 6px 32px rgba(0,0,0,.5);
  flex-direction: column;
  gap: 12px;
  margin: auto;
  max-height: 82vh;
  max-width: calc(100% - 10em);
  padding: 24px;
  position: relative;
  z-index: 99;
  background: white;
}

.help-modal[open] {
  display: flex;
}

.help-modal .close-modal {
  border: 0;
  background: transparent;
  float: inline-end;
  margin: 0;
  position: absolute;
  top: 16px;
  right: 24px;
  cursor: pointer;
}

.help-modal h1 {
  font-weight: 600;
  font-size: 1.3em;
  margin: 0;
  color: #000000;
}

.header-spacing {
  height: 24px;
}

.help-container {
  font-size: 0.95em;
  padding: 0.5em;
  outline: none;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}

.help-section {
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.help-section:last-of-type {
  border-bottom: none;
}

.help-section h2 {
  color: #000000;
  font-size: 1.1em;
  margin: 0 0 12px 0;
  padding-bottom: 4px;
  border-bottom: 2px solid #e3f2fd;
}

.help-section h3 {
  color: #333;
  font-size: 1em;
  margin: 16px 0 8px 0;
  font-weight: 600;
}

.help-section p {
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.help-list {
  list-style: none;
  padding-left: 0;
  margin: 0 0 12px 0;
}

.help-list li {
  margin-bottom: 8px;
  padding-left: 16px;
  position: relative;
}

.help-list li::before {
  content: "→";
  color: #000000;
  font-weight: bold;
  position: absolute;
  left: 0;
}

.help-numbered-list {
  padding-left: 0;
  margin: 0 0 12px 0;
  counter-reset: help-counter;
}

.help-numbered-list li {
  margin-bottom: 8px;
  padding-left: 24px;
  position: relative;
  counter-increment: help-counter;
}

.help-numbered-list li::before {
  content: counter(help-counter) ".";
  color: #000000;
  font-weight: bold;
  position: absolute;
  left: 0;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px solid #cccccc;
}

.test-button {
  background: #ffffff;
  border: 2px solid #000000;
  color: #000000;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: 600;
  min-width: 160px;
}

.test-button:hover,
.test-button:focus {
  background: #000000;
  color: #ffffff;
  outline: 4px solid #ff6600;
}

.close-button {
  background: #000000;
  color: #ffffff;
  border: 2px solid #000000;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: 600;
  min-width: 160px;
}

.close-button:hover,
.close-button:focus {
  background: #ffffff;
  color: #000000;
  outline: 4px solid #ff6600;
}

.close-button:hover,
.close-button:focus {
  background: #000000;
  outline: 3px solid #ffa200;
}

/* Responsive design */
@media (max-width: 768px) {
  .help-modal {
    width: 95%;
    max-height: 95vh;
    padding: 16px;
  }
  
  .help-content {
    max-height: 70vh;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .help-modal {
    border: 2px solid #000;
  }
  
  .help-modal .close-modal:focus,
  .close-button:focus {
    outline: 3px solid #000;
  }
}

/* Focus styles for all focusable elements */
.help-section:focus,
.help-section h2:focus,
.help-section h3:focus,
.help-content-block:focus,
.help-section p:focus {
  outline: 2px solid #ffa200;
  outline-offset: 2px;
  border-radius: 4px;
  background-color: rgba(255, 162, 0, 0.1);
}

.help-content-block {
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
}

.help-content-block:focus {
  background-color: rgba(255, 162, 0, 0.15);
}

.help-section p {
  margin: 8px 0;
  padding: 4px;
  border-radius: 4px;
  line-height: 1.4;
}
`);