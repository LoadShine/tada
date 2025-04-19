// src/types/index.ts
export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isPremium: boolean;
}

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    dueDate?: number | null; // Store as timestamp (milliseconds since epoch)
    list: string; // e.g., 'Inbox', 'Work', 'Personal'
    content?: string; // Markdown content
    order: number; // For manual sorting within filters/lists
    createdAt: number; // Timestamp
    updatedAt: number; // Timestamp
    tags?: string[];
    priority?: number | null; // e.g., 1 (High) - 4 (Low), null for none
    // Derived property for DND date change context and grouping
    groupCategory: TaskGroupCategory; // Now non-optional, calculated by atom setter
}

export type TaskFilter = 'all' | 'today' | 'next7days' | 'completed' | 'trash' | `list-${string}` | `tag-${string}`;

export type SettingsTab =
    | 'account' | 'appearance' | 'premium' | 'notifications' | 'integrations'
    | 'about';

// Grouping category for 'All Tasks' view
export type TaskGroupCategory = 'overdue' | 'today' | 'next7days' | 'later' | 'nodate';