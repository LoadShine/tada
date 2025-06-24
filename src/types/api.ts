// src/types/api.ts
import {User} from './index';

// --- Auth ---
export interface AuthResponse {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
    message?: string;
}

// --- Tasks ---
export interface TaskCreate {
    title: string;
    content?: string | null;
    listName: string; // Maps to 'list' alias on backend
    priority?: number | null;
    tags?: string[] | null;
    dueDate?: string | null; // ISO 8601 string
    order: number;
    completed?: boolean;
    completePercentage?: number;
}

export interface TaskUpdate {
    title?: string;
    content?: string | null;
    completed?: boolean;
    completePercentage?: number | null;
    dueDate?: string | null; // ISO 8601 string
    priority?: number | null;
    listName?: string; // Maps to 'list' alias
    order?: number;
    tags?: string[] | null;
}

export interface TaskBulkUpdate {
    ids: string[];
    completed?: boolean;
    completePercentage?: number;
    dueDate?: string | null;
    priority?: number | null;
    listName?: string;
}

export interface TaskBulkDelete {
    ids: string[];
}

// --- AI ---
export interface AiTaskSuggestion {
    id: string;
    prompt: string;
    suggestion: {
        title: string;
        content?: string;
        subtasks: {
            dueDate?: string;
            title: string
        }[];
        tags: string[];
        priority: number | null;
        dueDate: string | null; // ISO 8601 String
    };
    createdAt: number;
    updatedAt: number;
}