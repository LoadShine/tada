// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
    selectedTaskAtom,
    tasksAtom,
    selectedTaskIdAtom,
    userListNamesAtom, // Use this for dropdown
    // userDefinedListsAtom // Use this for potentially creating lists if needed
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { formatDateTime, formatRelativeDate, isOverdue, safeParseDate } from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Base Datepicker CSS (styling overridden in index.css)
import { twMerge } from 'tailwind-merge';
import { usePopper } from 'react-popper';
import {IconName} from "@/components/common/IconMap.tsx";

// --- Custom Hook for Click Away ---
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;
            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains(event.target as Node)) {
                return;
            }
            handler(event); // Call the handler otherwise
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]); // Re-run if ref or handler changes
}

// --- Reusable Dropdown Component ---
interface DropdownRenderProps {
    close: () => void;
}
interface DropdownProps {
    trigger: React.ReactElement;
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode);
    contentClassName?: string;
    placement?: import('@popperjs/core').Placement; // Allow custom placement
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, contentClassName, placement = 'bottom-start' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref encompassing trigger and popper

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: placement,
        modifiers: [{ name: 'offset', options: { offset: [0, 6] } }], // Standard offset
    });

    const close = useCallback(() => setIsOpen(false), []);

    // Use the custom click away hook
    useClickAway(dropdownRef, close);

    // Clone the trigger to attach ref and toggle handler
    const TriggerElement = React.cloneElement(trigger, {
        ref: setReferenceElement,
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent immediate close from click away
            setIsOpen(prev => !prev);
            trigger.props.onClick?.(e); // Call original onClick if exists
        },
        'aria-haspopup': 'true', // Indicate it controls a popup
        'aria-expanded': isOpen,
    });

    return (
        <div ref={dropdownRef} className="relative inline-block w-full"> {/* Ensure div takes width */}
            {TriggerElement}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={setPopperElement}
                        style={styles.popper}
                        {...attributes.popper}
                        className={twMerge(
                            'z-30 min-w-[180px] rounded-md shadow-strong border border-black/5 overflow-hidden', // Standard dropdown styles
                            'bg-glass-100 backdrop-blur-md', // Apply glass effect
                            contentClassName
                        )}
                        initial={{ opacity: 0, scale: 0.95, y: -4 }} // Subtle entry
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.1 } }} // Subtle exit
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        // Prevent clicks inside the dropdown from closing it via click away
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Render children, passing close function if it's a render prop */}
                        {typeof children === 'function' ? children({ close }) : children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const MetaRow: React.FC<{ icon: IconName; label: string; children: React.ReactNode, disabled?: boolean }> = ({ icon, label, children, disabled=false }) => (
    <div className={twMerge("flex items-center justify-between group min-h-[32px] px-1", disabled && "opacity-60")}>
                            <span className="text-muted-foreground flex items-center text-xs font-medium w-20 flex-shrink-0">
                                <Icon name={icon} size={14} className="mr-1.5 opacity-70"/>{label}
                            </span>
        <div className={twMerge("flex-1 text-right", disabled && "pointer-events-none")}>
            {children}
        </div>
    </div>
);


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    // Global state
    const selectedTask = useAtomValue(selectedTaskAtom); // Read-only derived state
    const [, setTasks] = useAtom(tasksAtom); // Need setter
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom); // Need setter
    const userLists = useAtomValue(userListNamesAtom); // Read-only list names

    // Local state for inline editing, synced with selectedTask
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);
    const [tagInputValue, setTagInputValue] = useState('');

    // Refs
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const datePickerRef = useRef<DatePicker>(null);
    const isSavingRef = useRef(false); // Prevent rapid saves/race conditions
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounced save


    // Effect to synchronize local state when the selected task changes
    useEffect(() => {
        // Clear any pending saves when task changes
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        isSavingRef.current = false;

        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            setSelectedDueDate(safeParseDate(selectedTask.dueDate)); // Use safeParseDate
            setTagInputValue((selectedTask.tags ?? []).join(', ')); // Join tags for input
        } else {
            // Reset state if no task is selected (optional, depends on desired behavior)
            // setEditableTitle('');
            // setEditableContent('');
            // setSelectedDueDate(null);
            // setTagInputValue('');
        }
        // Focus title input when a task is selected (or changes)
        // Use timeout to ensure input is rendered and animation might be finishing
        // const timer = setTimeout(() => {
        //      if (selectedTask && titleInputRef.current) {
        //           titleInputRef.current.focus();
        //           titleInputRef.current.select(); // Select text for easy editing
        //      }
        // }, 50);
        // return () => clearTimeout(timer);

    }, [selectedTask]); // Re-run whenever the selected task object changes

    // --- Debounced Save Function ---
    // Use useCallback to memoize the save function
    const saveChanges = useCallback((updatedFields: Partial<Task>) => {
        if (!selectedTask || isSavingRef.current) return; // Exit if no task or already saving

        // Determine the final state based on current local edits + specific updates
        const currentTaskState: Task = {
            ...selectedTask,
            title: editableTitle.trim() || "Untitled Task", // Use local title state
            content: editableContent, // Use local content state
            tags: tagInputValue.split(',').map(t => t.trim()).filter(Boolean), // Use local tag state
            dueDate: selectedDueDate ? selectedDueDate.getTime() : null, // Use local date state
        };

        // Merge specific field updates (e.g., from priority/list change)
        const mergedFields = { ...currentTaskState, ...updatedFields };

        // --- Deep Equality Check ---
        let hasChanged = false;
        // Check simple fields
        const keysToCheck: (keyof Task)[] = ['title', 'content', 'completed', 'list', 'priority', 'dueDate'];
        for (const key of keysToCheck) {
            if (mergedFields[key] !== selectedTask[key]) {
                // Special handling for dueDate (compare timestamps or null)
                if (key === 'dueDate') {
                    const oldDate = selectedTask.dueDate ?? null;
                    const newDate = mergedFields.dueDate ?? null;
                    if (oldDate !== newDate) {
                        hasChanged = true;
                        break;
                    }
                } else {
                    hasChanged = true;
                    break;
                }
            }
        }
        // Check tags array (order doesn't matter)
        if (!hasChanged) {
            const oldTags = (selectedTask.tags ?? []).sort();
            const newTags = (mergedFields.tags ?? []).sort();
            if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
                hasChanged = true;
            }
        }
        // --- End Deep Equality Check ---


        if (!hasChanged) {
            // console.log("No changes detected, skipping save.");
            return; // Skip update if nothing actually changed
        }

        // console.log("Saving changes for task:", selectedTask.id, updatedFields);
        isSavingRef.current = true; // Set saving flag

        const finalUpdatedTask: Task = {
            ...mergedFields, // Use the merged fields
            updatedAt: Date.now(), // Always update timestamp
        };

        // Update the tasks atom
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) => (t.id === selectedTask.id ? finalUpdatedTask : t))
        );

        // Reset saving flag after a short delay (allows UI to potentially update)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            isSavingRef.current = false;
            // console.log("Save complete.");
        }, 200); // Short delay

    }, [selectedTask, setTasks, editableTitle, editableContent, selectedDueDate, tagInputValue]);


    // --- Event Handlers ---

    // Close Task Detail pane
    const handleClose = useCallback(() => {
        // Trigger a final save check on close, merging current local state
        saveChanges({}); // Pass empty object to check against local state
        setSelectedTaskId(null); // Clear selected task ID
    }, [setSelectedTaskId, saveChanges]);

    // Title Handlers
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableTitle(e.target.value);
    };
    const handleTitleBlur = () => {
        // Save only if the trimmed title actually differs from the original task title
        if (selectedTask && editableTitle.trim() !== selectedTask.title) {
            saveChanges({ title: editableTitle.trim() });
        }
    };
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission if wrapped
            titleInputRef.current?.blur(); // Blur triggers save
        } else if (e.key === 'Escape') {
            // Revert title to original and blur
            if (selectedTask) setEditableTitle(selectedTask.title);
            titleInputRef.current?.blur();
        }
    };

    // Content Handlers
    const handleContentChange = useCallback((newValue: string) => {
        setEditableContent(newValue);
        // Debounce save on content change (optional, blur might be sufficient)
        // if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        // saveTimeoutRef.current = setTimeout(() => {
        //     saveChanges({ content: newValue });
        // }, 1000); // e.g., save 1 second after typing stops
    }, []); // Empty dependency array as it captures `setEditableContent`

    const handleContentBlur = useCallback(() => {
        // Save on blur if content changed
        if (selectedTask && editableContent !== (selectedTask.content || '')) {
            saveChanges({ content: editableContent });
        }
    }, [saveChanges, selectedTask, editableContent]);


    // Date Picker Handler
    const handleDateChange = (date: Date | null) => {
        setSelectedDueDate(date); // Update local state immediately for UI feedback
        saveChanges({ dueDate: date ? date.getTime() : null }); // Trigger save with new timestamp or null
    };

    // List Change Handler (from Dropdown)
    const handleListChange = (newList: string, closeDropdown?: () => void) => {
        saveChanges({ list: newList });
        closeDropdown?.(); // Close the dropdown after selection
    };

    // Priority Change Handler (from Dropdown)
    const handlePriorityChange = (newPriority: number | null, closeDropdown?: () => void) => {
        saveChanges({ priority: newPriority });
        closeDropdown?.(); // Close the dropdown
    };

    // Tag Input Handlers
    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInputValue(e.target.value);
    };
    const handleTagInputBlur = () => {
        const newTags = tagInputValue.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== ''); // Remove empty tags
        const uniqueTags = Array.from(new Set(newTags)); // Ensure uniqueness
        // Trigger save only if the sorted tags array actually changed
        if (selectedTask && JSON.stringify(uniqueTags.sort()) !== JSON.stringify((selectedTask.tags ?? []).sort())) {
            saveChanges({ tags: uniqueTags });
        }
    };
    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur(); // Blur triggers save
        } else if (e.key === 'Escape') {
            // Revert tags to original and blur
            if (selectedTask) setTagInputValue((selectedTask.tags ?? []).join(', '));
            (e.target as HTMLInputElement).blur();
        }
    };

    // Delete/Trash Handler
    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) =>
                t.id === selectedTask.id
                    ? { ...t, list: 'Trash', completed: false, updatedAt: Date.now() } // Move to Trash, mark incomplete
                    : t
            )
        );
        setSelectedTaskId(null); // Deselect after moving to trash
    }, [selectedTask, setTasks, setSelectedTaskId]);

    // Restore Handler
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        // Restore to 'Inbox' or potentially a previous list if stored
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) =>
                t.id === selectedTask.id
                    ? { ...t, list: 'Inbox', updatedAt: Date.now() } // Restore to Inbox
                    : t
            )
        );
        // Keep task selected after restore to view it in its new list
        // Or deselect: setSelectedTaskId(null);
    }, [selectedTask, setTasks]);


    // Toggle Complete Handler
    const handleToggleComplete = () => {
        if (!selectedTask || selectedTask.list === 'Trash') return; // Don't toggle in trash
        saveChanges({ completed: !selectedTask.completed });
    };

    // Priority mapping for display
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: { label: 'High', iconColor: 'text-red-500' },
        2: { label: 'Medium', iconColor: 'text-orange-500' },
        3: { label: 'Low', iconColor: 'text-blue-500' },
        4: { label: 'Lowest', iconColor: 'text-gray-500' },
    }), []);


    // --- Render Logic ---

    // Placeholder when no task is selected
    if (!selectedTask) {
        return (
            <div className="border-l border-border-color/60 w-[380px] shrink-0 bg-canvas-alt h-full flex flex-col items-center justify-center text-muted p-10 text-center">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.3 }}>
                    <Icon name="edit" size={36} className="mb-4 text-gray-300 opacity-80"/>
                </motion.div>
                <p className="text-sm">Select a task to view details</p>
                <p className="text-xs mt-1 text-muted-foreground">or click '+' to add a new task.</p>
            </div>
        );
    }

    // Main Task Detail View
    return (
        <motion.div
            key={selectedTask.id} // Re-render trigger on task change
            className="border-l border-border-color/60 w-[380px] shrink-0 bg-canvas h-full flex flex-col shadow-lg z-10" // Use canvas bg
            // Animation for slide-in/out
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }} // Slightly adjusted spring
        >
            {/* Header: Subtle, shows breadcrumb/context */}
            <div className="px-3 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100/80 backdrop-blur-sm"> {/* Glass header */}
                <span className="text-xs text-muted-foreground truncate pr-4 font-medium">
                     {/* Show List / Title context */}
                    {selectedTask.list !== 'Inbox' && selectedTask.list !== 'Trash' ? `${selectedTask.list} / ` : ''}
                    {selectedTask.list === 'Trash' ? 'Trash / ' : ''}
                    <span className="text-gray-700">{selectedTask.title || 'Untitled Task'}</span>
                 </span>
                {/* Close Button - Use Icon Button */}
                <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close task details" className="text-muted-foreground hover:bg-black/5 w-7 h-7 -mr-1">
                    <Icon name="x" size={16} />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-4">

                {/* Title Input Row with Checkbox */}
                <div className="flex items-start space-x-2.5">
                    {/* Checkbox */}
                    <button
                        onClick={handleToggleComplete}
                        className={twMerge(
                            "mt-[3px] flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ease-in-out",
                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                            selectedTask.completed
                                ? 'bg-gray-300 border-gray-300 hover:bg-gray-400' // Completed style
                                : 'border-gray-400 hover:border-primary/80 bg-canvas', // Incomplete style
                            selectedTask.list === 'Trash' && 'cursor-not-allowed opacity-50 border-gray-300 hover:border-gray-300' // Disabled in trash
                        )}
                        aria-pressed={selectedTask.completed}
                        disabled={selectedTask.list === 'Trash'}
                        aria-label={selectedTask.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                    >
                        {/* Checkmark icon */}
                        {selectedTask.completed && <Icon name="check" size={10} className="text-white" strokeWidth={3}/>}
                    </button>
                    {/* Title Input */}
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={editableTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-base font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight", // Reset input styles
                            "placeholder:text-muted placeholder:font-normal",
                            selectedTask.completed && "line-through text-muted",
                            selectedTask.list === 'Trash' && "text-muted line-through", // Style title in trash
                            "task-detail-title-input" // Class for focusing
                        )}
                        placeholder="Task title..."
                        disabled={selectedTask.list === 'Trash'}
                        aria-label="Task title"
                    />
                </div>

                {/* Metadata Section - Refined layout */}
                <div className="space-y-1 text-sm border-t border-b border-border-color/60 py-2 my-3">
                    {/* Row Helper */}
                    {/* biome-ignore lint/suspicious/noExplicitAny: <explanation> */}


                    {/* Due Date */}
                    <MetaRow icon="calendar" label="Due Date" disabled={selectedTask.list === 'Trash'}>
                        <DatePicker
                            ref={datePickerRef}
                            selected={selectedDueDate}
                            onChange={handleDateChange}
                            customInput={
                                // Use a Button as the custom input for consistent styling
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-6 px-1.5 w-full text-left justify-start font-normal", // Base style
                                        selectedDueDate ? 'text-gray-700' : 'text-muted', // Color based on selection
                                        selectedDueDate && isOverdue(selectedDueDate) && !selectedTask.completed && 'text-red-600 font-medium', // Overdue style
                                        selectedTask.list === 'Trash' && 'text-muted line-through' // Trash style
                                    )}
                                    // Disable the button itself if in trash
                                    disabled={selectedTask.list === 'Trash'}
                                >
                                    {selectedDueDate ? formatRelativeDate(selectedDueDate) : 'Set date'}
                                </Button>
                            }
                            dateFormat="yyyy/MM/dd" // Adjust format as needed
                            placeholderText="Set due date"
                            isClearable={!!selectedDueDate && selectedTask.list !== 'Trash'} // Allow clear only if date exists and not in trash
                            clearButtonClassName="react-datepicker__close-icon" // Use custom styling in index.css
                            showPopperArrow={false}
                            popperPlacement="bottom-end"
                            shouldCloseOnSelect={true} // Close picker on date selection
                            todayButton="Today"
                            disabled={selectedTask.list === 'Trash'} // Disable date picker functionality
                            popperClassName="react-datepicker-popper custom-datepicker-popper"
                        />
                    </MetaRow>

                    {/* List Selector */}
                    <MetaRow icon="list" label="List" disabled={selectedTask.list === 'Trash'}>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through"
                                    disabled={selectedTask.list === 'Trash'}
                                    iconPosition="right"
                                    icon="chevron-down" // Add dropdown indicator
                                >
                                    {selectedTask.list || 'Inbox'}
                                </Button>
                            }
                            contentClassName="max-h-48 overflow-y-auto styled-scrollbar" // Scrollable content
                        >
                            {({ close }) => (
                                <div className="py-1">
                                    {/* Include 'Inbox' + all user-defined lists */}
                                    {['Inbox', ...userLists.filter(l => l !== 'Inbox')].map(list => (
                                        <button
                                            key={list}
                                            onClick={() => handleListChange(list, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/5",
                                                selectedTask.list === list && "bg-primary/10 text-primary font-medium" // Highlight selected
                                            )}
                                            role="menuitem"
                                        >
                                            {list}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Dropdown>
                    </MetaRow>

                    {/* Priority Selector */}
                    <MetaRow icon="flag" label="Priority" disabled={selectedTask.list === 'Trash'}>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-6 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through",
                                        selectedTask.priority ? priorityMap[selectedTask.priority]?.iconColor : 'text-gray-700' // Apply color based on priority
                                    )}
                                    icon={selectedTask.priority ? 'flag' : undefined} // Show flag icon if priority set
                                    iconPosition="left"
                                    disabled={selectedTask.list === 'Trash'}
                                >
                                    {selectedTask.priority ? `P${selectedTask.priority} ${priorityMap[selectedTask.priority]?.label}` : 'Set Priority'}
                                </Button>
                            }
                        >
                            {({ close }) => (
                                <div className="py-1">
                                    {[1, 2, 3, 4, null].map(p => ( // Include null for 'None'
                                        <button
                                            key={p ?? 'none'}
                                            onClick={() => handlePriorityChange(p, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/5 flex items-center",
                                                selectedTask.priority === p && "bg-primary/10 text-primary font-medium", // Highlight selected
                                                p && priorityMap[p]?.iconColor // Apply color to text/icon
                                            )}
                                            role="menuitem"
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5 flex-shrink-0" />}
                                            {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Dropdown>
                    </MetaRow>

                    {/* Tags Input */}
                    <MetaRow icon="tag" label="Tags" disabled={selectedTask.list === 'Trash'}>
                        {/* Use a standard input, styled like a ghost button when empty */}
                        <input
                            type="text"
                            value={tagInputValue}
                            onChange={handleTagInputChange}
                            onBlur={handleTagInputBlur}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="Add tags..."
                            className={twMerge(
                                "flex-1 text-xs h-6 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm",
                                "hover:bg-gray-100/70 focus:bg-gray-100", // Subtle hover/focus background
                                "placeholder:text-muted placeholder:font-normal",
                                "disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through disabled:placeholder:text-transparent" // Disabled styles
                            )}
                            disabled={selectedTask.list === 'Trash'}
                            aria-label="Tags (comma-separated)"
                        />
                    </MetaRow>
                </div>

                {/* Content Editor */}
                <div className="min-h-[150px] task-detail-content-editor"> {/* Added class hook */}
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={editableContent}
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details here...&#10;Markdown is supported." // Use &#10; for newline in placeholder
                        className={twMerge(
                            "min-h-[150px] h-full text-sm !bg-transparent !border-0 focus-within:!ring-0 focus-within:!border-0 shadow-none", // Transparent bg, no border/shadow
                            (selectedTask.list === 'Trash' || selectedTask.completed) && "opacity-70" // Dim if completed or trash
                        )}
                        readOnly={selectedTask.list === 'Trash'} // Readonly in trash
                    />
                </div>

                {/* Timestamps - Subtle */}
                <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border-color/60 pt-3 mt-auto text-right">
                    <p>Created: {formatDateTime(selectedTask.createdAt)}</p>
                    <p>Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                </div>
            </div>

            {/* Footer Actions - Use Icon Buttons */}
            <div className="px-3 py-2 border-t border-border-color/60 flex justify-between items-center flex-shrink-0 h-10 bg-canvas-alt/80"> {/* Slightly transparent alt bg */}
                {/* Conditional Delete/Restore Button */}
                {selectedTask.list === 'Trash' ? (
                    <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore} className="text-green-600 hover:bg-green-50 hover:text-green-700 text-xs px-2">
                        Restore
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" icon="trash" onClick={handleDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 w-7 h-7" aria-label="Move task to Trash" />
                )}

                {/* Saving Indicator (Optional) */}
                <AnimatePresence>
                    {isSavingRef.current && (
                        <motion.span
                            className="text-xs text-muted animate-pulse"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                        >
                            Saving...
                        </motion.span>
                    )}
                </AnimatePresence>

                {/* Spacer to push delete/restore left */}
                <div className="flex-1"></div>

                {/* Other actions could go here - e.g., share, copy link */}
                {/* <Button variant="ghost" size="icon" icon="share" className="text-muted-foreground hover:bg-black/5 w-7 h-7" aria-label="Share task" /> */}

            </div>
        </motion.div>
    );
};

export default TaskDetail;