// src/components/tasks/TaskDetail.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {Task} from '@/types';
import {motion} from 'framer-motion';
import {twMerge} from 'tailwind-merge';
import CustomDatePickerPopover from '../common/CustomDatePickerPopover';
import Dropdown from "@/components/common/Dropdown";
import MetaRow from "@/components/tasks/MetaRow";
import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";
import {ProgressIndicator} from './TaskItem'; // Use the enhanced indicator
import MenuItem from "@/components/common/MenuItem";
import {IconName} from "@/components/common/IconMap";

// --- Helper TagPill Component ---
interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

const TagPill: React.FC<TagPillProps> = React.memo(({ tag, onRemove, disabled }) => (
    <span
        className={twMerge(
            "inline-flex items-center bg-black/10 text-gray-700 rounded-sm pl-1.5 pr-1 py-0.5 text-xs mr-1 mb-1 group/pill whitespace-nowrap",
            "transition-colors duration-100 ease-apple",
            disabled ? "opacity-70 cursor-not-allowed" : "hover:bg-black/20"
        )}
        aria-label={`Tag: ${tag}${disabled ? ' (disabled)' : ''}`}
    >
        {tag}
        {!disabled && (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // Prevent container click
                    onRemove();
                }}
                className="ml-1 text-gray-500 hover:text-red-600 opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-0.5 flex items-center justify-center"
                aria-label={`Remove tag ${tag}`}
                tabIndex={-1} // Don't include in normal tab order
            >
                <Icon name="x" size={10} strokeWidth={3}/>
            </button>
        )}
    </span>
));
TagPill.displayName = 'TagPill';


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    // Hooks and state setup
    const [selectedTask] = useAtom(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    // localTags remains the string source of truth for saving
    const [localTags, setLocalTags] = useState('');
    // New state for the text being typed in the tag input
    const [tagInputValue, setTagInputValue] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);
    // Renamed ref specifically for the tag text input element
    const tagInputElementRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const latestTitleRef = useRef(localTitle);
    const latestContentRef = useRef(localContent);
    const latestTagsRef = useRef(localTags);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isMountedRef = useRef(true);

    // Mount/Unmount Effect
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
                // Optionally trigger one last save on unmount if changes exist
                // savePendingChanges(); // Be cautious with state updates on unmount
            }
        };
    }, []);

    // Debounced Save Logic
    const savePendingChanges = useCallback(() => {
        if (!selectedTask || !hasUnsavedChangesRef.current || !isMountedRef.current) {
            return;
        }
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        const currentTitle = latestTitleRef.current;
        const currentContent = latestContentRef.current;
        const currentDueDate = localDueDate;
        const currentTagsString = latestTagsRef.current; // Use the string ref

        const processedTitle = currentTitle.trim();
        const processedDueDate = currentDueDate && isValid(currentDueDate) ? currentDueDate.getTime() : null;
        // Parse tags just before saving to ensure clean data
        const processedTags = currentTagsString.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

        const originalTaskState = selectedTask;
        const changesToSave: Partial<Task> = {};

        if (processedTitle !== originalTaskState.title) changesToSave.title = processedTitle;
        if (currentContent !== (originalTaskState.content || '')) changesToSave.content = currentContent;
        const originalDueTime = originalTaskState.dueDate ?? null;
        if (processedDueDate !== originalDueTime) changesToSave.dueDate = processedDueDate;

        const originalTagsSorted = (originalTaskState.tags ?? []).slice().sort();
        const processedTagsSorted = processedTags.slice().sort();
        if (JSON.stringify(processedTagsSorted) !== JSON.stringify(originalTagsSorted)) changesToSave.tags = processedTags;

        if (Object.keys(changesToSave).length > 0) {
            changesToSave.updatedAt = Date.now();
            setTasks(prevTasks =>
                prevTasks.map((t) => {
                    if (t.id === originalTaskState.id) {
                        return {...t, ...changesToSave};
                    }
                    return t;
                })
            );
        }
        hasUnsavedChangesRef.current = false;

    }, [selectedTask, setTasks, localDueDate]);

    // Sync Local State from Atom
    useEffect(() => {
        if (selectedTask) {
            const isTitleFocused = titleInputRef.current === document.activeElement;
            const isTagsFocused = tagInputElementRef.current === document.activeElement; // Use new ref
            const isContentFocused = editorRef.current?.getView()?.hasFocus ?? false;

            if (!isTitleFocused) {
                setLocalTitle(selectedTask.title);
                latestTitleRef.current = selectedTask.title;
            }

            const taskContent = selectedTask.content || '';
            if (!isContentFocused) {
                setLocalContent(taskContent);
                latestContentRef.current = taskContent;
            }

            const taskDueDate = safeParseDate(selectedTask.dueDate);
            const validTaskDueDate = taskDueDate && isValid(taskDueDate) ? taskDueDate : undefined;
            setLocalDueDate(validTaskDueDate);

            const taskTagsString = (selectedTask.tags ?? []).join(', ');
            // Only reset localTags string if tag input isn't focused
            // Keep tagInputValue separate, reset it if needed
            if (!isTagsFocused) {
                setLocalTags(taskTagsString);
                latestTagsRef.current = taskTagsString;
                setTagInputValue(''); // Clear any leftover input when task changes externally
            }

            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }

            if (selectedTask.title === '' && !isTitleFocused && !isContentFocused && !isTagsFocused) {
                const timer = setTimeout(() => {
                    if (isMountedRef.current && titleInputRef.current) {
                        titleInputRef.current.focus();
                        titleInputRef.current.select();
                    }
                }, 350);
                return () => clearTimeout(timer);
            }

        } else {
            setLocalTitle('');
            latestTitleRef.current = '';
            setLocalContent('');
            latestContentRef.current = '';
            setLocalDueDate(undefined);
            setLocalTags('');
            latestTagsRef.current = '';
            setTagInputValue(''); // Clear tag input
            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            setIsDeleteConfirmOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask?.id]); // Keep dependency on selectedTask.id only

    // Update Refs on Local State Change (No change needed here)
    useEffect(() => {
        latestTitleRef.current = localTitle;
    }, [localTitle]);
    useEffect(() => {
        latestContentRef.current = localContent;
    }, [localContent]);
    useEffect(() => {
        latestTagsRef.current = localTags; // Keep tracking the string version for saving
    }, [localTags]);

    // Debounced Save Trigger (No change needed here)
    const triggerSave = useCallback(() => {
        if (!selectedTask || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            savePendingChanges();
        }, 600);
    }, [selectedTask, savePendingChanges]);

    // Direct Update Function (No change needed here)
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        if (!selectedTask || !isMountedRef.current) return;
        // Save any pending text/tag changes before applying direct updates
        if (hasUnsavedChangesRef.current) savePendingChanges();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        hasUnsavedChangesRef.current = false;

        setTasks(prevTasks => prevTasks.map(t => {
            if (t.id === selectedTask.id) {
                return {...t, ...updates, updatedAt: Date.now()};
            }
            return t;
        }));
    }, [selectedTask, setTasks, savePendingChanges]);

    // Event Handlers (Close, Title, Content, Date, List, Priority, Progress - mostly unchanged)
    const handleClose = useCallback(() => {
        savePendingChanges();
        setSelectedTaskId(null);
    }, [setSelectedTaskId, savePendingChanges]);
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
        triggerSave();
    }, [triggerSave]);
    const handleContentChange = useCallback((newValue: string) => {
        setLocalContent(newValue);
        triggerSave();
    }, [triggerSave]);
    const handleDatePickerSelect = useCallback((date: Date | undefined) => {
        const newDate = date && isValid(date) ? startOfDay(date) : undefined;
        setLocalDueDate(newDate);
        updateTask({dueDate: newDate ? newDate.getTime() : null});
    }, [updateTask]);
    const handleListChange = useCallback((newList: string, closeDropdown?: () => void) => {
        updateTask({list: newList});
        closeDropdown?.();
    }, [updateTask]);
    const handlePriorityChange = useCallback((newPriority: number | null, closeDropdown?: () => void) => {
        updateTask({priority: newPriority});
        closeDropdown?.();
    }, [updateTask]);
    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        const currentPercentage = selectedTask.completionPercentage ?? 0;
        let nextPercentage: number | null = null;
        if (currentPercentage === 0) nextPercentage = 20;
        else if (currentPercentage === 20) nextPercentage = 50;
        else if (currentPercentage === 50) nextPercentage = 80;
        else if (currentPercentage === 80) nextPercentage = 100;
        else if (currentPercentage === 100) nextPercentage = null;
        updateTask({completionPercentage: nextPercentage});
    }, [selectedTask, updateTask]);
    const handleProgressChange = useCallback((newPercentage: number | null, closeDropdown?: () => void) => {
        updateTask({completionPercentage: newPercentage});
        closeDropdown?.();
    }, [updateTask]);
    const handleProgressIndicatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycleCompletionPercentage();
        }
    }, [cycleCompletionPercentage]);

    // Delete/Restore Handling (Unchanged)
    const openDeleteConfirm = useCallback(() => setIsDeleteConfirmOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteConfirmOpen(false), []);
    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({list: 'Trash', completionPercentage: null});
        setSelectedTaskId(null);
        closeDeleteConfirm();
    }, [selectedTask, updateTask, setSelectedTaskId, closeDeleteConfirm]);
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        updateTask({list: 'Inbox'});
    }, [selectedTask, updateTask]);

    // Input KeyDown Handlers (Title unchanged, Tag handler updated below)
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            savePendingChanges();
            titleInputRef.current?.blur();
        } else if (e.key === 'Escape' && selectedTask) {
            e.preventDefault();
            if (localTitle !== selectedTask.title) {
                setLocalTitle(selectedTask.title);
                latestTitleRef.current = selectedTask.title;
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                hasUnsavedChangesRef.current = false;
            }
            titleInputRef.current?.blur();
        }
    }, [selectedTask, localTitle, savePendingChanges]);

    // --- Tag Input Specific Logic ---

    // Derive tags array from the localTags string for rendering pills
    const tagsArray = useMemo(() => {
        return localTags.split(',')
            .map(t => t.trim())
            .filter(Boolean)
            // Ensure uniqueness for display consistency, though save logic also handles it
            .filter((v, i, a) => a.indexOf(v) === i);
    }, [localTags]);

    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => (selectedTask?.completionPercentage ?? 0) === 100 && !isTrash, [selectedTask?.completionPercentage, isTrash]);
    const isTagHandlingDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);

    // Add a new tag to the localTags string state
    const addTag = useCallback((tagToAdd: string) => {
        const trimmedTag = tagToAdd.trim();
        if (!trimmedTag || isTagHandlingDisabled) return;

        // Prevent adding duplicates
        const currentTags = localTags.split(',').map(t => t.trim()).filter(Boolean);
        if (currentTags.includes(trimmedTag)) {
            setTagInputValue(''); // Clear input even if duplicate
            return;
        }

        const newTagsString = [...currentTags, trimmedTag].join(', ');
        setLocalTags(newTagsString);
        setTagInputValue(''); // Clear input field
        triggerSave(); // Debounce save
    }, [localTags, isTagHandlingDisabled, triggerSave]);

    // Remove a tag from the localTags string state
    const removeTag = useCallback((tagToRemove: string) => {
        if (isTagHandlingDisabled) return;
        const newTagsArray = tagsArray.filter(t => t !== tagToRemove);
        setLocalTags(newTagsArray.join(', '));
        triggerSave(); // Debounce save
        tagInputElementRef.current?.focus(); // Keep focus in the input area
    }, [tagsArray, isTagHandlingDisabled, triggerSave]);

    // Handle KeyDown in the tag input field
    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isTagHandlingDisabled) return;

        const value = tagInputValue.trim();

        if ((e.key === 'Enter' || e.key === ',') && value) {
            e.preventDefault();
            addTag(value);
        } else if (e.key === 'Backspace' && tagInputValue === '' && tagsArray.length > 0) {
            e.preventDefault();
            // Remove the last tag when backspace is pressed in empty input
            removeTag(tagsArray[tagsArray.length - 1]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setTagInputValue(''); // Clear current input
            (e.target as HTMLInputElement).blur(); // Blur the input
        }
    }, [tagInputValue, tagsArray, addTag, removeTag, isTagHandlingDisabled]);

    // Handle blur on the tag input - add current input value if any, then trigger save
    const handleTagInputBlur = useCallback(() => {
        // Add any remaining text in the input as a tag on blur
        const value = tagInputValue.trim();
        if (value && !isTagHandlingDisabled) {
            addTag(value); // This will trigger save via triggerSave()
        }
        // Ensure final state is saved if focus leaves the component entirely
        savePendingChanges();
    }, [tagInputValue, addTag, isTagHandlingDisabled, savePendingChanges]);

    // Focus the inner text input when the container div is clicked
    const handleTagContainerClick = useCallback(() => {
        if (!isTagHandlingDisabled) {
            tagInputElementRef.current?.focus();
        }
    }, [isTagHandlingDisabled]);


    // Memos for Display Logic (mostly unchanged, adapted paths/refs)
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: { label: 'High', iconColor: 'text-red-500' },
        2: { label: 'Medium', iconColor: 'text-orange-500' },
        3: { label: 'Low', iconColor: 'text-blue-500' },
        4: { label: 'Lowest', iconColor: 'text-gray-500' },
    }), []);
    const displayDueDateForPicker = useMemo(() => localDueDate, [localDueDate]);
    const displayDueDateForRender = useMemo(() => localDueDate ?? safeParseDate(selectedTask?.dueDate), [localDueDate, selectedTask?.dueDate]);
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);
    const displayPriority = selectedTask?.priority;
    const displayList = selectedTask?.list;
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt) : '', [selectedTask?.createdAt]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt) : '', [selectedTask?.updatedAt]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const titleInputClasses = useMemo(() => twMerge("w-full text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight", "placeholder:text-muted placeholder:font-normal", (isCompleted || isTrash) && "line-through text-muted-foreground", "task-detail-title-input"), [isCompleted, isTrash]);
    const editorClasses = useMemo(() => twMerge("!min-h-[150px] h-full text-sm", "!bg-transparent", (isCompleted || isTrash) && "opacity-70", isTrash && "pointer-events-none"), [isCompleted, isTrash]);
    const progressStatusText = useMemo(() => {
        const p = selectedTask?.completionPercentage;
        if (p === 100) return "Completed";
        if (p === 80) return "Almost Done (80%)";
        if (p === 50) return "Halfway (50%)";
        if (p === 20) return "Started (20%)";
        return "Not Started";
    }, [selectedTask?.completionPercentage]);
    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: 'Started (20%)', value: 20, icon: 'circle-dot' as IconName}, // Corrected icon
        {label: 'Halfway (50%)', value: 50, icon: 'circle-dot-dashed' as IconName}, // Corrected icon
        {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName},
    ], []);

    // --- Tag Input Container Styling ---
    const tagInputContainerClasses = useMemo(() => twMerge(
        "flex items-center flex-wrap bg-transparent rounded-sm w-full min-h-[28px] px-1.5 py-1", // Adjusted padding for vertical rhythm (py-1 fits pills better)
        "transition-colors duration-100 ease-apple backdrop-blur-sm",
        isTagHandlingDisabled
            ? "opacity-60 cursor-not-allowed bg-transparent" // Keep opacity consistent with MetaRow
            : "hover:bg-white/15 focus-within:bg-white/20 cursor-text"
    ), [isTagHandlingDisabled]);


    if (!selectedTask) return null;

    return (
        <>
            <motion.div key={selectedTask.id}
                        className={twMerge("border-l border-black/10 w-[420px] shrink-0 h-full flex flex-col shadow-xl z-20", "bg-glass-100 backdrop-blur-xl")}
                        initial={{x: '100%'}} animate={{x: 0}} exit={{x: '100%'}}
                        transition={{duration: 0.3, ease: "easeOut"}}>
                {/* Header (Unchanged) */}
                <div
                    className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100 backdrop-blur-lg">
                    <div className="w-20 flex justify-start">
                        {isTrash ? (<Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore}
                                            className="text-green-600 hover:bg-green-400/20 hover:text-green-700 text-xs px-1.5"> Restore </Button>) : (
                            <Button variant="ghost" size="icon" icon="trash" onClick={openDeleteConfirm}
                                    className="text-red-600 hover:bg-red-400/20 hover:text-red-700 w-7 h-7"
                                    aria-label="Move task to Trash"/>)}
                    </div>
                    <div className="flex-1 text-center h-4"></div>
                    <div className="w-20 flex justify-end"><Button variant="ghost" size="icon" icon="x"
                                                                   onClick={handleClose} aria-label="Close task details"
                                                                   className="text-muted-foreground hover:bg-black/15 w-7 h-7"/>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 styled-scrollbar flex flex-col">
                    {/* Progress Indicator and Title (Unchanged) */}
                    <div className="flex items-start space-x-3 mb-4 flex-shrink-0">
                        <ProgressIndicator
                            percentage={selectedTask.completionPercentage}
                            isTrash={isTrash}
                            onClick={cycleCompletionPercentage}
                            onKeyDown={handleProgressIndicatorKeyDown}
                            size={20}
                            className="mt-[3px]"
                            ariaLabelledby={`task-title-input-${selectedTask.id}`}
                        />
                        <input
                            ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown} onBlur={savePendingChanges} // Save on blur
                            className={titleInputClasses}
                            placeholder="Task title..." disabled={isTrash} aria-label="Task title"
                            id={`task-title-input-${selectedTask.id}`}
                        />
                    </div>

                    {/* Metadata Section */}
                    <div className="space-y-1.5 text-sm border-t border-b border-black/10 py-2.5 my-4 flex-shrink-0">
                        {/* Progress Row (Unchanged) */}
                        <MetaRow icon="circle-gauge" label="Progress" disabled={isTrash}>
                            {/* ... Dropdown content ... */}
                            <Dropdown
                                trigger={<Button variant="ghost" size="sm"
                                                 className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm disabled:hover:!bg-transparent disabled:cursor-not-allowed", isCompleted ? "text-primary" : "text-gray-700")}
                                                 disabled={isTrash}> {progressStatusText} </Button>}
                                contentClassName="py-1" usePortal={false}
                            >
                                {(props) => (
                                    <>
                                        {progressMenuItems.map(item => (
                                            <MenuItem
                                                key={item.label} icon={item.icon}
                                                selected={selectedTask?.completionPercentage === item.value || (selectedTask?.completionPercentage === null && item.value === null)}
                                                onClick={() => handleProgressChange(item.value, props.close)}
                                            >
                                                {item.label}
                                            </MenuItem>
                                        ))}
                                    </>
                                )}
                            </Dropdown>
                        </MetaRow>
                        {/* Due Date Row (Unchanged) */}
                        <MetaRow icon="calendar" label="Due Date" disabled={isTrash}>
                            {/* ... Dropdown content ... */}
                            <Dropdown
                                trigger={
                                    <Button variant="ghost" size="sm"
                                            className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate hover:bg-black/10 backdrop-blur-sm", displayDueDateForRender ? 'text-gray-700' : 'text-muted-foreground', overdue && 'text-red-600 font-medium', isTrash && 'text-muted line-through !bg-transparent hover:!bg-transparent cursor-not-allowed', isCompleted && !isTrash && "line-through text-muted-foreground")}
                                            disabled={isTrash}>
                                        {displayDueDateForRender && isValid(displayDueDateForRender) ? formatRelativeDate(displayDueDateForRender) : 'Set date'}
                                    </Button>
                                }
                                contentClassName="date-picker-popover p-0 border-0 shadow-none bg-transparent"
                                placement="bottom-end"
                                usePortal={false}
                            >
                                {(props) => (
                                    <CustomDatePickerPopover
                                        initialDate={displayDueDateForPicker}
                                        onSelect={handleDatePickerSelect}
                                        close={props.close}
                                        usePortal={false}
                                    />
                                )}
                            </Dropdown>
                        </MetaRow>
                        {/* List Row (Unchanged) */}
                        <MetaRow icon="list" label="List" disabled={isTrash}>
                            {/* ... Dropdown content ... */}
                            <Dropdown
                                trigger={<Button variant="ghost" size="sm"
                                                 className="text-xs h-7 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm disabled:hover:!bg-transparent disabled:cursor-not-allowed"
                                                 disabled={isTrash}> {displayList} </Button>}
                                contentClassName="max-h-48 overflow-y-auto styled-scrollbar py-1"
                                usePortal={false}
                            >
                                {(props) => (<> {availableLists.map(list => (
                                    <button key={list} onClick={() => handleListChange(list, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple focus:outline-none focus-visible:bg-black/10 rounded-[3px]", displayList === list && "bg-primary/20 text-primary font-medium")}
                                            role="menuitemradio"
                                            aria-checked={displayList === list}> {list} </button>))} </>)}
                            </Dropdown>
                        </MetaRow>
                        {/* Priority Row (Unchanged) */}
                        <MetaRow icon="flag" label="Priority" disabled={isTagHandlingDisabled}>
                            {/* ... Dropdown content ... */}
                            <Dropdown
                                trigger={<Button variant="ghost" size="sm"
                                                 className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm", displayPriority ? priorityMap[displayPriority]?.iconColor : 'text-gray-700', (isTagHandlingDisabled) && 'hover:!bg-transparent cursor-not-allowed')}
                                                 icon={displayPriority ? 'flag' : undefined}
                                                 disabled={isTagHandlingDisabled}> {displayPriority ? `P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'} </Button>}
                                contentClassName="py-1"
                                usePortal={false}
                            >
                                {(props) => (<> {[1, 2, 3, 4, null].map(p => (
                                    <button key={p ?? 'none'} onClick={() => handlePriorityChange(p, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple flex items-center focus:outline-none focus-visible:bg-black/10 rounded-[3px]", displayPriority === p && "bg-primary/20 text-primary font-medium", p && priorityMap[p]?.iconColor)}
                                            role="menuitemradio" aria-checked={displayPriority === p}> {p &&
                                        <Icon name="flag" size={14}
                                              className="mr-1.5 flex-shrink-0"/>} {p ? `P${p} ${priorityMap[p]?.label}` : 'None'} </button>))} </>)}
                            </Dropdown>
                        </MetaRow>

                        {/* --- Updated Tags Row --- */}
                        <MetaRow icon="tag" label="Tags" disabled={isTagHandlingDisabled}>
                            <div
                                className={tagInputContainerClasses}
                                onClick={handleTagContainerClick}
                                aria-disabled={isTagHandlingDisabled}
                            >
                                {/* Render existing tags as pills */}
                                {tagsArray.map((tag) => (
                                    <TagPill
                                        key={tag}
                                        tag={tag}
                                        onRemove={() => removeTag(tag)}
                                        disabled={isTagHandlingDisabled}
                                    />
                                ))}
                                {/* Input for adding new tags */}
                                <input
                                    ref={tagInputElementRef}
                                    type="text"
                                    value={tagInputValue}
                                    onChange={(e) => setTagInputValue(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    onBlur={handleTagInputBlur} // Use specific blur handler
                                    placeholder={tagsArray.length === 0 ? "Add tag..." : ""}
                                    className={twMerge(
                                        "flex-1 text-xs border-none focus:ring-0 bg-transparent p-0 m-0 h-[22px] min-w-[60px] self-center", // Ensure input aligns vertically and has min width
                                        "placeholder:text-muted placeholder:font-normal",
                                        "disabled:bg-transparent disabled:cursor-not-allowed"
                                    )}
                                    disabled={isTagHandlingDisabled}
                                    aria-label="Add a new tag (use comma or Enter to confirm)"
                                />
                            </div>
                        </MetaRow>
                    </div>

                    {/* Content Editor (Unchanged) */}
                    <div className="task-detail-content-editor flex-1 min-h-[150px] flex flex-col mb-4">
                        <CodeMirrorEditor
                            ref={editorRef} value={localContent} onChange={handleContentChange}
                            onBlur={savePendingChanges} // Save on blur
                            placeholder="Add notes, links, or details here... Markdown is supported."
                            className={editorClasses}
                            readOnly={isTrash}/>
                    </div>
                </div>

                {/* Footer (Unchanged) */}
                <div
                    className="px-4 py-2 border-t border-black/10 flex justify-end items-center flex-shrink-0 h-9 bg-glass-alt-200 backdrop-blur-lg">
                    <div className="text-[11px] text-muted-foreground space-x-4">
                        <span>Created: {displayCreatedAt}</span>
                        <span>Updated: {displayUpdatedAt}</span>
                    </div>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal (Unchanged) */}
            <ConfirmDeleteModal
                isOpen={isDeleteConfirmOpen}
                onClose={closeDeleteConfirm}
                onConfirm={confirmDelete}
                taskTitle={selectedTask.title} // Ensure title is passed even if empty initially
            />
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;