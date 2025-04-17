// src/components/tasks/TaskList.tsx
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import TaskItem from './TaskItem';
import { useAtom, useAtomValue } from 'jotai';
import {
    filteredTasksAtom, // READ derived state
    tasksAtom,         // WRITE base state
    selectedTaskIdAtom,// WRITE UI state
    currentFilterAtom, // WRITE UI state (can be READ too)
    groupedAllTasksAtom // READ derived state
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter } from '@/types';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragOverlay, DragStartEvent, UniqueIdentifier, MeasuringStrategy
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { startOfDay } from "date-fns";
// import { twMerge } from "tailwind-merge";

// Interface for component props
interface TaskListProps {
    title: string;
    filter: TaskFilter; // Pass filter explicitly for clarity
}

// Sticky Group Header Component with Glass Effect
const TaskGroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <motion.div
        className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-[5]"
        // Apply glass effect using Tailwind config
        style={{
            backgroundColor: 'hsla(0, 0%, 100%, 0.75)', // Use hsla for background
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            // Mask to prevent blur bleeding downwards too much (optional)
            // WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
            // maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
        }}
        layout // Animate position if list changes cause header shifts
    >
        {title}
    </motion.div>
);

// Main Task List Component
const TaskList: React.FC<TaskListProps> = ({ title, filter }) => {
    // Read derived state using useAtomValue for performance
    const filteredTasksValue = useAtomValue(filteredTasksAtom);
    const groupedTasksValue = useAtomValue(groupedAllTasksAtom);

    // Use useAtom for state that needs reading AND writing
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [currentFilterInternal, setCurrentFilterInternal] = useAtom(currentFilterAtom); // Read/Write filter state
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom); // Only need setter

    // State for Drag-and-Drop overlay
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);

    // Effect to synchronize the external filter prop with the internal atom state
    // This ensures the component reflects the filter passed via props (e.g., from routing)
    useEffect(() => {
        if (filter !== currentFilterInternal) {
            setCurrentFilterInternal(filter);
        }
    }, [filter, currentFilterInternal, setCurrentFilterInternal]);

    // Memoize the list of task IDs for SortableContext, based on the *current* filter
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (filter === 'all') {
            // Flatten the grouped tasks for the 'all' view
            return [
                ...groupedTasksValue.overdue,
                ...groupedTasksValue.today,
                ...groupedTasksValue.next7days,
                ...groupedTasksValue.later,
                ...groupedTasksValue.nodate,
            ].map(task => task.id);
        } else {
            // Use the already filtered tasks for other views
            return filteredTasksValue.map(task => task.id);
        }
        // Dependencies: the filter prop and the derived atom *values*
    }, [filter, filteredTasksValue, groupedTasksValue]);

    // Configure Dnd-Kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Require pointer movement before starting drag, prevents clicks interfering
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // --- Drag and Drop Handlers ---
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id);
        if (task) {
            setDraggingTask(task); // Set task for DragOverlay
            // Optionally select the task being dragged
            // setSelectedTaskId(task.id);
        }
    }, [tasks]); // Depend on the base tasks array

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null); // Clear overlay task

        if (over && active.id !== over.id) {
            // Use the memoized sortableItems for current view order
            const currentVisibleIds = sortableItems;

            setTasks((currentTasks) => {
                const oldVisibleIndex = currentVisibleIds.findIndex(id => id === active.id);
                const newVisibleIndex = currentVisibleIds.findIndex(id => id === over.id);

                // Ensure both items are found in the current visible list
                if (oldVisibleIndex === -1 || newVisibleIndex === -1) {
                    console.warn("TaskList DragEnd: Could not find dragged/target item in the current visible list.");
                    // Fallback: Find indices in the *full* task list (less accurate for visual order)
                    const oldFullIndex = currentTasks.findIndex(t => t.id === active.id);
                    const newFullIndex = currentTasks.findIndex(t => t.id === over.id);
                    if (oldFullIndex !== -1 && newFullIndex !== -1) {
                        console.warn("TaskList DragEnd: Falling back to full list reorder.");
                        const reordered = arrayMove(currentTasks, oldFullIndex, newFullIndex);
                        // Simple reorder based on index - update 'order' based on new index
                        return reordered.map((t, i) => ({ ...t, order: i, updatedAt: Date.now() }));
                    }
                    return currentTasks; // No change if indices not found
                }

                // --- Fractional Indexing for robust sorting ---
                // Find the tasks before and after the drop target *in the current view*
                const prevTask = newVisibleIndex > 0 ? currentTasks.find(t => t.id === currentVisibleIds[newVisibleIndex - 1]) : null;
                const nextTask = currentTasks.find(t => t.id === currentVisibleIds[newVisibleIndex]); // The task we are dropping ON/BEFORE

                const prevOrder = prevTask?.order;
                // Use the order of the item we are dropping onto as the 'next' order
                const nextOrder = nextTask?.order;

                let newOrderValue: number;

                if (prevOrder === undefined || prevOrder === null) {
                    // Dropped at the beginning of the visible list
                    newOrderValue = (nextOrder ?? 0) - 1; // Place before the first item
                } else if (nextOrder === undefined || nextOrder === null) {
                    // Should not happen if dropping onto a valid item, but as fallback:
                    // Dropped at the end? Or onto an item without order?
                    newOrderValue = prevOrder + 1; // Place after the previous item
                } else {
                    // Dropped between two items
                    newOrderValue = (prevOrder + nextOrder) / 2;
                }
                // --- End Fractional Indexing ---


                // Update the dragged task's order and timestamp
                return currentTasks.map(task =>
                    task.id === active.id
                        ? { ...task, order: newOrderValue, updatedAt: Date.now() }
                        : task
                );
            });
            // Optional: Re-select the task after drop
            // setSelectedTaskId(active.id as string);
        }
    }, [setTasks, sortableItems]); // Depend on setTasks and the current view order (sortableItems)

    // --- Add Task Handler ---
    const handleAddTask = () => {
        const now = Date.now();
        let defaultList = 'Inbox'; // Default to Inbox
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        // Set defaults based on the current filter
        if (filter.startsWith('list-') && filter !== 'list-Inbox') {
            defaultList = filter.substring(5);
        } else if (filter === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (filter.startsWith('tag-')) {
            defaultTags = [filter.substring(4)];
        }
        // Could add logic for 'next7days' default date if desired

        // Calculate order: Place new task at the top of the *current view*
        const firstVisibleTask = sortableItems.length > 0 ? tasks.find(t => t.id === sortableItems[0]) : null;
        const newOrder = (firstVisibleTask?.order ?? 0) - 1; // Place before the first visible item, or at -1 if list is empty

        const newTask: Task = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '', // Start with empty title
            completed: false,
            list: defaultList,
            dueDate: defaultDueDate,
            order: newOrder,
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: defaultTags,
            priority: null,
        };

        // Add the new task to the beginning of the tasks array (atom update)
        setTasks(prev => [newTask, ...prev]);
        setSelectedTaskId(newTask.id); // Select the new task

        // Focus the title input in TaskDetail after a short delay for rendering/animation
        setTimeout(() => {
            (document.querySelector('.task-detail-title-input') as HTMLInputElement)?.focus();
        }, 100); // Shorter delay might work
    };

    // --- Render Helper for Task Groups ---
    // This uses AnimatePresence to handle the add/remove animations you liked
    const renderTaskGroup = (groupTasks: Task[], groupKey: string | number) => (
        // Key added to AnimatePresence if group identity matters for transitions, otherwise optional
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task) => (
                <motion.div
                    key={task.id} // Key for React and Framer Motion
                    layout // Enable layout animation for reordering
                    initial={{ opacity: 0, y: -10 }} // Subtle entry from top
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -15, transition: { duration: 0.15 } }} // Subtle exit to left
                    transition={{ duration: 0.2, ease: "easeOut" }} // Standard exit/entry timing
                    className="task-motion-wrapper" // Optional wrapper class if needed
                >
                    {/* Render the actual TaskItem */}
                    <TaskItem task={task} />
                </motion.div>
            ))}
        </AnimatePresence>
    );

    // Determine if the current view is empty
    const isEmpty = useMemo(() => {
        if (filter === 'all') {
            // Check if all groups in the 'all' view are empty
            return Object.values(groupedTasksValue).every(group => group.length === 0);
        } else {
            // Check if the filtered list for other views is empty
            return filteredTasksValue.length === 0;
        }
    }, [filter, groupedTasksValue, filteredTasksValue]);


    // --- Main Render ---
    return (
        // DndContext wraps the sortable area
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Helps with dynamic content height
        >
            <div className="h-full flex flex-col bg-canvas"> {/* Use standard canvas background */}
                {/* Header with Glass Effect */}
                <div className="px-3 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0 h-11 bg-glass-200 backdrop-blur-sm z-10"> {/* Glass header */}
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2" title={title}>{title}</h1>
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1">
                        {/* Show Add Task button only if not in Completed or Trash view */}
                        {filter !== 'completed' && filter !== 'trash' && (
                            <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="px-2.5"> Add </Button>
                        )}
                        {/* Placeholder for List Options */}
                        <Button variant="ghost" size="icon" aria-label="List options" className="w-7 h-7 text-muted-foreground">
                            <Icon name="more-horizontal" size={18} />
                        </Button>
                    </div>
                </div>

                {/* Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        // Empty State Message
                        <motion.div
                            className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Icon
                                name={filter === 'trash' ? 'trash' : (filter === 'completed' ? 'check-square' : 'archive')}
                                size={40} className="mb-3 text-gray-300 opacity-80"
                            />
                            <p className="text-sm font-medium text-gray-500">
                                {filter === 'trash' ? 'Trash is empty' : (filter === 'completed' ? 'No completed tasks yet' : `No tasks in "${title}"`)}
                            </p>
                            {filter !== 'trash' && filter !== 'completed' && (
                                <p className="text-xs mt-1 text-muted">Click the '+' button to add a new task.</p>
                            )}
                        </motion.div>
                    ) : (
                        // Sortable Context wrapping the tasks
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {/* Conditional rendering based on 'all' filter */}
                            {filter === 'all' ? (
                                // Render grouped tasks for 'All' view
                                <>
                                    {groupedTasksValue.overdue.length > 0 && ( <> <TaskGroupHeader title="Overdue" /> {renderTaskGroup(groupedTasksValue.overdue, 'overdue')} </> )}
                                    {groupedTasksValue.today.length > 0 && ( <> <TaskGroupHeader title="Today" /> {renderTaskGroup(groupedTasksValue.today, 'today')} </> )}
                                    {groupedTasksValue.next7days.length > 0 && ( <> <TaskGroupHeader title="Next 7 Days" /> {renderTaskGroup(groupedTasksValue.next7days, 'next7days')} </> )}
                                    {groupedTasksValue.later.length > 0 && ( <> <TaskGroupHeader title="Later" /> {renderTaskGroup(groupedTasksValue.later, 'later')} </> )}
                                    {groupedTasksValue.nodate.length > 0 && ( <> <TaskGroupHeader title="No Due Date" /> {renderTaskGroup(groupedTasksValue.nodate, 'nodate')} </> )}
                                </>
                            ) : (
                                // Render flat list for other filters
                                <div className="pt-0.5"> {/* Add padding if needed */}
                                    {renderTaskGroup(filteredTasksValue, 'default-group')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>

            {/* Drag Overlay: Renders the dragging item visually */}
            {/* Use dropAnimation={null} for smoother appearance without double animation */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <TaskItem
                        task={draggingTask}
                        isOverlay // Signal that this is the overlay item
                        // Pass minimal style to ensure it looks like the source but can be customized
                        style={{ boxShadow: '0 6px 10px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.08)' }} // Example overlay shadow
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
export default TaskList;