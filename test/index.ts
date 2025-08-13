/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
// Import the default blocks.
import 'blockly/blocks';
import { installAllBlocks as installColourBlocks } from '@blockly/field-colour';

// Import the new integrated accessibility demo
import { AccessibilityDemo } from '../src/integration';

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
 * screen reader functionality.
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

  // Use the integrated accessibility demo instead of separate plugins
  const accessibilityDemo = new AccessibilityDemo(workspace, {
    keyboard: {
      cursor: { stackConnections },
      autoCleanup: true,
    },
    screenReader: {
      enabled: true, // Enable screen reader by default
    },
  });

  // Register the run code shortcut
  registerRunCodeShortcut();

  // Load the initial blocks
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