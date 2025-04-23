// src/components/tasks/TaskItem.tsx
import React, { useCallback, useMemo, memo, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Keep ReactDOM for portals from TaskItem
import { Task, TaskGroupCategory } from '@/types';
import { formatDate, formatRelativeDate, isOverdue, safeParseDate, isValid, startOfDay } from '@/utils/dateUtils';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { searchTermAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from "@/components/common/Button";
import Highlighter from "react-highlight-words";
import { IconName } from "@/components/common/IconMap";
import MenuItem from "@/components/common/MenuItem";
import CustomDatePickerPopover from "@/components/common/CustomDatePickerPopover";
import { usePopper } from "react-popper";
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskItemMenu } from '@/context/TaskItemMenuContext';

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

// Helper/Priority Map (remain the same)
function generateContentSnippet(content: string, term: string, length: number = 35): string {
    if (!content || !term) return ''; const lowerContent = content.toLowerCase(); const searchWords = term.toLowerCase().split(' ').filter(Boolean); let firstMatchIndex = -1; let matchedWord = ''; for (const word of searchWords) { const index = lowerContent.indexOf(word); if (index !== -1) { firstMatchIndex = index; matchedWord = word; break; } } if (firstMatchIndex === -1) { return content.substring(0, length) + (content.length > length ? '...' : ''); } const start = Math.max(0, firstMatchIndex - Math.floor(length / 3)); const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3)); let snippet = content.substring(start, end); if (start > 0) snippet = '...' + snippet; if (end < content.length) snippet = snippet + '...'; return snippet;
}
const priorityMap: Record<number, { label: string; iconColor: string }> = { 1: { label: 'High', iconColor: 'text-red-500' }, 2: { label: 'Medium', iconColor: 'text-orange-500' }, 3: { label: 'Low', iconColor: 'text-blue-500' }, 4: { label: 'Lowest', iconColor: 'text-gray-500' }, };


const TaskItem: React.FC<TaskItemProps> = memo(({
                                                    task,
                                                    groupCategory,
                                                    isOverlay = false,
                                                    style: overlayStyle,
                                                    scrollContainerRef
                                                }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const { openItemId, setOpenItemId } = useTaskItemMenu();

    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);

    const [datePickerReferenceElement, setDatePickerReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [datePickerPopperElement, setDatePickerPopperElement] = useState<HTMLDivElement | null>(null);

    // --- Popper for TaskItem Date Picker (Keep FIXED strategy, Keep boundary) ---
    // This picker is triggered from the Actions menu, which is already portaled and fixed-positioned.
    const { styles: datePickerStyles, attributes: datePickerAttributes, update: updateDatePickerPopper } = usePopper(
        datePickerReferenceElement,
        datePickerPopperElement,
        {
            strategy: 'fixed', // <--- Keep fixed for portal rendered by TaskItem
            placement: 'bottom-start',
            modifiers: [
                { name: 'offset', options: { offset: [0, 8] } },
                // Keep boundary using the PASSED scrollContainerRef
                { name: 'preventOverflow', options: { padding: 8, boundary: scrollContainerRef?.current ?? undefined } },
                { name: 'flip', options: { padding: 8, boundary: scrollContainerRef?.current ?? undefined, fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] } }
            ],
        }
    );
    // ---

    // --- Effect to update TaskItem's Date Picker Popper (logic unchanged) ---
    useEffect(() => {
        if (isDatePickerOpen && scrollContainerRef?.current && updateDatePickerPopper) {
            const rafId = requestAnimationFrame(() => updateDatePickerPopper());
            return () => cancelAnimationFrame(rafId);
        }
    }, [isDatePickerOpen, updateDatePickerPopper, scrollContainerRef]);
    // ---

    // Refs for actions menu positioning and click away
    const actionsTriggerRef = useRef<HTMLButtonElement>(null);
    const actionsContentRef = useRef<HTMLDivElement>(null);
    const [actionsStyle, setActionsStyle] = useState<React.CSSProperties>({
        position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: 55,
    });

    // Memoized derived states (remain the same)
    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => task.completed && !isTrashItem, [task.completed, isTrashItem]);
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);

    // DND hook (remains the same)
    const { attributes, listeners, setNodeRef, transform, transition: dndTransition, isDragging } = useSortable({
        id: task.id, disabled: !isSortable, data: { task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory },
    });

    // Memoized style (remains the same)
    const style = useMemo(() => ({
        ...overlayStyle, transform: CSS.Transform.toString(transform),
        transition: isDragging ? (dndTransition || 'transform 50ms ease-apple') : (overlayStyle ? undefined : 'background-color 0.2s ease-apple, border-color 0.2s ease-apple'),
        ...(isDragging && !isOverlay && { opacity: 0.3, cursor: 'grabbing', backgroundColor: 'hsla(210, 40%, 98%, 0.5)', backdropFilter: 'blur(2px)', boxShadow: 'none', border: '1px dashed hsla(0, 0%, 0%, 0.1)'}),
        ...(isOverlay && { cursor: 'grabbing', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', zIndex: 1000 }),
        zIndex: isDragging || isOverlay ? 100 : (isSelected ? 2 : 1),
    }), [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);

    // Effect to close this item's menus if another item opens (logic unchanged)
    useEffect(() => {
        if (openItemId !== task.id) {
            if (isMoreActionsOpen) setIsMoreActionsOpen(false);
            if (isDatePickerOpen) setIsDatePickerOpen(false);
        }
    }, [openItemId, task.id, isMoreActionsOpen, isDatePickerOpen]);

    // Actions Menu Positioning Logic (remains the same)
    const calculateActionsPosition = useCallback(() => {
        if (!actionsTriggerRef.current || !actionsContentRef.current) return;
        const triggerRect = actionsTriggerRef.current.getBoundingClientRect();
        const contentRect = actionsContentRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;
        let top = triggerRect.bottom + margin / 2;
        let left = triggerRect.right - contentRect.width;
        if (top + contentRect.height + margin > viewportHeight) top = triggerRect.top - contentRect.height - margin / 2;
        if (left < margin) left = margin;
        if (left + contentRect.width + margin > viewportWidth) left = viewportWidth - contentRect.width - margin;
        top = Math.max(margin, top); left = Math.max(margin, left);
        setActionsStyle(prev => ({ ...prev, top: `${top}px`, left: `${left}px`, opacity: 1, pointerEvents: 'auto' }));
    }, []);

    useEffect(() => {
        if (isMoreActionsOpen) {
            requestAnimationFrame(() => calculateActionsPosition());
        } else {
            setActionsStyle(prev => ({ ...prev, opacity: 0, pointerEvents: 'none' }));
        }
    }, [isMoreActionsOpen, calculateActionsPosition]);

    useEffect(() => {
        if (!isMoreActionsOpen || !scrollContainerRef) return;
        const scrollElement = scrollContainerRef.current;
        const handleUpdate = () => calculateActionsPosition();
        let throttleTimeout: NodeJS.Timeout | null = null;
        const throttledHandler = () => { if (!throttleTimeout) { throttleTimeout = setTimeout(() => { handleUpdate(); throttleTimeout = null; }, 50); } };
        if (scrollElement) scrollElement.addEventListener('scroll', throttledHandler, { passive: true });
        window.addEventListener('resize', throttledHandler);
        return () => {
            if (scrollElement) scrollElement.removeEventListener('scroll', throttledHandler);
            window.removeEventListener('resize', throttledHandler);
            if (throttleTimeout) clearTimeout(throttleTimeout);
        };
    }, [isMoreActionsOpen, calculateActionsPosition, scrollContainerRef]);


    // Task Click (logic unchanged)
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a') ||
            actionsTriggerRef.current?.contains(target) ||
            datePickerReferenceElement?.contains(target) ||
            target.closest('.ignore-click-away') ||
            actionsContentRef.current?.contains(target)
        ) { return; }
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, datePickerReferenceElement, setOpenItemId]);

    // Direct Update Function (logic unchanged)
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt'>>) => {
        setTasks(prevTasks => prevTasks.map(t => { if (t.id === task.id) { return { ...t, ...updates, updatedAt: Date.now() }; } return t; }));
    }, [setTasks, task.id]);

    // Checkbox Handler (logic unchanged)
    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); const isChecked = e.target.checked; updateTask({ completed: isChecked });
        if (isChecked && isSelected) { setSelectedTaskId(null); }
        setOpenItemId(null);
    }, [updateTask, isSelected, setSelectedTaskId, setOpenItemId]);

    // Date Picker Handlers (logic unchanged - context handled)
    const openDatePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setDatePickerReferenceElement(event.currentTarget);
        setIsDatePickerOpen(true);
        setIsMoreActionsOpen(false);
        setOpenItemId(task.id);
    }, [setOpenItemId, task.id]);

    const closeDatePicker = useCallback(() => {
        setIsDatePickerOpen(false);
        setDatePickerReferenceElement(null);
        if (openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [setOpenItemId, openItemId, task.id]);

    const handleDateSelect = useCallback((date: Date | undefined) => {
        const newDueDate = date && isValid(date) ? startOfDay(date).getTime() : null;
        updateTask({ dueDate: newDueDate });
        closeDatePicker();
    }, [updateTask, closeDatePicker]);


    // More Actions Handlers (logic unchanged - context handled)
    const toggleActionsDropdown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const opening = !isMoreActionsOpen;
        setIsMoreActionsOpen(opening);
        setIsDatePickerOpen(false);
        setOpenItemId(opening ? task.id : null);
    }, [isMoreActionsOpen, setOpenItemId, task.id]);

    const closeActionsDropdown = useCallback(() => {
        setIsMoreActionsOpen(false);
        if (openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [setOpenItemId, openItemId, task.id]);

    const handleSetDueDateClickFromDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setDatePickerReferenceElement(e.currentTarget);
        setIsDatePickerOpen(true);
        setOpenItemId(task.id);
    };

    const handlePriorityChange = useCallback((newPriority: number | null) => { updateTask({ priority: newPriority }); closeActionsDropdown(); }, [updateTask, closeActionsDropdown]);
    const handleListChange = useCallback((newList: string) => { updateTask({ list: newList }); closeActionsDropdown(); }, [updateTask, closeActionsDropdown]);
    const handleDuplicateTask = useCallback(() => {
        const now = Date.now(); const newTask: Omit<Task, 'groupCategory'> = { ...JSON.parse(JSON.stringify(task)), id: `task-${now}-${Math.random().toString(16).slice(2)}`, title: `${task.title} (Copy)`, completed: false, completedAt: null, createdAt: now, updatedAt: now, order: task.order + 0.01, };
        setTasks(prev => { const index = prev.findIndex(t => t.id === task.id); const newTasks = [...prev]; if (index !== -1) { newTasks.splice(index + 1, 0, newTask as Task); } else { newTasks.push(newTask as Task); } return newTasks; });
        setSelectedTaskId(newTask.id);
        closeActionsDropdown();
    }, [task, setTasks, setSelectedTaskId, closeActionsDropdown]);
    const handleDeleteTask = useCallback(() => {
        updateTask({ list: 'Trash', completed: false });
        if (isSelected) { setSelectedTaskId(null); }
        closeActionsDropdown();
    }, [task.id, updateTask, isSelected, setSelectedTaskId, closeActionsDropdown]);


    // Click Away for Actions Dropdown (logic unchanged)
    useEffect(() => {
        if (!isMoreActionsOpen) return;
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            const isClickInsideTrigger = actionsTriggerRef.current?.contains(target);
            const isClickInsideContent = actionsContentRef.current?.contains(target);
            const isClickInsideDatePicker = datePickerPopperElement?.contains(target);

            if (!isClickInsideTrigger && !isClickInsideContent && !isClickInsideDatePicker) {
                closeActionsDropdown();
            }
        };
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMoreActionsOpen, closeActionsDropdown, datePickerPopperElement]);


    // Memoized values (remain the same)
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({ highlightClassName: "bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs", searchWords: searchWords, autoEscape: true, }), [searchWords]);
    const showContentHighlight = useMemo(() => { if (searchWords.length === 0 || !task.content?.trim()) return false; const lc = task.content.toLowerCase(); const lt = task.title.toLowerCase(); return searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w)); }, [searchWords, task.content, task.title]);
    const baseClasses = useMemo(() => twMerge( 'task-item flex items-start px-2.5 py-2 border-b border-black/10 group relative min-h-[52px]', isOverlay ? 'bg-glass-100 backdrop-blur-lg border rounded-md shadow-strong' : isSelected && !isDragging ? 'bg-primary/20 backdrop-blur-sm' : isTrashItem ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10' : isCompleted ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10' : 'bg-transparent hover:bg-black/[.05] hover:backdrop-blur-sm', isDragging || isOverlay ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-pointer'), ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);
    const checkboxClasses = useMemo(() => twMerge( "h-4 w-4 rounded border-2 transition-colors duration-30 ease-apple cursor-pointer appearance-none", "focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 focus:ring-offset-current/50 focus:outline-none", 'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-[60%]', 'after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-solid after:border-transparent after:transition-opacity after:duration-100', task.completed ? 'bg-gray-300 border-gray-300 hover:bg-gray-400 hover:border-gray-400 after:border-white after:opacity-100' : 'bg-white/30 border-gray-400/80 hover:border-primary/60 backdrop-blur-sm after:opacity-0', isTrashItem && 'opacity-50 cursor-not-allowed !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400' ), [task.completed, isTrashItem]);
    const titleClasses = useMemo(() => twMerge( "text-sm text-gray-800 leading-snug block", (isCompleted || isTrashItem) && "line-through text-muted-foreground" ), [isCompleted, isTrashItem]);
    const dragHandleClasses = useMemo(() => twMerge( "text-muted cursor-grab p-1 -ml-1 opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 focus-visible:opacity-80", "transition-opacity duration-30 ease-apple outline-none rounded focus-visible:ring-1 focus-visible:ring-primary/50", isDragging && "opacity-50 cursor-grabbing" ), [isDragging]);
    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const actionsMenuClasses = useMemo(() => twMerge( 'ignore-click-away min-w-[180px] overflow-hidden py-1 w-48', 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10' ), []);

    // --- Render ---
    return (
        <div
            ref={setNodeRef} style={style} className={baseClasses} onClick={handleTaskClick}
            role="button" tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>); } }}
            aria-selected={isSelected} aria-label={`Task: ${task.title || 'Untitled'}${task.completed ? ' (Completed)' : ''}`}
        >
            {/* Drag Handle */}
            <div className="flex-shrink-0 h-full flex items-center mr-2 self-stretch">
                {isSortable ? ( <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className={dragHandleClasses} aria-label="Drag task to reorder" tabIndex={-1}> <Icon name="grip-vertical" size={15} strokeWidth={2}/> </button>
                ) : ( <div className="w-[27px]" aria-hidden="true"></div> )}
            </div>

            {/* Checkbox */}
            <div className="flex-shrink-0 mr-2.5 pt-[3px]">
                <input type="checkbox" id={`task-checkbox-${task.id}`} checked={task.completed} onChange={handleCheckboxChange} onClick={(e) => e.stopPropagation()} className={checkboxClasses} aria-labelledby={`task-title-${task.id}`} disabled={isTrashItem} tabIndex={0}/>
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only"> Complete task {task.title || 'Untitled'} </label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-[1px] pb-[1px]">
                <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'} id={`task-title-${task.id}`} className={titleClasses} />
                <div className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight gap-y-0.5 min-h-[17px]">
                    {/* Priority Indicator */}
                    {!!task.priority && task.priority <= 4 && !isCompleted && !isTrashItem && ( <span className={clsx("flex items-center", priorityMap[task.priority]?.iconColor )} title={`Priority ${priorityMap[task.priority]?.label}`}> <Icon name="flag" size={11} strokeWidth={2.5}/> </span> )}
                    {/* Due Date & Reschedule Button */}
                    {isValidDueDate && (
                        <span className="flex items-center task-item-reschedule">
                            <span className={clsx('whitespace-nowrap', overdue && 'text-red-600 font-medium', (isCompleted || isTrashItem) && 'line-through opacity-70')} title={formatDate(dueDate!)}>
                                <Icon name="calendar" size={11} className="mr-0.5 opacity-70"/> {formatRelativeDate(dueDate!)}
                            </span>
                            {overdue && !isOverlay && !isCompleted && !isTrashItem && (
                                <button
                                    className="ml-1 p-0.5 rounded hover:bg-red-500/15 focus-visible:ring-1 focus-visible:ring-red-400 outline-none ignore-click-away"
                                    onClick={openDatePicker} // This still triggers the portaled date picker
                                    aria-label="Reschedule task" title="Reschedule"
                                >
                                    <Icon name="calendar-plus" size={12} className="text-red-500 opacity-70 group-hover/task-item-reschedule:opacity-100" />
                                </button>
                            )}
                        </span>
                    )}
                    {/* List Name */}
                    {task.list && task.list !== 'Inbox' && ( <span className={clsx("flex items-center whitespace-nowrap bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through opacity-70')} title={task.list}> <Icon name={listIcon} size={10} className="mr-0.5 opacity-70 flex-shrink-0"/> <span className="truncate">{task.list}</span> </span> )}
                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && ( <span className={clsx("flex items-center space-x-1 flex-wrap gap-y-0.5", (isCompleted || isTrashItem) && 'opacity-70')}> {task.tags.slice(0, 2).map(tag => ( <span key={tag} className={clsx("bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through')} title={tag}> #{tag} </span> ))} {task.tags.length > 2 && <span className="text-muted-foreground text-[10px]">+{task.tags.length - 2}</span>} </span> )}
                    {/* Content Snippet Highlight */}
                    {showContentHighlight && ( <Highlighter {...highlighterProps} textToHighlight={generateContentSnippet(task.content!, searchTerm)} className={clsx("block truncate text-[11px] text-muted italic w-full mt-0.5", (isCompleted || isTrashItem) && 'line-through')} /> )}
                </div>
            </div>

            {/* More Actions Button & Dropdown (Portal + Manual Fixed Positioning) */}
            {!isOverlay && !isCompleted && !isTrashItem && (
                <div className="task-item-actions absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-30 ease-apple" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} >
                    <Button
                        ref={actionsTriggerRef}
                        variant="ghost" size="icon" icon="more-horizontal"
                        className="h-6 w-6 text-muted-foreground hover:bg-black/15"
                        onClick={toggleActionsDropdown}
                        aria-label={`More actions for ${task.title || 'task'}`}
                        aria-haspopup="true"
                        aria-expanded={isMoreActionsOpen}
                        tabIndex={0}
                    />
                    {/* Portal for Actions Dropdown Content */}
                    {ReactDOM.createPortal(
                        <AnimatePresence>
                            {isMoreActionsOpen && (
                                <motion.div
                                    ref={actionsContentRef} style={actionsStyle} className={actionsMenuClasses}
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
                                >
                                    {/* Menu Items */}
                                    <div className="space-y-0.5">
                                        <button onClick={handleSetDueDateClickFromDropdown} className="w-full ignore-click-away">
                                            <MenuItem icon="calendar-plus"> Set Due Date... </MenuItem>
                                        </button>
                                        <hr className="my-1 border-black/10" />
                                        <div className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground font-medium">Priority</div>
                                        {[1, 2, 3, 4, null].map(p => ( <MenuItem key={p ?? 'none'} icon="flag" iconColor={p ? priorityMap[p]?.iconColor : undefined} selected={task.priority === p} onClick={() => handlePriorityChange(p)}> {p ? `P${p} ${priorityMap[p]?.label}` : 'None'} </MenuItem> ))}
                                        <hr className="my-1 border-black/10" />
                                        <div className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground font-medium">Move to List</div>
                                        <div className="max-h-32 overflow-y-auto styled-scrollbar px-0.5">
                                            {availableLists.map(list => ( <MenuItem key={list} icon={list === 'Inbox' ? 'inbox' : 'list'} selected={task.list === list} onClick={() => handleListChange(list)}> {list} </MenuItem> ))}
                                        </div>
                                        <hr className="my-1 border-black/10" />
                                        <MenuItem icon="copy-plus" onClick={handleDuplicateTask}> Duplicate Task </MenuItem>
                                        <MenuItem icon="trash" className="!text-red-600 hover:!bg-red-500/15" onClick={handleDeleteTask}> Move to Trash </MenuItem>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
                </div>
            )}

            {/* Portal for Date Picker Popover (triggered from WITHIN this item's actions) */}
            {isDatePickerOpen && datePickerReferenceElement && ReactDOM.createPortal(
                (
                    <div ref={setDatePickerPopperElement} style={{ ...datePickerStyles.popper, zIndex: 60 }} // Keep high zIndex
                         {...datePickerAttributes.popper} className="ignore-click-away date-picker-popover-wrapper">
                        {/* usePortal={false} is correct here because the portal is handled above */}
                        <CustomDatePickerPopover
                            usePortal={false}
                            initialDate={dueDate ?? undefined}
                            onSelect={handleDateSelect}
                            close={closeDatePicker}
                            triggerElement={datePickerReferenceElement}
                        />
                    </div>
                ), document.body
            )}

        </div>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;