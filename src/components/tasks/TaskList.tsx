// src/components/tasks/TaskList.tsx
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import TaskItem from './TaskItem';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    tasksAtom,
    selectedTaskIdAtom,
    currentFilterAtom,
    groupedAllTasksAtom, // Use this for 'all' view structure
    searchFilteredTasksAtom, // Use derived atom for combined filtering/searching
    searchTermAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter, TaskGroupCategory } from '@/types';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragOverlay, DragStartEvent, UniqueIdentifier, MeasuringStrategy
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import {addDays, startOfDay} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';

// Interface for component props
interface TaskListProps {
    title: string;
    filter: TaskFilter; // Receive filter from page
}

// Sticky Group Header Component with Stronger Glass Effect (Memoized)
const TaskGroupHeader: React.FC<{ title: string }> = React.memo(({ title }) => (
    <motion.div
        className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-[5]"
        // Apply strong sticky header glass effect
        style={{
            backgroundColor: 'hsla(220, 30%, 96%, 0.85)', // More opaque base
            backdropFilter: 'blur(14px)', // Stronger blur
            WebkitBackdropFilter: 'blur(14px)',
            // Softer mask fade
            WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
        }}
        layout // Animate position changes smoothly
    >
        {title}
    </motion.div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';


// Main Task List Component
const TaskList: React.FC<TaskListProps> = ({ title: pageTitle, filter: pageFilter }) => {
    // --- State and Atoms ---
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [currentFilterInternal, setCurrentFilterInternal] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom); // For 'all' view structure
    const searchFilteredTasks = useAtomValue(searchFilteredTasksAtom); // Combined filter/search
    const searchTerm = useAtomValue(searchTermAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [draggingTaskCategory, setDraggingTaskCategory] = useState<TaskGroupCategory | undefined>(undefined);

    // --- Effects ---
    // Sync external filter prop with internal atom state
    useEffect(() => {
        if (pageFilter !== currentFilterInternal) {
            setCurrentFilterInternal(pageFilter);
        }
    }, [pageFilter, currentFilterInternal, setCurrentFilterInternal]);

    // --- Memoized Values ---
    // Determine which tasks to display based on search and filter
    const { tasksToDisplay, isGroupedView } = useMemo(() => {
        const isSearching = searchTerm.trim().length > 0;
        if (isSearching) {
            // Always flat list when searching
            return { tasksToDisplay: searchFilteredTasks, isGroupedView: false };
        } else if (currentFilterInternal === 'all') {
            // 'All' view uses grouped structure
            return { tasksToDisplay: groupedTasks, isGroupedView: true };
        } else {
            // Other filters use the flat list (searchFilteredTasks handles this when search is empty)
            return { tasksToDisplay: searchFilteredTasks, isGroupedView: false };
        }
    }, [searchTerm, currentFilterInternal, groupedTasks, searchFilteredTasks]);

    // Get task IDs for SortableContext based on the current display structure
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (isGroupedView) {
            // Flatten tasks from grouped structure
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat().map(task => task.id);
        } else {
            // Use flat list directly
            return (tasksToDisplay as Task[]).map(task => task.id);
        }
    }, [tasksToDisplay, isGroupedView]);

    // --- Dnd-Kit Setup ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // Require small movement to start drag
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Drag and Drop Handlers ---
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        // const taskData = active.data.current?.task as Task | undefined;
        const categoryData = active.data.current?.groupCategory as TaskGroupCategory | undefined;
        // Find task in current tasks state for accuracy
        const task = tasks.find(t => t.id === active.id);
        if (task) {
            setDraggingTask(task);
            // Use category from DND data first, fallback to task's current category
            setDraggingTaskCategory(categoryData ?? task.groupCategory);
            setSelectedTaskId(task.id); // Select task when dragging starts
        }
    }, [tasks, setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null); // Clear dragging state regardless of outcome
        setDraggingTaskCategory(undefined);

        if (!over || active.id === over.id) return; // No valid drop target or dropped on itself

        const activeId = active.id as string;
        const overId = over.id as string;
        // Get target group category ONLY if in 'all' view
        const targetGroupCategory = (currentFilterInternal === 'all' && over.data.current?.groupCategory)
            ? over.data.current?.groupCategory as TaskGroupCategory
            : undefined;

        // Find visual indices based on the currently displayed flattened list
        const currentVisualTaskList = isGroupedView
            ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat()
            : (tasksToDisplay as Task[]);
        const oldVisualIndex = currentVisualTaskList.findIndex(t => t.id === activeId);
        const newVisualIndex = currentVisualTaskList.findIndex(t => t.id === overId);

        if (oldVisualIndex === -1 || newVisualIndex === -1) {
            console.warn("TaskList DragEnd: Could not find dragged items in the current visual list.");
            // Less accurate fallback if visual indices fail
            setTasks(currentTasks => {
                const oldFullIndex = currentTasks.findIndex(t => t.id === activeId);
                const newFullIndex = currentTasks.findIndex(t => t.id === overId);
                return (oldFullIndex !== -1 && newFullIndex !== -1) ? arrayMove(currentTasks, oldFullIndex, newFullIndex) : currentTasks;
            });
            return;
        }

        // --- Fractional Indexing Logic (using visual order) ---
        const isMovingDown = oldVisualIndex < newVisualIndex;
        const prevTaskVisual = isMovingDown ? currentVisualTaskList[newVisualIndex] : (newVisualIndex > 0 ? currentVisualTaskList[newVisualIndex - 1] : null);
        const nextTaskVisual = isMovingDown ? (newVisualIndex + 1 < currentVisualTaskList.length ? currentVisualTaskList[newVisualIndex + 1] : null) : currentVisualTaskList[newVisualIndex];
        const prevOrder = prevTaskVisual?.order;
        const nextOrder = nextTaskVisual?.order;

        let newOrderValue: number;
        // Handle edge cases and calculate midpoint
        if (prevOrder === undefined || prevOrder === null) { // Dropped at the beginning
            newOrderValue = (nextOrder ?? 0) - 1000; // Ensure space before first item
        } else if (nextOrder === undefined || nextOrder === null) { // Dropped at the end
            newOrderValue = prevOrder + 1000; // Ensure space after last item
        } else {
            newOrderValue = (prevOrder + nextOrder) / 2;
        }
        // --- End Fractional Indexing ---

        // --- Handle Date Change based on Drop Target Group ('all' view only) ---
        let newDueDate: number | null | undefined = undefined; // undefined = no change intended
        const originalTask = tasks.find(t => t.id === activeId);

        if (originalTask && currentFilterInternal === 'all' && targetGroupCategory) {
            const originalCategory = originalTask.groupCategory;
            if (targetGroupCategory !== originalCategory) {
                console.log(`Task ${activeId} dropped from ${originalCategory} to ${targetGroupCategory}`);
                if (targetGroupCategory === 'today') {
                    newDueDate = startOfDay(new Date()).getTime(); // Set to today
                } else if (targetGroupCategory === 'nodate') {
                    newDueDate = null; // Clear the date
                }
                // *** NO date picker prompt for other groups as per refined requirements ***
                // User needs to manually change date via details if dropped in Overdue/Next7/Later
            }
        }
        // --- End Date Change ---

        // Update the tasks atom with new order and potential date change
        setTasks((currentTasks) =>
            currentTasks.map((task) => {
                if (task.id === activeId) {
                    return {
                        ...task,
                        order: newOrderValue,
                        updatedAt: Date.now(),
                        // Apply dueDate change only if newDueDate is explicitly set (not undefined)
                        ...(newDueDate !== undefined && { dueDate: newDueDate }),
                        // groupCategory will be recalculated automatically by the tasksAtom setter
                    };
                }
                return task;
            })
        );

    }, [setTasks, currentFilterInternal, isGroupedView, tasksToDisplay, tasks]); // Added 'tasks' dependency

    // --- Add Task Handler ---
    const handleAddTask = useCallback(() => {
        const now = Date.now();
        let defaultList = 'Inbox';
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        // Set defaults based on the current filter context
        if (currentFilterInternal.startsWith('list-')) {
            const listName = currentFilterInternal.substring(5);
            if (listName !== 'Trash') defaultList = listName; // Add to current list (unless Trash)
        } else if (currentFilterInternal === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (currentFilterInternal.startsWith('tag-')) {
            defaultTags = [currentFilterInternal.substring(4)];
        } else if (currentFilterInternal === 'next7days') {
            // Default to Tomorrow if adding in Next 7 Days view
            defaultDueDate = startOfDay(addDays(now, 1)).getTime();
        }

        // Calculate order to place the new task at the top of the *visible* list/group
        const currentVisualTaskList = isGroupedView
            ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat()
            : (tasksToDisplay as Task[]);
        const firstVisibleTaskOrder = currentVisualTaskList.length > 0 ? currentVisualTaskList[0]?.order : 0;
        const newOrder = (firstVisibleTaskOrder ?? 0) - 1000; // Ensure it's placed before the first visible task

        const newTaskBase: Omit<Task, 'groupCategory'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '', completed: false, list: defaultList, dueDate: defaultDueDate,
            order: newOrder, createdAt: now, updatedAt: now, content: '', tags: defaultTags, priority: null,
        };
        const newTask: Task = newTaskBase as Task; // Cast, atom setter adds category

        setTasks(prev => [newTask, ...prev]); // Add to the beginning of the main tasks array
        setSelectedTaskId(newTask.id); // Select the new task

        // Focus the title input in TaskDetail after a short delay for rendering
        setTimeout(() => {
            const titleInput = document.querySelector('.task-detail-title-input') as HTMLInputElement | null;
            titleInput?.focus();
        }, 150); // Increased delay slightly

    }, [currentFilterInternal, isGroupedView, tasksToDisplay, setTasks, setSelectedTaskId]);

    // --- Render Helper for Task Groups/Lists ---
    // This function renders the actual TaskItem components within a motion context
    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | string) => (
        // Keyed AnimatePresence ensures smooth add/remove animations *within* the group
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task) => (
                // motion.div with layout prop handles smooth reordering animation
                <motion.div
                    key={task.id} // Crucial: Use stable task ID as the key
                    layout // Enable automatic layout animation for reordering
                    initial={{ opacity: 0, y: -10 }} // Initial state for entry animation
                    animate={{ opacity: 1, y: 0 }} // Animate to final state
                    exit={{ opacity: 0, x: -15, transition: { duration: 0.15, ease: 'easeIn' } }} // Exit animation
                    transition={{ duration: 0.25, ease: "easeOut" }} // Entry/reorder animation timing
                    className="task-motion-wrapper" // Optional class for styling wrapper
                >
                    <TaskItem
                        task={task}
                        // Pass the correct group category context for DnD logic
                        groupCategory={typeof groupKey === 'string' && ['overdue', 'today', 'next7days', 'later', 'nodate'].includes(groupKey) ? groupKey as TaskGroupCategory : task.groupCategory}
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    ), []); // No external dependencies, relies on passed props

    // Determine if the current view is empty
    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            // Check if all groups in the grouped view are empty
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every(group => group.length === 0);
        } else {
            // Check if the flat list is empty
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    // --- Main Render ---
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Consistent measuring
        >
            {/* Container with strong glass */}
            <div className="h-full flex flex-col bg-glass-alt-100 backdrop-blur-xl overflow-hidden">
                {/* Header with strong glass */}
                <div className={twMerge(
                    "px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 z-10",
                    "bg-glass-alt-200 backdrop-blur-lg" // Stronger glass header
                )}>
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2" title={pageTitle}>{pageTitle}</h1>
                    <div className="flex items-center space-x-1">
                        {/* Conditionally show Add Task button */}
                        {currentFilterInternal !== 'completed' && currentFilterInternal !== 'trash' && (
                            <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="px-2.5 !h-[30px]"> Add </Button>
                        )}
                        {/* Options Button (Placeholder) */}
                        <Button variant="ghost" size="icon" icon="more-horizontal" aria-label="List options" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                    </div>
                </div>

                {/* Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        // Empty State Message (Animated)
                        <motion.div
                            className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }} // Slight delay for smooth appearance
                        >
                            <Icon
                                name={currentFilterInternal === 'trash' ? 'trash' : (currentFilterInternal === 'completed' ? 'check-square' : 'archive')}
                                size={40} className="mb-3 text-gray-300 opacity-80"
                            />
                            <p className="text-sm font-medium text-gray-500">
                                {searchTerm ? `No results for "${searchTerm}"` :
                                    currentFilterInternal === 'trash' ? 'Trash is empty' :
                                        currentFilterInternal === 'completed' ? 'No completed tasks yet' :
                                            `No tasks in "${pageTitle}"`}
                            </p>
                            {currentFilterInternal !== 'trash' && currentFilterInternal !== 'completed' && !searchTerm && (
                                <p className="text-xs mt-1 text-muted">Click the '+' button to add a new task.</p>
                            )}
                        </motion.div>
                    ) : (
                        // Sortable Context wrapping the tasks
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {isGroupedView ? (
                                // Render grouped tasks ('All' view without search)
                                <>
                                    {/* Render each group only if it has tasks */}
                                    {(tasksToDisplay as Record<TaskGroupCategory, Task[]>).overdue.length > 0 && ( <> <TaskGroupHeader title="Overdue" /> {renderTaskGroup((tasksToDisplay as Record<TaskGroupCategory, Task[]>).overdue, 'overdue')} </> )}
                                    {(tasksToDisplay as Record<TaskGroupCategory, Task[]>).today.length > 0 && ( <> <TaskGroupHeader title="Today" /> {renderTaskGroup((tasksToDisplay as Record<TaskGroupCategory, Task[]>).today, 'today')} </> )}
                                    {(tasksToDisplay as Record<TaskGroupCategory, Task[]>).next7days.length > 0 && ( <> <TaskGroupHeader title="Next 7 Days" /> {renderTaskGroup((tasksToDisplay as Record<TaskGroupCategory, Task[]>).next7days, 'next7days')} </> )}
                                    {(tasksToDisplay as Record<TaskGroupCategory, Task[]>).later.length > 0 && ( <> <TaskGroupHeader title="Later" /> {renderTaskGroup((tasksToDisplay as Record<TaskGroupCategory, Task[]>).later, 'later')} </> )}
                                    {(tasksToDisplay as Record<TaskGroupCategory, Task[]>).nodate.length > 0 && ( <> <TaskGroupHeader title="No Due Date" /> {renderTaskGroup((tasksToDisplay as Record<TaskGroupCategory, Task[]>).nodate, 'nodate')} </> )}
                                </>
                            ) : (
                                // Render flat list (search results or specific filter view)
                                <div className="pt-0.5"> {/* Add slight padding for flat list */}
                                    {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>

            {/* Drag Overlay with Glass Effect */}
            <DragOverlay dropAnimation={null} /* Disable default animation */ >
                {draggingTask ? (
                    <TaskItem
                        task={draggingTask}
                        groupCategory={draggingTaskCategory}
                        isOverlay // Applies strong glass overlay style via TaskItem's logic
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
export default TaskList;