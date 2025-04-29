// src/components/tasks/TaskItem.tsx
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Task, TaskGroupCategory } from '@/types';
import { formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay } from '@/lib/utils/dateUtils';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { searchTermAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {Button, buttonVariants} from "@/components/ui/button";
import Highlighter from "react-highlight-words";
import { IconName } from "@/components/common/IconMap";
import { Checkbox } from '@/components/ui/checkbox'; // Use Checkbox for progress
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties; // For dnd-kit overlay
}

// Custom Progress Indicator Component (Simplified - using Checkbox now)
// Keeping this structure in case a custom SVG is preferred later.
// For now, we'll use the Checkbox component.

// Helper function to generate content snippet (keep as is)
function generateContentSnippet(content: string, term: string, length: number = 35): string {
    if (!content || !term) return '';
    const lowerContent = content.toLowerCase();
    const searchWords = term.toLowerCase().split(' ').filter(Boolean);
    let firstMatchIndex = -1;
    let matchedWord = '';
    for (const word of searchWords) {
        const index = lowerContent.indexOf(word);
        if (index !== -1) { firstMatchIndex = index; matchedWord = word; break; }
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

// Priority Map (unchanged)
const priorityMap: Record<number, { label: string; iconColor: string }> = {
    1: { label: 'High', iconColor: 'text-red-500 dark:text-red-400' },
    2: { label: 'Medium', iconColor: 'text-orange-500 dark:text-orange-400' },
    3: { label: 'Low', iconColor: 'text-blue-500 dark:text-blue-400' },
    4: { label: 'Lowest', iconColor: 'text-gray-500 dark:text-gray-400' },
};

// TaskItem Component (Refactored with shadcn/ui)
const TaskItem: React.FC<TaskItemProps> = memo(({ task, groupCategory, isOverlay = false, style: overlayStyle }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);
    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => task.completed, [task.completed]); // Use derived completed status
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);

    // State for Popovers/Dialogs within this item
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    // No separate state needed for DropdownMenu, managed internally by shadcn

    // DnD Setup (Unchanged logic, updated styling)
    const { attributes, listeners, setNodeRef, transform, transition: dndTransition, isDragging } = useSortable({
        id: task.id,
        disabled: !isSortable,
        data: { task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory },
    });

    const style = useMemo<React.CSSProperties>(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition;
        if (isDragging && !isOverlay) {
            return {
                transform: baseTransform,
                transition: calculatedTransition,
                opacity: 0.4,
                cursor: 'grabbing',
                zIndex: 1,
            };
        }
        if (isOverlay) {
            return {
                ...overlayStyle,
                transform: baseTransform,
                transition: calculatedTransition,
                cursor: 'grabbing',
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                backgroundColor: 'hsl(var(--card) / 0.9)',
                backdropFilter: 'blur(8px)',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border) / 0.5)',
            };
        }
        return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition || 'background-color 0.2s ease-out, border-color 0.2s ease-out',
            zIndex: isSelected ? 2 : 1,
            position: 'relative',
        };
    }, [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        setTasks(prevTasks => prevTasks.map(t => {
            if (t.id === task.id) {
                return { ...t, ...updates, updatedAt: Date.now() };
            }
            return t;
        }));
    }, [setTasks, task.id]);

    const handleProgressSelect = useCallback(
        (value: string) => {
            const newVal = value === 'null' ? null : parseInt(value, 10);
            updateTask({ completionPercentage: newVal });
            if (newVal === 100 && isSelected) {
                setSelectedTaskId(null);
            }
        },
        [updateTask, isSelected, setSelectedTaskId]
    );


    // Task Interaction Handlers
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent selection if clicking on interactive elements within the item
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, [role="menu"], [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]') || isDragging) {
            return;
        }
        setSelectedTaskId(id => (id === task.id ? null : task.id));
    }, [setSelectedTaskId, task.id, isDragging]);

    // --- Handlers for Interactions ---
    const handleProgressChange = useCallback((checked: boolean | 'indeterminate') => {
        // Map checkbox state to completion percentage
        const newPercentage = checked === true ? 100 : null; // Simple toggle for now
        updateTask({ completionPercentage: newPercentage });
        if (newPercentage === 100 && isSelected) {
            setSelectedTaskId(null); // Deselect if completed via checkbox
        }
    }, [updateTask, isSelected, setSelectedTaskId]);

    const handleDateSelect = useCallback((date: Date | undefined) => {
        const newDueDate = date ? startOfDay(date).getTime() : null;
        updateTask({ dueDate: newDueDate });
        setIsDatePickerOpen(false); // Close popover after selection
    }, [updateTask]);

    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({ priority: newPriority });
        // Dropdown closes automatically
    }, [updateTask]);

    const handleListChange = useCallback((newList: string) => {
        updateTask({ list: newList });
        // Dropdown closes automatically
    }, [updateTask]);

    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        const newTaskData: Partial<Task> = {
            ...task, id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: `${task.title} (Copy)`, order: task.order + 0.01,
            createdAt: now, updatedAt: now, completed: false, completedAt: null,
            // Explicitly copy percentage, let atom handle derived state
            completionPercentage: task.completionPercentage
        };
        delete newTaskData.groupCategory; // Atom will derive this

        setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            const newTasks = [...prev];
            if (index !== -1) newTasks.splice(index + 1, 0, newTaskData as Task);
            else newTasks.push(newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!);
        // Dropdown closes automatically
    }, [task, setTasks, setSelectedTaskId]);

    const confirmDeleteTask = useCallback(() => {
        updateTask({ list: 'Trash', completionPercentage: null }); // Move to trash, reset progress
        if (isSelected) {
            setSelectedTaskId(null);
        }
        // Dialog closes automatically via AlertDialogAction/AlertDialogCancel
    }, [updateTask, isSelected, setSelectedTaskId]);

    // --- Memoized Display Values ---
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary/20 font-semibold rounded-[2px] px-0.5 mx-[-0.5px]",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);
    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        return searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w));
    }, [searchWords, task.content, task.title]);

    const baseClasses = cn(
        'task-item flex items-start px-2.5 py-2 border-b border-border/50 group relative min-h-[54px]', // Use theme border
        'transition-colors duration-150 ease-out',
        isOverlay // Special styling ONLY for the DragOverlay instance
            ? 'bg-card/90 backdrop-blur-md border rounded-lg shadow-strong' // Use card bg for overlay
            : isSelected && !isDragging
                ? 'bg-primary/10 border-b-primary/20' // Selected state
                : isTrashItem
                    ? 'bg-secondary/30 opacity-60 hover:bg-secondary/40' // Trashed
                    : isCompleted
                        ? 'bg-secondary/30 opacity-70 hover:bg-secondary/40' // Completed
                        : 'bg-transparent hover:bg-accent/50', // Default hover
        isDragging && !isOverlay ? 'opacity-40' : '', // Style original item when dragging
        isSortable ? 'cursor-grab' : 'cursor-pointer',
        isDragging ? 'cursor-grabbing' : '',
    );

    const titleClasses = cn(
        "text-sm text-foreground leading-snug block",
        (isCompleted || isTrashItem) && "line-through text-muted-foreground"
    );

    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    // Calculate checkbox state from percentage
    const checkboxState = useMemo(() => {
        if (task.completed) return true; // completed === true means 100%
        // Indeterminate for 20, 50, 80%
        if (task.completionPercentage && task.completionPercentage > 0 && task.completionPercentage < 100) {
            return 'indeterminate';
        }
        return false; // Not started (null or 0)
    }, [task.completed, task.completionPercentage]);

    // Progress Percentage Label (Subtle display next to title)
    const progressLabel = useMemo(() => {
        const p = task.completionPercentage;
        if (p && p > 0 && p < 100 && !isTrashItem && !isCompleted) {
            return `[${p}%]`;
        }
        return null;
    }, [task.completionPercentage, isTrashItem, isCompleted]);


    // Menu items for setting progress
    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName},
        {label: 'Halfway (50%)', value: 50, icon: 'circle-dot' as IconName},
        {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName},
    ], []);

    return (
        // AlertDialog provides context for the Trigger/Content
        <AlertDialog>
            <div
                ref={setNodeRef} style={style} className={baseClasses}
                {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                onClick={handleTaskClick} role={isSortable ? "listitem" : "button"} tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // Don't trigger selection if focus is inside menu/popover/dialog
                        if (!(e.target instanceof HTMLElement && e.target.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]'))) {
                            handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                        }
                    }
                }}
                aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}
            >
                {/* Progress Checkbox */}
                <div className="flex-shrink-0 mr-2.5 pt-[3px] pl-[1px]">
                    <Checkbox
                        id={`task-check-${task.id}`}
                        checked={checkboxState}
                        onCheckedChange={handleProgressChange}
                        disabled={isTrashItem}
                        aria-labelledby={`task-title-${task.id}`} // Link to title for context
                        className="w-4.5 h-4.5 rounded-full" // Circular checkbox
                    />
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0 pt-[1px] pb-[1px]">
                    {/* Title and Progress Label */}
                    <div className="flex items-baseline">
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                        {progressLabel && (
                            <span className="ml-1.5 text-[10px] text-primary font-medium select-none opacity-90 flex-shrink-0">
                                 {progressLabel}
                             </span>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight gap-y-0.5 min-h-[17px]">
                        {/* Priority Indicator */}
                        {!!task.priority && task.priority <= 4 && !isCompleted && !isTrashItem && (
                            <span className={cn("flex items-center", priorityMap[task.priority]?.iconColor)}
                                  title={`Priority ${priorityMap[task.priority]?.label}`}>
                                 <Icon name="flag" size={11} strokeWidth={2.5}/>
                             </span>
                        )}
                        {/* Due Date & Reschedule Button */}
                        {isValidDueDate && (
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "h-auto px-0.5 py-0 text-[11px] font-normal",
                                            "text-muted-foreground hover:text-foreground hover:bg-transparent",
                                            overdue && 'text-red-600 dark:text-red-500 font-medium',
                                            (isCompleted || isTrashItem) && 'line-through opacity-70 !text-muted-foreground',
                                            isTrashItem && '!cursor-not-allowed'
                                        )}
                                        title={formatDate(dueDate!)}
                                        disabled={isTrashItem || isCompleted}
                                    >
                                        <Icon name="calendar" size={11} className="mr-0.5 opacity-70"/>
                                        {formatRelativeDate(dueDate!)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dueDate ?? undefined}
                                        onSelect={handleDateSelect}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* List Name */}
                        {task.list && task.list !== 'Inbox' && (
                            <Badge variant="secondary" className={cn("font-normal px-1 py-0 text-[10px]", (isCompleted || isTrashItem) && 'opacity-70')} title={task.list}>
                                <Icon name={listIcon} size={10} className="mr-0.5 opacity-70 flex-shrink-0"/>
                                <span className="truncate max-w-[70px]">{task.list}</span>
                            </Badge>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <span className={cn("flex items-center space-x-1 flex-wrap gap-y-0.5", (isCompleted || isTrashItem) && 'opacity-70')}>
                                 {task.tags.slice(0, 2).map(tag => (
                                     <Badge key={tag} variant="outline" className="font-normal px-1 py-0 text-[10px]" title={tag}>
                                         #{tag}
                                     </Badge>
                                 ))}
                                {task.tags.length > 2 &&
                                    <span className="text-muted-foreground text-[10px] ml-0.5">+{task.tags.length - 2}</span>
                                }
                             </span>
                        )}

                        {/* Content Snippet Highlight */}
                        {showContentHighlight && (
                            <Highlighter {...highlighterProps}
                                         textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                         className={cn("block truncate text-[11px] text-muted-foreground/80 italic w-full mt-0.5", (isCompleted || isTrashItem) && 'line-through')}/>
                        )}
                    </div>
                </div>

                {/* More Actions Dropdown */}
                {!isOverlay && !isTrashItem && (
                    <div className="task-item-actions absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ease-in-out">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost" size="icon" icon="more-horizontal"
                                    className="h-6 w-6 text-muted-foreground hover:bg-accent"
                                    aria-label={`More actions for ${task.title || 'task'}`}
                                    disabled={isTrashItem}
                                    onClick={(e) => e.stopPropagation()} // Prevent task selection
                                />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                                {/* Progress Setting */}
                                <DropdownMenuLabel className="text-xs px-2 py-1 text-muted-foreground">
                                    Set Progress
                                </DropdownMenuLabel>
                                <DropdownMenuRadioGroup
                                    value={String(task.completionPercentage ?? 'null')}
                                    onValueChange={handleProgressSelect}
                                >
                                    {progressMenuItems.map((item) => (
                                        <DropdownMenuRadioItem
                                            key={item.label}
                                            value={String(item.value)}
                                            disabled={isCompleted && item.value !== 100}
                                            className="text-xs"
                                        >
                                            <Icon name={item.icon} size={13} className="mr-2 opacity-70" />
                                            {item.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparator />

                                {/* Date Setting via Popover */}
                                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <DropdownMenuItem disabled={isCompleted} onSelect={(e) => e.preventDefault()} className="text-xs">
                                            <Icon name="calendar-plus" size={13} className="mr-2 opacity-70" />
                                            Set Due Date...
                                        </DropdownMenuItem>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start" side="right" sideOffset={5}>
                                        <Calendar mode="single" selected={dueDate ?? undefined} onSelect={handleDateSelect} initialFocus />
                                    </PopoverContent>
                                </Popover>

                                <DropdownMenuSeparator />

                                {/* Priority Submenu */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={isCompleted} className="text-xs">
                                        <Icon name="flag" size={13} className="mr-2 opacity-70"/> Priority
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="w-40">
                                            <DropdownMenuRadioGroup value={String(task.priority ?? 'null')}>
                                                {[1, 2, 3, 4, null].map(p => (
                                                    <DropdownMenuRadioItem
                                                        key={p ?? 'none'}
                                                        value={String(p ?? 'null')}
                                                        onSelect={() => handlePriorityChange(p)}
                                                        className={cn("text-xs", p && priorityMap[p]?.iconColor)}
                                                    >
                                                        {p && <Icon name="flag" size={13} className="mr-1.5"/>}
                                                        {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>

                                {/* Move to List Submenu */}
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger disabled={isCompleted} className="text-xs">
                                        <Icon name="folder" size={13} className="mr-2 opacity-70"/> Move to List
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent className="w-40 max-h-48 overflow-y-auto styled-scrollbar-thin">
                                            <DropdownMenuRadioGroup value={task.list}>
                                                {availableLists.map(list => (
                                                    <DropdownMenuRadioItem
                                                        key={list} value={list}
                                                        onSelect={() => handleListChange(list)}
                                                        className="text-xs"
                                                    >
                                                        <Icon name={list === 'Inbox' ? 'inbox' : 'list'} size={13} className="mr-1.5 opacity-70"/> {list}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={isCompleted} onClick={handleDuplicateTask} className="text-xs">
                                    <Icon name="copy-plus" size={13} className="mr-2 opacity-70"/> Duplicate Task
                                </DropdownMenuItem>

                                {/* Delete Trigger */}
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                        className="!text-destructive hover:!bg-destructive/10 focus:!bg-destructive/10 focus:!text-destructive text-xs"
                                        onSelect={(e) => e.preventDefault()} // Prevent closing menu immediately
                                    >
                                        <Icon name="trash" size={13} className="mr-2 opacity-70"/> Move to Trash
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>

                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog Content */}
            <AlertDialogContent onClick={(e)=> e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Move Task to Trash?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to move "{task.title || 'Untitled Task'}" to the Trash? It can be restored later.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteTask} className={buttonVariants({ variant: "destructive" })}>
                        Move to Trash
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;