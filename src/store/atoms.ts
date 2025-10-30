// src/store/atoms.ts
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
} from '@/types';
import {
    endOfDay, isAfter, isBefore, isSameDay, isValid, isWithinNext7Days,
    safeParseDate, startOfDay, startOfMonth, startOfWeek, subDays, subMonths,
    subWeeks, endOfMonth, endOfWeek
} from '@/utils/dateUtils';
import * as service from '@/services/localStorageService';
import {AI_PROVIDERS, AIModel} from "@/config/aiProviders";

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
    defaultNewTaskList: 'Inbox', confirmDeletions: true,
});
export const defaultAISettingsForApi = (): AISettings => ({
    provider: 'openai',
    apiKey: '',
    model: '',
    baseUrl: '',
    fetchedModels: [],
    isConnected: false,
});

// --- Task Atoms ---
const baseTasksDataAtom = atom<Task[] | null>(null);
export const tasksLoadingAtom = atom<boolean>(false);
export const tasksErrorAtom = atom<string | null>(null);

export const tasksAtom: LocalDataAtom<Task[]> = atom(
    (get) => get(baseTasksDataAtom),
    (get, set, update) => {
        if (update === RESET) {
            const fetchedTasks = service.fetchTasks();
            const tasksWithCategory = fetchedTasks.map(t => ({...t, groupCategory: getTaskGroupCategory(t)}));
            set(baseTasksDataAtom, tasksWithCategory.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            return;
        }

        const previousTasks = get(baseTasksDataAtom) ?? [];
        const nextTasksUnprocessed = typeof update === 'function' ? (update as (prev: Task[] | null) => Task[])(previousTasks) : update;

        const nextTasksWithCategory = nextTasksUnprocessed.map(task => ({
            ...task,
            groupCategory: getTaskGroupCategory(task),
        }));

        set(baseTasksDataAtom, nextTasksWithCategory);

        const data = {
            ...service.fetchSettings(),
            tasks: nextTasksWithCategory,
            lists: service.fetchLists(),
            summaries: service.fetchSummaries()
        };
        localStorage.setItem('tada-app-data', JSON.stringify(data));
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
            set(baseUserListsAtom, service.fetchLists());
            return;
        }
        const nextLists = typeof update === 'function' ? (update as (prev: List[] | null) => List[])(get(baseUserListsAtom)) : update;
        set(baseUserListsAtom, nextLists);
        const data = {
            ...service.fetchSettings(),
            tasks: service.fetchTasks(),
            lists: nextLists,
            summaries: service.fetchSummaries()
        };
        localStorage.setItem('tada-app-data', JSON.stringify(data));
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
    }
);
aiSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- Summary Atoms ---
export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());

const baseStoredSummariesAtom = atom<StoredSummary[] | null>(null);
export const storedSummariesLoadingAtom = atom<boolean>(false);
export const storedSummariesErrorAtom = atom<string | null>(null);

export const storedSummariesAtom: LocalDataAtom<StoredSummary[]> = atom(
    (get) => get(baseStoredSummariesAtom),
    (get, set, update) => {
        if (update === RESET) {
            set(baseStoredSummariesAtom, service.fetchSummaries());
            return;
        }
        const updatedSummaries = typeof update === 'function' ? (update as (prev: StoredSummary[] | null) => StoredSummary[])(get(baseStoredSummariesAtom) ?? []) : update;
        set(baseStoredSummariesAtom, updatedSummaries);

        const data = {
            ...service.fetchSettings(),
            tasks: service.fetchTasks(),
            lists: service.fetchLists(),
            summaries: updatedSummaries
        };
        localStorage.setItem('tada-app-data', JSON.stringify(data));
    }
);
storedSummariesAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

// --- Derived Atoms ---
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
    const tags = new Set<string>();
    tasks.forEach(task => task.tags?.forEach(tag => tags.add(tag.trim())));
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

export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const todayStart = startOfDay(new Date());
    let startDateNum: number | null = null, endDateNum: number | null = null;
    switch (period) {
        case 'today':
            startDateNum = todayStart.getTime();
            endDateNum = endOfDay(new Date()).getTime();
            break;
        case 'yesterday':
            startDateNum = startOfDay(subDays(todayStart, 1)).getTime();
            endDateNum = endOfDay(new Date(startDateNum)).getTime();
            break;
        case 'thisWeek':
            startDateNum = startOfWeek(todayStart).getTime();
            endDateNum = endOfWeek(todayStart).getTime();
            break;
        case 'lastWeek':
            startDateNum = startOfWeek(subWeeks(todayStart, 1)).getTime();
            endDateNum = endOfWeek(new Date(startDateNum)).getTime();
            break;
        case 'thisMonth':
            startDateNum = startOfMonth(todayStart).getTime();
            endDateNum = endOfMonth(todayStart).getTime();
            break;
        case 'lastMonth':
            startDateNum = startOfMonth(subMonths(todayStart, 1)).getTime();
            endDateNum = endOfMonth(new Date(startDateNum)).getTime();
            break;
        default:
            if (typeof period === 'object' && period.start && period.end) {
                startDateNum = startOfDay(new Date(period.start)).getTime();
                endDateNum = endOfDay(new Date(period.end)).getTime();
            }
            break;
    }
    if (!startDateNum || !endDateNum) return [];
    const startDateObj = new Date(startDateNum);
    const endDateObj = new Date(endDateNum);
    if (!isValid(startDateObj) || !isValid(endDateObj)) return [];
    return allTasks.filter(task => {
        if (task.listName === 'Trash') return false;
        if (listFilter !== 'all' && task.listName !== listFilter) return false;
        let relevantDateTimestamp: number | null = null;
        if (task.completed && task.completedAt) {
            relevantDateTimestamp = task.completedAt;
        } else if (!task.completed && task.dueDate) {
            relevantDateTimestamp = task.dueDate;
        } else {
            relevantDateTimestamp = task.updatedAt;
        }
        if (!relevantDateTimestamp) return false;
        const relevantDate = safeParseDate(relevantDateTimestamp);
        if (!relevantDate || !isValid(relevantDate)) return false;
        const relevantDateDayStart = startOfDay(relevantDate);
        return !isBefore(relevantDateDayStart, startDateObj) && !isAfter(relevantDateDayStart, endDateObj);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
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