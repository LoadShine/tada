// src/components/tasks/TaskList.tsx
import React, {useCallback, useMemo, useRef, useState} from 'react';
import TaskItem from './TaskItem';
import {useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    getTaskGroupCategory,
    groupedAllTasksAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom
} from '@/store/atoms';
import Icon from '../common/Icon';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar'; // shadcn Calendar
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'; // shadcn Popover
import {Task, TaskGroupCategory} from '@/types';
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
import {
    addDays,
    isBefore,
    isOverdue,
    isToday,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    subDays
} from '@/lib/utils/dateUtils';
import {cn} from '@/lib/utils';
import {ScrollArea} from '@/components/ui/scroll-area'; // Use shadcn ScrollArea

interface TaskListProps {
    title: string;
}

// Task Group Header (Refactored Styling)
const TaskGroupHeader: React.FC<{
    title: string;
    groupKey: TaskGroupCategory;
    onRescheduleAllClick?: () => void; // Simplified signature
}> = React.memo(({title, groupKey, onRescheduleAllClick}) => (
    <div
        className="flex items-center justify-between px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 bg-gradient-to-b from-background/90 via-background/80 to-background/70 backdrop-blur-md"
        // Masking for fade-out effect at the bottom
        style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
        }}
    >
        <span>{title}</span>
        {groupKey === 'overdue' && onRescheduleAllClick && (
            <Button
                variant="ghost" size="sm"
                onClick={onRescheduleAllClick}
                className="text-xs !h-5 px-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 -mr-1"
                title="Reschedule all overdue tasks..."
            >
                <Icon name="calendar-check" size={12} className="mr-1 opacity-80"/>
                Reschedule All
            </Button>
        )}
    </div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';

const dropAnimationConfig: DropAnimation = {sideEffects: defaultDropAnimationSideEffects({styles: {active: {opacity: '0.4'}}}),};
const groupTitles: Record<TaskGroupCategory, string> = {
    overdue: 'Overdue', today: 'Today', next7days: 'Next 7 Days', later: 'Later', nodate: 'No Date',
};
const groupOrder: TaskGroupCategory[] = ['overdue', 'today', 'next7days', 'later', 'nodate'];

// Main TaskList Component (Refactored)
const TaskList: React.FC<TaskListProps> = ({title: pageTitle}) => {
    const allTasks = useAtomValue(tasksAtom);
    const setTasks = useSetAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const rawSearchResults = useAtomValue(rawSearchResultsAtom);
    const searchTerm = useAtomValue(searchTermAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    // State for bulk reschedule popover
    const [isBulkRescheduleOpen, setIsBulkRescheduleOpen] = useState(false);
    const bulkRescheduleTriggerRef = useRef<HTMLButtonElement>(null);

    const {tasksToDisplay, isGroupedView, isSearching} = useMemo(() => {
        const searching = searchTerm.trim().length > 0;
        let displayData: Task[] | Record<TaskGroupCategory, Task[]> = [];
        let grouped = false;
        if (searching) {
            displayData = rawSearchResults;
            grouped = false;
        } else if (currentFilterGlobal === 'all') {
            displayData = groupedTasks;
            grouped = true;
        } else {
            let filtered: Task[] = [];
            const activeTasks = allTasks.filter(task => task.list !== 'Trash');
            const trashedTasks = allTasks.filter(task => task.list === 'Trash');
            switch (currentFilterGlobal) {
                case 'today':
                    filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isToday(task.dueDate));
                    break;
                case 'next7days':
                    filtered = activeTasks.filter(task => {
                        if (task.completed || task.dueDate == null) return false;
                        const date = safeParseDate(task.dueDate);
                        return date && isValid(date) && !isOverdue(date) && isWithinNext7Days(date);
                    });
                    break;
                case 'completed':
                    filtered = activeTasks.filter(task => task.completed).sort((a, b) => (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0));
                    break;
                case 'trash':
                    filtered = trashedTasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    break;
                default:
                    if (currentFilterGlobal.startsWith('list-')) {
                        const listName = currentFilterGlobal.substring(5);
                        filtered = activeTasks.filter(task => !task.completed && task.list === listName);
                    } else if (currentFilterGlobal.startsWith('tag-')) {
                        const tagName = currentFilterGlobal.substring(4);
                        filtered = activeTasks.filter(task => !task.completed && task.tags?.includes(tagName));
                    } else {
                        console.warn(`Unrecognized filter: ${currentFilterGlobal}`);
                        filtered = [];
                    }
                    break;
            }
            if (currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash') {
                filtered.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
            }
            displayData = filtered;
            grouped = false;
        }
        return {tasksToDisplay: displayData, isGroupedView: grouped, isSearching: searching};
    }, [searchTerm, currentFilterGlobal, groupedTasks, rawSearchResults, allTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (isGroupedView) {
            return groupOrder.flatMap(groupKey => (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey]?.map(task => task.id) ?? []);
        } else {
            return (tasksToDisplay as Task[]).map(task => task.id);
        }
    }, [tasksToDisplay, isGroupedView]);

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 8}}), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const allCurrentTasks = (isGroupedView ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat() : (tasksToDisplay as Task[]));
        const activeTask = allCurrentTasks.find(task => task.id === active.id) ?? allTasks.find(task => task.id === active.id);

        if (activeTask && !activeTask.completed && activeTask.list !== 'Trash') {
            setDraggingTask(activeTask);
            setSelectedTaskId(activeTask.id); // Keep selection during drag
        } else {
            setDraggingTask(null); // Don't allow dragging completed/trashed
        }
    }, [tasksToDisplay, isGroupedView, setSelectedTaskId, allTasks]);


    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;
        setDraggingTask(null); // Clear dragging state visually

        if (!over || !active.data.current?.task || active.id === over.id) return; // No valid drop or dropped on self

        const activeId = active.id as string;
        const overId = over.id as string;
        const originalTask = active.data.current.task as Task;

        // Prevent dropping completed/trashed tasks or dropping onto them
        const overTask = allTasks.find(t => t.id === overId);
        if (originalTask.completed || originalTask.list === 'Trash' || overTask?.completed || overTask?.list === 'Trash') {
            console.log("Cannot drop completed/trashed tasks or drop onto them.");
            return;
        }

        let targetGroupCategory: TaskGroupCategory | undefined = undefined;
        if (currentFilterGlobal === 'all' && over.data.current?.type === 'task-item') {
            targetGroupCategory = over.data.current?.groupCategory as TaskGroupCategory | undefined;
        }

        const categoryChanged = targetGroupCategory && targetGroupCategory !== originalTask.groupCategory;

        setTasks((currentTasks) => {
            const allSortableTasks = currentTasks.filter(t => sortableItems.includes(t.id));
            const oldIndex = allSortableTasks.findIndex(t => t.id === activeId);
            const newIndex = allSortableTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) {
                console.warn("DragEnd: Task index not found in sortable subset.");
                return currentTasks; // Return original if indices aren't valid in the current view
            }

            // Create a new array representing the visual order after move
            const movedVisualOrderIds = arrayMove(sortableItems, oldIndex, newIndex);

            // Calculate new fractional order based on visual neighbors
            const finalMovedVisualIndex = movedVisualOrderIds.indexOf(activeId);
            const prevTaskId = finalMovedVisualIndex > 0 ? movedVisualOrderIds[finalMovedVisualIndex - 1] : null;
            const nextTaskId = finalMovedVisualIndex < movedVisualOrderIds.length - 1 ? movedVisualOrderIds[finalMovedVisualIndex + 1] : null;

            const prevTask = prevTaskId ? currentTasks.find(t => t.id === prevTaskId) : null;
            const nextTask = nextTaskId ? currentTasks.find(t => t.id === nextTaskId) : null;

            // Fractional Indexing Logic (robust version)
            let newOrderValue: number;
            const orderGap = 1000; // Default gap
            const lowerBound = prevTask?.order ?? Number.MIN_SAFE_INTEGER;
            const upperBound = nextTask?.order ?? Number.MAX_SAFE_INTEGER;

            if (prevTask === null) { // Move to top
                newOrderValue = upperBound - orderGap;
            } else if (nextTask === null) { // Move to bottom
                newOrderValue = lowerBound + orderGap;
            } else { // Move between two tasks
                newOrderValue = lowerBound + (upperBound - lowerBound) / 2;
                // Check for potential precision issues or closeness
                if (newOrderValue <= lowerBound || newOrderValue >= upperBound) {
                    console.warn("Order calculation resulted in overlap or insufficient gap. Using random offset.");
                    // Fallback: Add small random offset to previous order
                    // This is less ideal than re-indexing, but simpler for now
                    newOrderValue = lowerBound + Math.random() * orderGap;
                    // Or trigger a re-index if this happens frequently:
                    // triggerReIndexNeeded();
                }
            }

            // Ensure finite number (shouldn't happen with MAX/MIN_SAFE_INTEGER)
            if (!Number.isFinite(newOrderValue)) {
                console.error("Order calculation failed, using Date.now().");
                newOrderValue = Date.now();
            }


            // --- Date Update Logic based on Category Drop ---
            let newDueDate: number | null | undefined = undefined; // undefined means no change
            if (categoryChanged && targetGroupCategory) {
                const todayStart = startOfDay(new Date());
                switch (targetGroupCategory) {
                    case 'today':
                        newDueDate = todayStart.getTime();
                        break;
                    case 'next7days':
                        newDueDate = startOfDay(addDays(new Date(), 1)).getTime();
                        break; // Tomorrow
                    case 'later':
                        newDueDate = startOfDay(addDays(new Date(), 8)).getTime();
                        break; // 8 days later
                    case 'overdue':
                        newDueDate = startOfDay(subDays(new Date(), 1)).getTime();
                        break; // Yesterday
                    case 'nodate':
                        newDueDate = null;
                        break;
                }

                // Check if the new date is functionally the same day as the old one
                const currentDueDateObj = safeParseDate(originalTask.dueDate);
                const currentDueDayStart = currentDueDateObj && isValid(currentDueDateObj) ? startOfDay(currentDueDateObj).getTime() : null;
                const newDueDayStart = newDueDate !== null && newDueDate !== undefined ? startOfDay(new Date(newDueDate)).getTime() : null;

                if (currentDueDayStart === newDueDayStart) {
                    newDueDate = undefined; // No functional date change needed
                }
            }

            // Update the task in the main task list
            return currentTasks.map(task => {
                if (task.id === activeId) {
                    const updatedFields: Partial<Task> = {
                        order: newOrderValue,
                        updatedAt: Date.now(),
                    };
                    if (newDueDate !== undefined) {
                        updatedFields.dueDate = newDueDate;
                    }
                    // Re-calculate category based on potential date change
                    const potentiallyUpdatedTask = {...task, ...updatedFields};
                    updatedFields.groupCategory = getTaskGroupCategory(potentiallyUpdatedTask);

                    return {...task, ...updatedFields};
                }
                return task;
            });
        });
    }, [setTasks, currentFilterGlobal, sortableItems, allTasks]);


    const handleAddTask = useCallback(() => {
        const now = Date.now();
        let defaultList = 'Inbox';
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];
        if (currentFilterGlobal.startsWith('list-')) {
            const listName = currentFilterGlobal.substring(5);
            if (listName !== 'Trash' && listName !== 'Completed') defaultList = listName;
        } else if (currentFilterGlobal === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (currentFilterGlobal.startsWith('tag-')) {
            defaultTags = [currentFilterGlobal.substring(4)];
        } else if (currentFilterGlobal === 'next7days') {
            defaultDueDate = startOfDay(addDays(now, 1)).getTime();
        }

        let newOrder: number;
        // Get IDs currently visible and sorted
        const currentVisualOrderIds = sortableItems;
        if (currentVisualOrderIds.length > 0) {
            const firstTaskId = currentVisualOrderIds[0];
            const firstTask = allTasks.find(t => t.id === firstTaskId);
            // Add before the first item
            const minOrder = (firstTask && typeof firstTask.order === 'number' && isFinite(firstTask.order)) ? firstTask.order : Date.now();
            newOrder = minOrder - 1000;
        } else {
            // Add to empty list
            newOrder = Date.now();
        }
        if (!isFinite(newOrder)) {
            newOrder = Date.now(); // Fallback
            console.warn("AddTask: Order calc fallback.");
        }

        const newTaskPartial: Omit<Task, 'groupCategory'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '', completed: false, completedAt: null, list: defaultList,
            completionPercentage: null, dueDate: defaultDueDate, order: newOrder,
            createdAt: now, updatedAt: now, content: '', tags: defaultTags, priority: null,
        };
        const newTask: Task = {
            ...newTaskPartial,
            groupCategory: getTaskGroupCategory(newTaskPartial)
        };
        setTasks(prev => [newTask, ...prev]);
        setSelectedTaskId(newTask.id);
        // Consider scrolling the new task into view here
    }, [currentFilterGlobal, setTasks, setSelectedTaskId, sortableItems, allTasks]);


    const handleOpenBulkReschedule = () => setIsBulkRescheduleOpen(true);
    const handleCloseBulkReschedule = () => setIsBulkRescheduleOpen(false);

    const handleBulkRescheduleDateSelect = useCallback((date: Date | undefined) => {
        if (!date || !isValid(date)) {
            handleCloseBulkReschedule();
            return;
        }
        const newDueDateTimestamp = startOfDay(date).getTime();
        setTasks(currentTasks =>
            currentTasks.map(task => {
                const isTaskOverdue = !task.completed && task.list !== 'Trash' &&
                    task.dueDate != null && isValid(task.dueDate) &&
                    isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date()));
                if (isTaskOverdue) {
                    return {...task, dueDate: newDueDateTimestamp, updatedAt: Date.now()};
                }
                return task;
            })
        );
        handleCloseBulkReschedule();
    }, [setTasks]);

    // Use framer-motion for list item animations
    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | 'flat-list' | string) => (
        <AnimatePresence initial={false}>
            {groupTasks.map((task: Task) => (
                <motion.div
                    key={task.id}
                    layout="position" // Animate position changes smoothly
                    initial={{opacity: 0, height: 0}}
                    animate={{opacity: 1, height: 'auto'}}
                    exit={{opacity: 0, height: 0, marginBottom: 0, transition: {duration: 0.15}}} // Faster exit
                    transition={{duration: 0.25, ease: "easeOut"}}
                    className="task-motion-wrapper" // Optional wrapper class if needed
                    style={{originY: 0}} // Helps with smoother height animation
                >
                    <TaskItem
                        task={task}
                        groupCategory={isGroupedView && groupKey !== 'flat-list' ? groupKey as TaskGroupCategory : undefined}
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    ), [isGroupedView]); // Depend on isGroupedView

    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every(group => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    const emptyStateTitle = useMemo(() => {
        if (isSearching) return `No results for "${searchTerm}"`;
        if (currentFilterGlobal === 'trash') return 'Trash is empty';
        if (currentFilterGlobal === 'completed') return 'No completed tasks yet';
        return `No tasks in "${pageTitle}"`;
    }, [isSearching, searchTerm, currentFilterGlobal, pageTitle]);

    const headerClass = cn(
        "px-3 py-2 border-b border-border/50 flex justify-between items-center flex-shrink-0 h-12",
        "bg-glass-alt-100 backdrop-blur-lg" // Glass effect header
    );
    const showAddTaskButton = useMemo(() => !['completed', 'trash'].includes(currentFilterGlobal) && !isSearching, [currentFilterGlobal, isSearching]);

    return (
        // Removed TaskItemMenuProvider as dropdowns are handled by shadcn
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd} measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
            <div className="h-full flex flex-col bg-transparent overflow-hidden relative">
                {/* Header */}
                <div className={headerClass}>
                    <h1 className="text-lg font-semibold text-foreground truncate pr-2" title={pageTitle}>
                        {pageTitle}
                    </h1>
                    <div className="flex items-center space-x-1">
                        {showAddTaskButton && (
                            <Button variant="default" size="sm" icon="plus" onClick={handleAddTask}>
                                Add Task
                            </Button>
                        )}
                    </div>
                </div>

                {/* Scrollable Task List Area */}
                <ScrollArea className="flex-1" type="auto">
                    <div className="relative px-0.5"> {/* Add padding for scrollbar */}
                        {isEmpty ? (
                            <div
                                className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-muted-foreground px-6 text-center pt-10"> {/* Adjust height calculation */}
                                <Icon
                                    name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : (isSearching ? 'search' : 'archive'))}
                                    size={44} className="mb-4 opacity-50"/>
                                <p className="text-sm font-medium text-foreground">{emptyStateTitle}</p>
                                {showAddTaskButton && (
                                    <p className="text-xs mt-1.5">Click the 'Add Task' button to create one.</p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                                    {isGroupedView ? (
                                        <>
                                            {groupOrder.map(groupKey => {
                                                const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                                if (groupTasks && groupTasks.length > 0) {
                                                    return (
                                                        <div key={groupKey} className="mb-2">
                                                            {/* Wrap trigger in Popover for reschedule */}
                                                            <Popover
                                                                open={isBulkRescheduleOpen && groupKey === 'overdue'}
                                                                onOpenChange={(open) => groupKey === 'overdue' && setIsBulkRescheduleOpen(open)}>
                                                                <PopoverTrigger asChild>
                                                                    {/* Need a clickable element for the PopoverTrigger */}
                                                                    {/* We'll make the header trigger the popover if clickable */}
                                                                    <div
                                                                        ref={groupKey === 'overdue' ? bulkRescheduleTriggerRef as any : null}>
                                                                        <TaskGroupHeader
                                                                            title={groupTitles[groupKey]}
                                                                            groupKey={groupKey}
                                                                            onRescheduleAllClick={groupKey === 'overdue' ? handleOpenBulkReschedule : undefined}
                                                                        />
                                                                    </div>
                                                                </PopoverTrigger>
                                                                {groupKey === 'overdue' && (
                                                                    <PopoverContent className="w-auto p-0" align="end">
                                                                        <Calendar
                                                                            mode="single"
                                                                            onSelect={handleBulkRescheduleDateSelect}
                                                                            initialFocus
                                                                        />
                                                                    </PopoverContent>
                                                                )}
                                                            </Popover>
                                                            <div className="pl-1 pr-0.5"> {/* Indent tasks slightly */}
                                                                {renderTaskGroup(groupTasks, groupKey)}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </>
                                    ) : (
                                        <div className="pt-1 pl-1 pr-0.5">
                                            {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')}
                                        </div>
                                    )}
                                </SortableContext>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Drag Overlay - Use TaskItem directly */}
            <DragOverlay dropAnimation={dropAnimationConfig}>
                {draggingTask ? (
                    <TaskItem
                        task={draggingTask}
                        isOverlay={true}
                        // No scrollContainerRef needed for overlay styling
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
TaskList.displayName = 'TaskList';
export default TaskList;