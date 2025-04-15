// src/store/atoms.ts
import {atom} from 'jotai';
import {atomWithStorage, createJSONStorage} from 'jotai/utils';
import {ListDisplayMode, SettingsTab, Task, TaskFilter, TaskGroup, User} from '@/types';
import {getRelativeDateGroupTitle, isOverdue, isToday, safeParseDate} from '@/utils/dateUtils';
import {addDays, startOfDay} from 'date-fns';

// --- Base Atoms ---

export const currentUserAtom = atom<User | null>({
    id: 'user_123',
    name: 'Alex Chen', // Example name
    email: 'alex.chen@example.com',
    avatar: undefined, // Default to initials
    // avatar: 'https://placekitten.com/100/100', // Placeholder image if needed
    isPremium: true,
});

// Use sessionStorage for tasks during development to easily reset, or localStorage for persistence
const storage = createJSONStorage<Task[]>(() => sessionStorage); // Or localStorage

const initialTasks: Task[] = [
    {
        id: 'task-1',
        title: 'Review Project Proposal',
        completed: false,
        dueDate: startOfDay(new Date()).getTime(),
        list: 'Work',
        content: 'Check the requirements and budget sections.',
        order: 1,
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now() - 3600000,
        priority: 1,
        tags: ['project-x', 'review']
    },
    {
        id: 'task-2',
        title: 'Prepare Presentation Slides',
        completed: false,
        dueDate: startOfDay(addDays(new Date(), 2)).getTime(),
        list: 'Work',
        content: 'Use the new company template.',
        order: 3,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 7200000,
        priority: 2
    },
    {
        id: 'task-3',
        title: 'Schedule Team Meeting',
        completed: false,
        dueDate: startOfDay(addDays(new Date(), -1)).getTime(),
        list: 'Work',
        content: 'Find a slot that works for everyone.',
        order: 0,
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 86400000
    }, // Overdue
    {
        id: 'task-4',
        title: 'Buy Groceries',
        completed: false,
        dueDate: null,
        list: 'Personal',
        content: '- Milk\n- Eggs\n- Bread',
        order: 4,
        createdAt: Date.now() - 86400000 * 5,
        updatedAt: Date.now() - 86400000 * 1
    },
    {
        id: 'task-5',
        title: 'Read Chapter 5 of Design Patterns',
        completed: true,
        dueDate: startOfDay(addDays(new Date(), -5)).getTime(),
        list: 'Learning',
        content: 'Focus on Singleton and Factory patterns.',
        order: 5,
        createdAt: Date.now() - 86400000 * 6,
        updatedAt: Date.now() - 86400000 * 4,
        priority: 3
    },
    {
        id: 'task-6',
        title: 'Plan Weekend Trip',
        completed: false,
        dueDate: startOfDay(addDays(new Date(), 10)).getTime(),
        list: 'Personal',
        content: 'Look into hiking trails.',
        order: 6,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now()
    },
    {
        id: 'task-7',
        title: 'Deleted Task Example',
        completed: false,
        dueDate: null,
        list: 'Trash',
        content: '',
        order: 7,
        createdAt: Date.now() - 86400000 * 10,
        updatedAt: Date.now() - 3600000
    },
    {
        id: 'task-8',
        title: 'Call Mom',
        completed: false,
        dueDate: startOfDay(new Date()).getTime(),
        list: 'Personal',
        content: '',
        order: 2,
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 10000,
        priority: 2
    },
    {
        id: 'task-9',
        title: 'Submit Expense Report',
        completed: false,
        dueDate: startOfDay(addDays(new Date(), -3)).getTime(),
        list: 'Work',
        content: '',
        order: 0.5,
        createdAt: Date.now() - 86400000 * 4,
        updatedAt: Date.now() - 86400000 * 2,
        priority: 1
    }, // Overdue
].sort((a, b) => a.order - b.order); // Ensure initial sort by order

export const tasksAtom = atomWithStorage<Task[]>('tasks', initialTasks, storage, {getOnInit: true});

export const selectedTaskIdAtom = atom<string | null>(null);

// Keep track of the actively dragged task ID for styling/overlay
export const draggingTaskIdAtom = atom<string | null>(null);

export const listDisplayModeAtom = atomWithStorage<ListDisplayMode>('listDisplayMode', 'expanded');

export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');

// Represents the current filter applied (from URL/Sidebar)
// Default to 'all' which will now be the index route
export const currentFilterAtom = atom<TaskFilter>('all');

// --- Derived Atoms ---

export const selectedTaskAtom = atom<Task | null>((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    return tasks.find(task => task.id === selectedId) ?? null;
});

// Atom for tasks filtered by the current view (e.g., 'today', 'list-Work')
// These are the raw, ungrouped tasks for the current filter, sorted by 'order'
export const filteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(tasksAtom);
    const filter = get(currentFilterAtom);

    let filtered: Task[];

    // Handle Trash and Completed separately as they don't use the active/grouping logic
    if (filter === 'trash') {
        filtered = tasks.filter(task => task.list === 'Trash');
    } else if (filter === 'completed') {
        // Show completed tasks from all lists *except* Trash
        filtered = tasks.filter(task => task.list !== 'Trash' && task.completed);
    } else {
        // Start with active (non-trash, non-completed) tasks for standard filters
        const activeTasks = tasks.filter(task => task.list !== 'Trash' && !task.completed);

        switch (filter) {
            case 'all':
                filtered = activeTasks;
                break;
            case 'today':
                filtered = activeTasks.filter(task => task.dueDate && isToday(task.dueDate));
                break;
            case 'next7days': {
                // This view should ideally include Today *and* the next 7 days
                const today = startOfDay(new Date());
                const sevenDaysLater = startOfDay(addDays(today, 8)); // Day *after* the 7th day
                filtered = activeTasks.filter(task =>
                    task.dueDate &&
                    task.dueDate >= today.getTime() &&
                    task.dueDate < sevenDaysLater.getTime()
                );
                break;
            }
            // 'inbox' is now handled by 'list-Inbox' if needed, 'all' is the default
            // case 'inbox':
            //     filtered = activeTasks.filter(task => task.list === 'Inbox');
            //     break;
            default:
                if (filter.startsWith('list-')) {
                    const listName = filter.substring(5);
                    filtered = activeTasks.filter(task => task.list === listName);
                } else if (filter.startsWith('tag-')) {
                    const tagName = filter.substring(4);
                    filtered = activeTasks.filter(task => task.tags?.includes(tagName));
                } else {
                    filtered = activeTasks; // Fallback to 'all'
                }
                break;
        }
    }

    // Always sort the resulting list by the 'order' property
    return filtered.sort((a, b) => a.order - b.order);
});

// New Atom: Grouped tasks based on the filtered tasks
export const groupedFilteredTasksAtom = atom<TaskGroup[]>((get) => {
    const filtered = get(filteredTasksAtom);
    const filter = get(currentFilterAtom);

    // No grouping for Completed or Trash views
    if (filter === 'completed' || filter === 'trash') {
        return [{
            id: filter,
            title: filter === 'completed' ? 'Completed' : 'Trash',
            tasks: filtered,
            isDateGroup: false
        }];
    }

    const groups: { [key: string]: TaskGroup } = {};
    const groupOrder: string[] = ['overdue', 'today', 'upcoming', 'nodate']; // Defines display order

    const today = startOfDay(new Date()).getTime();
    const tomorrow = startOfDay(addDays(new Date(), 1)).getTime();
    const sevenDaysLater = startOfDay(addDays(new Date(), 8)).getTime(); // Day *after* the 7th day

    filtered.forEach(task => {
        let groupKey: string;
        let groupTitle: string;
        let isDateGroup = false;
        let date: number | undefined = undefined;

        if (task.dueDate) {
            const taskDueDate = startOfDay(safeParseDate(task.dueDate)!).getTime(); // Should be safe as we checked task.dueDate
            if (isOverdue(taskDueDate)) {
                groupKey = 'overdue';
                groupTitle = 'Overdue';
                isDateGroup = true; // Represents a past date range
            } else if (taskDueDate === today) {
                groupKey = 'today';
                groupTitle = 'Today';
                isDateGroup = true;
                date = taskDueDate;
            } else if (taskDueDate >= tomorrow && taskDueDate < sevenDaysLater) {
                // Group upcoming tasks within the next 7 days individually by date title
                groupKey = `date-${taskDueDate}`; // Unique key per date
                groupTitle = getRelativeDateGroupTitle(taskDueDate);
                isDateGroup = true;
                date = taskDueDate;
                // Add to group order if not already present
                if (!groupOrder.includes(groupKey)) {
                    // Insert future dates in chronological order within the 'upcoming' conceptual block
                    const upcomingIndex = groupOrder.indexOf('upcoming');
                    let inserted = false;
                    for (let i = upcomingIndex + 1; i < groupOrder.length; i++) {
                        if (groupOrder[i].startsWith('date-')) {
                            const existingDate = parseInt(groupOrder[i].substring(5), 10);
                            if (taskDueDate < existingDate) {
                                groupOrder.splice(i, 0, groupKey);
                                inserted = true;
                                break;
                            }
                        } else { // Reached 'nodate' or end
                            groupOrder.splice(i, 0, groupKey);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        groupOrder.splice(groupOrder.indexOf('nodate'), 0, groupKey); // Insert before 'nodate'
                    }
                }
            } else { // Due further in the future (or exact date if only 'all' is filtered)
                groupKey = `date-${taskDueDate}`;
                groupTitle = getRelativeDateGroupTitle(taskDueDate);
                isDateGroup = true;
                date = taskDueDate;
                if (!groupOrder.includes(groupKey)) {
                    // Similar logic to insert chronologically, potentially after the 7-day block
                    const noDateIndex = groupOrder.indexOf('nodate');
                    let inserted = false;
                    for (let i = noDateIndex - 1; i > groupOrder.indexOf('upcoming'); i--) { // Search backwards from 'nodate'
                        if (groupOrder[i].startsWith('date-')) {
                            const existingDate = parseInt(groupOrder[i].substring(5), 10);
                            if (taskDueDate > existingDate) {
                                groupOrder.splice(i + 1, 0, groupKey);
                                inserted = true;
                                break;
                            }
                        } else { // Reached a non-date group boundary? This needs refinement maybe.
                            break;
                        }
                    }
                    if (!inserted) { // If it's the earliest future date or only future date
                        groupOrder.splice(groupOrder.indexOf('upcoming') + 1, 0, groupKey);
                    }
                }
            }
        } else {
            groupKey = 'nodate';
            groupTitle = 'No Date';
        }

        if (!groups[groupKey]) {
            groups[groupKey] = {id: groupKey, title: groupTitle, tasks: [], isDateGroup: isDateGroup, date: date};
        }
        groups[groupKey].tasks.push(task);
    });

    // Remove the placeholder 'upcoming' key from the order
    const upcomingIndex = groupOrder.indexOf('upcoming');
    if (upcomingIndex > -1) {
        groupOrder.splice(upcomingIndex, 1);
    }

    // Sort the groups based on the defined order, filtering out empty groups
    return groupOrder
        .map(key => groups[key])
        .filter(group => group && group.tasks.length > 0);
});


// Atom to get task counts for the sidebar
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const activeTasks = tasks.filter(task => task.list !== 'Trash'); // All non-trashed tasks

    const today = startOfDay(new Date()).getTime();
    const sevenDaysLater = startOfDay(addDays(new Date(), 8)).getTime();

    const counts = {
        // Filter counts based on *active, non-completed* tasks
        all: activeTasks.filter(t => !t.completed).length,
        today: activeTasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate)).length,
        next7days: activeTasks.filter(t => !t.completed && t.dueDate && t.dueDate >= today && t.dueDate < sevenDaysLater).length,
        // inbox: activeTasks.filter(t => !t.completed && t.list === 'Inbox').length, // Inbox count is implicit in list counts now
        // Counts for completed and trash are based on all tasks
        completed: activeTasks.filter(t => t.completed).length,
        trash: tasks.filter(t => t.list === 'Trash').length,
        lists: {} as Record<string, number>,
        tags: {} as Record<string, number>,
    };

    // Calculate counts for lists and tags dynamically from *active, non-completed* tasks
    activeTasks.filter(t => !t.completed).forEach(task => {
        // List counts (including 'Inbox')
        const listName = task.list || 'Inbox'; // Default to Inbox if list is empty
        counts.lists[listName] = (counts.lists[listName] || 0) + 1;

        // Tag counts
        task.tags?.forEach(tag => {
            counts.tags[tag] = (counts.tags[tag] || 0) + 1;
        });
    });

    return counts;
});

// Atom to get unique list names (excluding 'Trash')
export const userListNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const specialLists = ['Trash']; // Exclude Trash from user-editable lists
    const lists = new Set<string>();
    tasks.forEach(task => {
        if (task.list && !specialLists.includes(task.list)) {
            lists.add(task.list);
        } else if (!task.list && !specialLists.includes('Inbox')) {
            // Ensure 'Inbox' is included if tasks exist without a list property assigned
            lists.add('Inbox');
        }
    });
    // Ensure Inbox is always first if it exists
    const sortedLists = Array.from(lists).sort();
    if (sortedLists.includes('Inbox')) {
        return ['Inbox', ...sortedLists.filter(l => l !== 'Inbox')];
    }
    return sortedLists;
});

// Atom to get unique tag names
export const userTagNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    tasks.forEach(task => {
        task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
});