// src/components/tasks/TaskItem.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Task, TaskGroupCategory} from '@/types';
import {formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate} from '@/utils/dateUtils';
import {useAtom, useSetAtom} from 'jotai';
import {searchTermAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Button from "@/components/common/Button";
import Highlighter from "react-highlight-words";
import {IconName} from "@/components/common/IconMap";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import {CustomDatePickerContent} from "@/components/common/CustomDatePickerPopover";
import {useTaskItemMenu} from '@/context/TaskItemMenuContext';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import * as Tooltip from '@radix-ui/react-tooltip';
// import SelectionCheckboxRadix from '../common/SelectionCheckbox'; // Not used if ProgressIndicator is the checkbox
import {useAtomValue} from "jotai/index";

// Re-exporting ProgressIndicator here as it's tightly coupled with TaskItem's design
export const ProgressIndicator: React.FC<{
    percentage: number | null; isTrash: boolean; size?: number; className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string;
}> = React.memo(({percentage, isTrash, size = 16, className, onClick, onKeyDown, ariaLabelledby}) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 1;
    const offset = circumference - (normalizedPercentage / 100) * circumference;
    const checkPath = `M ${size * 0.32} ${size * 0.5} L ${size * 0.45} ${size * 0.65} L ${size * 0.7} ${size * 0.4}`;

    const indicatorClasses = useMemo(() => twMerge(
        "relative flex-shrink-0 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        !isTrash && "cursor-pointer",
        isTrash && "opacity-50 cursor-not-allowed",
        className
    ), [isTrash, className]);

    const stateStyles = useMemo(() => {
        if (isTrash) return "border-grey-light";
        if (normalizedPercentage === 100) return "bg-primary border-primary";
        return "border-grey-light hover:border-primary-dark";
    }, [isTrash, normalizedPercentage]);

    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-grey-medium";
        if (normalizedPercentage === 100) return "stroke-white";
        return "stroke-primary";
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

// ... (generateContentSnippet, priorityMap, TaskItemRadixMenuItem - logic unchanged)
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

const priorityMap: Record<number, {
    label: string;
    iconColor: string;
    shortLabel: string
}> = {
    1: {label: 'High Priority', iconColor: 'text-error', shortLabel: 'P1'},
    2: {label: 'Medium Priority', iconColor: 'text-warning', shortLabel: 'P2'},
    3: {label: 'Low Priority', iconColor: 'text-info', shortLabel: 'P3'},
    4: {label: 'Lowest Priority', iconColor: 'text-grey-medium', shortLabel: 'P4'},
};

interface RadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const TaskItemRadixMenuItem: React.FC<RadixMenuItemProps> = React.memo(({
                                                                            icon,
                                                                            iconColor,
                                                                            selected,
                                                                            children,
                                                                            className,
                                                                            isDanger = false,
                                                                            ...props
                                                                        }) => (<DropdownMenu.Item
    className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 font-normal", isDanger ? "text-error data-[highlighted]:bg-error/10 data-[highlighted]:text-error" : "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light", selected && !isDanger && "bg-primary-light text-primary data-[highlighted]:bg-primary-light", !selected && !isDanger && "text-grey-dark data-[highlighted]:text-grey-dark", "data-[disabled]:opacity-50", className)} {...props}> {icon && (
    <Icon name={icon} size={16} strokeWidth={1} className={twMerge("mr-2 flex-shrink-0 opacity-70", iconColor)}
          aria-hidden="true"/>)} <span className="flex-grow">{children}</span> </DropdownMenu.Item>));
TaskItemRadixMenuItem.displayName = 'TaskItemRadixMenuItem';


interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

const TaskItem: React.FC<TaskItemProps> = memo(({task, groupCategory, isOverlay = false, style: overlayStyle}) => {
    // ... (state and hooks - logic mostly unchanged)
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const {openItemId, setOpenItemId} = useTaskItemMenu();
    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);
    const [isMenuDatePickerOpen, setIsMenuDatePickerOpen] = useState(false);
    const [isDateClickPickerOpen, setIsDateClickPickerOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
    const dateDisplayRef = useRef<HTMLButtonElement>(null);
    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => (task.completionPercentage ?? 0) === 100 && !isTrashItem, [task.completionPercentage, isTrashItem]);
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

    // DND Style: subtle shadow for dragging, primary line for target
    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition || 'background-color 0.2s ease-in-out'; // Default transition
        if (isDragging && !isOverlay) return {
            transform: baseTransform,
            transition: calculatedTransition,
            opacity: 0.7,
            cursor: 'grabbing',
            boxShadow: 'var(--shadow-subtle)',
            zIndex: 10,
            background: 'hsl(var(--color-white))'
        }; // Add white bg for dragging
        if (isOverlay) return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            cursor: 'grabbing',
            boxShadow: 'var(--shadow-subtle)',
            zIndex: 1000,
            background: 'hsl(var(--color-white))'
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
            if (isMoreActionsOpen) setIsMoreActionsOpen(false);
            if (isMenuDatePickerOpen) setIsMenuDatePickerOpen(false);
            if (isDateClickPickerOpen) setIsDateClickPickerOpen(false);
        }
    }, [openItemId, task.id, isMoreActionsOpen, isMenuDatePickerOpen, isDateClickPickerOpen]);
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, [data-radix-popper-content-wrapper], [role="dialog"], [role="menuitem"], [data-date-picker-trigger="true"]')) return;
        if (isDragging) return;
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setIsMoreActionsOpen(false);
        setIsMenuDatePickerOpen(false);
        setIsDateClickPickerOpen(false);
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, isDragging, setOpenItemId]);
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        setTasks(prevTasks => prevTasks.map(t => (t.id === task.id ? {...t, ...updates, updatedAt: Date.now()} : t)));
    }, [setTasks, task.id]);
    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const currentPercentage = task.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
        if (nextPercentage === 100 && isSelected) setSelectedTaskId(null);
        setOpenItemId(null);
        setIsMoreActionsOpen(false);
        setIsMenuDatePickerOpen(false);
        setIsDateClickPickerOpen(false);
    }, [task.completionPercentage, updateTask, isSelected, setSelectedTaskId, setOpenItemId]);
    const handleProgressIndicatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycleCompletionPercentage();
        }
    }, [cycleCompletionPercentage]);
    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completionPercentage: newPercentage});
        if (newPercentage === 100 && isSelected) setSelectedTaskId(null);
    }, [updateTask, isSelected, setSelectedTaskId]);
    const handleDateSelect = useCallback((dateWithTime: Date | undefined) => {
        const newDueDate = dateWithTime ? dateWithTime.getTime() : null;
        updateTask({dueDate: newDueDate});
    }, [updateTask]);
    const handleMenuDatePickerOpenChange = useCallback((open: boolean) => {
        setIsMenuDatePickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsDateClickPickerOpen(false);
        } else if (openItemId === task.id && !isMoreActionsOpen && !isDateClickPickerOpen) setOpenItemId(null);
    }, [setIsMenuDatePickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isDateClickPickerOpen]);
    const handleDateClickPickerOpenChange = useCallback((open: boolean) => {
        setIsDateClickPickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMenuDatePickerOpen(false);
        } else if (openItemId === task.id && !isMoreActionsOpen && !isMenuDatePickerOpen) setOpenItemId(null);
    }, [setIsDateClickPickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isMenuDatePickerOpen]);
    const closeMenuDatePickerPopover = useCallback(() => handleMenuDatePickerOpenChange(false), [handleMenuDatePickerOpenChange]);
    const closeDateClickPopover = useCallback(() => handleDateClickPickerOpenChange(false), [handleDateClickPickerOpenChange]);
    const handlePriorityChange = useCallback((newPriority: number | null) => updateTask({priority: newPriority}), [updateTask]);
    const handleListChange = useCallback((newList: string) => updateTask({list: newList}), [updateTask]);
    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        const duplicatedSubtasks = (task.subtasks || []).map(sub => ({
            ...sub,
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: '',
            createdAt: now,
            updatedAt: now,
            completedAt: sub.completed ? now : null,
        }));
        const newParentTaskId = `task-${now}-${Math.random().toString(16).slice(2)}`;
        duplicatedSubtasks.forEach(sub => sub.parentId = newParentTaskId);
        const newTaskData: Partial<Task> = {
            ...task,
            id: newParentTaskId,
            title: `${task.title} (Copy)`,
            order: task.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: task.completionPercentage === 100 ? null : task.completionPercentage,
            subtasks: duplicatedSubtasks,
        };
        delete newTaskData.groupCategory;
        setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            const newTasks = [...prev];
            if (index !== -1) newTasks.splice(index + 1, 0, newTaskData as Task); else newTasks.push(newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newParentTaskId);
    }, [task, setTasks, setSelectedTaskId]);
    const openDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDeleteTask = useCallback(() => {
        updateTask({list: 'Trash', completionPercentage: null});
        if (isSelected) setSelectedTaskId(null);
        closeDeleteConfirm();
    }, [updateTask, isSelected, setSelectedTaskId, closeDeleteConfirm]);

    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);
    const subtaskSearchMatch = useMemo(() => {
        if (searchWords.length === 0 || !task.subtasks || task.subtasks.length === 0) return null;
        const parentTitleIncludesAllSearch = searchWords.every(w => task.title.toLowerCase().includes(w));
        const parentContentIncludesAllSearch = task.content && searchWords.every(w => task.content!.toLowerCase().includes(w));
        for (const subtask of task.subtasks) {
            const subtaskTitleIncludesAllSearch = searchWords.every(w => subtask.title.toLowerCase().includes(w));
            if (subtaskTitleIncludesAllSearch && !parentTitleIncludesAllSearch) return {
                type: 'title',
                text: subtask.title,
                original: subtask.title
            };
        }
        return null;
    }, [searchWords, task.title, task.content, task.subtasks, searchTerm]);
    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        const mainContentMatch = searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w));
        return mainContentMatch && (!subtaskSearchMatch || subtaskSearchMatch.type !== 'content');
    }, [searchWords, task.content, task.title, subtaskSearchMatch]);

    // TaskItem Container: height 40px, padding L16px R12px. No border/shadow by default.
    const baseClasses = useMemo(() => twMerge(
        'task-item flex items-start px-4 pr-3 h-[40px]', // L/R padding
        'group relative',
        isOverlay ? 'bg-white shadow-subtle rounded-base border border-grey-light'
            : isSelected && !isDragging ? 'bg-grey-ultra-light'
                : isTrashItem || isCompleted ? 'bg-white opacity-60'
                    : 'bg-white hover:bg-grey-ultra-light',
        isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-default')
    ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);

    // Task Text: Inter Light 13px, #545466. Completed: strike-through, #C2C2CC
    const titleClasses = useMemo(() => twMerge(
        "text-[13px] text-grey-dark leading-tight block font-normal", // Use font-normal for better readability
        (isCompleted || isTrashItem) && "line-through text-grey-medium font-light" // Completed/trashed can be light
    ), [isCompleted, isTrashItem]);

    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const actionsMenuContentClasses = useMemo(() => twMerge('z-[55] min-w-[200px] p-1 w-52 bg-white rounded-base shadow-modal data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide'), []);
    const datePickerPopoverWrapperClasses = useMemo(() => twMerge("z-[60] p-0 bg-white rounded-base shadow-modal data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"), []);
    const progressMenuItems = useMemo(() => [{
        label: 'Not Started',
        value: null,
        icon: 'circle' as IconName
    }, {label: '20%', value: 20, icon: 'circle-dot-dashed' as IconName}, {
        label: '50%',
        value: 50,
        icon: 'circle-dot' as IconName
    }, {label: '80%', value: 80, icon: 'circle-slash' as IconName}, {
        label: '100% (Completed)',
        value: 100,
        icon: 'circle-check' as IconName
    },], []);
    const isDateClickable = isValidDueDate && isInteractive;

    const dueDateClasses = useMemo(() => twMerge(
        'flex items-center whitespace-nowrap rounded-base transition-colors duration-150 ease-in-out outline-none',
        'text-[11px] font-light',
        overdue && 'text-error',
        (isCompleted || isTrashItem) && 'line-through opacity-70',
        isDateClickable && 'cursor-pointer hover:bg-grey-ultra-light px-1 py-0.5 mx-[-4px] my-[-2px] focus-visible:ring-1 focus-visible:ring-primary', // Adjusted padding for hover effect
        !isDateClickable && 'px-0 py-0',
        !overdue && 'text-grey-medium'
    ), [overdue, isCompleted, isTrashItem, isDateClickable]);

    const tooltipContentClass = "text-[11px] bg-grey-dark text-white px-2 py-1 rounded-base shadow-md select-none z-[70] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    return (
        <>
            <div ref={setNodeRef} style={style}
                 className={baseClasses} {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                 onClick={handleTaskClick} role={isSortable ? "listitem" : "button"} tabIndex={0}
                 onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                     if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('[role="button"],[role="menuitem"]')) {
                         e.preventDefault();
                         handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).getAttribute('data-date-picker-trigger') === 'true') {
                         e.preventDefault();
                         handleDateClickPickerOpenChange(true);
                     }
                 }}
                 aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}>

                <div className="flex-shrink-0 mr-3 pt-[1px]">
                    <ProgressIndicator percentage={task.completionPercentage} isTrash={isTrashItem}
                                       onClick={cycleCompletionPercentage} onKeyDown={handleProgressIndicatorKeyDown}
                                       ariaLabelledby={`task-title-${task.id}`} size={16}/>
                </div>

                <div className="flex-1 min-w-0 pt-[1px] pb-[1px] flex flex-col justify-center">
                    <div className="flex items-baseline">
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                        {task.completionPercentage && task.completionPercentage > 0 && task.completionPercentage < 100 && !isCompleted && !isTrashItem && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <span className="ml-1.5 w-2 h-2 rounded-full bg-primary"
                                          style={{opacity: (task.completionPercentage || 0) / 100 + 0.2}}></span>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                 sideOffset={4}>
                                    {task.completionPercentage}% Complete <Tooltip.Arrow
                                    className="fill-grey-dark"/></Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}
                    </div>
                    {(isValidDueDate || (task.tags && task.tags.length > 0)) && !showContentHighlight && !subtaskSearchMatch && (
                        <div
                            className={twMerge("flex items-center flex-wrap text-grey-medium mt-0.5 leading-tight gap-x-1.5 gap-y-0.5 min-h-[17px]")}> {/* Reduced gap-x */}
                            {isValidDueDate && (
                                <Popover.Root modal={true} open={isDateClickPickerOpen}
                                              onOpenChange={handleDateClickPickerOpenChange}>
                                    <Popover.Trigger asChild disabled={!isDateClickable}>
                                        <button ref={dateDisplayRef} className={dueDateClasses}
                                                title={formatDate(dueDate!)}
                                                onClick={isDateClickable ? (e) => e.stopPropagation() : undefined}
                                                onKeyDown={isDateClickable ? (e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDateClickPickerOpenChange(true);
                                                    }
                                                } : undefined}
                                                aria-label={isDateClickable ? `Change due date, currently ${formatRelativeDate(dueDate!, false)}` : undefined}
                                                data-date-picker-trigger={isDateClickable ? "true" : "false"}>
                                            <Icon name="calendar" size={10} strokeWidth={1}
                                                  className="mr-0.5 opacity-70 flex-shrink-0"/>
                                            {formatRelativeDate(dueDate!, false)}
                                        </button>
                                    </Popover.Trigger>
                                    {isDateClickable && (
                                        <Popover.Portal><Popover.Content side="bottom" align="start" sideOffset={5}
                                                                         className={datePickerPopoverWrapperClasses}
                                                                         onCloseAutoFocus={(e) => {
                                                                             e.preventDefault();
                                                                             dateDisplayRef.current?.focus();
                                                                         }}><CustomDatePickerContent
                                            initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                            closePopover={closeDateClickPopover}/></Popover.Content></Popover.Portal>)}
                                </Popover.Root>
                            )}
                            {task.tags && task.tags.length > 0 && (
                                <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                    <span
                                        className={clsx("flex items-center bg-grey-ultra-light text-grey-medium px-1.5 py-[1px] rounded-base text-[10px] font-light cursor-default", (isCompleted || isTrashItem) && 'line-through opacity-60')}>
                                        <Icon name="tag" size={10} strokeWidth={1} className="mr-1 opacity-70"/>
                                        <span className="truncate max-w-[60px]">{task.tags[0]}</span>
                                        {task.tags.length > 1 &&
                                            <span className="ml-0.5 opacity-70">+{task.tags.length - 1}</span>}
                                    </span>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                     sideOffset={4}>Tags: {task.tags.join(', ')}<Tooltip.Arrow
                                        className="fill-grey-dark"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                            )}
                        </div>
                    )}
                    {showContentHighlight && (<Highlighter {...highlighterProps}
                                                           textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                                           className={clsx("block truncate text-[11px] text-grey-medium italic w-full mt-0.5 font-light", (isCompleted || isTrashItem) && 'line-through')}/>)}
                    {subtaskSearchMatch && (<div
                        className={clsx("block truncate text-[11px] text-grey-medium italic w-full flex items-center mt-0.5 font-light", (isCompleted || isTrashItem) && 'line-through')}>
                        <Icon name="git-fork" size={10} strokeWidth={1}
                              className="mr-1 opacity-60 flex-shrink-0"/>Sub: <Highlighter {...highlighterProps}
                                                                                           textToHighlight={subtaskSearchMatch.text}
                                                                                           className="ml-1"/></div>)}
                </div>

                {isInteractive && (
                    <div
                        className="task-item-actions absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ease-in-out z-10"
                        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}>
                        <Popover.Root modal={true} open={isMenuDatePickerOpen}
                                      onOpenChange={handleMenuDatePickerOpenChange}>
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={(open) => {
                                setIsMoreActionsOpen(open);
                                if (open) {
                                    setOpenItemId(task.id);
                                    setIsMenuDatePickerOpen(false);
                                    setIsDateClickPickerOpen(false);
                                } else if (openItemId === task.id && !isMenuDatePickerOpen && !isDateClickPickerOpen) setOpenItemId(null);
                            }}>
                                <Popover.Anchor asChild><DropdownMenu.Trigger asChild disabled={!isInteractive}><Button
                                    ref={moreActionsButtonRef} variant="ghost" size="icon" icon="more-horizontal"
                                    className="h-7 w-7 text-grey-medium hover:bg-grey-ultra-light"
                                    iconProps={{size: 16, strokeWidth: 1}}
                                    aria-label={`More actions for ${task.title || 'task'}`}/></DropdownMenu.Trigger></Popover.Anchor>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content className={actionsMenuContentClasses} sideOffset={4}
                                                          align="end" onCloseAutoFocus={(e) => {
                                        if (!isMenuDatePickerOpen) {
                                            e.preventDefault();
                                            if (!isMenuDatePickerOpen && !isDateClickPickerOpen) moreActionsButtonRef.current?.focus();
                                        }
                                    }}>
                                        {/* Menu items here ... (structure unchanged, styles will be picked up by TaskItemRadixMenuItem) */}
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}><Icon
                                            name="circle-gauge" size={16} strokeWidth={1}
                                            className="mr-2 flex-shrink-0 opacity-70"/>Set Progress
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                strokeWidth={1} className="opacity-70"/>
                                            </div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={actionsMenuContentClasses} sideOffset={2}
                                            alignOffset={-5}>{progressMenuItems.map(item => (
                                            <TaskItemRadixMenuItem key={item.label} icon={item.icon}
                                                                   selected={task.completionPercentage === item.value || (task.completionPercentage === null && item.value === null)}
                                                                   onSelect={() => handleProgressChange(item.value)}
                                                                   disabled={!isInteractive}>{item.label}</TaskItemRadixMenuItem>))}</DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>
                                        <TaskItemRadixMenuItem icon="calendar-plus" onSelect={(event) => {
                                            event.preventDefault();
                                            handleMenuDatePickerOpenChange(true);
                                        }} disabled={!isInteractive}>Set Due Date...</TaskItemRadixMenuItem>
                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}
                                            disabled={!isInteractive}><Icon name="flag" size={16} strokeWidth={1}
                                                                            className="mr-2 flex-shrink-0 opacity-70"/>Priority
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                strokeWidth={1} className="opacity-70"/>
                                            </div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={actionsMenuContentClasses} sideOffset={2}
                                            alignOffset={-5}><DropdownMenu.RadioGroup
                                            value={String(task.priority ?? 'none')}
                                            onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>{[null, 1, 2, 3, 4].map(p => (
                                            <DropdownMenu.RadioItem key={p ?? 'none'} value={String(p ?? 'none')}
                                                                    className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light", p && priorityMap[p]?.iconColor, "data-[state=checked]:bg-primary-light data-[state=checked]:text-primary data-[highlighted]:bg-primary-light", !p && "text-grey-dark data-[highlighted]:text-grey-dark", "data-[disabled]:opacity-50")}
                                                                    disabled={!isInteractive}> {p &&
                                                <Icon name="flag" size={16} strokeWidth={1}
                                                      className="mr-2 flex-shrink-0 opacity-70"/>} {p ? `P${p} ${priorityMap[p]?.label}` : 'None'} </DropdownMenu.RadioItem>))}</DropdownMenu.RadioGroup></DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}
                                            disabled={!isInteractive}><Icon name="folder" size={16} strokeWidth={1}
                                                                            className="mr-2 flex-shrink-0 opacity-70"/>Move
                                            to List
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                strokeWidth={1} className="opacity-70"/>
                                            </div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={twMerge(actionsMenuContentClasses, "max-h-40 overflow-y-auto styled-scrollbar-thin")}
                                            sideOffset={2} alignOffset={-5}><DropdownMenu.RadioGroup value={task.list}
                                                                                                     onValueChange={handleListChange}>{availableLists.map(list => (
                                            <DropdownMenu.RadioItem key={list} value={list}
                                                                    className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=checked]:bg-primary-light data-[state=checked]:text-primary data-[highlighted]:bg-primary-light text-grey-dark data-[highlighted]:text-grey-dark data-[disabled]:opacity-50")}
                                                                    disabled={!isInteractive}><Icon
                                                name={list === 'Inbox' ? 'inbox' : 'list'} size={16} strokeWidth={1}
                                                className="mr-2 flex-shrink-0 opacity-70"/>{list}
                                            </DropdownMenu.RadioItem>))}</DropdownMenu.RadioGroup></DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>
                                        <TaskItemRadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}
                                                               disabled={!isInteractive}>Duplicate
                                            Task</TaskItemRadixMenuItem>
                                        {!isTrashItem && (
                                            <TaskItemRadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>Move
                                                to Trash</TaskItemRadixMenuItem>)}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <Popover.Portal><Popover.Content side="bottom" align="end" sideOffset={5}
                                                             className={datePickerPopoverWrapperClasses}
                                                             onCloseAutoFocus={(e) => {
                                                                 e.preventDefault();
                                                                 moreActionsButtonRef.current?.focus();
                                                             }}><CustomDatePickerContent
                                initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                closePopover={closeMenuDatePickerPopover}/></Popover.Content></Popover.Portal>
                        </Popover.Root>
                    </div>
                )}
            </div>
            <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm}
                                     onConfirm={confirmDeleteTask} itemTitle={task.title || 'Untitled Task'}/>
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;