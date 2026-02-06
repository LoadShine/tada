import { WritableAtom } from 'jotai';
import { RESET } from 'jotai/utils';

/**
 * Notification interface for toast messages.
 */
export interface Notification {
    id: number;
    type: 'success' | 'error' | 'loading';
    message: string;
}

/**
 * A generic type for atoms that manage local data with reset capability.
 * These atoms can hold null initially and support RESET action.
 */
export type LocalDataAtom<TData, TUpdate = TData | ((prev: TData | null) => TData) | typeof RESET> = WritableAtom<
    TData | null,
    [TUpdate],
    void
>;
