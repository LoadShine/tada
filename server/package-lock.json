/**
 * ICS Calendar Service
 * 
 * Provides functionality to sync tasks to a server and generate ICS calendar files.
 */

import { Task } from '@/types';

export interface SyncResult {
    success: boolean;
    message: string;
    tasksWithDueDate?: number;
    error?: string;
}

/**
 * Sync tasks to the ICS server
 */
export async function syncTasksToServer(
    tasks: Task[],
    serverUrl: string
): Promise<SyncResult> {
    try {
        // 只同步必要的字段
        const syncTasks = tasks.map(t => ({
            id: t.id,
            title: t.title,
            completed: t.completed,
            dueDate: t.dueDate,
            content: t.content,
            priority: t.priority,
            listName: t.listName,
        }));

        const response = await fetch(`${serverUrl}/api/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tasks: syncTasks }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                message: 'Sync failed',
                error: errorData.error || `HTTP ${response.status}`,
            };
        }

        const result = await response.json();
        return {
            success: true,
            message: result.message,
            tasksWithDueDate: result.tasksWithDueDate,
        };
    } catch (error) {
        return {
            success: false,
            message: 'Network error',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get the calendar subscription URL
 */
export function getCalendarUrl(serverUrl: string): string {
    // 移除末尾斜杠
    const baseUrl = serverUrl.replace(/\/+$/, '');
    return `${baseUrl}/calendar.ics`;
}

/**
 * Test server connection
 */
export async function testServerConnection(serverUrl: string): Promise<boolean> {
    try {
        const response = await fetch(`${serverUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        return response.ok;
    } catch {
        return false;
    }
}
