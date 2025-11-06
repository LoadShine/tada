import {DarkModeOption, DefaultNewTaskDueDate} from "@/store/jotai.ts";
import {AIProvider, AIModel} from "@/config/aiProviders.ts";

export interface List {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    order?: number | null;
}

export interface Subtask {
    id: string;
    parentId: string;
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
    listId: string | null;
    listName: string;
    content?: string;
    order: number;
    createdAt: number;
    updatedAt: number;
    tags?: string[];
    priority?: number | null;
    groupCategory: TaskGroupCategory;
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
    | 'appearance'
    | 'preferences'
    | 'ai'
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
    interfaceDensity: 'compact' | 'default' | 'comfortable';
}

export interface PreferencesSettings {
    language: 'en' | 'zh-CN';
    defaultNewTaskDueDate: DefaultNewTaskDueDate;
    defaultNewTaskPriority: number | null;
    defaultNewTaskList: string;
    confirmDeletions: boolean;
}

// Simplified AI Settings - single provider, single model
export interface AISettings {
    provider: AIProvider['id'];
    apiKey: string;
    model: string;
    baseUrl?: string; // for custom/ollama providers
    availableModels?: AIModel[]; // cached available models
}