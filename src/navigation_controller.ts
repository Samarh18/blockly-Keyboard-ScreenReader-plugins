/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Registers all of the keyboard shortcuts that are necessary for
 * navigating blockly using the keyboard.
 * @author aschmiedt@google.com (Abby Schmiedt)
 */

import './gesture_monkey_patch';
import './toolbox_monkey_patch';
import { SettingsDialog } from '../test/settings_dialog';


import * as Blockly from 'blockly/core';
import {
  ShortcutRegistry,
  Toolbox,
  utils as BlocklyUtils,
  WorkspaceSvg,
} from 'blockly/core';

import * as Constants from './constants';
import { Clipboard } from './actions/clipboard';
import { DeleteAction } from './actions/delete';
import { EditAction } from './actions/edit';
//import { InsertAction } from './actions/insert';
import { Navigation } from './navigation';
import { ShortcutDialog } from './shortcut_dialog';
import { WorkspaceMovement } from './actions/ws_movement';
import { ArrowNavigation } from './actions/arrow_navigation';
import { ExitAction } from './actions/exit';
import { EnterAction } from './actions/enter';
import { DisconnectAction } from './actions/disconnect';
import { ActionMenu } from './actions/action_menu';
import { MoveActions } from './actions/move';
import { Mover } from './actions/mover';
import { UndoRedoAction } from './actions/undo_redo';

const KeyCodes = BlocklyUtils.KeyCodes;

/**
 * Class for registering shortcuts for keyboard navigation.
 */
export class NavigationController {
  private navigation: Navigation = new Navigation();

  private mover = new Mover(this.navigation);

  shortcutDialog: ShortcutDialog = new ShortcutDialog();

  /** Context menu and keyboard action for deletion. */
  deleteAction: DeleteAction = new DeleteAction(this.navigation);

  /** Context menu and keyboard action for deletion. */
  editAction: EditAction = new EditAction(this.navigation);

  /** Context menu and keyboard action for insertion. */
  //insertAction: InsertAction = new InsertAction(this.navigation);

  /** Keyboard shortcut for disconnection. */
  disconnectAction: DisconnectAction = new DisconnectAction(this.navigation);

  clipboard: Clipboard = new Clipboard(this.navigation);

  workspaceMovement: WorkspaceMovement = new WorkspaceMovement(this.navigation);

  /** Keyboard navigation actions for the arrow keys. */
  arrowNavigation: ArrowNavigation = new ArrowNavigation(this.navigation);

  exitAction: ExitAction = new ExitAction(this.navigation);

  enterAction: EnterAction = new EnterAction(this.mover, this.navigation);

  undoRedoAction: UndoRedoAction = new UndoRedoAction();

  actionMenu: ActionMenu = new ActionMenu(this.navigation);

  moveActions = new MoveActions(this.mover);

  /**
   * Original Toolbox.prototype.onShortcut method, saved by
   * addShortcutHandlers.
   */
  private origToolboxOnShortcut:
    | typeof Blockly.Toolbox.prototype.onShortcut
    | null = null;

  private lastToolboxLetter = '';
  private lastToolboxLetterTime = 0;
  private currentToolboxLetterIndex = 0;

  settingsDialog: SettingsDialog | null = null;

  // Add the method here, before init()
  /**
   * Handle first letter navigation in the toolbox
   */
  /**
 * Handle first letter navigation in the toolbox
 */
  private handleToolboxFirstLetter(
    workspace: Blockly.WorkspaceSvg,
    letter: string
  ): boolean {
    const toolbox = workspace.getToolbox();
    if (!toolbox || !(toolbox instanceof Blockly.Toolbox)) {
      return false;
    }

    const currentTime = Date.now();
    const allItems = toolbox.getToolboxItems();

    // Filter items that start with the pressed letter
    const matchingItems = allItems.filter(item => {
      // Check if item is a ToolboxCategory (which has getName)
      if ('getName' in item && typeof item.getName === 'function') {
        const name = item.getName().toUpperCase();
        return name.startsWith(letter) && item.isSelectable();
      }
      return false;
    });

    if (matchingItems.length === 0) {
      // Let screen reader announce no matches
      return false;
    }

    // Determine which item to select
    let targetIndex = 0;

    // If same letter pressed within 2 seconds, cycle to next match
    if (letter === this.lastToolboxLetter &&
      (currentTime - this.lastToolboxLetterTime) < 2000) {
      this.currentToolboxLetterIndex =
        (this.currentToolboxLetterIndex + 1) % matchingItems.length;
      targetIndex = this.currentToolboxLetterIndex;
    } else {
      // New letter or timeout - start from first match
      this.currentToolboxLetterIndex = 0;
      targetIndex = 0;
    }

    // Update tracking variables
    this.lastToolboxLetter = letter;
    this.lastToolboxLetterTime = currentTime;

    // Find the position of the target item in the full list
    const targetItem = matchingItems[targetIndex];
    const fullListIndex = allItems.indexOf(targetItem);

    if (fullListIndex !== -1) {
      // Use the toolbox's own selection method
      toolbox.selectItemByPosition(fullListIndex);

      // The screen reader will pick up the change through its existing listeners
      return true;
    }

    return false;
  }
  /**
   * Registers the default keyboard shortcuts for keyboard navigation.
   */
  init() {
    this.addShortcutHandlers();
    this.registerDefaults();
  }

  /**
   * Monkeypatches core Blockly components to add methods that allow
   * them to handle keyboard shortcuts when in keyboard navigation
   * mode.
   */
  protected addShortcutHandlers() {
    this.origToolboxOnShortcut = Toolbox.prototype.onShortcut;
    Toolbox.prototype.onShortcut = this.toolboxHandler;
  }

  /**
   * Removes monkeypatches from core Blockly components.
   */
  protected removeShortcutHandlers() {
    if (!this.origToolboxOnShortcut) {
      throw new Error('no original onShortcut method recorded');
    }
    Blockly.Toolbox.prototype.onShortcut = this.origToolboxOnShortcut;
    this.origToolboxOnShortcut = null;
  }

  /**
   * Handles the given keyboard shortcut.
   * This is only triggered when keyboard accessibility mode is enabled.
   *
   * @param shortcut The shortcut to be handled.
   * @returns True if the toolbox handled the shortcut, false otherwise.
   */
  protected toolboxHandler(
    this: Blockly.Toolbox,
    shortcut: ShortcutRegistry.KeyboardShortcut,
  ): boolean {
    if (!this.selectedItem_) {
      return false;
    }
    switch (shortcut.name) {
      case Constants.SHORTCUT_NAMES.UP:
        // @ts-expect-error private method
        return this.selectPrevious();
      case Constants.SHORTCUT_NAMES.LEFT:
        // @ts-expect-error private method
        return this.selectParent();
      case Constants.SHORTCUT_NAMES.DOWN:
        // @ts-expect-error private method
        return this.selectNext();
      case Constants.SHORTCUT_NAMES.RIGHT:
        // @ts-expect-error private method
        return this.selectChild();
      default:
        return false;
    }
  }

  /**
   * Adds all necessary event listeners and markers to a workspace for keyboard
   * navigation to work. This must be called for keyboard navigation to work
   * on a workspace.
   *
   * @param workspace The workspace to add keyboard
   *     navigation to.
   */
  addWorkspace(workspace: WorkspaceSvg) {
    this.navigation.addWorkspace(workspace);
  }

  /**
   * Removes all necessary event listeners and markers to a workspace for
   * keyboard navigation to work.
   *
   * @param workspace The workspace to remove keyboard
   *     navigation from.
   */
  removeWorkspace(workspace: WorkspaceSvg) {
    this.navigation.removeWorkspace(workspace);
  }

  focusWorkspace(workspace: WorkspaceSvg) {
    this.navigation.focusWorkspace(workspace);
  }

  handleFocusWorkspace(workspace: Blockly.WorkspaceSvg) {
    this.navigation.handleFocusWorkspace(workspace);
  }

  handleBlurWorkspace(workspace: Blockly.WorkspaceSvg) {
    this.navigation.handleBlurWorkspace(workspace);
  }

  handleFocusOutWidgetDropdownDiv(
    workspace: Blockly.WorkspaceSvg,
    relatedTarget: EventTarget | null,
  ) {
    this.navigation.handleFocusOutWidgetDropdownDiv(workspace, relatedTarget);
  }

  focusToolbox(workspace: Blockly.WorkspaceSvg) {
    this.navigation.focusToolbox(workspace);
  }

  handleFocusToolbox(workspace: Blockly.WorkspaceSvg) {
    this.navigation.handleFocusToolbox(workspace);
  }

  handleBlurToolbox(workspace: Blockly.WorkspaceSvg, closeFlyout: boolean) {
    this.navigation.handleBlurToolbox(workspace, closeFlyout);
  }

  focusFlyout(workspace: Blockly.WorkspaceSvg) {
    this.navigation.focusFlyout(workspace);
  }

  handleFocusFlyout(workspace: Blockly.WorkspaceSvg) {
    this.navigation.handleFocusFlyout(workspace);
  }

  handleBlurFlyout(workspace: Blockly.WorkspaceSvg, closeFlyout: boolean) {
    this.navigation.handleBlurFlyout(workspace, closeFlyout);
  }

  /**
   * Turns on keyboard navigation.
   *
   * @param workspace The workspace to turn on keyboard
   *     navigation for.
   */
  enable(workspace: WorkspaceSvg) {
    this.navigation.enableKeyboardAccessibility(workspace);
  }

  /**
   * Turns off keyboard navigation.
   *
   * @param workspace The workspace to turn off keyboard
   *     navigation on.
   */
  disable(workspace: WorkspaceSvg) {
    this.navigation.disableKeyboardAccessibility(workspace);
  }

  /**
   * Dictionary of KeyboardShortcuts.
   */
  protected shortcuts: {
    [name: string]: ShortcutRegistry.KeyboardShortcut;
  } = {
      /** Move focus to or from the toolbox. */
      focusToolbox: {
        name: Constants.SHORTCUT_NAMES.TOOLBOX,
        preconditionFn: (workspace) =>
          !workspace.isDragging() && this.navigation.canCurrentlyEdit(workspace),
        callback: (workspace) => {
          switch (this.navigation.getState(workspace)) {
            case Constants.STATE.WORKSPACE:
              if (!workspace.getToolbox()) {
                this.navigation.focusFlyout(workspace);
              } else {
                this.navigation.focusToolbox(workspace);
              }
              return true;
            default:
              return false;
          }
        },
        keyCodes: [KeyCodes.B],
      },

      /** Clean up the workspace. */
      cleanup: {
        name: Constants.SHORTCUT_NAMES.CLEAN_UP,
        preconditionFn: (workspace) =>
          this.navigation.canCurrentlyEdit(workspace) &&
          workspace.getTopBlocks(false).length > 0,
        callback: (workspace) => {
          workspace.cleanUp();
          return true;
        },
        keyCodes: [KeyCodes.C],
      },

      /** Delete all blocks from the workspace. */
      deleteAll: {
        name: 'DELETE_ALL_BLOCKS',
        preconditionFn: (workspace) =>
          this.navigation.canCurrentlyEdit(workspace) &&
          workspace.getTopBlocks(false).length > 0,
        callback: (workspace) => {
          // Get all top-level blocks
          const topBlocks = workspace.getTopBlocks(false);

          if (topBlocks.length === 0) {
            return false;
          }

          // Delete all blocks
          Blockly.Events.setGroup(true);
          try {
            topBlocks.forEach(block => {
              block.dispose(true); // true = heal stack after deletion
            });
          } finally {
            Blockly.Events.setGroup(false);
          }

          const announcement = `Deleted all blocks from workspace`;

          console.log(announcement);

          return true;
        },
        keyCodes: [KeyCodes.D],
      },
      /** First letter navigation for toolbox */
      /** First letter navigation for toolbox */
      toolboxFirstLetter: {
        name: 'TOOLBOX_FIRST_LETTER',
        preconditionFn: (workspace) => {
          // Only active when toolbox has focus
          return this.navigation.getState(workspace) === Constants.STATE.TOOLBOX &&
            workspace.getToolbox() !== null;
        },
        callback: (workspace, e) => {
          const keyboardEvent = e as KeyboardEvent;
          const letter = keyboardEvent.key.toUpperCase();

          // Only handle our specific letters
          if (!['L', 'M', 'T', 'V', 'F', 'P'].includes(letter)) {
            return false;
          }

          return this.handleToolboxFirstLetter(workspace, letter);
        },
        // Only register the specific letters we need
        keyCodes: [
          KeyCodes.L,  // 76 - Logic, Loops, Lists
          KeyCodes.M,  // 77 - Math
          KeyCodes.T,  // 84 - Text
          KeyCodes.V,  // 86 - Variables
          KeyCodes.F,  // 70 - Functions
          KeyCodes.P,  // 80 - p5 blocks
        ],
      },

      /** Open settings dialog */
      openSettings: {
        name: 'OPEN_SETTINGS',
        preconditionFn: (workspace) => true,
        callback: (workspace) => {
          if (this.settingsDialog) {
            this.settingsDialog.toggle();
            return true;
          }
          return false;
        },
        keyCodes: [KeyCodes.S],
      },

    };

  /**
   * Registers all default keyboard shortcut items for keyboard
   * navigation. This should be called once per instance of
   * KeyboardShortcutRegistry.
   */
  protected registerDefaults() {
    for (const shortcut of Object.values(this.shortcuts)) {
      ShortcutRegistry.registry.register(shortcut);
    }
    this.deleteAction.install();
    this.editAction.install();
    //this.insertAction.install();
    this.workspaceMovement.install();
    this.arrowNavigation.install();
    this.exitAction.install();
    this.enterAction.install();
    this.disconnectAction.install();
    this.undoRedoAction.install();
    this.actionMenu.install();

    this.clipboard.install();
    this.moveActions.install();
    this.shortcutDialog.install();

    // Initialize the shortcut modal with available shortcuts.  Needs
    // to be done separately rather at construction, as many shortcuts
    // are not registered at that point.
    this.shortcutDialog.createModalContent();
  }

  /**
   * Removes all the keyboard navigation shortcuts.
   */
  dispose() {
    this.moveActions.uninstall();
    this.deleteAction.uninstall();
    this.editAction.uninstall();
    //this.insertAction.uninstall();
    this.disconnectAction.uninstall();
    this.clipboard.uninstall();
    this.workspaceMovement.uninstall();
    this.arrowNavigation.uninstall();
    this.exitAction.uninstall();
    this.enterAction.uninstall();
    this.undoRedoAction.uninstall();
    this.actionMenu.uninstall();
    this.shortcutDialog.uninstall();

    for (const shortcut of Object.values(this.shortcuts)) {
      ShortcutRegistry.registry.unregister(shortcut.name);
    }
    this.removeShortcutHandlers();
    this.navigation.dispose();
    if (this.settingsDialog) {
      this.settingsDialog.uninstall();
      this.settingsDialog = null;
    }

  }
}
