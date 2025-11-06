
/**
 * Constants for table editor functionality
 */

/**
 * Table sizing constants
 */
export const TABLE_SIZING = {
  /** Default edge button size in pixels */
  EDGE_BUTTON_SIZE: 30,
  /** Minimum column width in pixels */
  MIN_COLUMN_WIDTH: 50,
  /** Default column width in pixels */
  DEFAULT_COLUMN_WIDTH: 150,
  /** Maximum column width in pixels */
  MAX_COLUMN_WIDTH: 800,
} as const;

/**
 * CSS class names for table elements
 */
export const TABLE_CSS_CLASSES = {
  /** Main table helper class */
  HELPER: 'table-helper',
  /** Operate button class */
  OPERATE_BUTTON: 'table-helper-operate-button',
  /** Top button class */
  TOP_BUTTON: 'top',
  /** Left button class */
  LEFT_BUTTON: 'left',
  /** Right button class */
  RIGHT_BUTTON: 'right',
  /** Bottom button class */
  BOTTOM_BUTTON: 'bottom',
  /** Active cell class */
  ACTIVE_CELL: 'active',
  /** Header row class */
  HEADER_ROW: 'header-row',
} as const;

/**
 * HTML entities and symbols
 */
export const TABLE_SYMBOLS = {
  /** Vertical ellipsis (⋮) */
  VERTICAL_ELLIPSIS: '&#8942;',
  /** Horizontal ellipsis (⋯) */
  HORIZONTAL_ELLIPSIS: '&#8943;',
} as const;

/**
 * Column alignment types
 */
export const COLUMN_ALIGNMENTS = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
  NONE: 'none',
} as const;
