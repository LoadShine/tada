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
    ConflictResolution
} from '@tada/core/types';
import {
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    defaultPreferencesSettingsForApi,
    getTaskGroupCategory
} from '@tada/core/store/jotai';

/**
 * Database representation of a task record
 */
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

/**
 * Database representation of a subtask record
 */
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

/**
 * Database representation of a list record
 */
interface DbList {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    order: number | null;
    created_at: number;
    updated_at: number;
}

/**
 * Database representation of a summary record
 */
interface DbSummary {
    id: string;
    created_at: number;
    updated_at: number;
    period_key: string;
    list_key: string;
    task_ids: string;
    summary_text: string;
}

/**
 * Database representation of a settings record
 */
interface DbSetting {
    key: string;
    value: string;
    updated_at: number;
}

/**
 * Represents a single batch operation to be executed
 */
interface BatchOperation {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: any;
}

/**
 * SQLite storage service implementation for desktop application
 * Provides persistent data storage with in-memory caching for performance
 */
export class SqliteStorageService implements IStorageService {
    private db: Database | null = null;
    private listsCache: List[] = [];
    private tasksCache: Task[] = [];
    private summariesCache: StoredSummary[] = [];
    private settingsCache: {
        appearance: AppearanceSettings;
        preferences: PreferencesSettings;
        ai: AISettings;
    } | null = null;
    private isDataLoaded = false;

    private batchQueue: BatchOperation[] = [];
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 100;
    private readonly BATCH_SIZE = 50;

    private writeQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue = false;

    /**
     * Initialize database connection and verify data integrity
     */
    async initialize(): Promise<void> {
        try {
            this.db = await Database.load('sqlite:tada.db');
            console.log('Database connected successfully');

            await this.ensureIndexes();

            const lists = await this.db.select<DbList[]>('SELECT * FROM lists');
            console.log('Lists in database:', lists);

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

    /**
     * Ensure all required database indexes exist
     */
    private async ensureIndexes(): Promise<void> {
        const db = this.getDb();

        try {
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_summaries_period_list ON summaries(period_key, list_key)');
        } catch (error) {
            console.error('Failed to ensure indexes:', error);
        }
    }

    /**
     * Preload all data from database into memory cache
     */
    async preloadData(): Promise<void> {
        if (this.isDataLoaded) return;

        try {
            const [lists, tasks, summaries, settings] = await Promise.all([
                this.fetchListsAsync(),
                this.fetchTasksAsync(),
                this.fetchSummariesAsync(),
                this.fetchSettingsAsync()
            ]);

            this.listsCache = lists;
            this.tasksCache = tasks;
            this.summariesCache = summaries;
            this.settingsCache = settings;
            this.isDataLoaded = true;

            console.log('Data preloaded:', {
                lists: this.listsCache.length,
                tasks: this.tasksCache.length,
                summaries: this.summariesCache.length,
                settings: this.settingsCache
            });
        } catch (error) {
            console.error('Failed to preload data:', error);
            throw error;
        }
    }

    /**
     * Get database instance or throw if not initialized
     */
    private getDb(): Database {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    /**
     * Schedule batch processing of queued operations
     */
    private scheduleBatchProcess(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.processBatchQueue();
        }, this.BATCH_DELAY);
    }

    /**
     * Process queued batch operations within a transaction
     */
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

    /**
     * Execute a single batch operation
     */
    private async executeOperation(op: BatchOperation): Promise<void> {
        const db = this.getDb();

        switch (op.type) {
            case 'insert':
                if (op.table === 'tasks') {
                    await this.insertTask(op.data);
                } else if (op.table === 'lists') {
                    await this.insertList(op.data);
                }
                break;
            case 'update':
                if (op.table === 'tasks') {
                    await this.updateTaskInDb(op.data.id, op.data.updates);
                } else if (op.table === 'lists') {
                    await this.updateListInDb(op.data.id, op.data.updates);
                }
                break;
            case 'delete':
                await db.execute(`DELETE FROM ${op.table} WHERE id = ?`, [op.data.id]);
                break;
        }
    }

    /**
     * Add write operation to queue for sequential processing
     */
    private async queueWrite(operation: () => Promise<void>): Promise<void> {
        this.writeQueue.push(operation);

        if (!this.isProcessingQueue) {
            this.processWriteQueue();
        }
    }

    /**
     * Process all queued write operations sequentially
     */
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

    /**
     * Get settings from cache or return defaults
     */
    fetchSettings() {
        if (!this.isDataLoaded || !this.settingsCache) {
            console.warn('Settings not yet loaded, returning defaults');
            return {
                appearance: defaultAppearanceSettingsForApi(),
                preferences: defaultPreferencesSettingsForApi(),
                ai: defaultAISettingsForApi(),
            };
        }
        return this.settingsCache;
    }

    /**
     * Load settings from database asynchronously
     */
    async fetchSettingsAsync() {
        const db = this.getDb();

        const settings = await db.select<DbSetting[]>('SELECT * FROM settings WHERE key IN (?, ?, ?)', ['appearance', 'preferences', 'ai']);

        const result = {
            appearance: defaultAppearanceSettingsForApi(),
            preferences: defaultPreferencesSettingsForApi(),
            ai: defaultAISettingsForApi(),
        };

        settings.forEach(setting => {
            try {
                const parsed = JSON.parse(setting.value);
                if (setting.key === 'appearance') {
                    result.appearance = { ...result.appearance, ...parsed };
                } else if (setting.key === 'preferences') {
                    result.preferences = { ...result.preferences, ...parsed };
                } else if (setting.key === 'ai') {
                    result.ai = { ...result.ai, ...parsed };
                }
            } catch (error) {
                console.error(`Failed to parse setting ${setting.key}:`, error);
            }
        });

        this.settingsCache = result;
        return result;
    }

    /**
     * Update appearance settings in cache and database
     */
    updateAppearanceSettings(settings: AppearanceSettings): AppearanceSettings {
        if (this.settingsCache) {
            this.settingsCache.appearance = settings;
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['appearance', JSON.stringify(settings), now]
            );
        });

        return settings;
    }

    /**
     * Update preferences settings in cache and database
     */
    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings {
        if (this.settingsCache) {
            this.settingsCache.preferences = settings;
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['preferences', JSON.stringify(settings), now]
            );
        });

        return settings;
    }

    /**
     * Update AI settings in cache and database
     */
    updateAISettings(settings: AISettings): AISettings {
        if (this.settingsCache) {
            this.settingsCache.ai = settings;
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['ai', JSON.stringify(settings), now]
            );
        });

        return settings;
    }

    /**
     * Get lists from cache
     */
    fetchLists(): List[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.listsCache;
    }

    /**
     * Load lists from database asynchronously
     */
    async fetchListsAsync(): Promise<List[]> {
        const db = this.getDb();

        try {
            const dbLists = await db.select<DbList[]>('SELECT * FROM lists ORDER BY "order", name');
            const lists = dbLists.map(this.mapDbListToList);
            this.listsCache = lists;
            return lists;
        } catch (error) {
            console.error('Failed to fetch lists:', error);
            return [];
        }
    }

    /**
     * Create a new list in cache and database
     */
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

        this.queueWrite(async () => {
            await this.insertList(newList);
        });

        return newList;
    }

    /**
     * Insert list record into database
     */
    private async insertList(list: List): Promise<void> {
        const db = this.getDb();
        const now = Date.now();
        await db.execute(
            'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [list.id, list.name, list.icon, list.color, list.order, now, now]
        );
    }

    /**
     * Update list in cache and database, propagating name changes to tasks
     */
    updateList(listId: string, updates: Partial<List>): List {
        const index = this.listsCache.findIndex(l => l.id === listId);
        if (index === -1) throw new Error("List not found");

        const originalName = this.listsCache[index].name;
        this.listsCache[index] = { ...this.listsCache[index], ...updates };

        this.queueWrite(async () => {
            await this.updateListInDb(listId, updates);

            if (updates.name && updates.name !== originalName) {
                const now = Date.now();
                await this.getDb().execute(
                    'UPDATE tasks SET list_name = ?, updated_at = ? WHERE list_id = ?',
                    [updates.name, now, listId]
                );

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

    /**
     * Update list record in database
     */
    private async updateListInDb(listId: string, updates: Partial<List>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();

        const updateFields = [];
        const values = [];

        if (updates.name !== undefined) {
            updateFields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.icon !== undefined) {
            updateFields.push('icon = ?');
            values.push(updates.icon);
        }
        if (updates.color !== undefined) {
            updateFields.push('color = ?');
            values.push(updates.color);
        }
        if (updates.order !== undefined) {
            updateFields.push('"order" = ?');
            values.push(updates.order);
        }

        if (updateFields.length === 0) return;

        updateFields.push('updated_at = ?');
        values.push(now, listId);

        await db.execute(
            `UPDATE lists SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * Delete list and move its tasks to Inbox or set to null for Trash items
     */
    deleteList(listId: string): { message: string } {
        const listToDelete = this.listsCache.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

        const inbox = this.listsCache.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found, cannot delete list.");

        this.listsCache = this.listsCache.filter(l => l.id !== listId);

        this.tasksCache.forEach(task => {
            if (task.listId === listId) {
                if (task.listName === 'Trash') {
                    task.listId = null;
                } else {
                    task.listId = inbox.id;
                    task.listName = inbox.name;
                }
                task.updatedAt = Date.now();
            }
        });

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute(`
                    UPDATE tasks 
                    SET list_id = CASE 
                        WHEN list_name = 'Trash' THEN NULL 
                        ELSE ?
                    END,
                    list_name = CASE 
                        WHEN list_name = 'Trash' THEN list_name
                        ELSE ?
                    END,
                    updated_at = ?
                    WHERE list_id = ?
                `, [inbox.id, inbox.name, now, listId]);

                await db.execute('DELETE FROM lists WHERE id = ?', [listId]);

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                throw error;
            }
        });

        return { message: "List deleted successfully" };
    }

    /**
     * Replace all lists with new set in cache and database
     */
    updateLists(lists: List[]): List[] {
        this.listsCache = lists;

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM lists');

                for (const list of lists) {
                    await db.execute(
                        'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [list.id, list.name, list.icon || null, list.color || null, list.order || 0, now, now]
                    );
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update lists:', error);
            }
        });

        return lists;
    }

    /**
     * Get tasks from cache
     */
    fetchTasks(): Task[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.tasksCache;
    }

    /**
     * Load tasks and subtasks from database asynchronously
     */
    async fetchTasksAsync(): Promise<Task[]> {
        const db = this.getDb();

        try {
            const [dbTasks, dbSubtasks] = await Promise.all([
                db.select<DbTask[]>('SELECT * FROM tasks ORDER BY "order", created_at'),
                db.select<DbSubtask[]>('SELECT * FROM subtasks ORDER BY parent_id, "order"')
            ]);

            const subtasksByParent: Record<string, Subtask[]> = {};
            dbSubtasks.forEach(dbSubtask => {
                const subtask = this.mapDbSubtaskToSubtask(dbSubtask);
                if (!subtasksByParent[dbSubtask.parent_id]) {
                    subtasksByParent[dbSubtask.parent_id] = [];
                }
                subtasksByParent[dbSubtask.parent_id].push(subtask);
            });

            const tasks = dbTasks.map(dbTask => {
                const task = this.mapDbTaskToTask(dbTask);
                task.subtasks = subtasksByParent[task.id] || [];
                return task;
            });

            this.tasksCache = tasks;
            return tasks;
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            return [];
        }
    }

    /**
     * Create a new task in cache and database
     */
    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task {
        const now = Date.now();
        const id = `task-${now}-${Math.random()}`;

        const newTask: Task = {
            ...taskData,
            id,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };

        this.tasksCache.push(newTask);

        this.queueWrite(async () => {
            await this.insertTask(newTask);
        });

        return newTask;
    }

    /**
     * Insert task record into database
     */
    private async insertTask(task: Task): Promise<void> {
        const db = this.getDb();
        await db.execute(`
            INSERT INTO tasks (
                id, title, completed, completed_at, complete_percentage, due_date, 
                list_id, list_name, content, "order", created_at, updated_at, 
                tags, priority, group_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            task.id,
            task.title,
            task.completed ? 1 : 0,
            task.completedAt,
            task.completePercentage,
            task.dueDate || null,
            task.listId,
            task.listName,
            task.content || null,
            task.order,
            task.createdAt,
            task.updatedAt,
            task.tags ? JSON.stringify(task.tags) : null,
            task.priority,
            task.groupCategory
        ]);
    }

    /**
     * Update task in cache and database
     */
    updateTask(taskId: string, updates: Partial<Task>): Task {
        const index = this.tasksCache.findIndex(t => t.id === taskId);
        if (index === -1) throw new Error("Task not found");

        const now = Date.now();
        this.tasksCache[index] = { ...this.tasksCache[index], ...updates, updatedAt: now };

        this.queueWrite(async () => {
            await this.updateTaskInDb(taskId, updates);
        });

        return this.tasksCache[index];
    }

    /**
     * Update task record in database
     */
    private async updateTaskInDb(taskId: string, updates: Partial<Task>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();

        const updateFields = [];
        const values = [];

        Object.entries(updates).forEach(([key, value]) => {
            switch (key) {
                case 'title':
                    updateFields.push('title = ?');
                    values.push(value);
                    break;
                case 'completed':
                    updateFields.push('completed = ?');
                    values.push(value ? 1 : 0);
                    break;
                case 'completedAt':
                    updateFields.push('completed_at = ?');
                    values.push(value);
                    break;
                case 'completePercentage':
                    updateFields.push('complete_percentage = ?');
                    values.push(value);
                    break;
                case 'dueDate':
                    updateFields.push('due_date = ?');
                    values.push(value);
                    break;
                case 'listId':
                    updateFields.push('list_id = ?');
                    values.push(value);
                    break;
                case 'listName':
                    updateFields.push('list_name = ?');
                    values.push(value);
                    break;
                case 'content':
                    updateFields.push('content = ?');
                    values.push(value);
                    break;
                case 'order':
                    updateFields.push('"order" = ?');
                    values.push(value);
                    break;
                case 'tags':
                    updateFields.push('tags = ?');
                    values.push(value ? JSON.stringify(value) : null);
                    break;
                case 'priority':
                    updateFields.push('priority = ?');
                    values.push(value);
                    break;
                case 'groupCategory':
                    updateFields.push('group_category = ?');
                    values.push(value);
                    break;
            }
        });

        if (updateFields.length === 0) return;

        updateFields.push('updated_at = ?');
        values.push(now, taskId);

        await db.execute(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * Delete task and its subtasks from cache and database
     */
    deleteTask(taskId: string): void {
        this.tasksCache = this.tasksCache.filter(t => t.id !== taskId);

        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM subtasks WHERE parent_id = ?', [taskId]);
                await db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                throw error;
            }
        });
    }

    /**
     * Replace all tasks with new set in cache and database
     */
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
                    await db.execute(`
                        INSERT INTO tasks (
                            id, title, completed, completed_at, complete_percentage, due_date, 
                            list_id, list_name, content, "order", created_at, updated_at, 
                            tags, priority, group_category
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        task.id,
                        task.title,
                        task.completed ? 1 : 0,
                        task.completedAt,
                        task.completePercentage,
                        task.dueDate || null,
                        task.listId,
                        task.listName,
                        task.content || null,
                        task.order,
                        task.createdAt || now,
                        task.updatedAt || now,
                        task.tags ? JSON.stringify(task.tags) : null,
                        task.priority,
                        task.groupCategory
                    ]);

                    if (task.subtasks) {
                        for (const subtask of task.subtasks) {
                            await db.execute(`
                                INSERT INTO subtasks (
                                    id, parent_id, title, completed, completed_at, 
                                    due_date, "order", created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                subtask.id,
                                subtask.parentId,
                                subtask.title,
                                subtask.completed ? 1 : 0,
                                subtask.completedAt,
                                subtask.dueDate || null,
                                subtask.order,
                                subtask.createdAt,
                                subtask.updatedAt
                            ]);
                        }
                    }
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update tasks:', error);
            }
        });

        return tasks;
    }

    /**
     * Batch update tasks using transaction for improved performance
     */
    async batchUpdateTasks(tasks: Task[]): Promise<void> {
        this.tasksCache = tasks;

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
                        task.id,
                        task.title,
                        task.completed ? 1 : 0,
                        task.completedAt,
                        task.completePercentage,
                        task.dueDate || null,
                        task.listId,
                        task.listName,
                        task.content || null,
                        task.order,
                        task.createdAt || now,
                        task.updatedAt || now,
                        task.tags ? JSON.stringify(task.tags) : null,
                        task.priority,
                        task.groupCategory
                    ]);

                    if (task.subtasks) {
                        await db.execute('DELETE FROM subtasks WHERE parent_id = ?', [task.id]);

                        for (const subtask of task.subtasks) {
                            await db.execute(`
                                INSERT INTO subtasks (
                                    id, parent_id, title, completed, completed_at, 
                                    due_date, "order", created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                subtask.id,
                                subtask.parentId,
                                subtask.title,
                                subtask.completed ? 1 : 0,
                                subtask.completedAt,
                                subtask.dueDate || null,
                                subtask.order,
                                subtask.createdAt,
                                subtask.updatedAt
                            ]);
                        }
                    }
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Batch update tasks failed:', error);
                throw error;
            }
        });
    }

    /**
     * Batch update lists using transaction for improved performance
     */
    async batchUpdateLists(lists: List[]): Promise<void> {
        this.listsCache = lists;

        await this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                for (const list of lists) {
                    await db.execute(`
                        INSERT OR REPLACE INTO lists (
                            id, name, icon, color, "order", created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        list.id,
                        list.name,
                        list.icon || null,
                        list.color || null,
                        list.order || 0,
                        now,
                        now
                    ]);
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Batch update lists failed:', error);
                throw error;
            }
        });
    }

    /**
     * Force flush all pending write operations
     */
    async flush(): Promise<void> {
        if (this.batchQueue.length > 0) {
            await this.processBatchQueue();
        }

        await this.processWriteQueue();
    }

    /**
     * Create a new subtask in cache and database
     */
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask {
        const now = Date.now();
        const id = `subtask-${now}-${Math.random()}`;

        const newSubtask: Subtask = {
            id,
            parentId: taskId,
            title: subtaskData.title,
            completed: false,
            completedAt: null,
            order: subtaskData.order,
            dueDate: subtaskData.dueDate,
            createdAt: now,
            updatedAt: now,
        };

        const taskIndex = this.tasksCache.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            if (!this.tasksCache[taskIndex].subtasks) {
                this.tasksCache[taskIndex].subtasks = [];
            }
            this.tasksCache[taskIndex].subtasks!.push(newSubtask);
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`
                INSERT INTO subtasks (
                    id, parent_id, title, completed, completed_at, 
                    due_date, "order", created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                newSubtask.id,
                newSubtask.parentId,
                newSubtask.title,
                newSubtask.completed ? 1 : 0,
                newSubtask.completedAt,
                newSubtask.dueDate,
                newSubtask.order,
                newSubtask.createdAt,
                newSubtask.updatedAt
            ]);
        });

        return newSubtask;
    }

    /**
     * Update subtask in cache and database
     */
    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask {
        const now = Date.now();
        let updatedSubtask: Subtask | undefined;

        for (const task of this.tasksCache) {
            if (task.subtasks) {
                const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
                if (subtaskIndex !== -1) {
                    updatedSubtask = { ...task.subtasks[subtaskIndex], ...updates, updatedAt: now };
                    task.subtasks[subtaskIndex] = updatedSubtask;
                    break;
                }
            }
        }

        if (!updatedSubtask) throw new Error("Subtask not found");

        this.queueWrite(async () => {
            const db = this.getDb();
            const updateFields = [];
            const values = [];

            Object.entries(updates).forEach(([key, value]) => {
                switch (key) {
                    case 'title':
                        updateFields.push('title = ?');
                        values.push(value);
                        break;
                    case 'completed':
                        updateFields.push('completed = ?');
                        values.push(value ? 1 : 0);
                        break;
                    case 'completedAt':
                        updateFields.push('completed_at = ?');
                        values.push(value);
                        break;
                    case 'dueDate':
                        updateFields.push('due_date = ?');
                        values.push(value);
                        break;
                    case 'order':
                        updateFields.push('"order" = ?');
                        values.push(value);
                        break;
                }
            });

            if (updateFields.length > 0) {
                updateFields.push('updated_at = ?');
                values.push(now, subtaskId);

                await db.execute(
                    `UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`,
                    values
                );
            }
        });

        return updatedSubtask;
    }

    /**
     * Delete subtask from cache and database
     */
    deleteSubtask(subtaskId: string): void {
        for (const task of this.tasksCache) {
            if (task.subtasks) {
                const initialLength = task.subtasks.length;
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                if (task.subtasks.length < initialLength) {
                    break;
                }
            }
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
        });
    }

    /**
     * Get summaries from cache
     */
    fetchSummaries(): StoredSummary[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.summariesCache;
    }

    /**
     * Load summaries from database asynchronously
     */
    async fetchSummariesAsync(): Promise<StoredSummary[]> {
        const db = this.getDb();

        try {
            const dbSummaries = await db.select<DbSummary[]>('SELECT * FROM summaries ORDER BY created_at DESC');
            const summaries = dbSummaries.map(this.mapDbSummaryToSummary);
            this.summariesCache = summaries;
            return summaries;
        } catch (error) {
            console.error('Failed to fetch summaries:', error);
            return [];
        }
    }

    /**
     * Create a new summary in cache and database
     */
    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary {
        const now = Date.now();
        const id = `summary-${now}-${Math.random()}`;

        const newSummary: StoredSummary = {
            ...summaryData,
            id,
            createdAt: now,
            updatedAt: now,
        };

        this.summariesCache.unshift(newSummary);

        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`
                INSERT INTO summaries (
                    id, created_at, updated_at, period_key, list_key, task_ids, summary_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                newSummary.id,
                newSummary.createdAt,
                newSummary.updatedAt,
                newSummary.periodKey,
                newSummary.listKey,
                JSON.stringify(newSummary.taskIds),
                newSummary.summaryText
            ]);
        });

        return newSummary;
    }

    /**
     * Update summary in cache and database
     */
    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary {
        const now = Date.now();
        const index = this.summariesCache.findIndex(s => s.id === summaryId);
        if (index === -1) throw new Error("Summary not found");

        this.summariesCache[index] = { ...this.summariesCache[index], ...updates, updatedAt: now };

        this.queueWrite(async () => {
            const db = this.getDb();
            const updateFields = [];
            const values = [];

            Object.entries(updates).forEach(([key, value]) => {
                switch (key) {
                    case 'periodKey':
                        updateFields.push('period_key = ?');
                        values.push(value);
                        break;
                    case 'listKey':
                        updateFields.push('list_key = ?');
                        values.push(value);
                        break;
                    case 'taskIds':
                        updateFields.push('task_ids = ?');
                        values.push(JSON.stringify(value));
                        break;
                    case 'summaryText':
                        updateFields.push('summary_text = ?');
                        values.push(value);
                        break;
                }
            });

            if (updateFields.length > 0) {
                updateFields.push('updated_at = ?');
                values.push(now, summaryId);

                await db.execute(
                    `UPDATE summaries SET ${updateFields.join(', ')} WHERE id = ?`,
                    values
                );
            }
        });

        return this.summariesCache[index];
    }

    /**
     * Replace all summaries with new set in cache and database
     */
    updateSummaries(summaries: StoredSummary[]): StoredSummary[] {
        this.summariesCache = summaries;

        this.queueWrite(async () => {
            const db = this.getDb();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM summaries');

                for (const summary of summaries) {
                    await db.execute(`
                        INSERT INTO summaries (
                            id, created_at, updated_at, period_key, list_key, task_ids, summary_text
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        summary.id,
                        summary.createdAt,
                        summary.updatedAt,
                        summary.periodKey,
                        summary.listKey,
                        JSON.stringify(summary.taskIds),
                        summary.summaryText
                    ]);
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update summaries:', error);
            }
        });

        return summaries;
    }

    /**
     * Export all data from database
     */
    exportData(): ExportedData {
        const settings = this.fetchSettings();
        const lists = this.fetchLists();
        const tasks = this.fetchTasks();
        const summaries = this.fetchSummaries();

        return {
            version: '1.0.0',
            exportedAt: Date.now(),
            platform: 'desktop',
            data: {
                settings,
                lists,
                tasks,
                summaries
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

        return conflicts;
    }

    /**
     * Import data into database
     */
    importData(data: ExportedData, options: ImportOptions, conflictResolutions?: Map<string, ConflictResolution>): ImportResult {
        const result: ImportResult = {
            success: false,
            message: '',
            imported: {
                settings: 0,
                lists: 0,
                tasks: 0,
                summaries: 0
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
                            case 'keep-local':
                                shouldImport = false;
                                break;
                            case 'keep-imported':
                                listToImport = importedList;
                                break;
                            case 'keep-newer':
                                // Lists don't have updatedAt in cache, so we compare by name change or keep local
                                shouldImport = existingList.name !== importedList.name;
                                break;
                            case 'skip':
                                shouldImport = false;
                                break;
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
                            case 'keep-local':
                                shouldImport = false;
                                break;
                            case 'keep-imported':
                                taskToImport = { ...importedTask, groupCategory: getTaskGroupCategory(importedTask) };
                                break;
                            case 'keep-newer':
                                shouldImport = importedTask.updatedAt > existingTask.updatedAt;
                                break;
                            case 'skip':
                                shouldImport = false;
                                break;
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
                            case 'keep-local':
                                shouldImport = false;
                                break;
                            case 'keep-imported':
                                summaryToImport = importedSummary;
                                break;
                            case 'keep-newer':
                                shouldImport = importedSummary.updatedAt > existingSummary.updatedAt;
                                break;
                            case 'skip':
                                shouldImport = false;
                                break;
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

            result.success = true;
            result.message = 'Data imported successfully';

        } catch (error) {
            result.success = false;
            result.message = error instanceof Error ? error.message : 'Import failed';
            result.errors.push(result.message);
        }

        return result;
    }

    /**
     * Map database list record to application List type
     */
    private mapDbListToList(dbList: DbList): List {
        return {
            id: dbList.id,
            name: dbList.name,
            icon: dbList.icon,
            color: dbList.color,
            order: dbList.order,
        };
    }

    /**
     * Map database task record to application Task type
     */
    private mapDbTaskToTask(dbTask: DbTask): Task {
        return {
            id: dbTask.id,
            title: dbTask.title,
            completed: Boolean(dbTask.completed),
            completedAt: dbTask.completed_at,
            completePercentage: dbTask.complete_percentage,
            dueDate: dbTask.due_date,
            listId: dbTask.list_id,
            listName: dbTask.list_name,
            content: dbTask.content || undefined,
            order: dbTask.order,
            createdAt: dbTask.created_at,
            updatedAt: dbTask.updated_at,
            tags: dbTask.tags ? JSON.parse(dbTask.tags) : undefined,
            priority: dbTask.priority,
            groupCategory: dbTask.group_category as any,
            subtasks: [],
        };
    }

    /**
     * Map database subtask record to application Subtask type
     */
    private mapDbSubtaskToSubtask(dbSubtask: DbSubtask): Subtask {
        return {
            id: dbSubtask.id,
            parentId: dbSubtask.parent_id,
            title: dbSubtask.title,
            completed: Boolean(dbSubtask.completed),
            completedAt: dbSubtask.completed_at,
            dueDate: dbSubtask.due_date,
            order: dbSubtask.order,
            createdAt: dbSubtask.created_at,
            updatedAt: dbSubtask.updated_at,
        };
    }

    /**
     * Map database summary record to application StoredSummary type
     */
    private mapDbSummaryToSummary(dbSummary: DbSummary): StoredSummary {
        return {
            id: dbSummary.id,
            createdAt: dbSummary.created_at,
            updatedAt: dbSummary.updated_at,
            periodKey: dbSummary.period_key,
            listKey: dbSummary.list_key,
            taskIds: JSON.parse(dbSummary.task_ids),
            summaryText: dbSummary.summary_text,
        };
    }
}