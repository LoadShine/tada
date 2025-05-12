// src/types/index.ts
export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string; // Optional avatar URL
    isPremium: boolean; // Premium status flag
}

export interface Subtask {
    id: string;
    parentId: string;
    title: string;
    completed: boolean;
    completedAt: number | null;
    dueDate?: number | null; // Store as timestamp
    // content?: string; // Optional Markdown content for notes - REMOVED
    order: number; // Fractional index for sorting within the parent
    createdAt: number;
    updatedAt: number;
}

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    completedAt: number | null;
    completionPercentage: number | null; // For parent task progress
    dueDate?: number | null; // Store as timestamp (milliseconds since epoch) or null
    list: string; // List name (e.g., 'Inbox', 'Work', 'Trash')
    content?: string; // Optional Markdown content for notes
    order: number; // Fractional index for sorting
    createdAt: number; // Timestamp when created
    updatedAt: number; // Timestamp when last updated
    tags?: string[]; // Optional array of tag strings
    priority?: number | null; // Priority level (e.g., 1-4) or null
    groupCategory: TaskGroupCategory; // Derived category for grouping (non-optional)
    subtasks?: Subtask[]; // Array of subtasks
}

// Defines the possible filter strings used for routing and state
export type TaskFilter =
    | 'all'
    | 'today'
    | 'next7days'
    | 'completed'
    | 'trash'
    | `list-${string}` // e.g., 'list-Inbox', 'list-Work'
    | `tag-${string}`; // e.g., 'tag-urgent', 'tag-review'

// Defines the possible tabs in the settings modal
export type SettingsTab =
    | 'account'
    | 'appearance'
    | 'premium'
    | 'notifications'
    | 'integrations'
    | 'about';

// Defines the categories used for grouping tasks in the 'All Tasks' view
export type TaskGroupCategory =
    | 'overdue'
    | 'today'
    | 'next7days'
    | 'later' // Due date is beyond 7 days
    | 'nodate'; // No due date assigned or task is completed/trashed