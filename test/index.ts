/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
// Import the default blocks.
import 'blockly/blocks';
import { installAllBlocks as installColourBlocks } from '@blockly/field-colour';
import { KeyboardNavigation } from '../src/index';
// @ts-expect-error No types in js file
import { forBlock } from './blocks/p5_generators';
// @ts-expect-error No types in js file
import { blocks } from './blocks/p5_blocks';
// @ts-expect-error No types in js file
import { toolbox as toolboxFlyout } from './blocks/toolbox.js';
// @ts-expect-error No types in js file
import toolboxCategories from './toolboxCategories.js';

import { javascriptGenerator } from 'blockly/javascript';
// @ts-expect-error No types in js file
import { load } from './loadTestBlocks';
import { runCode, registerRunCodeShortcut } from './runCode';
import { ScreenReader } from './screen_reader';

import { SettingsDialog } from './settings_dialog';

/**
 * Parse query params for inject and navigation options and update
 * the fields on the options form to match.
 *
 * @returns An options object with keys for each supported option.
 */
function getOptions() {
  const params = new URLSearchParams(window.location.search);

  const scenarioParam = params.get('scenario');
  const scenario = scenarioParam ?? 'blank';

  const rendererParam = params.get('renderer');
  let renderer = 'zelos';
  // For backwards compatibility with previous behaviour, support
  // (e.g.) ?geras as well as ?renderer=geras:
  if (rendererParam) {
    renderer = rendererParam;
  } else if (params.get('geras')) {
    renderer = 'geras';
  } else if (params.get('thrasos')) {
    renderer = 'thrasos';
  }

  const noStackParam = params.get('noStack');
  const stackConnections = !noStackParam;

  const toolboxParam = params.get('toolbox');
  const toolbox = toolboxParam ?? 'toolbox';
  const toolboxObject =
    toolbox === 'toolbox' ? toolboxFlyout : toolboxCategories;

  return {
    scenario,
    stackConnections,
    renderer,
    toolbox: toolboxCategories,
  };
}

/**
 * Create the workspace, including installing keyboard navigation and
 * change listeners.
 *
 * @returns The created workspace.
 */
function createWorkspace(): Blockly.WorkspaceSvg {
  const { scenario, stackConnections, renderer, toolbox } = getOptions();

  const injectOptions = {
    toolbox,
    renderer,
  };
  const blocklyDiv = document.getElementById('blocklyDiv');
  if (!blocklyDiv) {
    throw new Error('Missing blocklyDiv');
  }
  const workspace = Blockly.inject(blocklyDiv, injectOptions);

  const navigationOptions = {
    cursor: { stackConnections },
    autoCleanup: true, // Enable auto cleanup
  };

  new KeyboardNavigation(workspace, navigationOptions);
  registerRunCodeShortcut();

  // Initialize screen reader
  const screenReader = new ScreenReader(workspace);  // Store reference

  // Initialize settings dialog and register shortcut
  const settingsDialog = new SettingsDialog(screenReader);
  settingsDialog.install();

  // Expose globally for global shortcuts access
  (window as any).settingsDialog = settingsDialog;

  load(workspace, scenario);
  runCode();

  return workspace;
}

/**
 * Install p5.js blocks and generators.
 */
function addP5() {
  // Installs all four blocks, the colour field, and all language generators.
  installColourBlocks({
    javascript: javascriptGenerator,
  });
  Blockly.common.defineBlocks(blocks);
  Object.assign(javascriptGenerator.forBlock, forBlock);
  javascriptGenerator.addReservedWords('sketch');
}

document.addEventListener('DOMContentLoaded', () => {
  addP5();
  createWorkspace();
  document.getElementById('run')?.addEventListener('click', runCode);
});
