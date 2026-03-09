import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { Task, TaskGroupCategory } from '@/types';
import {
    isBefore, isSameDay, isValid, isWithinNext7Days,
    safeParseDate, startOfDay
} from '@/utils/dateUtils';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from './types';

/**
 * Determines the group category for a task based on its due date and status.
 */
export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    if (task.completed || task.listName === 'Trash') {
        return 'nodate';
    }

    const dueDateObj = task.dueDate ? safeParseDate(task.dueDate) : null;
    const startDateObj = task.startDate ? safeParseDate(task.startDate) : null;

    const hasValidDue = dueDateObj && isValid(dueDateObj);
    const hasValidStart = startDateObj && isValid(startDateObj);

    if (!hasValidDue && !hasValidStart) return 'nodate';

    const today = startOfDay(new Date());
    const startDay = hasValidStart ? startOfDay(startDateObj!) : null;
    const dueDay = hasValidDue ? startOfDay(dueDateObj!) : null;

    const todayTime = today.getTime();
    const startTime = startDay ? startDay.getTime() : null;
    const dueTime = dueDay ? dueDay.getTime() : null;

    if (dueTime !== null && dueTime < todayTime) return 'overdue';

    if (
        (startTime !== null && dueTime !== null && startTime <= todayTime && todayTime <= dueTime) ||
        (startTime !== null && dueTime === null && startTime <= todayTime) ||
        (dueTime !== null && dueTime === todayTime)
    ) {
        return 'today';
    }

    const futureDate = startDay || dueDay!;
    if (isWithinNext7Days(futureDate)) return 'next7days';
    return 'later';
};

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
            const tasksWithCategory = fetchedTasks.map(t => ({ ...t, groupCategory: getTaskGroupCategory(t) }));
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

// --- Derived Task Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);

export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    if (!tasks) return null;
    return selectedId ? tasks.find(task => task.id === selectedId) ?? null : null;
});

export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    const tasksToGroup = (get(tasksAtom) ?? []).filter(t => t.listName !== 'Trash' && !t.completed)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const groups: Record<TaskGroupCategory, Task[]> = { overdue: [], today: [], next7days: [], later: [], nodate: [] };
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
