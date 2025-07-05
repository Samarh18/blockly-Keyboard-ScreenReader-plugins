# Blockly Accessibility Demo

This experimental project aims to enhance the accessibility of Blockly by combining the existing keyboard navigation plugin with additional screen reader support. The goal is to make block-based programming more inclusive and accessible to users with visual impairments and mobility limitations.

## Demo

A working demonstration of this accessibility implementation is available at: [https://samarh18.github.io/blockly-accessibility-demo/](https://samarh18.github.io/blockly-accessibility-demo/)

## Usage Guidelines

### Getting Started

#### Initial Navigation
- Use **Tab Key** to navigate between main interface areas (workspace, toolbox, controls)

#### Global Shortcuts (Work from anywhere on the page)
- **B**: Open and focus the toolbox/blocks menu
- **R**: Focus the "Run Code!" button  
- **W**: Focus the workspace for block editing

### Workspace Shortcuts (Work only when focusing on the workspace)
- **C**: Clean up workspace (organize blocks automatically)
- **D**: Delete all blocks from workspace
- **Auto-cleanup**: Workspace automatically organizes when blocks are added or removed 

#### Basic Movement
- **Arrow Keys**: Navigate between blocks, connections, and fields
- **Enter**: Activate the current selection (open dropdowns, edit fields)
- **Escape**: Exit current context (close menus, return to workspace)

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


### Screen Reader Features

#### Automatic Announcements
- **Block Navigation**: Announces block type, position, and connections
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

### Accessibility Best Practices

#### For Screen Reader Users
1. Use **Tab** to get familiar with the interface layout
2. Use **B** to quickly access blocks when needed
3. Navigate with **arrow keys** within each area
4. Listen for position announcements ("1 of 5") in menus
5. Use **first letter navigation** in toolbox for quick access

#### For Keyboard Users
1. Learn the **global shortcuts** (B, R, W) for quick navigation
3. Use **Enter** to interact with focused elements
4. Use **Escape** to back out of any context

#### For All Users
- The workspace automatically stays organized
- All mouse interactions have keyboard equivalents
- Visual focus indicators show current selection



## Current Status

This project is currently in an experimental phase and is not yet ready for production use. It builds upon the keyboard navigation work by the Blockly team and aims to contribute to making block-based programming accessible to everyone.