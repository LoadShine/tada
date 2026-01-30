import { IStorageService } from '@tada/core/services/storageInterface';
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
    ConflictResolution,
    EchoReport,
    ProxySettings,
    UserProfile,
    createDefaultUserProfile
} from '@tada/core/types';
import {
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    defaultPreferencesSettingsForApi,
    defaultProxySettingsForApi,
    getTaskGroupCategory
} from '@tada/core/store/jotai';

/**
 * LocalStorage keys for data persistence
 */
const KEYS = {
    TASKS: 'tada-tasks',
    LISTS: 'tada-lists',
    SUMMARIES: 'tada-summaries',
    ECHO_REPORTS: 'tada-echo-reports',
    APPEARANCE_SETTINGS: 'tada-appearanceSettings',
    PREFERENCES_SETTINGS: 'tada-preferencesSettings',
    AI_SETTINGS: 'tada-aiSettings',
    PROXY_SETTINGS: 'tada-proxySettings',
    USER_PROFILE: 'tada-userProfile',
};

/**
 * In-memory cache with dirty flag tracking
 */
class MemoryCache<T> {
    private cache: T | null = null;
    private isDirty = false;

    set(value: T, dirty = true): void {
        this.cache = value;
        this.isDirty = dirty;
    }

    get(): T | null {
        return this.cache;
    }

    markDirty(): void {
        this.isDirty = true;
    }

    isDirtyFlag(): boolean {
        return this.isDirty;
    }

    clearDirty(): void {
        this.isDirty = false;
    }

    clear(): void {
        this.cache = null;
        this.isDirty = false;
    }
}

/**
 * Retrieve item from localStorage with caching support
 */
function getItem<T>(key: string, defaultValue: T, cache?: MemoryCache<T>): T {
    if (cache) {
        const cached = cache.get();
        if (cached !== null) {
            return cached;
        }
    }

    try {
        const rawData = localStorage.getItem(key);
        if (rawData) {
            const parsed = JSON.parse(rawData) as T;
            if (cache) {
                cache.set(parsed, false);
            }
            return parsed;
        }
    } catch (error) {
        console.error(`Failed to load '${key}' from localStorage`, error);
    }

    if (cache) {
        cache.set(defaultValue, false);
    }
    return defaultValue;
}

/**
 * Store item to localStorage with deferred write
 */
function setItem<T>(key: string, value: T, cache?: MemoryCache<T>): void {
    if (cache) {
        cache.set(value, true);
    }

    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            persistToStorage(key, value, cache);
        }, { timeout: 2000 });
    } else {
        setTimeout(() => {
            persistToStorage(key, value, cache);
        }, 100);
    }
}

/**
 * Persist data to localStorage immediately
 */
function persistToStorage<T>(key: string, value: T, cache?: MemoryCache<T>): void {
    try {
        const stringifiedData = JSON.stringify(value);
        localStorage.setItem(key, stringifiedData);
        if (cache) {
            cache.clearDirty();
        }
    } catch (error) {
        console.error(`Failed to save '${key}' to localStorage`, error);
    }
}

/**
 * Initialize default data if not present in localStorage
 */
function initializeDefaultData() {
    if (!localStorage.getItem(KEYS.LISTS)) {
        const inboxId = `list-${Date.now()}`;
        const defaultLists: List[] = [{ id: inboxId, name: 'Inbox', icon: 'inbox', order: 1 }];
        localStorage.setItem(KEYS.LISTS, JSON.stringify(defaultLists));
    }
    if (!localStorage.getItem(KEYS.PREFERENCES_SETTINGS)) {
        const defaultPrefs = defaultPreferencesSettingsForApi();
        defaultPrefs.defaultNewTaskList = 'Inbox';
        localStorage.setItem(KEYS.PREFERENCES_SETTINGS, JSON.stringify(defaultPrefs));
    }
}

initializeDefaultData();

/**
 * LocalStorage-based storage service implementation for web application
 */
export class LocalStorageService implements IStorageService {
    private tasksCache = new MemoryCache<Task[]>();
    private listsCache = new MemoryCache<List[]>();
    private summariesCache = new MemoryCache<StoredSummary[]>();
    private echoReportsCache = new MemoryCache<EchoReport[]>();
    private appearanceCache = new MemoryCache<AppearanceSettings>();
    private preferencesCache = new MemoryCache<PreferencesSettings>();
    private aiCache = new MemoryCache<AISettings>();
    private proxyCache = new MemoryCache<ProxySettings>();
    private userProfileCache = new MemoryCache<UserProfile>();

    private pendingWrites = new Set<string>();
    private flushTimeout: NodeJS.Timeout | null = null;

    constructor() {
        window.addEventListener('beforeunload', () => {
            this.flushSync();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flush();
            }
        });
    }

    /**
     * Retrieve all settings from cache or localStorage
     */
    fetchSettings() {
        return {
            appearance: getItem(KEYS.APPEARANCE_SETTINGS, defaultAppearanceSettingsForApi(), this.appearanceCache),
            preferences: getItem(KEYS.PREFERENCES_SETTINGS, defaultPreferencesSettingsForApi(), this.preferencesCache),
            ai: getItem(KEYS.AI_SETTINGS, defaultAISettingsForApi(), this.aiCache),
            proxy: getItem(KEYS.PROXY_SETTINGS, defaultProxySettingsForApi(), this.proxyCache),
        };
    }

    /**
     * Update appearance settings in cache and localStorage
     */
    updateAppearanceSettings(settings: AppearanceSettings) {
        setItem(KEYS.APPEARANCE_SETTINGS, settings, this.appearanceCache);
        return settings;
    }

    /**
     * Update preferences settings in cache and localStorage
     */
    updatePreferencesSettings(settings: PreferencesSettings) {
        setItem(KEYS.PREFERENCES_SETTINGS, settings, this.preferencesCache);
        return settings;
    }

    /**
     * Update AI settings in cache and localStorage
     */
    updateAISettings(settings: AISettings) {
        setItem(KEYS.AI_SETTINGS, settings, this.aiCache);
        return settings;
    }

    /**
     * Update Proxy settings in cache and localStorage
     */
    updateProxySettings(settings: ProxySettings) {
        setItem(KEYS.PROXY_SETTINGS, settings, this.proxyCache);
        return settings;
    }

    /**
     * Retrieve user profile from cache or localStorage
     */
    fetchUserProfile(): UserProfile | null {
        const cached = this.userProfileCache.get();
        if (cached !== null) {
            return cached;
        }

        try {
            const rawData = localStorage.getItem(KEYS.USER_PROFILE);
            if (rawData) {
                const parsed = JSON.parse(rawData) as UserProfile;
                this.userProfileCache.set(parsed, false);
                return parsed;
            }
        } catch (error) {
            console.error('Failed to load user profile from localStorage', error);
        }

        return null;
    }

    /**
     * Update user profile in cache and localStorage
     */
    updateUserProfile(profile: UserProfile): UserProfile {
        const updated = { ...profile, updatedAt: Date.now() };
        setItem(KEYS.USER_PROFILE, updated, this.userProfileCache);
        return updated;
    }

    /**
     * Retrieve all lists from cache or localStorage
     */
    fetchLists() {
        return getItem<List[]>(KEYS.LISTS, [], this.listsCache);
    }

    /**
     * Create a new list in cache and localStorage
     */
    createList(listData: { name: string; icon?: string }) {
        const lists = this.fetchLists();
        const newList: List = {
            id: `list-${Date.now()}-${Math.random()}`,
            name: listData.name,
            icon: listData.icon ?? 'list',
            order: (lists.length + 1) * 1000,
        };
        lists.push(newList);
        setItem(KEYS.LISTS, lists, this.listsCache);
        return newList;
    }

    /**
     * Update list in cache and localStorage, propagating name changes to tasks
     */
    updateList(listId: string, updates: Partial<List>) {
        const lists = this.fetchLists();
        let originalName: string | undefined;
        let updatedList: List | undefined;

        const updatedLists = lists.map(list => {
            if (list.id === listId) {
                originalName = list.name;
                updatedList = { ...list, ...updates };
                return updatedList;
            }
            return list;
        });

        if (!updatedList) throw new Error("List not found");

        setItem(KEYS.LISTS, updatedLists, this.listsCache);

        if (updates.name && originalName && updates.name !== originalName) {
            const tasks = this.fetchTasks();
            const updatedTasks = tasks.map(task =>
                task.listId === listId ? { ...task, listName: updates.name! } : task
            );
            setItem(KEYS.TASKS, updatedTasks, this.tasksCache);
        }

        return updatedList;
    }

    /**
     * Delete list and move its tasks to Inbox or set to null for Trash items
     */
    deleteList(listId: string) {
        const lists = this.fetchLists();
        const listToDelete = lists.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

        const inbox = lists.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found, cannot delete list.");

        const tasks = this.fetchTasks();
        const updatedTasks = tasks.map(task => {
            if (task.listId === listId) {
                return task.listName === 'Trash'
                    ? { ...task, listId: null }
                    : { ...task, listId: inbox.id, listName: inbox.name };
            }
            return task;
        });
        setItem(KEYS.TASKS, updatedTasks, this.tasksCache);

        const newLists = lists.filter(l => l.id !== listId);
        setItem(KEYS.LISTS, newLists, this.listsCache);
        return { message: "List deleted successfully" };
    }

    /**
     * Replace all lists with new set in cache and localStorage
     */
    updateLists(lists: List[]) {
        setItem(KEYS.LISTS, lists, this.listsCache);
        return lists;
    }

    /**
     * Retrieve all tasks from cache or localStorage
     */
    fetchTasks() {
        return getItem<Task[]>(KEYS.TASKS, [], this.tasksCache);
    }

    /**
     * Create a new task in cache and localStorage
     */
    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>) {
        const tasks = this.fetchTasks();
        const now = Date.now();
        const newTask: Task = {
            ...taskData,
            id: `task-${now}-${Math.random()}`,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };
        tasks.push(newTask);
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return newTask;
    }

    /**
     * Update task in cache and localStorage
     */
    updateTask(taskId: string, updates: Partial<Task>) {
        const tasks = this.fetchTasks();
        let updatedTask: Task | undefined;
        const newTasks = tasks.map(task => {
            if (task.id === taskId) {
                updatedTask = { ...task, ...updates, updatedAt: Date.now() };
                return updatedTask;
            }
            return task;
        });
        if (!updatedTask) throw new Error("Task not found");
        setItem(KEYS.TASKS, newTasks, this.tasksCache);
        return updatedTask;
    }

    /**
     * Delete task from cache and localStorage
     */
    deleteTask(taskId: string) {
        const tasks = this.fetchTasks();
        const newTasks = tasks.filter(t => t.id !== taskId);
        setItem(KEYS.TASKS, newTasks, this.tasksCache);
    }

    /**
     * Replace all tasks with new set in cache and localStorage
     */
    updateTasks(tasks: Task[]) {
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return tasks;
    }

    /**
     * Batch update tasks with deferred write for improved performance
     */
    async batchUpdateTasks(tasks: Task[]): Promise<void> {
        const currentTasks = this.fetchTasks();
        const updatesMap = new Map(tasks.map(t => [t.id, t]));

        const mergedTasks = currentTasks.map(t =>
            updatesMap.has(t.id) ? updatesMap.get(t.id)! : t
        );

        this.tasksCache.set(mergedTasks, true);
        this.pendingWrites.add(KEYS.TASKS);
        this.scheduleBatchFlush();
    }

    /**
     * Batch update lists with deferred write for improved performance
     */
    async batchUpdateLists(lists: List[]): Promise<void> {
        this.listsCache.set(lists, true);
        this.pendingWrites.add(KEYS.LISTS);
        this.scheduleBatchFlush();
    }

    /**
     * Schedule batch flush of pending writes
     */
    private scheduleBatchFlush(): void {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }

        this.flushTimeout = setTimeout(() => {
            this.flush();
        }, 100);
    }

    /**
     * Flush all pending writes to localStorage asynchronously
     */
    async flush(): Promise<void> {
        if (this.pendingWrites.size === 0) return;

        const writes = Array.from(this.pendingWrites);
        this.pendingWrites.clear();

        await Promise.all(
            writes.map(async (key) => {
                try {
                    let cache: MemoryCache<any> | undefined;

                    if (key === KEYS.TASKS) cache = this.tasksCache;
                    else if (key === KEYS.LISTS) cache = this.listsCache;
                    else if (key === KEYS.SUMMARIES) cache = this.summariesCache;
                    else if (key === KEYS.ECHO_REPORTS) cache = this.echoReportsCache;
                    else if (key === KEYS.APPEARANCE_SETTINGS) cache = this.appearanceCache;
                    else if (key === KEYS.PREFERENCES_SETTINGS) cache = this.preferencesCache;
                    else if (key === KEYS.AI_SETTINGS) cache = this.aiCache;
                    else if (key === KEYS.PROXY_SETTINGS) cache = this.proxyCache;

                    if (cache && cache.isDirtyFlag()) {
                        const value = cache.get();
                        if (value !== null) {
                            await new Promise<void>((resolve) => {
                                persistToStorage(key, value, cache);
                                resolve();
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to flush ${key}:`, error);
                }
            })
        );
    }

    /**
     * Flush all pending writes to localStorage synchronously for page unload
     */
    private flushSync(): void {
        const caches = [
            { key: KEYS.TASKS, cache: this.tasksCache },
            { key: KEYS.LISTS, cache: this.listsCache },
            { key: KEYS.SUMMARIES, cache: this.summariesCache },
            { key: KEYS.ECHO_REPORTS, cache: this.echoReportsCache },
            { key: KEYS.APPEARANCE_SETTINGS, cache: this.appearanceCache },
            { key: KEYS.PREFERENCES_SETTINGS, cache: this.preferencesCache },
            { key: KEYS.AI_SETTINGS, cache: this.aiCache },
            { key: KEYS.PROXY_SETTINGS, cache: this.proxyCache },
        ];

        caches.forEach(({ key, cache }) => {
            if (cache.isDirtyFlag()) {
                const value = cache.get();
                if (value !== null) {
                    try {
                        localStorage.setItem(key, JSON.stringify(value));
                        cache.clearDirty();
                    } catch (error) {
                        console.error(`Failed to sync flush ${key}:`, error);
                    }
                }
            }
        });
    }

    /**
     * Create a new subtask in cache and localStorage
     */
    createSubtask(taskId: string, subtaskData: { title: string, order: number, dueDate: number | null }) {
        const tasks = this.fetchTasks();
        const now = Date.now();
        const newSubtask: Subtask = {
            id: `subtask-${now}-${Math.random()}`,
            parentId: taskId,
            title: subtaskData.title,
            completed: false,
            completedAt: null,
            order: subtaskData.order,
            dueDate: subtaskData.dueDate,
            createdAt: now,
            updatedAt: now,
        };

        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) throw new Error("Parent task not found");

        if (!tasks[taskIndex].subtasks) {
            tasks[taskIndex].subtasks = [];
        }
        tasks[taskIndex].subtasks!.push(newSubtask);

        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return newSubtask;
    }

    /**
     * Update subtask in cache and localStorage
     */
    updateSubtask(subtaskId: string, updates: Partial<Subtask>) {
        const tasks = this.fetchTasks();
        let updatedSubtask: Subtask | undefined;

        for (const task of tasks) {
            if (task.subtasks) {
                const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
                if (subtaskIndex !== -1) {
                    updatedSubtask = { ...task.subtasks[subtaskIndex], ...updates, updatedAt: Date.now() };
                    task.subtasks[subtaskIndex] = updatedSubtask;
                    break;
                }
            }
        }
        if (!updatedSubtask) throw new Error("Subtask not found");
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return updatedSubtask;
    }

    /**
     * Delete subtask from cache and localStorage
     */
    deleteSubtask(subtaskId: string) {
        const tasks = this.fetchTasks();
        for (const task of tasks) {
            if (task.subtasks) {
                const initialLength = task.subtasks.length;
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                if (task.subtasks.length < initialLength) {
                    break;
                }
            }
        }
        setItem(KEYS.TASKS, tasks, this.tasksCache);
    }

    /**
     * Retrieve all summaries from cache or localStorage
     */
    fetchSummaries() {
        return getItem<StoredSummary[]>(KEYS.SUMMARIES, [], this.summariesCache);
    }

    /**
     * Create a new summary in cache and localStorage
     */
    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>) {
        const summaries = this.fetchSummaries();
        const now = Date.now();
        const newSummary: StoredSummary = {
            ...summaryData,
            id: `summary-${now}-${Math.random()}`,
            createdAt: now,
            updatedAt: now,
        };
        summaries.unshift(newSummary);
        setItem(KEYS.SUMMARIES, summaries, this.summariesCache);
        return newSummary;
    }

    /**
     * Update summary in cache and localStorage
     */
    updateSummary(summaryId: string, updates: Partial<StoredSummary>) {
        const summaries = this.fetchSummaries();
        let updatedSummary: StoredSummary | undefined;
        const newSummaries = summaries.map(s => {
            if (s.id === summaryId) {
                updatedSummary = { ...s, ...updates, updatedAt: Date.now() };
                return updatedSummary;
            }
            return s;
        });
        if (!updatedSummary) throw new Error("Summary not found");
        setItem(KEYS.SUMMARIES, newSummaries, this.summariesCache);
        return updatedSummary;
    }

    /**
     * Replace all summaries with new set in cache and localStorage
     */
    updateSummaries(summaries: StoredSummary[]) {
        setItem(KEYS.SUMMARIES, summaries, this.summariesCache);
        return summaries;
    }

    // Echo Reports
    fetchEchoReports() {
        return getItem<EchoReport[]>(KEYS.ECHO_REPORTS, [], this.echoReportsCache);
    }

    createEchoReport(reportData: Omit<EchoReport, 'id' | 'createdAt'>) {
        const reports = this.fetchEchoReports();
        const now = Date.now();
        const newReport: EchoReport = {
            ...reportData,
            id: `echo-${now}-${Math.random()}`,
            createdAt: now,
        };
        reports.unshift(newReport);
        setItem(KEYS.ECHO_REPORTS, reports, this.echoReportsCache);
        return newReport;
    }

    updateEchoReport(reportId: string, updates: Partial<EchoReport>) {
        const reports = this.fetchEchoReports();
        let updatedReport: EchoReport | undefined;
        const newReports = reports.map(r => {
            if (r.id === reportId) {
                updatedReport = { ...r, ...updates };
                return updatedReport;
            }
            return r;
        });
        if (!updatedReport) throw new Error("Echo report not found");
        setItem(KEYS.ECHO_REPORTS, newReports, this.echoReportsCache);
        return updatedReport;
    }

    deleteEchoReport(reportId: string) {
        const reports = this.fetchEchoReports();
        const newReports = reports.filter(r => r.id !== reportId);
        setItem(KEYS.ECHO_REPORTS, newReports, this.echoReportsCache);
    }

    // Import/Export
    exportData(): ExportedData {
        const settings = this.fetchSettings();
        const userProfile = this.fetchUserProfile();
        const lists = this.fetchLists();
        const tasks = this.fetchTasks();
        const summaries = this.fetchSummaries();
        const echoReports = this.fetchEchoReports();

        return {
            version: '1.0.0',
            exportedAt: Date.now(),
            platform: 'web',
            data: {
                settings,
                userProfile,
                lists,
                tasks,
                summaries,
                echoReports
            }
        };
    }

    /**
     * Analyze imported data for conflicts
     */
    analyzeImport(data: ExportedData, options: ImportOptions): DataConflict[] {
        const conflicts: DataConflict[] = [];

        if (!data || !data.data) {
            return conflicts;
        }

        // Check for list conflicts
        if (options.includeLists && data.data.lists) {
            const localLists = this.fetchLists();
            const localListsMap = new Map(localLists.map(list => [list.id, list]));

            data.data.lists.forEach(importedList => {
                const localList = localListsMap.get(importedList.id);
                if (localList) {
                    conflicts.push({
                        id: importedList.id,
                        type: 'list',
                        local: localList,
                        imported: importedList
                    });
                }
            });
        }

        // Check for task conflicts
        if (options.includeTasks && data.data.tasks) {
            const localTasks = this.fetchTasks();
            const localTasksMap = new Map(localTasks.map(task => [task.id, task]));

            data.data.tasks.forEach(importedTask => {
                const localTask = localTasksMap.get(importedTask.id);
                if (localTask) {
                    conflicts.push({
                        id: importedTask.id,
                        type: 'task',
                        local: localTask,
                        imported: importedTask
                    });
                }
            });
        }

        // Check for summary conflicts
        if (options.includeSummaries && data.data.summaries) {
            const localSummaries = this.fetchSummaries();
            const localSummariesMap = new Map(localSummaries.map(summary => [summary.id, summary]));

            data.data.summaries.forEach(importedSummary => {
                const localSummary = localSummariesMap.get(importedSummary.id);
                if (localSummary) {
                    conflicts.push({
                        id: importedSummary.id,
                        type: 'summary',
                        local: localSummary,
                        imported: importedSummary
                    });
                }
            });
        }

        if (options.includeEcho && data.data.echoReports) {
            const localReports = this.fetchEchoReports();
            const localReportsMap = new Map(localReports.map(report => [report.id, report]));

            data.data.echoReports.forEach(importedReport => {
                const localReport = localReportsMap.get(importedReport.id);
                if (localReport) {
                    conflicts.push({
                        id: importedReport.id,
                        type: 'echo',
                        local: localReport,
                        imported: importedReport
                    });
                }
            });
        }

        return conflicts;
    }

    /**
     * Import data into localStorage
     */
    importData(data: ExportedData, options: ImportOptions, conflictResolutions?: Map<string, ConflictResolution>): ImportResult {
        const result: ImportResult = {
            success: false,
            message: '',
            imported: {
                settings: 0,
                lists: 0,
                tasks: 0,
                summaries: 0,
                echo: 0
            },
            conflicts: [],
            errors: []
        };

        try {
            if (!data || !data.data) {
                throw new Error('Invalid import data format');
            }

            // Import settings
            if (options.includeSettings && data.data.settings) {
                if (data.data.settings.appearance) {
                    this.updateAppearanceSettings(data.data.settings.appearance);
                    result.imported.settings++;
                }
                if (data.data.settings.preferences) {
                    this.updatePreferencesSettings(data.data.settings.preferences);
                    result.imported.settings++;
                }
                if (data.data.settings.ai) {
                    this.updateAISettings(data.data.settings.ai);
                    result.imported.settings++;
                }
                if (data.data.settings.proxy) {
                    this.updateProxySettings(data.data.settings.proxy);
                    result.imported.settings++;
                }
            }

            // Import user profile along with settings
            if (options.includeSettings && data.data.userProfile) {
                this.updateUserProfile(data.data.userProfile);
                result.imported.settings++;
            }

            // Import lists
            if (options.includeLists && data.data.lists) {
                let lists = options.replaceAllData ? [] : this.fetchLists();
                const localListsMap = new Map(lists.map(list => [list.id, list]));

                data.data.lists.forEach(importedList => {
                    const existingList = localListsMap.get(importedList.id);
                    let shouldImport = true;
                    let listToImport = importedList;

                    if (existingList) {
                        const resolution = conflictResolutions?.get(importedList.id) || options.conflictResolution;
                        switch (resolution) {
                            case 'keep-local': shouldImport = false; break;
                            case 'keep-imported': listToImport = importedList; break;
                            case 'keep-newer': shouldImport = existingList.name !== importedList.name; break;
                            case 'skip': shouldImport = false; break;
                        }
                    }

                    if (shouldImport) {
                        if (existingList) {
                            const index = lists.findIndex(l => l.id === importedList.id);
                            lists[index] = listToImport;
                        } else {
                            lists.push(listToImport);
                        }
                        result.imported.lists++;
                    }
                });
                this.updateLists(lists);
            }

            // Import tasks
            if (options.includeTasks && data.data.tasks) {
                let tasks = options.replaceAllData ? [] : this.fetchTasks();
                const localTasksMap = new Map(tasks.map(task => [task.id, task]));

                data.data.tasks.forEach(importedTask => {
                    const existingTask = localTasksMap.get(importedTask.id);
                    let shouldImport = true;
                    let taskToImport = { ...importedTask, groupCategory: getTaskGroupCategory(importedTask) };

                    if (existingTask) {
                        const resolution = conflictResolutions?.get(importedTask.id) || options.conflictResolution;
                        switch (resolution) {
                            case 'keep-local': shouldImport = false; break;
                            case 'keep-imported': taskToImport = { ...importedTask, groupCategory: getTaskGroupCategory(importedTask) }; break;
                            case 'keep-newer': shouldImport = importedTask.updatedAt > existingTask.updatedAt; break;
                            case 'skip': shouldImport = false; break;
                        }
                    }

                    if (shouldImport) {
                        if (existingTask) {
                            const index = tasks.findIndex(t => t.id === importedTask.id);
                            tasks[index] = taskToImport;
                        } else {
                            tasks.push(taskToImport);
                        }
                        result.imported.tasks++;
                    }
                });
                this.updateTasks(tasks);
            }

            // Import summaries
            if (options.includeSummaries && data.data.summaries) {
                let summaries = options.replaceAllData ? [] : this.fetchSummaries();
                const localSummariesMap = new Map(summaries.map(summary => [summary.id, summary]));

                data.data.summaries.forEach(importedSummary => {
                    const existingSummary = localSummariesMap.get(importedSummary.id);
                    let shouldImport = true;
                    let summaryToImport = importedSummary;

                    if (existingSummary) {
                        const resolution = conflictResolutions?.get(importedSummary.id) || options.conflictResolution;
                        switch (resolution) {
                            case 'keep-local': shouldImport = false; break;
                            case 'keep-imported': summaryToImport = importedSummary; break;
                            case 'keep-newer': shouldImport = importedSummary.updatedAt > existingSummary.updatedAt; break;
                            case 'skip': shouldImport = false; break;
                        }
                    }

                    if (shouldImport) {
                        if (existingSummary) {
                            const index = summaries.findIndex(s => s.id === importedSummary.id);
                            summaries[index] = summaryToImport;
                        } else {
                            summaries.push(summaryToImport);
                        }
                        result.imported.summaries++;
                    }
                });
                this.updateSummaries(summaries);
            }

            if (options.includeEcho && data.data.echoReports) {
                let reports = options.replaceAllData ? [] : this.fetchEchoReports();
                const localReportsMap = new Map(reports.map(report => [report.id, report]));

                data.data.echoReports.forEach(importedReport => {
                    const existingReport = localReportsMap.get(importedReport.id);
                    let shouldImport = true;
                    let reportToImport = importedReport;

                    if (existingReport) {
                        const resolution = conflictResolutions?.get(importedReport.id) || options.conflictResolution;
                        if (resolution === 'keep-local' || resolution === 'skip') shouldImport = false;
                    }

                    if (shouldImport) {
                        if (existingReport) {
                            const index = reports.findIndex(r => r.id === importedReport.id);
                            reports[index] = reportToImport;
                        } else {
                            reports.push(reportToImport);
                        }
                        result.imported.echo++;
                    }
                });
                setItem(KEYS.ECHO_REPORTS, reports, this.echoReportsCache);
            }

            result.success = true;
            result.message = 'Data imported successfully';

        } catch (error) {
            result.success = false;
            result.message = error instanceof Error ? error.message : 'Import failed';
            result.errors.push(result.message);
        }

        return result;
    }
}