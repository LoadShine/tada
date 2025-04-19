// src/store/atoms.ts
// Added memoization checks and optimized derived atoms where possible
import { atom } from 'jotai';
import { atomWithStorage, RESET } from 'jotai/utils';
import { User, Task, TaskFilter, TaskGroupCategory, SettingsTab } from '@/types';
import {
    isToday, isWithinNext7Days, isOverdue, startOfDay, safeParseDate,
    isValid
} from '@/utils/dateUtils';
import { selectAtom } from 'jotai/utils'; // Import selectAtom for optimization

// --- Base Atoms ---
export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg',
    isPremium: true,
});

// Helper function (keep as is, relatively cheap)
const getTaskGroupCategory = (task: Task | Omit<Task, 'groupCategory'>): TaskGroupCategory => {
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';
        if (isOverdue(dueDateObj)) return 'overdue';
        if (isToday(dueDateObj)) return 'today';
        if (isWithinNext7Days(dueDateObj)) return 'next7days';
        return 'later';
    }
    return 'nodate';
};

// Sample Data (keep as is)
const initialTasksData: Omit<Task, 'groupCategory'>[] = [
    { id: '1', title: '施工组织设计评审表', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Review the construction plan details.', order: 0, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000, priority: 1, tags: ['review', 'urgent'] },
    { id: '8', title: '准备明天会议材料', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Finalize slides.', order: 1, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 100000, priority: 1 },
    { id: '2', title: '开发框架讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000)).getTime(), list: 'Work', content: 'Prepare slides for the team meeting.', order: 2, createdAt: Date.now() - 86400000, updatedAt: Date.now(), priority: 2 },
    { id: '3', title: 'RESTful讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 3)).getTime(), list: 'Work', content: '', order: 3, createdAt: Date.now() - 86400000, updatedAt: Date.now(), tags: ['presentation'] },
    { id: '4', title: '欢迎加入Tada', completed: false, dueDate: null, list: 'Inbox', content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary', order: 4, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5 },
    { id: '10', title: '研究 CodeMirror Themes', completed: false, dueDate: null, list: 'Dev', content: 'Find a good light/dark theme.', order: 5, createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 * 1 },
    { id: '9', title: '下周项目规划', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 10)).getTime(), list: 'Planning', content: 'Define milestones for Q4.', order: 6, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 50000 },
    { id: '11', title: '体检预约', completed: false, dueDate: startOfDay(new Date(Date.now() - 86400000 * 2)).getTime(), list: 'Personal', content: 'Call the clinic.', order: 7, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3, priority: 1 },
    { id: '5', title: '我能用Tada做什么?', completed: true, dueDate: null, list: 'Inbox', content: 'Organize life, track projects, collaborate.', order: 8, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3 },
    { id: '7', title: 'Swagger2讲解 (Completed)', completed: true, dueDate: new Date(2024, 6, 14).getTime(), list: 'Work', content: 'Focus on API documentation standards.', order: 10, createdAt: new Date(2024, 6, 14).getTime(), updatedAt: new Date(2024, 6, 14).getTime() },
    { id: '6', title: '研究一下patch (Trashed)', completed: false, dueDate: new Date(2024, 6, 13).getTime(), list: 'Trash', content: '', order: 9, createdAt: new Date(2024, 6, 13).getTime(), updatedAt: new Date(2024, 6, 15).getTime() },
];

const initialTasks: Task[] = initialTasksData
    .map(task => ({
        ...task,
        groupCategory: getTaskGroupCategory(task),
    }))
    .sort((a, b) => a.order - b.order); // Sort initial data by order

const baseTasksAtom = atomWithStorage<Task[]>('tasks', initialTasks, undefined, { getOnInit: true });

export const tasksAtom = atom(
    (get) => get(baseTasksAtom),
    (get, set, update: Task[] | ((prev: Task[]) => Task[]) | typeof RESET) => {
        if (update === RESET) {
            set(baseTasksAtom, initialTasks);
            return;
        }
        const previousTasks = get(baseTasksAtom);
        const nextTasksRaw = typeof update === 'function' ? update(previousTasks) : update;

        // Update category and sort by order before saving
        const nextTasksProcessed = nextTasksRaw
            .map(task => {
                const originalTask = previousTasks.find(t => t.id === task.id);
                // Only recalculate category if necessary
                if (!originalTask || originalTask.dueDate !== task.dueDate || originalTask.completed !== task.completed || !task.groupCategory) {
                    return { ...task, groupCategory: getTaskGroupCategory(task) };
                }
                return task; // Reuse existing category if relevant factors didn't change
            })
            .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));

        set(baseTasksAtom, nextTasksProcessed);
    }
);

// --- User Lists ---
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal'];
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists', initialUserLists, undefined, { getOnInit: true });

// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');

// --- Derived Atoms ---

// Optimize selectedTaskAtom: only re-run if selectedId changes or the *specific* task updates
export const selectedTaskAtom = atom<Task | null>((get) => {
    const selectedId = get(selectedTaskIdAtom);
    if (!selectedId) return null;
    const tasks = get(tasksAtom);
    // Finding the task is necessary, derived atoms won't automatically track a single item efficiently
    return tasks.find(task => task.id === selectedId) ?? null;
});


// Optimize userListNamesAtom with selectAtom if list structure is stable
// This assumes lists primarily change when userDefinedListsAtom changes or tasks are added/deleted
// It might still recompute if any task's 'list' property changes.
export const userListNamesAtom = selectAtom(
    atom(get => ({ tasks: get(tasksAtom), userLists: get(userDefinedListsAtom) })),
    (data) => {
        const listsFromTasks = new Set<string>(['Inbox']);
        data.tasks.forEach(task => { if (task.list && task.list !== 'Trash') listsFromTasks.add(task.list) });
        const combinedLists = new Set(['Inbox', ...data.userLists, ...Array.from(listsFromTasks)]);
        return Array.from(combinedLists).sort((a, b) => {
            if (a === 'Inbox') return -1; if (b === 'Inbox') return 1; return a.localeCompare(b);
        });
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b) // Deep equality check for the array
);


// Optimize userTagNamesAtom similarly
export const userTagNamesAtom = selectAtom(
    tasksAtom, // Depend only on tasksAtom
    (tasks) => {
        const tags = new Set<string>();
        tasks.filter(t => t.list !== 'Trash').forEach(task => { task.tags?.forEach(tag => tags.add(tag)) });
        return Array.from(tags).sort((a, b) => a.localeCompare(b));
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b) // Deep equality check
);


// Filtered Tasks based on currentFilterAtom
// This atom MUST recalculate when filter or tasks change.
export const filteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(tasksAtom); // Dependency
    const filter = get(currentFilterAtom); // Dependency
    let filtered: Task[];

    // console.log(`Filtering tasks for: ${filter}`); // Debug log

    // Filter logic remains the same
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasks = tasks.filter(task => task.list === 'Trash');

    switch (filter) {
        case 'all': filtered = activeTasks.filter(task => !task.completed); break;
        case 'today': filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isToday(task.dueDate)); break;
        case 'next7days': filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isWithinNext7Days(task.dueDate)); break;
        case 'completed': filtered = activeTasks.filter(task => task.completed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); break;
        case 'trash': filtered = trashedTasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); break;
        default:
            if (filter.startsWith('list-')) {
                const listName = filter.substring(5);
                filtered = activeTasks.filter(task => !task.completed && task.list === listName);
            } else if (filter.startsWith('tag-')) {
                const tagName = filter.substring(4);
                filtered = activeTasks.filter(task => !task.completed && task.tags?.includes(tagName));
            } else {
                console.warn(`Unrecognized filter: ${filter}. Falling back to 'all'.`);
                filtered = activeTasks.filter(task => !task.completed);
            }
            break;
    }
    // Keep sorting for non-completed/trash filters
    if (filter !== 'completed' && filter !== 'trash') {
        // Sorting by order is crucial here, already done in tasksAtom write,
        // but double-check if filtering could mess order (it shouldn't if source is sorted)
        return filtered; // Rely on order from tasksAtom
    }
    return filtered;
});


// Search Filtered Tasks (applies search ON TOP of the current filter)
// This atom MUST recalculate when search term or filteredTasksAtom change.
export const searchFilteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(filteredTasksAtom); // Dependency
    const search = get(searchTermAtom).trim().toLowerCase(); // Dependency

    if (!search) {
        return tasks; // Return pre-filtered, sorted tasks
    }

    const searchWords = search.split(' ').filter(Boolean);

    // Apply search filtering
    return tasks.filter(task =>
        searchWords.every(word => // Match ALL words in the search term
            task.title.toLowerCase().includes(word) ||
            (task.content && task.content.toLowerCase().includes(word)) ||
            (task.tags && task.tags.some(tag => tag.toLowerCase().includes(word)))
        )
    );
    // Sorting is inherited from filteredTasksAtom
});


// Task Counts Atom (Memoized)
// This depends on tasks, user lists, and user tags. Optimize if needed.
// Use selectAtom to only recalculate if the relevant parts of tasks change
export const taskCountsAtom = atom(get => {
    const tasks = get(tasksAtom); // Dependency
    const allUserListNames = get(userListNamesAtom); // Dependency
    const allUserTagNames = get(userTagNamesAtom); // Dependency

    // console.log('Recalculating task counts'); // Debug log

    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const counts = {
        all: 0, today: 0, next7days: 0,
        completed: activeTasks.filter(t => t.completed).length,
        trash: tasks.filter(t => t.list === 'Trash').length,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };

    activeTasks.filter(t => !t.completed).forEach(task => {
        counts.all++;
        if (task.dueDate != null) {
            const dueDateObj = safeParseDate(task.dueDate);
            if (dueDateObj && isValid(dueDateObj)) {
                if (isToday(dueDateObj)) counts.today++;
                // Check overdue status based on date for accurate next7days count
                if (!isOverdue(dueDateObj) && isWithinNext7Days(dueDateObj)) {
                    counts.next7days++;
                }
            }
        }
        if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) {
            counts.lists[task.list]++;
        }
        task.tags?.forEach(tag => {
            if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
                counts.tags[tag]++;
            }
        });
    });
    return counts;
});


// Grouped Tasks for 'All' view (Memoized)
// Depends on search term and the full task list. This recalculation seems necessary.
export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    // Use the *unsorted* full list here, as filtering might happen before sorting
    const allTasks = get(tasksAtom);
    const activeTasks = allTasks.filter(task => task.list !== 'Trash' && !task.completed);

    // Apply search filtering *before* grouping if search is active
    const search = get(searchTermAtom).trim().toLowerCase();
    const tasksToGroup = search ? get(searchFilteredTasksAtom) : activeTasks; // Use search results if applicable

    const groups: Record<TaskGroupCategory, Task[]> = { overdue: [], today: [], next7days: [], later: [], nodate: [] };

    // Group the tasks
    tasksToGroup.forEach(task => {
        // Ensure category is correct based on potentially updated due date
        const category = getTaskGroupCategory(task);
        if (groups[category]) {
            groups[category].push(task);
        } else {
            groups.nodate.push(task); // Fallback should ideally not happen if types are correct
        }
    });

    // Sort *within* each group by the persisted order
    for (const key in groups) {
        groups[key as TaskGroupCategory].sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    }

    return groups;
});