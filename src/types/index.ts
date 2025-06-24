// src/types/index.ts
import {DarkModeOption, DefaultNewTaskDueDate} from "@/store/atoms.ts";

export interface User {
    id: string;
    username: string;
    email: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    isPremium: boolean;
}

export interface Subtask {
    id: string;
    parentId: string; // Corresponds to task_id on backend
    title: string;
    completed: boolean;
    completedAt: number | null;
    dueDate?: number | null;
    order: number;
    createdAt: number;
    updatedAt: number;
}

export interface Task {
    id:string;
    title: string;
    completed: boolean;
    completedAt: number | null;
    completePercentage: number | null;
    dueDate?: number | null;
    listName: string; // Renamed from 'list' to match backend alias
    content?: string;
    order: number;
    createdAt: number;
    updatedAt: number;
    tags?: string[];
    priority?: number | null;
    groupCategory: TaskGroupCategory; // This is a derived, client-side only property
    subtasks?: Subtask[];
}

export type TaskFilter =
    | 'all'
    | 'today'
    | 'next7days'
    | 'completed'
    | 'trash'
    | `list-${string}`
    | `tag-${string}`;

export type SettingsTab =
    | 'account'
    | 'appearance'
    | 'preferences'
    | 'premium'
    | 'about';

export type TaskGroupCategory =
    | 'overdue'
    | 'today'
    | 'next7days'
    | 'later'
    | 'nodate';

export interface StoredSummary {
    id: string;
    createdAt: number;
    updatedAt: number;
    periodKey: string;
    listKey: string;
    taskIds: string[];
    summaryText: string;
}

export interface AppearanceSettings {
    themeId: string;
    darkMode: DarkModeOption;
    backgroundImageUrl: string;
    backgroundImageBlur: number;
    backgroundImageBrightness: number;
    interfaceDensity: 'compact' | 'default' | 'comfortable';
}

export interface PreferencesSettings {
    language: 'en' | 'zh-CN';
    defaultNewTaskDueDate: DefaultNewTaskDueDate;
    defaultNewTaskPriority: number | null;
    defaultNewTaskList: string;
    confirmDeletions: boolean;
}