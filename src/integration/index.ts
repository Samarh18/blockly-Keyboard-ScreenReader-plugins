/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import { KeyboardNavigation, NavigationOptions } from '../keyboard-navigation';
import { ScreenReader, SettingsDialog, HelpDialog, SpeechSettings } from '../screen-reader';

/**
 * Options for the AccessibilityDemo integration
 */
export interface AccessibilityOptions {
    /** Options for keyboard navigation */
    keyboard?: Partial<NavigationOptions>;
    /** Options for screen reader (currently limited) */
    screenReader?: {
        enabled?: boolean;
    };
}

/**
 * Integrated accessibility demo that combines keyboard navigation and screen reader functionality
 */
export class AccessibilityDemo {
    private keyboardNav: KeyboardNavigation;
    private screenReader: ScreenReader;
    private settingsDialog: SettingsDialog;
    private helpDialog: HelpDialog;

    /**
     * Creates a new AccessibilityDemo instance
     * @param workspace The Blockly workspace to add accessibility to
     * @param options Configuration options for both plugins
     */
    constructor(workspace: Blockly.WorkspaceSvg, options: AccessibilityOptions = {}) {
        // Initialize keyboard navigation with provided options
        this.keyboardNav = new KeyboardNavigation(workspace, options.keyboard || {});

        // Initialize screen reader
        this.screenReader = new ScreenReader(workspace);

        // Initialize settings dialog
        this.settingsDialog = new SettingsDialog(this.screenReader);
        this.settingsDialog.install();

        // Initialize help dialog
        this.helpDialog = new HelpDialog(this.screenReader);
        this.helpDialog.install();

        // Make settings globally accessible for global shortcuts
        (window as any).settingsDialog = this.settingsDialog;

        // Make help dialog globally accessible (optional, for debugging)
        (window as any).helpDialog = this.helpDialog;

        // Apply screen reader enabled state if specified
        if (options.screenReader?.enabled !== undefined) {
            this.screenReader.setEnabled(options.screenReader.enabled);
        }
    }

    /**
     * Get the keyboard navigation instance
     */
    getKeyboardNavigation(): KeyboardNavigation {
        return this.keyboardNav;
    }

    /**
     * Get the screen reader instance
     */
    getScreenReader(): ScreenReader {
        return this.screenReader;
    }

    /**
     * Get the settings dialog instance
     */
    getSettingsDialog(): SettingsDialog {
        return this.settingsDialog;
    }

    /**
     * Get the help dialog instance
     */
    getHelpDialog(): HelpDialog {
        return this.helpDialog;
    }

    /**
     * Enable or disable the screen reader
     */
    setScreenReaderEnabled(enabled: boolean): void {
        this.screenReader.setEnabled(enabled);
    }

    /**
     * Check if the screen reader is enabled
     */
    isScreenReaderEnabled(): boolean {
        return this.screenReader.isScreenReaderEnabled();
    }

    /**
     * Toggle the keyboard shortcuts dialog
     */
    toggleShortcutDialog(): void {
        this.keyboardNav.toggleShortcutDialog();
    }

    /**
     * Toggle the settings dialog
     */
    toggleSettingsDialog(): void {
        this.settingsDialog.toggle();
    }

    /**
     * Toggle the help dialog
     */
    toggleHelpDialog(): void {
        this.helpDialog.toggle();
    }

    /**
     * Clean up both plugins
     */
    dispose(): void {
        this.keyboardNav.dispose();
        this.screenReader.dispose();
        this.settingsDialog.uninstall();
        this.helpDialog.uninstall(); // Clean up help dialog

        // Clean up global references
        if ((window as any).settingsDialog === this.settingsDialog) {
            delete (window as any).settingsDialog;
        }
        if ((window as any).helpDialog === this.helpDialog) {
            delete (window as any).helpDialog;
        }
    }
}

// Re-export types that might be useful for consumers
export type { NavigationOptions } from '../keyboard-navigation';
export type { SpeechSettings } from '../screen-reader';