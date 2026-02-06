/**
 * Performance Utilities
 * 
 * Helpers for optimizing React component performance.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * A hook that returns a stable callback reference.
 * Useful for preventing unnecessary re-renders in child components.
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
    callback: T
): T {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(
        ((...args: unknown[]) => callbackRef.current(...args)) as T,
        []
    );
}

/**
 * A hook that provides a debounced value.
 * Useful for performance-sensitive inputs like search.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const previousValueRef = useRef<T>(value);
    const resultRef = useRef<T>(value);

    if (value !== previousValueRef.current) {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            resultRef.current = value;
        }, delay);
        previousValueRef.current = value;
    }

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return resultRef.current;
}

/**
 * A hook that batches multiple state updates.
 */
export function useBatchedUpdates<T>(
    items: T[],
    batchSize: number = 50
): { visibleItems: T[]; isFullyLoaded: boolean } {
    const itemCountRef = useRef(batchSize);

    useEffect(() => {
        if (itemCountRef.current < items.length) {
            const timeout = setTimeout(() => {
                itemCountRef.current = Math.min(
                    itemCountRef.current + batchSize,
                    items.length
                );
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [items.length, batchSize]);

    const visibleItems = useMemo(
        () => items.slice(0, itemCountRef.current),
        [items]
    );

    return {
        visibleItems,
        isFullyLoaded: itemCountRef.current >= items.length
    };
}

/**
 * A utility for checking if props have changed meaningfully.
 * Useful for implementing custom shouldComponentUpdate logic.
 */
export function shallowEqual<T extends Record<string, unknown>>(
    prev: T,
    next: T,
    keys?: (keyof T)[]
): boolean {
    const keysToCheck = keys || (Object.keys(prev) as (keyof T)[]);

    for (const key of keysToCheck) {
        if (prev[key] !== next[key]) {
            return false;
        }
    }

    return true;
}

/**
 * Creates a memoized selector that only recomputes when dependencies change.
 */
export function createSelector<TInput, TOutput>(
    inputSelector: () => TInput,
    transformer: (input: TInput) => TOutput
): () => TOutput {
    let cachedInput: TInput | undefined;
    let cachedOutput: TOutput | undefined;

    return () => {
        const input = inputSelector();
        if (input !== cachedInput) {
            cachedInput = input;
            cachedOutput = transformer(input);
        }
        return cachedOutput!;
    };
}
