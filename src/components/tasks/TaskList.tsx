// src/components/tasks/TaskList.tsx
import React, { useCallback, useState, useMemo } from 'react';
import TaskItem from './TaskItem';
import { useAtom } from 'jotai';
import { filteredTasksAtom, tasksAtom, selectedTaskIdAtom, currentFilterAtom, groupedAllTasksAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter } from '@/types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    UniqueIdentifier
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { startOfDay } from "date-fns";

interface TaskListProps {
    title: string;
    filter: TaskFilter;
}

// Group Header Component
const TaskGroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-canvas z-[1]">
        {title}
    </div>
);

const TaskList: React.FC<TaskListProps> = ({ title, filter }) => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [filteredTasks] = useAtom(filteredTasksAtom); // Gets tasks already filtered and sorted by 'order'
    const [groupedTasks] = useAtom(groupedAllTasksAtom); // Gets tasks grouped for 'all' view
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);

    // Set the global filter atom when this list mounts or its filter changes
    React.useEffect(() => {
        setCurrentFilter(filter);
    }, [filter, setCurrentFilter]);

    // Determine the task IDs to use for SortableContext based on the filter
    // For 'all' filter, use the IDs from all groups combined, maintaining the overall 'order' sort
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (filter === 'all') {
            // Combine IDs from all groups, preserving the original order derived from filteredTasksAtom
            return [
                ...groupedTasks.overdue,
                ...groupedTasks.today,
                ...groupedTasks.next7days,
                ...groupedTasks.later,
                ...groupedTasks.nodate,
            ].map(task => task.id);
        } else {
            // For other filters, use the IDs from the standard filteredTasksAtom
            return filteredTasks.map(task => task.id);
        }
    }, [filter, filteredTasks, groupedTasks]);


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require slightly more movement to initiate drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id);
        if (task) {
            setDraggingTask(task);
            setSelectedTaskId(task.id); // Select the task being dragged
        }
    }, [tasks, setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null);

        if (over && active.id !== over.id) {
            setTasks((currentTasks) => {
                const oldIndex = currentTasks.findIndex((task) => task.id === active.id);
                const newIndex = currentTasks.findIndex((task) => task.id === over.id);

                if (oldIndex === -1 || newIndex === -1) {
                    console.warn("TaskList: Could not find task indices for reordering.");
                    return currentTasks;
                }

                // Reorder the entire tasks array using arrayMove
                const reorderedTasks = arrayMove(currentTasks, oldIndex, newIndex);

                // Update the 'order' property based on the new array index
                // This provides a simple sorting mechanism. Could use fractional indexing for more robustness.
                const updatedTasks = reorderedTasks.map((task, index) => ({
                    ...task,
                    order: index, // Assign order based on new position in the *full* task list
                    updatedAt: Date.now(), // Update timestamp
                }));

                return updatedTasks;
            });
        }
        // Deselect task after drop? Optional.
        // setSelectedTaskId(null);
    }, [setTasks]);

    const handleAddTask = () => {
        const now = Date.now();
        // Determine the list for the new task based on the current filter
        let defaultList = 'Inbox'; // Default list
        if (filter.startsWith('list-')) {
            defaultList = filter.substring(5);
        } else if (filter === 'today' || filter === 'next7days') {
            // Keep default list as Inbox unless a specific list filter is active
            // Tasks added in date-based views usually go to Inbox or a default list
        }

        // Determine the due date based on the current filter
        let defaultDueDate: number | null = null;
        if (filter === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        }
        // Could add logic for 'next7days' to default to tomorrow, etc.

        // Calculate the order for the new task - place it at the beginning of the current view
        // Get the order of the first task in the current filtered view, or 0 if empty
        const firstTaskOrder = filteredTasks.length > 0 ? filteredTasks[0].order : -1;
        // Assign an order slightly before the first task, or 0 if the list is empty/first task is 0
        const newOrder = firstTaskOrder > 0 ? firstTaskOrder - 0.5 : (filteredTasks.length > 0 ? -1 : 0);
        // Re-adjusting order might be needed later if using integers (e.g., shift others or re-index)

        const newTask: Task = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`, // More unique ID
            title: '', // Start empty for inline editing
            completed: false,
            list: defaultList,
            dueDate: defaultDueDate,
            order: newOrder, // Place near the top
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: filter.startsWith('tag-') ? [filter.substring(4)] : [], // Add current tag if in tag view
        };

        // Add the new task and immediately re-sort the entire list by order
        setTasks(prev => [...prev, newTask].sort((a, b) => a.order - b.order));
        setSelectedTaskId(newTask.id); // Select the new task

        // Scroll the new task into view (implementation depends on DOM structure)
        setTimeout(() => {
            const element = document.querySelector(`[data-rbd-draggable-id="${newTask.id}"]`); // Check TaskItem's dnd-kit props
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Also try focusing the title input in TaskDetail if it opens
            const titleInput = document.getElementById(`task-title-${newTask.id}`); // Need to add this ID to input
            titleInput?.focus();
        }, 100); // Delay slightly to allow DOM update
    };

    // Render a group of tasks
    const renderTaskGroup = (groupTasks: Task[], _groupKey: string | number) => (
        <AnimatePresence initial={false}>
            {groupTasks.map((task) => (
                <motion.div
                    key={task.id}
                    layout // Animate layout changes (position)
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }} // Subtle slide out left
                    transition={{ duration: 0.2, ease: "easeOut" }}
                >
                    <TaskItem task={task} />
                </motion.div>
            ))}
        </AnimatePresence>
    );


    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full flex flex-col bg-canvas">
                {/* Header */}
                <div className="px-3 py-2 border-b border-gray-200/60 flex justify-between items-center flex-shrink-0 h-10">
                    {/* Use h1 for semantic structure, style as needed */}
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2">{title}</h1>
                    <div className="flex items-center space-x-1">
                        {/* Add Task Button */}
                        {filter !== 'completed' && filter !== 'trash' && ( // Hide Add Task in Completed/Trash views
                            <Button
                                variant="primary"
                                size="sm"
                                icon="plus"
                                onClick={handleAddTask}
                                className="ml-1" // Add slight margin
                            >
                                Add Task
                            </Button>
                        )}
                        {/* Options Button (Future Use) */}
                        <Button variant="ghost" size="icon" aria-label="List options" className="w-7 h-7">
                            <Icon name="more-horizontal" size={18} />
                        </Button>
                    </div>
                </div>

                {/* Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar">
                    {/* Check for empty state */}
                    {sortableItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10 animate-fade-in">
                            <Icon name={filter === 'trash' ? 'trash' : (filter === 'completed' ? 'check-square' : 'check-square')} size={40} className="mb-3 text-gray-300" />
                            <p className="text-sm font-medium text-gray-500">
                                {filter === 'trash' ? 'Trash is empty' : (filter === 'completed' ? 'No completed tasks' : 'No tasks here yet')}
                            </p>
                            {filter !== 'trash' && filter !== 'completed' && (
                                <p className="text-xs mt-1">Add a task using the '+' button above.</p>
                            )}
                        </div>
                    ) : (
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {filter === 'all' ? (
                                <>
                                    {/* Render grouped tasks for 'All Tasks' view */}
                                    {groupedTasks.overdue.length > 0 && (
                                        <>
                                            <TaskGroupHeader title="Overdue" />
                                            {renderTaskGroup(groupedTasks.overdue, 'overdue')}
                                        </>
                                    )}
                                    {groupedTasks.today.length > 0 && (
                                        <>
                                            <TaskGroupHeader title="Today" />
                                            {renderTaskGroup(groupedTasks.today, 'today')}
                                        </>
                                    )}
                                    {groupedTasks.next7days.length > 0 && (
                                        <>
                                            <TaskGroupHeader title="Next 7 Days" />
                                            {renderTaskGroup(groupedTasks.next7days, 'next7days')}
                                        </>
                                    )}
                                    {groupedTasks.later.length > 0 && (
                                        <>
                                            <TaskGroupHeader title="Later" />
                                            {renderTaskGroup(groupedTasks.later, 'later')}
                                        </>
                                    )}
                                    {groupedTasks.nodate.length > 0 && (
                                        <>
                                            <TaskGroupHeader title="No Due Date" />
                                            {renderTaskGroup(groupedTasks.nodate, 'nodate')}
                                        </>
                                    )}
                                </>
                            ) : (
                                // Render flat list for other filters
                                <div className="pt-1"> {/* Add padding top to avoid header collision */}
                                    {renderTaskGroup(filteredTasks, 'default-group')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>

            {/* Drag Overlay for a smooth dragging visual */}
            <DragOverlay dropAnimation={null}>
                {/* Render TaskItem with isOverlay prop */}
                {draggingTask ? <TaskItem task={draggingTask} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TaskList;