// src/types/index.ts
import {DarkModeOption, DefaultNewTaskDueDate} from "@/store/atoms.ts";
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

// 简化的AI设置接口
export interface AISettings {
    provider: AIProvider['id']; // 当前选择的提供商
    apiKey: string; // API密钥
    model: string; // 选择的模型
    baseUrl?: string; // 自定义base URL (用于ollama、custom等)
    fetchedModels?: AIModel[]; // 获取到的模型列表
    isConnected?: boolean; // 连接状态
}