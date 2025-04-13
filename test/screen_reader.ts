/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';

/**
 * A simple screen reader implementation for Blockly that announces actions.
 */
export class ScreenReader {
  private workspace: Blockly.WorkspaceSvg;
  
  /**
   * Constructs a new ScreenReader instance.
   * @param workspace The Blockly workspace to attach to.
   */
  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace;
    this.initEventListeners();
    
    // Announce that screen reader is active
    this.speak("Screen reader enabled");
  }
  
  /**
   * Initialize event listeners for workspace changes.
   */
  private initEventListeners(): void {
    // Listen for block selection changes
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.SELECTED) {
        const selectedEvent = event as Blockly.Events.Selected;
        if (selectedEvent.newElementId) {
          const block = this.workspace.getBlockById(selectedEvent.newElementId);
          if (block) {
            this.announceBlock(block);
          }
        } else {
          this.speak("No block selected");
        }
      } else if (event.type === Blockly.Events.BLOCK_CREATE) {
        const createEvent = event as Blockly.Events.BlockCreate;
        if (createEvent.blockId) {
          const block = this.workspace.getBlockById(createEvent.blockId);
          if (block) {
            this.speak(`Created ${this.getBlockDescription(block)}`);
          }
        }
      } else if (event.type === Blockly.Events.BLOCK_DELETE) {
        this.speak("Block deleted");
      } else if (event.type === Blockly.Events.BLOCK_CHANGE) {
        const changeEvent = event as Blockly.Events.BlockChange;
        if (changeEvent.blockId) {
          const block = this.workspace.getBlockById(changeEvent.blockId);
          if (block) {
            this.speak(`Changed ${this.getBlockDescription(block)}`);
          }
        }
      }
    });
  }
  
  /**
   * Announce information about a specific block.
   * @param block The block to announce.
   */
  public announceBlock(block: Blockly.Block): void {
    const description = this.getBlockDescription(block);
    this.speak(`Selected ${description}`);
  }
  
  /**
   * Get a human-readable description of a block.
   * @param block The block to describe.
   * @returns A description string.
   */
  private getBlockDescription(block: Blockly.Block): string {
    // Get the type of the block
    const blockType = block.type;
    
    // For certain block types, provide more specific descriptions
    if (blockType === 'p5_setup') {
      return "Setup block";
    } else if (blockType === 'p5_draw') {
      return "Draw block";
    } else if (blockType === 'p5_canvas') {
      const width = block.getFieldValue('WIDTH');
      const height = block.getFieldValue('HEIGHT');
      return `Canvas block, width ${width}, height ${height}`;
    } else if (blockType === 'math_number') {
      const value = block.getFieldValue('NUM');
      return `Number block with value ${value}`;
    } else if (blockType === 'simple_circle') {
      return "Simple circle block";
    } else if (blockType === 'text_print') {
      return "Print text block";
    }
    
    // Default description based on block type
    const readableType = blockType.replace(/_/g, ' ');
    return readableType + " block";
  }
  
  /**
   * Speak a message out loud using the browser's speech synthesis.
   * @param message The message to speak.
   */
  private speak(message: string): void {
    // Log to console for debugging
    console.log(`Screen reader: ${message}`);
    
    // Use the Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      window.speechSynthesis.speak(utterance);
    }
  }
}