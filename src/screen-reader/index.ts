/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export the main ScreenReader class
export { ScreenReader } from './screen_reader';

// Export the SettingsDialog class and its types
export { SettingsDialog } from './settings_dialog';
export type { SpeechSettings } from './settings_dialog';

// Export the HelpDialog class
export { HelpDialog } from './help_dialog';

// Export block description utilities
export { getBlockMessage, getDelimiterMessage, blockDescriptions } from './block_descriptions';