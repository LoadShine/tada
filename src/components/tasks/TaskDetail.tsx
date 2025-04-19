// src/components/tasks/TaskDetail.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom,} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {Task} from '@/types';
import {motion} from 'framer-motion'; // Keep for slide and dropdown
import {usePopper} from 'react-popper';
import {twMerge} from 'tailwind-merge';
import CustomDatePickerPopover from '../common/CustomDatePickerPopover';
import {IconName} from "@/components/common/IconMap.tsx";

// --- Custom Hook for Click Away --- (Keep as is)
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;
            // Also ignore clicks within react-day-picker popovers
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


// --- Reusable Dropdown Component (Memoized) ---
// Kept framer-motion for dropdown appearance
interface DropdownRenderProps {
    close: () => void;
}

interface DropdownProps {
    trigger: React.ReactElement & { props?: { onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void } };
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode);
    contentClassName?: string;
    placement?: import('@popperjs/core').Placement;
}

const Dropdown: React.FC<DropdownProps> = memo(({trigger, children, contentClassName, placement = 'bottom-start'}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const {styles, attributes} = usePopper(referenceElement, popperElement, {
        placement: placement, modifiers: [{name: 'offset', options: {offset: [0, 6]}}],
    });
    const close = useCallback(() => setIsOpen(false), []);
    useClickAway(dropdownRef, close);

    // Use cloneElement safely, checking if trigger is a valid element
    // Use cloneElement safely with forwardRef compatible props
    const TriggerElement = React.isValidElement(trigger) ? React.cloneElement(trigger, {
        ref: (node: HTMLButtonElement) => setReferenceElement(node),
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
            // 安全地访问和调用 onClick
            if (trigger.props && typeof trigger.props.onClick === 'function') {
                trigger.props.onClick(e);
            }
        },
        'aria-haspopup': 'true',
        'aria-expanded': isOpen,
    }) : null;

    return (
        <div ref={dropdownRef} className="relative inline-block w-full">
            {TriggerElement}
            {/*<AnimatePresence>*/}
            {isOpen && (
                <motion.div
                    ref={setPopperElement}
                    style={styles.popper} {...attributes.popper}
                    className={twMerge(
                        'z-30 min-w-[180px] overflow-hidden',
                        // Apply default glass style only if not a date picker (which has its own bg/border)
                        !contentClassName?.includes('date-picker-popover') && 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10',
                        contentClassName
                    )}
                    initial={{opacity: 0, scale: 0.95, y: -5}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.95, y: -5, transition: {duration: 0.1}}}
                    transition={{duration: 0.15, ease: 'easeOut'}}
                    onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                >
                    {typeof children === 'function' ? children({close}) : children}
                </motion.div>
            )}
            {/*</AnimatePresence>*/}
        </div>
    );
});
Dropdown.displayName = 'Dropdown';


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    const selectedTask = useAtomValue(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);

    // Local state for controlled inputs, derived from selectedTask
    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    const [localTags, setLocalTags] = useState('');

    // Refs
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isSavingRef = useRef(false); // To prevent concurrent saves

    // Sync local state with selectedTask atom
    useEffect(() => {
        // Clear any pending save when task changes
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        hasUnsavedChangesRef.current = false;
        isSavingRef.current = false;

        if (selectedTask) {
            setLocalTitle(selectedTask.title);
            setLocalContent(selectedTask.content || '');
            const initialDate = safeParseDate(selectedTask.dueDate);
            setLocalDueDate(initialDate && isValid(initialDate) ? initialDate : undefined);
            setLocalTags((selectedTask.tags ?? []).join(', '));

            // Auto-focus title input if it's empty (new task)
            if (selectedTask.title === '') {
                // Delay focus slightly to allow component mount/render
                const timer = setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 120);
                return () => clearTimeout(timer);
            }
        } else {
            // Reset local state if no task is selected
            setLocalTitle('');
            setLocalContent('');
            setLocalDueDate(undefined);
            setLocalTags('');
        }
    }, [selectedTask]); // Re-run only when the selectedTask object changes


    // Debounced save function
    const saveChanges = useCallback((updatedFields: Partial<Omit<Task, 'id' | 'groupCategory' | 'order' | 'createdAt'>> = {}) => {
        if (!selectedTask || isSavingRef.current) return; // Don't save if no task or already saving

        // Set flag immediately, actual save is debounced
        hasUnsavedChangesRef.current = true;

        // Clear existing timeout
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        // Debounce the save operation
        saveTimeoutRef.current = setTimeout(() => {
            if (!hasUnsavedChangesRef.current || !selectedTask) {
                isSavingRef.current = false; // Reset flag if no changes pending
                return;
            }
            isSavingRef.current = true; // Mark as saving

            // Prepare updated task data, merging incoming fields with current local state
            const finalUpdate: Partial<Task> = {
                title: (updatedFields.title !== undefined ? updatedFields.title : localTitle).trim() || "Untitled Task",
                content: updatedFields.content !== undefined ? updatedFields.content : localContent,
                dueDate: updatedFields.dueDate !== undefined
                    ? updatedFields.dueDate
                    : (localDueDate && isValid(localDueDate) ? localDueDate.getTime() : null),
                list: updatedFields.list !== undefined ? updatedFields.list : selectedTask.list,
                priority: updatedFields.priority !== undefined ? updatedFields.priority : selectedTask.priority,
                completed: updatedFields.completed !== undefined ? updatedFields.completed : selectedTask.completed,
                tags: updatedFields.tags !== undefined
                    ? updatedFields.tags
                    : localTags.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
                updatedAt: Date.now(),
            };

            // Check if anything actually changed compared to the *original* selectedTask state
            const needsServerUpdate =
                finalUpdate.title !== selectedTask.title ||
                finalUpdate.content !== (selectedTask.content || '') ||
                finalUpdate.completed !== selectedTask.completed ||
                finalUpdate.list !== selectedTask.list ||
                finalUpdate.priority !== selectedTask.priority ||
                finalUpdate.dueDate !== selectedTask.dueDate ||
                JSON.stringify((finalUpdate.tags ?? []).sort()) !== JSON.stringify((selectedTask.tags ?? []).sort());

            if (!needsServerUpdate) {
                console.log("Save skipped: No effective changes detected.");
                isSavingRef.current = false;
                hasUnsavedChangesRef.current = false; // Reset flag
                return;
            }

            console.log("Saving changes for task:", selectedTask.id, finalUpdate);
            setTasks((prevTasks) =>
                prevTasks.map((t) =>
                    t.id === selectedTask.id ? {...t, ...finalUpdate} : t
                )
            );

            isSavingRef.current = false; // Reset saving flag
            hasUnsavedChangesRef.current = false; // Reset change flag after successful save
        }, 400); // 400ms debounce time

        // Dependencies: Include local states that trigger save, and the selectedTask itself
    }, [selectedTask, setTasks, localTitle, localContent, localDueDate, localTags]);


    // --- Event Handlers ---
    const handleClose = useCallback(() => {
        // Trigger immediate save if changes are pending before closing
        if (hasUnsavedChangesRef.current) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            isSavingRef.current = false; // Allow save function to run
            saveChanges(); // Call save immediately
        }
        setSelectedTaskId(null);
    }, [setSelectedTaskId, saveChanges]);

    // Use local state setters and trigger save
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
        saveChanges();
    }, [saveChanges]);
    const handleContentChange = useCallback((newValue: string) => {
        setLocalContent(newValue);
        saveChanges();
    }, [saveChanges]);
    const handleTagInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTags(e.target.value);
        saveChanges();
    }, [saveChanges]);

    // Save on blur only if value actually changed from initial task state
    const handleTitleBlur = useCallback(() => {
        const trimmed = localTitle.trim();
        if (selectedTask && trimmed !== selectedTask.title) {
            saveChanges({title: trimmed || "Untitled Task"});
        }
    }, [localTitle, selectedTask, saveChanges]);
    const handleContentBlur = useCallback(() => {
        if (selectedTask && localContent !== (selectedTask.content || '')) {
            saveChanges({content: localContent});
        }
    }, [localContent, selectedTask, saveChanges]);
    const handleTagInputBlur = useCallback(() => {
        const newTags = localTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '').filter((v, i, a) => a.indexOf(v) === i);
        if (selectedTask && JSON.stringify(newTags.sort()) !== JSON.stringify((selectedTask.tags ?? []).sort())) {
            saveChanges({tags: newTags});
        }
    }, [localTags, selectedTask, saveChanges]);

    // Keyboard handlers
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleInputRef.current?.blur();
        } else if (e.key === 'Escape' && selectedTask) {
            setLocalTitle(selectedTask.title);
            titleInputRef.current?.blur();
        }
    }, [selectedTask]);
    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape' && selectedTask) {
            setLocalTags((selectedTask.tags ?? []).join(', '));
            (e.target as HTMLInputElement).blur();
        }
    }, [selectedTask]);

    // Direct actions (save immediately)
    const handleDatePickerSelect = useCallback((day: Date | undefined) => {
        const newDate = day && isValid(day) ? startOfDay(day) : undefined;
        setLocalDueDate(newDate);
        saveChanges({dueDate: newDate ? newDate.getTime() : null});
    }, [saveChanges]);
    const handleListChange = useCallback((newList: string, closeDropdown?: () => void) => {
        saveChanges({list: newList});
        closeDropdown?.();
    }, [saveChanges]);
    const handlePriorityChange = useCallback((newPriority: number | null, closeDropdown?: () => void) => {
        saveChanges({priority: newPriority});
        closeDropdown?.();
    }, [saveChanges]);
    const handleToggleComplete = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        saveChanges({completed: !selectedTask.completed});
    }, [selectedTask, saveChanges]);
    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            list: 'Trash',
            completed: false,
            updatedAt: Date.now()
        } : t));
        setSelectedTaskId(null);
    }, [selectedTask, setTasks, setSelectedTaskId]);
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        saveChanges({list: 'Inbox'});
    }, [selectedTask, saveChanges]);

    // --- Memos for Display Logic ---
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: {
            label: 'High',
            iconColor: 'text-red-500'
        },
        2: {label: 'Medium', iconColor: 'text-orange-500'},
        3: {label: 'Low', iconColor: 'text-blue-500'},
        4: {label: 'Lowest', iconColor: 'text-gray-500'},
    }), []);
    const isTrash = selectedTask?.list === 'Trash';
    const isCompleted = selectedTask?.completed && !isTrash;
    const overdue = useMemo(() => localDueDate && !isCompleted && isOverdue(localDueDate), [localDueDate, isCompleted]);

    if (!selectedTask) return null;

    // Display values should preferably come from the source `selectedTask`
    // unless being actively edited (which local state handles via controlled inputs)
    const displayPriority = selectedTask.priority;
    const displayList = selectedTask.list;

    return (
        // Keep slide animation for the whole detail pane
        <motion.div
            className={twMerge("border-l border-black/10 w-[420px] shrink-0 h-full flex flex-col shadow-xl z-20", "bg-glass-100 backdrop-blur-xl")}
            initial={{x: '100%'}} animate={{x: '0%'}} exit={{x: '100%'}}
            transition={{duration: 0.25, ease: [0.4, 0, 0.2, 1]}}
        >
            {/* Header */}
            <div
                className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100 backdrop-blur-lg">
                <div className="w-20 flex justify-start">
                    {isTrash ? (
                        <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore}
                                className="text-green-600 hover:bg-green-400/20 hover:text-green-700 text-xs px-1.5"> Restore </Button>
                    ) : (
                        <Button variant="ghost" size="icon" icon="trash" onClick={handleDelete}
                                className="text-red-600 hover:bg-red-400/20 hover:text-red-700 w-7 h-7"
                                aria-label="Move task to Trash"/>
                    )}
                </div>
                <div className="flex-1 text-center h-4">
                    {/* Removed saving indicator animation */}
                </div>
                <div className="w-20 flex justify-end">
                    <Button variant="ghost" size="icon" icon="x" onClick={handleClose} aria-label="Close task details"
                            className="text-muted-foreground hover:bg-black/15 w-7 h-7"/>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 styled-scrollbar flex flex-col">
                {/* Checkbox and Title */}
                <div className="flex items-start space-x-3 mb-4 flex-shrink-0">
                    <button
                        onClick={handleToggleComplete}
                        className={twMerge(
                            "mt-[5px] flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ease-apple appearance-none", // Only keep color transition
                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-100",
                            isCompleted ? 'bg-gray-400 border-gray-400 hover:bg-gray-500' : 'bg-white/40 border-gray-400 hover:border-primary/80 backdrop-blur-sm',
                            'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
                            'after:h-[10px] after:w-[5px] after:rotate-45 after:border-b-[2.5px] after:border-r-[2.5px] after:border-solid after:border-transparent after:transition-opacity after:duration-100',
                            isCompleted ? 'after:border-white after:opacity-100' : 'after:opacity-0',
                            isTrash && 'cursor-not-allowed opacity-50 !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400'
                        )}
                        aria-pressed={isCompleted}
                        disabled={isTrash}
                        aria-label={isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'}
                    />
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={localTitle} // Use local state
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight",
                            "placeholder:text-muted placeholder:font-normal",
                            (isCompleted || isTrash) && "line-through text-muted-foreground",
                            "task-detail-title-input" // Keep class for focus logic
                        )}
                        placeholder="Task title..."
                        disabled={isTrash}
                        aria-label="Task title"
                    />
                </div>

                {/* Metadata */}
                <div className="space-y-1.5 text-sm border-t border-b border-black/10 py-2.5 my-4 flex-shrink-0">
                    <MetaRow icon="calendar" label="Due Date" disabled={isTrash}>
                        {/* Use Dropdown for popover */}
                        <Dropdown
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate hover:bg-black/10 backdrop-blur-sm", localDueDate ? 'text-gray-700' : 'text-muted-foreground', overdue && 'text-red-600 font-medium', isTrash && 'text-muted line-through !bg-transparent')}
                                        disabled={isTrash}>
                                    {localDueDate ? formatRelativeDate(localDueDate) : 'Set date'}
                                </Button>
                            }
                            // Add specific class for date picker styling context
                            contentClassName="date-picker-popover p-0 border-0 shadow-none bg-transparent"
                            placement="bottom-end"
                        >
                            {(props: DropdownRenderProps) => (
                                <CustomDatePickerPopover
                                    initialDate={localDueDate}
                                    onSelect={handleDatePickerSelect}
                                    close={props.close}
                                />
                            )}
                        </Dropdown>
                    </MetaRow>
                    <MetaRow icon="list" label="List" disabled={isTrash}>
                        <Dropdown
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className="text-xs h-7 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm"
                                        disabled={isTrash}>
                                    {displayList}
                                </Button>
                            }
                            contentClassName="max-h-48 overflow-y-auto styled-scrollbar py-1"
                        >
                            {(props: DropdownRenderProps) => (
                                <>
                                    {userLists.filter(l => l !== 'Trash').map(list => (
                                        <button
                                            key={list}
                                            onClick={() => handleListChange(list, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple", displayList === list && "bg-primary/20 text-primary font-medium")}
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
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm", displayPriority ? priorityMap[displayPriority]?.iconColor : 'text-gray-700')}
                                        icon={displayPriority ? 'flag' : undefined} disabled={isTrash}>
                                    {displayPriority ? `P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'}
                                </Button>
                            }
                            contentClassName="py-1"
                        >
                            {(props: DropdownRenderProps) => (
                                <>
                                    {[1, 2, 3, 4, null].map(p => (
                                        <button
                                            key={p ?? 'none'}
                                            onClick={() => handlePriorityChange(p, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple flex items-center", displayPriority === p && "bg-primary/20 text-primary font-medium", p && priorityMap[p]?.iconColor)}
                                            role="menuitem"
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5 flex-shrink-0"/>}
                                            {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>
                    <MetaRow icon="tag" label="Tags" disabled={isTrash}>
                        <input
                            type="text"
                            value={localTags} // Use local state
                            onChange={handleTagInputChange}
                            onBlur={handleTagInputBlur}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="Add tags..."
                            className={twMerge(
                                "flex-1 text-xs h-7 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm w-full",
                                "hover:bg-white/15 focus:bg-white/20 backdrop-blur-sm transition-colors duration-150 ease-apple",
                                "placeholder:text-muted placeholder:font-normal",
                                "disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through disabled:placeholder:text-transparent"
                            )}
                            disabled={isTrash}
                            aria-label="Tags (comma-separated)"
                        />
                    </MetaRow>
                </div>
                {/* Content Editor */}
                <div className="task-detail-content-editor flex-1 min-h-[150px] flex flex-col mb-4">
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={localContent} // Use local state
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details here... Markdown is supported."
                        className={twMerge(
                            "!min-h-[150px] h-full text-sm",
                            (isCompleted || isTrash) && "opacity-70"
                        )}
                        readOnly={isTrash}
                    />
                </div>
            </div>
            {/* Footer */}
            <div
                className="px-4 py-2 border-t border-black/10 flex justify-end items-center flex-shrink-0 h-9 bg-glass-alt-200 backdrop-blur-lg">
                <div className="text-[11px] text-muted-foreground space-x-4">
                    <span>Created: {formatDateTime(selectedTask.createdAt)}</span>
                    <span>Updated: {formatDateTime(selectedTask.updatedAt)}</span>
                </div>
            </div>
        </motion.div>
    );
};

// --- Metadata Row Component (Memoized) ---
const MetaRow: React.FC<{
    icon: IconName;
    label: string;
    children: React.ReactNode,
    disabled?: boolean
}> = React.memo(({icon, label, children, disabled = false}) => (
    <div
        className={twMerge("flex items-center justify-between group min-h-[34px] px-1 rounded hover:bg-black/5 transition-colors duration-100 ease-apple", disabled && "opacity-60 pointer-events-none !bg-transparent")}>
        <span className="text-muted-foreground flex items-center text-xs font-medium w-24 flex-shrink-0">
            <Icon name={icon} size={14} className="mr-1.5 opacity-70"/>{label}
        </span>
        <div className="flex-1 text-right min-w-0">
            {children}
        </div>
    </div>
));
MetaRow.displayName = 'MetaRow';

export default TaskDetail; // Default export TaskDetail