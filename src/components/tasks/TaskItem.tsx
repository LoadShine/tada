// src/components/tasks/TaskItem.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Task, TaskGroupCategory} from '@/types';
import {formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
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
import {CustomDatePickerContent} from "@/components/common/CustomDatePickerPopover"; // Import CONTENT component
import {useTaskItemMenu} from '@/context/TaskItemMenuContext';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";

// --- ENHANCED SVG Progress Indicator Component ---
interface ProgressIndicatorProps {
    percentage: number | null;
    isTrash: boolean;
    size?: number;
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = React.memo(({
                                                                                   percentage,
                                                                                   isTrash,
                                                                                   size = 16,
                                                                                   className,
                                                                                   onClick,
                                                                                   onKeyDown,
                                                                                   ariaLabelledby
                                                                               }) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1.25;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 2.5;
    const offset = circumference - (normalizedPercentage / 100) * circumference;
    const checkPath = `M ${size * 0.3} ${size * 0.55} L ${size * 0.45} ${size * 0.7} L ${size * 0.75} ${size * 0.4}`;

    const indicatorClasses = useMemo(() => twMerge(
        "relative flex-shrink-0 rounded-full transition-all duration-200 ease-apple focus:outline-none",
        "focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-current/50",
        !isTrash && "cursor-pointer",
        isTrash && "opacity-50 cursor-not-allowed",
        className
    ), [isTrash, className]);

    const buttonBgColor = useMemo(() => {
        if (isTrash) return "bg-gray-200/50 dark:bg-gray-700/40 border-gray-300 dark:border-gray-600";
        if (normalizedPercentage === 100) return "bg-primary/80 hover:bg-primary/90 border-primary/80";
        return "bg-white/40 dark:bg-gray-800/30 hover:border-primary/60 dark:hover:border-primary/50 border-gray-400/80 dark:border-gray-500/70";
    }, [isTrash, normalizedPercentage]);

    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-gray-400 dark:stroke-gray-500";
        if (normalizedPercentage === 100) return "stroke-white";
        if (normalizedPercentage >= 80) return "stroke-primary/90";
        if (normalizedPercentage >= 50) return "stroke-primary/80";
        if (normalizedPercentage > 0) return "stroke-primary/70";
        return "stroke-transparent";
    }, [isTrash, normalizedPercentage]);

    const progressLabel = normalizedPercentage === 100 ? "Completed" : `${normalizedPercentage}% done`;

    return (
        <button
            type="button"
            onClick={onClick}
            onKeyDown={onKeyDown}
            disabled={isTrash}
            aria-labelledby={ariaLabelledby}
            aria-label={`Task progress: ${progressLabel}`}
            aria-pressed={normalizedPercentage === 100}
            className={twMerge(indicatorClasses, buttonBgColor, "border")}
            style={{width: size, height: size}}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-apple"
                style={{opacity: normalizedPercentage > 0 ? 1 : 0}}
                aria-hidden="true"
            >
                {normalizedPercentage > 0 && normalizedPercentage < 100 && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        className={progressStrokeColor}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        strokeLinecap="round"
                        style={{transition: 'stroke-dashoffset 0.3s ease-out'}}
                    />
                )}
                {normalizedPercentage === 100 && (
                    <>
                        <path
                            d={checkPath}
                            fill="none"
                            strokeWidth={strokeWidth * 0.9}
                            className={progressStrokeColor}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{transition: 'opacity 0.2s ease-in 0.1s'}}
                        />
                    </>
                )}
            </svg>
        </button>
    );
});
ProgressIndicator.displayName = 'ProgressIndicator';


// Helper function to generate content snippet
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

    if (firstMatchIndex === -1) {
        return content.substring(0, length) + (content.length > length ? '...' : '');
    }

    const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
    const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));

    let snippet = content.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
}

// Priority Map
const priorityMap: Record<number, { label: string; iconColor: string }> = {
    1: {label: 'High', iconColor: 'text-red-500'},
    2: {label: 'Medium', iconColor: 'text-orange-500'},
    3: {label: 'Low', iconColor: 'text-blue-500'},
    4: {label: 'Lowest', iconColor: 'text-gray-500'},
};

// --- Reusable Radix Dropdown Menu Item ---
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
                                                                        }) => (
    <DropdownMenu.Item
        className={twMerge(
            "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
            isDanger
                ? "text-red-600 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/20 dark:data-[highlighted]:text-red-300"
                : "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
            selected && !isDanger && "bg-primary/20 text-primary data-[highlighted]:bg-primary/25 dark:bg-primary/30 dark:text-primary-light dark:data-[highlighted]:bg-primary/40",
            !selected && !isDanger && "text-gray-600 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
            "data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        {icon && (
            <Icon name={icon} size={14} className={twMerge("mr-1.5 flex-shrink-0 opacity-70", iconColor)}
                  aria-hidden="true"/>
        )}
        {children}
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


// --- TaskItem Component ---
const TaskItem: React.FC<TaskItemProps> = memo(({
                                                    task,
                                                    groupCategory,
                                                    isOverlay = false,
                                                    style: overlayStyle,
                                                }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const {openItemId, setOpenItemId} = useTaskItemMenu();
    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);

    // State for Radix controls
    const [isMenuDatePickerOpen, setIsMenuDatePickerOpen] = useState(false); // Date picker opened from menu
    const [isDateClickPickerOpen, setIsDateClickPickerOpen] = useState(false); // Date picker opened from clicking the date
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const moreActionsButtonRef = useRef<HTMLButtonElement>(null); // Ref for the 'More Actions' button itself
    const dateDisplayRef = useRef<HTMLSpanElement>(null); // Ref for the date display span


    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => (task.completionPercentage ?? 0) === 100 && !isTrashItem, [task.completionPercentage, isTrashItem]);
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);
    const isInteractive = useMemo(() => !isOverlay && !isCompleted && !isTrashItem, [isOverlay, isCompleted, isTrashItem]);

    const {attributes, listeners, setNodeRef, transform, transition: dndTransition, isDragging} = useSortable({
        id: task.id,
        disabled: !isSortable,
        data: {task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory},
    });

    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition;
        if (isDragging && !isOverlay) {
            return {
                transform: baseTransform,
                transition: calculatedTransition,
                opacity: 0.4,
                cursor: 'grabbing',
                backgroundColor: 'hsla(210, 40%, 98%, 0.3)',
                boxShadow: 'none',
                border: '1px dashed hsla(0, 0%, 0%, 0.15)',
                zIndex: 1,
            };
        }
        if (isOverlay) {
            return {
                ...overlayStyle,
                transform: baseTransform,
                transition: calculatedTransition,
                cursor: 'grabbing',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                zIndex: 1000,
            };
        }
        return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition || 'background-color 0.2s ease-apple, border-color 0.2s ease-apple',
            zIndex: isSelected ? 2 : 1,
        };
    }, [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);

    // Close dropdown/popovers if another item's menu/popover opens
    useEffect(() => {
        if (openItemId !== task.id) {
            if (isMoreActionsOpen) setIsMoreActionsOpen(false);
            if (isMenuDatePickerOpen) setIsMenuDatePickerOpen(false);
            if (isDateClickPickerOpen) setIsDateClickPickerOpen(false);
        }
    }, [openItemId, task.id, isMoreActionsOpen, isMenuDatePickerOpen, isDateClickPickerOpen]);


    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        // Prevent selection if clicking interactive elements within the item
        if (target.closest('button, input, a, [data-radix-popper-content-wrapper], [role="dialog"], [role="menuitem"], [role="button"][data-date-picker-trigger="true"]')) {
            return;
        }
        if (isDragging) return;

        setSelectedTaskId(id => (id === task.id ? null : task.id));
        // Close any open menus/popovers for this item when selecting/deselecting
        setIsMoreActionsOpen(false);
        setIsMenuDatePickerOpen(false);
        setIsDateClickPickerOpen(false);
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, isDragging, setOpenItemId]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        setTasks(prevTasks => prevTasks.map(t => (t.id === task.id ? {...t, ...updates, updatedAt: Date.now()} : t)));
    }, [setTasks, task.id]);

    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const currentPercentage = task.completionPercentage ?? 0;
        let nextPercentage: number | null = null;
        if (currentPercentage === 100) nextPercentage = null;
        else nextPercentage = 100;

        updateTask({completionPercentage: nextPercentage});
        if (nextPercentage === 100 && isSelected) {
            setSelectedTaskId(null);
        }
        setOpenItemId(null); // Close any open context
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
        if (newPercentage === 100 && isSelected) {
            setSelectedTaskId(null);
        }
    }, [updateTask, isSelected, setSelectedTaskId]);

    const handleDateSelect = useCallback((date: Date | undefined) => {
        const newDueDate = date && isValid(date) ? startOfDay(date).getTime() : null;
        updateTask({dueDate: newDueDate});
        // Popover closes automatically via close callback passed to CustomDatePickerContent
    }, [updateTask]);

    // Callback for the Date Picker Popover triggered by MENU
    const handleMenuDatePickerOpenChange = useCallback((open: boolean) => {
        setIsMenuDatePickerOpen(open);
        if (open) {
            setOpenItemId(task.id); // Set context when opening
            setIsDateClickPickerOpen(false); // Ensure other picker is closed
        } else if (openItemId === task.id && !isMoreActionsOpen && !isDateClickPickerOpen) {
            // Only clear context if this popover is closing AND no other menu/popover for this item is open
            setOpenItemId(null);
        }
    }, [setIsMenuDatePickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isDateClickPickerOpen]);

    // Callback for the Date Picker Popover triggered by CLICKING THE DATE
    const handleDateClickPickerOpenChange = useCallback((open: boolean) => {
        setIsDateClickPickerOpen(open);
        if (open) {
            setOpenItemId(task.id); // Set context when opening
            setIsMenuDatePickerOpen(false); // Ensure other picker is closed
        } else if (openItemId === task.id && !isMoreActionsOpen && !isMenuDatePickerOpen) {
            // Only clear context if this popover is closing AND no other menu/popover for this item is open
            setOpenItemId(null);
        }
    }, [setIsDateClickPickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isMenuDatePickerOpen]);


    // Function to pass down to CustomDatePickerContent to close the MENU popover
    const closeMenuDatePickerPopover = useCallback(() => {
        handleMenuDatePickerOpenChange(false);
    }, [handleMenuDatePickerOpenChange]);

    // Function to pass down to CustomDatePickerContent to close the DATE CLICK popover
    const closeDateClickPopover = useCallback(() => {
        handleDateClickPickerOpenChange(false);
    }, [handleDateClickPickerOpenChange]);

    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({priority: newPriority});
    }, [updateTask]);

    const handleListChange = useCallback((newList: string) => {
        updateTask({list: newList});
    }, [updateTask]);

    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        const newTaskData: Partial<Task> = {
            ...task,
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: `${task.title} (Copy)`,
            order: task.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: task.completionPercentage === 100 ? null : task.completionPercentage,
        };
        delete newTaskData.groupCategory;

        setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            const newTasks = [...prev];
            if (index !== -1) {
                newTasks.splice(index + 1, 0, newTaskData as Task);
            } else {
                newTasks.push(newTaskData as Task);
            }
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!);
    }, [task, setTasks, setSelectedTaskId]);

    const openDeleteConfirm = useCallback(() => {
        // Radix handles dropdown closing on select
        setIsDeleteDialogOpen(true);
    }, []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDeleteTask = useCallback(() => {
        updateTask({list: 'Trash', completionPercentage: null});
        if (isSelected) setSelectedTaskId(null);
        closeDeleteConfirm(); // Close modal after confirmation
    }, [updateTask, isSelected, setSelectedTaskId, closeDeleteConfirm]);

    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);
    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        return searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w));
    }, [searchWords, task.content, task.title]);

    const baseClasses = useMemo(() => twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-black/10 dark:border-white/10 group relative min-h-[52px]',
        isOverlay
            ? 'bg-glass-100 dark:bg-neutral-800 backdrop-blur-lg border rounded-md shadow-strong'
            : isSelected && !isDragging
                ? 'bg-primary/20 dark:bg-primary/30 backdrop-blur-sm'
                : isTrashItem
                    ? 'bg-glass-alt/30 dark:bg-neutral-700/20 backdrop-blur-xs opacity-60 hover:bg-black/10 dark:hover:bg-white/5'
                    : isCompleted
                        ? 'bg-glass-alt/30 dark:bg-neutral-700/20 backdrop-blur-xs opacity-60 hover:bg-black/10 dark:hover:bg-white/5'
                        : 'bg-transparent hover:bg-black/[.05] dark:hover:bg-white/[.03] hover:backdrop-blur-sm',
        isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-default') // Use default cursor when not sortable
    ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);

    const titleClasses = useMemo(() => twMerge(
        "text-sm text-gray-800 dark:text-neutral-100 leading-snug block",
        (isCompleted || isTrashItem) && "line-through text-muted-foreground dark:text-neutral-500"
    ), [isCompleted, isTrashItem]);

    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    const actionsMenuContentClasses = useMemo(() => twMerge(
        'z-[55] min-w-[180px] overflow-hidden p-1 w-48',
        'bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10',
        "data-[state=open]:animate-slideUpAndFade",
        "data-[state=closed]:animate-slideDownAndFade"
    ), []);

    const datePickerPopoverContentClasses = useMemo(() => twMerge(
        "z-[60] radix-popover-content", // High z-index
        "data-[state=open]:animate-slideUpAndFade",
        "data-[state=closed]:animate-slideDownAndFade"
    ), []);

    const progressLabel = useMemo(() => {
        const p = task.completionPercentage;
        if (p && p > 0 && p < 100 && !isTrashItem) {
            return `[${p}%]`;
        }
        return null;
    }, [task.completionPercentage, isTrashItem]);

    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName},
        {label: 'Halfway (50%)', value: 50, icon: 'circle-dot' as IconName},
        {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName},
    ], []);

    // Determine if the date display should be interactive
    const isDateClickable = isValidDueDate && isInteractive;

    const dueDateClasses = useMemo(() => twMerge(
        'flex items-center whitespace-nowrap rounded-[3px] transition-colors duration-150 ease-apple outline-none',
        overdue && 'text-red-600 dark:text-red-400 font-medium',
        (isCompleted || isTrashItem) && 'line-through opacity-70',
        isDateClickable && 'cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 px-1 mx-[-4px] py-0.5 my-[-2px] focus-visible:ring-1 focus-visible:ring-primary/50', // Make it look clickable
        !isDateClickable && 'px-0 py-0' // No extra padding if not clickable
    ), [overdue, isCompleted, isTrashItem, isDateClickable]);


    return (
        <>
            {/* Main Task Item Container */}
            <div
                ref={setNodeRef} style={style} className={baseClasses}
                {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                onClick={handleTaskClick}
                role={isSortable ? "listitem" : "button"} // Role button if not sortable (e.g., completed) but still clickable
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                    // Allow activating the item itself with Enter/Space
                    if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('[role="button"],[role="menuitem"]')) {
                        e.preventDefault();
                        handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                    // If focus is on the date trigger, allow Space/Enter to open it
                    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).getAttribute('data-date-picker-trigger') === 'true') {
                        e.preventDefault();
                        handleDateClickPickerOpenChange(true);
                    }
                }}
                aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}
            >
                {/* Progress Indicator */}
                <div className="flex-shrink-0 mr-2.5 pt-[3px] pl-[2px]">
                    <ProgressIndicator
                        percentage={task.completionPercentage} isTrash={isTrashItem}
                        onClick={cycleCompletionPercentage} onKeyDown={handleProgressIndicatorKeyDown}
                        ariaLabelledby={`task-title-${task.id}`}/>
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0 pt-[1px] pb-[1px]">
                    {/* Title and Progress Label */}
                    <div className="flex items-baseline">
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                        {progressLabel && (
                            <span
                                className="ml-1.5 text-[10px] text-primary/90 dark:text-primary-light/90 opacity-90 font-medium select-none">
                                    {progressLabel}
                                </span>
                        )}
                    </div>
                    {/* Metadata */}
                    <div
                        className="flex items-center flex-wrap text-[11px] text-muted-foreground dark:text-neutral-400 space-x-2 mt-1 leading-tight gap-y-0.5 min-h-[17px]">
                        {/* Priority Indicator */}
                        {!!task.priority && task.priority <= 4 && !isCompleted && !isTrashItem && (
                            <span className={clsx("flex items-center", priorityMap[task.priority]?.iconColor)}
                                  title={`Priority ${priorityMap[task.priority]?.label}`}>
                                    <Icon name="flag" size={11} strokeWidth={2.5}/>
                                </span>
                        )}
                        {/* Due Date & Popover Trigger (Clickable Date) */}
                        {isValidDueDate && (
                            <Popover.Root modal={true} open={isDateClickPickerOpen}
                                          onOpenChange={handleDateClickPickerOpenChange}>
                                <Popover.Trigger asChild disabled={!isDateClickable}>
                                    <span
                                        ref={dateDisplayRef}
                                        className={dueDateClasses}
                                        title={formatDate(dueDate!)}
                                        onClick={isDateClickable ? (e) => e.stopPropagation() : undefined} // Prevent task click only if clickable
                                        onKeyDown={isDateClickable ? (e) => { // Handle keyboard activation for the span acting as button
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation(); // Prevent task click
                                                handleDateClickPickerOpenChange(true); // Manually trigger open
                                            }
                                        } : undefined}
                                        role={isDateClickable ? "button" : undefined}
                                        tabIndex={isDateClickable ? 0 : -1}
                                        aria-label={isDateClickable ? `Change due date, currently ${formatRelativeDate(dueDate!)}` : undefined}
                                        data-date-picker-trigger={isDateClickable ? "true" : "false"} // Custom attribute to identify the trigger
                                    >
                                        <Icon name="calendar" size={11} className="mr-0.5 opacity-70 flex-shrink-0"/>
                                        {formatRelativeDate(dueDate!)}
                                    </span>
                                </Popover.Trigger>
                                {isDateClickable && ( // Only render content if it's interactive
                                    <Popover.Portal>
                                        <Popover.Content
                                            side="bottom"
                                            align="start" // Align popover start relative to the date span
                                            sideOffset={5}
                                            className={datePickerPopoverContentClasses}
                                            onCloseAutoFocus={(e) => {
                                                e.preventDefault(); // Prevent focus shifts
                                                dateDisplayRef.current?.focus(); // Refocus the date trigger
                                            }}
                                            // Avoid focus trap issues if possible, or manage focus carefully
                                            // trapFocus={false} // Consider if focus trapping causes issues here
                                        >
                                            <CustomDatePickerContent
                                                initialDate={dueDate ?? undefined}
                                                onSelect={handleDateSelect}
                                                closePopover={closeDateClickPopover} // Use specific close handler
                                            />
                                        </Popover.Content>
                                    </Popover.Portal>
                                )}
                            </Popover.Root>
                        )}
                        {/* List Name */}
                        {task.list && task.list !== 'Inbox' && (
                            <span
                                className={clsx("flex items-center whitespace-nowrap bg-black/10 dark:bg-white/10 text-muted-foreground dark:text-neutral-400 px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through opacity-70')}
                                title={task.list}
                            >
                                    <Icon name={listIcon} size={10} className="mr-0.5 opacity-70 flex-shrink-0"/>
                                    <span className="truncate">{task.list}</span>
                                </span>
                        )}
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <span
                                className={clsx("flex items-center space-x-1 flex-wrap gap-y-0.5", (isCompleted || isTrashItem) && 'opacity-70')}>
                                    {task.tags.slice(0, 2).map(tag => (
                                        <span key={tag}
                                              className={clsx("bg-black/10 dark:bg-white/10 text-muted-foreground dark:text-neutral-400 px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through')}
                                              title={tag}>
                                            #{tag}
                                        </span>
                                    ))}
                                {task.tags.length > 2 && <span
                                    className="text-muted-foreground dark:text-neutral-500 text-[10px]">+{task.tags.length - 2}</span>}
                                </span>
                        )}
                        {/* Content Snippet Highlight */}
                        {showContentHighlight && (
                            <Highlighter {...highlighterProps}
                                         textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                         className={clsx("block truncate text-[11px] text-muted dark:text-neutral-500 italic w-full mt-0.5", (isCompleted || isTrashItem) && 'line-through')}
                            />
                        )}
                    </div>
                </div>

                {/* More Actions Button, Dropdown, and Popover for Menu-triggered Date Picker */}
                {isInteractive && ( // Only show actions if interactive
                    <div
                        className="task-item-actions absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-30 ease-apple z-10"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        {/* Popover Root for the MENU-triggered Date Picker */}
                        <Popover.Root modal={true} open={isMenuDatePickerOpen}
                                      onOpenChange={handleMenuDatePickerOpenChange}>
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={(open) => {
                                setIsMoreActionsOpen(open);
                                if (open) {
                                    setOpenItemId(task.id);
                                    // Close date pickers if opening actions menu
                                    setIsMenuDatePickerOpen(false);
                                    setIsDateClickPickerOpen(false);
                                } else {
                                    // Check if a popover should remain open when dropdown closes
                                    if (openItemId === task.id && !isMenuDatePickerOpen && !isDateClickPickerOpen) {
                                        setOpenItemId(null);
                                    }
                                }
                            }}>
                                {/* ANCHOR for the MENU-triggered Popover. It wraps the trigger button. */}
                                <Popover.Anchor asChild>
                                    <DropdownMenu.Trigger asChild disabled={!isInteractive}>
                                        <Button
                                            ref={moreActionsButtonRef} // Ref attached here
                                            variant="ghost" size="icon" icon="more-horizontal"
                                            className="h-6 w-6 text-muted-foreground dark:text-neutral-400 hover:bg-black/15 dark:hover:bg-white/10"
                                            aria-label={`More actions for ${task.title || 'task'}`}
                                        />
                                    </DropdownMenu.Trigger>
                                </Popover.Anchor>

                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={actionsMenuContentClasses}
                                        sideOffset={4}
                                        align="end"
                                        onCloseAutoFocus={(e) => {
                                            // Prevent focus shifts unless the menu date picker is opening
                                            if (!isMenuDatePickerOpen) {
                                                e.preventDefault();
                                                // Optionally refocus the trigger if needed and dropdown isn't being replaced by popover
                                                if (!isMenuDatePickerOpen && !isDateClickPickerOpen) {
                                                    moreActionsButtonRef.current?.focus();
                                                }
                                            }
                                        }}
                                    >
                                        {/* Set Progress Submenu */}
                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={twMerge(
                                                "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                "focus:bg-black/15 data-[highlighted]:bg-black/15 data-[state=open]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10 dark:data-[state=open]:bg-white/10",
                                                "text-gray-600 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
                                                "data-[disabled]:opacity-50"
                                            )}>
                                                <Icon name="circle-gauge" size={14}
                                                      className="mr-1.5 flex-shrink-0 opacity-70"/>
                                                Set Progress
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={actionsMenuContentClasses}
                                                    sideOffset={2}
                                                    alignOffset={-5}
                                                >
                                                    {progressMenuItems.map(item => (
                                                        <TaskItemRadixMenuItem
                                                            key={item.label} icon={item.icon}
                                                            selected={task.completionPercentage === item.value || (task.completionPercentage === null && item.value === null)}
                                                            onSelect={() => handleProgressChange(item.value)}
                                                            disabled={!isInteractive}>
                                                            {item.label}
                                                        </TaskItemRadixMenuItem>
                                                    ))}
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>

                                        {/* Set Due Date Item - MANUALLY Triggers Popover */}
                                        <TaskItemRadixMenuItem
                                            icon="calendar-plus"
                                            onSelect={(event) => {
                                                event.preventDefault(); // Prevent default closing behavior just in case
                                                // Manually open the Menu-anchored Popover
                                                handleMenuDatePickerOpenChange(true); // Use the state handler
                                                // DropdownMenu will close automatically, triggering onCloseAutoFocus above
                                            }}
                                            disabled={!isInteractive}
                                        >
                                            Set Due Date...
                                        </TaskItemRadixMenuItem>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>

                                        {/* Set Priority Submenu */}
                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={twMerge(
                                                "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                "focus:bg-black/15 data-[highlighted]:bg-black/15 data-[state=open]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10 dark:data-[state=open]:bg-white/10",
                                                "text-gray-600 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
                                                "data-[disabled]:opacity-50"
                                            )} disabled={!isInteractive}>
                                                <Icon name="flag" size={14}
                                                      className="mr-1.5 flex-shrink-0 opacity-70"/>
                                                Priority
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={actionsMenuContentClasses}
                                                    sideOffset={2}
                                                    alignOffset={-5}
                                                >
                                                    <DropdownMenu.RadioGroup value={String(task.priority ?? 'none')}
                                                                             onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>
                                                        {[null, 1, 2, 3, 4].map(p => (
                                                            <DropdownMenu.RadioItem
                                                                key={p ?? 'none'} value={String(p ?? 'none')}
                                                                className={twMerge(
                                                                    "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                                    "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                                    p && priorityMap[p]?.iconColor,
                                                                    "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                                    !p && "text-gray-600 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
                                                                    "data-[disabled]:opacity-50"
                                                                )}
                                                                disabled={!isInteractive}
                                                            >
                                                                {p && <Icon name="flag" size={14}
                                                                            className="mr-1.5 flex-shrink-0 opacity-70"/>}
                                                                {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        {/* Move to List Submenu */}
                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={twMerge(
                                                "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                "focus:bg-black/15 data-[highlighted]:bg-black/15 data-[state=open]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10 dark:data-[state=open]:bg-white/10",
                                                "text-gray-600 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
                                                "data-[disabled]:opacity-50"
                                            )} disabled={!isInteractive}>
                                                <Icon name="folder" size={14}
                                                      className="mr-1.5 flex-shrink-0 opacity-70"/>
                                                Move to List
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={twMerge(actionsMenuContentClasses, "max-h-40 overflow-y-auto styled-scrollbar-thin")}
                                                    sideOffset={2}
                                                    alignOffset={-5}
                                                >
                                                    <DropdownMenu.RadioGroup value={task.list}
                                                                             onValueChange={handleListChange}>
                                                        {availableLists.map(list => (
                                                            <DropdownMenu.RadioItem
                                                                key={list} value={list}
                                                                className={twMerge(
                                                                    "relative flex cursor-pointer select-none items-center rounded-[3px] px-2 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                                    "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                                    "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                                    "text-gray-600 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
                                                                    "data-[disabled]:opacity-50"
                                                                )}
                                                                disabled={!isInteractive}
                                                            >
                                                                <Icon name={list === 'Inbox' ? 'inbox' : 'list'}
                                                                      size={14}
                                                                      className="mr-1.5 flex-shrink-0 opacity-70"/>
                                                                {list}
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>

                                        {/* Other Actions */}
                                        <TaskItemRadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}
                                                               disabled={!isInteractive}>
                                            Duplicate Task
                                        </TaskItemRadixMenuItem>
                                        {!isTrashItem && (
                                            <TaskItemRadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>
                                                Move to Trash
                                            </TaskItemRadixMenuItem>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>

                            {/* Date Picker Popover CONTENT Area for MENU trigger */}
                            <Popover.Portal>
                                <Popover.Content
                                    side="bottom" // Position relative to anchor (More Actions button)
                                    align="end"   // Align end relative to anchor
                                    sideOffset={5}
                                    className={datePickerPopoverContentClasses}
                                    onCloseAutoFocus={(e) => {
                                        e.preventDefault(); // Prevent focus shift
                                        moreActionsButtonRef.current?.focus(); // Refocus More Actions button
                                    }}
                                >
                                    <CustomDatePickerContent
                                        initialDate={dueDate ?? undefined}
                                        onSelect={handleDateSelect}
                                        closePopover={closeMenuDatePickerPopover} // Use specific close handler
                                    />
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root> {/* End Popover Root for Menu Date Picker */}
                    </div>
                )}
            </div>
            {/* End Main Task Item Container */}

            {/* Delete Modal */}
            <ConfirmDeleteModalRadix
                isOpen={isDeleteDialogOpen}
                onClose={closeDeleteConfirm}
                onConfirm={confirmDeleteTask}
                taskTitle={task.title || 'Untitled Task'}
            />
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;