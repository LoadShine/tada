// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import {
    selectedTaskAtom,
    tasksAtom,
    selectedTaskIdAtom,
    userListNamesAtom
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { formatDateTime, formatRelativeDate, isOverdue } from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Datepicker CSS
import { twMerge } from 'tailwind-merge';
import { usePopper } from 'react-popper'; // For custom dropdowns

// Custom Hook to detect clicks outside a specified element
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(event.target as Node)) {
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
    }, [ref, handler]); // Re-run if ref or handler changes
}


// Simple Dropdown Component - Adjusted Props and Hook Usage
interface DropdownRenderProps {
    close: () => void;
}
interface DropdownProps {
    trigger: React.ReactElement;
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode); // Allow render prop
    contentClassName?: string;
}
const Dropdown: React.FC<DropdownProps> = ({ trigger, children, contentClassName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the entire dropdown including trigger+popper

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: 'bottom-start',
        modifiers: [{ name: 'offset', options: { offset: [0, 5] } }],
    });

    // const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);

    // Use the custom click away hook
    useClickAway(dropdownRef, close);

    // Clone the trigger element to attach ref and onClick handler
    const TriggerElement = React.cloneElement(trigger, {
        ref: setReferenceElement,
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent triggering click away listener on self
            setIsOpen(prev => !prev); // Toggle open state
            // Call original onClick if it exists
            trigger.props.onClick?.(e);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': isOpen,
    });

    return (
        // Wrap trigger and popper in a single element for the click away ref
        <div ref={dropdownRef} className="relative inline-block">
            {TriggerElement}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={setPopperElement}
                        style={styles.popper}
                        {...attributes.popper}
                        className={twMerge(
                            'z-30 min-w-[150px] rounded-md shadow-medium border border-black/5 overflow-hidden',
                            'bg-glass-darker backdrop-blur-md', // Glass effect
                            contentClassName
                        )}
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        // Removed stopPropagation here to allow internal clicks like button clicks
                    >
                        {/* Render children - checking if it's a function */}
                        {typeof children === 'function' ? children({ close }) : children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


// --- TaskDetail Component (Rest remains the same, only Dropdown usage changes slightly if needed) ---

const TaskDetail: React.FC = () => {
    const [selectedTask] = useAtom(selectedTaskAtom);
    const [, setTasks] = useAtom(tasksAtom); // Correct way to get setter
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [userLists] = useAtom(userListNamesAtom);

    // Local state for editing title, content, and temporary tag input
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);
    const [tagInputValue, setTagInputValue] = useState(''); // For the tag input field

    // Refs
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null); // Ref for CodeMirror instance
    const editorBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false); // Prevent rapid saves
    const datePickerRef = useRef<DatePicker>(null); // Ref for DatePicker

    // Sync local state when the selected task changes from outside
    useEffect(() => {
        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            setSelectedDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate) : null);
            setTagInputValue((selectedTask.tags ?? []).join(', ')); // Initialize tag input
        } else {
            // Reset state when no task is selected
            setEditableTitle('');
            setEditableContent('');
            setSelectedDueDate(null);
            setTagInputValue('');
        }
        // Clear any pending blur saves when task changes
        if (editorBlurTimeoutRef.current) {
            clearTimeout(editorBlurTimeoutRef.current);
        }
        isSavingRef.current = false; // Reset saving flag
    }, [selectedTask]);

    // Debounced Save Function
    const saveChanges = useCallback((updatedFields: Partial<Task>) => {
        if (!selectedTask || isSavingRef.current) return;

        // Check if there are actual changes
        let hasChanged = false;
        for (const key in updatedFields) {
            const typedKey = key as keyof Task;
            if (updatedFields[typedKey] !== selectedTask[typedKey]) {
                if (typedKey === 'tags') { // Deep compare tags array
                    const oldTags = (selectedTask.tags ?? []).sort();
                    const newTags = (updatedFields.tags ?? []).sort();
                    if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
                        hasChanged = true;
                        break;
                    }
                } else if (typedKey === 'dueDate') { // Compare timestamps
                    if ((updatedFields.dueDate ?? null) !== (selectedTask.dueDate ?? null)) {
                        hasChanged = true;
                        break;
                    }
                }
                else {
                    hasChanged = true;
                    break;
                }
            }
        }
        // Check local state title/content separately if not in updatedFields
        if (!('title' in updatedFields) && editableTitle.trim() !== selectedTask.title) hasChanged = true;
        if (!('content' in updatedFields) && editableContent !== (selectedTask.content || '')) hasChanged = true;


        if (!hasChanged) {
            // console.log("No changes detected, skipping save.");
            return;
        }

        console.log("Saving changes:", updatedFields);
        isSavingRef.current = true;

        const finalUpdatedTask: Task = {
            ...selectedTask,
            title: editableTitle.trim() || "Untitled Task", // Always use local state for title/content
            content: editableContent,
            ...updatedFields, // Apply specific field updates
            updatedAt: Date.now(),
        };

        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) => (t.id === selectedTask.id ? finalUpdatedTask : t))
        );

        setTimeout(() => {
            isSavingRef.current = false;
            // console.log("Save complete.");
        }, 150);

    }, [selectedTask, setTasks, editableTitle, editableContent]);


    // --- Event Handlers (Mostly unchanged) ---

    const handleClose = useCallback(() => {
        saveChanges({ // Ensure latest title/content/tags are potentially saved
            title: editableTitle.trim(),
            content: editableContent,
            tags: tagInputValue.split(',').map(t => t.trim()).filter(Boolean)
        });
        setSelectedTaskId(null);
    }, [setSelectedTaskId, saveChanges, editableTitle, editableContent, tagInputValue]); // Add tagInputValue

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableTitle(e.target.value);
    };

    const handleTitleBlur = () => {
        if (selectedTask && editableTitle.trim() !== selectedTask.title) {
            saveChanges({ title: editableTitle.trim() });
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleInputRef.current?.blur();
        } else if (e.key === 'Escape') {
            if (selectedTask) setEditableTitle(selectedTask.title);
            titleInputRef.current?.blur();
        }
    };

    const handleContentChange = useCallback((newValue: string) => {
        setEditableContent(newValue);
    }, []);

    const handleContentBlur = useCallback(() => {
        if (editorBlurTimeoutRef.current) clearTimeout(editorBlurTimeoutRef.current);
        editorBlurTimeoutRef.current = setTimeout(() => {
            if (selectedTask && editableContent !== (selectedTask.content || '')) {
                saveChanges({ content: editableContent });
            }
        }, 300);
    }, [saveChanges, selectedTask, editableContent]);

    const handleDateChange = (date: Date | null) => {
        setSelectedDueDate(date);
        saveChanges({ dueDate: date?.getTime() ?? null });
    };

    // Pass the `close` function from the render prop
    const handleListChange = (newList: string, closeDropdown?: () => void) => {
        saveChanges({ list: newList });
        closeDropdown?.(); // Call close if provided
    };

    const handlePriorityChange = (newPriority: number | null, closeDropdown?: () => void) => {
        saveChanges({ priority: newPriority });
        closeDropdown?.(); // Call close if provided
    };

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInputValue(e.target.value);
    };

    const handleTagInputBlur = () => {
        const newTags = tagInputValue.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== '');
        const uniqueTags = Array.from(new Set(newTags));
        // Only save if tags actually changed compared to task's current tags
        if (JSON.stringify(uniqueTags.sort()) !== JSON.stringify((selectedTask?.tags ?? []).sort())) {
            saveChanges({ tags: uniqueTags });
        }
    };
    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            setTagInputValue((selectedTask?.tags ?? []).join(', '));
            (e.target as HTMLInputElement).blur();
        }
    };


    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) =>
                t.id === selectedTask.id
                    ? { ...t, list: 'Trash', completed: false, updatedAt: Date.now() }
                    : t
            )
        );
        setSelectedTaskId(null);
    }, [selectedTask, setTasks, setSelectedTaskId]);

    const handleToggleComplete = () => {
        if (!selectedTask) return;
        saveChanges({ completed: !selectedTask.completed });
    };


    // --- Render Logic (Dropdown usage needs update) ---

    if (!selectedTask) {
        // Placeholder remains the same
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

    const priorityMap: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Lowest' };
    const priorityIconColor: Record<number, string> = { 1: 'text-red-500', 2: 'text-orange-500', 3: 'text-blue-500', 4: 'text-gray-400' };

    return (
        <motion.div
            key={selectedTask.id}
            className="border-l border-border-color/60 w-[380px] shrink-0 bg-canvas h-full flex flex-col shadow-lg z-10"
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0 h-10">
                 <span className="text-xs text-muted truncate pr-4">
                     {selectedTask.list !== 'Inbox' ? `${selectedTask.list} / ` : ''} {selectedTask.title || 'Untitled Task'}
                 </span>
                <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close task details" className="text-muted-foreground hover:bg-black/5 w-7 h-7">
                    <Icon name="x" size={16} />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-4">
                {/* Title Input Row */}
                <div className="flex items-start space-x-2">
                    <button
                        onClick={handleToggleComplete}
                        className={twMerge(
                            "mt-1 flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                            selectedTask.completed ? 'bg-primary border-primary hover:bg-primary-dark hover:border-primary-dark' : 'border-gray-400 hover:border-primary/80 bg-canvas',
                            selectedTask.list === 'Trash' && 'cursor-not-allowed opacity-50' // Disable checkbox in trash
                        )}
                        aria-pressed={selectedTask.completed}
                        disabled={selectedTask.list === 'Trash'} // Disable button in trash
                    >
                        {selectedTask.completed && <Icon name="check" size={10} className="text-white" strokeWidth={3}/>}
                    </button>
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={editableTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-base font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 -mt-0.5",
                            "placeholder:text-muted placeholder:font-normal",
                            selectedTask.completed && "line-through text-muted",
                            "task-detail-title-input" // Add class for focusing from TaskList
                        )}
                        placeholder="Task title..."
                        disabled={selectedTask.list === 'Trash'}
                    />
                </div>

                {/* Metadata Section */}
                <div className="space-y-1 text-sm border-t border-b border-border-color/60 py-2 my-3">
                    {/* Due Date */}
                    <div className="flex items-center justify-between group min-h-[32px] px-1">
                        <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="calendar" size={14} className="mr-1.5 opacity-70"/>Due Date
                        </span>
                        <DatePicker
                            ref={datePickerRef}
                            selected={selectedDueDate}
                            onChange={handleDateChange}
                            customInput={
                                <Button variant="ghost" size="sm" className={twMerge(
                                    "text-xs h-6 px-1.5 w-full text-left justify-start",
                                    selectedDueDate ? 'text-gray-700' : 'text-muted-foreground',
                                    selectedDueDate && isOverdue(selectedDueDate) && !selectedTask.completed && 'text-red-600 font-medium',
                                    selectedTask.list === 'Trash' && 'text-muted line-through' // Style if in trash
                                )}>
                                    {selectedDueDate ? formatRelativeDate(selectedDueDate) : 'Set date'}
                                </Button>
                            }
                            dateFormat="yyyy/MM/dd"
                            placeholderText="Set due date"
                            isClearable={!!selectedDueDate}
                            clearButtonClassName="react-datepicker__close-icon"
                            showPopperArrow={false}
                            popperPlacement="bottom-end"
                            shouldCloseOnSelect={true}
                            todayButton="Today"
                            disabled={selectedTask.list === 'Trash'}
                        />
                    </div>

                    {/* List Selector */}
                    <div className="flex items-center justify-between group min-h-[32px] px-1">
                        <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="list" size={14} className="mr-1.5 opacity-70"/>List
                        </span>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 px-1.5 w-full text-left justify-start text-gray-700 disabled:text-muted disabled:line-through"
                                    disabled={selectedTask.list === 'Trash'} // Disable trigger button in trash
                                >
                                    {selectedTask.list || 'Inbox'}
                                </Button>
                            }
                            contentClassName="max-h-40 overflow-y-auto styled-scrollbar"
                        >
                            {/* Use the render prop pattern correctly */}
                            {({ close }) => (
                                <div className="py-1">
                                    {['Inbox', ...userLists].map(list => (
                                        <button
                                            key={list}
                                            // Pass close to the handler
                                            onClick={() => handleListChange(list, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/5",
                                                selectedTask.list === list && "bg-primary/10 text-primary"
                                            )}
                                            // No need to disable here, trigger is disabled
                                        >
                                            {list}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Dropdown>
                    </div>

                    {/* Priority Selector */}
                    <div className="flex items-center justify-between group min-h-[32px] px-1">
                        <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="flag" size={14} className="mr-1.5 opacity-70"/>Priority
                        </span>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-6 px-1.5 w-full text-left justify-start disabled:text-muted disabled:line-through",
                                        selectedTask.priority ? priorityIconColor[selectedTask.priority] : 'text-gray-700'
                                    )}
                                    icon={selectedTask.priority ? 'flag' : undefined}
                                    iconPosition="left"
                                    disabled={selectedTask.list === 'Trash'} // Disable trigger button in trash
                                >
                                    {selectedTask.priority ? `Priority ${priorityMap[selectedTask.priority]}` : 'Set Priority'}
                                </Button>
                            }
                        >
                            {/* Use the render prop pattern correctly */}
                            {({ close }) => (
                                <div className="py-1">
                                    {[1, 2, 3, 4, null].map(p => (
                                        <button
                                            key={p ?? 'none'}
                                            // Pass close to the handler
                                            onClick={() => handlePriorityChange(p, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/5 flex items-center",
                                                selectedTask.priority === p && "bg-primary/10 text-primary",
                                                p && priorityIconColor[p]
                                            )}
                                            // No need to disable here
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5" />}
                                            {p ? `Priority ${priorityMap[p]}` : 'None'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Dropdown>
                    </div>

                    {/* Tags Input */}
                    <div className="flex items-center justify-between group min-h-[32px] px-1">
                        <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                           <Icon name="tag" size={14} className="mr-1.5 opacity-70"/>Tags
                        </span>
                        <input
                            type="text"
                            value={tagInputValue}
                            onChange={handleTagInputChange}
                            onBlur={handleTagInputBlur}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="+ Add Tags (comma-separated)"
                            className="flex-1 text-xs h-6 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm hover:bg-gray-100 focus:bg-gray-100 disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through"
                            disabled={selectedTask.list === 'Trash'}
                        />
                    </div>
                </div>

                {/* Content Editor */}
                <div className="min-h-[150px]">
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={editableContent}
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details... (Markdown supported)"
                        className={twMerge(
                            "min-h-[150px] text-sm !bg-canvas !border-0 focus-within:!ring-0 focus-within:!border-0 shadow-none",
                            selectedTask.list === 'Trash' && "opacity-70"
                        )}
                        readOnly={selectedTask.list === 'Trash'}
                    />
                </div>

                {/* Timestamps */}
                <div className="text-[11px] text-muted space-y-0.5 border-t border-border-color/60 pt-3 mt-auto">
                    <p>Created: {formatDateTime(selectedTask.createdAt)}</p>
                    <p>Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-3 py-2 border-t border-border-color/60 flex justify-between items-center flex-shrink-0 h-10 bg-canvas-alt">
                {/* Delete/Restore Logic (Simplified - Implement actual restore if needed) */}
                {selectedTask.list === 'Trash' ? (
                    <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => alert("Restore not implemented yet")} className="text-green-600 hover:bg-green-50 hover:text-green-700 text-xs">
                        Restore
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" icon="trash" onClick={handleDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs">
                        Delete
                    </Button>
                )}
                <span className="text-xs text-muted transition-opacity duration-200">
                    {isSavingRef.current ? "Saving..." : ""}
                </span>
            </div>
        </motion.div>
    );
};

export default TaskDetail;