// src/components/tasks/TaskDetail.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { Button, buttonVariants } from '@/components/ui/button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay } from '@/lib/utils/dateUtils';
import { Task } from '@/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox'; // Use checkbox for completion state
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconName } from "@/components/common/IconMap";

// Meta Row Component Refactored (Simplified Layout)
const MetaRow: React.FC<{ icon: IconName; label: string; children: React.ReactNode; disabled?: boolean }> =
    memo(({ icon, label, children, disabled = false }) => (
        <div className={cn("flex items-center group min-h-[36px] py-1", disabled && "opacity-60 pointer-events-none select-none")}>
            <span className="text-muted-foreground flex items-center text-xs font-medium w-24 flex-shrink-0">
                <Icon name={icon} size={14} className="mr-2 opacity-70" aria-hidden="true" />
                {label}
            </span>
            <div className="flex-1 text-right min-w-0">
                {children}
            </div>
        </div>
    ));
MetaRow.displayName = 'MetaRow';

// Tag Pill Component (Using shadcn Badge)
interface TagPillProps { tag: string; onRemove: () => void; disabled?: boolean; }
const TagPill: React.FC<TagPillProps> = React.memo(({ tag, onRemove, disabled }) => (
    <Badge
        variant="secondary" // Use secondary variant for subtle look
        className={cn(
            "mr-1 mb-1 group/pill whitespace-nowrap cursor-default h-6 text-xs font-normal",
            disabled ? "opacity-70" : "hover:bg-accent"
        )}
        aria-label={`Tag: ${tag}${disabled ? ' (disabled)' : ''}`}
    >
        {tag}
        {!disabled && (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="ml-1 text-muted-foreground hover:text-destructive opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-1 flex items-center justify-center ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`Remove tag ${tag}`}
                tabIndex={-1}
            >
                <Icon name="x" size={10} strokeWidth={3} />
            </button>
        )}
    </Badge>
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
    const [localTags, setLocalTags] = useState('');
    const [tagInputValue, setTagInputValue] = useState('');
    // No separate state needed for delete confirm, handled by AlertDialog

    const titleInputRef = useRef<HTMLInputElement>(null);
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
                // Optionally trigger one last save on unmount if needed
                // savePendingChanges(); // Be cautious with state updates on unmount
            }
        };
    }, []);

    // Debounced Save Logic (Mostly unchanged, adapted state access)
    const savePendingChanges = useCallback(() => {
        if (!selectedTask || !hasUnsavedChangesRef.current || !isMountedRef.current) return;
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        const currentTitle = latestTitleRef.current;
        const currentContent = latestContentRef.current;
        const currentDueDate = localDueDate; // Already Date | undefined
        const currentTagsString = latestTagsRef.current;

        const processedTitle = currentTitle.trim();
        const processedDueDate = currentDueDate && isValid(currentDueDate) ? currentDueDate.getTime() : null;
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
            setTasks(prevTasks => prevTasks.map(t => t.id === originalTaskState.id ? { ...t, ...changesToSave } : t));
        }
        hasUnsavedChangesRef.current = false;
    }, [selectedTask, setTasks, localDueDate]);

    // Sync Local State from Atom (Adapted)
    useEffect(() => {
        if (selectedTask) {
            const isTitleFocused = titleInputRef.current === document.activeElement;
            const isTagsFocused = tagInputElementRef.current === document.activeElement;
            const isContentFocused = editorRef.current?.getView()?.hasFocus ?? false;

            if (!isTitleFocused) setLocalTitle(selectedTask.title);
            latestTitleRef.current = selectedTask.title; // Always update ref

            const taskContent = selectedTask.content || '';
            if (!isContentFocused) setLocalContent(taskContent);
            latestContentRef.current = taskContent; // Always update ref

            const taskDueDate = safeParseDate(selectedTask.dueDate);
            const validTaskDueDate = taskDueDate && isValid(taskDueDate) ? taskDueDate : undefined;
            setLocalDueDate(validTaskDueDate);

            const taskTagsString = (selectedTask.tags ?? []).join(', ');
            if (!isTagsFocused) setLocalTags(taskTagsString);
            latestTagsRef.current = taskTagsString; // Always update ref
            if (!isTagsFocused) setTagInputValue(''); // Clear input only if not focused

            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

            // Auto-focus title if empty and not focused elsewhere
            if (selectedTask.title === '' && !isTitleFocused && !isContentFocused && !isTagsFocused) {
                const timer = setTimeout(() => {
                    if (isMountedRef.current && titleInputRef.current) {
                        titleInputRef.current.focus();
                        titleInputRef.current.select();
                    }
                }, 250); // Shorter delay
                return () => clearTimeout(timer);
            }
        } else {
            // Reset state when no task is selected
            setLocalTitle(''); latestTitleRef.current = '';
            setLocalContent(''); latestContentRef.current = '';
            setLocalDueDate(undefined);
            setLocalTags(''); latestTagsRef.current = '';
            setTagInputValue('');
            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask?.id]); // Depend only on ID change

    // Update Refs on Local State Change (Unchanged)
    useEffect(() => { latestTitleRef.current = localTitle; }, [localTitle]);
    useEffect(() => { latestContentRef.current = localContent; }, [localContent]);
    useEffect(() => { latestTagsRef.current = localTags; }, [localTags]);

    // Debounced Save Trigger (Unchanged)
    const triggerSave = useCallback(() => {
        if (!selectedTask || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(savePendingChanges, 600);
    }, [selectedTask, savePendingChanges]);

    // Direct Update Function (Unchanged)
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        if (!selectedTask || !isMountedRef.current) return;
        if (hasUnsavedChangesRef.current) savePendingChanges();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        hasUnsavedChangesRef.current = false;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? { ...t, ...updates, updatedAt: Date.now() } : t));
    }, [selectedTask, setTasks, savePendingChanges]);

    // Event Handlers (Adapted for shadcn components)
    const handleClose = useCallback(() => { savePendingChanges(); setSelectedTaskId(null); }, [setSelectedTaskId, savePendingChanges]);
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { setLocalTitle(e.target.value); triggerSave(); }, [triggerSave]);
    const handleContentChange = useCallback((newValue: string) => { setLocalContent(newValue); triggerSave(); }, [triggerSave]);
    const handleDatePickerSelect = useCallback((date: Date | undefined) => {
        const newDate = date ? startOfDay(date) : undefined; // Keep as Date object until save
        setLocalDueDate(newDate);
        updateTask({ dueDate: newDate ? newDate.getTime() : null });
    }, [updateTask]);
    const handleListChange = useCallback((newList: string) => { updateTask({ list: newList }); }, [updateTask]);
    const handlePriorityChange = useCallback((newPriority: string) => { updateTask({ priority: newPriority === 'null' ? null : Number(newPriority) }); }, [updateTask]);
    const handleProgressChange = useCallback((newValue: string) => { updateTask({ completionPercentage: newValue === 'null' ? null : Number(newValue) }); }, [updateTask]);
    const handleCompletionToggle = useCallback((checked: boolean | 'indeterminate') => {
        const newPercentage = checked === true ? 100 : null;
        updateTask({ completionPercentage: newPercentage });
        if (newPercentage === 100) {
            // Optional: Deselect task when completed via this toggle
            // setSelectedTaskId(null);
        }
    }, [updateTask]);

    // Delete/Restore Handling (Adapted for AlertDialog)
    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({ list: 'Trash', completionPercentage: null });
        setSelectedTaskId(null); // Close detail view after moving to trash
        // Dialog closes itself via AlertDialogAction
    }, [selectedTask, updateTask, setSelectedTaskId]);
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        updateTask({ list: 'Inbox' }); // Move back to Inbox
    }, [selectedTask, updateTask]);

    // Input KeyDown Handlers (Adapted)
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            savePendingChanges(); // Save immediately on Enter
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape' && selectedTask) {
            e.preventDefault();
            if (localTitle !== selectedTask.title) {
                setLocalTitle(selectedTask.title); // Revert
                latestTitleRef.current = selectedTask.title;
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                hasUnsavedChangesRef.current = false;
            }
            (e.target as HTMLInputElement).blur();
        }
    }, [selectedTask, localTitle, savePendingChanges]);

    // Tag Input Logic (Adapted for Input + Badge)
    const tagsArray = useMemo(() => localTags.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), [localTags]);
    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => selectedTask?.completed ?? false, [selectedTask?.completed]);
    const isTagHandlingDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);
    const addTag = useCallback((tagToAdd: string) => {
        const trimmedTag = tagToAdd.trim().replace(/,/g, ''); // Also remove commas within tag
        if (!trimmedTag || isTagHandlingDisabled) return;
        const currentTags = localTags.split(',').map(t => t.trim()).filter(Boolean);
        if (currentTags.includes(trimmedTag)) { setTagInputValue(''); return; } // Prevent duplicates
        const newTagsString = [...currentTags, trimmedTag].join(', ');
        setLocalTags(newTagsString);
        setTagInputValue('');
        triggerSave();
    }, [localTags, isTagHandlingDisabled, triggerSave]);
    const removeTag = useCallback((tagToRemove: string) => {
        if (isTagHandlingDisabled) return;
        const newTagsArray = tagsArray.filter(t => t !== tagToRemove);
        setLocalTags(newTagsArray.join(', '));
        triggerSave();
        tagInputElementRef.current?.focus();
    }, [tagsArray, isTagHandlingDisabled, triggerSave]);
    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isTagHandlingDisabled) return;
        const value = tagInputValue.trim();
        if ((e.key === 'Enter' || e.key === ',') && value) { e.preventDefault(); addTag(value); }
        else if (e.key === 'Backspace' && tagInputValue === '' && tagsArray.length > 0) { e.preventDefault(); removeTag(tagsArray[tagsArray.length - 1]); }
        else if (e.key === 'Escape') { e.preventDefault(); setTagInputValue(''); (e.target as HTMLInputElement).blur(); }
    }, [tagInputValue, tagsArray, addTag, removeTag, isTagHandlingDisabled]);
    const handleTagInputBlur = useCallback(() => {
        const value = tagInputValue.trim();
        if (value && !isTagHandlingDisabled) addTag(value); // Add tag on blur
        // Ensure final state is saved if focus leaves
        setTimeout(savePendingChanges, 50); // Slight delay to allow other updates first
    }, [tagInputValue, addTag, isTagHandlingDisabled, savePendingChanges]);
    const handleTagContainerClick = useCallback(() => { if (!isTagHandlingDisabled) tagInputElementRef.current?.focus(); }, [isTagHandlingDisabled]);


    // Memos for Display Logic (Adapted)
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: { label: 'High', iconColor: 'text-red-500 dark:text-red-400' },
        2: { label: 'Medium', iconColor: 'text-orange-500 dark:text-orange-400' },
        3: { label: 'Low', iconColor: 'text-blue-500 dark:text-blue-400' },
        4: { label: 'Lowest', iconColor: 'text-gray-500 dark:text-gray-400' },
    }), []);
    const displayDueDateForPicker = localDueDate;
    const displayDueDateForRender = useMemo(() => localDueDate ?? safeParseDate(selectedTask?.dueDate), [localDueDate, selectedTask?.dueDate]);
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);
    const displayPriority = selectedTask?.priority;
    const displayList = selectedTask?.list;
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt) : '', [selectedTask?.createdAt]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt) : '', [selectedTask?.updatedAt]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const editorClasses = cn("!min-h-[150px] h-full text-sm !bg-transparent !border-none !shadow-none", (isCompleted || isTrash) && "opacity-70", isTrash && "pointer-events-none");
    const progressStatusText = useMemo(() => {
        const p = selectedTask?.completionPercentage;
        if (isCompleted) return "Completed"; // Check derived state first
        if (p === 80) return "Almost Done (80%)";
        if (p === 50) return "Halfway (50%)";
        if (p === 20) return "Started (20%)";
        return "Not Started";
    }, [selectedTask?.completionPercentage, isCompleted]);
    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: 'null', icon: 'circle' as IconName},
        {label: 'Started (20%)', value: '20', icon: 'circle-dot-dashed' as IconName},
        {label: 'Halfway (50%)', value: '50', icon: 'circle-dot' as IconName},
        {label: 'Almost Done (80%)', value: '80', icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: '100', icon: 'circle-check' as IconName},
    ], []);
    const currentProgressValue = useMemo(() => String(selectedTask?.completionPercentage ?? 'null'), [selectedTask?.completionPercentage]);

    // Calculate checkbox state from percentage
    const checkboxState = useMemo(() => {
        if (isCompleted) return true;
        if (selectedTask?.completionPercentage && selectedTask.completionPercentage > 0) return 'indeterminate';
        return false;
    }, [isCompleted, selectedTask?.completionPercentage]);

    const tagInputContainerClasses = cn(
        "flex items-center flex-wrap border border-input bg-background rounded-md min-h-[36px] px-2 py-1", // Use theme styles
        "transition-colors duration-150 ease-in-out",
        isTagHandlingDisabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-ring/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring cursor-text"
    );

    if (!selectedTask) return null;

    return (
        <>
            {/* Use AlertDialog for delete confirmation */}
            <AlertDialog>
                <motion.div key={selectedTask.id}
                            className={cn(
                                "border-l border-border/50 w-[400px] shrink-0 h-full flex flex-col shadow-lg z-10", // Use theme border
                                "bg-glass-100 backdrop-blur-xl" // Glass effect
                            )}
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: 0.2, ease: 'easeOut' } }}
                            transition={{ duration: 0.25, ease: "easeOut" }}>

                    {/* Header */}
                    <div className="px-3 py-2 border-b border-border/50 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100 backdrop-blur-lg">
                        <div className="w-20 flex justify-start">
                            {isTrash ? (
                                <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore} className="text-green-600 hover:bg-green-500/10 hover:text-green-700 text-xs px-1.5"> Restore </Button>
                            ) : (
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" icon="trash"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-7 h-7"
                                            aria-label="Move task to Trash"/>
                                </AlertDialogTrigger>
                            )}
                        </div>
                        <div className="flex-1 text-center h-4"></div> {/* Spacer */}
                        <div className="w-20 flex justify-end">
                            <Button variant="ghost" size="icon" icon="x" onClick={handleClose} aria-label="Close task details"
                                    className="text-muted-foreground hover:bg-accent w-7 h-7"/>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <ScrollArea className="flex-1" type="auto">
                        <div className="p-4 space-y-4">
                            {/* Progress Checkbox and Title */}
                            <div className="flex items-start space-x-3 mb-2">
                                <Checkbox
                                    id={`detail-complete-${selectedTask.id}`}
                                    checked={checkboxState}
                                    onCheckedChange={handleCompletionToggle}
                                    disabled={isTrash}
                                    className="mt-[5px] w-5 h-5 rounded-full flex-shrink-0" // Circular style
                                    aria-label="Mark task complete/incomplete"
                                />
                                <Input
                                    ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                                    onKeyDown={handleTitleKeyDown} onBlur={savePendingChanges} // Save on blur too
                                    className={cn(
                                        "w-full text-lg font-medium border-none focus-visible:ring-0 focus:ring-0 focus:outline-none bg-transparent p-0 m-0 h-auto leading-tight",
                                        "placeholder:text-muted-foreground placeholder:font-normal",
                                        (isCompleted || isTrash) && "line-through text-muted-foreground",
                                        "task-detail-title-input" // Keep custom class if needed elsewhere
                                    )}
                                    placeholder="Task title..." disabled={isTrash} aria-label="Task title"
                                    id={`task-title-input-${selectedTask.id}`}
                                />
                            </div>

                            {/* Metadata Section */}
                            <div className="space-y-0 text-sm border-t border-b border-border/50 py-1 my-3">
                                {/* Progress Row */}
                                <MetaRow icon="circle-gauge" label="Progress" disabled={isTrash}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm"
                                                    className={cn(
                                                        "text-xs h-7 px-1.5 w-full text-left justify-start font-normal",
                                                        "disabled:text-muted-foreground disabled:line-through truncate hover:bg-accent",
                                                        isCompleted ? "text-primary" : "text-foreground",
                                                        "disabled:hover:!bg-transparent disabled:cursor-not-allowed"
                                                    )}
                                                    disabled={isTrash}>
                                                {progressStatusText}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuRadioGroup value={currentProgressValue} onValueChange={handleProgressChange}>
                                                {progressMenuItems.map(item => (
                                                    <DropdownMenuRadioItem key={item.label} value={item.value} className="text-xs">
                                                        <Icon name={item.icon} size={13} className="mr-2 opacity-70"/>
                                                        {item.label}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </MetaRow>
                                {/* Due Date Row */}
                                <MetaRow icon="calendar" label="Due Date" disabled={isTrash}>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="ghost" size="sm"
                                                className={cn(
                                                    "text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate hover:bg-accent",
                                                    displayDueDateForRender ? 'text-foreground' : 'text-muted-foreground',
                                                    overdue && 'text-destructive font-medium',
                                                    isTrash && 'text-muted-foreground line-through !bg-transparent hover:!bg-transparent cursor-not-allowed',
                                                    isCompleted && !isTrash && "line-through text-muted-foreground"
                                                )}
                                                disabled={isTrash}>
                                                <Icon name="calendar" size={13} className="mr-1.5 opacity-70"/>
                                                {displayDueDateForRender && isValid(displayDueDateForRender) ? formatRelativeDate(displayDueDateForRender) : 'Set date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={displayDueDateForPicker}
                                                onSelect={handleDatePickerSelect}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </MetaRow>
                                {/* List Row */}
                                <MetaRow icon="list" label="List" disabled={isTrash}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm"
                                                    className="text-xs h-7 px-1.5 w-full text-left justify-start text-foreground font-normal disabled:text-muted-foreground disabled:line-through truncate hover:bg-accent disabled:hover:!bg-transparent disabled:cursor-not-allowed"
                                                    disabled={isTrash}>
                                                <Icon name={displayList === 'Inbox' ? 'inbox' : 'list'} size={13} className="mr-1.5 opacity-70"/>
                                                {displayList}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 max-h-48 overflow-y-auto styled-scrollbar-thin">
                                            <DropdownMenuRadioGroup value={displayList ?? ''} onValueChange={handleListChange}>
                                                {availableLists.map(list => (
                                                    <DropdownMenuRadioItem key={list} value={list} className="text-xs">
                                                        <Icon name={list === 'Inbox' ? 'inbox' : 'list'} size={13} className="mr-1.5 opacity-70"/>
                                                        {list}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </MetaRow>
                                {/* Priority Row */}
                                <MetaRow icon="flag" label="Priority" disabled={isTagHandlingDisabled}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm"
                                                    className={cn(
                                                        "text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted-foreground disabled:line-through truncate hover:bg-accent",
                                                        displayPriority ? priorityMap[displayPriority]?.iconColor : 'text-foreground',
                                                        isTagHandlingDisabled && 'hover:!bg-transparent cursor-not-allowed'
                                                    )}
                                                    disabled={isTagHandlingDisabled}>
                                                <Icon name="flag" size={13} className={cn("mr-1.5", displayPriority ? "opacity-100" : "opacity-70")}/>
                                                {displayPriority ? `P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuRadioGroup value={String(displayPriority ?? 'null')} onValueChange={handlePriorityChange}>
                                                {[1, 2, 3, 4, null].map(p => (
                                                    <DropdownMenuRadioItem key={p ?? 'none'} value={String(p ?? 'null')} className={cn("text-xs", p && priorityMap[p]?.iconColor)}>
                                                        <Icon name="flag" size={13} className={cn("mr-1.5", p ? "opacity-100" : "opacity-70")}/>
                                                        {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </MetaRow>

                                {/* Tags Row */}
                                <MetaRow icon="tag" label="Tags" disabled={isTagHandlingDisabled}>
                                    <div className={tagInputContainerClasses} onClick={handleTagContainerClick}>
                                        {tagsArray.map((tag) => (
                                            <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)} disabled={isTagHandlingDisabled} />
                                        ))}
                                        <Input
                                            ref={tagInputElementRef} type="text" value={tagInputValue}
                                            onChange={(e) => setTagInputValue(e.target.value)}
                                            onKeyDown={handleTagInputKeyDown} onBlur={handleTagInputBlur}
                                            placeholder={tagsArray.length === 0 ? "Add tag..." : ""}
                                            className={cn(
                                                "flex-1 text-xs border-none focus-visible:ring-0 focus:ring-0 bg-transparent p-0 m-0 h-[22px] min-w-[60px] self-center shadow-none",
                                                "placeholder:text-muted-foreground placeholder:font-normal",
                                                "disabled:bg-transparent disabled:cursor-not-allowed"
                                            )}
                                            disabled={isTagHandlingDisabled}
                                            aria-label="Add a new tag (use comma or Enter to confirm)"
                                        />
                                    </div>
                                </MetaRow>
                            </div>

                            {/* Content Editor */}
                            <div className="task-detail-content-editor flex-1 min-h-[150px] flex flex-col">
                                <Label className="text-xs font-medium text-muted-foreground mb-1.5">Notes</Label>
                                <CodeMirrorEditor
                                    ref={editorRef} value={localContent} onChange={handleContentChange}
                                    onBlur={savePendingChanges} // Also save on blur
                                    placeholder="Add notes, links, or details here... Markdown is supported."
                                    className={editorClasses} readOnly={isTrash}/>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="px-4 py-1.5 border-t border-border/50 flex justify-end items-center flex-shrink-0 h-8 bg-glass-alt-200 backdrop-blur-lg">
                        <div className="text-[10px] text-muted-foreground space-x-3">
                            <span>Created: {displayCreatedAt}</span>
                            <span>Updated: {displayUpdatedAt}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Delete Confirmation Dialog Content */}
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move Task to Trash?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to move the task "{selectedTask.title || 'Untitled Task'}" to the Trash?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>
                            Move to Trash
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;