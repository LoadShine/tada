// src/store/atoms.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { User, Task, TaskFilter, TaskGroupCategory, SettingsTab } from '@/types';
import { isToday, isWithinNext7Days, isOverdue, startOfDay, safeParseDate } from '@/utils/dateUtils'; // Use our utils

// --- Base Atoms ---

// Default User (Consider fetching from API in a real app)
export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg', // Placeholder - use a real path or remove if none
    isPremium: true,
});

// Sample Data - adjusted for clarity and diverse scenarios
const initialTasks: Task[] = [
    // Overdue
    { id: '11', title: '体检预约', completed: false, dueDate: startOfDay(new Date(Date.now() - 86400000 * 2)).getTime(), list: 'Personal', content: 'Call the clinic.', order: 7, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3, priority: 1 }, // High prio overdue
    // Today
    { id: '1', title: '施工组织设计评审表', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Review the construction plan details.', order: 1, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000, priority: 1, tags: ['review', 'urgent'] },
    { id: '8', title: '准备明天会议材料', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Finalize slides.', order: 0, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 100000, priority: 1 },
    // Tomorrow
    { id: '2', title: '开发框架讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000)).getTime(), list: 'Work', content: 'Prepare slides for the team meeting.', order: 2, createdAt: Date.now() - 86400000, updatedAt: Date.now(), priority: 2 },
    // Next 7 Days
    { id: '3', title: 'RESTful讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 3)).getTime(), list: 'Work', content: '', order: 3, createdAt: Date.now() - 86400000, updatedAt: Date.now(), tags: ['presentation'] },
    // Later
    { id: '9', title: '下周项目规划', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 10)).getTime(), list: 'Planning', content: 'Define milestones for Q4.', order: 4, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 50000 },
    // No Due Date
    { id: '4', title: '欢迎加入Tada', completed: false, dueDate: null, list: 'Inbox', content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary', order: 5, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5 },
    { id: '10', title: '研究 CodeMirror Themes', completed: false, dueDate: null, list: 'Dev', content: 'Find a good light/dark theme.', order: 6, createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 * 1 },
    // Completed
    { id: '5', title: '我能用Tada做什么?', completed: true, dueDate: null, list: 'Inbox', content: 'Organize life, track projects, collaborate.', order: 8, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3 },
    { id: '7', title: 'Swagger2讲解 (Completed)', completed: true, dueDate: new Date(2024, 6, 14).getTime(), list: 'Work', content: 'Focus on API documentation standards.', order: 10, createdAt: new Date(2024, 6, 14).getTime(), updatedAt: new Date(2024, 6, 14).getTime() },
    // Trashed
    { id: '6', title: '研究一下patch (Trashed)', completed: false, /* Completed is usually false in Trash */ dueDate: new Date(2024, 6, 13).getTime(), list: 'Trash', content: '', order: 9, createdAt: new Date(2024, 6, 13).getTime(), updatedAt: new Date(2024, 6, 15).getTime() }, // Moved to Trash later
].sort((a, b) => a.order - b.order); // Initial sort by order

// Store tasks in localStorage
export const tasksAtom = atomWithStorage<Task[]>('tasks', initialTasks, undefined, { getOnInit: true });

// Store user-defined lists separately
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal', 'Inbox']; // Ensure 'Inbox' is trackable if needed
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists', initialUserLists, undefined, { getOnInit: true });

// UI State Atoms
export const selectedTaskIdAtom = atom<string | null>(null);
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

// Atom to get unique user-defined list names (excluding Trash, Archive)
// Ensures explicitly defined lists are always present.
export const userListNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const userDefinedLists = get(userDefinedListsAtom);
    const systemLists = ['Trash', 'Archive']; // Lists not managed by the user directly in "My Lists"

    const listsFromTasks = new Set<string>();
    tasks.forEach(task => {
        // Consider only tasks not in Trash/Archive for user-defined lists
        if (task.list && !systemLists.includes(task.list)) {
            listsFromTasks.add(task.list);
        }
    });

    // Combine explicitly defined lists and lists found in non-system tasks
    const combinedLists = new Set([...userDefinedLists, ...listsFromTasks]);

    return Array.from(combinedLists).sort((a, b) => a.localeCompare(b)); // Alphabetical sort
});

// Filtered Tasks based on the current route/filter, sorted by 'order'
export const filteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(tasksAtom);
    const filter = get(currentFilterAtom);

    // Active tasks (non-trashed) and trashed tasks
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasks = tasks.filter(task => task.list === 'Trash');

    let filtered: Task[];

    switch (filter) {
        case 'all':
            // Show all non-completed, non-trashed tasks
            filtered = activeTasks.filter(task => !task.completed);
            break;
        case 'today':
            filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isToday(task.dueDate));
            break;
        case 'next7days':
            // Show tasks due today AND the next 6 days (non-completed)
            filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isWithinNext7Days(task.dueDate));
            break;
        case 'completed':
            // Show completed non-trashed tasks, sorted by completion date (updatedAt) descending
            filtered = activeTasks.filter(task => task.completed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            break;
        case 'trash':
            // Show only trashed tasks, sorted by date moved to trash (updatedAt) descending
            filtered = trashedTasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
                console.warn(`Unrecognized filter: ${filter}. Falling back to 'all'.`);
                filtered = activeTasks.filter(task => !task.completed);
            }
            break;
    }

    // Sort all filtered tasks (except completed/trash which have their own sort) by the 'order' property
    if (filter !== 'completed' && filter !== 'trash') {
        // Ensure consistent sorting: order first, then creation time as fallback
        return filtered.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    }

    return filtered;
});

// Atom to get unique tag names from non-trashed tasks
export const userTagNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    // Consider only tags from non-trashed tasks
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b)); // Alphabetical sort
});


// Atom to get task counts for the sidebar
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom); // Get all known user lists (including Inbox)
    const allUserTagNames = get(userTagNamesAtom); // Get all known tags

    // Active tasks are non-trashed tasks
    const activeTasks = tasks.filter(task => task.list !== 'Trash');

    // --- Initialize Counts ---
    const counts = {
        all: 0,
        today: 0,
        next7days: 0,
        completed: activeTasks.filter(t => t.completed).length, // Completed count is straightforward
        trash: tasks.filter(t => t.list === 'Trash').length,   // Trash count is straightforward
        lists: {} as Record<string, number>,
        tags: {} as Record<string, number>,
    };

    // Initialize list counts to 0
    allUserListNames.forEach(listName => {
        counts.lists[listName] = 0;
    });
    // Initialize tag counts to 0
    allUserTagNames.forEach(tagName => {
        counts.tags[tagName] = 0;
    });

    // --- Calculate Counts from active, non-completed tasks ---
    activeTasks.filter(t => !t.completed).forEach(task => {
        counts.all++; // Increment 'all' count

        // Check date-based filters
        if (task.dueDate != null) {
            if (isToday(task.dueDate)) counts.today++;
            // Important: 'next7days' includes 'today', so check separately if needed,
            // but for the count, we just need if it falls within the window.
            if (isWithinNext7Days(task.dueDate)) counts.next7days++;
        }

        // Count lists (ensure list exists in the initialized keys)
        if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) {
            counts.lists[task.list]++;
        }

        // Count tags (ensure tag exists in the initialized keys)
        task.tags?.forEach(tag => {
            if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
                counts.tags[tag]++;
            }
        });
    });

    return counts;
});


// Helper atom to group tasks for the 'All Tasks' view
export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    // Use the 'all' filtered tasks directly, which are already non-completed, non-trashed, and sorted by order
    const allActiveNonCompletedTasks = get(tasksAtom)
        .filter(task => task.list !== 'Trash' && !task.completed)
        .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt)); // Sort by order, then creation

    const groups: Record<TaskGroupCategory, Task[]> = {
        overdue: [],
        today: [],
        next7days: [], // Will contain tasks due day 2 to day 7
        later: [],
        nodate: [],
    };

    allActiveNonCompletedTasks.forEach(task => {
        if (task.dueDate != null) {
            const dueDateObj = safeParseDate(task.dueDate); // Use safe parsing
            if (!dueDateObj) {
                groups.nodate.push(task); // Treat invalid date as no date
                return;
            }

            if (isOverdue(dueDateObj)) {
                groups.overdue.push(task);
            } else if (isToday(dueDateObj)) {
                groups.today.push(task);
            } else if (isWithinNext7Days(dueDateObj)) {
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

    // The groups are naturally sorted by 'order' because the input list was sorted
    return groups;
});