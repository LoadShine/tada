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
    dueDate?: number | null; // Store as timestamp (milliseconds)
    list: string; // 'Inbox' or user-defined list name
    content?: string; // Markdown content
    order: number; // Global order for sorting (can be float for fractional indexing)
    createdAt: number; // Timestamp (milliseconds)
    updatedAt: number; // Timestamp (milliseconds)
    tags?: string[];
    priority?: number; // 1 (High) to 4 (Low)
}

export type ListDisplayMode = 'expanded' | 'compact';

// Updated filter types reflecting sidebar changes
export type TaskFilter = 'all' | 'today' | 'next7days' | 'completed' | 'trash' | `list-${string}` | `tag-${string}`;

// Added type for grouped tasks
export type TaskGroup = {
    id: string; // e.g., 'overdue', 'today', '2024-08-15', 'nodate'
    title: string; // e.g., 'Overdue', 'Today', 'Aug 15', 'No Date'
    tasks: Task[];
    isDateGroup: boolean; // Indicates if this group represents a specific date/range
    date?: number; // Timestamp for date groups (start of day)
};

export type SettingsTab =
    | 'account' | 'premium' | 'features' | 'smart-list' | 'notifications'
    | 'date-time' | 'appearance' | 'more' | 'integrations' | 'collaborate'
    | 'shortcuts' | 'about';