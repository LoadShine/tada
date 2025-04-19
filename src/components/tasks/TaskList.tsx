// src/components/tasks/TaskList.tsx
import React, {useCallback, useMemo, useState} from 'react';
import TaskItem from './TaskItem';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    groupedAllTasksAtom,
    searchFilteredTasksAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import {Task, TaskFilter, TaskGroupCategory} from '@/types';
import {
    closestCenter,
    defaultDropAnimationSideEffects,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    DropAnimation,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {AnimatePresence, motion} from 'framer-motion';
import {addDays, startOfDay, subDays} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';

interface TaskListProps {
    title: string; // Title displayed in the header
    filter: TaskFilter; // The filter associated with this list view (from routing)
}

// Sticky Group Header Component
const TaskGroupHeader: React.FC<{ title: string }> = React.memo(({title}) => (
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

// Drop animation configuration
const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {active: {opacity: '0.4'}},
    }),
};


const TaskList: React.FC<TaskListProps> = ({title: pageTitle, filter: _pageFilter}) => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom); // Use the global filter state
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const searchFilteredTasks = useAtomValue(searchFilteredTasksAtom);
    const searchTerm = useAtomValue(searchTermAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [draggingTaskCategory, setDraggingTaskCategory] = useState<TaskGroupCategory | undefined>(undefined);

    // Determine tasks and view type based on GLOBAL filter and search term
    const {tasksToDisplay, isGroupedView} = useMemo(() => {
        const isSearching = searchTerm.trim().length > 0;
        if (isSearching) {
            return {tasksToDisplay: searchFilteredTasks, isGroupedView: false};
        } else if (currentFilterGlobal === 'all') {
            return {tasksToDisplay: groupedTasks, isGroupedView: true};
        } else {
            return {tasksToDisplay: searchFilteredTasks, isGroupedView: false};
        }
    }, [searchTerm, currentFilterGlobal, groupedTasks, searchFilteredTasks]);

    // IDs for SortableContext based on currently displayed tasks
    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        const getIds = (data: Task[] | Record<string, Task[]>): UniqueIdentifier[] => {
            if (Array.isArray(data)) {
                return data.map(task => task.id); // Include all items for drop targets
            } else {
                return Object.values(data).flat().map(task => task.id); // Include all items
            }
        };
        return getIds(tasksToDisplay);
    }, [tasksToDisplay]);


    // DND sensors setup
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
    );

    // Drag start handler
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const task = tasks.find(t => t.id === active.id);
        if (task && !task.completed && task.list !== 'Trash') {
            setDraggingTask(task);
            setDraggingTaskCategory(active.data.current?.groupCategory as TaskGroupCategory | undefined);
            setSelectedTaskId(task.id);
        } else {
            setDraggingTask(null); // Disallow dragging completed/trashed
        }
    }, [tasks, setSelectedTaskId]);

    // Drag end handler
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;
        setDraggingTask(null);
        setDraggingTaskCategory(undefined);

        if (!over || !active.data.current?.task || active.id === over.id) {
            return;
        }

        const activeId = active.id as string;
        const overId = over.id as string;
        const originalTask = active.data.current.task as Task;

        const targetGroupCategory = (currentFilterGlobal === 'all' && over.data.current?.groupCategory)
            ? over.data.current?.groupCategory as TaskGroupCategory
            : undefined;
        const targetTask = over.data.current?.task as Task | undefined;

        setTasks((currentTasks) => {
            const oldIndex = currentTasks.findIndex(t => t.id === activeId);
            let newIndex = currentTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) return currentTasks;

            // Adjust drop index if dropping onto a completed task
            if (targetTask?.completed && oldIndex !== newIndex) {
                let potentialNewIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
                while (potentialNewIndex >= 0 && potentialNewIndex < currentTasks.length && currentTasks[potentialNewIndex].completed && potentialNewIndex !== oldIndex) {
                    potentialNewIndex = newIndex > oldIndex ? potentialNewIndex - 1 : potentialNewIndex + 1; // Move away from completed block
                }
                // Place *after* the last non-completed item found (or at start/end if block is at edge)
                newIndex = newIndex > oldIndex ? potentialNewIndex + 1 : potentialNewIndex;
                // Ensure index stays within bounds
                newIndex = Math.max(0, Math.min(currentTasks.length - 1, newIndex));
                // Adjust if oldIndex was before the target index
                if (oldIndex < newIndex && targetTask?.id === currentTasks[newIndex]?.id) {
                    newIndex--;
                }
            }


            const reorderedTasks = arrayMove(currentTasks, oldIndex, newIndex);
            const finalMovedTaskIndex = reorderedTasks.findIndex(t => t.id === activeId);
            const prevTask = finalMovedTaskIndex > 0 ? reorderedTasks[finalMovedTaskIndex - 1] : null;
            const nextTask = finalMovedTaskIndex < reorderedTasks.length - 1 ? reorderedTasks[finalMovedTaskIndex + 1] : null;
            const prevOrder = prevTask?.order;
            const nextOrder = nextTask?.order;
            let newOrderValue: number;

            if (prevOrder === undefined || prevOrder === null) {
                newOrderValue = (nextOrder ?? 0) - 1000;
            } else if (nextOrder === undefined || nextOrder === null) {
                newOrderValue = prevOrder + 1000;
            } else {
                if (prevOrder === nextOrder) {
                    newOrderValue = prevOrder + 0.001; // Increment slightly if orders identical
                } else {
                    newOrderValue = (prevOrder + nextOrder) / 2;
                }
            }
            if (!Number.isFinite(newOrderValue)) {
                console.warn("Calculated order is not finite:", newOrderValue, "Falling back.");
                newOrderValue = (prevOrder ?? Date.now()); // Fallback using timestamp variation
            }


            // Date Change Logic (Only for 'all' view drops between categories)
            let newDueDate: number | null | undefined = undefined;
            if (currentFilterGlobal === 'all' && targetGroupCategory && !originalTask.completed) {
                const originalCategory = originalTask.groupCategory;
                if (targetGroupCategory !== originalCategory) {
                    if (targetGroupCategory === 'today') newDueDate = startOfDay(new Date()).getTime();
                    else if (targetGroupCategory === 'next7days') newDueDate = startOfDay(addDays(new Date(), 1)).getTime();
                    else if (targetGroupCategory === 'later') newDueDate = startOfDay(addDays(new Date(), 8)).getTime();
                    else if (targetGroupCategory === 'nodate') newDueDate = null;
                    else if (targetGroupCategory === 'overdue') {
                        newDueDate = originalTask.dueDate && originalTask.dueDate < startOfDay(new Date()).getTime()
                            ? originalTask.dueDate // Keep original if already overdue
                            : startOfDay(subDays(new Date(), 1)).getTime(); // Otherwise set to yesterday
                    }

                    if (newDueDate === originalTask.dueDate) {
                        newDueDate = undefined; // Don't update if date hasn't actually changed
                    }
                }
            }

            // Apply Updates
            return reorderedTasks.map((task) => {
                if (task.id === activeId) {
                    return {
                        ...task,
                        order: newOrderValue,
                        updatedAt: Date.now(),
                        ...(newDueDate !== undefined && {dueDate: newDueDate}),
                    };
                }
                return task;
            });
        });

    }, [setTasks, currentFilterGlobal]);

    // Add new task handler
    const handleAddTask = useCallback(() => {
        const now = Date.now();
        let defaultList = 'Inbox';
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        if (currentFilterGlobal.startsWith('list-')) {
            const listName = currentFilterGlobal.substring(5);
            if (listName !== 'Trash') defaultList = listName;
        } else if (currentFilterGlobal === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (currentFilterGlobal.startsWith('tag-')) {
            defaultTags = [currentFilterGlobal.substring(4)];
        } else if (currentFilterGlobal === 'next7days') {
            defaultDueDate = startOfDay(addDays(now, 1)).getTime();
        }

        const minOrder = tasks.reduce((min, t) => Math.min(min, t.order ?? Infinity), Infinity);
        const newOrder = (isFinite(minOrder) ? minOrder : 0) - 1000;

        const newTask: Omit<Task, 'groupCategory'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '',
            completed: false, list: defaultList,
            dueDate: defaultDueDate, order: newOrder, createdAt: now,
            updatedAt: now, content: '', tags: defaultTags, priority: null,
        };

        setTasks(prev => [newTask as Task, ...prev]);
        setSelectedTaskId(newTask.id);

        setTimeout(() => {
            const titleInput = document.querySelector('.task-detail-title-input') as HTMLInputElement | null;
            titleInput?.focus();
            titleInput?.select();
        }, 150);

    }, [currentFilterGlobal, setTasks, setSelectedTaskId, tasks]);


    // Render task group (Requirement 2 handled here)
    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | 'flat-list' | string) => (
        // AnimatePresence handles item enter/exit animations
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task) => (
                // motion.div handles layout/position animations
                <motion.div
                    key={task.id}
                    layout="position" // Animates position changes smoothly
                    initial={{opacity: 0, y: -5}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, x: -10, transition: {duration: 0.15, ease: 'easeIn'}}}
                    transition={{duration: 0.20, ease: "easeOut"}} // Default animation for enter/layout
                    className="task-motion-wrapper"
                >
                    <TaskItem
                        task={task}
                        groupCategory={['today', 'next7days', 'later', 'nodate', 'overdue'].includes(groupKey)
                            ? (groupKey as TaskGroupCategory)
                            : task.groupCategory}
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    ), []);


    // Check if the current view is empty
    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every(group => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    // Empty state title
    const emptyStateTitle = useMemo(() => {
        if (searchTerm) return `No results for "${searchTerm}"`;
        if (currentFilterGlobal === 'trash') return 'Trash is empty';
        if (currentFilterGlobal === 'completed') return 'No completed tasks yet';
        return `No tasks in "${pageTitle}"`;
    }, [searchTerm, currentFilterGlobal, pageTitle]);

    // Group display titles and order
    const groupTitles: Record<TaskGroupCategory, string> = {
        overdue: 'Overdue', today: 'Today', next7days: 'Next 7 Days',
        later: 'Later', nodate: 'No Date',
    };
    const groupOrder: TaskGroupCategory[] = ['overdue', 'today', 'next7days', 'later', 'nodate'];

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
        >
            <div className="h-full flex flex-col bg-glass-alt-100 backdrop-blur-xl overflow-hidden">
                {/* Header */}
                <div className={twMerge(
                    "px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 z-10",
                    "bg-glass-alt-200 backdrop-blur-lg"
                )}>
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2"
                        title={pageTitle}>{pageTitle}</h1>
                    <div className="flex items-center space-x-1">
                        {currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash' && (
                            <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask}
                                    className="px-2.5 !h-[30px]"> Add </Button>
                        )}
                    </div>
                </div>

                {/* Scrollable Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        // Empty State
                        <div
                            className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10">
                            <Icon
                                name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : 'archive')}
                                size={40} className="mb-3 text-gray-300 opacity-80"
                            />
                            <p className="text-sm font-medium text-gray-500">{emptyStateTitle}</p>
                            {currentFilterGlobal !== 'trash' && currentFilterGlobal !== 'completed' && !searchTerm && (
                                <p className="text-xs mt-1 text-muted">Click the '+' button to add a new task.</p>
                            )}
                        </div>
                    ) : (
                        // --- REQUIREMENT 1: Use key to force remount on view type change ---
                        // This ensures an *instant* switch between grouped/flat lists.
                        <div key={isGroupedView ? 'grouped-view' : 'flat-view'}>
                            <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                                {isGroupedView ? (
                                    // Render Grouped View ('all' tasks)
                                    <>
                                        {groupOrder.map(groupKey => {
                                            const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                            if (groupTasks && groupTasks.length > 0) {
                                                return (
                                                    <div key={groupKey}>
                                                        <TaskGroupHeader title={groupTitles[groupKey]}/>
                                                        {/* Requirement 2 handled inside renderTaskGroup */}
                                                        {renderTaskGroup(groupTasks, groupKey)}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })}
                                    </>
                                ) : (
                                    // Render Flat List View
                                    <div className="pt-0.5">
                                        {/* Requirement 2 handled inside renderTaskGroup */}
                                        {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')}
                                    </div>
                                )}
                            </SortableContext>
                        </div>
                    )}
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={dropAnimationConfig}>
                {draggingTask ? (
                    <TaskItem task={draggingTask} groupCategory={draggingTaskCategory} isOverlay/>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
export default TaskList;