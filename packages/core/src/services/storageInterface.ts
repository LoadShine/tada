import {
    AISettings,
    AppearanceSettings,
    List,
    PreferencesSettings,
    StoredSummary,
    Task,
    Subtask,
    ExportedData,
    ImportOptions,
    ImportResult,
    DataConflict,
    ConflictResolution
} from '@/types';

/**
 * Defines the contract for a storage service.
 * This interface allows for different storage implementations (e.g., localStorage, SQLite)
 * to be used interchangeably across the web and desktop applications.
 */
export interface IStorageService {
    // Settings
    fetchSettings(): {
        appearance: AppearanceSettings;
        preferences: PreferencesSettings;
        ai: AISettings;
    };
    updateAppearanceSettings(settings: AppearanceSettings): AppearanceSettings;
    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings;
    updateAISettings(settings: AISettings): AISettings;

    // Lists
    fetchLists(): List[];
    createList(listData: { name: string; icon?: string }): List;
    updateList(listId: string, updates: Partial<List>): List;
    deleteList(listId: string): { message: string };
    updateLists(lists: List[]): List[];

    // Tasks
    fetchTasks(): Task[];
    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task;
    updateTask(taskId: string, updates: Partial<Task>): Task;
    deleteTask(taskId: string): void;
    updateTasks(tasks: Task[]): Task[];

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask;
    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask;
    deleteSubtask(subtaskId: string): void;

    // Summaries
    fetchSummaries(): StoredSummary[];
    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary;
    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary;
    updateSummaries(summaries: StoredSummary[]): StoredSummary[];

    // Import/Export
    exportData(): ExportedData;
    analyzeImport(data: ExportedData, options: ImportOptions): DataConflict[];
    importData(data: ExportedData, options: ImportOptions, conflictResolutions?: Map<string, ConflictResolution>): ImportResult;

    // Optional batch operations for performance optimization
    batchUpdateTasks?(tasks: Task[]): Promise<void>;
    batchUpdateLists?(lists: List[]): Promise<void>;

    // Optional persistence control to ensure data is saved
    flush?(): Promise<void>;
    enableAutoPersist?(enabled: boolean): void;
}

export interface StorageEventListener {
    onTasksChanged?(tasks: Task[]): void;
    onListsChanged?(lists: List[]): void;
    onSettingsChanged?(settings: any): void;
}

export interface IEnhancedStorageService extends IStorageService {
    addEventListener?(listener: StorageEventListener): () => void;
}