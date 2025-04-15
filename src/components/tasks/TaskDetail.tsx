// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { selectedTaskAtom, tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor'; // Import ref type
import {formatDateTime, isOverdue} from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Keep datepicker CSS
import { twMerge } from "tailwind-merge";
import {SettingsRow} from "@/components/settings/SettingsModal.tsx";

const TaskDetail: React.FC = () => {
    const [selectedTask, ] = useAtom(selectedTaskAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);

    // Local state for edits, synced with selectedTaskAtom
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);
    // Add states for list, priority, tags if implementing selectors
    // const [selectedList, setSelectedList] = useState('');
    // const [selectedPriority, setSelectedPriority] = useState<number | undefined>();

    const editorRef = useRef<CodeMirrorEditorRef>(null); // Ref for CodeMirror focus
    const titleInputRef = useRef<HTMLInputElement>(null); // Ref for title input focus

    // Debounce mechanism
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const DEBOUNCE_DELAY = 750; // milliseconds

    // Sync local state when the selected task changes FROM Jotai atom
    useEffect(() => {
        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            setSelectedDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate) : null);
            // Sync other fields if needed
            // setSelectedList(selectedTask.list);
            // setSelectedPriority(selectedTask.priority);

            // Focus title input when a new task is selected and title is empty
            if (selectedTask.title === '' && titleInputRef.current) {
                titleInputRef.current.focus();
            }

        } else {
            // Reset when no task is selected
            setEditableTitle('');
            setEditableContent('');
            setSelectedDueDate(null);
        }
        // Clear any pending debounce save when task changes
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
    }, [selectedTask]);

    const handleClose = useCallback(() => {
        // Save any pending changes before closing
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            handleSaveChanges(true); // Force immediate save
        }
        setSelectedTaskId(null);
    }, [setSelectedTaskId, /* include handleSaveChanges if needed */]);

    // --- Save Logic ---
    const handleSaveChanges = useCallback((forceSave = false) => {
        if (!selectedTask) return;

        const trimmedTitle = editableTitle.trim();
        const hasChanges = trimmedTitle !== selectedTask.title ||
            editableContent !== (selectedTask.content || '') ||
            (selectedDueDate?.getTime() ?? null) !== selectedTask.dueDate;

        if (hasChanges || forceSave) {
            const updatedTask: Task = {
                ...selectedTask,
                title: trimmedTitle || "Untitled Task",
                content: editableContent,
                dueDate: selectedDueDate ? selectedDueDate.getTime() : null,
                updatedAt: Date.now(),
            };

            setTasks((prevTasks: Task[]) =>
                prevTasks.map((t: Task) => (t.id === selectedTask.id ? updatedTask : t))
            );
        }
    }, [selectedTask, editableTitle, editableContent, selectedDueDate, setTasks]);
    // const handleSaveChanges = useCallback((forceSave = false) => {
    //     if (!selectedTask) return;
    //
    //     const trimmedTitle = editableTitle.trim();
    //     const hasChanges = trimmedTitle !== selectedTask.title ||
    //         editableContent !== (selectedTask.content || '') ||
    //         (selectedDueDate?.getTime() ?? null) !== selectedTask.dueDate;
    //     // Add checks for list, priority, tags if changed
    //
    //     if (hasChanges || forceSave) {
    //         const updatedTask: Task = {
    //             ...selectedTask,
    //             title: trimmedTitle || "Untitled Task", // Ensure title is not empty
    //             content: editableContent,
    //             dueDate: selectedDueDate ? selectedDueDate.getTime() : null,
    //             // list: selectedList,
    //             // priority: selectedPriority,
    //             // tags: updatedTags,
    //             updatedAt: Date.now(),
    //         };
    //
    //         setTasks((prevTasks: Task[]) =>
    //             prevTasks.map((t: Task) => (t.id === selectedTask.id ? updatedTask : t))
    //         );
    //         // Update the internal selected task atom as well to reflect saved state immediately
    //         // This might cause a flicker if not handled carefully with useEffect dependencies
    //         setSelectedTaskInternal(updatedTask);
    //     }
    // }, [selectedTask, editableTitle, editableContent, selectedDueDate, setTasks, setSelectedTaskInternal]);

    // Debounced save function
    const debouncedSave = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            handleSaveChanges();
        }, DEBOUNCE_DELAY);
    }, [handleSaveChanges]);

    // --- Event Handlers ---
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableTitle(e.target.value);
        debouncedSave();
    };

    const handleContentChange = (newValue: string) => {
        setEditableContent(newValue);
        debouncedSave();
    };

    const handleDueDateChange = (date: Date | null) => {
        setSelectedDueDate(date);
        // Save immediately on date change (no debounce needed for this)
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); // Clear pending debounce
        handleSaveChanges(true); // Force immediate save after date change
    };

    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        // Use a more modern confirmation if possible, e.g., a custom modal
        if (window.confirm(`Move "${selectedTask.title || 'Untitled Task'}" to Trash?`)) {
            const now = Date.now();
            setTasks((prevTasks: Task[]) =>
                prevTasks.map((t: Task) =>
                    t.id === selectedTask.id
                        ? { ...t, list: 'Trash', completed: false, updatedAt: now, order: -1 } // Move to trash, mark incomplete, maybe set order to -1
                        : t
                )
            );
            handleClose(); // Close detail view after moving to trash
        }
    }, [selectedTask, setTasks, handleClose]);

    // Handle title input interaction
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            handleSaveChanges(true); // Save immediately
            editorRef.current?.focus(); // Focus content editor
        } else if (e.key === 'Escape') {
            // Revert title to last saved state
            if (selectedTask) setEditableTitle(selectedTask.title);
            e.currentTarget.blur(); // Remove focus
        }
    };

    // --- Render Logic ---

    // Placeholder when no task selected - refined style
    if (!selectedTask) {
        return (
            <div className="border-l border-gray-200/60 w-[400px] shrink-0 bg-canvas-alt h-full flex flex-col items-center justify-center text-muted p-10 text-center">
                <Icon name="edit" size={36} className="mb-4 text-gray-300" strokeWidth={1.5}/>
                <p className="text-sm text-gray-500">Select a task to view details</p>
                <p className="text-xs text-muted-foreground mt-1">or add a new one.</p>
            </div>
        );
    }

    // Datepicker Custom Input Button
    const DatePickerCustomInput = React.forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
        ({ value, onClick }, ref) => (
            <Button
                ref={ref}
                variant="ghost"
                size="sm"
                icon="calendar"
                className={twMerge(
                    "text-sm font-normal h-7",
                    value ? "text-gray-700" : "text-muted-foreground"
                )}
                onClick={onClick}
            >
                {value || 'Set Date'}
            </Button>
        ));
    DatePickerCustomInput.displayName = 'DatePickerCustomInput';

    return (
        <motion.div
            key={selectedTask.id} // Animate presence based on task ID
            className="border-l border-gray-200/60 w-[400px] shrink-0 bg-canvas h-full flex flex-col shadow-lg z-10 overflow-hidden" // Fixed width, subtle shadow
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35, duration: 0.3 }} // Faster spring animation
        >
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-200/70 flex justify-between items-center flex-shrink-0 h-11">
                {/* Breadcrumb/Metadata can go here */}
                <span className="text-xs text-muted-foreground">
                    {selectedTask.list || 'Inbox'} / {selectedTask.completed ? 'Completed' : 'Active'}
                 </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    aria-label="Close task details"
                    className="text-muted hover:bg-gray-500/10 -mr-1" // Adjust position
                >
                    <Icon name="x" size={18} />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-4">
                {/* Title Input - More integrated look */}
                <div className="relative">
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={editableTitle}
                        onChange={handleTitleChange}
                        onBlur={() => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); handleSaveChanges(true); }} // Save immediately on blur
                        onKeyDown={handleTitleKeyDown}
                        className="w-full text-lg font-semibold px-1 py-1 border border-transparent rounded-md hover:border-gray-200/80 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white outline-none transition-colors duration-150"
                        placeholder="Untitled Task"
                    />
                </div>

                {/* Metadata Section - Use SettingsRow concept */}
                <div className="space-y-0 text-sm border-t border-b border-gray-200/60 divide-y divide-gray-200/60 -mx-4 px-4">
                    {/* Due Date Picker */}
                    <SettingsRow label="Due Date" description={selectedDueDate && isOverdue(selectedDueDate) ? 'Overdue' : undefined}>
                        <DatePicker
                            selected={selectedDueDate}
                            onChange={handleDueDateChange}
                            customInput={<DatePickerCustomInput />}
                            dateFormat="eee, MMM d, yyyy" // More descriptive format
                            placeholderText="Set due date"
                            isClearable
                            clearButtonClassName="react-datepicker__close-icon" // Use built-in clear
                            showPopperArrow={false}
                            popperPlacement="bottom-end"
                            calendarClassName="!text-xs" // Smaller calendar text
                            wrapperClassName="w-auto" // Allow datepicker to size correctly
                        />
                    </SettingsRow>

                    {/* List Selector (Placeholder) */}
                    <SettingsRow label="List">
                        <Button variant="ghost" size="sm" icon="list" className="text-gray-700 font-normal h-7">
                            {selectedTask.list || 'Inbox'}
                        </Button>
                    </SettingsRow>

                    {/* Priority Selector (Placeholder) */}
                    <SettingsRow label="Priority">
                        <Button variant="ghost" size="sm" icon="flag" className="text-gray-700 font-normal h-7">
                            {selectedTask.priority ? `Priority ${selectedTask.priority}` : 'No Priority'}
                        </Button>
                    </SettingsRow>

                    {/* Tags Input (Placeholder) */}
                    <SettingsRow label="Tags">
                        <Button variant="ghost" size="sm" icon="tag" className="text-gray-700 font-normal h-7">
                            {selectedTask.tags?.join(', ') || 'Add Tags'}
                        </Button>
                    </SettingsRow>
                </div>

                {/* Content Editor */}
                <div className="pt-2">
                    <label htmlFor="task-content-editor" className="text-xs text-muted-foreground font-medium mb-1.5 block uppercase tracking-wider">
                        Notes
                    </label>
                    {/* Wrap editor for focus styling */}
                    <div className="border border-gray-200/80 rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-canvas transition-colors duration-150 min-h-[150px] flex flex-col">
                        <CodeMirrorEditor
                            editorRef={editorRef}
                            value={editableContent}
                            onChange={handleContentChange}
                            onBlur={() => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); handleSaveChanges(true); }} // Save immediately on blur
                            placeholder="Add notes, links, or details..."
                            className="flex-grow" // Ensure CM grows within the flex container
                        />
                    </div>
                </div>


                {/* Timestamps - More subtle */}
                <div className="text-[11px] text-muted space-y-0.5 border-t border-gray-200/60 pt-3 mt-5">
                    <p>Created: {formatDateTime(selectedTask.createdAt)}</p>
                    <p>Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-2 border-t border-gray-200/70 flex justify-between items-center flex-shrink-0 h-11 bg-canvas-alt">
                <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    onClick={handleDelete}
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-700"
                >
                    Delete
                </Button>
                {/* Indicate saving status subtly */}
                <span className="text-xs text-muted">
                     {/* {isSaving ? 'Saving...' : 'Changes saved'} */}
                    {/* Auto-save indication */}
                 </span>
            </div>
        </motion.div>
    );
};

export default TaskDetail;