import Database from '@tauri-apps/plugin-sql';
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

interface DbTask {
    id: string;
    title: string;
    completed: number;
    completed_at: number | null;
    complete_percentage: number | null;
    due_date: number | null;
    list_id: string | null;
    list_name: string;
    content: string | null;
    order: number;
    created_at: number;
    updated_at: number;
    tags: string | null;
    priority: number | null;
    group_category: string;
}

interface DbSubtask {
    id: string;
    parent_id: string;
    title: string;
    completed: number;
    completed_at: number | null;
    due_date: number | null;
    order: number;
    created_at: number;
    updated_at: number;
}

interface DbList {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    order: number | null;
    created_at: number;
    updated_at: number;
}

interface DbSummary {
    id: string;
    created_at: number;
    updated_at: number;
    period_key: string;
    list_key: string;
    task_ids: string;
    summary_text: string;
}

interface DbEchoReport {
    id: string;
    created_at: number;
    content: string;
    job_types: string;
    style: string;
    user_input: string | null;
}

interface DbSetting {
    key: string;
    value: string;
    updated_at: number;
}

interface BatchOperation {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: any;
}

export class SqliteStorageService implements IStorageService {
    private db: Database | null = null;
    private listsCache: List[] = [];
    private tasksCache: Task[] = [];
    private summariesCache: StoredSummary[] = [];
    private echoReportsCache: EchoReport[] = [];
    private settingsCache: {
        appearance: AppearanceSettings;
        preferences: PreferencesSettings;
        ai: AISettings;
        proxy: ProxySettings;
    } | null = null;
    private userProfileCache: UserProfile | null = null;
    private isDataLoaded = false;

    private batchQueue: BatchOperation[] = [];
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 100;
    private readonly BATCH_SIZE = 50;

    private writeQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue = false;

    async initialize(): Promise<void> {
        try {
            this.db = await Database.load('sqlite:tada.db');
            console.log('Database connected successfully');

            await this.ensureIndexes();

            const lists = await this.db.select<DbList[]>('SELECT * FROM lists');
            if (lists.length === 0) {
                console.warn('No lists found! Creating default Inbox...');
                const now = Date.now();
                await this.db.execute(
                    'INSERT INTO lists (id, name, icon, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    ['inbox-default', 'Inbox', 'inbox', 1, now, now]
                );
            }
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    private async ensureIndexes(): Promise<void> {
        const db = this.getDb();
        try {
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_summaries_period_list ON summaries(period_key, list_key)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_echo_reports_created_at ON echo_reports(created_at)');
        } catch (error) {
            console.error('Failed to ensure indexes:', error);
        }
    }

    async preloadData(): Promise<void> {
        if (this.isDataLoaded) return;
        try {
            const [lists, tasks, summaries, echoReports, settings] = await Promise.all([
                this.fetchListsAsync(),
                this.fetchTasksAsync(),
                this.fetchSummariesAsync(),
                this.fetchEchoReportsAsync(),
                this.fetchSettingsAsync(),
                this.fetchUserProfileAsync()
            ]);
            this.listsCache = lists;
            this.tasksCache = tasks;
            this.summariesCache = summaries;
            this.echoReportsCache = echoReports;
            this.settingsCache = settings;
            this.isDataLoaded = true;
        } catch (error) {
            console.error('Failed to preload data:', error);
            throw error;
        }
    }

    private getDb(): Database {
        if (!this.db) throw new Error('Database not initialized.');
        return this.db;
    }

    private scheduleBatchProcess(): void {
        if (this.batchTimeout) clearTimeout(this.batchTimeout);
        this.batchTimeout = setTimeout(() => {
            this.processBatchQueue();
        }, this.BATCH_DELAY);
    }

    private async processBatchQueue(): Promise<void> {
        if (this.batchQueue.length === 0) return;
        const operations = this.batchQueue.splice(0, this.BATCH_SIZE);
        const db = this.getDb();
        try {
            await db.execute('BEGIN TRANSACTION');
            for (const op of operations) {
                try {
                    await this.executeOperation(op);
                } catch (error) {
                    console.error('Failed to execute batch operation:', op, error);
                }
            }
            await db.execute('COMMIT');
        } catch (error) {
            await db.execute('ROLLBACK');
            console.error('Batch processing failed:', error);
        }
        if (this.batchQueue.length > 0) {
            this.scheduleBatchProcess();
        }
    }

    private async executeOperation(op: BatchOperation): Promise<void> {
        const db = this.getDb();
        switch (op.type) {
            case 'insert':
                if (op.table === 'tasks') await this.insertTask(op.data);
                else if (op.table === 'lists') await this.insertList(op.data);
                break;
            case 'update':
                if (op.table === 'tasks') await this.updateTaskInDb(op.data.id, op.data.updates);
                else if (op.table === 'lists') await this.updateListInDb(op.data.id, op.data.updates);
                break;
            case 'delete':
                await db.execute(`DELETE FROM ${op.table} WHERE id = ?`, [op.data.id]);
                break;
        }
    }

    private async queueWrite(operation: () => Promise<void>): Promise<void> {
        this.writeQueue.push(operation);
        if (!this.isProcessingQueue) {
            this.processWriteQueue();
        }
    }

    private async processWriteQueue(): Promise<void> {
        this.isProcessingQueue = true;
        while (this.writeQueue.length > 0) {
            const operation = this.writeQueue.shift();
            if (operation) {
                try {
                    await operation();
                } catch (error) {
                    console.error('Write operation failed:', error);
                }
            }
        }
        this.isProcessingQueue = false;
    }

    // Settings
    fetchSettings() {
        if (!this.isDataLoaded || !this.settingsCache) {
            return {
                appearance: defaultAppearanceSettingsForApi(),
                preferences: defaultPreferencesSettingsForApi(),
                ai: defaultAISettingsForApi(),
                proxy: defaultProxySettingsForApi()
            };
        }
        return this.settingsCache;
    }

    async fetchSettingsAsync() {
        const db = this.getDb();
        const settings = await db.select<DbSetting[]>('SELECT * FROM settings WHERE key IN (?, ?, ?, ?)', ['appearance', 'preferences', 'ai', 'proxy']);
        const result = {
            appearance: defaultAppearanceSettingsForApi(),
            preferences: defaultPreferencesSettingsForApi(),
            ai: defaultAISettingsForApi(),
            proxy: defaultProxySettingsForApi()
        };
        settings.forEach(setting => {
            try {
                const parsed = JSON.parse(setting.value);
                if (setting.key === 'appearance') result.appearance = { ...result.appearance, ...parsed };
                else if (setting.key === 'preferences') result.preferences = { ...result.preferences, ...parsed };
                else if (setting.key === 'ai') result.ai = { ...result.ai, ...parsed };
                else if (setting.key === 'proxy') result.proxy = { ...result.proxy, ...parsed };
            } catch (error) {
                console.error(`Failed to parse setting ${setting.key}:`, error);
            }
        });
        this.settingsCache = result;
        return result;
    }

    updateAppearanceSettings(settings: AppearanceSettings): AppearanceSettings {
        if (this.settingsCache) this.settingsCache.appearance = settings;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['appearance', JSON.stringify(settings), now]);
        });
        return settings;
    }

    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings {
        if (this.settingsCache) this.settingsCache.preferences = settings;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['preferences', JSON.stringify(settings), now]);
        });
        return settings;
    }

    updateAISettings(settings: AISettings): AISettings {
        if (this.settingsCache) this.settingsCache.ai = settings;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['ai', JSON.stringify(settings), now]);
        });
        return settings;
    }

    updateProxySettings(settings: ProxySettings): ProxySettings {
        if (this.settingsCache) this.settingsCache.proxy = settings;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['proxy', JSON.stringify(settings), now]);
        });
        return settings;
    }

    // User Profile
    fetchUserProfile(): UserProfile | null {
        return this.userProfileCache;
    }

    async fetchUserProfileAsync(): Promise<UserProfile | null> {
        const db = this.getDb();
        const settings = await db.select<DbSetting[]>('SELECT * FROM settings WHERE key = ?', ['userProfile']);
        if (settings.length > 0) {
            try {
                const parsed = JSON.parse(settings[0].value) as UserProfile;
                this.userProfileCache = parsed;
                return parsed;
            } catch (error) {
                console.error('Failed to parse user profile:', error);
            }
        }
        return null;
    }

    updateUserProfile(profile: UserProfile): UserProfile {
        const updated = { ...profile, updatedAt: Date.now() };
        this.userProfileCache = updated;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['userProfile', JSON.stringify(updated), now]);
        });
        return updated;
    }

    // Lists
    fetchLists(): List[] {
        return this.listsCache;
    }

    async fetchListsAsync(): Promise<List[]> {
        const db = this.getDb();
        const dbLists = await db.select<DbList[]>('SELECT * FROM lists ORDER BY "order", name');
        const lists = dbLists.map(this.mapDbListToList);
        this.listsCache = lists;
        return lists;
    }

    createList(listData: { name: string; icon?: string }): List {
        const now = Date.now();
        const id = `list-${now}-${Math.random()}`;
        const newList: List = {
            id,
            name: listData.name,
            icon: listData.icon || 'list',
            color: null,
            order: now,
        };
        this.listsCache.push(newList);
        this.queueWrite(async () => { await this.insertList(newList); });
        return newList;
    }

    private async insertList(list: List): Promise<void> {
        const db = this.getDb();
        const now = Date.now();
        await db.execute(
            'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [list.id, list.name, list.icon, list.color, list.order, now, now]
        );
    }

    updateList(listId: string, updates: Partial<List>): List {
        const index = this.listsCache.findIndex(l => l.id === listId);
        if (index === -1) throw new Error("List not found");
        const originalName = this.listsCache[index].name;
        this.listsCache[index] = { ...this.listsCache[index], ...updates };

        this.queueWrite(async () => {
            await this.updateListInDb(listId, updates);
            if (updates.name && updates.name !== originalName) {
                const now = Date.now();
                await this.getDb().execute('UPDATE tasks SET list_name = ?, updated_at = ? WHERE list_id = ?', [updates.name, now, listId]);
                this.tasksCache.forEach(task => {
                    if (task.listId === listId) {
                        task.listName = updates.name!;
                        task.updatedAt = now;
                    }
                });
            }
        });
        return this.listsCache[index];
    }

    private async updateListInDb(listId: string, updates: Partial<List>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();
        const updateFields: string[] = [];
        const values: any[] = [];
        if (updates.name !== undefined) { updateFields.push('name = ?'); values.push(updates.name); }
        if (updates.icon !== undefined) { updateFields.push('icon = ?'); values.push(updates.icon); }
        if (updates.color !== undefined) { updateFields.push('color = ?'); values.push(updates.color); }
        if (updates.order !== undefined) { updateFields.push('"order" = ?'); values.push(updates.order); }
        if (updateFields.length === 0) return;
        updateFields.push('updated_at = ?');
        values.push(now, listId);
        await db.execute(`UPDATE lists SET ${updateFields.join(', ')} WHERE id = ?`, values);
    }

    deleteList(listId: string): { message: string } {
        const listToDelete = this.listsCache.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");
        const inbox = this.listsCache.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found");

        this.listsCache = this.listsCache.filter(l => l.id !== listId);
        this.tasksCache.forEach(task => {
            if (task.listId === listId) {
                if (task.listName === 'Trash') { task.listId = null; }
                else { task.listId = inbox.id; task.listName = inbox.name; }
                task.updatedAt = Date.now();
            }
        });

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute(`UPDATE tasks SET list_id = CASE WHEN list_name = 'Trash' THEN NULL ELSE ? END, list_name = CASE WHEN list_name = 'Trash' THEN list_name ELSE ? END, updated_at = ? WHERE list_id = ?`, [inbox.id, inbox.name, now, listId]);
                await db.execute('DELETE FROM lists WHERE id = ?', [listId]);
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                throw error;
            }
        });
        return { message: "List deleted" };
    }

    updateLists(lists: List[]): List[] {
        this.listsCache = lists;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM lists');
                for (const list of lists) {
                    await db.execute('INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [list.id, list.name, list.icon || null, list.color || null, list.order || 0, now, now]);
                }
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error(error);
            }
        });
        return lists;
    }

    // Tasks
    fetchTasks(): Task[] {
        return this.tasksCache;
    }

    async fetchTasksAsync(): Promise<Task[]> {
        const db = this.getDb();
        const [dbTasks, dbSubtasks] = await Promise.all([
            db.select<DbTask[]>('SELECT * FROM tasks ORDER BY "order", created_at'),
            db.select<DbSubtask[]>('SELECT * FROM subtasks ORDER BY parent_id, "order"')
        ]);
        const subtasksByParent: Record<string, Subtask[]> = {};
        dbSubtasks.forEach(dbSubtask => {
            const subtask = this.mapDbSubtaskToSubtask(dbSubtask);
            if (!subtasksByParent[dbSubtask.parent_id]) subtasksByParent[dbSubtask.parent_id] = [];
            subtasksByParent[dbSubtask.parent_id].push(subtask);
        });
        const tasks = dbTasks.map(dbTask => {
            const task = this.mapDbTaskToTask(dbTask);
            task.subtasks = subtasksByParent[task.id] || [];
            return task;
        });
        this.tasksCache = tasks;
        return tasks;
    }

    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task {
        const now = Date.now();
        const id = `task-${now}-${Math.random()}`;
        const newTask: Task = { ...taskData, id, createdAt: now, updatedAt: now, groupCategory: 'nodate' };
        this.tasksCache.push(newTask);
        this.queueWrite(async () => { await this.insertTask(newTask); });
        return newTask;
    }

    private async insertTask(task: Task): Promise<void> {
        const db = this.getDb();
        await db.execute(`
            INSERT INTO tasks (id, title, completed, completed_at, complete_percentage, due_date, list_id, list_name, content, "order", created_at, updated_at, tags, priority, group_category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            task.id, task.title, task.completed ? 1 : 0, task.completedAt, task.completePercentage, task.dueDate || null, task.listId, task.listName, task.content || null, task.order, task.createdAt, task.updatedAt, task.tags ? JSON.stringify(task.tags) : null, task.priority, task.groupCategory
        ]);
    }

    updateTask(taskId: string, updates: Partial<Task>): Task {
        const index = this.tasksCache.findIndex(t => t.id === taskId);
        if (index === -1) throw new Error("Task not found");
        const now = Date.now();
        this.tasksCache[index] = { ...this.tasksCache[index], ...updates, updatedAt: now };
        this.queueWrite(async () => { await this.updateTaskInDb(taskId, updates); });
        return this.tasksCache[index];
    }

    private async updateTaskInDb(taskId: string, updates: Partial<Task>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();
        const updateFields: string[] = [];
        const values: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            switch (key) {
                case 'title': updateFields.push('title = ?'); values.push(value); break;
                case 'completed': updateFields.push('completed = ?'); values.push(value ? 1 : 0); break;
                case 'completedAt': updateFields.push('completed_at = ?'); values.push(value); break;
                case 'completePercentage': updateFields.push('complete_percentage = ?'); values.push(value); break;
                case 'dueDate': updateFields.push('due_date = ?'); values.push(value); break;
                case 'listId': updateFields.push('list_id = ?'); values.push(value); break;
                case 'listName': updateFields.push('list_name = ?'); values.push(value); break;
                case 'content': updateFields.push('content = ?'); values.push(value); break;
                case 'order': updateFields.push('"order" = ?'); values.push(value); break;
                case 'tags': updateFields.push('tags = ?'); values.push(value ? JSON.stringify(value) : null); break;
                case 'priority': updateFields.push('priority = ?'); values.push(value); break;
                case 'groupCategory': updateFields.push('group_category = ?'); values.push(value); break;
            }
        });
        if (updateFields.length === 0) return;
        updateFields.push('updated_at = ?');
        values.push(now, taskId);
        await db.execute(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, values);
    }

    deleteTask(taskId: string): void {
        this.tasksCache = this.tasksCache.filter(t => t.id !== taskId);
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('DELETE FROM subtasks WHERE parent_id = ?', [taskId]);
            await db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        });
    }

    updateTasks(tasks: Task[]): Task[] {
        this.tasksCache = tasks;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM subtasks');
                await db.execute('DELETE FROM tasks');
                for (const task of tasks) {
                    await this.insertTask(task);
                    if (task.subtasks) {
                        for (const subtask of task.subtasks) {
                            await db.execute(`INSERT INTO subtasks (id, parent_id, title, completed, completed_at, due_date, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [subtask.id, subtask.parentId, subtask.title, subtask.completed ? 1 : 0, subtask.completedAt, subtask.dueDate || null, subtask.order, subtask.createdAt, subtask.updatedAt]);
                        }
                    }
                }
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error(error);
            }
        });
        return tasks;
    }

    async batchUpdateTasks(tasks: Task[]): Promise<void> {
        const updatesMap = new Map(tasks.map(t => [t.id, t]));
        this.tasksCache = this.tasksCache.map(t =>
            updatesMap.has(t.id) ? updatesMap.get(t.id)! : t
        );

        await this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                for (const task of tasks) {
                    await db.execute(`
                        INSERT OR REPLACE INTO tasks (
                            id, title, completed, completed_at, complete_percentage, due_date, 
                            list_id, list_name, content, "order", created_at, updated_at, 
                            tags, priority, group_category
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        task.id, task.title, task.completed ? 1 : 0, task.completedAt, task.completePercentage, task.dueDate || null, task.listId, task.listName, task.content || null, task.order, task.createdAt, task.updatedAt, task.tags ? JSON.stringify(task.tags) : null, task.priority, task.groupCategory
                    ]);
                }
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error(error);
            }
        });
    }

    async batchUpdateLists(lists: List[]): Promise<void> {
        this.listsCache = lists;
        await this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                for (const list of lists) {
                    await db.execute('INSERT OR REPLACE INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [list.id, list.name, list.icon || null, list.color || null, list.order || 0, now, now]);
                }
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error(error);
            }
        });
    }

    async flush(): Promise<void> {
        if (this.batchQueue.length > 0) {
            await this.processBatchQueue();
        }
        await this.processWriteQueue();
    }

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask {
        const now = Date.now();
        const id = `subtask-${now}-${Math.random()}`;
        const newSubtask: Subtask = { id, parentId: taskId, title: subtaskData.title, completed: false, completedAt: null, order: subtaskData.order, dueDate: subtaskData.dueDate, createdAt: now, updatedAt: now };

        const taskIndex = this.tasksCache.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            if (!this.tasksCache[taskIndex].subtasks) this.tasksCache[taskIndex].subtasks = [];
            this.tasksCache[taskIndex].subtasks!.push(newSubtask);
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`INSERT INTO subtasks (id, parent_id, title, completed, completed_at, due_date, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newSubtask.id, newSubtask.parentId, newSubtask.title, newSubtask.completed ? 1 : 0, newSubtask.completedAt, newSubtask.dueDate, newSubtask.order, newSubtask.createdAt, newSubtask.updatedAt]);
        });
        return newSubtask;
    }

    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask {
        const now = Date.now();
        let updatedSubtask: Subtask | undefined;
        for (const task of this.tasksCache) {
            if (task.subtasks) {
                const idx = task.subtasks.findIndex(s => s.id === subtaskId);
                if (idx !== -1) {
                    updatedSubtask = { ...task.subtasks[idx], ...updates, updatedAt: now };
                    task.subtasks[idx] = updatedSubtask;
                    break;
                }
            }
        }
        if (!updatedSubtask) throw new Error("Subtask not found");

        this.queueWrite(async () => {
            const db = this.getDb();
            const updateFields: string[] = [];
            const values: any[] = [];
            Object.entries(updates).forEach(([key, value]) => {
                switch (key) {
                    case 'title': updateFields.push('title = ?'); values.push(value); break;
                    case 'completed': updateFields.push('completed = ?'); values.push(value ? 1 : 0); break;
                    case 'completedAt': updateFields.push('completed_at = ?'); values.push(value); break;
                    case 'dueDate': updateFields.push('due_date = ?'); values.push(value); break;
                    case 'order': updateFields.push('"order" = ?'); values.push(value); break;
                }
            });
            if (updateFields.length > 0) {
                updateFields.push('updated_at = ?');
                values.push(now, subtaskId);
                await db.execute(`UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`, values);
            }
        });
        return updatedSubtask;
    }

    deleteSubtask(subtaskId: string): void {
        for (const task of this.tasksCache) {
            if (task.subtasks) {
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
            }
        }
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
        });
    }

    // Summaries
    fetchSummaries(): StoredSummary[] {
        return this.summariesCache;
    }

    async fetchSummariesAsync(): Promise<StoredSummary[]> {
        const db = this.getDb();
        const dbSummaries = await db.select<DbSummary[]>('SELECT * FROM summaries ORDER BY created_at DESC');
        const summaries = dbSummaries.map(this.mapDbSummaryToSummary);
        this.summariesCache = summaries;
        return summaries;
    }

    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary {
        const now = Date.now();
        const id = `summary-${now}-${Math.random()}`;
        const newSummary: StoredSummary = { ...summaryData, id, createdAt: now, updatedAt: now };
        this.summariesCache.unshift(newSummary);
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`INSERT INTO summaries (id, created_at, updated_at, period_key, list_key, task_ids, summary_text) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newSummary.id, newSummary.createdAt, newSummary.updatedAt, newSummary.periodKey, newSummary.listKey, JSON.stringify(newSummary.taskIds), newSummary.summaryText]);
        });
        return newSummary;
    }

    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary {
        const now = Date.now();
        const index = this.summariesCache.findIndex(s => s.id === summaryId);
        if (index === -1) throw new Error("Summary not found");
        this.summariesCache[index] = { ...this.summariesCache[index], ...updates, updatedAt: now };
        this.queueWrite(async () => {
            const db = this.getDb();
            const updateFields: string[] = [];
            const values: any[] = [];
            Object.entries(updates).forEach(([key, value]) => {
                switch (key) {
                    case 'periodKey': updateFields.push('period_key = ?'); values.push(value); break;
                    case 'listKey': updateFields.push('list_key = ?'); values.push(value); break;
                    case 'taskIds': updateFields.push('task_ids = ?'); values.push(JSON.stringify(value)); break;
                    case 'summaryText': updateFields.push('summary_text = ?'); values.push(value); break;
                }
            });
            if (updateFields.length > 0) {
                updateFields.push('updated_at = ?');
                values.push(now, summaryId);
                await db.execute(`UPDATE summaries SET ${updateFields.join(', ')} WHERE id = ?`, values);
            }
        });
        return this.summariesCache[index];
    }

    updateSummaries(summaries: StoredSummary[]): StoredSummary[] {
        this.summariesCache = summaries;
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM summaries');
                for (const summary of summaries) {
                    await db.execute(`INSERT INTO summaries (id, created_at, updated_at, period_key, list_key, task_ids, summary_text) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [summary.id, summary.createdAt, summary.updatedAt, summary.periodKey, summary.listKey, JSON.stringify(summary.taskIds), summary.summaryText]);
                }
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error(error);
            }
        });
        return summaries;
    }

    // Echo Reports
    fetchEchoReports(): EchoReport[] {
        return this.echoReportsCache;
    }

    async fetchEchoReportsAsync(): Promise<EchoReport[]> {
        const db = this.getDb();
        const dbReports = await db.select<DbEchoReport[]>('SELECT * FROM echo_reports ORDER BY created_at DESC');
        const reports = dbReports.map(this.mapDbEchoToEcho);
        this.echoReportsCache = reports;
        return reports;
    }

    createEchoReport(reportData: Omit<EchoReport, 'id' | 'createdAt'>): EchoReport {
        const now = Date.now();
        const id = `echo-${now}-${Math.random()}`;
        const newReport: EchoReport = { ...reportData, id, createdAt: now };
        this.echoReportsCache.unshift(newReport);
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`INSERT INTO echo_reports (id, created_at, content, job_types, style, user_input) VALUES (?, ?, ?, ?, ?, ?)`,
                [newReport.id, newReport.createdAt, newReport.content, JSON.stringify(newReport.jobTypes), newReport.style, newReport.userInput || null]);
        });
        return newReport;
    }

    updateEchoReport(reportId: string, updates: Partial<EchoReport>): EchoReport {
        const index = this.echoReportsCache.findIndex(r => r.id === reportId);
        if (index === -1) throw new Error("Report not found");
        this.echoReportsCache[index] = { ...this.echoReportsCache[index], ...updates };
        this.queueWrite(async () => {
            const db = this.getDb();
            const updateFields: string[] = [];
            const values: any[] = [];
            Object.entries(updates).forEach(([key, value]) => {
                switch (key) {
                    case 'content': updateFields.push('content = ?'); values.push(value); break;
                    case 'jobTypes': updateFields.push('job_types = ?'); values.push(JSON.stringify(value)); break;
                    case 'style': updateFields.push('style = ?'); values.push(value); break;
                    case 'userInput': updateFields.push('user_input = ?'); values.push(value); break;
                }
            });
            if (updateFields.length > 0) {
                values.push(reportId);
                await db.execute(`UPDATE echo_reports SET ${updateFields.join(', ')} WHERE id = ?`, values);
            }
        });
        return this.echoReportsCache[index];
    }

    deleteEchoReport(reportId: string): void {
        this.echoReportsCache = this.echoReportsCache.filter(r => r.id !== reportId);
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('DELETE FROM echo_reports WHERE id = ?', [reportId]);
        });
    }

    exportData(): ExportedData {
        return {
            version: '1.0.0',
            exportedAt: Date.now(),
            platform: 'desktop',
            data: {
                settings: this.fetchSettings(),
                userProfile: this.fetchUserProfile(),
                lists: this.fetchLists(),
                tasks: this.fetchTasks(),
                summaries: this.fetchSummaries(),
                echoReports: this.fetchEchoReports()
            }
        };
    }

    analyzeImport(data: ExportedData, options: ImportOptions): DataConflict[] {
        const conflicts: DataConflict[] = [];
        if (!data || !data.data) return conflicts;

        if (options.includeLists && data.data.lists) {
            const localLists = this.fetchLists();
            const localListsMap = new Map(localLists.map(list => [list.id, list]));
            data.data.lists.forEach(importedList => {
                const localList = localListsMap.get(importedList.id);
                if (localList) conflicts.push({ id: importedList.id, type: 'list', local: localList, imported: importedList });
            });
        }
        if (options.includeTasks && data.data.tasks) {
            const localTasks = this.fetchTasks();
            const localTasksMap = new Map(localTasks.map(task => [task.id, task]));
            data.data.tasks.forEach(importedTask => {
                const localTask = localTasksMap.get(importedTask.id);
                if (localTask) conflicts.push({ id: importedTask.id, type: 'task', local: localTask, imported: importedTask });
            });
        }
        if (options.includeSummaries && data.data.summaries) {
            const localSummaries = this.fetchSummaries();
            const localSummariesMap = new Map(localSummaries.map(summary => [summary.id, summary]));
            data.data.summaries.forEach(importedSummary => {
                const localSummary = localSummariesMap.get(importedSummary.id);
                if (localSummary) conflicts.push({ id: importedSummary.id, type: 'summary', local: localSummary, imported: importedSummary });
            });
        }
        if (options.includeEcho && data.data.echoReports) {
            const localReports = this.fetchEchoReports();
            const localReportsMap = new Map(localReports.map(report => [report.id, report]));
            data.data.echoReports.forEach(importedReport => {
                const localReport = localReportsMap.get(importedReport.id);
                if (localReport) conflicts.push({ id: importedReport.id, type: 'echo', local: localReport, imported: importedReport });
            });
        }
        return conflicts;
    }

    importData(data: ExportedData, options: ImportOptions, conflictResolutions?: Map<string, ConflictResolution>): ImportResult {
        const result: ImportResult = { success: false, message: '', imported: { settings: 0, lists: 0, tasks: 0, summaries: 0, echo: 0 }, conflicts: [], errors: [] };
        try {
            if (!data || !data.data) throw new Error('Invalid import data format');

            if (options.includeSettings && data.data.settings) {
                if (data.data.settings.appearance) { this.updateAppearanceSettings(data.data.settings.appearance); result.imported.settings++; }
                if (data.data.settings.preferences) { this.updatePreferencesSettings(data.data.settings.preferences); result.imported.settings++; }
                if (data.data.settings.ai) { this.updateAISettings(data.data.settings.ai); result.imported.settings++; }
                if (data.data.settings.proxy) { this.updateProxySettings(data.data.settings.proxy); result.imported.settings++; }
            }

            // Import user profile along with settings
            if (options.includeSettings && data.data.userProfile) {
                this.updateUserProfile(data.data.userProfile);
                result.imported.settings++;
            }

            if (options.includeLists && data.data.lists) {
                let lists = options.replaceAllData ? [] : this.fetchLists();
                const localListsMap = new Map(lists.map(list => [list.id, list]));
                data.data.lists.forEach(importedList => {
                    const existingList = localListsMap.get(importedList.id);
                    let shouldImport = true;
                    let listToImport = importedList;
                    if (existingList) {
                        const resolution = conflictResolutions?.get(importedList.id) || options.conflictResolution;
                        if (resolution === 'keep-local') shouldImport = false;
                        else if (resolution === 'keep-newer') shouldImport = existingList.name !== importedList.name;
                        else if (resolution === 'skip') shouldImport = false;
                    }
                    if (shouldImport) {
                        if (existingList) lists[lists.findIndex(l => l.id === importedList.id)] = listToImport;
                        else lists.push(listToImport);
                        result.imported.lists++;
                    }
                });
                this.updateLists(lists);
            }

            if (options.includeTasks && data.data.tasks) {
                let tasks = options.replaceAllData ? [] : this.fetchTasks();
                const localTasksMap = new Map(tasks.map(task => [task.id, task]));
                data.data.tasks.forEach(importedTask => {
                    const existingTask = localTasksMap.get(importedTask.id);
                    let shouldImport = true;
                    let taskToImport = { ...importedTask, groupCategory: getTaskGroupCategory(importedTask) };
                    if (existingTask) {
                        const resolution = conflictResolutions?.get(importedTask.id) || options.conflictResolution;
                        if (resolution === 'keep-local') shouldImport = false;
                        else if (resolution === 'keep-newer') shouldImport = importedTask.updatedAt > existingTask.updatedAt;
                        else if (resolution === 'skip') shouldImport = false;
                    }
                    if (shouldImport) {
                        if (existingTask) tasks[tasks.findIndex(t => t.id === importedTask.id)] = taskToImport;
                        else tasks.push(taskToImport);
                        result.imported.tasks++;
                    }
                });
                this.updateTasks(tasks);
            }

            if (options.includeSummaries && data.data.summaries) {
                let summaries = options.replaceAllData ? [] : this.fetchSummaries();
                const localSummariesMap = new Map(summaries.map(summary => [summary.id, summary]));
                data.data.summaries.forEach(importedSummary => {
                    const existingSummary = localSummariesMap.get(importedSummary.id);
                    let shouldImport = true;
                    let summaryToImport = importedSummary;
                    if (existingSummary) {
                        const resolution = conflictResolutions?.get(importedSummary.id) || options.conflictResolution;
                        if (resolution === 'keep-local') shouldImport = false;
                        else if (resolution === 'keep-newer') shouldImport = importedSummary.updatedAt > existingSummary.updatedAt;
                        else if (resolution === 'skip') shouldImport = false;
                    }
                    if (shouldImport) {
                        if (existingSummary) summaries[summaries.findIndex(s => s.id === importedSummary.id)] = summaryToImport;
                        else summaries.push(summaryToImport);
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
                        if (existingReport) reports[reports.findIndex(r => r.id === importedReport.id)] = reportToImport;
                        else reports.push(reportToImport);
                        result.imported.echo++;
                    }
                });
                this.echoReportsCache = reports;
                this.queueWrite(async () => {
                    const db = this.getDb();
                    await db.execute('BEGIN TRANSACTION');
                    await db.execute('DELETE FROM echo_reports');
                    for (const report of reports) {
                        await db.execute(`INSERT INTO echo_reports (id, created_at, content, job_types, style, user_input) VALUES (?, ?, ?, ?, ?, ?)`,
                            [report.id, report.createdAt, report.content, JSON.stringify(report.jobTypes), report.style, report.userInput || null]);
                    }
                    await db.execute('COMMIT');
                });
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

    private mapDbListToList(dbList: DbList): List {
        return { id: dbList.id, name: dbList.name, icon: dbList.icon, color: dbList.color, order: dbList.order };
    }

    private mapDbTaskToTask(dbTask: DbTask): Task {
        return {
            id: dbTask.id, title: dbTask.title, completed: Boolean(dbTask.completed), completedAt: dbTask.completed_at,
            completePercentage: dbTask.complete_percentage, dueDate: dbTask.due_date, listId: dbTask.list_id,
            listName: dbTask.list_name, content: dbTask.content || undefined, order: dbTask.order,
            createdAt: dbTask.created_at, updatedAt: dbTask.updated_at, tags: dbTask.tags ? JSON.parse(dbTask.tags) : undefined,
            priority: dbTask.priority, groupCategory: dbTask.group_category as any, subtasks: []
        };
    }

    private mapDbSubtaskToSubtask(dbSubtask: DbSubtask): Subtask {
        return {
            id: dbSubtask.id, parentId: dbSubtask.parent_id, title: dbSubtask.title, completed: Boolean(dbSubtask.completed),
            completedAt: dbSubtask.completed_at, dueDate: dbSubtask.due_date, order: dbSubtask.order,
            createdAt: dbSubtask.created_at, updatedAt: dbSubtask.updated_at
        };
    }

    private mapDbSummaryToSummary(dbSummary: DbSummary): StoredSummary {
        return {
            id: dbSummary.id, createdAt: dbSummary.created_at, updatedAt: dbSummary.updated_at,
            periodKey: dbSummary.period_key, listKey: dbSummary.list_key, taskIds: JSON.parse(dbSummary.task_ids),
            summaryText: dbSummary.summary_text
        };
    }

    private mapDbEchoToEcho(dbEcho: DbEchoReport): EchoReport {
        return {
            id: dbEcho.id, createdAt: dbEcho.created_at, content: dbEcho.content,
            jobTypes: JSON.parse(dbEcho.job_types), style: dbEcho.style as any, userInput: dbEcho.user_input || undefined
        };
    }
}