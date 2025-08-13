/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Action for navigating between different stacks of blocks.
 */

import * as Blockly from 'blockly/core';
import { Navigation } from '../navigation';
import * as Constants from '../constants';

/**
 * Class for handling stack navigation actions.
 */
export class StackNavigationAction {
    private navigation: Navigation;

    /**
     * Constructs the stack navigation action.
     *
     * @param navigation The navigation instance.
     */
    constructor(navigation: Navigation) {
        this.navigation = navigation;
    }

    /**
     * Navigate to the next stack of blocks.
     *
     * @param workspace The workspace.
     * @returns True if navigation was successful, false otherwise.
     */
    navigateToNextStack(workspace: Blockly.WorkspaceSvg): boolean {
        return this.navigateToStack(workspace, 'next');
    }

    /**
     * Navigate to the previous stack of blocks.
     *
     * @param workspace The workspace.
     * @returns True if navigation was successful, false otherwise.
     */
    navigateToPreviousStack(workspace: Blockly.WorkspaceSvg): boolean {
        return this.navigateToStack(workspace, 'previous');
    }

    /**
     * Navigate between stacks of blocks.
     *
     * @param workspace The workspace.
     * @param direction Direction to navigate ('next' or 'previous').
     * @returns True if navigation was successful, false otherwise.
     */
    private navigateToStack(workspace: Blockly.WorkspaceSvg, direction: 'next' | 'previous'): boolean {
        const cursor = workspace.getCursor();
        if (!cursor) {
            return false;
        }

        // Get all top-level blocks (stacks)
        const topBlocks = workspace.getTopBlocks(false);
        if (topBlocks.length <= 1) {
            this.announceNoOtherStacks();
            return false;
        }

        // Sort blocks by position (left to right, top to bottom)
        const sortedBlocks = topBlocks.sort((a, b) => {
            const aPos = a.getRelativeToSurfaceXY();
            const bPos = b.getRelativeToSurfaceXY();

            // First sort by Y (top to bottom)
            if (Math.abs(aPos.y - bPos.y) > 50) {
                return aPos.y - bPos.y;
            }
            // Then by X (left to right)
            return aPos.x - bPos.x;
        });

        // Find current stack
        const currentNode = cursor.getCurNode();
        const currentBlock = currentNode?.getSourceBlock();

        if (!currentBlock) {
            // No current block, go to first stack
            this.moveToStack(workspace, sortedBlocks[0], 0, sortedBlocks.length);
            return true;
        }

        // Find the root of the current stack
        const currentRoot = this.findRootBlock(currentBlock);
        const currentIndex = sortedBlocks.findIndex(block => block === currentRoot);

        if (currentIndex === -1) {
            // Current block not found in top blocks, go to first stack
            this.moveToStack(workspace, sortedBlocks[0], 0, sortedBlocks.length);
            return true;
        }

        // Calculate next index
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % sortedBlocks.length;
        } else {
            nextIndex = currentIndex === 0 ? sortedBlocks.length - 1 : currentIndex - 1;
        }

        const targetStack = sortedBlocks[nextIndex];
        this.moveToStack(workspace, targetStack, nextIndex, sortedBlocks.length);
        return true;
    }

    /**
     * Move cursor to a specific stack and announce it.
     *
     * @param workspace The workspace.
     * @param targetBlock The target block to move to.
     * @param stackIndex The index of the stack (0-based).
     * @param totalStacks Total number of stacks.
     */
    private moveToStack(workspace: Blockly.WorkspaceSvg, targetBlock: Blockly.Block, stackIndex: number, totalStacks: number): void {
        const cursor = workspace.getCursor();
        if (!cursor) return;

        // Move cursor to the top of the target stack
        const rootNode = Blockly.ASTNode.createTopNode(targetBlock);
        cursor.setCurNode(rootNode);

        // Announce the navigation
        this.announceStackNavigation(targetBlock, stackIndex + 1, totalStacks);
    }

    /**
     * Find the root block of a stack.
     *
     * @param block The block to find the root for.
     * @returns The root block of the stack.
     */
    private findRootBlock(block: Blockly.Block): Blockly.Block {
        let currentBlock = block;
        while (currentBlock.getParent()) {
            currentBlock = currentBlock.getParent()!;
        }
        return currentBlock;
    }

    /**
     * Announce navigation to a stack.
     *
     * @param rootBlock The root block of the stack.
     * @param stackNumber The stack number (1-based).
     * @param totalStacks Total number of stacks.
     */
    private announceStackNavigation(rootBlock: Blockly.Block, stackNumber: number, totalStacks: number): void {
        const blockType = rootBlock.type;
        const readableType = blockType.replace(/_/g, ' ');

        const message = `Stack ${stackNumber} of ${totalStacks}: ${readableType} block`;
        console.log(message);

        // Use screen reader if available
        if ((window as any).accessibilityDemo?.getScreenReader) {
            const screenReader = (window as any).accessibilityDemo.getScreenReader();
            if (screenReader && screenReader.forceSpeek) {
                screenReader.forceSpeek(message);
            }
        }
    }

    /**
     * Announce that there are no other stacks to navigate to.
     */
    private announceNoOtherStacks(): void {
        const message = 'No other stacks to navigate to';
        console.log(message);

        if ((window as any).accessibilityDemo?.getScreenReader) {
            const screenReader = (window as any).accessibilityDemo.getScreenReader();
            if (screenReader && screenReader.forceSpeek) {
                screenReader.forceSpeek(message);
            }
        }
    }

    /**
     * Install the stack navigation shortcuts.
     */
    install(): void {
        // Next stack shortcut (N key only)
        const stackNavigationShortcut: Blockly.ShortcutRegistry.KeyboardShortcut = {
            name: 'NEXT_STACK',
            preconditionFn: (workspace) => {
                return workspace.keyboardAccessibilityMode &&
                    this.navigation.canCurrentlyNavigate(workspace) &&
                    this.navigation.getState(workspace) === Constants.STATE.WORKSPACE;
            },
            callback: (workspace) => {
                return this.navigateToNextStack(workspace);
            },
            keyCodes: [Blockly.utils.KeyCodes.N],
        };

        Blockly.ShortcutRegistry.registry.register(stackNavigationShortcut);
    }

    /**
     * Uninstall the stack navigation shortcuts.
     */
    uninstall(): void {
        Blockly.ShortcutRegistry.registry.unregister('NEXT_STACK');
    }
}