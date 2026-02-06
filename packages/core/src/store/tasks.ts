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
