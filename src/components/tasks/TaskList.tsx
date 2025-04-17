// src/components/tasks/TaskList.tsx
import React, { useCallback, useState, useMemo } from 'react';
import TaskItem from './TaskItem';
import { useAtom, useAtomValue } from 'jotai'; // Import useAtomValue
import {
    filteredTasksAtom, // This will be read using useAtomValue
    tasksAtom,         // This needs useAtom for setter
    selectedTaskIdAtom,// This needs useAtom for setter
    currentFilterAtom, // This needs useAtom for setter
    groupedAllTasksAtom // This will be read using useAtomValue
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter } from '@/types'; // Ensure TaskGroupCategory is imported
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragOverlay, DragStartEvent, UniqueIdentifier
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { startOfDay } from "date-fns";
// import { twMerge } from "tailwind-merge";

interface TaskListProps { title: string; filter: TaskFilter; }

const TaskGroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <motion.div
        className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-[5]"
        // Apply glass effect to sticky header
        style={{
            backgroundColor: 'hsla(0, 0%, 100%, 0.75)', // White with alpha for light theme
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)', // Safari prefix
            // Mask to prevent blur bleeding downwards too much
            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
        layout // Animate position if list changes cause header shifts
    >
        {title}
    </motion.div>
);

const TaskList: React.FC<TaskListProps> = ({ title, filter }) => {
    // FIX: Use useAtomValue for read-only derived atoms
    const filteredTasksValue = useAtomValue(filteredTasksAtom);
    const groupedTasksValue = useAtomValue(groupedAllTasksAtom);

    // Use useAtom for atoms that need reading AND writing
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [currentFilterInternal, setCurrentFilterInternal] = useAtom(currentFilterAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);

    // Effect to sync the external filter prop with the internal atom state
    React.useEffect(() => {
        if (filter !== currentFilterInternal) {
            setCurrentFilterInternal(filter);
        }
    }, [filter, setCurrentFilterInternal, currentFilterInternal]);

    // Memoize sortableItems based on the *values* from atoms
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (filter === 'all') {
            // FIX: Directly use the value 'groupedTasksValue'
            return [
                ...groupedTasksValue.overdue,
                ...groupedTasksValue.today,
                ...groupedTasksValue.next7days,
                ...groupedTasksValue.later,
                ...groupedTasksValue.nodate,
            ].map(task => task.id);
        } else {
            // FIX: Directly use the value 'filteredTasksValue'
            return filteredTasksValue.map(task => task.id);
        }
    }, [filter, filteredTasksValue, groupedTasksValue]); // Dependencies are now the atom values

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const task = tasks.find(t => t.id === event.active.id);
        if (task) {
            setDraggingTask(task);
            setSelectedTaskId(task.id);
        }
    }, [tasks, setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null);
        if (over && active.id !== over.id) {
            setTasks((currentTasks) => {
                const currentVisibleIds = sortableItems; // Use the memoized IDs
                const oldVisibleIndex = currentVisibleIds.findIndex(id => id === active.id);
                const newVisibleIndex = currentVisibleIds.findIndex(id => id === over.id);

                if (oldVisibleIndex === -1 || newVisibleIndex === -1) {
                    console.warn("TaskList DragEnd: Could not find task indices in visible list.");
                    // Fallback just in case
                    const oldFullIndex = currentTasks.findIndex(t => t.id === active.id);
                    const newFullIndex = currentTasks.findIndex(t => t.id === over.id);
                    if (oldFullIndex !== -1 && newFullIndex !== -1) {
                        const reordered = arrayMove(currentTasks, oldFullIndex, newFullIndex);
                        // Simple reorder based on index if fractional fails
                        return reordered.map((t, i) => ({ ...t, order: i, updatedAt: Date.now() }));
                    }
                    return currentTasks;
                }

                // Fractional Indexing Logic (seems correct)
                const prevTaskOrder = newVisibleIndex > 0 ? currentTasks.find(t => t.id === currentVisibleIds[newVisibleIndex - 1])?.order : null;
                const nextTaskOrder = currentTasks.find(t => t.id === currentVisibleIds[newVisibleIndex])?.order;
                let newOrderValue: number;
                if (prevTaskOrder === null || prevTaskOrder === undefined) newOrderValue = (nextTaskOrder ?? 0) - 1;
                else if (nextTaskOrder === null || nextTaskOrder === undefined) newOrderValue = prevTaskOrder + 1;
                else newOrderValue = (prevTaskOrder + nextTaskOrder) / 2;

                return currentTasks.map(task => task.id === active.id ? { ...task, order: newOrderValue, updatedAt: Date.now() } : task );
            });
        }
    }, [setTasks, sortableItems]); // Depend on sortableItems

    const handleAddTask = () => {
        const now = Date.now();
        let defaultList = 'Inbox'; if (filter.startsWith('list-')) defaultList = filter.substring(5);
        let defaultDueDate: number | null = null; if (filter === 'today') defaultDueDate = startOfDay(now).getTime();

        // Calculate order to place at the top of the current view or overall top
        const firstVisibleTaskOrder = sortableItems.length > 0 ? tasks.find(t => t.id === sortableItems[0])?.order : undefined;
        let newOrder: number;
        if (firstVisibleTaskOrder !== undefined) {
            newOrder = firstVisibleTaskOrder - 1; // Place before the first visible item
        } else { // List is empty or couldn't find order, place at very top
            const minOrder = tasks.length > 0 ? tasks.reduce((min, t) => Math.min(min, t.order), Infinity) : Infinity;
            newOrder = (minOrder === Infinity ? 0 : minOrder) - 1;
        }


        const newTask: Task = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`, title: '', completed: false, list: defaultList, dueDate: defaultDueDate, order: newOrder,
            createdAt: now, updatedAt: now, content: '', tags: filter.startsWith('tag-') ? [filter.substring(4)] : [], priority: null,
        };
        setTasks(prev => [...prev, newTask]); // Add task
        setSelectedTaskId(newTask.id); // Select it
        setTimeout(() => { (document.querySelector('.task-detail-title-input') as HTMLInputElement)?.focus(); }, 300); // Focus in detail view
    };

    // Render group helper function (remains the same, expects Task[])
    const renderTaskGroup = (groupTasks: Task[], _groupKey: string | number) => (
        <AnimatePresence initial={false}>
            {groupTasks.map((task) => (
                <motion.div key={task.id} layout initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }} transition={{ duration: 0.2, ease: "easeOut" }} className="task-motion-wrapper" >
                    <TaskItem task={task} />
                </motion.div> ))}
        </AnimatePresence>
    );

    // FIX: Check length on the *values* from atoms
    const isEmpty = filter === 'all'
        ? Object.values(groupedTasksValue).every(group => group.length === 0)
        : filteredTasksValue.length === 0;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} >
            <div className="h-full flex flex-col bg-canvas">
                {/* Header */}
                <div className="px-3 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0 h-10 bg-glass-header backdrop-blur-sm">
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2">{title}</h1>
                    <div className="flex items-center space-x-1">
                        {filter !== 'completed' && filter !== 'trash' && ( <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="ml-1 px-2.5"> Add </Button> )}
                        <Button variant="ghost" size="icon" aria-label="List options" className="w-7 h-7 text-muted-foreground"> <Icon name="more-horizontal" size={18} /> </Button>
                    </div>
                </div>
                {/* Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        <motion.div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} >
                            <Icon name={filter === 'trash' ? 'trash' : (filter === 'completed' ? 'check-square' : 'archive')} size={40} className="mb-3 text-gray-300 opacity-80" />
                            <p className="text-sm font-medium text-gray-500"> {filter === 'trash' ? 'Trash is empty' : (filter === 'completed' ? 'No completed tasks' : `No tasks in ${title}`)} </p>
                            {filter !== 'trash' && filter !== 'completed' && ( <p className="text-xs mt-1 text-muted">Add a task using the '+' button.</p> )}
                        </motion.div>
                    ) : (
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {filter === 'all' ? (
                                <>
                                    {/* FIX: Access properties on groupedTasksValue */}
                                    {groupedTasksValue.overdue.length > 0 && ( <> <TaskGroupHeader title="Overdue" /> {renderTaskGroup(groupedTasksValue.overdue, 'overdue')} </> )}
                                    {groupedTasksValue.today.length > 0 && ( <> <TaskGroupHeader title="Today" /> {renderTaskGroup(groupedTasksValue.today, 'today')} </> )}
                                    {groupedTasksValue.next7days.length > 0 && ( <> <TaskGroupHeader title="Next 7 Days" /> {renderTaskGroup(groupedTasksValue.next7days, 'next7days')} </> )}
                                    {groupedTasksValue.later.length > 0 && ( <> <TaskGroupHeader title="Later" /> {renderTaskGroup(groupedTasksValue.later, 'later')} </> )}
                                    {groupedTasksValue.nodate.length > 0 && ( <> <TaskGroupHeader title="No Due Date" /> {renderTaskGroup(groupedTasksValue.nodate, 'nodate')} </> )}
                                </>
                            ) : (
                                <div className="pt-0.5"> {/* Ensure consistent padding */}
                                    {/* FIX: Pass the value array 'filteredTasksValue' */}
                                    {renderTaskGroup(filteredTasksValue, 'default-group')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>
            <DragOverlay dropAnimation={null}> {draggingTask ? <TaskItem task={draggingTask} isOverlay /> : null} </DragOverlay>
        </DndContext>
    );
};
export default TaskList;