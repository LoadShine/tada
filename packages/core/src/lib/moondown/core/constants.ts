
/**
 * Core constants for the Moondown editor
 */

// ============================================
// Markdown Syntax Constants
// ============================================

/** Markdown inline style markers */
export const MARKDOWN_MARKERS = {
  BOLD: '**',
  ITALIC: '*',
  STRIKETHROUGH: '~~',
  HIGHLIGHT: '==',
  UNDERLINE: '~',
  INLINE_CODE: '`',
} as const;

/** Markdown block patterns */
export const MARKDOWN_PATTERNS = {
  HEADING_PREFIX: '#',
  ORDERED_LIST: /^\d+\.\s/,
  UNORDERED_LIST: /^-\s/,
  BLOCKQUOTE: /^>\s/,
  IMAGE: /^!\[.*?\]\(.*?\)$/,
  SLASH_COMMAND: /\/(\w*)$/,
} as const;

/** Markdown text templates */
export const MARKDOWN_TEMPLATES = {
  TABLE: "\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n",
  LINK: "[Link text](url)",
  CODE_BLOCK: "```\n\n```",
} as const;

// ============================================
// UI Constants
// ============================================

/** CSS class names */
export const CSS_CLASSES = {
  // Bubble menu
  BUBBLE_MENU: 'cm-bubble-menu',
  BUBBLE_MENU_ITEM: 'cm-bubble-menu-item',
  BUBBLE_MENU_DROPDOWN: 'cm-bubble-menu-dropdown',
  BUBBLE_MENU_SUB_ITEM: 'cm-bubble-menu-sub-item',
  BUBBLE_MENU_ACTIVE: 'active',
  
  // Slash command
  SLASH_COMMAND_MENU: 'cm-slash-command-menu',
  SLASH_COMMAND_ITEM: 'cm-slash-command-item',
  SLASH_COMMAND_SELECTED: 'selected',
  SLASH_COMMAND_DIVIDER: 'cm-slash-command-divider',
  
  // Image widget
  IMAGE_WIDGET: 'cm-image-widget',
  IMAGE_ERROR: 'cm-image-error',
  IMAGE_PLACEHOLDER: 'cm-image-placeholder',
  
  // Markdown syntax hiding
  HIDDEN_MARKDOWN: 'cm-hidden-markdown',
  VISIBLE_MARKDOWN: 'cm-visible-markdown',
  
  // Code blocks
  FENCED_CODE: 'cm-fenced-code',
  
  // Blockquote
  BLOCKQUOTE_LINE: 'cm-blockquote-line',
  
  // Loading states
  LOADING_WIDGET: 'cm-loading-widget',
  LOADING_SPINNER: 'cm-loading-spinner',
  NEW_TEXT: 'cm-new-text',
} as const;

/** Icon sizes */
export const ICON_SIZES = {
  SMALL: { width: '12', height: '12' },
  MEDIUM: { width: '16', height: '16' },
  LARGE: { width: '20', height: '20' },
} as const;

/** Timing constants (in milliseconds) */
export const TIMING = {
  DEBOUNCE_DELAY: 10,
  CLICK_TIMEOUT: 200,
  ANIMATION_DURATION: 2000,
} as const;

/** Popper.js configuration */
export const POPPER_CONFIG = {
  PLACEMENT: 'top',
  OFFSET: [0, 8],
} as const;

// ============================================
// Editor Behavior Constants
// ============================================

/** Selection and cursor behavior */
export const SELECTION = {
  /** Extra characters to check around selection for style markers */
  MARKER_CONTEXT_LENGTH: 3,
} as const;

/** AI-related constants */
export const AI_CONFIG = {
  MODEL: 'glm-4-flash',
  FILL_PLACEHOLDER: '{FILL_ME}',
  DEFAULT_COMPLETION_LENGTH: 200,
} as const;

// ============================================
// Type Guards
// ============================================

export type MarkdownMarker = typeof MARKDOWN_MARKERS[keyof typeof MARKDOWN_MARKERS];
export type CSSClass = typeof CSS_CLASSES[keyof typeof CSS_CLASSES];
