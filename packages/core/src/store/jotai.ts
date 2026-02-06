/**
 * @deprecated This file is maintained for backward compatibility.
 * Please import from '@/store' instead.
 * 
 * All atoms have been modularized into separate files:
 * - @/store/user.ts       - User profile atoms
 * - @/store/tasks.ts      - Task atoms
 * - @/store/lists.ts      - List atoms
 * - @/store/ui.ts         - UI state atoms
 * - @/store/settings/     - Settings atoms
 * - @/store/summary.ts    - Summary feature atoms
 * - @/store/echo.ts       - Echo feature atoms
 * - @/store/data.ts       - Import/export atoms
 */

// Re-export everything from the new modular structure
export * from './index';