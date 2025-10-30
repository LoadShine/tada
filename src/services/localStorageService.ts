// src/services/localStorageService.ts
import {
    AISettings,
    AppearanceSettings,
    List,
    PreferencesSettings,
    StoredSummary,
    Task,
    Subtask
} from '@/types';
import {
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    defaultPreferencesSettingsForApi
} from "@/store/atoms";

const LOCAL_STORAGE_KEY = 'tada-app-data';

interface AppData {
    tasks: Task[];
    lists: List[];
    summaries: StoredSummary[];
    appearanceSettings: AppearanceSettings;
    preferencesSettings: PreferencesSettings;
    aiSettings: AISettings;
}

// --- Default Initial Data ---
const getDefaultData = (): AppData => {
    const inboxId = `list-${Date.now()}`;
    return {
        tasks: [],
        lists: [
            { id: inboxId, name: 'Inbox', icon: 'inbox', order: 1 }
        ],
        summaries: [],
        appearanceSettings: defaultAppearanceSettingsForApi(),
        preferencesSettings: {
            ...defaultPreferencesSettingsForApi(),
            defaultNewTaskList: 'Inbox' // Ensure default list exists
        },
        aiSettings: defaultAISettingsForApi(),
    };
};

// --- Core Read/Write Functions ---
const loadData = (): AppData => {
    try {
        const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (rawData) {
            const parsedData = JSON.parse(rawData);
            // Basic migration/validation: ensure all keys exist
            return {
                ...getDefaultData(),
                ...parsedData,
                // Ensure nested settings objects are also merged with defaults
                aiSettings: {
                    ...getDefaultData().aiSettings,
                    ...(parsedData.aiSettings || {}),
                }
            };
        }
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
    }
    // If anything fails, return fresh default data
    const defaultData = getDefaultData();
    saveData(defaultData);
    return defaultData;
};

const saveData = (data: AppData): void => {
    try {
        const stringifiedData = JSON.stringify(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, stringifiedData);
    } catch (error) {
        console.error("Failed to save data to localStorage", error);
    }
};

// --- Data Access "API" ---

// Settings
export const fetchSettings = (): { appearance: AppearanceSettings; preferences: PreferencesSettings, ai: AISettings } => {
    const data = loadData();
    return {
        appearance: data.appearanceSettings,
        preferences: data.preferencesSettings,
        ai: data.aiSettings,
    };
};

export const updateAppearanceSettings = (settings: AppearanceSettings): AppearanceSettings => {
    const data = loadData();
    data.appearanceSettings = settings;
    saveData(data);
    return settings;
};

export const updatePreferencesSettings = (settings: PreferencesSettings): PreferencesSettings => {
    const data = loadData();
    data.preferencesSettings = settings;
    saveData(data);
    return settings;
};

export const updateAISettings = (settings: AISettings): AISettings => {
    const data = loadData();
    data.aiSettings = settings;
    saveData(data);
    return settings;
};

// Lists
export const fetchLists = (): List[] => {
    const data = loadData();
    return data.lists;
};

export const createList = (listData: { name: string; icon?: string }): List => {
    const data = loadData();
    const newList: List = {
        id: `list-${Date.now()}-${Math.random()}`,
        name: listData.name,
        icon: listData.icon ?? 'list',
        order: (data.lists.length + 1) * 1000,
    };
    data.lists.push(newList);
    saveData(data);
    return newList;
};

export const updateList = (listId: string, updates: Partial<List>): List => {
    const data = loadData();
    let originalName: string | undefined;
    let updatedList: List | undefined;

    data.lists = data.lists.map(list => {
        if (list.id === listId) {
            originalName = list.name;
            updatedList = { ...list, ...updates };
            return updatedList;
        }
        return list;
    });

    if (!updatedList) throw new Error("List not found");

    // If name was updated, update all tasks in that list
    if (updates.name && originalName && updates.name !== originalName) {
        data.tasks = data.tasks.map(task =>
            task.listId === listId ? { ...task, listName: updates.name! } : task
        );
    }

    saveData(data);
    return updatedList;
};

export const deleteList = (listId: string): { message: string } => {
    const data = loadData();
    const listToDelete = data.lists.find(l => l.id === listId);
    if (!listToDelete) throw new Error("List not found");
    if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

    const inbox = data.lists.find(l => l.name === 'Inbox');
    if (!inbox) throw new Error("Inbox not found, cannot delete list.");

    // Move tasks to Inbox, unless they are already in the trash
    data.tasks = data.tasks.map(task => {
        if (task.listId === listId) {
            // If task is already in trash, keep it there. Just nullify the listId.
            if (task.listName === 'Trash') {
                return { ...task, listId: null };
            }
            // Otherwise, move to Inbox.
            return { ...task, listId: inbox.id, listName: inbox.name };
        }
        return task;
    });

    data.lists = data.lists.filter(l => l.id !== listId);
    saveData(data);
    return { message: "List deleted successfully" };
};

// Tasks
export const fetchTasks = (): Task[] => {
    const data = loadData();
    return data.tasks;
};

export const createTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task => {
    const data = loadData();
    const now = Date.now();
    const newTask: Task = {
        ...taskData,
        id: `task-${now}-${Math.random()}`,
        createdAt: now,
        updatedAt: now,
        groupCategory: 'nodate', // This will be recalculated in atoms
    };
    data.tasks.push(newTask);
    saveData(data);
    return newTask;
};

export const updateTask = (taskId: string, updates: Partial<Task>): Task => {
    const data = loadData();
    let updatedTask: Task | undefined;
    data.tasks = data.tasks.map(task => {
        if (task.id === taskId) {
            updatedTask = { ...task, ...updates, updatedAt: Date.now() };
            return updatedTask;
        }
        return task;
    });
    if (!updatedTask) throw new Error("Task not found");
    saveData(data);
    return updatedTask;
};

export const deleteTask = (taskId: string): void => {
    const data = loadData();
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    saveData(data);
};

// Subtasks
export const createSubtask = (taskId: string, subtaskData: { title: string, order: number, dueDate: number | null }): Subtask => {
    const data = loadData();
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

    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error("Parent task not found");

    if (!data.tasks[taskIndex].subtasks) {
        data.tasks[taskIndex].subtasks = [];
    }
    data.tasks[taskIndex].subtasks!.push(newSubtask);

    saveData(data);
    return newSubtask;
};

export const updateSubtask = (subtaskId: string, updates: Partial<Subtask>): Subtask => {
    const data = loadData();
    let updatedSubtask: Subtask | undefined;

    for (const task of data.tasks) {
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
    saveData(data);
    return updatedSubtask;
};

export const deleteSubtask = (subtaskId: string): void => {
    const data = loadData();
    for (const task of data.tasks) {
        if (task.subtasks) {
            const initialLength = task.subtasks.length;
            task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
            if(task.subtasks.length < initialLength) {
                break; // Found and deleted
            }
        }
    }
    saveData(data);
};

// Summaries
export const fetchSummaries = (): StoredSummary[] => {
    const data = loadData();
    return data.summaries;
};

export const createSummary = (summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary => {
    const data = loadData();
    const now = Date.now();
    const newSummary: StoredSummary = {
        ...summaryData,
        id: `summary-${now}-${Math.random()}`,
        createdAt: now,
        updatedAt: now,
    };
    data.summaries.unshift(newSummary); // Add to the beginning
    saveData(data);
    return newSummary;
};

export const updateSummary = (summaryId: string, updates: Partial<StoredSummary>): StoredSummary => {
    const data = loadData();
    let updatedSummary: StoredSummary | undefined;
    data.summaries = data.summaries.map(s => {
        if (s.id === summaryId) {
            updatedSummary = { ...s, ...updates, updatedAt: Date.now() };
            return updatedSummary;
        }
        return s;
    });
    if (!updatedSummary) throw new Error("Summary not found");
    saveData(data);
    return updatedSummary;
};