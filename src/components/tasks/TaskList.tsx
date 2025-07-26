// src/components/tasks/TaskList.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import TaskItem from './TaskItem';
import {useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    defaultPreferencesSettingsForApi,
    groupedAllTasksAtom,
    preferencesSettingsAtom,
    preferencesSettingsLoadingAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom,
    tasksLoadingAtom,
    userListsAtom,
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
import {analyzeTaskInputWithAI} from '@/services/aiService';

const priorityMap: Record<number, {
    label: string;
    iconColor: string;
    bgColor: string;
    shortLabel: string;
    borderColor?: string;
    dotColor?: string;
    darkBorderColor?: string;
}> = {
    1: {
        label: 'High Priority',
        iconColor: 'text-error',
        bgColor: 'bg-error',
        shortLabel: 'P1',
        borderColor: 'border-error',
        darkBorderColor: 'dark:border-error/70',
        dotColor: 'bg-error'
    },
    2: {
        label: 'Medium Priority',
        iconColor: 'text-warning',
        bgColor: 'bg-warning',
        shortLabel: 'P2',
        borderColor: 'border-warning',
        darkBorderColor: 'dark:border-warning/70',
        dotColor: 'bg-warning'
    },
    3: {
        label: 'Low Priority',
        iconColor: 'text-info',
        bgColor: 'bg-info',
        shortLabel: 'P3',
        borderColor: 'border-info',
        darkBorderColor: 'dark:border-info/70',
        dotColor: 'bg-info'
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
            "text-[12px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px]",
            "sticky top-0 z-10 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm"
        )}
    >
        <span>{title}</span>
        {groupKey === 'overdue' && (
            <Popover.Anchor asChild>
                <Popover.Trigger asChild>
                    <Button
                        variant="link" size="sm" icon="calendar-check"
                        className="text-[11px] !h-5 px-1 text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary -mr-1"
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
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 dark:data-[state=open]:bg-neutral-700",
    "text-grey-dark dark:text-neutral-200 data-[highlighted]:text-grey-dark dark:data-[highlighted]:text-neutral-100 data-[state=open]:text-grey-dark dark:data-[state=open]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

const getNewTaskMenuRadioItemListClasses = () => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
    "data-[state=checked]:bg-primary-light data-[state=checked]:text-primary dark:data-[state=checked]:bg-primary-dark/30 dark:data-[state=checked]:text-primary-light",
    "text-grey-dark dark:text-neutral-200 data-[highlighted]:text-grey-dark dark:data-[highlighted]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

const getAiGlowThemeClass = (priority: number | null): string => {
    if (priority === 1) return 'ai-glow-theme-red';
    if (priority === 2) return 'ai-glow-theme-yellow';
    if (priority === 3) return 'ai-glow-theme-blue';
    return 'ai-glow-theme-neutral';
};


const TaskList: React.FC<TaskListProps> = ({title: pageTitle}) => {
    const allTasksData = useAtomValue(tasksAtom);
    const allTasks = useMemo(() => allTasksData ?? [], [allTasksData]);
    const isLoadingTasks = useAtomValue(tasksLoadingAtom);
    const setTasks = useSetAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const rawSearchResults = useAtomValue(rawSearchResultsAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const allUserLists = useAtomValue(userListsAtom); // Get full list objects
    const preferencesData = useAtomValue(preferencesSettingsAtom);
    const isLoadingPreferences = useAtomValue(preferencesSettingsLoadingAtom);
    const preferences = useMemo(() => preferencesData ?? defaultPreferencesSettingsForApi(), [preferencesData]);


    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [isBulkRescheduleOpen, setIsBulkRescheduleOpen] = useState(false);

    const newTaskTitleInputRef = useRef<HTMLInputElement>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
    const [newTaskPriority, setNewTaskPriority] = useState<number | null>(null);
    const [newTaskListState, setNewTaskListState] = useState<string>('Inbox');

    const [isNewTaskDatePickerOpen, setIsNewTaskDatePickerOpen] = useState(false);
    const [isNewTaskMoreOptionsOpen, setIsNewTaskMoreOptionsOpen] = useState(false);

    const [isAiTaskInputVisible, setIsAiTaskInputVisible] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);


    const availableListsForNewTask = useMemo(() => allUserLists?.map(l => l.name).filter(n => n !== 'Trash') ?? [], [allUserLists]);

    useEffect(() => {
        if (isLoadingPreferences) return;
        let defaultDate: Date | null = null;
        if (preferences.defaultNewTaskDueDate === 'today') {
            defaultDate = startOfDay(new Date());
        } else if (preferences.defaultNewTaskDueDate === 'tomorrow') {
            defaultDate = startOfDay(addDays(new Date(), 1));
        }
        setNewTaskDueDate(defaultDate);
        setNewTaskPriority(preferences.defaultNewTaskPriority);

        const defaultList = preferences.defaultNewTaskList;
        if (availableListsForNewTask.includes(defaultList)) {
            setNewTaskListState(defaultList);
        } else if (availableListsForNewTask.length > 0) {
            setNewTaskListState(availableListsForNewTask[0]);
        } else {
            setNewTaskListState('Inbox');
        }

    }, [preferences, availableListsForNewTask, isLoadingPreferences]);

    const {tasksToDisplay, isGroupedView, isSearching} = useMemo(() => {
        const searching = searchTerm.trim().length > 0;
        if (searching) {
            return {tasksToDisplay: rawSearchResults, isGroupedView: false, isSearching: true};
        }
        if (currentFilterGlobal === 'all') {
            return {tasksToDisplay: groupedTasks, isGroupedView: true, isSearching: false};
        }

        const activeTasks = allTasks.filter(task => task.listName !== 'Trash');
        const trashedTasks = allTasks.filter(task => task.listName === 'Trash');
        let filtered: Task[] = [];

        switch (currentFilterGlobal) {
            case 'today':
                filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isToday(task.dueDate));
                break;
            case 'next7days':
                filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isWithinNext7Days(task.dueDate));
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
                    filtered = activeTasks.filter(task => !task.completed && task.listName === listName);
                } else if (currentFilterGlobal.startsWith('tag-')) {
                    const tagName = currentFilterGlobal.substring(4);
                    filtered = activeTasks.filter(task => !task.completed && task.tags?.includes(tagName));
                }
                break;
        }
        if (currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash') {
            filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
        return {tasksToDisplay: filtered, isGroupedView: false, isSearching: false};
    }, [searchTerm, currentFilterGlobal, groupedTasks, rawSearchResults, allTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (isGroupedView) {
            return groupOrder.flatMap(groupKey =>
                ((tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey] ?? []).map(task => task.id)
            );
        } else {
            return ((tasksToDisplay as Task[]) ?? []).map(task => task.id);
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

        if (activeTask && !activeTask.completed && activeTask.listName !== 'Trash') {
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

        setTasks((currentTasksValue) => {
            const currentTasks = currentTasksValue ?? [];
            const oldIndex = currentTasks.findIndex(t => t.id === activeId);
            const newIndex = currentTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) {
                return currentTasks;
            }

            const currentVisualOrderIds = sortableItems as string[];
            const activeVisualIndex = currentVisualOrderIds.indexOf(activeId);
            const overVisualIndex = currentVisualOrderIds.indexOf(overId);

            if (activeVisualIndex === -1 || overVisualIndex === -1) {
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
                } else {
                    newOrderValue = mid;
                }
            }
            if (!Number.isFinite(newOrderValue)) {
                newOrderValue = Date.now();
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
                if (newDueDateValue !== null && originalTask.dueDate) {
                    const originalDateObj = safeParseDate(originalTask.dueDate);
                    if (originalDateObj && isValid(originalDateObj)) {
                        const hours = originalDateObj.getHours();
                        const minutes = originalDateObj.getMinutes();
                        if (hours !== 0 || minutes !== 0) {
                            const newDateWithTime = new Date(newDueDateValue);
                            newDateWithTime.setHours(hours, minutes, 0, 0);
                            newDueDateValue = newDateWithTime.getTime();
                        }
                    }
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
                    const updates: Partial<Task> = {order: newOrderValue,};
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

        const targetList = allUserLists?.find(l => l.name === newTaskListState);
        const inboxList = allUserLists?.find(l => l.name === 'Inbox');
        const listIdForNewTask = targetList?.id ?? inboxList?.id ?? null;
        if (!listIdForNewTask) {
            console.error("Could not determine a list ID for the new task.");
            alert("Error: Could not find a valid list for the new task.");
            return;
        }

        const now = Date.now();
        const topTask = (allTasks ?? [])
            .filter(t => !t.completed && t.listName !== 'Trash')
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

        const newOrder = topTask?.order ? topTask.order - 1000 : Date.now();

        const taskToAdd: Task = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: titleToSave,
            completed: false,
            completedAt: null,
            listName: newTaskListState,
            listId: listIdForNewTask,
            completePercentage: null,
            dueDate: newTaskDueDate ? newTaskDueDate.getTime() : null,
            priority: newTaskPriority,
            order: newOrder,
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: [],
            groupCategory: 'nodate', // Will be re-calculated by atom
            subtasks: []
        };

        setTasks(prev => [(taskToAdd), ...(prev ?? [])]);

        setNewTaskTitle('');
        let defaultDate: Date | null = null;
        if (preferences.defaultNewTaskDueDate === 'today') {
            defaultDate = startOfDay(new Date());
        } else if (preferences.defaultNewTaskDueDate === 'tomorrow') {
            defaultDate = startOfDay(addDays(new Date(), 1));
        }
        setNewTaskDueDate(defaultDate);
        setNewTaskPriority(preferences.defaultNewTaskPriority);
        if (availableListsForNewTask.includes(preferences.defaultNewTaskList)) {
            setNewTaskListState(preferences.defaultNewTaskList);
        } else if (availableListsForNewTask.length > 0) {
            setNewTaskListState(availableListsForNewTask[0]);
        } else {
            setNewTaskListState('Inbox');
        }
        newTaskTitleInputRef.current?.focus();
    }, [
        newTaskTitle, newTaskDueDate, newTaskPriority, newTaskListState,
        setTasks, allTasks, preferences, availableListsForNewTask, allUserLists
    ]);

    const isRegularNewTaskModeAllowed = useMemo(() =>
            !['completed', 'trash'].includes(currentFilterGlobal) && !isSearching,
        [currentFilterGlobal, isSearching]
    );

    const toggleAiTaskInput = useCallback(() => {
        if (isAiProcessing) return;
        const nextState = !isAiTaskInputVisible;
        setIsAiTaskInputVisible(nextState);
        if (nextState) {
            setNewTaskTitle('');
            let defaultDate: Date | null = null;
            if (preferences.defaultNewTaskDueDate === 'today') {
                defaultDate = startOfDay(new Date());
            } else if (preferences.defaultNewTaskDueDate === 'tomorrow') {
                defaultDate = startOfDay(addDays(new Date(), 1));
            }
            setNewTaskDueDate(defaultDate);
            setNewTaskPriority(preferences.defaultNewTaskPriority);

            const userListNames = allUserLists?.map(l => l.name) ?? [];
            if (currentFilterGlobal.startsWith('list-')) {
                const listName = currentFilterGlobal.substring(5);
                if (userListNames.includes(listName) && listName !== 'Trash') {
                    setNewTaskListState(listName);
                } else {
                    setNewTaskListState(preferences.defaultNewTaskList);
                }
            } else {
                setNewTaskListState(preferences.defaultNewTaskList);
            }
            setTimeout(() => newTaskTitleInputRef.current?.focus(), 0);
        }
    }, [isAiTaskInputVisible, isAiProcessing, currentFilterGlobal, allUserLists, preferences]);


    const handleAiTaskCommit = useCallback(async () => {
        const sentence = newTaskTitle.trim();
        if (!sentence || isAiProcessing) return;

        setIsAiProcessing(true);

        try {
            const aiAnalysis = await analyzeTaskInputWithAI(sentence);

            const targetList = allUserLists?.find(l => l.name === newTaskListState);
            const inboxList = allUserLists?.find(l => l.name === 'Inbox');
            const listIdForNewTask = targetList?.id ?? inboxList?.id ?? null;
            if (!listIdForNewTask) {
                throw new Error("Could not find a valid list for the new AI task.");
            }

            const now = Date.now();
            const topTask = (allTasks ?? []).filter(t => !t.completed && t.listName !== 'Trash').sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
            const newOrder = topTask?.order ? topTask.order - 1000 : Date.now();
            const taskId = `task-${now}-${Math.random().toString(16).slice(2)}`;

            const taskToAdd: Task = {
                id: taskId,
                title: aiAnalysis.title || sentence,
                completed: false,
                completedAt: null,
                listName: newTaskListState,
                listId: listIdForNewTask,
                completePercentage: null,
                dueDate: aiAnalysis.dueDate ? new Date(aiAnalysis.dueDate).getTime() : (newTaskDueDate ? newTaskDueDate.getTime() : null),
                priority: aiAnalysis.priority,
                order: newOrder,
                createdAt: now,
                updatedAt: now,
                content: aiAnalysis.content,
                tags: aiAnalysis.tags,
                subtasks: aiAnalysis.subtasks.map((sub, index) => ({
                    id: `subtask-${taskId}-${index}-${Math.random().toString(16).slice(2)}`,
                    parentId: taskId,
                    title: sub.title,
                    completed: false,
                    completedAt: null,
                    dueDate: sub.dueDate ? (safeParseDate(sub.dueDate)?.getTime() ?? null) : null,
                    order: index * 1000,
                    createdAt: now,
                    updatedAt: now,
                })),
                groupCategory: 'nodate'
            };

            setTasks(prev => [taskToAdd, ...(prev ?? [])]);
            setNewTaskTitle('');
            let defaultDate: Date | null = null;
            if (preferences.defaultNewTaskDueDate === 'today') defaultDate = startOfDay(new Date());
            else if (preferences.defaultNewTaskDueDate === 'tomorrow') defaultDate = startOfDay(addDays(new Date(), 1));
            setNewTaskDueDate(defaultDate);
            setNewTaskPriority(preferences.defaultNewTaskPriority);
            setNewTaskListState(preferences.defaultNewTaskList);

        } catch (error) {
            alert(`AI Task creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsAiProcessing(false);
            setIsAiTaskInputVisible(false);
            if (isRegularNewTaskModeAllowed) {
                setTimeout(() => newTaskTitleInputRef.current?.focus(), 0);
            }
        }
    }, [
        newTaskTitle, newTaskDueDate, newTaskPriority, newTaskListState,
        setTasks, allTasks, isAiProcessing, isRegularNewTaskModeAllowed, preferences, allUserLists
    ]);


    const handleBulkRescheduleDateSelect = useCallback((date: Date | undefined) => {
        if (!date || !isValid(date)) {
            setIsBulkRescheduleOpen(false);
            return;
        }
        const newDueDateTimestamp = date.getTime();

        setTasks(currentTasksValue => {
            const currentTasks = currentTasksValue ?? [];
            return currentTasks.map((task: Task) => {
                const isTaskOverdue = !task.completed &&
                    task.listName !== 'Trash' &&
                    task.dueDate != null &&
                    isValid(task.dueDate) &&
                    isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date()));

                if (isTaskOverdue) {
                    return {...task, dueDate: newDueDateTimestamp};
                }
                return task;
            })
        });
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
        if (isLoadingTasks) return false;
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every((group: Task[]) => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView, isLoadingTasks]);

    const emptyStateTitle = useMemo(() => {
        if (isSearching) return `No results for "${searchTerm}"`;
        if (currentFilterGlobal === 'trash') return 'Trash is empty';
        if (currentFilterGlobal === 'completed') return 'No completed tasks yet';
        if (currentFilterGlobal.startsWith('list-')) {
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

    const shouldShowInputSection = useMemo(() =>
            isRegularNewTaskModeAllowed || isAiTaskInputVisible,
        [isRegularNewTaskModeAllowed, isAiTaskInputVisible]
    );
    const isCurrentlyAiMode = isAiTaskInputVisible;

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    const moreOptionsDropdownContentClasses = useMemo(() => twMerge(
        "z-[60] min-w-[180px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide"
    ), []);

    const newTaskInputWrapperClass = useMemo(() => {
        const baseWrapperClasses = "group relative flex items-center w-full h-[32px] rounded-base transition-all duration-150 ease-in-out border";

        if (isCurrentlyAiMode) {
            if (isAiProcessing) {
                return twMerge(
                    baseWrapperClasses,
                    "bg-grey-ultra-light dark:bg-neutral-700/60",
                    "opacity-70",
                    "border-grey-light dark:border-neutral-600"
                );
            }
            return twMerge(
                baseWrapperClasses,
                "ai-glow-anim-border animate-border-flow",
                getAiGlowThemeClass(newTaskPriority),
                "border-transparent"
            );
        } else {
            const prioritySpecificBorder = newTaskPriority && priorityMap[newTaskPriority]?.borderColor;
            const darkPrioritySpecificBorder = newTaskPriority && priorityMap[newTaskPriority]?.darkBorderColor;

            return twMerge(
                baseWrapperClasses,
                "bg-grey-ultra-light dark:bg-neutral-700/60",
                prioritySpecificBorder
                    ? `${prioritySpecificBorder} ${darkPrioritySpecificBorder || 'dark:border-transparent'}`
                    : "border-grey-light dark:border-neutral-600"
            );
        }
    }, [newTaskPriority, isCurrentlyAiMode, isAiProcessing]);

    const newTaskInputClass = useMemo(() => {
        const baseClasses = "flex-1 min-w-0 h-full pl-2 pr-8 text-[13px] font-light outline-none border-none text-grey-dark dark:text-neutral-100 placeholder:text-grey-medium dark:placeholder:text-neutral-400/70";

        if (isCurrentlyAiMode) {
            if (isAiProcessing) {
                return twMerge(baseClasses, "bg-grey-ultra-light dark:bg-neutral-700/60 rounded-4px");
            }
            return twMerge(baseClasses, "bg-white dark:bg-neutral-800 rounded-4px");
        }
        return twMerge(baseClasses, "bg-transparent");
    }, [isCurrentlyAiMode, isAiProcessing]);

    const handlePriorityFlagClick = (priorityValue: number | null) => {
        setNewTaskPriority(currentPriority => currentPriority === priorityValue ? null : priorityValue);
        setIsNewTaskMoreOptionsOpen(false);
        newTaskTitleInputRef.current?.focus();
    };

    const placeholderText = useMemo(() => {
        if (isCurrentlyAiMode) {
            return preferences.language === 'zh-CN'
                ? `用AI描述任务 (例如, "下个月策划一次团建活动")`
                : `Describe task for AI (e.g., "Plan a team building event next month")`;
        }
        return preferences.language === 'zh-CN'
            ? `添加任务到 "${newTaskListState}"`
            : `Add task to "${newTaskListState}"`;
    }, [isCurrentlyAiMode, newTaskListState, preferences.language]);

    if (isLoadingTasks || isLoadingPreferences) {
        return (
            <div className="h-full flex items-center justify-center bg-white dark:bg-neutral-800">
                <Icon name="loader" size={24} className="text-primary animate-spin"/>
            </div>
        );
    }


    return (
        <TaskItemMenuProvider>
            <div className="h-full flex flex-col bg-white dark:bg-neutral-800 overflow-hidden relative">
                <div className={headerClass}>
                    <h1 className="text-[18px] font-light text-grey-dark dark:text-neutral-100 truncate pr-2"
                        title={pageTitle}>{pageTitle}</h1>
                    <div className={twMerge(
                        "relative flex-shrink-0 ml-2 rounded-base",
                        isCurrentlyAiMode && !isAiProcessing && "ai-glow-anim-border animate-border-flow",
                        isCurrentlyAiMode && !isAiProcessing && getAiGlowThemeClass(newTaskPriority),
                        isAiProcessing && "opacity-50 cursor-not-allowed"
                    )}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleAiTaskInput}
                            className={twMerge(
                                "text-grey-medium dark:text-neutral-400 hover:text-primary dark:hover:text-primary-light focus-visible:text-primary dark:focus-visible:text-primary-light",
                                "h-7 w-auto px-2 py-1 flex items-center",
                                (isCurrentlyAiMode && !isAiProcessing) ? "rounded-4px" : "rounded-base",
                                "bg-white dark:bg-neutral-800",
                                "relative z-[1]"
                            )}
                            title={preferences.language === 'zh-CN' ? '使用 AI 添加任务' : "Add task with AI"}
                            aria-expanded={isAiTaskInputVisible}
                            disabled={isAiProcessing}
                        >
                            {isAiProcessing ? (
                                <Icon name="loader" size={14} strokeWidth={1.5} className="mr-1 animate-spin"/>
                            ) : (
                                <Icon name="sparkles" size={14} strokeWidth={1.5} className="mr-1"/>
                            )}
                            <span className="text-[11px] font-medium">
                                {isAiProcessing
                                    ? (preferences.language === 'zh-CN' ? "处理中..." : "Processing...")
                                    : (preferences.language === 'zh-CN' ? "AI 任务" : "AI Task")}
                            </span>
                        </Button>
                    </div>
                </div>

                {shouldShowInputSection && (
                    <div className="bg-white dark:bg-neutral-800">
                        <div className="px-4 py-2.5">
                            <div className={newTaskInputWrapperClass}>
                                <div className="flex items-center h-full flex-shrink-0">
                                    <Popover.Root open={isNewTaskDatePickerOpen}
                                                  onOpenChange={setIsNewTaskDatePickerOpen}>
                                        <Popover.Trigger asChild>
                                            <button
                                                type="button"
                                                className={twMerge(
                                                    "flex items-center justify-center w-6 h-6 rounded-l-base focus:outline-none ml-1",
                                                    newTaskDueDate ? "text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary" : "text-grey-medium hover:text-grey-dark dark:text-neutral-400 dark:hover:text-neutral-200",
                                                    (isCurrentlyAiMode && isAiProcessing) && "opacity-50 cursor-not-allowed"
                                                )}
                                                aria-label="Set due date"
                                                disabled={(isCurrentlyAiMode && isAiProcessing) || isAiProcessing}
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
                                                    if (!((isCurrentlyAiMode && isAiProcessing) || isAiProcessing)) {
                                                        newTaskTitleInputRef.current?.focus();
                                                    }
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
                                        <div
                                            className="flex items-center pl-1 pr-2 h-full pointer-events-none"> {/* Adjusted padding slightly */}
                                            <span
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
                                        if (e.nativeEvent.isComposing) {
                                            return;
                                        }
                                        if (e.key === 'Enter' && newTaskTitle.trim()) {
                                            isCurrentlyAiMode ? handleAiTaskCommit() : commitNewTask();
                                        }
                                        if (e.key === 'Escape') {
                                            if (isCurrentlyAiMode) {
                                                setIsAiTaskInputVisible(false);
                                            } else {
                                                setNewTaskTitle('');
                                            }
                                        }
                                    }}
                                    placeholder={placeholderText}
                                    className={newTaskInputClass}
                                    disabled={(isCurrentlyAiMode && isAiProcessing) || isAiProcessing}
                                />

                                <div
                                    className={twMerge(
                                        "absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center transition-opacity duration-150",
                                        "opacity-0 group-focus-within:opacity-100 pointer-events-none group-focus-within:pointer-events-auto",
                                        isNewTaskMoreOptionsOpen && "!opacity-100 !pointer-events-auto",
                                        ((isCurrentlyAiMode && isAiProcessing) || isAiProcessing) && "!opacity-50 !pointer-events-none"
                                    )}
                                >
                                    <DropdownMenu.Root open={isNewTaskMoreOptionsOpen}
                                                       onOpenChange={setIsNewTaskMoreOptionsOpen}>
                                        <DropdownMenu.Trigger asChild>
                                            <button
                                                type="button"
                                                className="flex items-center justify-center w-7 h-7 rounded-r-base text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-primary"
                                                aria-label="More task options"
                                                disabled={(isCurrentlyAiMode && isAiProcessing) || isAiProcessing}
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
                                                    if (!((isCurrentlyAiMode && isAiProcessing) || isAiProcessing)) {
                                                        newTaskTitleInputRef.current?.focus();
                                                    }
                                                }}
                                            >
                                                <div
                                                    className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">Priority
                                                </div>
                                                <div className="flex justify-around items-center px-1.5 py-1">
                                                    {[1, 2, 3].map(pVal => {
                                                        const pData = priorityMap[pVal];
                                                        const isSelected = newTaskPriority === pVal;
                                                        return (
                                                            <button
                                                                key={pVal}
                                                                onClick={() => handlePriorityFlagClick(pVal)}
                                                                className={twMerge(
                                                                    "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                                    pData.iconColor,
                                                                    isSelected ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                                        : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                                                )}
                                                                title={pData.label}
                                                                aria-pressed={isSelected}
                                                            >
                                                                <Icon name="flag" size={14} strokeWidth={1.5}/>
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        onClick={() => handlePriorityFlagClick(null)}
                                                        className={twMerge(
                                                            "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                            newTaskPriority === null
                                                                ? "text-grey-dark dark:text-neutral-200"
                                                                : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-300 focus-visible:text-grey-dark dark:focus-visible:text-neutral-300",

                                                            newTaskPriority === null ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                                : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                                        )}
                                                        title="No Priority"
                                                        aria-pressed={newTaskPriority === null}
                                                    >
                                                        <Icon name="minus" size={14} strokeWidth={1.5}/>
                                                    </button>
                                                </div>

                                                <DropdownMenu.Separator
                                                    className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                                <DropdownMenu.Sub>
                                                    <DropdownMenu.SubTrigger
                                                        className={getNewTaskMenuSubTriggerClasses()}>
                                                        <div className="flex items-center flex-1 min-w-0">
                                                            <Icon name="folder" size={14} strokeWidth={1}
                                                                  className="mr-2 flex-shrink-0 opacity-80"/>
                                                            <span className="truncate">Add to List</span>
                                                        </div>
                                                        <span
                                                            className="ml-2 mr-1 text-grey-medium dark:text-neutral-400 text-[11px] truncate max-w-[60px] text-right">{newTaskListState}</span>
                                                        <Icon name="chevron-right" size={14} strokeWidth={1}
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
                                                                            size={14} strokeWidth={1}
                                                                            className="mr-2 flex-shrink-0 opacity-80"/>
                                                                        {list}
                                                                        <DropdownMenu.ItemIndicator
                                                                            className="absolute right-2 inline-flex items-center">
                                                                            <Icon name="check" size={12}
                                                                                  strokeWidth={2}/>
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
                        <div className="h-px bg-grey-ultra-light dark:bg-neutral-700/50 mx-4"></div>
                    </div>
                )}

                <Popover.Root open={isBulkRescheduleOpen} onOpenChange={setIsBulkRescheduleOpen}>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd} measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                        <div ref={scrollContainerRef}
                             className="flex-1 overflow-y-auto styled-scrollbar relative p-2 bg-white dark:bg-neutral-800">
                            {isEmpty ? (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-6 text-center pt-10">
                                    <Icon
                                        name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : (isSearching ? 'search' : 'archive'))}
                                        size={32} strokeWidth={1}
                                        className="mb-3 text-grey-light dark:text-neutral-500 opacity-80"/>
                                    <p className="text-[13px] font-normal text-grey-dark dark:text-neutral-300">{emptyStateTitle}</p>
                                    {(isRegularNewTaskModeAllowed && !isCurrentlyAiMode) && (
                                        <p className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">Use
                                            the input bar
                                            above to add a new task.</p>)}
                                </div>
                            ) : (
                                <div className="pb-16">
                                    <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                                        {isGroupedView ? (<>
                                            {groupOrder.map(groupKey => {
                                                const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                                if (groupTasks && groupTasks.length > 0) {
                                                    return (
                                                        <div key={groupKey} className="mb-4 last:mb-0">
                                                            <TaskGroupHeader title={groupTitles[groupKey]}
                                                                             groupKey={groupKey}/>
                                                            {renderTaskGroup(groupTasks, groupKey)}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </>) : (
                                            <div className="pt-0.5">
                                                {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')}
                                            </div>
                                        )}
                                    </SortableContext>
                                </div>
                            )}
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