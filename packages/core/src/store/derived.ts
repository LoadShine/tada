/**
 * Derived atoms that depend on multiple store modules.
 * Separated to avoid circular dependencies.
 */
import { atom } from 'jotai';
import { Task } from '@/types';
import { tasksAtom, getTaskGroupCategory } from './tasks';
import { userListsAtom } from './lists';
import { searchTermAtom } from './ui';

/**
 * Derived atom for list names sorted with Inbox first.
 */
export const userListNamesAtom = atom<string[]>((get) => {
    const lists = get(userListsAtom) ?? [];
    return lists.map(l => l.name).sort((a, b) => {
        if (a === 'Inbox') return -1;
        if (b === 'Inbox') return 1;
        return a.localeCompare(b);
    });
});

/**
 * Derived atom for unique tag names from active tasks.
 */
export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const activeTasks = tasks.filter(task => !task.completed && task.listName !== 'Trash');
    const tags = new Set<string>();
    activeTasks.forEach(task => task.tags?.forEach(tag => tags.add(tag.trim())));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});

/**
 * Derived atom for task counts by category, list, and tag.
 */
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.listName !== 'Trash');
    const trashedTasksCount = tasks.length - activeTasks.length;

    const counts: {
        all: number;
        today: number;
        next7days: number;
        completed: number;
        trash: number;
        lists: Record<string, number>;
        tags: Record<string, number>;
    } = {
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

/**
 * Derived atom for search results across all tasks.
 */
export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom) ?? [];
    const searchWords = search.split(' ').filter(Boolean);
    return allTasks.filter(task => {
        return searchWords.every((word: string) => {
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
