// src/store/atoms.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { User, Task, TaskFilter, TaskGroupCategory, SettingsTab } from '@/types';
import { isToday, isWithinNext7Days, isOverdue } from '@/utils/dateUtils';
import { startOfDay } from 'date-fns';

// --- Base Atoms ---

export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg', // Placeholder
    isPremium: true,
});

const initialTasks: Task[] = [
    { id: '1', title: '施工组织设计评审表', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Review the construction plan details.', order: 1, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000, priority: 1, tags: ['review'] },
    { id: '8', title: '准备明天会议材料', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Finalize slides.', order: 0, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 100000, priority: 1 },
    { id: '2', title: '开发框架讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000)).getTime(), list: 'Work', content: 'Prepare slides for the team meeting.', order: 2, createdAt: Date.now() - 86400000, updatedAt: Date.now(), priority: 2 },
    { id: '3', title: 'RESTful讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 3)).getTime(), list: 'Work', content: '', order: 3, createdAt: Date.now() - 86400000, updatedAt: Date.now(), tags: ['presentation'] },
    { id: '9', title: '下周项目规划', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 5)).getTime(), list: 'Planning', content: 'Define milestones for Q4.', order: 4, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 50000 },
    { id: '4', title: '欢迎加入Tada', completed: false, dueDate: null, list: 'Inbox', content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary', order: 5, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5 },
    { id: '10', title: '研究 CodeMirror Themes', completed: false, dueDate: null, list: 'Dev', content: 'Find a good light/dark theme.', order: 6, createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 * 1 },
    { id: '11', title: '体检预约', completed: false, dueDate: startOfDay(new Date(Date.now() - 86400000 * 2)).getTime(), list: 'Personal', content: 'Call the clinic.', order: 7, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3, priority: 1 }, // Overdue task
    { id: '5', title: '我能用Tada做什么?', completed: true, dueDate: null, list: 'Inbox', content: 'Organize life, track projects, collaborate.', order: 8, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3 },
    { id: '6', title: '研究一下patch', completed: true, dueDate: new Date(2024, 6, 13).getTime(), list: 'Archive', content: '', order: 9, createdAt: new Date(2024, 6, 13).getTime(), updatedAt: new Date(2024, 6, 14).getTime() },
    { id: '7', title: 'Swagger2讲解 (Completed)', completed: true, dueDate: new Date(2024, 6, 14).getTime(), list: 'Work', content: 'Focus on API documentation standards.', order: 10, createdAt: new Date(2024, 6, 14).getTime(), updatedAt: new Date(2024, 6, 14).getTime() },
].sort((a, b) => a.order - b.order); // Initial sort by order

// Store tasks in localStorage using timestamps
export const tasksAtom = atomWithStorage<Task[]>('tasks', initialTasks, undefined, { getOnInit: true });

// Store user-defined lists separately (Requirement 4)
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal']; // Extract from initialTasks or define defaults
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists', initialUserLists, undefined, { getOnInit: true });

export const selectedTaskIdAtom = atom<string | null>(null);

// export const listDisplayModeAtom = atomWithStorage<ListDisplayMode>('listDisplayMode', 'expanded'); // Keep for potential future use

export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false); // State for Add List Modal

// Represents the current filter applied (from URL/Sidebar)
export const currentFilterAtom = atom<TaskFilter>('all'); // Default to 'all'

// --- Derived Atoms ---

export const selectedTaskAtom = atom<Task | null>((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    return tasks.find(task => task.id === selectedId) ?? null;
});

// Filtered Tasks based on the current route/filter, sorted by 'order'
export const filteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(tasksAtom);
    const filter = get(currentFilterAtom);

    // Exclude trashed tasks unless the filter is 'trash'
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasks = tasks.filter(task => task.list === 'Trash');

    let filtered: Task[];

    switch (filter) {
        case 'all':
            // Show all non-completed, non-trashed tasks
            filtered = activeTasks.filter(task => !task.completed);
            break;
        case 'today':
            filtered = activeTasks.filter(task => !task.completed && task.dueDate && isToday(task.dueDate));
            break;
        case 'next7days':
            // Show tasks due today AND the next 6 days
            filtered = activeTasks.filter(task => !task.completed && task.dueDate && isWithinNext7Days(task.dueDate));
            break;
        case 'completed':
            // Show completed non-trashed tasks, sorted by completion date (updatedAt) descending
            filtered = activeTasks.filter(task => task.completed).sort((a, b) => b.updatedAt - a.updatedAt);
            break;
        case 'trash':
            // Show only trashed tasks, sorted by updated date descending
            filtered = trashedTasks.sort((a, b) => b.updatedAt - a.updatedAt);
            break;
        default:
            if (filter.startsWith('list-')) {
                const listName = filter.substring(5);
                filtered = activeTasks.filter(task => !task.completed && task.list === listName);
            } else if (filter.startsWith('tag-')) {
                const tagName = filter.substring(4);
                filtered = activeTasks.filter(task => !task.completed && task.tags?.includes(tagName));
            } else {
                // Fallback to 'all' if filter is unrecognized
                filtered = activeTasks.filter(task => !task.completed);
            }
            break;
    }

    // Sort all filtered tasks (except completed/trash which have their own sort) by the 'order' property
    if (filter !== 'completed' && filter !== 'trash') {
        // Ensure consistent sorting even if order numbers are identical or non-numeric (fallback to creation time)
        return filtered.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    }
    return filtered;

});

// Atom to get unique list names including user-defined ones even if empty
export const userListNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const userDefinedLists = get(userDefinedListsAtom);
    const specialLists = ['Inbox', 'Trash', 'Archive']; // Exclude system/default lists

    const listsFromTasks = new Set<string>();
    tasks.forEach(task => {
        // Consider only tasks not in Trash for user-defined lists
        if (task.list && !specialLists.includes(task.list) && task.list !== 'Trash') {
            listsFromTasks.add(task.list);
        }
    });

    // Combine lists from tasks and explicitly defined lists
    const combinedLists = new Set([...userDefinedLists, ...listsFromTasks]);

    return Array.from(combinedLists).sort((a, b) => a.localeCompare(b)); // Alphabetical sort
});


// Atom to get task counts for the sidebar
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom); // Get all known user lists

    // Active tasks are non-trashed tasks
    const activeTasks = tasks.filter(task => task.list !== 'Trash');

    // Counts for standard filters
    const counts = {
        all: activeTasks.filter(t => !t.completed).length,
        today: activeTasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate)).length,
        next7days: activeTasks.filter(t => !t.completed && t.dueDate && isWithinNext7Days(t.dueDate)).length,
        completed: activeTasks.filter(t => t.completed).length, // Count completed from active tasks
        trash: tasks.filter(t => t.list === 'Trash').length, // Count trash from *all* tasks
        lists: {} as Record<string, number>,
        tags: {} as Record<string, number>,
    };

    // Initialize counts for all known user lists to 0
    allUserListNames.forEach(listName => {
        counts.lists[listName] = 0;
    });

    // Calculate counts for lists and tags dynamically from *active, non-completed* tasks
    activeTasks.filter(t => !t.completed).forEach(task => {
        // List counts (only count if it's in our user list names)
        if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) {
            counts.lists[task.list]++;
        }
        // Tag counts
        task.tags?.forEach(tag => {
            counts.tags[tag] = (counts.tags[tag] || 0) + 1;
        });
    });

    // Initialize counts for tags found
    const tagNames = get(userTagNamesAtom);
    tagNames.forEach(tag => {
        if (!Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
            counts.tags[tag] = 0; // Ensure all known tags are present, even if count is 0
        }
    });

    return counts;
});


// Atom to get unique tag names
export const userTagNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    // Consider only tags from non-trashed tasks
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b)); // Alphabetical sort
});

// Helper atom to group tasks for the 'All Tasks' view
export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    // Use the 'all' filtered tasks directly, which are already non-completed, non-trashed, and sorted by order
    const allActiveTasksSortedByOrder = get(tasksAtom)
        .filter(task => task.list !== 'Trash' && !task.completed)
        .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));

    const groups: Record<TaskGroupCategory, Task[]> = {
        overdue: [],
        today: [],
        next7days: [],
        later: [],
        nodate: [],
    };

    allActiveTasksSortedByOrder.forEach(task => {
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate); // Create date object for checks
            if (isOverdue(dueDate)) {
                groups.overdue.push(task);
            } else if (isToday(dueDate)) {
                groups.today.push(task);
            } else if (isWithinNext7Days(dueDate)) {
                // Exclude today since it has its own group
                groups.next7days.push(task);
            } else {
                // Due date exists but is beyond the next 7 days
                groups.later.push(task);
            }
        } else {
            groups.nodate.push(task);
        }
    });

    // Groups are naturally sorted by 'order' because the input list was sorted
    return groups;
});