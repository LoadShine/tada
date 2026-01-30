import { DarkModeOption, DefaultNewTaskDueDate } from "@/store/jotai.ts";
import { AIProvider, AIModel } from "@/config/aiProviders.ts";
import { UserProfile } from './userProfile';

export * from './userProfile';

/**
 * Represents a user-created list for organizing tasks.
 */
export interface List {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    order?: number | null;
}

/**
 * Represents a subtask associated with a parent task.
 */
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

/**
 * Represents a single task item.
 */
export interface Task {
    id: string;
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

/**
 * Defines the possible filter types for the task list.
 */
export type TaskFilter =
    | 'all'
    | 'today'
    | 'next7days'
    | 'completed'
    | 'trash'
    | `list-${string}`
    | `tag-${string}`;

/**
 * Defines the available tabs in the settings modal.
 */
export type SettingsTab =
    | 'appearance'
    | 'preferences'
    | 'profile'
    | 'ai'
    | 'proxy'
    | 'data'
    | 'about';

/**
 * Defines the categories for grouping tasks in the "All Tasks" view.
 */
export type TaskGroupCategory =
    | 'overdue'
    | 'today'
    | 'next7days'
    | 'later'
    | 'nodate';

/**
 * Represents a stored AI-generated summary.
 */
export interface StoredSummary {
    id: string;
    createdAt: number;
    updatedAt: number;
    periodKey: string;
    listKey: string;
    taskIds: string[];
    summaryText: string;
}

/**
 * Represents a stored Echo report.
 */
export interface EchoReport {
    id: string;
    createdAt: number;
    content: string;
    jobTypes: string[];
    style: 'balanced' | 'exploration' | 'reflection';
    userInput?: string;
}

/**
 * Defines schedule configuration for automated report generation.
 */
export interface ScheduleSettings {
    enabled: boolean;
    time: string; // HH:mm format, e.g., "18:00"
    days: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

/**
 * Represents a scheduled report popup data.
 */
export interface ScheduledReportData {
    type: 'summary' | 'echo';
    content: string;
    createdAt: number;
    reportId: string;
}

/**
 * Defines the structure for appearance-related settings.
 */
export interface AppearanceSettings {
    themeId: string;
    darkMode: DarkModeOption;
    interfaceDensity: 'compact' | 'default' | 'comfortable';
    textSize: 'default' | 'large';
    fontWeight: 'light' | 'regular' | 'bold';
}

/**
 * Defines the structure for user preference settings.
 */
export interface PreferencesSettings {
    language: 'en' | 'zh-CN';
    defaultNewTaskDueDate: DefaultNewTaskDueDate;
    defaultNewTaskPriority: number | null;
    defaultNewTaskList: string;
    confirmDeletions: boolean;
    zenModeShyNative: boolean;
    enableEcho: boolean; // Toggle for the Echo feature
    alwaysUseAITask: boolean; // Toggle for always using AI task input
    scheduleSettings: ScheduleSettings; // Scheduled report generation config
}

/**
 * Defines the structure for AI-related settings.
 */
export interface AISettings {
    provider: AIProvider['id'];
    apiKey: string;
    model: string;
    baseUrl?: string; // for custom/ollama providers
    availableModels?: AIModel[]; // cached available models
}

/**
 * Defines the structure for Proxy settings.
 */
export interface ProxySettings {
    enabled: boolean;
    protocol: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    auth: boolean;
    username?: string;
    password?: string;
}

/**
 * Defines the structure for exported data.
 */
export interface ExportedData {
    version: string;
    exportedAt: number;
    platform: 'web' | 'desktop';
    data: {
        settings: {
            appearance: AppearanceSettings;
            preferences: PreferencesSettings;
            ai: AISettings;
            proxy?: ProxySettings;
        };
        userProfile: UserProfile | null;
        lists: List[];
        tasks: Task[];
        summaries: StoredSummary[];
        echoReports: EchoReport[];
    };
}

/**
 * Defines the conflict resolution strategy for imports.
 */
export type ConflictResolution = 'keep-local' | 'keep-imported' | 'keep-newer' | 'skip';

/**
 * Defines a conflict between local and imported data.
 */
export interface DataConflict {
    id: string;
    type: 'list' | 'task' | 'summary' | 'echo';
    local: any;
    imported: any;
}

/**
 * Defines the import options and conflict resolution.
 */
export interface ImportOptions {
    includeSettings: boolean;
    includeLists: boolean;
    includeTasks: boolean;
    includeSummaries: boolean;
    includeEcho: boolean;
    conflictResolution: ConflictResolution;
    replaceAllData: boolean;
}

/**
 * Defines the result of an import operation.
 */
export interface ImportResult {
    success: boolean;
    message: string;
    imported: {
        settings: number;
        lists: number;
        tasks: number;
        summaries: number;
        echo: number;
    };
    conflicts: DataConflict[];
    errors: string[];
}