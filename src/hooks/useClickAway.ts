// src/hooks/useClickAway.ts
import { useEffect, RefObject } from 'react';

/**
 * Custom hook to detect clicks outside a specified element (or multiple elements).
 * @param refs RefObject(s) of the element(s) to monitor. Can be a single ref or an array of refs.
 * @param handler Callback function to execute when a click outside occurs.
 */
function useClickAway(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
    handler: (event: MouseEvent | TouchEvent) => void
) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            const refsArray = Array.isArray(refs) ? refs : [refs];

            // Check if the click is inside any of the provided refs or an element marked to be ignored
            const isInside = refsArray.some(ref => {
                const el = ref?.current;
                // Do nothing if clicking ref's element or descendent elements
                return el && (el.contains(target) || (target instanceof Element && target.closest('.ignore-click-away')));
            });

            // If the click is not inside any ref element or ignored element, call the handler
            if (!isInside) {
                handler(event);
            }
        };

        // Use a small timeout to prevent the handler from firing immediately
        // if the click that opened the element is also considered "outside".
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', listener);
            document.addEventListener('touchstart', listener);
        }, 0);


        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [refs, handler]); // Re-run if refs or handler changes
}

export default useClickAway;