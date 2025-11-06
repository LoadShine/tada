
/**
 * Constants for list functionality
 */

/**
 * List indentation settings
 */
export const LIST_INDENT = {
  /** Size of one indent level in spaces */
  SIZE: 2,
  /** Minimum indent level */
  MIN: 0,
  /** Maximum indent level */
  MAX: 10,
} as const;

/**
 * List types
 */
export const LIST_TYPES = {
  ORDERED: 'ordered',
  UNORDERED: 'unordered',
} as const;

/**
 * List markers
 */
export const LIST_MARKERS = {
  /** Unordered list marker */
  UNORDERED: '- ',
  /** Ordered list marker template (will be replaced with number) */
  ORDERED_TEMPLATE: (num: number) => `${num}. `,
} as const;

/**
 * Timeout for deferred list updates (in milliseconds)
 */
export const LIST_UPDATE_DELAY = 0;

/**
 * Regular expressions for list detection
 */
export const LIST_PATTERNS = {
  /** Matches ordered list item: 1. , 2. , etc. */
  ORDERED: /^(\s*)(\d+)\.\s/,
  /** Matches unordered list item: - , * , + */
  UNORDERED: /^(\s*)[-*+]\s/,
  /** Matches any list item */
  ANY: /^(\s*)([-*+]|\d+\.)\s/,
} as const;
