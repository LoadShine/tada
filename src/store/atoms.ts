import {atom} from 'jotai';
import {atomWithStorage, createJSONStorage, RESET} from 'jotai/utils';
import {SettingsTab, Task, TaskFilter, TaskGroupCategory, User} from '@/types';
import {
    addDays,
    endOfDay,
    endOfMonth,
    endOfWeek,
    isAfter,
    isBefore,
    isOverdue as isOverdueCheck,
    isSameDay,
    isToday as isTodayCheck,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks
} from '@/lib/utils/dateUtils'; // Assuming dateUtils is moved

// --- Base Atoms ---
export const currentUserAtom = atom<User | null>({
    id: '1', name: 'Liu Yunpeng', email: 'yp.leao@gmail.com',
    avatar: 'https://github.com/shadcn.png', // Example shadcn avatar
    isPremium: true,
});

// Helper function to determine task group category
export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    if (task.completed || task.list === 'Trash') return 'nodate';
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';
        const today = startOfDay(new Date());
        const taskDay = startOfDay(dueDateObj);
        if (isBefore(taskDay, today)) return 'overdue';
        if (isSameDay(taskDay, today)) return 'today';
        const tomorrow = startOfDay(addDays(today, 1));
        const sevenDaysFromTodayEnd = endOfDay(addDays(today, 6));
        if (!isBefore(taskDay, tomorrow) && !isAfter(taskDay, sevenDaysFromTodayEnd)) return 'next7days';
        if (isAfter(taskDay, sevenDaysFromTodayEnd)) return 'later';
    }
    return 'nodate';
};

// Sample Data
const initialTasksDataRaw = [
    {
        id: '11',
        title: '体检预约',
        completionPercentage: 50,
        dueDate: subDays(startOfDay(new Date()), 2),
        list: 'Personal',
        content: 'Called the clinic, waiting for callback.',
        order: 7,
        createdAt: subDays(new Date(), 4).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 1
    },
    {
        id: '1',
        title: '施工组织设计评审表',
        completionPercentage: 50,
        dueDate: startOfDay(new Date()),
        list: 'Work',
        content: 'Review the construction plan details.',
        order: 0,
        createdAt: subDays(new Date(), 3).getTime(),
        updatedAt: subDays(new Date(), 3).getTime(),
        priority: 1,
        tags: ['review', 'urgent']
    },
    {
        id: '8',
        title: '准备明天会议材料',
        completionPercentage: 100,
        dueDate: startOfDay(new Date()),
        list: 'Work',
        content: 'Finalize slides, need to add Q&A section.',
        order: 1,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 1,
        completedAt: new Date().getTime()
    },
    {
        id: '2',
        title: '开发框架讲解',
        completionPercentage: 20,
        dueDate: addDays(startOfDay(new Date()), 1),
        list: 'Work',
        content: 'Prepare slides for the team meeting. Outline done.',
        order: 2,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 2
    },
    {
        id: '3',
        title: 'RESTful讲解',
        completionPercentage: 0,
        dueDate: addDays(startOfDay(new Date()), 3),
        list: 'Work',
        content: '',
        order: 3,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        tags: ['presentation']
    },
    {
        id: '9',
        title: '下周项目规划',
        completionPercentage: null,
        dueDate: addDays(startOfDay(new Date()), 10),
        list: 'Planning',
        content: 'Define milestones for Q4.',
        order: 6,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime()
    },
    {
        id: '4',
        title: '欢迎加入Tada',
        completionPercentage: 100,
        dueDate: null,
        list: 'Inbox',
        content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary',
        order: 4,
        createdAt: subDays(new Date(), 5).getTime(),
        updatedAt: subDays(new Date(), 5).getTime(),
        completedAt: subDays(new Date(), 3).getTime()
    },
    {
        id: '10',
        title: '研究 CodeMirror Themes',
        completionPercentage: 50,
        dueDate: null,
        list: 'Dev',
        content: 'Found a few potential themes, need to test.',
        order: 5,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: new Date().getTime(),
        priority: 3
    },
    {
        id: '5',
        title: '我能用Tada做什么?',
        completionPercentage: 100,
        dueDate: null,
        list: 'Inbox',
        content: 'Organize life, track projects, collaborate.',
        order: 8,
        createdAt: subDays(new Date(), 4).getTime(),
        completedAt: new Date().getTime(),
        updatedAt: new Date().getTime()
    },
    {
        id: '7',
        title: 'Swagger2讲解 (Completed)',
        completionPercentage: 100,
        dueDate: new Date(2024, 5, 14).getTime(),
        list: 'Work',
        content: 'Focus on API documentation standards.',
        order: 10,
        createdAt: new Date(2024, 5, 10).getTime(),
        updatedAt: new Date(2024, 5, 14, 15, 0, 0).getTime(),
        completedAt: new Date(2024, 5, 14, 15, 0, 0).getTime()
    },
    {
        id: '6',
        title: '研究一下patch (Trashed)',
        completionPercentage: null,
        dueDate: new Date(2024, 5, 13).getTime(),
        list: 'Trash',
        content: '',
        order: 9,
        createdAt: new Date(2024, 5, 10).getTime(),
        updatedAt: new Date(2024, 5, 10).getTime()
    },
    {
        id: '12',
        title: 'Confirm Dentist Appointment',
        completionPercentage: 0,
        dueDate: addDays(startOfDay(new Date()), 2),
        list: 'Personal',
        content: 'Call Dr. Smith office.',
        order: 11,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 2
    },
    {
        id: '13',
        title: 'Buy Groceries',
        completionPercentage: 80,
        dueDate: null,
        list: 'Inbox',
        content: 'Milk, Eggs, Bread. Almost done.',
        order: 12,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime()
    },
];

// Initialize tasks with calculated groupCategory and derived completed status
const initialTasks: Task[] = initialTasksDataRaw
    .map(taskRaw => {
        const now = Date.now();
        const percentage = taskRaw.completionPercentage ?? 0;
        const isCompleted = percentage === 100;
        const dueDateTimestamp = taskRaw.dueDate instanceof Date && isValid(taskRaw.dueDate)
            ? taskRaw.dueDate.getTime()
            : (taskRaw.dueDate === null ? null : undefined);
        if (dueDateTimestamp === undefined && taskRaw.dueDate !== null) {
            console.warn(`Invalid dueDate encountered for task "${taskRaw.title}". Setting to null.`);
        }
        const taskPartial: Omit<Task, 'groupCategory'> = {
            ...taskRaw,
            completed: isCompleted,
            completionPercentage: taskRaw.completionPercentage,
            dueDate: dueDateTimestamp === undefined ? null : dueDateTimestamp,
            completedAt: isCompleted ? (taskRaw.completedAt ?? taskRaw.updatedAt ?? now) : null,
            updatedAt: taskRaw.updatedAt ?? now,
            tags: taskRaw.tags ?? [],
            priority: taskRaw.priority ?? null,
            content: taskRaw.content ?? '',
        };
        return {
            ...taskPartial,
            groupCategory: getTaskGroupCategory(taskPartial),
        };
    })
    .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));

// Atom for storing the raw task list with persistence
const baseTasksAtom = atomWithStorage<Task[]>('tasks_v7_shadcn', initialTasks, undefined, {getOnInit: true});

// Main tasks atom with refined setter logic
export const tasksAtom = atom(
    (get) => get(baseTasksAtom),
    (get, set, update: Task[] | ((prev: Task[]) => Task[]) | typeof RESET) => {
        if (update === RESET) {
            set(baseTasksAtom, initialTasks);
            return;
        }
        const previousTasks = get(baseTasksAtom);
        const nextTasksRaw = typeof update === 'function' ? update(previousTasks) : update;
        const now = Date.now();

        const nextTasksProcessed = nextTasksRaw.map(task => {
            const previousTaskState = previousTasks.find(p => p.id === task.id);
            let currentPercentage = task.completionPercentage ?? null;
            let isCompleted = task.completed;

            if (task.list === 'Trash') {
                currentPercentage = null;
                isCompleted = false;
            } else if (previousTaskState && task.completed !== undefined && task.completed !== previousTaskState.completed) {
                currentPercentage = task.completed ? 100 : (previousTaskState.completionPercentage === 100 ? null : previousTaskState.completionPercentage);
                isCompleted = task.completed;
            } else if (task.completionPercentage !== undefined && (!previousTaskState || task.completionPercentage !== previousTaskState.completionPercentage)) {
                isCompleted = task.completionPercentage === 100;
                currentPercentage = task.completionPercentage === 0 ? null : task.completionPercentage;
            } else {
                isCompleted = currentPercentage === 100;
            }

            const newCompletedAt = isCompleted ? (task.completedAt ?? previousTaskState?.completedAt ?? task.updatedAt ?? now) : null;
            const validatedTask = {
                ...task,
                content: task.content ?? '', tags: task.tags ?? [], priority: task.priority ?? null,
                completionPercentage: currentPercentage, completed: isCompleted, completedAt: newCompletedAt,
                updatedAt: task.updatedAt
            };
            const newCategory = getTaskGroupCategory(validatedTask);

            let changed = false;
            if (!previousTaskState) {
                changed = true;
            } else {
                if (validatedTask.title !== previousTaskState.title ||
                    validatedTask.completionPercentage !== previousTaskState.completionPercentage ||
                    validatedTask.completed !== previousTaskState.completed ||
                    validatedTask.dueDate !== previousTaskState.dueDate ||
                    validatedTask.list !== previousTaskState.list ||
                    validatedTask.content !== previousTaskState.content ||
                    validatedTask.order !== previousTaskState.order ||
                    validatedTask.priority !== previousTaskState.priority ||
                    JSON.stringify(validatedTask.tags) !== JSON.stringify(previousTaskState.tags) ||
                    newCategory !== previousTaskState.groupCategory ||
                    validatedTask.completedAt !== previousTaskState.completedAt) {
                    changed = true;
                }
            }

            if (changed) {
                return {...validatedTask, groupCategory: newCategory, updatedAt: now};
            } else {
                // Optimization: return previous state object reference if no functional change
                // Check if groupCategory needs explicit update even if other fields didn't change
                if (newCategory !== previousTaskState!.groupCategory) {
                    return {...previousTaskState!, groupCategory: newCategory, updatedAt: now};
                }
                return previousTaskState!;
            }
        });

        if (JSON.stringify(nextTasksProcessed) !== JSON.stringify(previousTasks)) {
            set(baseTasksAtom, nextTasksProcessed);
        }
    }
);


// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');

// --- Summary View Atoms ---
export interface StoredSummary {
    id: string;
    createdAt: number;
    periodKey: string;
    listKey: string;
    taskIds: string[];
    summaryText: string;
    updatedAt?: number;
}

export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());
const summaryStorage = createJSONStorage<StoredSummary[]>(() => localStorage);
export const storedSummariesAtom = atomWithStorage<StoredSummary[]>(
    'tada_summaries_v1_shadcn', [], summaryStorage, {getOnInit: true}
);
export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

// --- Derived Atoms ---
export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    if (!selectedId) return null;
    return tasks.find(task => task.id === selectedId) ?? null;
});

const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal'];
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists_v1_shadcn', initialUserLists, undefined, {getOnInit: true});

export const userListNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const userLists = get(userDefinedListsAtom);
    const listsFromTasks = new Set<string>();
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        if (task.list) listsFromTasks.add(task.list)
    });
    const combinedLists = new Set(['Inbox', ...userLists, ...Array.from(listsFromTasks)]);
    combinedLists.delete('Trash');
    return Array.from(combinedLists).sort((a, b) => {
        if (a === 'Inbox') return -1;
        if (b === 'Inbox') return 1;
        return a.localeCompare(b);
    });
});

export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        task.tags?.forEach(tag => tags.add(tag))
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});

export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const counts = {
        all: 0, today: 0, next7days: 0, completed: 0,
        trash: tasks.filter(task => task.list === 'Trash').length,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };
    activeTasks.forEach(task => {
        if (task.completed) {
            counts.completed++;
        } else {
            counts.all++;
            if (task.dueDate != null) {
                const date = safeParseDate(task.dueDate);
                if (date && isValid(date)) {
                    if (isTodayCheck(date)) counts.today++;
                    if (!isOverdueCheck(date) && isWithinNext7Days(date)) counts.next7days++;
                }
            }
            if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) counts.lists[task.list]++;
            task.tags?.forEach(tag => {
                if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) counts.tags[tag]++;
            });
        }
    });
    return counts;
});

export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    const tasksToGroup = get(tasksAtom).filter(task => task.list !== 'Trash' && !task.completed).sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    const groups: Record<TaskGroupCategory, Task[]> = {overdue: [], today: [], next7days: [], later: [], nodate: []};
    tasksToGroup.forEach(task => {
        const category = task.groupCategory;
        if (Object.prototype.hasOwnProperty.call(groups, category)) groups[category].push(task);
        else {
            console.warn(`Task ${task.id} in groupedAllTasksAtom has unexpected category: ${category}. Placing in 'nodate'.`);
            groups.nodate.push(task);
        }
    });
    return groups;
});

export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom);
    const searchWords = search.split(' ').filter(Boolean);
    return allTasks.filter(task =>
        searchWords.every(word =>
            task.title.toLowerCase().includes(word) ||
            (task.content && task.content.toLowerCase().includes(word)) ||
            (task.tags && task.tags.some(tag => tag.toLowerCase().includes(word))) ||
            (task.list.toLowerCase().includes(word))
        )
    ).sort((a, b) => {
        const aIsActive = a.list !== 'Trash' && !a.completed;
        const bIsActive = b.list !== 'Trash' && !b.completed;
        if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt - b.createdAt);
    });
});

// --- Derived Atoms for Summary View ---
export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr: string;
    if (typeof period === 'string') periodStr = period;
    else periodStr = `custom_${startOfDay(period.start).getTime()}_${endOfDay(period.end).getTime()}`;
    const listStr = list === 'all' ? 'all' : `list-${list}`;
    return `${periodStr}__${listStr}`;
});

export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom);
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const now = new Date();
    const todayStart = startOfDay(now), todayEnd = endOfDay(now);
    let startDate: Date | null = null, endDate: Date | null = null;
    switch (period) {
        case 'today':
            startDate = todayStart;
            endDate = todayEnd;
            break;
        case 'yesterday':
            startDate = startOfDay(subDays(todayStart, 1));
            endDate = endOfDay(subDays(todayStart, 1));
            break;
        case 'thisWeek':
            startDate = startOfWeek(todayStart);
            endDate = endOfWeek(todayStart);
            break;
        case 'lastWeek':
            const lwStart = startOfWeek(subWeeks(todayStart, 1));
            startDate = lwStart;
            endDate = endOfWeek(lwStart);
            break;
        case 'thisMonth':
            startDate = startOfMonth(todayStart);
            endDate = endOfMonth(todayStart);
            break;
        case 'lastMonth':
            const lmStart = startOfMonth(subMonths(todayStart, 1));
            startDate = lmStart;
            endDate = endOfMonth(lmStart);
            break;
        default:
            if (typeof period === 'object' && period.start && period.end) {
                startDate = startOfDay(new Date(period.start));
                endDate = endOfDay(new Date(period.end));
            }
            break;
    }
    if ((startDate && !isValid(startDate)) || (endDate && !isValid(endDate))) return [];
    return allTasks.filter(task => {
        if (task.completionPercentage === null || task.completionPercentage === 0) return false;
        if (listFilter !== 'all' && task.list !== listFilter) return false;
        if (startDate && endDate) {
            if (!task.dueDate) return false;
            const dueDate = safeParseDate(task.dueDate);
            if (!dueDate || !isValid(dueDate)) return false;
            const dueDateStart = startOfDay(dueDate);
            if (isBefore(dueDateStart, startDate) || isAfter(dueDateStart, endDate)) return false;
        }
        if (task.list === 'Trash') return false;
        return true;
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order || a.createdAt - b.createdAt);
});

export const relevantStoredSummariesAtom = atom<StoredSummary[]>((get) => {
    const allSummaries = get(storedSummariesAtom);
    const filterKey = get(currentSummaryFilterKeyAtom);
    const [periodKey, listKey] = filterKey.split('__');
    return allSummaries.filter(s => s.periodKey === periodKey && s.listKey === listKey).sort((a, b) => b.createdAt - a.createdAt);
});

export const currentDisplayedSummaryAtom = atom<StoredSummary | null>((get) => {
    const relevantSummaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    return relevantSummaries[index] ?? null;
});

export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const currentSummary = get(currentDisplayedSummaryAtom);
    if (!currentSummary) return [];
    const allTasks = get(tasksAtom);
    const referencedIds = new Set(currentSummary.taskIds);
    return allTasks.filter(task => referencedIds.has(task.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order);
});