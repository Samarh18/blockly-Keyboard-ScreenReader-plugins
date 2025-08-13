/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Action for navigating to the root block of a stack.
 */

import * as Blockly from 'blockly/core';
import { Navigation } from '../navigation';
import * as Constants from '../constants';

/**
 * Class for handling root navigation action.
 */
export class RootNavigationAction {
    private navigation: Navigation;

    /**
     * Constructs the root navigation action.
     *
     * @param navigation The navigation instance.
     */
    constructor(navigation: Navigation) {
        this.navigation = navigation;
    }

    /**
     * Navigate to the root block of the current stack.
     *
     * @param workspace The workspace.
     * @returns True if navigation was successful, false otherwise.
     */
    navigateToRoot(workspace: Blockly.WorkspaceSvg): boolean {
        const cursor = workspace.getCursor();
        if (!cursor) {
            return false;
        }

        const currentNode = cursor.getCurNode();
        if (!currentNode) {
            return false;
        }

        // Get the current block
        const currentBlock = currentNode.getSourceBlock();
        if (!currentBlock) {
            return false;
        }

        // Find the root block of this stack
        const rootBlock = this.findRootBlock(currentBlock);
        if (!rootBlock) {
            return false;
        }

        // If we're already at the root, don't do anything
        if (currentBlock === rootBlock) {
            // Optionally announce that we're already at the root
            this.announceAlreadyAtRoot();
            return true;
        }

        // Move cursor to the root block
        const rootNode = Blockly.ASTNode.createTopNode(rootBlock);
        cursor.setCurNode(rootNode);

        // Announce the navigation
        this.announceRootNavigation(rootBlock);

        return true;
    }

    /**
     * Find the root block of a stack.
     *
     * @param block The block to find the root for.
     * @returns The root block of the stack.
     */
    private findRootBlock(block: Blockly.Block): Blockly.Block | null {
        let currentBlock = block;

        // Walk up the chain to find the topmost block
        while (currentBlock) {
            const parentBlock = currentBlock.getParent();
            if (!parentBlock) {
                // No parent means this is the root
                return currentBlock;
            }
            currentBlock = parentBlock;
        }

        return null;
    }

    /**
     * Announce navigation to root block.
     *
     * @param rootBlock The root block we navigated to.
     */
    private announceRootNavigation(rootBlock: Blockly.Block): void {
        // Get a description of the root block
        const blockType = rootBlock.type;
        const readableType = blockType.replace(/_/g, ' ');

        console.log(`Navigated to root: ${readableType} block`);

        // If there's a screen reader available, use it for announcement
        // This assumes the screen reader might be accessible globally
        if ((window as any).accessibilityDemo?.getScreenReader) {
            const screenReader = (window as any).accessibilityDemo.getScreenReader();
            if (screenReader && screenReader.forceSpeek) {
                screenReader.forceSpeek(`Moved to root of stack: ${readableType} block`);
            }
        }
    }

    /**
     * Announce that we're already at the root.
     */
    private announceAlreadyAtRoot(): void {
        console.log('Already at root block');

        // If there's a screen reader available, use it for announcement
        if ((window as any).accessibilityDemo?.getScreenReader) {
            const screenReader = (window as any).accessibilityDemo.getScreenReader();
            if (screenReader && screenReader.forceSpeek) {
                screenReader.forceSpeek('Already at root block');
            }
        }
    }

    /**
     * Install the root navigation shortcut.
     */
    install(): void {
        const rootNavigationShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
            name: 'ROOT_NAVIGATION',
            preconditionFn: (workspace) => {
                // Only work when workspace has focus and keyboard navigation is enabled
                return workspace.keyboardAccessibilityMode &&
                    this.navigation.canCurrentlyNavigate(workspace) &&
                    this.navigation.getState(workspace) === Constants.STATE.WORKSPACE;
            },
            callback: (workspace) => {
                return this.navigateToRoot(workspace);
            },
            keyCodes: [Blockly.utils.KeyCodes.O], // Changed from R to O
        };

        Blockly.ShortcutRegistry.registry.register(rootNavigationShortcut);
    }

    /**
     * Uninstall the root navigation shortcut.
     */
    uninstall(): void {
        Blockly.ShortcutRegistry.registry.unregister('ROOT_NAVIGATION');
    }
}