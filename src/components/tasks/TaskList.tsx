// src/components/tasks/TaskList.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import TaskItem from './TaskItem';
import {useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    groupedAllTasksAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom,
    userListNamesAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import * as Popover from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import {Task, TaskGroupCategory} from '@/types';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {AnimatePresence} from 'framer-motion';
import {
    addDays,
    formatRelativeDate,
    isBefore,
    isOverdue,
    isToday,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    subDays,
} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import {TaskItemMenuProvider} from '@/context/TaskItemMenuContext';
import {IconName} from '../common/IconMap';

const priorityMap: Record<number, {
    label: string;
    iconColor: string;
    bgColor: string;
    shortLabel: string;
    borderColor?: string; // For input bar border
    dotColor?: string; // For input bar dot
}> = {
    1: {
        label: 'High Priority',
        iconColor: 'text-error',
        bgColor: 'bg-error',
        shortLabel: 'P1',
        borderColor: 'border-error',
        dotColor: 'bg-error'
    },
    2: {
        label: 'Medium Priority',
        iconColor: 'text-warning',
        bgColor: 'bg-warning',
        shortLabel: 'P2',
        borderColor: 'border-warning',
        dotColor: 'bg-warning'
    },
    3: {
        label: 'Low Priority',
        iconColor: 'text-info',
        bgColor: 'bg-info',
        shortLabel: 'P3',
        borderColor: 'border-info',
        dotColor: 'bg-info'
    },
    4: {
        label: 'Lowest Priority',
        iconColor: 'text-grey-medium',
        bgColor: 'bg-grey-medium',
        shortLabel: 'P4',
        borderColor: 'border-grey-medium',
        dotColor: 'bg-grey-medium'
    },
};

interface TaskListProps {
    title: string;
}

const TaskGroupHeader: React.FC<{
    title: string;
    groupKey: TaskGroupCategory;
}> = React.memo(({title, groupKey}) => (
    <div
        className={twMerge(
            "flex items-center justify-between px-4 pt-3 pb-1.5",
            "text-[12px] font-normal text-grey-medium uppercase tracking-[0.5px]",
            "sticky top-0 z-10 bg-white dark:bg-neutral-800"
        )}
    >
        <span>{title}</span>
        {groupKey === 'overdue' && (
            <Popover.Anchor asChild>
                <Popover.Trigger asChild>
                    <Button
                        variant="link" size="sm" icon="calendar-check"
                        className="text-[11px] !h-5 px-1 text-primary hover:text-primary-dark -mr-1"
                        title="Reschedule all overdue tasks..."
                        iconProps={{size: 12, strokeWidth: 1.5}}
                    >
                        Reschedule All
                    </Button>
                </Popover.Trigger>
            </Popover.Anchor>
        )}
    </div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';

const groupTitles: Record<TaskGroupCategory, string> = {
    overdue: 'Overdue', today: 'Today', next7days: 'Next 7 Days', later: 'Later', nodate: 'No Date',
};
const groupOrder: TaskGroupCategory[] = ['overdue', 'today', 'next7days', 'later', 'nodate'];

const getNewTaskMenuSubTriggerClasses = () => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 dark:data-[state=open]:bg-neutral-700",
    "text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark",
    "dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

const getNewTaskMenuRadioItemListClasses = () => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
    "data-[state=checked]:bg-primary-light data-[state=checked]:text-primary",
    "dark:data-[state=checked]:bg-primary-dark/30 dark:data-[state=checked]:text-primary-light",
    "text-grey-dark data-[highlighted]:text-grey-dark",
    "dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

const TaskList: React.FC<TaskListProps> = ({title: pageTitle}) => {
    const allTasks = useAtomValue(tasksAtom);
    const setTasks = useSetAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const rawSearchResults = useAtomValue(rawSearchResultsAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [isBulkRescheduleOpen, setIsBulkRescheduleOpen] = useState(false);

    const newTaskTitleInputRef = useRef<HTMLInputElement>(null);
    const dateDisplayRef = useRef<HTMLSpanElement>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
    const [newTaskPriority, setNewTaskPriority] = useState<number | null>(null);
    const [newTaskListState, setNewTaskListState] = useState<string>('Inbox');

    const [isNewTaskDatePickerOpen, setIsNewTaskDatePickerOpen] = useState(false);
    const [isNewTaskMoreOptionsOpen, setIsNewTaskMoreOptionsOpen] = useState(false);
    const [dateTextWidth, setDateTextWidth] = useState(0);

    const availableListsForNewTask = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    useEffect(() => {
        if (newTaskDueDate && dateDisplayRef.current) {
            setDateTextWidth(dateDisplayRef.current.offsetWidth);
        } else {
            setDateTextWidth(0);
        }
    }, [newTaskDueDate, isNewTaskDatePickerOpen]);


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
            const activeTasks = allTasks.filter((task: Task) => task.list !== 'Trash');
            const trashedTasks = allTasks.filter((task: Task) => task.list === 'Trash');

            switch (currentFilterGlobal) {
                case 'today':
                    filtered = activeTasks.filter((task: Task) => !task.completed && task.dueDate != null && isToday(task.dueDate));
                    break;
                case 'next7days':
                    filtered = activeTasks.filter((task: Task) => {
                        if (task.completed || task.dueDate == null) return false;
                        const date = safeParseDate(task.dueDate);
                        return date && isValid(date) && !isOverdue(date) && isWithinNext7Days(date);
                    });
                    break;
                case 'completed':
                    filtered = activeTasks.filter((task: Task) => task.completed).sort((a: Task, b: Task) =>
                        (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0)
                    );
                    break;
                case 'trash':
                    filtered = trashedTasks.sort((a: Task, b: Task) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    break;
                default:
                    if (currentFilterGlobal.startsWith('list-')) {
                        const listName = currentFilterGlobal.substring(5);
                        filtered = activeTasks.filter((task: Task) => !task.completed && task.list === listName);
                    } else if (currentFilterGlobal.startsWith('tag-')) {
                        const tagName = currentFilterGlobal.substring(4);
                        filtered = activeTasks.filter((task: Task) => !task.completed && task.tags?.includes(tagName));
                    } else {
                        console.warn(`Unrecognized filter: ${currentFilterGlobal}, showing all tasks.`);
                        displayData = groupedTasks;
                        grouped = true;
                        filtered = [];
                    }
                    break;
            }
            if (!grouped && currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash') {
                filtered.sort((a: Task, b: Task) => (a.order - b.order) || (a.createdAt - b.createdAt));
            }
            if (!grouped) {
                displayData = filtered;
            }
        }
        return {tasksToDisplay: displayData, isGroupedView: grouped, isSearching: searching};
    }, [searchTerm, currentFilterGlobal, groupedTasks, rawSearchResults, allTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (isGroupedView) {
            return groupOrder.flatMap(groupKey =>
                (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey]?.map(task => task.id) ?? []
            );
        } else {
            return (tasksToDisplay as Task[]).map(task => task.id);
        }
    }, [tasksToDisplay, isGroupedView]);

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const allVisibleTasks = isGroupedView
            ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat()
            : (tasksToDisplay as Task[]);
        const activeTask = allVisibleTasks.find((task: Task) => task.id === active.id) ?? allTasks.find((task: Task) => task.id === active.id);

        if (activeTask && !activeTask.completed && activeTask.list !== 'Trash') {
            setDraggingTask(activeTask);
            setSelectedTaskId(activeTask.id);
        } else {
            setDraggingTask(null);
        }
    }, [tasksToDisplay, isGroupedView, setSelectedTaskId, allTasks]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;
        setDraggingTask(null);

        if (!over || !active.data.current?.task || active.id === over.id) {
            return;
        }

        const activeId = active.id as string;
        const overId = over.id as string;
        const originalTask = active.data.current.task as Task;

        let targetGroupCategory: TaskGroupCategory | undefined = undefined;
        if (currentFilterGlobal === 'all' && over.data.current?.type === 'task-item') {
            targetGroupCategory = over.data.current?.groupCategory as TaskGroupCategory | undefined;
        }
        const categoryChanged = targetGroupCategory && targetGroupCategory !== originalTask.groupCategory;

        setTasks((currentTasks) => {
            const oldIndex = currentTasks.findIndex(t => t.id === activeId);
            const newIndex = currentTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) {
                console.warn("DragEnd: Task not found in current task list.");
                return currentTasks;
            }

            const currentVisualOrderIds = sortableItems;
            const activeVisualIndex = currentVisualOrderIds.indexOf(activeId);
            const overVisualIndex = currentVisualOrderIds.indexOf(overId);

            if (activeVisualIndex === -1 || overVisualIndex === -1) {
                console.warn("DragEnd: Task not found in visual order array.");
                return currentTasks;
            }

            const movedVisualOrderIds = arrayMove(currentVisualOrderIds, activeVisualIndex, overVisualIndex);
            const finalMovedVisualIndex = movedVisualOrderIds.indexOf(activeId);

            const prevTaskId = finalMovedVisualIndex > 0 ? movedVisualOrderIds[finalMovedVisualIndex - 1] : null;
            const nextTaskId = finalMovedVisualIndex < movedVisualOrderIds.length - 1 ? movedVisualOrderIds[finalMovedVisualIndex + 1] : null;

            const prevTask = prevTaskId ? currentTasks.find((t: Task) => t.id === prevTaskId) : null;
            const nextTask = nextTaskId ? currentTasks.find((t: Task) => t.id === nextTaskId) : null;

            const prevOrder = prevTask?.order;
            const nextOrder = nextTask?.order;
            let newOrderValue: number;

            if (prevOrder === undefined || prevOrder === null) {
                newOrderValue = (nextOrder ?? Date.now()) - 1000;
            } else if (nextOrder === undefined || nextOrder === null) {
                newOrderValue = prevOrder + 1000;
            } else {
                const mid = prevOrder + (nextOrder - prevOrder) / 2;
                if (!Number.isFinite(mid) || mid <= prevOrder || mid >= nextOrder) {
                    newOrderValue = prevOrder + Math.random();
                    console.warn("Order calculation fallback (random offset).");
                } else {
                    newOrderValue = mid;
                }
            }
            if (!Number.isFinite(newOrderValue)) {
                newOrderValue = Date.now();
                console.warn("Order calculation fallback (Date.now()).");
            }

            let newDueDateValue: number | null | undefined = undefined;

            if (categoryChanged && targetGroupCategory) {
                const todayStart = startOfDay(new Date());
                switch (targetGroupCategory) {
                    case 'today':
                        newDueDateValue = todayStart.getTime();
                        break;
                    case 'next7days':
                        newDueDateValue = startOfDay(addDays(todayStart, 1)).getTime();
                        break;
                    case 'later':
                        newDueDateValue = startOfDay(addDays(todayStart, 8)).getTime();
                        break;
                    case 'overdue':
                        newDueDateValue = startOfDay(subDays(todayStart, 1)).getTime();
                        break;
                    case 'nodate':
                        newDueDateValue = null;
                        break;
                }

                const currentDueDateObj = safeParseDate(originalTask.dueDate);
                const currentDueDayStart = currentDueDateObj && isValid(currentDueDateObj) ? startOfDay(currentDueDateObj).getTime() : null;
                const newDueDayStart = newDueDateValue !== null && newDueDateValue !== undefined ? startOfDay(new Date(newDueDateValue)).getTime() : null;

                if (currentDueDayStart === newDueDayStart) {
                    newDueDateValue = undefined;
                }
            }
            return currentTasks.map((task: Task) => {
                if (task.id === activeId) {
                    const updates: Partial<Task> = {
                        order: newOrderValue,
                    };
                    if (newDueDateValue !== undefined) {
                        updates.dueDate = newDueDateValue;
                    }
                    return {...task, ...updates};
                }
                return task;
            });
        });

    }, [setTasks, currentFilterGlobal, sortableItems]);

    const commitNewTask = useCallback(() => {
        const titleToSave = newTaskTitle.trim();
        if (!titleToSave) return;

        const now = Date.now();
        let newOrder: number;
        const allCurrentTasks = allTasks;
        const topTaskOrder = allCurrentTasks
            .filter(t => !t.completed && t.list !== 'Trash')
            .sort((a, b) => a.order - b.order)[0]?.order;

        if (typeof topTaskOrder === 'number' && isFinite(topTaskOrder)) {
            newOrder = topTaskOrder - 1000;
        } else {
            newOrder = Date.now() - 1000;
        }
        if (!isFinite(newOrder)) {
            newOrder = Date.now();
            console.warn("NewTaskInput: Order calculation fallback (Date.now()).");
        }

        const taskToAdd: Omit<Task, 'groupCategory' | 'completed'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: titleToSave,
            completedAt: null,
            list: newTaskListState,
            completionPercentage: null,
            dueDate: newTaskDueDate ? newTaskDueDate.getTime() : null,
            priority: newTaskPriority,
            order: newOrder,
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: [],
        };

        setTasks(prev => [taskToAdd as Task, ...prev].sort((a, b) => a.order - b.order));
        setNewTaskTitle('');
        setNewTaskDueDate(null);
        setNewTaskPriority(null);
        newTaskTitleInputRef.current?.focus();

    }, [
        newTaskTitle, newTaskDueDate, newTaskPriority, newTaskListState,
        setTasks, allTasks
    ]);


    const handleBulkRescheduleDateSelect = useCallback((date: Date | undefined) => {
        if (!date || !isValid(date)) {
            setIsBulkRescheduleOpen(false);
            return;
        }
        const newDueDateTimestamp = date.getTime();

        setTasks(currentTasks =>
            currentTasks.map((task: Task) => {
                const isTaskOverdue = !task.completed &&
                    task.list !== 'Trash' &&
                    task.dueDate != null &&
                    isValid(task.dueDate) &&
                    isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date()));

                if (isTaskOverdue) {
                    return {...task, dueDate: newDueDateTimestamp};
                }
                return task;
            })
        );
        setIsBulkRescheduleOpen(false);
    }, [setTasks]);

    const closeBulkReschedulePopover = useCallback(() => setIsBulkRescheduleOpen(false), []);

    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | 'flat-list' | string) => (
        <AnimatePresence initial={false} mode="sync">
            {groupTasks.map((task: Task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    groupCategory={isGroupedView && groupKey !== 'flat-list' ? groupKey as TaskGroupCategory : undefined}
                    scrollContainerRef={scrollContainerRef}
                />
            ))}
        </AnimatePresence>
    ), [isGroupedView, scrollContainerRef]);

    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every((group: Task[]) => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    const emptyStateTitle = useMemo(() => {
        if (isSearching) return `No results for "${searchTerm}"`;
        if (currentFilterGlobal === 'trash') return 'Trash is empty';
        if (currentFilterGlobal === 'completed') return 'No completed tasks yet';
        if (currentFilterGlobal.startsWith('list-') || currentFilterGlobal.startsWith('tag-')) {
            return `No active tasks in "${pageTitle}"`;
        }
        return `No tasks for "${pageTitle}"`;
    }, [isSearching, searchTerm, currentFilterGlobal, pageTitle]);

    const headerClass = useMemo(() => twMerge(
        "px-6 py-0 h-[56px]",
        "border-b border-grey-light dark:border-neutral-700",
        "flex justify-between items-center flex-shrink-0 z-10",
        "bg-white dark:bg-neutral-800"
    ), []);

    const showNewTaskInputArea = useMemo(() =>
            !['completed', 'trash'].includes(currentFilterGlobal) && !isSearching,
        [currentFilterGlobal, isSearching]);

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    const moreOptionsDropdownContentClasses = useMemo(() => twMerge(
        "z-[60] min-w-[220px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide"
    ), []);

    const newTaskInputWrapperClass = useMemo(() => twMerge(
        "group relative flex items-center w-full h-[32px]",
        "bg-grey-ultra-light dark:bg-neutral-700/60",
        "rounded-base",
        "transition-all duration-150 ease-in-out",
        "border border-transparent dark:border-transparent",
        newTaskPriority && priorityMap[newTaskPriority]?.dotColor ? `${priorityMap[newTaskPriority]?.borderColor}` : "border-transparent"
    ), [newTaskPriority]);

    const inputPaddingLeft = useMemo(() => {
        const basePadding = 32;
        const dateTextPadding = dateTextWidth > 0 ? dateTextWidth + 8 + 12 : 0;
        return basePadding + dateTextPadding;
    }, [dateTextWidth]);


    const newTaskInputClass = useMemo(() => twMerge(
        "w-full h-full pr-7 text-[13px] font-light",
        "bg-transparent border-none outline-none",
        "text-grey-dark dark:text-neutral-100 placeholder:text-grey-medium dark:placeholder:text-neutral-400/70"
    ), []);

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNewTaskDueDate(null);
        setIsNewTaskDatePickerOpen(false);
    };

    const handlePriorityFlagClick = (priorityValue: number | null) => {
        setNewTaskPriority(currentPriority => currentPriority === priorityValue ? null : priorityValue);
        setIsNewTaskMoreOptionsOpen(false);
        newTaskTitleInputRef.current?.focus();
    };

    return (
        <TaskItemMenuProvider>
            <div className="h-full flex flex-col bg-white dark:bg-neutral-800 overflow-hidden relative">
                <div className={headerClass}>
                    <h1 className="text-[18px] font-light text-grey-dark dark:text-neutral-100 truncate pr-2"
                        title={pageTitle}>{pageTitle}</h1>
                </div>

                {showNewTaskInputArea && (
                    <div
                        className="px-3 py-2.5 border-b border-grey-ultra-light dark:border-neutral-700/50 bg-white dark:bg-neutral-800">
                        <div className={newTaskInputWrapperClass}>
                            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 flex items-center h-full">
                                <Popover.Root open={isNewTaskDatePickerOpen} onOpenChange={setIsNewTaskDatePickerOpen}>
                                    <Popover.Trigger asChild>
                                        <button
                                            type="button"
                                            className={twMerge(
                                                "flex items-center justify-center w-7 h-7 rounded-l-base hover:bg-grey-light focus:outline-none",
                                                "dark:hover:bg-neutral-600",
                                                newTaskDueDate ? "text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary" : "text-grey-medium hover:text-grey-dark dark:text-neutral-400 dark:hover:text-neutral-200"
                                            )}
                                            aria-label="Set due date"
                                        >
                                            <Icon name="calendar" size={16} strokeWidth={1.5}/>
                                        </button>
                                    </Popover.Trigger>
                                    <Popover.Portal>
                                        <Popover.Content
                                            sideOffset={5}
                                            align="start"
                                            className={datePickerPopoverWrapperClasses}
                                            onOpenAutoFocus={(e) => e.preventDefault()}
                                            onCloseAutoFocus={(e) => {
                                                e.preventDefault();
                                                newTaskTitleInputRef.current?.focus();
                                            }}
                                        >
                                            <CustomDatePickerContent
                                                initialDate={newTaskDueDate ?? undefined}
                                                onSelect={(date) => {
                                                    setNewTaskDueDate(date ?? null);
                                                    setIsNewTaskDatePickerOpen(false);
                                                }}
                                                closePopover={() => setIsNewTaskDatePickerOpen(false)}
                                            />
                                        </Popover.Content>
                                    </Popover.Portal>
                                </Popover.Root>

                                {newTaskDueDate && (
                                    <div className="flex items-center pl-1 pr-1 h-full">
                                        <span
                                            ref={dateDisplayRef}
                                            className="text-[12px] text-primary dark:text-primary-light whitespace-nowrap font-medium"
                                        >
                                            {formatRelativeDate(newTaskDueDate, false)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <input
                                ref={newTaskTitleInputRef}
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newTaskTitle.trim()) commitNewTask();
                                }}
                                placeholder={`Add task to "${newTaskListState}"`}
                                className={newTaskInputClass}
                                style={{paddingLeft: `${inputPaddingLeft}px`}}
                            />

                            <div
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none group-focus-within:pointer-events-auto">
                                <DropdownMenu.Root open={isNewTaskMoreOptionsOpen}
                                                   onOpenChange={setIsNewTaskMoreOptionsOpen}>
                                    <DropdownMenu.Trigger asChild>
                                        <button
                                            type="button"
                                            className="flex items-center justify-center w-7 h-7 rounded-r-base hover:bg-grey-light dark:hover:bg-neutral-600 text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-primary"
                                            aria-label="More task options"
                                        >
                                            <Icon name="chevron-down" size={16} strokeWidth={1.5}/>
                                        </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                            className={moreOptionsDropdownContentClasses}
                                            sideOffset={5}
                                            align="end"
                                            onCloseAutoFocus={(e) => {
                                                e.preventDefault();
                                                newTaskTitleInputRef.current?.focus();
                                            }}
                                        >
                                            <div
                                                className="px-3 pt-2 pb-1 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">Priority
                                            </div>
                                            <div className="flex justify-around items-center px-2 py-1.5">
                                                {[1, 2, 3, 4].map(pVal => {
                                                    const pData = priorityMap[pVal];
                                                    const isSelected = newTaskPriority === pVal;
                                                    return (
                                                        <button
                                                            key={pVal}
                                                            onClick={() => handlePriorityFlagClick(pVal)}
                                                            className={twMerge(
                                                                "flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                                pData.iconColor,
                                                                // Conditional background for selected, hover, or focus-visible
                                                                isSelected ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                                    : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                                            )}
                                                            title={pData.label}
                                                            aria-pressed={isSelected}
                                                        >
                                                            <Icon name="flag" size={16} strokeWidth={1.5}/>
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    onClick={() => handlePriorityFlagClick(null)}
                                                    className={twMerge(
                                                        "flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                        newTaskPriority === null
                                                            ? "text-grey-dark dark:text-neutral-200"
                                                            : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-300 focus-visible:text-grey-dark dark:focus-visible:text-neutral-300",

                                                        newTaskPriority === null ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                            : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                                    )}
                                                    title="No Priority"
                                                    aria-pressed={newTaskPriority === null}
                                                >
                                                    <Icon name="minus" size={16} strokeWidth={1.5}/>
                                                </button>
                                            </div>

                                            <DropdownMenu.Separator
                                                className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                            <DropdownMenu.Sub>
                                                <DropdownMenu.SubTrigger className={getNewTaskMenuSubTriggerClasses()}>
                                                    <Icon name="folder" size={16} strokeWidth={1}
                                                          className="mr-2 flex-shrink-0 opacity-80"/>
                                                    Add to List
                                                    <span
                                                        className="ml-auto mr-1 text-grey-medium dark:text-neutral-400 text-xs truncate max-w-[70px] text-right">{newTaskListState}</span>
                                                    <Icon name="chevron-right" size={16} strokeWidth={1}
                                                          className="opacity-70 flex-shrink-0"/>
                                                </DropdownMenu.SubTrigger>
                                                <DropdownMenu.Portal>
                                                    <DropdownMenu.SubContent
                                                        className={twMerge(moreOptionsDropdownContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                                                        sideOffset={2} alignOffset={-5}
                                                    >
                                                        <DropdownMenu.RadioGroup value={newTaskListState}
                                                                                 onValueChange={(list) => {
                                                                                     setNewTaskListState(list);
                                                                                     setIsNewTaskMoreOptionsOpen(false);
                                                                                     newTaskTitleInputRef.current?.focus();
                                                                                 }}>
                                                            {availableListsForNewTask.map(list => (
                                                                <DropdownMenu.RadioItem key={list} value={list}
                                                                                        className={getNewTaskMenuRadioItemListClasses()}>
                                                                    <Icon
                                                                        name={list === 'Inbox' ? 'inbox' : 'list' as IconName}
                                                                        size={16} strokeWidth={1}
                                                                        className="mr-2 flex-shrink-0 opacity-80"/>
                                                                    {list}
                                                                    <DropdownMenu.ItemIndicator
                                                                        className="absolute right-2 inline-flex items-center">
                                                                        <Icon name="check" size={14} strokeWidth={2}/>
                                                                    </DropdownMenu.ItemIndicator>
                                                                </DropdownMenu.RadioItem>
                                                            ))}
                                                        </DropdownMenu.RadioGroup>
                                                    </DropdownMenu.SubContent>
                                                </DropdownMenu.Portal>
                                            </DropdownMenu.Sub>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                            </div>
                        </div>
                    </div>
                )}

                <Popover.Root open={isBulkRescheduleOpen} onOpenChange={setIsBulkRescheduleOpen}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd} measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto styled-scrollbar relative">
                            {isEmpty ? (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-6 text-center pt-10">
                                    <Icon
                                        name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : (isSearching ? 'search' : 'archive'))}
                                        size={32} strokeWidth={1}
                                        className="mb-3 text-grey-light dark:text-neutral-500 opacity-80"/>
                                    <p className="text-[13px] font-normal text-grey-dark dark:text-neutral-300">{emptyStateTitle}</p>
                                    {showNewTaskInputArea && (
                                        <p className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">Use
                                            the input bar
                                            above to add a new task.</p>)}
                                </div>
                            ) : (<div className="pb-16"><SortableContext items={sortableItems}
                                                                         strategy={verticalListSortingStrategy}>
                                {isGroupedView ? (<> {groupOrder.map(groupKey => {
                                        const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                        if (groupTasks && groupTasks.length > 0) {
                                            return (<div key={groupKey} className="mb-4 last:mb-0"><TaskGroupHeader
                                                title={groupTitles[groupKey]}
                                                groupKey={groupKey}/> {renderTaskGroup(groupTasks, groupKey)} </div>);
                                        }
                                        return null;
                                    })} </>
                                ) : (<div
                                    className="pt-0.5"> {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')} </div>)}
                            </SortableContext></div>)}
                        </div>
                        <DragOverlay dropAnimation={null}>
                            {draggingTask ? (
                                <div className="shadow-lg rounded-base bg-white dark:bg-neutral-700"><TaskItem
                                    task={draggingTask}
                                    isOverlay={true}
                                    scrollContainerRef={scrollContainerRef}/>
                                </div>) : null}
                        </DragOverlay>
                    </DndContext>
                    <Popover.Portal>
                        <Popover.Content sideOffset={5} align="end" className={datePickerPopoverWrapperClasses}
                                         onOpenAutoFocus={(e) => e.preventDefault()}
                                         onCloseAutoFocus={(e) => e.preventDefault()}>
                            <CustomDatePickerContent initialDate={undefined} onSelect={handleBulkRescheduleDateSelect}
                                                     closePopover={closeBulkReschedulePopover}/>
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>
        </TaskItemMenuProvider>
    );
};
TaskList.displayName = 'TaskList';
export default TaskList;