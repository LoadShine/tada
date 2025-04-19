// src/components/tasks/TaskList.tsx
// Kept task item add/remove/reorder animation, removed header/empty state animation
// Optimized callbacks and dependencies
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import TaskItem from './TaskItem';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    tasksAtom, selectedTaskIdAtom, currentFilterAtom,
    groupedAllTasksAtom, searchFilteredTasksAtom, searchTermAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter, TaskGroupCategory } from '@/types';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragOverlay, DragStartEvent, UniqueIdentifier, MeasuringStrategy
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion'; // Keep for TaskItem and DragOverlay
import {addDays, startOfDay} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';

interface TaskListProps {
    title: string;
    filter: TaskFilter;
}

// Sticky Group Header Component - Removed motion, keep sticky styling
const TaskGroupHeader: React.FC<{ title: string }> = React.memo(({ title }) => (
    <div
        className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-[5]"
        style={{
            backgroundColor: 'hsla(220, 30%, 96%, 0.85)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
        }}
    >
        {title}
    </div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';


const TaskList: React.FC<TaskListProps> = ({ title: pageTitle, filter: pageFilter }) => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [currentFilterInternal, setCurrentFilterInternal] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const searchFilteredTasks = useAtomValue(searchFilteredTasksAtom);
    const searchTerm = useAtomValue(searchTermAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [draggingTaskCategory, setDraggingTaskCategory] = useState<TaskGroupCategory | undefined>(undefined);

    useEffect(() => {
        if (pageFilter !== currentFilterInternal) {
            setCurrentFilterInternal(pageFilter);
        }
    }, [pageFilter, currentFilterInternal, setCurrentFilterInternal]);

    const { tasksToDisplay, isGroupedView } = useMemo(() => {
        const isSearching = searchTerm.trim().length > 0;
        if (isSearching) {
            return { tasksToDisplay: searchFilteredTasks, isGroupedView: false };
        } else if (currentFilterInternal === 'all') {
            return { tasksToDisplay: groupedTasks, isGroupedView: true };
        } else {
            return { tasksToDisplay: searchFilteredTasks, isGroupedView: false };
        }
    }, [searchTerm, currentFilterInternal, groupedTasks, searchFilteredTasks]);

    // Calculate sortableItems based on the *actual* tasks being displayed
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        const getIds = (tasksObj: Task[] | Record<string, Task[]>, grouped: boolean): UniqueIdentifier[] => {
            if (grouped) {
                return Object.values(tasksObj as Record<string, Task[]>).flat().map(task => task.id);
            } else {
                return (tasksObj as Task[]).map(task => task.id);
            }
        };
        return getIds(tasksToDisplay, isGroupedView);
    }, [tasksToDisplay, isGroupedView]);


    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const task = tasks.find(t => t.id === active.id); // Find from master list
        if (task) {
            setDraggingTask(task);
            // DND data should hold the category context at drag start
            setDraggingTaskCategory(active.data.current?.groupCategory as TaskGroupCategory | undefined ?? task.groupCategory);
            setSelectedTaskId(task.id);
        }
    }, [tasks, setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null);
        setDraggingTaskCategory(undefined);

        if (!over || active.id === over.id) return;

        const activeId = active.id as string;
        const overId = over.id as string;
        const targetGroupCategory = (currentFilterInternal === 'all' && over.data.current?.groupCategory)
            ? over.data.current?.groupCategory as TaskGroupCategory
            : undefined;

        setTasks((currentTasks) => {
            const oldIndex = currentTasks.findIndex(t => t.id === activeId);
            const newIndex = currentTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) {
                console.warn("TaskList DragEnd: Could not find dragged items indices.");
                return currentTasks; // Abort if indices not found
            }

            // Reorder based on full task list indices
            const reorderedTasks = arrayMove(currentTasks, oldIndex, newIndex);

            // Fractional Indexing (applied after simple reorder)
            const movedTaskIndex = reorderedTasks.findIndex(t => t.id === activeId);
            const prevTask = movedTaskIndex > 0 ? reorderedTasks[movedTaskIndex - 1] : null;
            const nextTask = movedTaskIndex + 1 < reorderedTasks.length ? reorderedTasks[movedTaskIndex + 1] : null;
            const prevOrder = prevTask?.order;
            const nextOrder = nextTask?.order;

            let newOrderValue: number;
            if (prevOrder === undefined || prevOrder === null) {
                newOrderValue = (nextOrder ?? 0) - 1000;
            } else if (nextOrder === undefined || nextOrder === null) {
                newOrderValue = prevOrder + 1000;
            } else {
                newOrderValue = (prevOrder + nextOrder) / 2;
            }

            // Date Change Logic
            let newDueDate: number | null | undefined = undefined;
            const originalTask = currentTasks[oldIndex]; // Get original task before reorder

            if (originalTask && currentFilterInternal === 'all' && targetGroupCategory) {
                const originalCategory = originalTask.groupCategory;
                if (targetGroupCategory !== originalCategory) {
                    if (targetGroupCategory === 'today') newDueDate = startOfDay(new Date()).getTime();
                    else if (targetGroupCategory === 'nodate') newDueDate = null;
                }
            }

            // Map over the *reordered* array to apply order and date changes
            return reorderedTasks.map((task, index) => {
                if (index === movedTaskIndex) { // Apply changes to the moved task
                    return {
                        ...task,
                        order: newOrderValue,
                        updatedAt: Date.now(),
                        ...(newDueDate !== undefined && { dueDate: newDueDate }),
                    };
                }
                return task;
            });
        });

    }, [setTasks, currentFilterInternal]);


    const handleAddTask = useCallback(() => {
        const now = Date.now();
        let defaultList = 'Inbox';
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        if (currentFilterInternal.startsWith('list-')) {
            const listName = currentFilterInternal.substring(5);
            if (listName !== 'Trash') defaultList = listName;
        } else if (currentFilterInternal === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (currentFilterInternal.startsWith('tag-')) {
            defaultTags = [currentFilterInternal.substring(4)];
        } else if (currentFilterInternal === 'next7days') {
            defaultDueDate = startOfDay(addDays(now, 1)).getTime();
        }

        // Calculate order for the *entire* task list, placing it at the very top
        const minOrder = tasks.reduce((min, t) => Math.min(min, t.order), Infinity);
        const newOrder = (isFinite(minOrder) ? minOrder : 0) - 1000;

        const newTaskBase: Omit<Task, 'groupCategory'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '', completed: false, list: defaultList, dueDate: defaultDueDate,
            order: newOrder, createdAt: now, updatedAt: now, content: '', tags: defaultTags, priority: null,
        };
        const newTask: Task = newTaskBase as Task;

        setTasks(prev => [newTask, ...prev]);
        setSelectedTaskId(newTask.id);

        setTimeout(() => {
            const titleInput = document.querySelector('.task-detail-title-input') as HTMLInputElement | null;
            titleInput?.focus();
        }, 150);

    }, [currentFilterInternal, setTasks, setSelectedTaskId, tasks]); // Added `tasks` dependency for minOrder calculation

    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | string) => (
        // Keep AnimatePresence for add/remove within group
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task) => (
                // Keep motion.div layout animation for reordering
                <motion.div
                    key={task.id}
                    layout // Enable smooth reordering animation
                    initial={{ opacity: 0, y: -5 }} // Subtle entry
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10, transition: { duration: 0.15, ease: 'easeIn' } }} // Subtle exit
                    transition={{ duration: 0.20, ease: "easeOut" }}
                    className="task-motion-wrapper"
                >
                    <TaskItem
                        task={task}
                        // Pass category from groupKey if available (for 'all' view DND context)
                        groupCategory={typeof groupKey === 'string' && ['overdue', 'today', 'next7days', 'later', 'nodate'].includes(groupKey) ? groupKey as TaskGroupCategory : task.groupCategory}
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    ), []); // TaskItem memoization handles props update

    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every(group => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            <div className="h-full flex flex-col bg-glass-alt-100 backdrop-blur-xl overflow-hidden">
                <div className={twMerge(
                    "px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 z-10",
                    "bg-glass-alt-200 backdrop-blur-lg"
                )}>
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2" title={pageTitle}>{pageTitle}</h1>
                    <div className="flex items-center space-x-1">
                        {currentFilterInternal !== 'completed' && currentFilterInternal !== 'trash' && (
                            <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="px-2.5 !h-[30px]"> Add </Button>
                        )}
                        <Button variant="ghost" size="icon" icon="more-horizontal" aria-label="List options" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        // Empty State Message (No animation)
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10">
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
                        </div>
                    ) : (
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {isGroupedView ? (
                                <>
                                    {/* Optimized group rendering */}
                                    {Object.entries(tasksToDisplay as Record<TaskGroupCategory, Task[]>)
                                        .filter(([, groupTasks]) => groupTasks.length > 0) // Only render non-empty groups
                                        .map(([groupKey, groupTasks]) => (
                                            <div key={groupKey}>
                                                <TaskGroupHeader title={groupKey.charAt(0).toUpperCase() + groupKey.slice(1).replace('7', ' 7 ')} />
                                                {renderTaskGroup(groupTasks, groupKey as TaskGroupCategory)}
                                            </div>
                                        ))
                                    }
                                </>
                            ) : (
                                <div className="pt-0.5">
                                    {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>

            {/* Keep DragOverlay for visual feedback */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <TaskItem
                        task={draggingTask}
                        groupCategory={draggingTaskCategory}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
export default TaskList;