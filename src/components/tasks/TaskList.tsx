// src/components/tasks/TaskList.tsx
import React, { useCallback, useMemo } from 'react';
import TaskItem from './TaskItem';
import { useAtom } from 'jotai';
import {
    tasksAtom,
    selectedTaskIdAtom,
    currentFilterAtom,
    groupedFilteredTasksAtom,
    draggingTaskIdAtom // Import dragging state atom
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter, TaskGroup } from '@/types';
import {
    DndContext,
    closestCenter, // Using closestCenter initially, consider alternatives if needed for group dropping
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    // UniqueIdentifier,
    MeasuringStrategy,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy, // Use vertical strategy
    arrayMove
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { startOfDay } from "date-fns";
// import { safeParseDate } from "@/utils/dateUtils.ts";

interface TaskListProps {
    title: string;
    filter: TaskFilter;
}

// Helper to get the next order value (fractional indexing example)
// const getNewOrder = (tasks: Task[], oldIndex: number, newIndex: number): number => {
//     // Simplified: Use integer indexing based on array position after move
//     // More robust: Fractional indexing calculation
//     // const sortedTasks = [...tasks].sort((a, b) => a.order - b.order); // Ensure sorted by order
//     const movedTasks = arrayMove(tasks, oldIndex, newIndex);
//
//     const prevTaskOrder = newIndex > 0 ? movedTasks[newIndex - 1].order : 0; // Order of item before the new position
//     const nextTaskOrder = newIndex < movedTasks.length - 1 ? movedTasks[newIndex + 1].order : prevTaskOrder + 2; // Order of item after (or add 2 if last)
//
//     return (prevTaskOrder + nextTaskOrder) / 2; // New order is between neighbors
// };

const TaskList: React.FC<TaskListProps> = ({ title, filter }) => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [groupedTasks] = useAtom(groupedFilteredTasksAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    // const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [draggingId, setDraggingId] = useAtom(draggingTaskIdAtom); // Use atom for dragging ID


    React.useEffect(() => {
        // Update the global filter state when this component's filter prop changes
        setCurrentFilter(filter);
    }, [filter, setCurrentFilter]);


    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Require pointer to move before starting drag, good for preventing clicks
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Memoize the flat list of task IDs for SortableContext
    const taskIds = useMemo(() => groupedTasks.flatMap(group => group.tasks.map(task => task.id)), [groupedTasks]);
    const draggingTask = useMemo(() => tasks.find(t => t.id === draggingId), [tasks, draggingId]);


    const handleDragStart = useCallback((event: DragStartEvent) => {
        setDraggingId(event.active.id as string);
        setSelectedTaskId(event.active.id as string); // Select the task being dragged
    }, [setDraggingId, setSelectedTaskId]);


    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingId(null); // Clear dragging state

        if (!over || active.id === over.id) {
            return; // No move occurred or dropped on itself
        }

        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        // Find the original and target indices in the *flat* task list managed by tasksAtom
        const oldIndex = tasks.findIndex((task) => task.id === active.id);
        // Find target index carefully. 'over.id' might be a task or a droppable group ID if implemented.
        // For simple list sorting, assume over.id is another task ID.
        const newIndex = tasks.findIndex((task) => task.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
            console.warn("Task index not found during reorder", { activeId: active.id, overId: over.id });
            return; // Should not happen
        }

        // Determine the target group based on the task it was dropped *over*
        let targetGroup: TaskGroup | undefined;
        for (const group of groupedTasks) {
            if (group.tasks.some(t => t.id === over.id)) {
                targetGroup = group;
                break;
            }
        }

        // Calculate new dueDate based on target group (if it's a date group)
        let newDueDate = activeTask.dueDate; // Keep original by default
        if (targetGroup?.isDateGroup) {
            if (targetGroup.id === 'overdue') {
                // Keep original due date if dropped in overdue, or set to yesterday?
                // Let's keep original to avoid losing info. User can change manually.
                // newDueDate = startOfDay(addDays(new Date(), -1)).getTime();
            } else if (targetGroup.id === 'today') {
                newDueDate = startOfDay(new Date()).getTime();
            } else if (targetGroup.id.startsWith('date-')) {
                newDueDate = targetGroup.date ?? activeTask.dueDate; // Use group date
            }
        } else if (targetGroup?.id === 'nodate') {
            newDueDate = null; // Clear due date if dropped in 'No Date'
        }


        // --- Update Task State ---
        setTasks((currentTasks) => {
            const oldIdx = currentTasks.findIndex((task) => task.id === active.id);
            const newIdx = currentTasks.findIndex((task) => task.id === over.id);

            // Adjust newIndex if dropping at the end (over.id might be the last item's id)
            // This needs careful handling depending on collision detection strategy.
            // For now, assume arrayMove handles indices correctly.

            if (oldIdx === -1 || newIdx === -1) return currentTasks; // Safety check

            // 1. Reorder the array immutably
            const reorderedTasks = arrayMove(currentTasks, oldIdx, newIdx);

            // 2. Update order property and potentially dueDate for the moved task
            // Find the *final* index after the move
            const finalIndex = reorderedTasks.findIndex(t => t.id === active.id);
            if (finalIndex === -1) return currentTasks; // Should not happen

            // Calculate new fractional order (more robust than index)
            const prevOrder = finalIndex > 0 ? reorderedTasks[finalIndex - 1].order : 0;
            const nextOrder = finalIndex < reorderedTasks.length - 1 ? reorderedTasks[finalIndex + 1].order : (prevOrder + 2); // Add gap if last
            const newOrder = (prevOrder + nextOrder) / 2;


            // 3. Map and update the moved task
            return reorderedTasks.map((task) =>
                task.id === active.id
                    ? {
                        ...task,
                        order: newOrder,
                        dueDate: newDueDate, // Apply the calculated due date
                        updatedAt: Date.now(),
                    }
                    : task
            );
        });

    }, [tasks, setTasks, groupedTasks, setDraggingId]); // Add groupedTasks as dependency

    const handleAddTask = () => {
        const now = Date.now();
        let listName = 'Inbox'; // Default
        let newDueDate: number | null = null;

        // Determine list and potential due date based on current filter
        if (filter === 'today') {
            newDueDate = startOfDay(now).getTime();
        } else if (filter.startsWith('list-')) {
            listName = filter.substring(5);
        } else if (filter === 'next7days') {
            // Default to 'today' when adding in 'Upcoming'? Or leave null?
            newDueDate = startOfDay(now).getTime();
        }
        // Other filters like 'all', 'tag-*' default to 'Inbox' and null dueDate

        const newTask: Task = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`, // More unique ID
            title: '', // Start empty for immediate editing
            completed: false,
            list: listName,
            dueDate: newDueDate,
            // Calculate initial order: place at the top (or based on filter?)
            // Simplest: place effectively at the top by giving a very small order number initially.
            // A better way: find the lowest current order and subtract 1, or use fractional indexing.
            // Let's place it visually at the top for now, order will be updated on interaction.
            order: (tasks.reduce((min, t) => Math.min(min, t.order), tasks[0]?.order ?? 0)) - 1, // Place before the first item
            // order: (tasks[0]?.order ?? 0) - 1, // Put it before the first item's order
            createdAt: now,
            updatedAt: now,
            content: '',
        };

        setTasks(prev => [newTask, ...prev]); // Add to the beginning of the raw list
        setSelectedTaskId(newTask.id); // Select the new task for editing
        // TODO: Scroll the new task into view
        // Find the element and use scrollIntoView()
    };

    const renderGroupHeader = (group: TaskGroup) => (
        <div key={`${group.id}-header`} className="px-3 pt-4 pb-1 sticky top-0 bg-canvas z-10">
            {/* Apply backdrop blur if header overlaps content */}
            {/* <div className="absolute inset-0 -mx-3 -my-1 bg-canvas/80 backdrop-blur-sm"></div> */}
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide relative">
                {group.title}
                {/* Optional: Show count */}
                <span className="ml-2 font-mono text-gray-400">{group.tasks.length}</span>
            </h2>
        </div>
    );

    // Empty state component
    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10">
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 150, damping: 15 }}>
                <Icon name="check-square" size={40} className="mb-3 text-gray-300" strokeWidth={1.5}/>
            </motion.div>
            <p className="text-sm text-gray-500">
                {filter === 'completed' ? 'No completed tasks yet.' :
                    filter === 'trash' ? 'Trash is empty.' :
                        filter === 'today' ? 'Nothing due today!' :
                            filter === 'next7days' ? 'Nothing upcoming in the next 7 days.' :
                                `No tasks in "${title}".`}
            </p>
            {(filter !== 'completed' && filter !== 'trash') && (
                <p className="text-xs text-muted mt-1">
                    Add a new task using the <Icon name="plus" size={10} className="inline mx-0.5"/> button.
                </p>
            )}
        </div>
    );


    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter} // Keep simple collision for now
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingId(null)}
            // Optimization: Measure items only when needed
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            {/* Full height container */}
            <div className="h-full max-h-screen flex flex-col bg-canvas">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-gray-200/70 flex justify-between items-center flex-shrink-0">
                    <h1 className="text-lg font-semibold text-gray-800 truncate pr-4">{title}</h1>
                    <div className="flex items-center space-x-1">
                        {/* Add Task Button */}
                        <Button
                            variant="primary"
                            size="md" // Slightly larger primary action
                            icon="plus"
                            onClick={handleAddTask}
                        >
                            Add Task
                        </Button>
                        {/* Optional: More Options Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="List options"
                            className="text-muted-foreground"
                        >
                            <Icon name="more-horizontal" size={18} />
                        </Button>
                    </div>
                </div>

                {/* Task List Area - Scrollable */}
                <div className="flex-1 overflow-y-auto styled-scrollbar">
                    {/* Render empty state or task groups */}
                    {taskIds.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                            {groupedTasks.map((group) => (
                                <div key={group.id}>
                                    {renderGroupHeader(group)}
                                    <AnimatePresence initial={false}>
                                        {group.tasks.map((task) => (
                                            <TaskItem key={task.id} task={task} />
                                            // Potential animation wrapper if needed per item
                                            // <motion.div
                                            //     key={task.id}
                                            //     layout // Animate layout changes
                                            //     initial={{ opacity: 0 }}
                                            //     animate={{ opacity: 1 }}
                                            //     exit={{ opacity: 0 }}
                                            //     transition={{ duration: 0.2 }}
                                            // >
                                            //      <TaskItem task={task} />
                                            // </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </SortableContext>
                    )}
                    {/* Add padding at the bottom for scroll breathing room */}
                    <div className="h-4"></div>
                </div>
            </div>

            {/* Drag Overlay for visual feedback */}
            <DragOverlay dropAnimation={null}>
                {draggingId && draggingTask ? <TaskItem task={draggingTask} isOverlay={true} /> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TaskList;