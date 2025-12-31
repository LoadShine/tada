import {atom, WritableAtom} from 'jotai';
import {RESET} from 'jotai/utils';
import {
    AISettings,
    AppearanceSettings,
    List,
    PreferencesSettings,
    SettingsTab,
    StoredSummary,
    Task,
    TaskFilter,
    TaskGroupCategory,
    ImportOptions,
    ConflictResolution,
    ExportedData,
    ImportResult,
    EchoReport
} from '@/types';
import {
    endOfDay, isAfter, isBefore, isSameDay, isValid, isWithinNext7Days,
    safeParseDate, startOfDay, startOfMonth, startOfWeek, subDays, subMonths,
    subWeeks, endOfMonth, endOfWeek
} from '@/utils/dateUtils';
import storageManager from "@/services/storageManager.ts";

export interface Notification {
    id: number;
    type: 'success' | 'error' | 'loading';
    message: string;
}

type LocalDataAtom<TData, TUpdate = TData | ((prev: TData | null) => TData) | typeof RESET> = WritableAtom<
    TData | null,
    [TUpdate],
    void
>;

/**
 * Determines the group category for a task based on its due date and status.
 */
export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    if (task.completed || task.listName === 'Trash') {
        return 'nodate';
    }
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';

        const today = startOfDay(new Date());
        const taskDay = startOfDay(dueDateObj);

        if (isBefore(taskDay, today)) return 'overdue';
        if (isSameDay(taskDay, today)) return 'today';
        if (isWithinNext7Days(taskDay)) return 'next7days';
        return 'later';
    }
    return 'nodate';
};

// --- Default Settings for Fallback ---
export const defaultAppearanceSettingsForApi = (): AppearanceSettings => ({
    themeId: 'default-coral', darkMode: 'system', interfaceDensity: 'default',
});
export const defaultPreferencesSettingsForApi = (): PreferencesSettings => ({
    language: 'zh-CN', defaultNewTaskDueDate: null, defaultNewTaskPriority: null,
    defaultNewTaskList: 'Inbox', confirmDeletions: true, zenModeShyNative: false,
    enableEcho: true, echoJobTypes: [], echoPastExamples: '', alwaysUseAITask: false
});
export const defaultAISettingsForApi = (): AISettings => ({
    provider: 'openai',
    apiKey: '',
    model: '',
    baseUrl: '',
    availableModels: [],
});

// --- Task Atoms ---
const baseTasksDataAtom = atom<Task[] | null>(null);
export const tasksLoadingAtom = atom<boolean>(false);
export const tasksErrorAtom = atom<string | null>(null);

/**
 * The main atom for managing the list of all tasks.
 */
export const tasksAtom: LocalDataAtom<Task[]> = atom(
    (get) => get(baseTasksDataAtom),
    (get, set, update) => {
        if (update === RESET) {
            const service = storageManager.get();
            const fetchedTasks = service.fetchTasks();
            const tasksWithCategory = fetchedTasks.map(t => ({...t, groupCategory: getTaskGroupCategory(t)}));
            set(baseTasksDataAtom, tasksWithCategory.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            return;
        }

        const previousTasks = get(baseTasksDataAtom) ?? [];
        const nextTasksUnprocessed = typeof update === 'function'
            ? (update as (prev: Task[] | null) => Task[])(previousTasks)
            : update;

        const nextTasksWithCategory = nextTasksUnprocessed.map(task => ({
            ...task,
            groupCategory: getTaskGroupCategory(task),
        }));

        set(baseTasksDataAtom, nextTasksWithCategory);
    }
);
tasksAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- List Atoms ---
const baseUserListsAtom = atom<List[] | null>(null);
export const userListsLoadingAtom = atom<boolean>(false);
export const userListsErrorAtom = atom<string | null>(null);

export const userListsAtom: LocalDataAtom<List[]> = atom(
    (get) => get(baseUserListsAtom),
    (get, set, update) => {
        if (update === RESET) {
            const service = storageManager.get();
            set(baseUserListsAtom, [...service.fetchLists()]);
            return;
        }
        const nextLists = typeof update === 'function'
            ? (update as (prev: List[] | null) => List[])(get(baseUserListsAtom))
            : update;

        set(baseUserListsAtom, nextLists);
    }
);
userListsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('appearance');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');
export const notificationsAtom = atom<Notification[]>([]);
export const isZenFullScreenAtom = atom<boolean>(false);
export const aiConnectionStatusAtom = atom<'idle' | 'success' | 'error'>('idle');

export const addNotificationAtom = atom(
    null,
    (get, set, newNotification: Omit<Notification, 'id'>) => {
        const id = Date.now() + Math.random();
        set(notificationsAtom, (prev) => [...prev, { ...newNotification, id }]);
        setTimeout(() => {
            set(notificationsAtom, (prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }
);

// --- Settings Atoms ---
export type DarkModeOption = 'light' | 'dark' | 'system';
const baseAppearanceSettingsAtom = atom<AppearanceSettings | null>(null);
export const appearanceSettingsLoadingAtom = atom<boolean>(false);
export const appearanceSettingsErrorAtom = atom<string | null>(null);

export const appearanceSettingsAtom: LocalDataAtom<AppearanceSettings> = atom(
    (get) => get(baseAppearanceSettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            set(baseAppearanceSettingsAtom, service.fetchSettings().appearance);
            return;
        }
        const currentSettings = get(baseAppearanceSettingsAtom) ?? defaultAppearanceSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AppearanceSettings) => AppearanceSettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updateAppearanceSettings(updatedSettings);
        set(baseAppearanceSettingsAtom, savedSettings);
    }
);
appearanceSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

export type DefaultNewTaskDueDate = null | 'today' | 'tomorrow';

const basePreferencesSettingsAtom = atom<PreferencesSettings | null>(null);
export const preferencesSettingsLoadingAtom = atom<boolean>(false);
export const preferencesSettingsErrorAtom = atom<string | null>(null);

export const preferencesSettingsAtom: LocalDataAtom<PreferencesSettings> = atom(
    (get) => get(basePreferencesSettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            set(basePreferencesSettingsAtom, service.fetchSettings().preferences);
            return;
        }
        const currentSettings = get(basePreferencesSettingsAtom) ?? defaultPreferencesSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: PreferencesSettings) => PreferencesSettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updatePreferencesSettings(updatedSettings);
        set(basePreferencesSettingsAtom, savedSettings);
    }
);
preferencesSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

const baseAISettingsAtom = atom<AISettings | null>(null);
export const aiSettingsLoadingAtom = atom<boolean>(false);
export const aiSettingsErrorAtom = atom<string | null>(null);

export const aiSettingsAtom: LocalDataAtom<AISettings> = atom(
    (get) => get(baseAISettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            const savedSettings = service.fetchSettings().ai;
            const defaultSettings = defaultAISettingsForApi();
            const mergedSettings: AISettings = {
                ...defaultSettings,
                ...savedSettings,
            };
            set(baseAISettingsAtom, mergedSettings);
            return;
        }
        const currentSettings = get(baseAISettingsAtom) ?? defaultAISettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AISettings | null) => AISettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updateAISettings(updatedSettings);
        set(baseAISettingsAtom, savedSettings);

        // Reset connection status to idle whenever settings change
        set(aiConnectionStatusAtom, 'idle');
    }
);
aiSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- Summary Feature Atoms ---
export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());
export const summarySelectedFutureTaskIdsAtom = atom<Set<string>>(new Set<string>());
const baseStoredSummariesAtom = atom<StoredSummary[] | null>(null);
export const storedSummariesLoadingAtom = atom<boolean>(false);
export const storedSummariesErrorAtom = atom<string | null>(null);

export const storedSummariesAtom: LocalDataAtom<StoredSummary[]> = atom(
    (get) => get(baseStoredSummariesAtom),
    (get, set, update) => {
        const service = storageManager.get();
        if (update === RESET) {
            set(baseStoredSummariesAtom, service.fetchSummaries());
            return;
        }
        const updatedSummaries = typeof update === 'function' ? (update as (prev: StoredSummary[] | null) => StoredSummary[])(get(baseStoredSummariesAtom) ?? []) : update;
        set(baseStoredSummariesAtom, updatedSummaries);
        service.updateSummaries(updatedSummaries);
    }
);
storedSummariesAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- Echo Feature Atoms ---
const baseEchoReportsAtom = atom<EchoReport[] | null>(null);
export const echoReportsAtom: LocalDataAtom<EchoReport[]> = atom(
    (get) => get(baseEchoReportsAtom),
    (get, set, update) => {
        const service = storageManager.get();
        if (update === RESET) {
            set(baseEchoReportsAtom, service.fetchEchoReports());
            return;
        }
        const updatedReports = typeof update === 'function' ? (update as (prev: EchoReport[] | null) => EchoReport[])(get(baseEchoReportsAtom) ?? []) : update;
        set(baseEchoReportsAtom, updatedReports);
    }
);
echoReportsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- Derived Atoms ---
export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    if (!tasks) return null;
    return selectedId ? tasks.find(task => task.id === selectedId) ?? null : null;
});

export const userListNamesAtom = atom<string[]>((get) => {
    const lists = get(userListsAtom) ?? [];
    return lists.map(l => l.name).sort((a, b) => {
        if (a === 'Inbox') return -1;
        if (b === 'Inbox') return 1;
        return a.localeCompare(b);
    });
});

export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const activeTasks = tasks.filter(task => !task.completed && task.listName !== 'Trash');
    const tags = new Set<string>();
    activeTasks.forEach(task => task.tags?.forEach(tag => tags.add(tag.trim())));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});

export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.listName !== 'Trash');
    const trashedTasksCount = tasks.length - activeTasks.length;

    const counts = {
        all: 0, today: 0, next7days: 0, completed: 0, trash: trashedTasksCount,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };

    activeTasks.forEach(task => {
        if (task.completed) {
            counts.completed++;
        } else {
            counts.all++;
            const taskGroup = getTaskGroupCategory(task);
            if (taskGroup === 'today') counts.today++;
            if (taskGroup === 'next7days' || taskGroup === 'today') counts.next7days++;

            if (task.listName && Object.prototype.hasOwnProperty.call(counts.lists, task.listName)) {
                counts.lists[task.listName]++;
            }
            task.tags?.forEach(tag => {
                if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
                    counts.tags[tag]++;
                }
            });
        }
    });
    return counts;
});

export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    const tasksToGroup = (get(tasksAtom) ?? []).filter(t => t.listName !== 'Trash' && !t.completed)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const groups: Record<TaskGroupCategory, Task[]> = {overdue: [], today: [], next7days: [], later: [], nodate: []};
    tasksToGroup.forEach(task => {
        const category = task.groupCategory;
        if (Object.prototype.hasOwnProperty.call(groups, category)) {
            groups[category].push(task);
        } else {
            groups.nodate.push(task);
        }
    });
    return groups;
});

export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom) ?? [];
    const searchWords = search.split(' ').filter(Boolean);
    return allTasks.filter(task => {
        return searchWords.every(word => {
            const titleMatch = task.title.toLowerCase().includes(word);
            const contentMatch = task.content && task.content.toLowerCase().includes(word);
            const tagsMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(word));
            const listMatch = task.listName.toLowerCase().includes(word);
            const subtasksMatch = task.subtasks && task.subtasks.some(sub => sub.title.toLowerCase().includes(word));
            return titleMatch || contentMatch || tagsMatch || listMatch || subtasksMatch;
        });
    }).sort((a, b) => {
        const aIsActive = a.listName !== 'Trash' && !a.completed;
        const bIsActive = b.listName !== 'Trash' && !b.completed;
        if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt - b.createdAt);
    });
});

const getPeriodDates = (period: SummaryPeriodOption) => {
    const todayStart = startOfDay(new Date());
    switch (period) {
        case 'today': return { startDate: todayStart, endDate: endOfDay(todayStart) };
        case 'yesterday': return { startDate: startOfDay(subDays(todayStart, 1)), endDate: endOfDay(subDays(todayStart, 1)) };
        case 'thisWeek': return { startDate: startOfWeek(todayStart), endDate: endOfWeek(todayStart) };
        case 'lastWeek': return { startDate: startOfWeek(subWeeks(todayStart, 1)), endDate: endOfWeek(subWeeks(todayStart, 1)) };
        case 'thisMonth': return { startDate: startOfMonth(todayStart), endDate: endOfMonth(todayStart) };
        case 'lastMonth': return { startDate: startOfMonth(subMonths(todayStart, 1)), endDate: endOfMonth(subMonths(todayStart, 1)) };
        default:
            if (typeof period === 'object' && period.start && period.end) {
                return { startDate: startOfDay(new Date(period.start)), endDate: endOfDay(new Date(period.end)) };
            }
            return { startDate: null, endDate: null };
    }
}

export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);

    const { startDate, endDate } = getPeriodDates(period);
    if (!startDate || !endDate) return [];

    return allTasks.filter(task => {
        if (task.listName === 'Trash') return false;
        if (listFilter !== 'all' && task.listName !== listFilter) return false;
        const relevantDateTimestamp = task.completed && task.completedAt ? task.completedAt
            : !task.completed && task.dueDate ? task.dueDate
                : task.updatedAt;
        if (!relevantDateTimestamp) return false;

        const relevantDate = safeParseDate(relevantDateTimestamp);
        return relevantDate && isValid(relevantDate) && !isBefore(relevantDate, startDate) && !isAfter(relevantDate, endDate);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
});

export const futureTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const { endDate } = getPeriodDates(period);
    if (!endDate) return [];

    return allTasks.filter(task => {
        if (task.listName === 'Trash' || task.completed) return false;
        if (listFilter !== 'all' && task.listName !== listFilter) return false;
        if (!task.dueDate) return false;

        const dueDate = safeParseDate(task.dueDate);
        return dueDate && isValid(dueDate) && isAfter(dueDate, endDate);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
});

export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr = '';
    if (typeof period === 'string') {
        periodStr = period;
    } else if (period && typeof period === 'object' && period.start && period.end) {
        periodStr = `custom_${startOfDay(new Date(period.start)).getTime()}_${endOfDay(new Date(period.end)).getTime()}`;
    } else {
        periodStr = 'invalid_period';
    }
    const listStr = list;
    return `${periodStr}__${listStr}`;
});

export const relevantStoredSummariesAtom = atom<StoredSummary[]>((get) => {
    const allSummaries = get(storedSummariesAtom) ?? [];
    const filterKeyVal = get(currentSummaryFilterKeyAtom);
    if (filterKeyVal.startsWith('invalid_period')) return [];
    const [periodKey, listKey] = filterKeyVal.split('__');
    return allSummaries.filter(s => s.periodKey === periodKey && s.listKey === listKey).sort((a, b) => b.createdAt - a.createdAt);
});

export const currentDisplayedSummaryAtom = atom<StoredSummary | null>((get) => {
    const summaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    if (index === -1) return null;
    return summaries[index] ?? null;
});

export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const summary = get(currentDisplayedSummaryAtom);
    if (!summary) return [];
    const tasks = get(tasksAtom) ?? [];
    const ids = new Set(summary.taskIds);
    return tasks.filter(t => ids.has(t.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.order ?? 0) - (b.order ?? 0));
});

// --- Import/Export State Atoms ---
export const isImportingAtom = atom<boolean>(false);
export const isExportingAtom = atom<boolean>(false);
export const importProgressAtom = atom<number>(0);
export const exportProgressAtom = atom<number>(0);

export const exportDataAtom = atom(
    null,
    (get, set) => {
        try {
            set(isExportingAtom, true);
            const service = storageManager.get();
            const exportedData = service.exportData();

            const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tada-backup-${new Date().toISOString().split('T')[0]}.json`;

            if (typeof document !== 'undefined') {
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            set(addNotificationAtom, {
                type: 'success',
                message: 'Data exported successfully'
            });

        } catch (error) {
            console.error('Export failed:', error);
            set(addNotificationAtom, {
                type: 'error',
                message: 'Failed to export data'
            });
        } finally {
            set(isExportingAtom, false);
        }
    }
);

export const importDataAtom = atom(
    null,
    (get, set, { data, options, conflictResolutions }: {
        data: ExportedData;
        options: ImportOptions;
        conflictResolutions?: Map<string, ConflictResolution>
    }) => {
        try {
            set(isImportingAtom, true);
            const service = storageManager.get();
            const result = service.importData(data, options, conflictResolutions);

            if (result.success) {
                set(tasksAtom, RESET);
                set(userListsAtom, RESET);
                set(storedSummariesAtom, RESET);
                set(echoReportsAtom, RESET);
                set(appearanceSettingsAtom, RESET);
                set(preferencesSettingsAtom, RESET);
                set(aiSettingsAtom, RESET);

                set(addNotificationAtom, {
                    type: 'success',
                    message: `Import successful: ${result.imported.tasks} tasks, ${result.imported.lists} lists, ${result.imported.summaries} summaries, ${result.imported.echo} echoes.`
                });
            } else {
                set(addNotificationAtom, {
                    type: 'error',
                    message: result.message
                });
            }

            return result;
        } catch (error) {
            console.error('Import failed:', error);
            set(addNotificationAtom, {
                type: 'error',
                message: 'Failed to import data'
            });
            return {
                success: false,
                message: 'Import failed',
                imported: { settings: 0, lists: 0, tasks: 0, summaries: 0, echo: 0 },
                conflicts: [],
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        } finally {
            set(isImportingAtom, false);
        }
    }
);

export const analyzeImportAtom = atom(
    null,
    (get, set, { data, options }: { data: ExportedData; options: ImportOptions }) => {
        try {
            const service = storageManager.get();
            return service.analyzeImport(data, options);
        } catch (error) {
            console.error('Analysis failed:', error);
            return [];
        }
    }
);