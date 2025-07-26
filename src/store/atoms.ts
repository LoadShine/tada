// src/store/atoms.ts
import {atom, WritableAtom} from 'jotai';
import {RESET} from 'jotai/utils';
import {
    AppearanceSettings,
    List,
    PreferencesSettings,
    SettingsTab,
    StoredSummary,
    Task,
    TaskFilter,
    TaskGroupCategory,
    User
} from '@/types';
import {
    endOfDay,
    endOfMonth,
    endOfWeek,
    isAfter,
    isBefore,
    isSameDay,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks
} from '@/utils/dateUtils';
import * as service from '@/services/apiService';
import {TaskCreate, TaskUpdate} from "@/types/api";

type AsyncDataAtom<TData, TUpdate = TData | ((prev: TData | null) => TData) | typeof RESET> = WritableAtom<
    TData | null,
    [TUpdate],
    Promise<void>
>;

// --- Helper Functions ---
export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    // This is a client-side only concept for UI grouping
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
    themeId: 'default-coral', darkMode: 'system', backgroundImageUrl: 'none', backgroundImageBlur: 0,
    backgroundImageBrightness: 100, interfaceDensity: 'default',
});
export const defaultPreferencesSettingsForApi = (): PreferencesSettings => ({
    language: 'en', defaultNewTaskDueDate: null, defaultNewTaskPriority: null,
    defaultNewTaskList: 'Inbox', confirmDeletions: true,
});

// --- User & Auth Atoms ---
const baseCurrentUserAtom = atom<User | null>(null);
export const currentUserLoadingAtom = atom<boolean>(true);
export const currentUserErrorAtom = atom<string | null>(null);

export const currentUserAtom: AsyncDataAtom<User, User | null | typeof RESET | 'logout' | undefined> = atom(
    (get) => get(baseCurrentUserAtom),
    async (get, set, update) => {
        const resetAllUserData = () => {
            set(tasksAtom, RESET);
            set(userListsAtom, RESET);
            set(appearanceSettingsAtom, RESET);
            set(preferencesSettingsAtom, RESET);
            set(storedSummariesAtom, RESET);
            set(baseCurrentUserAtom, null);
        };

        if (update === 'logout') {
            set(currentUserLoadingAtom, true);
            await service.apiLogout();
            resetAllUserData();
            set(currentUserLoadingAtom, false);
            return;
        }

        if (update === RESET || update === undefined) {
            set(currentUserLoadingAtom, true);
            set(currentUserErrorAtom, null);
            const token = localStorage.getItem('authToken');
            if (!token) {
                set(currentUserLoadingAtom, false);
                set(baseCurrentUserAtom, null);
                return;
            }

            try {
                const user = await service.apiFetchCurrentUser();
                set(baseCurrentUserAtom, user);
                // After fetching user, trigger fetch for other data
                set(tasksAtom, RESET);
                set(userListsAtom, RESET);
                set(appearanceSettingsAtom, RESET);
                set(preferencesSettingsAtom, RESET);
                set(storedSummariesAtom, RESET);
            } catch (e: any) {
                set(currentUserErrorAtom, e.message || 'Not authenticated');
                resetAllUserData();
                // If token is invalid, log out
                if (e.message.includes('403') || e.message.includes('401')) {
                    await service.apiLogout();
                }
            } finally {
                set(currentUserLoadingAtom, false);
            }
            return;
        }

        if (update !== null && typeof update === 'object' && 'id' in update) {
            set(baseCurrentUserAtom, update as User);
            set(tasksAtom, RESET);
            set(userListsAtom, RESET);
            set(appearanceSettingsAtom, RESET);
            set(preferencesSettingsAtom, RESET);
            set(storedSummariesAtom, RESET);
        } else if (update === null) {
            set(baseCurrentUserAtom, null);
        }
    }
);
currentUserAtom.onMount = (setSelf) => {
    setSelf(undefined);
};

// --- Task Atoms ---
const baseTasksDataAtom = atom<Task[] | null>(null);
export const tasksLoadingAtom = atom<boolean>(true);
export const tasksErrorAtom = atom<string | null>(null);

export const tasksAtom: AsyncDataAtom<Task[]> = atom(
    (get) => get(baseTasksDataAtom),
    async (get, set, update) => {
        const currentUser = get(currentUserAtom);
        if (update === RESET) {
            if (!currentUser) {
                set(baseTasksDataAtom, []);
                set(tasksLoadingAtom, false);
                return;
            }
            set(tasksLoadingAtom, true);
            set(tasksErrorAtom, null);
            try {
                const fetchedTasks = await service.apiFetchTasks();
                const tasksWithCategory = fetchedTasks.map(t => ({...t, groupCategory: getTaskGroupCategory(t)}));
                set(baseTasksDataAtom, tasksWithCategory.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
            } catch (e: any) {
                set(tasksErrorAtom, e.message || 'Failed to fetch tasks');
                set(baseTasksDataAtom, []);
            } finally {
                set(tasksLoadingAtom, false);
            }
            return;
        }

        if (!currentUser) return;

        const previousTasks = get(baseTasksDataAtom) ?? [];
        const nextTasksUnprocessed = typeof update === 'function' ? (update as (prev: Task[] | null) => Task[])(previousTasks) : update;

        const nextTasksWithCategory = nextTasksUnprocessed.map(task => ({
            ...task,
            groupCategory: getTaskGroupCategory(task),
        }));

        set(baseTasksDataAtom, nextTasksWithCategory);

        // Optimistically create new tasks with temporary local IDs
        const newLocalTasks = nextTasksWithCategory.filter(t => t.id.startsWith('task-'));
        const existingTasks = nextTasksWithCategory.filter(t => !t.id.startsWith('task-'));

        const findTaskChangesForAPI = (prevTasks: Task[], nextTasks: Task[]) => {
            const prevMap = new Map(prevTasks.map(t => [t.id, t]));
            const updated: { id: string, changes: TaskUpdate }[] = [];
            const deleted: string[] = prevTasks.filter(p => !nextTasks.some(n => n.id === p.id)).map(t => t.id);

            for (const nextTask of nextTasks) {
                const prevTask = prevMap.get(nextTask.id);
                if (prevTask) {
                    let changes: TaskUpdate = {};
                    if (nextTask.title !== prevTask.title) changes.title = nextTask.title;
                    if (nextTask.content !== prevTask.content) changes.content = nextTask.content;
                    if (nextTask.completed !== prevTask.completed) changes.completed = nextTask.completed;
                    if (nextTask.completePercentage !== prevTask.completePercentage) changes.completePercentage = nextTask.completePercentage;
                    if (nextTask.dueDate !== prevTask.dueDate) changes.dueDate = nextTask.dueDate ? new Date(nextTask.dueDate).toISOString() : null;
                    if (nextTask.priority !== prevTask.priority) changes.priority = nextTask.priority;
                    if (nextTask.listId !== prevTask.listId) changes.listId = nextTask.listId;
                    if (nextTask.order !== prevTask.order) changes.order = nextTask.order;
                    if (JSON.stringify(nextTask.tags?.sort()) !== JSON.stringify(prevTask.tags?.sort())) changes.tags = nextTask.tags;

                    if (Object.keys(changes).length > 0) {
                        updated.push({id: nextTask.id, changes});
                    }
                }
            }
            return {updated, deleted};
        };


        // Handle creations first to get real IDs
        const creationPromises = newLocalTasks.map(async (taskToCreate) => {
            // 1. 分离出子任务数据
            const { subtasks: localSubtasks, ...mainTaskData } = taskToCreate;

            // 2. 准备创建主任务的载荷（不含子任务）
            const createPayload: TaskCreate = {
                title: mainTaskData.title,
                content: mainTaskData.content,
                listId: mainTaskData.listId,
                priority: mainTaskData.priority,
                tags: mainTaskData.tags,
                dueDate: mainTaskData.dueDate ? new Date(mainTaskData.dueDate).toISOString() : null,
                order: mainTaskData.order,
                completed: mainTaskData.completed,
                completePercentage: mainTaskData.completePercentage ?? 0,
            };

            // 3. 第一步：创建主任务
            const createdTask = await service.apiCreateTask(createPayload);

            // 4. 第二步：如果存在子任务，则循环调用创建子任务的接口
            if (localSubtasks && localSubtasks.length > 0) {
                const subtaskCreationPromises = localSubtasks.map(sub =>
                    service.apiCreateSubtask(createdTask.id, { title: sub.title })
                );
                // 等待所有子任务创建完成
                const createdSubtasks = await Promise.all(subtaskCreationPromises);
                // 将创建好的子任务附加到返回的任务对象上
                createdTask.subtasks = createdSubtasks;
            }

            return createdTask;
        });

        try {
            const createdTasks = await Promise.all(creationPromises);
            const finalTaskList = [...existingTasks, ...createdTasks.map(t => ({
                ...t,
                groupCategory: getTaskGroupCategory(t)
            }))];

            // Now diff the server-acknowledged state
            const {updated, deleted} = findTaskChangesForAPI(previousTasks, finalTaskList);

            const updatePromises = updated.map(({id, changes}) => service.apiUpdateTask(id, changes));
            const deletePromises = deleted.map(id => service.apiDeleteTask(id));

            await Promise.all([...updatePromises, ...deletePromises]);

            const fetchedTasks = await service.apiFetchTasks();
            const tasksWithCategory = fetchedTasks.map(t => ({...t, groupCategory: getTaskGroupCategory(t)}));
            set(baseTasksDataAtom, tasksWithCategory.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

        } catch (e: any) {
            console.error('[TasksAtom] Backend update failed, reverting:', e);
            set(tasksErrorAtom, e.message || 'Failed to sync tasks with server.');
            set(baseTasksDataAtom, previousTasks);
        }
    }
);
tasksAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- List Atoms ---
const baseUserListsAtom = atom<List[] | null>(null);
export const userListsLoadingAtom = atom<boolean>(true);
export const userListsErrorAtom = atom<string | null>(null);

export const userListsAtom: AsyncDataAtom<List[], List[] | ((prev: List[] | null) => List[]) | typeof RESET> = atom(
    (get) => get(baseUserListsAtom),
    async (get, set, update) => {
        const currentUser = get(currentUserAtom);
        if (update === RESET) {
            if (!currentUser) {
                set(baseUserListsAtom, []);
                set(userListsLoadingAtom, false);
                return;
            }
            set(userListsLoadingAtom, true);
            set(userListsErrorAtom, null);
            try {
                const fetched = await service.apiFetchLists();
                set(baseUserListsAtom, fetched);
            } catch (e: any) {
                set(userListsErrorAtom, e.message || 'Failed to load lists');
                set(baseUserListsAtom, []);
            } finally {
                set(userListsLoadingAtom, false);
            }
            return;
        }

        if (!currentUser) return;

        const nextLists = typeof update === 'function' ? (update as (prev: List[] | null) => List[])(get(baseUserListsAtom)) : update;
        set(baseUserListsAtom, nextLists);
    }
);
userListsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};


// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');

// --- Settings Atoms ---
export type DarkModeOption = 'light' | 'dark' | 'system';

const baseAppearanceSettingsAtom = atom<AppearanceSettings | null>(null);
export const appearanceSettingsLoadingAtom = atom<boolean>(true);
export const appearanceSettingsErrorAtom = atom<string | null>(null);

export const appearanceSettingsAtom: AsyncDataAtom<AppearanceSettings> = atom(
    (get) => get(baseAppearanceSettingsAtom),
    async (get, set, newSettingsParam) => {
        const currentUser = get(currentUserAtom);
        if (newSettingsParam === RESET) {
            if (!currentUser) {
                set(baseAppearanceSettingsAtom, defaultAppearanceSettingsForApi());
                set(appearanceSettingsLoadingAtom, false);
                return;
            }
            set(appearanceSettingsLoadingAtom, true);
            set(appearanceSettingsErrorAtom, null);
            try {
                const settings = await service.apiFetchSettings();
                set(baseAppearanceSettingsAtom, settings.appearance);
            } catch (e: any) {
                set(appearanceSettingsErrorAtom, e.message || 'Failed to load appearance settings');
                set(baseAppearanceSettingsAtom, defaultAppearanceSettingsForApi());
            } finally {
                set(appearanceSettingsLoadingAtom, false);
            }
            return;
        }
        if (!currentUser) return;
        const currentSettings = get(baseAppearanceSettingsAtom) ?? defaultAppearanceSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AppearanceSettings) => AppearanceSettings)(currentSettings) : newSettingsParam;
        set(baseAppearanceSettingsAtom, updatedSettings);
        try {
            const savedSettings = await service.apiUpdateAppearanceSettings(updatedSettings);
            set(baseAppearanceSettingsAtom, savedSettings);
        } catch (e: any) {
            set(baseAppearanceSettingsAtom, currentSettings);
            set(appearanceSettingsErrorAtom, e.message || 'API error saving appearance settings');
        }
    }
);
appearanceSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

export type DefaultNewTaskDueDate = null | 'today' | 'tomorrow';

const basePreferencesSettingsAtom = atom<PreferencesSettings | null>(null);
export const preferencesSettingsLoadingAtom = atom<boolean>(true);
export const preferencesSettingsErrorAtom = atom<string | null>(null);

export const preferencesSettingsAtom: AsyncDataAtom<PreferencesSettings> = atom(
    (get) => get(basePreferencesSettingsAtom),
    async (get, set, newSettingsParam) => {
        const currentUser = get(currentUserAtom);
        if (newSettingsParam === RESET) {
            if (!currentUser) {
                set(basePreferencesSettingsAtom, defaultPreferencesSettingsForApi());
                set(preferencesSettingsLoadingAtom, false);
                return;
            }
            set(preferencesSettingsLoadingAtom, true);
            set(preferencesSettingsErrorAtom, null);
            try {
                const settings = await service.apiFetchSettings();
                set(basePreferencesSettingsAtom, settings.preferences);
            } catch (e: any) {
                set(preferencesSettingsErrorAtom, e.message || 'Failed to load preferences');
                set(basePreferencesSettingsAtom, defaultPreferencesSettingsForApi());
            } finally {
                set(preferencesSettingsLoadingAtom, false);
            }
            return;
        }
        if (!currentUser) return;
        const currentSettings = get(basePreferencesSettingsAtom) ?? defaultPreferencesSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: PreferencesSettings) => PreferencesSettings)(currentSettings) : newSettingsParam;
        set(basePreferencesSettingsAtom, updatedSettings);
        try {
            const savedSettings = await service.apiUpdatePreferencesSettings(updatedSettings);
            set(basePreferencesSettingsAtom, savedSettings);
        } catch (e: any) {
            set(basePreferencesSettingsAtom, currentSettings);
            set(preferencesSettingsErrorAtom, e.message || 'API error saving preferences');
        }
    }
);
preferencesSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

export type PremiumSettings = { tier: 'free' | 'pro'; subscribedUntil: number | null; };
export const premiumSettingsAtom = atom((get): PremiumSettings => {
    const user = get(currentUserAtom);
    return user?.isPremium ? {tier: 'pro', subscribedUntil: null} : {tier: 'free', subscribedUntil: null};
});

// --- Summary Atoms ---
export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());

const baseStoredSummariesAtom = atom<StoredSummary[] | null>(null);
export const storedSummariesLoadingAtom = atom<boolean>(true);
export const storedSummariesErrorAtom = atom<string | null>(null);

export const storedSummariesAtom: AsyncDataAtom<StoredSummary[], StoredSummary[] | ((prev: StoredSummary[] | null) => StoredSummary[]) | typeof RESET> = atom(
    (get) => get(baseStoredSummariesAtom),
    async (get, set, update) => {
        const currentUser = get(currentUserAtom);
        if (update === RESET) {
            if (!currentUser) {
                set(baseStoredSummariesAtom, []);
                set(storedSummariesLoadingAtom, false);
                return;
            }
            set(storedSummariesLoadingAtom, true);
            set(storedSummariesErrorAtom, null);
            try {
                const fetched = await service.apiFetchSummaries();
                set(baseStoredSummariesAtom, fetched);
            } catch (e: any) {
                set(storedSummariesErrorAtom, e.message || 'Failed to load summaries');
                set(baseStoredSummariesAtom, []);
            } finally {
                set(storedSummariesLoadingAtom, false);
            }
            return;
        }

        if (!currentUser) return;
        const updatedSummaries = typeof update === 'function' ? (update as (prev: StoredSummary[] | null) => StoredSummary[])(get(baseStoredSummariesAtom) ?? []) : update;
        set(baseStoredSummariesAtom, updatedSummaries);
    }
);
storedSummariesAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);
export const SUMMARY_FIELD_OPTIONS: { id: string; label: string }[] = [{
    id: 'accomplishments',
    label: '今日工作总结'
}, {id: 'tomorrowPlan', label: '明日工作计划'}, {id: 'challenges', label: '遇到的问题与困难'}, {
    id: 'teamCommunication',
    label: '团队沟通情况'
}, {id: 'learnings', label: '学习与成长收获'}, {id: 'blockers', label: '当前主要瓶颈'},];
export const summarySelectedFieldsAtom = atom<string[]>([SUMMARY_FIELD_OPTIONS[0].id, SUMMARY_FIELD_OPTIONS[1].id]);

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