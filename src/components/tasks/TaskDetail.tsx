// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
// Correct: selectedTaskAtom is READ-ONLY, so we only need the value, not the setter.
// We modify tasks through tasksAtom's setter.
import { selectedTaskAtom, tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue} from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Import datepicker CSS
import { twMerge } from 'tailwind-merge';

const TaskDetail: React.FC = () => {
    // selectedTaskAtom is read-only, useAtom only returns the value here effectively.
    // We don't need the second element of the tuple, but destructuring is common.
    // If you prefer, you can do: const selectedTask = useAtomValue(selectedTaskAtom);
    const [selectedTask] = useAtom(selectedTaskAtom);
    const [, setTasks] = useAtom(tasksAtom); // Get the setter for the main tasks array
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);

    // Local state for editing
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);

    // Refs
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false);

    // Sync local state when the selected task changes
    useEffect(() => {
        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            setSelectedDueDate(selectedTask.dueDate ? new Date(selectedTask.dueDate) : null);
        } else {
            setEditableTitle('');
            setEditableContent('');
            setSelectedDueDate(null);
        }
        if (editorBlurTimeoutRef.current) {
            clearTimeout(editorBlurTimeoutRef.current);
        }
        isSavingRef.current = false;
    }, [selectedTask]);

    // Function to save changes
    const saveChanges = useCallback(() => {
        if (!selectedTask || isSavingRef.current) return;

        const trimmedTitle = editableTitle.trim();
        const currentDueDateTimestamp = selectedTask.dueDate ?? null;
        const newDueDateTimestamp = selectedDueDate?.getTime() ?? null;

        if (trimmedTitle === selectedTask.title &&
            editableContent === (selectedTask.content || '') &&
            newDueDateTimestamp === currentDueDateTimestamp) {
            return; // No changes detected
        }

        isSavingRef.current = true;

        const updatedTask: Task = {
            ...selectedTask,
            title: trimmedTitle || "Untitled Task",
            content: editableContent,
            dueDate: newDueDateTimestamp,
            updatedAt: Date.now(),
        };

        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) => (t.id === selectedTask.id ? updatedTask : t))
        );

        // REMOVED: setSelectedTask(updatedTask); - Not needed and causes error

        setTimeout(() => {
            isSavingRef.current = false;
        }, 100);

    }, [selectedTask, editableTitle, editableContent, selectedDueDate, setTasks]);


    // --- Event Handlers ---

    const handleClose = useCallback(() => {
        saveChanges();
        setSelectedTaskId(null);
    }, [setSelectedTaskId, saveChanges]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableTitle(e.target.value);
    };

    const handleTitleBlur = () => {
        saveChanges();
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
        if (editorBlurTimeoutRef.current) {
            clearTimeout(editorBlurTimeoutRef.current);
        }
        editorBlurTimeoutRef.current = setTimeout(() => {
            saveChanges();
        }, 150);
    }, [saveChanges]);


    const handleDateChange = (date: Date | null) => {
        setSelectedDueDate(date); // Update local state first

        // Trigger save immediately after local state is updated
        // We need to use the 'date' directly here for the comparison and update
        // because the 'saveChanges' function relies on 'selectedDueDate' state, which might not be updated yet
        if (selectedTask && !isSavingRef.current) {
            const newDueDateTimestamp = date?.getTime() ?? null;
            // Check if date actually changed before saving
            if (newDueDateTimestamp !== (selectedTask.dueDate ?? null)) {
                isSavingRef.current = true;
                const updatedTask: Task = {
                    ...selectedTask,
                    dueDate: newDueDateTimestamp,
                    updatedAt: Date.now()
                };
                setTasks((prev: Task[]) => prev.map((t: Task) => t.id === selectedTask.id ? updatedTask : t));
                // REMOVED: setSelectedTask(updatedTask); - Not needed and causes error
                setTimeout(() => { isSavingRef.current = false; }, 100);
            }
        }
    };


    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        if (window.confirm(`Move "${selectedTask.title}" to Trash?`)) {
            setTasks((prevTasks: Task[]) =>
                prevTasks.map((t: Task) =>
                    t.id === selectedTask.id
                        ? { ...t, list: 'Trash', completed: false, updatedAt: Date.now() }
                        : t
                )
            );
            setSelectedTaskId(null);
        }
    }, [selectedTask, setTasks, setSelectedTaskId]);


    // --- Render Logic ---

    if (!selectedTask) {
        // ... (no changes in the placeholder)
        return (
            <div className="border-l border-gray-200/60 w-[400px] shrink-0 bg-canvas-alt h-full flex flex-col items-center justify-center text-muted p-10 text-center">
                <Icon name="edit" size={36} className="mb-4 text-gray-300"/>
                <p className="text-sm">Select a task to view details</p>
                <p className="text-xs mt-1">or click '+' to add a new task.</p>
            </div>
        );
    }

    return (
        <motion.div
            key={selectedTask.id}
            className="border-l border-gray-200/60 w-[400px] shrink-0 bg-canvas h-full flex flex-col shadow-lg z-10"
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200/60 flex justify-between items-center flex-shrink-0 h-10">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    aria-label="Close task details"
                    className="text-muted-foreground hover:bg-black/5 w-7 h-7"
                >
                    <Icon name="x" size={16} />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-4">
                {/* Title Input */}
                <div className="relative">
                    <input
                        type="checkbox"
                        checked={selectedTask.completed}
                        onChange={(e) => {
                            const isChecked = e.target.checked;
                            // Only update the tasksAtom
                            setTasks(prev => prev.map(t => t.id === selectedTask.id ? {...t, completed: isChecked, updatedAt: Date.now()} : t));
                            // REMOVED: setSelectedTask(...) - Not needed and causes error
                        }}
                        className="absolute top-1.5 left-0 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50 focus:ring-1"
                    />
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={editableTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-base font-medium pl-6 pr-2 py-1 border border-transparent rounded-md",
                            "hover:border-gray-200/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:bg-white outline-none",
                            "placeholder:text-muted placeholder:font-normal",
                            selectedTask.completed && "line-through text-muted"
                        )}
                        placeholder="Task title..."
                        disabled={selectedTask.completed}
                    />
                </div>

                {/* Metadata Section */}
                <div className="space-y-1.5 text-sm border-t border-b border-gray-200/60 py-3">
                    {/* Due Date Picker */}
                    <div className="flex items-center justify-between group h-7">
                        <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="calendar" size={14} className="mr-1.5 opacity-70"/>Due Date
                        </span>
                        <DatePicker
                            selected={selectedDueDate}
                            onChange={handleDateChange} // This now correctly triggers the update via setTasks
                            customInput={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-6 px-1.5",
                                        selectedDueDate ? 'text-gray-700' : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100',
                                        selectedDueDate && isOverdue(selectedDueDate) && !selectedTask.completed && 'text-red-600'
                                    )}
                                    icon={selectedDueDate ? undefined : "plus"}
                                    iconPosition="left"
                                >
                                    {selectedDueDate ? formatRelativeDate(selectedDueDate) : 'Set date'}
                                </Button>
                            }
                            dateFormat="yyyy/MM/dd"
                            placeholderText="Set due date"
                            isClearable={!!selectedDueDate}
                            clearButtonClassName="absolute right-1 top-1/2 transform -translate-y-1/2"
                            showPopperArrow={false}
                            popperPlacement="bottom-end"
                            todayButton="Today"
                        />
                    </div>

                    {/* List Selector (Example - needs implementation) */}
                    {/* ... other metadata ... */}
                    <div className="flex items-center justify-between group h-7">
                         <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                             <Icon name="list" size={14} className="mr-1.5 opacity-70"/>List
                         </span>
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5 text-gray-700">
                            {selectedTask.list || 'Inbox'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between group h-7">
                         <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="flag" size={14} className="mr-1.5 opacity-70"/>Priority
                        </span>
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5 text-gray-700">
                            {selectedTask.priority ? `Priority ${selectedTask.priority}` : 'Set Priority'}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between group h-7">
                         <span className="text-muted-foreground flex items-center text-xs font-medium w-20">
                            <Icon name="tag" size={14} className="mr-1.5 opacity-70"/>Tags
                         </span>
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100">
                            {selectedTask.tags?.join(', ') || '+ Add Tags'}
                        </Button>
                    </div>
                </div>

                {/* Content Editor */}
                <div>
                    <CodeMirrorEditor
                        value={editableContent}
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details... (Markdown supported)"
                        className="min-h-[150px] text-sm !bg-canvas !border-0 focus-within:!ring-0 focus-within:!border-0 shadow-none"
                        readOnly={selectedTask.completed}
                    />
                </div>

                {/* Timestamps */}
                <div className="text-[11px] text-muted space-y-0.5 border-t border-gray-200/60 pt-3 mt-auto">
                    <p>Created: {formatDateTime(selectedTask.createdAt)}</p>
                    <p>Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-3 py-2 border-t border-gray-200/60 flex justify-between items-center flex-shrink-0 h-10">
                <Button variant="ghost" size="sm" icon="trash" onClick={handleDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs">
                    Delete
                </Button>
                <span className="text-xs text-muted">
                     {/* Note: isSavingRef might flicker off slightly before UI updates */}
                    {/* A more robust solution might involve deriving saving state */}
                    {isSavingRef.current ? "Saving..." : ""}
                 </span>
            </div>
        </motion.div>
    );
};

export default TaskDetail;