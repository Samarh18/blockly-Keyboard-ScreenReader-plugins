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
   * Open help dialog automatically on first visit only
   */
  autoOpenOnFirstVisit() {
    if (this.hasOpenedBefore) return;

    setTimeout(() => {
      if (!this.outputDiv || !this.modalContainer || !this.helpDialog) return;

      // Open visually
      this.helpDialog.showModal();
      const container = this.helpDialog.querySelector('.help-container') as HTMLElement;
      if (container) container.focus();

      localStorage.setItem('help-dialog-opened', 'true');
      this.hasOpenedBefore = true;

      // Web Speech API requires a user gesture before it can speak.
      // Wait for the student's first keypress or tap, then announce once.
      let announced = false;
      const announce = () => {
        if (announced) return;
        announced = true;
        this.screenReader.forceSpeek(
          'The help guide is open. Press Tab to explore tips, or Escape to close and start.'
        );
      };
      document.addEventListener('keydown', announce, { once: true });
      document.addEventListener('pointerdown', announce, { once: true });
    }, 1000);
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
            'Help guide open. Tab to navigate, Escape to close.'
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
    <div class="modal-container" id="help">
      <dialog class="help-modal" aria-labelledby="help-title">
        <div class="help-container" tabindex="0">
          <div class="dialog-header">
            <button class="close-modal" aria-label="Close help guide">
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
            <h1 id="help-title">Blockly Accessibility Guide</h1>
            <p class="dialog-subtitle">Navigate Blockly with keyboard and screen reader</p>
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
              <p tabindex="0"><strong>O key</strong> - Navigate to root block of current stack</p>
              <p tabindex="0"><strong>Auto-cleanup:</strong> Workspace automatically organizes when blocks are added or removed</p>
              <p tabindex="0"><strong>N key</strong> - Navigate to next stack of blocks</p>
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

          </div>

          <div class="dialog-footer">
            <button id="test-speech" class="dialog-btn dialog-btn-secondary">Test Speech</button>
            <button id="close-help" class="dialog-btn dialog-btn-primary">Close Guide</button>
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
 * Register CSS for the help dialog
 */
Blockly.Css.register(`

/* Backdrop */
.help-modal::backdrop {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(3px);
}

/* Dialog shell — matches settings-modal */
.help-modal {
  border: none;
  border-top: 4px solid #4F46E5;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(79, 70, 229, 0.15), 0 2px 8px rgba(0,0,0,0.08);
  padding: 0;
  background: #ffffff;
  max-height: 85vh;
  max-width: 560px;
  width: calc(100% - 48px);
  margin: auto;
  display: none;
  flex-direction: column;
}

.help-modal[open] {
  display: flex;
}

/* Inner wrapper */
.help-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  outline: none;
  font-size: 0.95em;
}

/* ── Scrollable content ── */
.help-content {
  display: flex;
  flex-direction: column;
  padding: 8px 24px 16px;
  overflow-y: auto;
  flex: 1;
}

/* ── Sections ── */
.help-section {
  padding: 16px 0;
  border-bottom: 1px solid #F3F4F6;
}

.help-section:last-of-type {
  border-bottom: none;
}

.help-section h2 {
  font-size: 1em;
  font-weight: 700;
  color: #4F46E5;
  margin: 0 0 10px 0;
}

.help-section h3 {
  font-size: 0.95em;
  font-weight: 600;
  color: #1F2937;
  margin: 12px 0 6px 0;
}

.help-section p {
  font-size: 0.9em;
  color: #374151;
  margin: 0 0 6px 0;
  line-height: 1.5;
  padding: 3px 4px;
  border-radius: 4px;
}

.help-section p:last-child {
  margin-bottom: 0;
}

/* Focus styles for keyboard-navigable content */
.help-section h2:focus,
.help-section h3:focus,
.help-section p:focus {
  outline: 3px solid #ffa200;
  outline-offset: 2px;
  border-radius: 4px;
  background-color: #FFFBEB;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .help-modal {
    width: calc(100% - 24px);
    max-height: 92vh;
  }

  .dialog-footer {
    justify-content: stretch;
  }

  .dialog-btn {
    flex: 1;
    min-width: 0;
  }
}

/* ── High-contrast mode ── */
@media (prefers-contrast: high) {
  .help-modal {
    border: 3px solid #000;
    border-top: 6px solid #4F46E5;
  }
}
`);