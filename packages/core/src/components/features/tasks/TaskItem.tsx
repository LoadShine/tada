import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Task, TaskGroupCategory} from '@/types';
import {formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate} from '@/utils/dateUtils';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    defaultPreferencesSettingsForApi,
    preferencesSettingsAtom,
    preferencesSettingsLoadingAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom,
    userListsAtom
} from '@/store/jotai.ts';
import Icon from '@/components/ui/Icon.tsx';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Button from "@/components/ui/Button.tsx";
import Highlighter from "react-highlight-words";
import {IconName} from "@/components/ui/IconMap.ts";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import {useTaskItemMenu} from '@/context/TaskItemMenuContext';
import * as Tooltip from '@radix-ui/react-tooltip';
import {useTranslation} from "react-i18next";
import CustomDatePickerContent from "@/components/ui/DatePicker.tsx";
import AddTagsPopoverContent from "@/components/ui/TagInput.tsx";
import ConfirmDeleteModalRadix from "@/components/ui/ConfirmDeleteModal.tsx";

export const ProgressIndicator: React.FC<{
    percentage: number | null; isTrash: boolean; size?: number; className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string;
}> = React.memo(({percentage, isTrash, size = 16, className, onClick, onKeyDown, ariaLabelledby}) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1.5;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 1.5;
    const offset = circumference - (normalizedPercentage / 100) * circumference;
    const checkPath = `M ${size * 0.3} ${size * 0.5} L ${size * 0.45} ${size * 0.65} L ${size * 0.75} ${size * 0.35}`;

    const indicatorClasses = useMemo(() => twMerge(
        "relative flex-shrink-0 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        !isTrash && "cursor-pointer",
        isTrash && "opacity-50 cursor-not-allowed",
        className
    ), [isTrash, className]);

    const stateStyles = useMemo(() => {
        if (isTrash) return "border-grey-light dark:border-neutral-600";
        if (normalizedPercentage === 100) return "bg-primary border-primary";
        return "border-grey-light dark:border-neutral-600 hover:border-primary-dark dark:hover:border-primary";
    }, [isTrash, normalizedPercentage]);

    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-grey-medium dark:stroke-neutral-500";
        if (normalizedPercentage === 100) return "stroke-white";
        return "stroke-primary dark:stroke-primary-light";
    }, [isTrash, normalizedPercentage]);

    const progressLabel = normalizedPercentage === 100 ? "Completed" : (normalizedPercentage > 0 ? `${normalizedPercentage}% done` : "Not started");

    return (
        <button type="button" onClick={onClick} onKeyDown={onKeyDown} disabled={isTrash}
                aria-labelledby={ariaLabelledby} aria-label={`Task progress: ${progressLabel}`}
                aria-pressed={normalizedPercentage === 100}
                className={twMerge(indicatorClasses, stateStyles, "border")}
                style={{width: size, height: size}}>
            <svg viewBox={`0 0 ${size} ${size}`}
                 className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-in-out"
                 style={{opacity: (normalizedPercentage > 0 && normalizedPercentage < 100) || normalizedPercentage === 100 ? 1 : 0}}
                 aria-hidden="true">
                {normalizedPercentage > 0 && normalizedPercentage < 100 && (
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
                            className={progressStrokeColor} strokeDasharray={circumference} strokeDashoffset={offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="round"
                            style={{transition: 'stroke-dashoffset 0.3s ease-out'}}/>
                )}
                {normalizedPercentage === 100 && (
                    <path d={checkPath} fill="none" strokeWidth={strokeWidth + 0.5}
                          className={progressStrokeColor}
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{transition: 'opacity 0.2s ease-in 0.1s'}}/>
                )}
            </svg>
        </button>
    );
});
ProgressIndicator.displayName = 'ProgressIndicator';

function generateContentSnippet(content: string, term: string, length: number = 35): string {
    if (!content || !term) return '';
    const lowerContent = content.toLowerCase();
    const searchWords = term.toLowerCase().split(' ').filter(Boolean);
    let firstMatchIndex = -1;
    let matchedWord = '';
    for (const word of searchWords) {
        const index = lowerContent.indexOf(word);
        if (index !== -1) {
            firstMatchIndex = index;
            matchedWord = word;
            break;
        }
    }
    if (firstMatchIndex === -1) return content.substring(0, length) + (content.length > length ? '...' : '');
    const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
    const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
}

const getTaskItemMenuItemStyle = (selected?: boolean, isDanger?: boolean) => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    isDanger
        ? "text-error data-[highlighted]:bg-error/10 data-[highlighted]:text-error dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300"
        : selected
            ? "bg-primary-light text-primary data-[highlighted]:bg-primary-light/90 dark:bg-primary-dark/30 dark:text-primary-light dark:data-[highlighted]:bg-primary-dark/40"
            : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
    !isDanger && !selected && "data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-700",
    "data-[disabled]:opacity-50"
);

const getTaskItemMenuRadioItemStyle = (checked?: boolean) => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
    checked
        ? "bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light"
        : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

const getTaskItemMenuSubTriggerStyle = () => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 dark:data-[state=open]:bg-neutral-700",
    "text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark",
    "dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
    "data-[disabled]:opacity-50"
);


interface TaskItemRadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const TaskItemRadixMenuItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenu.Item>,
    TaskItemRadixMenuItemProps
>(({icon, iconColor, selected, children, className, isDanger = false, ...props}, ref) => (
    <DropdownMenu.Item
        ref={ref}
        className={twMerge(getTaskItemMenuItemStyle(selected, isDanger), className)}
        {...props}
    >
        {icon && (
            <Icon name={icon} size={14} strokeWidth={1.5}
                  className={twMerge("mr-2 flex-shrink-0 opacity-80", iconColor)}
                  aria-hidden="true"/>)}
        <span className="flex-grow">{children}</span>
    </DropdownMenu.Item>
));
TaskItemRadixMenuItem.displayName = 'TaskItemRadixMenuItem';


interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

const TaskItem: React.FC<TaskItemProps> = memo(({
                                                    task,
                                                    groupCategory,
                                                    isOverlay = false,
                                                    style: overlayStyle
                                                }) => {
    const {t} = useTranslation();
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const allUserLists = useAtomValue(userListsAtom);

    const preferencesData = useAtomValue(preferencesSettingsAtom);
    const isLoadingPreferences = useAtomValue(preferencesSettingsLoadingAtom);
    const preferences = useMemo(() => preferencesData ?? defaultPreferencesSettingsForApi(), [preferencesData]);

    const {openItemId, setOpenItemId} = useTaskItemMenu();

    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);
    const [isDatePickerPopoverOpen, setIsDatePickerPopoverOpen] = useState(false);
    const [isDateClickPickerOpen, setIsDateClickPickerOpen] = useState(false);
    const [isTagsPopoverOpen, setIsTagsPopoverOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
    const dateDisplayRef = useRef<HTMLButtonElement>(null);
    const taskItemRef = useRef<HTMLDivElement>(null);

    const isTrashItem = useMemo(() => task.listName === 'Trash', [task.listName]);
    const isCompleted = useMemo(() => task.completed && !isTrashItem, [task.completed, isTrashItem]);
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);
    const isInteractive = useMemo(() => !isOverlay && !isCompleted && !isTrashItem, [isOverlay, isCompleted, isTrashItem]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition: dndTransition,
        isDragging
    } = useSortable({
        id: task.id,
        disabled: !isSortable,
        data: {task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory}
    });

    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition || 'background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, opacity 0.2s ease-in-out';
        if (isDragging && !isOverlay) return {
            transform: baseTransform,
            transition: calculatedTransition,
            opacity: 0.7,
            cursor: 'grabbing',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 10,
        };
        if (isOverlay) return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            cursor: 'grabbing',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 1000,
        };
        return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            zIndex: isSelected ? 2 : 1,
        };
    }, [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);

    useEffect(() => {
        if (openItemId !== task.id) {
            setIsMoreActionsOpen(false);
            setIsDatePickerPopoverOpen(false);
            setIsDateClickPickerOpen(false);
            setIsTagsPopoverOpen(false);
        }
    }, [openItemId, task.id]);

    useEffect(() => {
        if (!isMoreActionsOpen && !isDatePickerPopoverOpen && !isDateClickPickerOpen && !isTagsPopoverOpen && openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [isMoreActionsOpen, isDatePickerPopoverOpen, isDateClickPickerOpen, isTagsPopoverOpen, openItemId, task.id, setOpenItemId]);


    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, [data-radix-popper-content-wrapper], [role="dialog"], [role="menuitem"], [data-date-picker-trigger="true"], [data-tooltip-trigger]')) return;
        if (isDragging) return;
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, isDragging, setOpenItemId]);

    const updateTask = useCallback((updates: Partial<Task>) => {
        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            return prevTasks.map(t => (t.id === task.id ? {...t, ...updates} : t))
        });
    }, [setTasks, task.id]);

    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const nextCompleted = !task.completed;
        updateTask({
            completed: nextCompleted,
            completePercentage: nextCompleted ? 100 : null
        });
        if (nextCompleted && isSelected) {
            setSelectedTaskId(null);
        }
        setOpenItemId(null);
    }, [task.completed, isSelected, updateTask, setSelectedTaskId, setOpenItemId]);


    const handleProgressIndicatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycleCompletionPercentage();
        }
    }, [cycleCompletionPercentage]);

    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completePercentage: newPercentage, completed: newPercentage === 100});
        if (newPercentage === 100 && isSelected) setSelectedTaskId(null);
        setIsMoreActionsOpen(false);
        setOpenItemId(null);
    }, [updateTask, isSelected, setSelectedTaskId, setOpenItemId]);

    const handleDateSelect = useCallback((dateWithTime: Date | undefined) => {
        updateTask({dueDate: dateWithTime ? dateWithTime.getTime() : null});
    }, [updateTask]);

    const handleTagsApply = useCallback((newTags: string[]) => {
        updateTask({tags: newTags});
    }, [updateTask]);

    const handleMoreActionsOpenChange = useCallback((open: boolean) => {
        setIsMoreActionsOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsDatePickerPopoverOpen(false);
            setIsTagsPopoverOpen(false);
            setIsDateClickPickerOpen(false);
        } else {
            if (!isDatePickerPopoverOpen && !isTagsPopoverOpen && !isDateClickPickerOpen) {
                setOpenItemId(null);
            }
        }
    }, [task.id, setOpenItemId, isDatePickerPopoverOpen, isTagsPopoverOpen, isDateClickPickerOpen]);


    const handleMenuSubPopoverOpenChange = useCallback((open: boolean, type: 'date' | 'tags') => {
        if (open) {
            setOpenItemId(task.id);
            if (type === 'date') {
                setIsDatePickerPopoverOpen(true);
                setIsTagsPopoverOpen(false);
            } else if (type === 'tags') {
                setIsTagsPopoverOpen(true);
                setIsDatePickerPopoverOpen(false);
            }
            setIsMoreActionsOpen(true);
        } else {
            if (type === 'date') setIsDatePickerPopoverOpen(false);
            if (type === 'tags') setIsTagsPopoverOpen(false);
        }
    }, [task.id, setOpenItemId]);


    const handleDateClickPickerOpenChange = useCallback((open: boolean) => {
        setIsDateClickPickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMoreActionsOpen(false);
            setIsDatePickerPopoverOpen(false);
            setIsTagsPopoverOpen(false);
        }
    }, [task.id, setOpenItemId]);

    const closeMenuDatePickerPopover = useCallback(() => {
        handleMenuSubPopoverOpenChange(false, 'date');
    }, [handleMenuSubPopoverOpenChange]);

    const closeTagsPopover = useCallback(() => {
        handleMenuSubPopoverOpenChange(false, 'tags');
    }, [handleMenuSubPopoverOpenChange]);

    const closeDateClickPopover = useCallback(() => {
        handleDateClickPickerOpenChange(false);
        dateDisplayRef.current?.focus();
    }, [handleDateClickPickerOpenChange]);

    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({priority: newPriority});
        setIsMoreActionsOpen(false);
        setOpenItemId(null);
    }, [updateTask, setOpenItemId]);

    const handleListChange = useCallback((newListName: string) => {
        const listObject = allUserLists?.find(l => l.name === newListName);
        if (listObject) {
            updateTask({listName: newListName, listId: listObject.id});
        }
        setIsMoreActionsOpen(false);
        setOpenItemId(null);
    }, [updateTask, setOpenItemId, allUserLists]);

    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        const newTask: Task = {
            ...task,
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: `${task.title} (Copy)`,
            order: (task.order ?? 0) + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completePercentage: null,
            subtasks: (task.subtasks || []).map(sub => ({
                ...sub,
                id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
                parentId: `task-${now}-${Math.random().toString(16).slice(2)}`,
                completed: false,
                completedAt: null,
            })),
            groupCategory: 'nodate'
        };
        setTasks(prevValue => [...(prevValue ?? []), newTask]);
        setSelectedTaskId(newTask.id);
        setIsMoreActionsOpen(false);
        setOpenItemId(null);
    }, [task, setTasks, setSelectedTaskId, setOpenItemId]);

    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDeleteTask = useCallback(() => {
        updateTask({listName: 'Trash', completed: false, completePercentage: null});
        if (isSelected) setSelectedTaskId(null);
        closeDeleteConfirm();
    }, [updateTask, isSelected, setSelectedTaskId, closeDeleteConfirm]);

    const handleDeleteTask = useCallback(() => {
        if (isLoadingPreferences) return;
        if (preferences.confirmDeletions) {
            setIsDeleteDialogOpen(true);
        } else {
            confirmDeleteTask();
        }
    }, [preferences.confirmDeletions, confirmDeleteTask, isLoadingPreferences]);


    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);

    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0 dark:bg-primary-dark/30 dark:text-primary-light",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);

    const subtaskSearchMatch = useMemo(() => {
        if (searchWords.length === 0 || !task.subtasks || task.subtasks.length === 0) return null;
        const parentTitleIncludesAllSearchWords = searchWords.every(w => task.title.toLowerCase().includes(w));
        const parentContentMatchesSomeWord = task.content && searchWords.some(w => task.content!.toLowerCase().includes(w));
        for (const subtask of task.subtasks) {
            const subtaskTitleIncludesSomeSearchWord = searchWords.some(w => subtask.title.toLowerCase().includes(w));
            if (subtaskTitleIncludesSomeSearchWord && (!parentTitleIncludesAllSearchWords || parentContentMatchesSomeWord)) {
                return {
                    type: 'title',
                    text: generateContentSnippet(subtask.title, searchTerm, 30),
                    original: subtask.title
                };
            }
        }
        return null;
    }, [searchWords, task.title, task.content, task.subtasks, searchTerm]);


    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lcContent = task.content.toLowerCase();
        const lcTitle = task.title.toLowerCase();
        const contentHasMatch = searchWords.some(w => lcContent.includes(w));
        const titleHasAllMatches = searchWords.every(w => lcTitle.includes(w));
        return contentHasMatch && (!titleHasAllMatches && !subtaskSearchMatch);
    }, [searchWords, task.content, task.title, subtaskSearchMatch]);

    const combinedRef = useCallback((node: HTMLDivElement | null) => {
        setNodeRef(node);
        (taskItemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }, [setNodeRef]);

    const baseClasses = useMemo(() => twMerge(
        'task-item h-[48px] mb-1.5', // 核心修复：移除 flex 和 items-center，它们将在内部 wrapper 上
        'group relative rounded-base backdrop-blur-sm',
        isOverlay
            ? 'bg-white/90 dark:bg-neutral-750/90 shadow-xl border border-grey-light/50 dark:border-neutral-600/50'
            : isSelected && !isDragging
                ? 'bg-black/5 dark:bg-white/10'
                : isTrashItem || isCompleted
                    ? 'bg-white/50 dark:bg-neutral-800/50 opacity-60'
                    : 'bg-white/60 dark:bg-neutral-800/60 hover:bg-white/80 dark:hover:bg-neutral-750/80',
        isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-default'),
        'transition-colors duration-150 ease-in-out outline-none',
        'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-800'
    ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);


    const titleClasses = useMemo(() => twMerge(
        "text-[13px] text-grey-dark dark:text-neutral-100 leading-tight block font-normal truncate",
        (isCompleted || isTrashItem) && "line-through text-grey-medium dark:text-neutral-400 font-light"
    ), [isCompleted, isTrashItem]);

    const listIcon: IconName = useMemo(() => task.listName === 'Inbox' ? 'inbox' : (task.listName === 'Trash' ? 'trash' : 'list'), [task.listName]);
    const availableLists = useMemo(() => (allUserLists ?? []).filter(l => l.name !== 'Trash'), [allUserLists]);

    const actionsMenuContentClasses = useMemo(() => twMerge(
        'z-[60] min-w-[180px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700',
        'data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide'
    ), []);

    const popoverContentWrapperClasses = useMemo(() => twMerge(
        "z-[70] bg-white rounded-base shadow-popover dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    const taskListPriorityMap: Record<number, { label: string; iconColor: string; bgColor: string; shortLabel: string; borderColor?: string; dotColor?: string; }> = useMemo(() => ({
        1: {label: t('priorityLabels.1'), iconColor: 'text-error', bgColor: 'bg-error', shortLabel: 'P1', borderColor: 'border-error', dotColor: 'bg-error'},
        2: {label: t('priorityLabels.2'), iconColor: 'text-warning', bgColor: 'bg-warning', shortLabel: 'P2', borderColor: 'border-warning', dotColor: 'bg-warning'},
        3: {label: t('priorityLabels.3'), iconColor: 'text-info', bgColor: 'bg-info', shortLabel: 'P3', borderColor: 'border-info', dotColor: 'bg-info'},
    }), [t]);
    const noPriorityBgColor = 'bg-grey-light dark:bg-neutral-600';

    const progressMenuItems = useMemo(() => [
        {label: t('taskDetail.progressLabels.notStarted'), value: null, icon: 'circle' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.inProgress'), value: 30, icon: 'circle-dot-dashed' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.mostlyDone'), value: 60, icon: 'circle-dot' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.completed'), value: 100, icon: 'circle-check' as IconName, iconStroke: 2},
    ], [t]);

    const isDateClickable = isValidDueDate && isInteractive;

    const dueDateClasses = useMemo(() => twMerge(
        'flex items-center whitespace-nowrap rounded-base transition-colors duration-150 ease-in-out outline-none',
        'text-[11px] font-light',
        overdue && 'text-error dark:text-red-400',
        (isCompleted || isTrashItem) && 'line-through opacity-70',
        isDateClickable && 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 px-1 py-0.5 mx-[-4px] my-[-2px] focus-visible:ring-1 focus-visible:ring-primary',
        !isDateClickable && 'px-0 py-0',
        !overdue && 'text-grey-medium dark:text-neutral-400'
    ), [overdue, isCompleted, isTrashItem, isDateClickable]);

    const tooltipContentClass = "text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[70] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const priorityDotBgClass = useMemo(() => {
        if (task.priority && taskListPriorityMap[task.priority]) {
            return taskListPriorityMap[task.priority].bgColor;
        }
        return noPriorityBgColor;
    }, [task.priority, taskListPriorityMap, noPriorityBgColor]);

    const priorityDotLabel = useMemo(() => {
        if (task.priority && taskListPriorityMap[task.priority]) {
            return taskListPriorityMap[task.priority].label;
        }
        return t('priorityLabels.none');
    }, [task.priority, taskListPriorityMap, t]);

    if (isLoadingPreferences) {
        return (
            <div className={twMerge(baseClasses, "opacity-50 items-center justify-center")}>
                <Icon name="loader" size={16} className="animate-spin text-primary"/>
            </div>
        );
    }

    return (
        <>
            <div ref={combinedRef}
                 style={style}
                 className={baseClasses} {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                 onClick={handleTaskClick}
                 role={isSortable ? "listitem" : "button"}
                 tabIndex={isInteractive || isSortable ? 0 : -1}
                 onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                     if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button, input, a, [role="menuitem"], [data-date-picker-trigger="true"], [data-tooltip-trigger]')) {
                         e.preventDefault();
                         handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).getAttribute('data-date-picker-trigger') === 'true' && isDateClickable) {
                         e.preventDefault();
                         e.stopPropagation();
                         handleDateClickPickerOpenChange(true);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === taskItemRef.current && moreActionsButtonRef.current && isInteractive) {
                         e.preventDefault();
                         e.stopPropagation();
                         moreActionsButtonRef.current.click();
                     }
                 }}
                 aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}>
                {/* 核心修复：添加一个内部 wrapper 来处理内边距和 flex 布局 */}
                <div className={twMerge("flex items-center w-full h-full", isOverlay ? "px-4" : "px-4 pr-3")}>
                    <div className="flex-shrink-0 mr-3">
                        <ProgressIndicator percentage={task.completePercentage} isTrash={isTrashItem}
                                           onClick={cycleCompletionPercentage} onKeyDown={handleProgressIndicatorKeyDown}
                                           ariaLabelledby={`task-title-${task.id}`} size={16}/>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center">
                            {!isCompleted && !isTrashItem && task.priority && (
                                <Tooltip.Provider delayDuration={300}><Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                     <span
                                         className={twMerge("w-2 h-2 rounded-full flex-shrink-0 mr-2", priorityDotBgClass)}
                                         data-tooltip-trigger="true"
                                         aria-label={priorityDotLabel}
                                     />
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={4}>
                                        {priorityDotLabel} <Tooltip.Arrow
                                        className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                            )}
                            <Highlighter {...highlighterProps} textToHighlight={task.title || t('common.untitledTask')}
                                         id={`task-title-${task.id}`} className={titleClasses}/>
                        </div>

                        <div
                            className={twMerge("flex items-center flex-wrap text-grey-medium dark:text-neutral-400 mt-0.5 leading-tight gap-x-2 gap-y-0.5 min-h-[17px]",
                                (isCompleted || isTrashItem) && "opacity-70"
                            )}>
                            {!isTrashItem && (
                                <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                    <span className="flex items-center text-[11px] font-light cursor-default"
                                          data-tooltip-trigger="true">
                                         <Icon name={listIcon} size={12} strokeWidth={1.5}
                                               className="mr-0.5 opacity-80 flex-shrink-0"/>
                                        <span
                                            className={clsx((isCompleted || isTrashItem) && 'line-through')}>{task.listName === 'Inbox' ? t('sidebar.inbox') : task.listName}</span>
                                    </span>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                     align="start" sideOffset={4}>
                                        List: {task.listName === 'Inbox' ? t('sidebar.inbox') : task.listName} <Tooltip.Arrow
                                        className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                            )}

                            {task.subtasks && task.subtasks.length > 0 && !subtaskSearchMatch && (
                                <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                     <span className="flex items-center text-[11px] font-light cursor-default"
                                           data-tooltip-trigger="true">
                                          <Icon name="git-fork" size={12} strokeWidth={1.5}
                                                className="mr-0.5 opacity-80 flex-shrink-0"/>
                                         <span
                                             className={clsx((isCompleted || isTrashItem) && 'line-through')}>{task.subtasks.length}</span>
                                     </span>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                     align="start" sideOffset={4}>
                                        {task.subtasks.length} Subtask{task.subtasks.length > 1 ? 's' : ''} <Tooltip.Arrow
                                        className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                            )}

                            {isValidDueDate && !showContentHighlight && !subtaskSearchMatch && (
                                <Popover.Root modal={true} open={isDateClickPickerOpen}
                                              onOpenChange={handleDateClickPickerOpenChange}>
                                    <Popover.Trigger asChild disabled={!isDateClickable}>
                                        <button ref={dateDisplayRef} className={dueDateClasses}
                                                title={isDateClickable ? `Due: ${formatDate(dueDate!)} (Click to change)` : `Due: ${formatDate(dueDate!)}`}
                                                onClick={isDateClickable ? (e) => {
                                                    e.stopPropagation();
                                                    handleDateClickPickerOpenChange(true);
                                                } : undefined}
                                                onKeyDown={isDateClickable ? (e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDateClickPickerOpenChange(true);
                                                    }
                                                } : undefined}
                                                aria-label={isDateClickable ? `Change due date, currently ${formatRelativeDate(dueDate!, t, false, preferences?.language)}` : `Due date ${formatRelativeDate(dueDate!, t, false, preferences?.language)}`}
                                                data-date-picker-trigger={isDateClickable ? "true" : "false"}
                                                data-tooltip-trigger={!isDateClickable ? "true" : "false"}
                                        >
                                            <Icon name="calendar" size={12} strokeWidth={1.5}
                                                  className="mr-0.5 opacity-80 flex-shrink-0"/>
                                            {formatRelativeDate(dueDate!, t, false, preferences?.language)}
                                        </button>
                                    </Popover.Trigger>
                                    {isDateClickable && (
                                        <Popover.Portal><Popover.Content side="bottom" align="start" sideOffset={5}
                                                                         className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                                         onOpenAutoFocus={(e) => e.preventDefault()}
                                                                         onCloseAutoFocus={(e) => {
                                                                             e.preventDefault();
                                                                             dateDisplayRef.current?.focus();
                                                                         }}>
                                            <CustomDatePickerContent
                                                initialDate={dueDate ?? undefined}
                                                onSelect={(date) => {
                                                    updateTask({dueDate: date ? date.getTime() : null});
                                                    closeDateClickPopover();
                                                }}
                                                closePopover={closeDateClickPopover}/>
                                        </Popover.Content></Popover.Portal>)}
                                </Popover.Root>
                            )}

                            {task.tags && task.tags.length > 0 && !showContentHighlight && !subtaskSearchMatch && (
                                <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                    <span
                                        className={clsx("flex items-center bg-black/5 dark:bg-white/5 text-grey-medium dark:text-neutral-400 px-1.5 py-[1px] rounded-base text-[10px] font-light cursor-default", (isCompleted || isTrashItem) && 'line-through opacity-60')}
                                        data-tooltip-trigger="true"
                                    >
                                        <Icon name="tag" size={10} strokeWidth={1.5}
                                              className="mr-1 opacity-80"/>
                                        <span className="truncate max-w-[60px]">{task.tags[0]}</span>
                                        {task.tags.length > 1 &&
                                            <span className="ml-0.5 opacity-70">+{task.tags.length - 1}</span>}
                                    </span>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                     sideOffset={4}>
                                        Tags: {task.tags.join(', ')}<Tooltip.Arrow
                                        className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                            )}

                            {showContentHighlight && (
                                <div
                                    className={clsx("flex items-center text-[11px] text-grey-medium dark:text-neutral-400 italic w-full font-light", (isCompleted || isTrashItem) && 'line-through')}>
                                    <Icon name="file-text" size={10} strokeWidth={1}
                                          className="mr-1 opacity-70 flex-shrink-0 mt-px"/>
                                    <Highlighter {...highlighterProps}
                                                 textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                                 className="truncate"/>
                                </div>
                            )}

                            {subtaskSearchMatch && (
                                <div
                                    className={clsx("flex items-center text-[11px] text-grey-medium dark:text-neutral-400 italic w-full font-light", (isCompleted || isTrashItem) && 'line-through')}>
                                    <Icon name="git-fork" size={10} strokeWidth={1.5}
                                          className="mr-1 opacity-70 flex-shrink-0 mt-px"/>
                                    <span className="mr-1">Sub:</span>
                                    <Highlighter {...highlighterProps}
                                                 textToHighlight={subtaskSearchMatch.text}
                                                 className="truncate"/>
                                </div>
                            )}
                        </div>
                    </div>

                    {isInteractive && (
                        <div
                            className="task-item-actions absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 ease-in-out z-10"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={handleMoreActionsOpenChange}>
                                <DropdownMenu.Trigger asChild disabled={!isInteractive}>
                                    <Button
                                        ref={moreActionsButtonRef} variant="ghost" size="icon"
                                        icon="more-horizontal"
                                        className="h-7 w-7 text-grey-medium dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary"
                                        iconProps={{size: 16, strokeWidth: 1.5}}
                                        aria-label={`More actions for ${task.title || 'task'}`}/>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={actionsMenuContentClasses}
                                        sideOffset={4}
                                        align="end"
                                        onCloseAutoFocus={(e) => {
                                            if (isDatePickerPopoverOpen || isTagsPopoverOpen) {
                                                e.preventDefault();
                                            } else if (moreActionsButtonRef.current) {
                                                moreActionsButtonRef.current.focus();
                                            }
                                        }}
                                        onInteractOutside={(e) => {
                                            const target = e.target as HTMLElement;
                                            if (target.closest('[data-radix-popper-content-wrapper]') && (isDatePickerPopoverOpen || isTagsPopoverOpen)) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        <div
                                            className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">{t('taskDetail.progress')}
                                        </div>
                                        <div className="flex justify-around items-center px-1.5 py-1">
                                            {progressMenuItems.map(item => {
                                                const isCurrentlySelected = (task.completePercentage ?? null) === item.value;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        onClick={() => handleProgressChange(item.value)}
                                                        className={twMerge(
                                                            "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                            isCurrentlySelected ? "bg-grey-ultra-light dark:bg-neutral-700 text-primary dark:text-primary-light"
                                                                : "text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-200",
                                                            !isInteractive && "opacity-50 cursor-not-allowed"
                                                        )}
                                                        title={item.label}
                                                        aria-pressed={isCurrentlySelected}
                                                        disabled={!isInteractive}
                                                    >
                                                        <Icon name={item.icon} size={14} strokeWidth={item.iconStroke}/>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <DropdownMenu.Separator
                                            className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                        <div
                                            className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">{t('common.priority')}
                                        </div>
                                        <div className="flex justify-around items-center px-1.5 py-1">
                                            {[1, 2, 3].map(pVal => {
                                                const pData = taskListPriorityMap[pVal];
                                                const isCurrentlySelected = task.priority === pVal;
                                                return (
                                                    <button
                                                        key={pVal}
                                                        onClick={() => handlePriorityChange(pVal)}
                                                        className={twMerge(
                                                            "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                            pData.iconColor,
                                                            isCurrentlySelected ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                                : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700",
                                                            !isInteractive && "opacity-50 cursor-not-allowed"
                                                        )}
                                                        title={pData.label}
                                                        aria-pressed={isCurrentlySelected}
                                                        disabled={!isInteractive}
                                                    >
                                                        <Icon name="flag" size={14} strokeWidth={1.5}/>
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => handlePriorityChange(null)}
                                                className={twMerge(
                                                    "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                    task.priority === null
                                                        ? "text-grey-dark dark:text-neutral-200 bg-grey-ultra-light dark:bg-neutral-700"
                                                        : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-300 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700",
                                                    !isInteractive && "opacity-50 cursor-not-allowed"
                                                )}
                                                title={t('priorityLabels.none')}
                                                aria-pressed={task.priority === null}
                                                disabled={!isInteractive}
                                            >
                                                <Icon name="minus" size={14} strokeWidth={1.5}/>
                                            </button>
                                        </div>

                                        <DropdownMenu.Separator
                                            className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger
                                                className={getTaskItemMenuSubTriggerStyle()}
                                                disabled={!isInteractive || isTrashItem}
                                                onPointerEnter={() => {
                                                    if (isDatePickerPopoverOpen) handleMenuSubPopoverOpenChange(false, 'date');
                                                    if (isTagsPopoverOpen) handleMenuSubPopoverOpenChange(false, 'tags');
                                                }}
                                                onFocus={() => {
                                                    if (isDatePickerPopoverOpen) handleMenuSubPopoverOpenChange(false, 'date');
                                                    if (isTagsPopoverOpen) handleMenuSubPopoverOpenChange(false, 'tags');
                                                }}
                                            >
                                                <Icon name="folder" size={14} strokeWidth={1.5}
                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                {t('taskDetail.moveTo')}
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                    strokeWidth={1.5}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={twMerge(actionsMenuContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                                                    sideOffset={2} alignOffset={-5}
                                                >
                                                    <DropdownMenu.RadioGroup value={task.listName}
                                                                             onValueChange={handleListChange}>
                                                        {availableLists.map(list => (
                                                            <DropdownMenu.RadioItem key={list.id} value={list.name}
                                                                                    className={getTaskItemMenuRadioItemStyle(task.listName === list.name)}
                                                                                    disabled={!isInteractive || isTrashItem}>
                                                                <Icon name={list.name === 'Inbox' ? 'inbox' : 'list'}
                                                                      size={14} strokeWidth={1.5}
                                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                                {list.name === 'Inbox' ? t('sidebar.inbox') : list.name}
                                                                <DropdownMenu.ItemIndicator
                                                                    className="absolute right-2 inline-flex items-center">
                                                                    <Icon name="check" size={12} strokeWidth={2}/>
                                                                </DropdownMenu.ItemIndicator>
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator
                                            className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                        <Popover.Root modal={false} open={isTagsPopoverOpen}
                                                      onOpenChange={(open) => handleMenuSubPopoverOpenChange(open, 'tags')}>
                                            <Popover.Trigger asChild>
                                                <TaskItemRadixMenuItem
                                                    icon="tag"
                                                    onSelect={(event) => {
                                                        event.preventDefault();
                                                        handleMenuSubPopoverOpenChange(true, 'tags');
                                                    }}
                                                    disabled={!isInteractive}
                                                > {t('taskDetail.addTags')} </TaskItemRadixMenuItem>
                                            </Popover.Trigger>
                                            <Popover.Portal>
                                                <Popover.Content
                                                    side="right" align="start" sideOffset={5}
                                                    className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                                    onCloseAutoFocus={(e) => {
                                                        e.preventDefault();
                                                        moreActionsButtonRef.current?.focus();
                                                    }}
                                                    onFocusOutside={(event) => event.preventDefault()}
                                                    onPointerDownOutside={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (!target.closest('[data-radix-dropdown-menu-trigger]') && !target.closest('[data-radix-popper-content-wrapper]')) {
                                                            handleMenuSubPopoverOpenChange(false, 'tags');
                                                        } else {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    <AddTagsPopoverContent
                                                        taskId={task.id}
                                                        initialTags={task.tags || []}
                                                        onApply={handleTagsApply}
                                                        closePopover={closeTagsPopover}
                                                    />
                                                </Popover.Content>
                                            </Popover.Portal>
                                        </Popover.Root>

                                        <Popover.Root modal={false} open={isDatePickerPopoverOpen}
                                                      onOpenChange={(open) => handleMenuSubPopoverOpenChange(open, 'date')}>
                                            <Popover.Trigger asChild>
                                                <TaskItemRadixMenuItem
                                                    icon="calendar-plus"
                                                    onSelect={(event) => {
                                                        event.preventDefault();
                                                        handleMenuSubPopoverOpenChange(true, 'date');
                                                    }}
                                                    disabled={!isInteractive}
                                                > {t('taskDetail.setDueDate')}... </TaskItemRadixMenuItem>
                                            </Popover.Trigger>
                                            <Popover.Portal>
                                                <Popover.Content
                                                    side="right" align="start" sideOffset={5}
                                                    className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                                    onCloseAutoFocus={(e) => {
                                                        e.preventDefault();
                                                        moreActionsButtonRef.current?.focus();
                                                    }}
                                                    onFocusOutside={(event) => event.preventDefault()}
                                                    onPointerDownOutside={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (!target.closest('[data-radix-dropdown-menu-trigger]') && !target.closest('[data-radix-popper-content-wrapper]')) {
                                                            handleMenuSubPopoverOpenChange(false, 'date');
                                                        } else {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    <CustomDatePickerContent
                                                        initialDate={dueDate ?? undefined}
                                                        onSelect={(date) => {
                                                            handleDateSelect(date);
                                                            closeMenuDatePickerPopover();
                                                        }}
                                                        closePopover={closeMenuDatePickerPopover}/>
                                                </Popover.Content>
                                            </Popover.Portal>
                                        </Popover.Root>

                                        <DropdownMenu.Separator
                                            className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                        <TaskItemRadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}
                                                               disabled={!isInteractive || isTrashItem}>
                                            {t('taskDetail.duplicate')}
                                        </TaskItemRadixMenuItem>

                                        {!isTrashItem && (
                                            <TaskItemRadixMenuItem
                                                icon="trash"
                                                onSelect={() => setTimeout(() => handleDeleteTask(), 0)}
                                                isDanger
                                                disabled={isLoadingPreferences}>
                                                {t('taskDetail.moveToTrash')}
                                            </TaskItemRadixMenuItem>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDeleteModalRadix
                isOpen={isDeleteDialogOpen}
                onClose={closeDeleteConfirm}
                onConfirm={confirmDeleteTask}
                itemTitle={task.title || t('common.untitledTask')}
                title={t('confirmDeleteModal.task.title')}
                description={t('confirmDeleteModal.task.description', {itemTitle: task.title || t('common.untitledTask')})}
                confirmText={t('confirmDeleteModal.task.confirmText')}
                confirmVariant="danger"
            />
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;