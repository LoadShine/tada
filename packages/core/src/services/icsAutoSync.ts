/**
 * ICS Auto Sync Hook
 * 
 * Watches for task changes and automatically syncs to the ICS server.
 * Uses debouncing to avoid excessive API calls.
 */

import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { tasksAtom } from '@/store/jotai';
import { syncTasksToServer } from './icsService';

const SYNC_DEBOUNCE_MS = 3000; // 3 seconds debounce

/**
 * Hook to automatically sync tasks to ICS server when tasks change.
 * Should be called once at the app root level.
 */
export function useIcsAutoSync() {
    const tasks = useAtomValue(tasksAtom);
    const lastSyncRef = useRef<string>('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Get server URL from localStorage
        const serverUrl = localStorage.getItem('tada-ics-server-url');
        if (!serverUrl || !tasks || tasks.length === 0) {
            return;
        }

        // Create a hash of task IDs and their relevant properties to detect changes
        const tasksHash = tasks
            .map(t => `${t.id}:${t.completed}:${t.dueDate}:${t.title}`)
            .sort()
            .join('|');

        // Skip if nothing changed
        if (tasksHash === lastSyncRef.current) {
            return;
        }

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the sync
        debounceTimerRef.current = setTimeout(async () => {
            try {
                await syncTasksToServer(tasks, serverUrl);
                lastSyncRef.current = tasksHash;
                console.log('[ICS Auto Sync] Synced', tasks.length, 'tasks');
            } catch (error) {
                console.error('[ICS Auto Sync] Failed:', error);
            }
        }, SYNC_DEBOUNCE_MS);

        // Cleanup
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [tasks]);
}
