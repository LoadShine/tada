// src/store/atoms.ts
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
} from '@/utils/dateUtils';

// --- Base Atoms ---

export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg',
    isPremium: true,
});

export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    if (task.completed || task.list === 'Trash') {
        return 'nodate';
    }
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';
        const today = startOfDay(new Date());
        const taskDay = startOfDay(dueDateObj);
        if (isBefore(taskDay, today)) return 'overdue';
        if (isSameDay(taskDay, today)) return 'today';
        const sevenDaysFromTodayEnd = endOfDay(addDays(today, 6));
        if (isWithinNext7Days(taskDay)) return 'next7days';
        if (isAfter(taskDay, sevenDaysFromTodayEnd)) return 'later';
    }
    return 'nodate';
};

const initialTasksDataRaw: Omit<Task, 'groupCategory' | 'completed' | 'completedAt'>[] = [
    {
        id: '11',
        title: '体检预约',
        completionPercentage: 50,
        dueDate: subDays(startOfDay(new Date()), 2).setHours(10, 0, 0, 0),
        list: 'Personal',
        content: 'Called the clinic, waiting for callback.\n\n- Follow up on Friday if no response.\n- Check fasting requirements.',
        order: 7,
        createdAt: subDays(new Date(), 4).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 1,
        subtasks: [
            {
                id: 'sub11-1',
                parentId: '11',
                title: 'Call Dr. Smith\'s office',
                completed: true,
                completedAt: subDays(new Date(), 3).getTime(),
                order: 0,
                createdAt: subDays(new Date(), 4).getTime(),
                updatedAt: subDays(new Date(), 3).getTime(),
                dueDate: subDays(startOfDay(new Date()), 3).setHours(9, 0, 0, 0),
            },
            {
                id: 'sub11-2',
                parentId: '11',
                title: 'Confirm insurance coverage for annual check-up and blood work',
                completed: false,
                completedAt: null,
                order: 1,
                createdAt: subDays(new Date(), 4).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
                dueDate: subDays(startOfDay(new Date()), 2).setHours(14, 0, 0, 0),
            },
        ]
    },
    {
        id: '1',
        title: '施工组织设计评审表',
        completionPercentage: 50,
        dueDate: new Date().setHours(14, 0, 0, 0),
        list: 'Work',
        content: 'Review the construction plan details. Focus on safety section.\n\nKey points to check:\n- Emergency evacuation plan\n- PPE requirements\n- Hazard identification',
        order: 0,
        createdAt: subDays(new Date(), 3).getTime(),
        updatedAt: subDays(new Date(), 3).getTime(),
        priority: 1,
        tags: ['review', 'urgent'],
        subtasks: [
            {
                id: 'sub1-1',
                parentId: '1',
                title: 'Check safety compliance checklist (Sections A-C)',
                completed: true,
                completedAt: new Date().getTime(),
                order: 0,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: new Date().getTime(),
                dueDate: new Date().setHours(10, 0, 0, 0)
            },
            {
                id: 'sub1-2',
                parentId: '1',
                title: 'Verify material specifications against approved list',
                completed: false,
                completedAt: null,
                order: 1,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
                dueDate: new Date().setHours(11, 30, 0, 0)
            },
            {
                id: 'sub1-3',
                parentId: '1',
                title: 'Write feedback summary for presentation',
                completed: false,
                completedAt: null,
                order: 2,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
            },
        ]
    },
    {
        id: '8',
        title: '准备明天会议材料 (已完成)',
        completionPercentage: 100,
        dueDate: new Date().setHours(18, 0, 0, 0),
        list: 'Work',
        content: 'Finalize slides, add Q&A section. Print 5 copies.',
        order: 1,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 1,
    },
    {
        id: '2',
        title: '开发框架讲解',
        completionPercentage: 20,
        dueDate: addDays(startOfDay(new Date()), 1).setHours(10, 30, 0, 0),
        list: 'Work',
        content: 'Prepare slides for the team meeting. Outline done.\n\nInclude:\n- Core concepts\n- Best practices\n- Common pitfalls',
        order: 2,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 2
    },
    {
        id: '10',
        title: '研究 CodeMirror Themes',
        completionPercentage: 50,
        dueDate: null,
        list: 'Dev',
        content: 'Found a few potential themes, need to test compatibility with current setup.\n\nConsiderations:\n- Light/Dark mode support\n- Readability\n- Performance',
        order: 5,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: new Date().getTime(),
        priority: 3
    },
    {
        id: '13',
        title: '欢迎加入Tada',
        completionPercentage: 0,
        dueDate: null,
        list: 'Inbox',
        content: 'Try creating your first task! You can add subtasks too, and set precise due dates with times.',
        order: 12,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime()
    },
];

const initialTasks: Task[] = initialTasksDataRaw
    .map(taskRaw => {
        const now = Date.now();
        const percentage = taskRaw.completionPercentage ?? null;
        const isCompleted = percentage === 100;
        let dueDateTimestamp: number | null = null;
        if (taskRaw.dueDate !== null && taskRaw.dueDate !== undefined) {
            const parsedDate = safeParseDate(taskRaw.dueDate);
            if (parsedDate && isValid(parsedDate)) dueDateTimestamp = parsedDate.getTime();
        }
        const subtasks = (taskRaw.subtasks || []).map(subRaw => ({
            ...subRaw,
            createdAt: subRaw.createdAt || now,
            updatedAt: subRaw.updatedAt || now,
            completedAt: subRaw.completed ? (subRaw.completedAt || subRaw.updatedAt || now) : null,
            dueDate: subRaw.dueDate ? safeParseDate(subRaw.dueDate)?.getTime() ?? null : null,
        })).sort((a, b) => a.order - b.order);

        const taskPartial: Omit<Task, 'groupCategory'> = {
            id: taskRaw.id, title: taskRaw.title, completed: isCompleted, completionPercentage: percentage,
            dueDate: dueDateTimestamp, list: taskRaw.list, content: taskRaw.content ?? '', order: taskRaw.order,
            createdAt: taskRaw.createdAt, updatedAt: taskRaw.updatedAt ?? now,
            completedAt: isCompleted ? (taskRaw.updatedAt ?? now) : null,
            tags: taskRaw.tags ?? [], priority: taskRaw.priority ?? null, subtasks: subtasks,
        };
        return {...taskPartial, groupCategory: getTaskGroupCategory(taskPartial)};
    })
    .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));

const baseTasksAtom = atomWithStorage<Task[]>('tasks_v11_ux_final_final', initialTasks, undefined, {getOnInit: true});

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
            let updatedTask = {...task};

            if (updatedTask.subtasks) {
                updatedTask.subtasks = updatedTask.subtasks.map(sub => {
                    const prevSub = previousTaskState?.subtasks?.find(ps => ps.id === sub.id);
                    let subChanged = !prevSub ||
                        sub.title !== prevSub.title ||
                        sub.completed !== prevSub.completed ||
                        sub.dueDate !== prevSub.dueDate ||
                        sub.order !== prevSub.order;
                    return {
                        ...sub,
                        parentId: updatedTask.id,
                        createdAt: sub.createdAt || now,
                        updatedAt: subChanged ? now : (sub.updatedAt || now),
                        completedAt: sub.completed ? (sub.completedAt || (subChanged ? now : sub.updatedAt) || now) : null,
                    };
                }).sort((a, b) => a.order - b.order);
            } else {
                updatedTask.subtasks = [];
            }

            if (updatedTask.list !== 'Trash') {
                const allSubtasksCompleted = updatedTask.subtasks.length > 0 && updatedTask.subtasks.every(s => s.completed);
                const anySubtaskIncomplete = updatedTask.subtasks.some(s => !s.completed);

                if (allSubtasksCompleted) {
                    if (!updatedTask.completed || updatedTask.completionPercentage !== 100) {
                        updatedTask.completed = true;
                        updatedTask.completionPercentage = 100;
                        updatedTask.completedAt = now;
                    }
                } else if (anySubtaskIncomplete) {
                    if (updatedTask.completed && updatedTask.completionPercentage === 100) {
                        updatedTask.completed = false;
                        updatedTask.completionPercentage = null;
                        updatedTask.completedAt = null;
                    }
                }
                if (updatedTask.completed && updatedTask.completionPercentage === 100) {
                    updatedTask.subtasks = updatedTask.subtasks.map(s => s.completed ? s : {
                        ...s,
                        completed: true,
                        completedAt: now,
                        updatedAt: now
                    });
                }
            }


            let latestSubtaskDueDate: number | null = null;
            if (updatedTask.subtasks.length > 0) {
                updatedTask.subtasks.forEach(sub => {
                    if (sub.dueDate && (latestSubtaskDueDate === null || sub.dueDate > latestSubtaskDueDate)) {
                        latestSubtaskDueDate = sub.dueDate;
                    }
                });
            }
            if (latestSubtaskDueDate && (updatedTask.dueDate === null || updatedTask.dueDate === undefined || updatedTask.dueDate < latestSubtaskDueDate)) {
                updatedTask.dueDate = latestSubtaskDueDate;
            }

            let currentPercentage = updatedTask.completionPercentage ?? null;
            let isCompleted = updatedTask.completed;

            if (updatedTask.list === 'Trash') {
                currentPercentage = null;
                isCompleted = false;
            } else {
                if (previousTaskState && updatedTask.completionPercentage !== previousTaskState.completionPercentage && updatedTask.completionPercentage !== undefined) {
                    currentPercentage = updatedTask.completionPercentage === 0 ? null : updatedTask.completionPercentage;
                    isCompleted = currentPercentage === 100;
                } else if (previousTaskState && updatedTask.completed !== undefined && updatedTask.completed !== previousTaskState.completed) {
                    isCompleted = updatedTask.completed;
                    currentPercentage = isCompleted ? 100 : (previousTaskState.completionPercentage === 100 ? null : previousTaskState.completionPercentage);
                } else if (currentPercentage === 100 && !isCompleted) isCompleted = true;
                else if (currentPercentage !== 100 && isCompleted) currentPercentage = 100;

            }

            const newCompletedAt = isCompleted ? (updatedTask.completedAt ?? previousTaskState?.completedAt ?? updatedTask.updatedAt ?? now) : null;

            const validatedTask: Omit<Task, 'groupCategory'> = {
                ...updatedTask,
                content: updatedTask.content ?? '',
                tags: updatedTask.tags ?? [],
                priority: updatedTask.priority ?? null,
                completionPercentage: currentPercentage,
                completed: isCompleted,
                completedAt: newCompletedAt,
                updatedAt: updatedTask.updatedAt ?? (previousTaskState?.updatedAt ?? updatedTask.createdAt),
                subtasks: updatedTask.subtasks,
            };

            const newCategory = getTaskGroupCategory(validatedTask);
            const finalTask = {...validatedTask, groupCategory: newCategory};

            let changed = false;
            if (!previousTaskState) {
                changed = true;
            } else {
                const relevantFields: (keyof Task)[] = ['title', 'completionPercentage', 'completed', 'dueDate', 'list', 'content', 'order', 'priority'];
                for (const field of relevantFields) {
                    if (JSON.stringify(finalTask[field]) !== JSON.stringify(previousTaskState[field])) {
                        changed = true;
                        break;
                    }
                }
                if (!changed && JSON.stringify(finalTask.tags?.sort()) !== JSON.stringify(previousTaskState.tags?.sort())) changed = true;
                if (!changed && finalTask.groupCategory !== previousTaskState.groupCategory) changed = true;
                if (!changed) {
                    const prevSubs = previousTaskState.subtasks || [];
                    const finalSubs = finalTask.subtasks || [];
                    if (prevSubs.length !== finalSubs.length) {
                        changed = true;
                    } else {
                        for (let i = 0; i < finalSubs.length; i++) {
                            if (JSON.stringify(finalSubs[i]) !== JSON.stringify(prevSubs[i])) {
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }

            return changed ? {...finalTask, updatedAt: now} : {...finalTask, updatedAt: previousTaskState!.updatedAt};
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
export const storedSummariesAtom = atomWithStorage<StoredSummary[]>('tada_summaries_v2_radix', [], summaryStorage, {getOnInit: true});
export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

// --- Derived Atoms ---
export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    return selectedId ? tasks.find(task => task.id === selectedId) ?? null : null;
});
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal'];
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists_v2_radix', initialUserLists, undefined, {getOnInit: true});
export const userListNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const userLists = get(userDefinedListsAtom);
    const listsFromTasks = new Set<string>(tasks.filter(t => t.list !== 'Trash' && t.list).map(t => t.list!));
    const combinedLists = new Set(['Inbox', ...userLists, ...Array.from(listsFromTasks)]);
    combinedLists.delete('Trash');
    return Array.from(combinedLists).sort((a, b) => a === 'Inbox' ? -1 : b === 'Inbox' ? 1 : a.localeCompare(b));
});
export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    tasks.filter(t => t.list !== 'Trash').forEach(task => task.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasksCount = tasks.length - activeTasks.length;
    const counts = {
        all: 0,
        today: 0,
        next7days: 0,
        completed: 0,
        trash: trashedTasksCount,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };
    activeTasks.forEach(task => {
        if (task.completed) counts.completed++; else {
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
    const tasksToGroup = get(tasksAtom).filter(t => t.list !== 'Trash' && !t.completed).sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    const groups: Record<TaskGroupCategory, Task[]> = {overdue: [], today: [], next7days: [], later: [], nodate: []};
    tasksToGroup.forEach(task => {
        const category = task.groupCategory;
        if (Object.prototype.hasOwnProperty.call(groups, category)) groups[category].push(task); else groups.nodate.push(task);
    });
    return groups;
});
export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom);
    const searchWords = search.split(' ').filter(Boolean);
    return allTasks.filter(task => searchWords.every(word => task.title.toLowerCase().includes(word) || (task.content && task.content.toLowerCase().includes(word)) || (task.tags && task.tags.some(tag => tag.toLowerCase().includes(word))) || (task.list.toLowerCase().includes(word)) || (task.subtasks && task.subtasks.some(sub => sub.title.toLowerCase().includes(word))))).sort((a, b) => {
        const aIsActive = a.list !== 'Trash' && !a.completed;
        const bIsActive = b.list !== 'Trash' && !b.completed;
        if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt - b.createdAt);
    });
});
export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr = typeof period === 'string' ? period : `custom_${startOfDay(period.start).getTime()}_${endOfDay(period.end).getTime()}`;
    const listStr = list === 'all' ? 'all' : `list-${list}`;
    return `${periodStr}__${listStr}`;
});
export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom);
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const todayStart = startOfDay(new Date());
    let startDate: Date | null = null, endDate: Date | null = null;
    switch (period) {
        case 'today':
            startDate = todayStart;
            endDate = endOfDay(new Date());
            break;
        case 'yesterday':
            startDate = startOfDay(subDays(todayStart, 1));
            endDate = endOfDay(startDate);
            break;
        case 'thisWeek':
            startDate = startOfWeek(todayStart);
            endDate = endOfWeek(todayStart);
            break;
        case 'lastWeek':
            startDate = startOfWeek(subWeeks(todayStart, 1));
            endDate = endOfWeek(startDate);
            break;
        case 'thisMonth':
            startDate = startOfMonth(todayStart);
            endDate = endOfMonth(todayStart);
            break;
        case 'lastMonth':
            startDate = startOfMonth(subMonths(todayStart, 1));
            endDate = endOfMonth(startDate);
            break;
        default:
            if (typeof period === 'object') {
                startDate = startOfDay(new Date(period.start));
                endDate = endOfDay(new Date(period.end));
            }
            break;
    }
    if ((startDate && !isValid(startDate)) || (endDate && !isValid(endDate))) return [];
    return allTasks.filter(task => {
        if (task.list === 'Trash' || task.completionPercentage === null || task.completionPercentage === 0) return false;
        if (listFilter !== 'all' && task.list !== listFilter) return false;
        if (startDate && endDate) {
            if (!task.dueDate) return false;
            const dueDate = safeParseDate(task.dueDate);
            if (!dueDate || !isValid(dueDate)) return false;
            const dueDateStart = startOfDay(dueDate);
            if (isBefore(dueDateStart, startDate) || isAfter(dueDateStart, endDate)) return false;
        }
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
    const summaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    return summaries[index] ?? null;
});
export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const summary = get(currentDisplayedSummaryAtom);
    if (!summary) return [];
    const tasks = get(tasksAtom);
    const ids = new Set(summary.taskIds);
    return tasks.filter(t => ids.has(t.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order);
});