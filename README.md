# Blockly Accessibility Demo

This experimental project aims to enhance the accessibility of Blockly by combining the existing keyboard navigation plugin with additional screen reader support. The goal is to make block-based programming more inclusive and accessible to users with visual impairments and mobility limitations.

## Demo

A working demonstration of this accessibility implementation is available at: [https://Samarh18.github.io/blockly-Keyboard-ScreenReader-plugins/](tps://Samarh18.github.io/blockly-Keyboard-ScreenReader-plugins/)

## Keyboard Shortcuts

### Workspace Shortcuts (Work only when focusing on the workspace)
- **O key**: Navigate to root block of current stack
- **N key**: Navigate to next stack of blocks
- **C key**: Clean up workspace (organize blocks automatically)
- **D key**: Delete all blocks from workspace

### Global Shortcuts (Work from anywhere on the page)
- **B key**: Open and focus the toolbox/blocks menu
- **W key**: Focus the workspace for block editing
- **S key**: Focus the Settings button
- **H key**: Focus the Help button

## Usage Guidelines

### Getting Started

#### Initial Navigation
- Use **Tab Key** to navigate between main interface areas (workspace, toolbox, controls)

#### Basic Movement
- **Arrow Keys**: Navigate between blocks, connections, and fields
- **Enter**: Activate the current selection (open dropdowns, edit fields)
- **Escape**: Exit current context (close menus, return to workspace)

#### Screen Reader Settings

The accessibility demo includes a customizable settings window to personalize your screen reader experience. Access it by pressing **S** which will focus on the "Settings" button, and then pressing "Enter" will open the window, or clicking the button directly.

##### Available Settings

**Enable Screen Reader Checkbox**
- **Default**: Enabled
- **Function**: Turn all screen reader announcements on or off
- **Interaction**: Press **Space** to toggle on/off

**Speech Rate Slider**
- **Default**: 1.7
- **Function**: Controls how fast speech is spoken
- **Interaction**: Use **left/right arrow keys** to adjust

**Speech Pitch Slider**
- **Default**: 1.0
- **Function**: Controls the pitch/tone of speech
- **Interaction**: Use **left/right arrow keys** to adjust

**Speech Volume Slider**
- **Default**: 1.0
- **Function**: Controls how loud speech is
- **Interaction**: Use **left/right arrow keys** to adjust

**Voice Selection Dropdown menu**
- **Default**: System default voice
- **Function**: Choose which voice to use for speech
- **Interaction**: Use **up/down arrow keys** to browse voices

### Toolbox/Blocks Menu Navigation

#### Category Navigation
- **Arrow Keys**: Navigate between categories (Logic, Math, Text, etc.)
- **First Letter Navigation**: Press the first letter of a category name to jump to it

#### Block Selection in Flyout
- **Arrow Keys**: Navigate through available blocks
- **Enter**: Add the selected block to workspace
- **Escape**: Return to toolbox categories

#### Connecting Blocks
1. **Navigate to Connection Point**: Use arrow keys to move cursor to where you want to connect a block (input slot, under a block, etc.)
2. **Open Block Menu**: Press **Enter** to automatically open the toolbox/blocks menu
3. **Select Block**: Navigate through the menu and select the desired block by clicking **Enter**
4. **Automatic Connection**: The selected block is automatically added and connected to your indicated position

### Block Stack Navigation
- **O key**: Navigate to the root (top) block of the current stack
- **N key**: Navigate to the next stack of blocks (cycles through all stacks)

### Screen Reader Features

#### Automatic Announcements
- **Block Navigation**: Announces block type, position, and connections
- **Stack Navigation**: Announces current stack position (e.g., "Stack 2 of 5")
- **Menu Navigation**: Describes menu items and navigation options
- **Context Awareness**: Provides relevant information based on current location in the workspace

#### Block Descriptions
The screen reader provides detailed descriptions for:
- Block types and purposes
- Field values (numbers, text, colors)
- Block position in sequences
- Special handling for mathematical expressions

### Menus and Dropdown Navigation

#### Dropdown Menus
- **Arrow Keys**: Navigate through options
- **Enter/Space**: Select current option
- **Escape**: Close menu without selection
- **Automatic Announcement**: Menu contents are announced when opened
- **Mathematical Function Menus**: Special support for math functions with clear pronunciation

## Current Status

This project is currently in an experimental phase and is not yet ready for production use. It builds upon the keyboard navigation work by the Blockly team and aims to contribute to making block-based programming accessible to everyone.