// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai'; // Correct imports
import {
    selectedTaskAtom, // Read-only derived atom
    tasksAtom,        // Writable atom for the list
    selectedTaskIdAtom, // Writable atom for the ID
    userListNamesAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { formatDateTime, formatRelativeDate, isOverdue, safeParseDate, isValid, startOfDay } from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { usePopper } from 'react-popper';
import { twMerge } from 'tailwind-merge';
import CustomDatePickerPopover from '../common/CustomDatePickerPopover';
import { IconName } from "@/components/common/IconMap.tsx";

// --- Custom Hook for Click Away --- (Keep as is)
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;
            if (!el || el.contains(event.target as Node) || (event.target as Element).closest('.rdp')) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}

// --- Reusable Dropdown Component (Memoized) --- (Keep as is)
interface DropdownRenderProps { close: () => void; }
interface DropdownProps {
    trigger: React.ReactElement;
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode); // Definition is correct
    contentClassName?: string;
    placement?: import('@popperjs/core').Placement;
}
const Dropdown: React.FC<DropdownProps> = memo(({ trigger, children, contentClassName, placement = 'bottom-start' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: placement, modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
    });
    const close = useCallback(() => setIsOpen(false), []);
    useClickAway(dropdownRef, close);
    const TriggerElement = React.cloneElement(trigger, {
        ref: setReferenceElement, onClick: (e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setIsOpen(prev => !prev); trigger.props.onClick?.(e); },
        'aria-haspopup': 'true', 'aria-expanded': isOpen,
    });
    return (
        <div ref={dropdownRef} className="relative inline-block w-full">
            {TriggerElement}
            <AnimatePresence> {isOpen && ( <motion.div ref={setPopperElement} style={styles.popper} {...attributes.popper} className={twMerge('z-30 min-w-[180px] overflow-hidden', !contentClassName?.includes('date-picker-popover-content') && 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10', contentClassName )} initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.1 } }} transition={{ duration: 0.15, ease: 'easeOut' }} onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()} > {typeof children === 'function' ? children({ close }) : children} </motion.div> )} </AnimatePresence>
        </div>
    );
});
Dropdown.displayName = 'Dropdown';


// --- TaskDetail Component (Corrected Children Prop Type Usage) ---
const TaskDetail: React.FC = () => {
    // Use correct hooks: useAtomValue for reading, useSetAtom for setting
    const selectedTask = useAtomValue(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom); // Setter for the ID atom
    const userLists = useAtomValue(userListNamesAtom);

    // Local state remains the same
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [currentDueDate, setCurrentDueDate] = useState<Date | undefined>(undefined);
    const [tagInputValue, setTagInputValue] = useState('');

    // Refs remain the same
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const isSavingRef = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChanges = useRef(false);
    const initialTaskStateRef = useRef<Task | null>(null);

    // Effect remains the same
    useEffect(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        isSavingRef.current = false; hasUnsavedChanges.current = false;
        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            const initialDate = safeParseDate(selectedTask.dueDate);
            setCurrentDueDate(initialDate && isValid(initialDate) ? initialDate : undefined);
            setTagInputValue((selectedTask.tags ?? []).join(', '));
            initialTaskStateRef.current = selectedTask;
            if (selectedTask.title === '') {
                const timer = setTimeout(() => { titleInputRef.current?.focus(); }, 120);
                return () => clearTimeout(timer);
            }
        } else { initialTaskStateRef.current = null; }
    }, [selectedTask]);

    // SaveChanges callback remains the same
    const saveChanges = useCallback((updatedFields: Partial<Omit<Task, 'groupCategory' | 'order'>> = {}) => {
        const baseTaskState = initialTaskStateRef.current;
        if (!baseTaskState || isSavingRef.current) return;
        hasUnsavedChanges.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            if (!baseTaskState || !hasUnsavedChanges.current) { isSavingRef.current = false; return; }
            isSavingRef.current = true;
            const currentTitle = updatedFields.title !== undefined ? updatedFields.title : editableTitle.trim() || "Untitled Task";
            const currentContent = updatedFields.content !== undefined ? updatedFields.content : editableContent;
            const currentTags = updatedFields.tags !== undefined ? updatedFields.tags : tagInputValue.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
            const currentDueDateMs = updatedFields.dueDate !== undefined ? updatedFields.dueDate : (currentDueDate && isValid(currentDueDate) ? currentDueDate.getTime() : null);
            const potentialUpdate = { title: currentTitle, content: currentContent, tags: currentTags, dueDate: currentDueDateMs, list: updatedFields.list !== undefined ? updatedFields.list : baseTaskState.list, priority: updatedFields.priority !== undefined ? updatedFields.priority : baseTaskState.priority, completed: updatedFields.completed !== undefined ? updatedFields.completed : baseTaskState.completed };
            const needsServerUpdate = potentialUpdate.title !== baseTaskState.title || potentialUpdate.content !== (baseTaskState.content || '') || potentialUpdate.completed !== baseTaskState.completed || potentialUpdate.list !== baseTaskState.list || potentialUpdate.priority !== baseTaskState.priority || potentialUpdate.dueDate !== baseTaskState.dueDate || JSON.stringify((potentialUpdate.tags ?? []).sort()) !== JSON.stringify((baseTaskState.tags ?? []).sort());

            if (!needsServerUpdate) { isSavingRef.current = false; hasUnsavedChanges.current = false; console.log("Save skipped: No changes detected."); return; }

            console.log("Saving changes for task:", baseTaskState.id, potentialUpdate);
            const now = Date.now(); const finalUpdatedTaskPartial = { ...potentialUpdate, updatedAt: now };
            setTasks((prevTasks) => prevTasks.map((t) => t.id === baseTaskState.id ? { ...t, ...finalUpdatedTaskPartial } : t ));
            // Update ref after save
            initialTaskStateRef.current = { ...baseTaskState, ...finalUpdatedTaskPartial }; // Approximation is fine for ref
            isSavingRef.current = false; hasUnsavedChanges.current = false;
        }, 400);
    }, [setTasks, editableTitle, editableContent, currentDueDate, tagInputValue]);

    // Event Handlers remain the same logic, ensure correct setters are used
    const handleClose = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (hasUnsavedChanges.current && initialTaskStateRef.current) { isSavingRef.current = false; saveChanges({}); }
        setSelectedTaskId(null); // Use correct setter
    }, [setSelectedTaskId, saveChanges]);

    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setEditableTitle(e.target.value); saveChanges(); }, [saveChanges]);
    const handleTitleBlur = useCallback(() => { const baseTaskState = initialTaskStateRef.current; const trimmedTitle = editableTitle.trim(); if (baseTaskState && trimmedTitle !== baseTaskState.title) { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); isSavingRef.current = false; saveChanges({ title: trimmedTitle || "Untitled Task" }); } }, [editableTitle, saveChanges]);
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); titleInputRef.current?.blur(); } else if (e.key === 'Escape') { const baseTaskState = initialTaskStateRef.current; if (baseTaskState) setEditableTitle(baseTaskState.title ?? ''); hasUnsavedChanges.current = false; if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); titleInputRef.current?.blur(); } }, []);
    const handleContentChange = useCallback((newValue: string) => { setEditableContent(newValue); saveChanges(); }, [saveChanges]);
    const handleContentBlur = useCallback(() => { const baseTaskState = initialTaskStateRef.current; if (baseTaskState && editableContent !== (baseTaskState.content || '')) { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); isSavingRef.current = false; saveChanges({ content: editableContent }); } }, [saveChanges, editableContent]);
    const handleDatePickerSelect = useCallback((day: Date | undefined) => { const newDate = day && isValid(day) ? startOfDay(day) : undefined; setCurrentDueDate(newDate); saveChanges({ dueDate: newDate ? newDate.getTime() : null }); }, [saveChanges]);
    const handleListChange = useCallback((newList: string, closeDropdown?: () => void) => { saveChanges({ list: newList }); closeDropdown?.(); }, [saveChanges]);
    const handlePriorityChange = useCallback((newPriority: number | null, closeDropdown?: () => void) => { saveChanges({ priority: newPriority }); closeDropdown?.(); }, [saveChanges]);
    const handleTagInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setTagInputValue(e.target.value); saveChanges(); }, [saveChanges]);
    const handleTagInputBlur = useCallback(() => { const baseTaskState = initialTaskStateRef.current; const newTags = tagInputValue.split(',').map(tag => tag.trim()).filter(tag => tag !== '').filter((v, i, a) => a.indexOf(v) === i); if (baseTaskState && JSON.stringify(newTags.sort()) !== JSON.stringify((baseTaskState.tags ?? []).sort())) { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); isSavingRef.current = false; saveChanges({ tags: newTags }); } }, [tagInputValue, saveChanges]);
    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } else if (e.key === 'Escape') { const baseTaskState = initialTaskStateRef.current; if (baseTaskState) setTagInputValue((baseTaskState.tags ?? []).join(', ')); hasUnsavedChanges.current = false; if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); (e.target as HTMLInputElement).blur(); } }, []);
    const handleDelete = useCallback(() => { const taskToDelete = initialTaskStateRef.current; if (!taskToDelete) return; setTasks(prevTasks => prevTasks.map(t => t.id === taskToDelete.id ? { ...t, list: 'Trash', completed: false, updatedAt: Date.now() } : t)); setSelectedTaskId(null); }, [setTasks, setSelectedTaskId]); // Use correct setter
    const handleRestore = useCallback(() => { const taskToRestore = initialTaskStateRef.current; if (!taskToRestore || taskToRestore.list !== 'Trash') return; saveChanges({ list: 'Inbox' }); if(initialTaskStateRef.current) { initialTaskStateRef.current = { ...initialTaskStateRef.current, list: 'Inbox' }; } }, [saveChanges]);
    const handleToggleComplete = useCallback(() => { const taskToToggle = initialTaskStateRef.current; if (!taskToToggle || taskToToggle.list === 'Trash') return; saveChanges({ completed: !taskToToggle.completed }); if(initialTaskStateRef.current) { initialTaskStateRef.current = { ...initialTaskStateRef.current, completed: !initialTaskStateRef.current.completed }; } }, [saveChanges]);

    // --- Memos for Display Logic (Remains the same) ---
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({ 1: { label: 'High', iconColor: 'text-red-500' }, 2: { label: 'Medium', iconColor: 'text-orange-500' }, 3: { label: 'Low', iconColor: 'text-blue-500' }, 4: { label: 'Lowest', iconColor: 'text-gray-500' }, }), []);
    const isTrash = selectedTask?.list === 'Trash';
    const isCompleted = selectedTask?.completed && !isTrash;
    const overdue = useMemo(() => currentDueDate && !isCompleted && isOverdue(currentDueDate), [currentDueDate, isCompleted]);

    if (!selectedTask) return null; // Guard clause

    const displayPriority = initialTaskStateRef.current?.priority;
    const displayList = initialTaskStateRef.current?.list || 'Inbox';

    // --- JSX (Fix Dropdown children usage) ---
    return (
        <motion.div
            className={twMerge("border-l border-black/10 w-[420px] shrink-0 h-full flex flex-col shadow-xl z-20", "bg-glass-100 backdrop-blur-xl")}
            initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
            {/* Header */}
            {/* ... Header JSX ... */}
            <div className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100 backdrop-blur-lg">
                <div className="w-20 flex justify-start"> {isTrash ? (<Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore} className="text-green-600 hover:bg-green-400/20 hover:text-green-700 text-xs px-1.5"> Restore </Button>) : (<Button variant="ghost" size="icon" icon="trash" onClick={handleDelete} className="text-red-600 hover:bg-red-400/20 hover:text-red-700 w-7 h-7" aria-label="Move task to Trash" />)} </div>
                <div className="flex-1 text-center h-4"> <AnimatePresence> {(isSavingRef.current || (hasUnsavedChanges.current && !isSavingRef.current)) && (<motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="text-[10px] text-muted-foreground font-medium absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"> Saving... </motion.span>)} </AnimatePresence> </div>
                <div className="w-20 flex justify-end"> <Button variant="ghost" size="icon" icon="x" onClick={handleClose} aria-label="Close task details" className="text-muted-foreground hover:bg-black/15 w-7 h-7" /> </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 styled-scrollbar flex flex-col">
                {/* Checkbox and Title */}
                {/* ... Checkbox and Title JSX ... */}
                <div className="flex items-start space-x-3 mb-4 flex-shrink-0">
                    <button onClick={handleToggleComplete} className={twMerge( "mt-[5px] flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ease-apple appearance-none", "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-100", isCompleted ? 'bg-gray-400 border-gray-400 hover:bg-gray-500' : 'bg-white/40 border-gray-400 hover:border-primary/80 backdrop-blur-sm', 'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2', 'after:h-[10px] after:w-[5px] after:rotate-45 after:border-b-[2.5px] after:border-r-[2.5px] after:border-solid after:border-transparent after:transition-opacity after:duration-100', isCompleted ? 'after:border-white after:opacity-100' : 'after:opacity-0', isTrash && 'cursor-not-allowed opacity-50 !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400' )} aria-pressed={isCompleted} disabled={isTrash} aria-label={isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'} />
                    <input ref={titleInputRef} type="text" value={editableTitle} onChange={handleTitleChange} onBlur={handleTitleBlur} onKeyDown={handleTitleKeyDown} className={twMerge( "w-full text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight", "placeholder:text-muted placeholder:font-normal", (isCompleted || isTrash) && "line-through text-muted-foreground", "task-detail-title-input" )} placeholder="Task title..." disabled={isTrash} aria-label="Task title" />
                </div>

                {/* Metadata */}
                <div className="space-y-1.5 text-sm border-t border-b border-black/10 py-2.5 my-4 flex-shrink-0">
                    <MetaRow icon="calendar" label="Due Date" disabled={isTrash}>
                        <Dropdown
                            trigger={ /* ... trigger button ... */ <Button variant="ghost" size="sm" className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate hover:bg-black/10 backdrop-blur-sm", currentDueDate ? 'text-gray-700' : 'text-muted-foreground', overdue && 'text-red-600 font-medium', isTrash && 'text-muted line-through !bg-transparent')} disabled={isTrash}> {currentDueDate ? formatRelativeDate(currentDueDate) : 'Set date'} </Button> }
                            contentClassName="date-picker-popover-content"
                            placement="bottom-end"
                        >
                            {/* FIX: Explicitly pass the render prop function */}
                            {(props: DropdownRenderProps) => (
                                <CustomDatePickerPopover
                                    initialDate={currentDueDate}
                                    onSelect={handleDatePickerSelect}
                                    close={props.close}
                                />
                            )}
                        </Dropdown>
                    </MetaRow>
                    <MetaRow icon="list" label="List" disabled={isTrash}>
                        <Dropdown
                            trigger={ /* ... trigger button ... */ <Button variant="ghost" size="sm" className="text-xs h-7 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm" disabled={isTrash}> {displayList} </Button>}
                            contentClassName="max-h-48 overflow-y-auto styled-scrollbar py-1"
                        >
                            {/* FIX: Explicitly pass the render prop function */}
                            {(props: DropdownRenderProps) => (
                                <>
                                    {userLists.filter(l => l !== 'Trash').map(list => (
                                        <button
                                            key={list}
                                            onClick={() => handleListChange(list, props.close)}
                                            className={twMerge( "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple", displayList === list && "bg-primary/20 text-primary font-medium" )}
                                            role="menuitem"
                                        >
                                            {list}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>
                    <MetaRow icon="flag" label="Priority" disabled={isTrash}>
                        <Dropdown
                            trigger={ /* ... trigger button ... */ <Button variant="ghost" size="sm" className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm", displayPriority ? priorityMap[displayPriority]?.iconColor : 'text-gray-700')} icon={displayPriority ? 'flag' : undefined} disabled={isTrash}> {displayPriority ? `P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'} </Button>}
                            contentClassName="py-1"
                        >
                            {/* FIX: Explicitly pass the render prop function */}
                            {(props: DropdownRenderProps) => (
                                <>
                                    {[1, 2, 3, 4, null].map(p => (
                                        <button
                                            key={p ?? 'none'}
                                            onClick={() => handlePriorityChange(p, props.close)}
                                            className={twMerge( "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple flex items-center", displayPriority === p && "bg-primary/20 text-primary font-medium", p && priorityMap[p]?.iconColor )}
                                            role="menuitem"
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5 flex-shrink-0" />}
                                            {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>
                    <MetaRow icon="tag" label="Tags" disabled={isTrash}>
                        {/* ... Tags Input JSX ... */}
                        <input type="text" value={tagInputValue} onChange={handleTagInputChange} onBlur={handleTagInputBlur} onKeyDown={handleTagInputKeyDown} placeholder="Add tags..." className={twMerge( "flex-1 text-xs h-7 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm w-full", "hover:bg-white/15 focus:bg-white/20 backdrop-blur-sm transition-colors duration-150 ease-apple", "placeholder:text-muted placeholder:font-normal", "disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through disabled:placeholder:text-transparent" )} disabled={isTrash} aria-label="Tags (comma-separated)" />
                    </MetaRow>
                </div>
                {/* Content Editor */}
                {/* ... Content Editor JSX ... */}
                <div className="task-detail-content-editor flex-1 min-h-[150px] flex flex-col mb-4">
                    <CodeMirrorEditor ref={editorRef} value={editableContent} onChange={handleContentChange} onBlur={handleContentBlur} placeholder="Add notes, links, or details here... Markdown is supported." className={twMerge( "!min-h-[150px] h-full text-sm", (isCompleted || isTrash) && "opacity-70" )} readOnly={isTrash} />
                </div>
            </div>
            {/* Footer */}
            {/* ... Footer JSX ... */}
            <div className="px-4 py-2 border-t border-black/10 flex justify-end items-center flex-shrink-0 h-9 bg-glass-alt-200 backdrop-blur-lg">
                <div className="text-[11px] text-muted-foreground space-x-4"> <span>Created: {formatDateTime(selectedTask.createdAt)}</span> <span>Updated: {formatDateTime(selectedTask.updatedAt)}</span> </div>
            </div>
        </motion.div>
    );
};

// --- Metadata Row Component (Memoized) --- (Keep as is)
const MetaRow: React.FC<{ icon: IconName; label: string; children: React.ReactNode, disabled?: boolean }> = React.memo(({ icon, label, children, disabled=false }) => (
    <div className={twMerge( "flex items-center justify-between group min-h-[34px] px-1 rounded hover:bg-black/5 transition-colors duration-100 ease-apple", disabled && "opacity-60 pointer-events-none !bg-transparent" )}> <span className="text-muted-foreground flex items-center text-xs font-medium w-24 flex-shrink-0"> <Icon name={icon} size={14} className="mr-1.5 opacity-70"/>{label} </span> <div className="flex-1 text-right min-w-0"> {children} </div> </div>
));
MetaRow.displayName = 'MetaRow';

export default TaskDetail;