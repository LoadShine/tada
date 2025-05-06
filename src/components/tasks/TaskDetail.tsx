// src/components/tasks/TaskDetail.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {Task} from '@/types';
import {twMerge} from 'tailwind-merge';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import {ProgressIndicator} from './TaskItem';
import {IconName} from "@/components/common/IconMap";

// --- Helper TagPill Component (Unchanged) ---
interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

const TagPill: React.FC<TagPillProps> = React.memo(({tag, onRemove, disabled}) => (
    <span
        className={twMerge(
            "inline-flex items-center bg-black/10 dark:bg-white/10 text-gray-700 dark:text-neutral-300 rounded-sm pl-1.5 pr-1 py-0.5 text-xs mr-1 mb-1 group/pill whitespace-nowrap",
            "transition-colors duration-100 ease-apple",
            disabled ? "opacity-70 cursor-not-allowed" : "hover:bg-black/20 dark:hover:bg-white/20"
        )}
        aria-label={`Tag: ${tag}${disabled ? ' (disabled)' : ''}`}
    >
        {tag}
        {!disabled && (
            <button type="button" onClick={(e) => {
                e.stopPropagation();
                onRemove();
            }}
                    className="ml-1 text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-0.5 flex items-center justify-center"
                    aria-label={`Remove tag ${tag}`} tabIndex={-1}>
                <Icon name="x" size={10} strokeWidth={3}/>
            </button>
        )}
    </span>
));
TagPill.displayName = 'TagPill';


// --- Reusable Radix Dropdown Menu Item Component (Unchanged) ---
interface RadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const RadixMenuItem: React.FC<RadixMenuItemProps> = React.memo(({
                                                                    icon,
                                                                    iconColor,
                                                                    selected,
                                                                    children,
                                                                    className,
                                                                    isDanger = false,
                                                                    ...props
                                                                }) => (
    <DropdownMenu.Item
        className={twMerge(
            "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
            isDanger
                ? "text-red-600 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/20 dark:data-[highlighted]:text-red-300"
                : "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
            selected && !isDanger && "bg-primary/20 text-primary data-[highlighted]:bg-primary/25 dark:bg-primary/30 dark:text-primary-light dark:data-[highlighted]:bg-primary/40",
            !selected && !isDanger && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
            "data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        {icon && (
            <Icon name={icon} size={14} className={twMerge("mr-1.5 flex-shrink-0 opacity-80", iconColor)}
                  aria-hidden="true"/>
        )}
        {children}
    </DropdownMenu.Item>
));
RadixMenuItem.displayName = 'RadixMenuItem';


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    const [selectedTask] = useAtom(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    const [localTagsString, setLocalTagsString] = useState('');
    const [tagInputValue, setTagInputValue] = useState('');

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
    const [isTagsPopoverOpen, setIsTagsPopoverOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isProgressDropdownOpen, setIsProgressDropdownOpen] = useState(false);
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);

    const [isProgressTooltipOpen, setIsProgressTooltipOpen] = useState(false);
    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    const [isListTooltipOpen, setIsListTooltipOpen] = useState(false);
    const [isPriorityTooltipOpen, setIsPriorityTooltipOpen] = useState(false);
    const [isTagsTooltipOpen, setIsTagsTooltipOpen] = useState(false);
    const [isInfoTooltipOpen, setIsInfoTooltipOpen] = useState(false);


    const titleInputRef = useRef<HTMLInputElement>(null);
    const tagInputElementRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const latestTitleRef = useRef(localTitle);
    const latestContentRef = useRef(localContent);
    const latestTagsStringRef = useRef(localTagsString);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            savePendingChanges();
        };
    }, []);

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
        const currentTagsString = latestTagsStringRef.current;

        const processedTitle = currentTitle.trim();
        const processedDueDate = currentDueDate && isValid(currentDueDate) ? startOfDay(currentDueDate).getTime() : null;
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
                prevTasks.map((t) => (t.id === originalTaskState.id ? {...t, ...changesToSave} : t))
            );
        }
        hasUnsavedChangesRef.current = false;
    }, [selectedTask, setTasks, localDueDate]);

    useEffect(() => {
        savePendingChanges();

        if (selectedTask) {
            const isTitleFocused = titleInputRef.current === document.activeElement;
            const isTagsFocused = tagInputElementRef.current === document.activeElement;
            const isContentFocused = editorRef.current?.getView()?.hasFocus ?? false;

            if (!isTitleFocused) {
                setLocalTitle(selectedTask.title);
                latestTitleRef.current = selectedTask.title;
            }
            if (!isContentFocused) {
                setLocalContent(selectedTask.content || '');
                latestContentRef.current = selectedTask.content || '';
            }
            const taskDueDate = safeParseDate(selectedTask.dueDate);
            const validTaskDueDate = taskDueDate && isValid(taskDueDate) ? startOfDay(taskDueDate) : undefined;
            setLocalDueDate(validTaskDueDate);

            const taskTagsString = (selectedTask.tags ?? []).join(', ');
            if (!isTagsFocused) {
                setLocalTagsString(taskTagsString);
                latestTagsStringRef.current = taskTagsString;
                setTagInputValue('');
            }

            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

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
            setLocalTagsString('');
            latestTagsStringRef.current = '';
            setTagInputValue('');
            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setIsDeleteDialogOpen(false);
            setIsDatePickerOpen(false);
            setIsListDropdownOpen(false);
            setIsPriorityDropdownOpen(false);
            setIsTagsPopoverOpen(false);
            setIsMoreActionsOpen(false);
            setIsProgressDropdownOpen(false);
            setIsInfoPopoverOpen(false);
        }
    }, [selectedTask]); // Only depend on selectedTask, not its ID, for proper re-sync


    useEffect(() => {
        latestTitleRef.current = localTitle;
    }, [localTitle]);
    useEffect(() => {
        latestContentRef.current = localContent;
    }, [localContent]);
    useEffect(() => {
        latestTagsStringRef.current = localTagsString;
    }, [localTagsString]);

    const triggerSave = useCallback(() => {
        if (!selectedTask || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            savePendingChanges();
        }, 700);
    }, [selectedTask, savePendingChanges]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        if (!selectedTask || !isMountedRef.current) return;
        if (hasUnsavedChangesRef.current) savePendingChanges();
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        hasUnsavedChangesRef.current = false;
        setTasks(prevTasks => prevTasks.map(t => (t.id === selectedTask.id ? {
            ...t, ...updates,
            updatedAt: Date.now()
        } : t)));
    }, [selectedTask, setTasks, savePendingChanges]);

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
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [updateTask]);

    const closeDatePickerPopover = useCallback(() => {
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);


    const handleListChange = useCallback((newList: string) => updateTask({list: newList}), [updateTask]);
    const handlePriorityChange = useCallback((newPriority: number | null) => updateTask({priority: newPriority}), [updateTask]);
    const handleProgressChange = useCallback((newPercentage: number | null) => updateTask({completionPercentage: newPercentage}), [updateTask]);

    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        const currentPercentage = selectedTask.completionPercentage ?? 0;
        let nextPercentage: number | null = null;
        if (currentPercentage === 100) nextPercentage = null;
        else nextPercentage = 100;
        updateTask({completionPercentage: nextPercentage});
    }, [selectedTask, updateTask]);

    const openDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({list: 'Trash', completionPercentage: null});
        setSelectedTaskId(null);
    }, [selectedTask, updateTask, setSelectedTaskId]);

    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        updateTask({list: 'Inbox'});
    }, [selectedTask, updateTask]);

    const handleDuplicateTask = useCallback(() => {
        if (!selectedTask) return;
        const now = Date.now();
        const newTaskData: Partial<Task> = {
            ...selectedTask,
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: `${selectedTask.title} (Copy)`,
            order: selectedTask.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: selectedTask.completionPercentage === 100 ? null : selectedTask.completionPercentage,
        };
        delete newTaskData.groupCategory;

        setTasks(prev => {
            const index = prev.findIndex(t => t.id === selectedTask.id);
            const newTasks = [...prev];
            newTasks.splice(index !== -1 ? index + 1 : prev.length, 0, newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!);
        setIsMoreActionsOpen(false);
    }, [selectedTask, setTasks, setSelectedTaskId]);

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

    const tagsArray = useMemo(() => localTagsString.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), [localTagsString]);
    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => (selectedTask?.completionPercentage ?? 0) === 100 && !isTrash, [selectedTask?.completionPercentage, isTrash]);
    const isTagHandlingDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);

    const addTag = useCallback((tagToAdd: string) => {
        const trimmedTag = tagToAdd.trim();
        if (!trimmedTag || isTagHandlingDisabled) return;
        const currentTags = localTagsString.split(',').map(t => t.trim()).filter(Boolean);
        if (!currentTags.includes(trimmedTag)) {
            const newTagsString = [...currentTags, trimmedTag].join(', ');
            setLocalTagsString(newTagsString);
            triggerSave();
        }
        setTagInputValue('');
    }, [localTagsString, isTagHandlingDisabled, triggerSave]);

    const removeTag = useCallback((tagToRemove: string) => {
        if (isTagHandlingDisabled) return;
        const newTagsArray = tagsArray.filter(t => t !== tagToRemove);
        setLocalTagsString(newTagsArray.join(', '));
        triggerSave();
        tagInputElementRef.current?.focus();
    }, [tagsArray, isTagHandlingDisabled, triggerSave]);

    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isTagHandlingDisabled) return;
        const value = tagInputValue.trim();
        if ((e.key === 'Enter' || e.key === ',') && value) {
            e.preventDefault();
            addTag(value);
        } else if (e.key === 'Backspace' && tagInputValue === '' && tagsArray.length > 0) {
            e.preventDefault();
            removeTag(tagsArray[tagsArray.length - 1]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setTagInputValue('');
            (e.target as HTMLInputElement).blur();
            setIsTagsPopoverOpen(false);
            setIsTagsTooltipOpen(false);
        }
    }, [tagInputValue, tagsArray, addTag, removeTag, isTagHandlingDisabled]);

    const handleTagInputBlur = useCallback(() => {
        const value = tagInputValue.trim();
        if (value && !isTagHandlingDisabled) addTag(value);
        savePendingChanges();
    }, [tagInputValue, addTag, isTagHandlingDisabled, savePendingChanges]);

    const handleTagContainerClick = useCallback(() => {
        if (!isTagHandlingDisabled) tagInputElementRef.current?.focus();
    }, [isTagHandlingDisabled]);

    const priorityMap: Record<number, { label: string; icon: IconName; color: string }> = useMemo(() => ({
        1: {label: 'High', icon: 'flag', color: 'text-red-500 dark:text-red-400'},
        2: {label: 'Medium', icon: 'flag', color: 'text-orange-500 dark:text-orange-400'},
        3: {label: 'Low', icon: 'flag', color: 'text-blue-500 dark:text-blue-400'},
        4: {label: 'Lowest', icon: 'flag', color: 'text-gray-500 dark:text-neutral-400'},
    }), []);

    const displayDueDateForPicker = localDueDate;
    const displayDueDateForRender = localDueDate ?? safeParseDate(selectedTask?.dueDate);
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);

    const displayPriority = selectedTask?.priority;
    const displayList = selectedTask?.list;
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt) : '', [selectedTask?.createdAt]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt) : '', [selectedTask?.updatedAt]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    // Main panel class removed width, it's handled by MainPage
    const mainPanelClass = useMemo(() => twMerge(
        "h-full flex flex-col shadow-2xl z-20", // No width here
        "bg-gradient-to-br from-neutral-100/80 to-neutral-200/70 dark:from-neutral-800/80 dark:to-neutral-900/70",
        "backdrop-blur-2xl border-l border-neutral-200/70 dark:border-neutral-700/60"
    ), []);

    const headerClass = useMemo(() => twMerge(
        "px-4 py-2 h-16 flex items-center justify-between flex-shrink-0",
        "border-b border-neutral-200/60 dark:border-neutral-700/50"
    ), []);

    const titleInputClasses = useMemo(() => twMerge(
        "flex-1 text-xl font-semibold border-none focus:ring-0 focus:outline-none bg-transparent p-0 mx-3 leading-tight",
        "placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal",
        (isCompleted || isTrash) && "line-through text-neutral-500 dark:text-neutral-400",
        "text-neutral-800 dark:text-neutral-100 tracking-tight"
    ), [isCompleted, isTrash]);

    const editorContainerClass = useMemo(() => twMerge(
        "flex-1 min-h-0 flex flex-col relative", // min-h-0 is crucial
        "prose dark:prose-invert max-w-none prose-sm prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2"
    ), []);

    const editorClasses = useMemo(() => twMerge(
        "!min-h-full h-full text-sm !bg-transparent !border-none !shadow-none", // Ensure it takes full height
        (isCompleted || isTrash) && "opacity-60",
        isTrash && "pointer-events-none",
        "dark:!text-neutral-300"
    ), [isCompleted, isTrash]);

    const footerClass = useMemo(() => twMerge(
        "px-3 py-2 h-12 flex items-center justify-between flex-shrink-0",
        "border-t border-neutral-200/60 dark:border-neutral-700/50"
    ), []);

    const footerButtonClass = useMemo(() => twMerge(
        "text-neutral-500 dark:text-neutral-400",
        "hover:bg-neutral-500/10 dark:hover:bg-neutral-700/50 hover:text-neutral-700 dark:hover:text-neutral-200",
        "focus-visible:ring-offset-neutral-100 dark:focus-visible:ring-offset-neutral-900"
    ), []);

    const dropdownContentClasses = "min-w-[200px] z-[65] bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-1 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";
    const datePickerContentClasses = "z-[65] p-0 border-0 shadow-none bg-transparent data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";
    const tagsPopoverContentClasses = "min-w-[280px] z-[65] bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-3 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";

    const tooltipContentClass = "text-xs bg-black/80 dark:bg-neutral-900/90 text-white dark:text-neutral-100 px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName},
        {label: 'Halfway (50%)', value: 50, icon: 'circle-dot' as IconName},
        {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName},
    ], []);
    const progressStatusText = useMemo(() => {
        const p = selectedTask?.completionPercentage;
        if (p === 100) return "Completed";
        if (p && p > 0) return `${p}% Complete`;
        return "Not Started";
    }, [selectedTask?.completionPercentage]);


    if (!selectedTask) return null; // This component will be unmounted by AnimatePresence in MainPage

    return (
        <>
            <div className={mainPanelClass}> {/* Root div for TaskDetail */}

                {/* Header */}
                <div className={headerClass}>
                    <ProgressIndicator
                        percentage={selectedTask.completionPercentage} isTrash={isTrash}
                        onClick={cycleCompletionPercentage}
                        size={24} className="flex-shrink-0" ariaLabelledby={`task-title-input-${selectedTask.id}`}
                    />
                    <input
                        ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                        onKeyDown={handleTitleKeyDown} onBlur={savePendingChanges}
                        className={titleInputClasses} placeholder="Task title..." disabled={isTrash}
                        aria-label="Task title" id={`task-title-input-${selectedTask.id}`}
                    />
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
                            <DropdownMenu.Trigger asChild>
                                <Button variant="ghost" size="icon" icon="more-horizontal"
                                        className={twMerge(footerButtonClass, "w-8 h-8")} aria-label="More actions"/>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className={dropdownContentClasses} sideOffset={5} align="end">
                                    <RadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}>Duplicate
                                        Task</RadixMenuItem>
                                    <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                    {isTrash ? (
                                        <RadixMenuItem icon="arrow-left" onSelect={handleRestore}
                                                       className="text-green-600 dark:text-green-500 data-[highlighted]:!bg-green-500/15 data-[highlighted]:!text-green-700 dark:data-[highlighted]:!text-green-400">Restore
                                            Task</RadixMenuItem>
                                    ) : (
                                        <RadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>Move to
                                            Trash</RadixMenuItem>
                                    )}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        <Button variant="ghost" size="icon" icon="x" onClick={handleClose}
                                className={twMerge(footerButtonClass, "w-8 h-8")} aria-label="Close task details"/>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div
                    className="flex-1 overflow-y-auto p-4 md:p-5 styled-scrollbar-thin flex flex-col"> {/* Added flex flex-col */}
                    <div className={editorContainerClass}> {/* This now correctly uses flex-1 and min-h-0 */}
                        <CodeMirrorEditor
                            ref={editorRef} value={localContent} onChange={handleContentChange}
                            onBlur={savePendingChanges}
                            placeholder="Add notes, links, or details here... Markdown is supported."
                            className={editorClasses} readOnly={isTrash}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className={footerClass}>
                    <div className="flex items-center space-x-0.5">
                        <Tooltip.Provider>
                            <DropdownMenu.Root
                                open={isProgressDropdownOpen}
                                onOpenChange={(open) => {
                                    setIsProgressDropdownOpen(open);
                                    if (!open) setIsProgressTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isProgressTooltipOpen}
                                              onOpenChange={setIsProgressTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <DropdownMenu.Trigger asChild disabled={isTrash}>
                                            <Button variant="ghost" size="icon" icon="circle-gauge"
                                                    className={twMerge(footerButtonClass, "w-8 h-8")}
                                                    aria-label={`Progress: ${progressStatusText}`}/>
                                        </DropdownMenu.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>{`Progress: ${progressStatusText}`}<Tooltip.Arrow
                                        className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={dropdownContentClasses}
                                        sideOffset={5}
                                        align="start"
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        {progressMenuItems.map(item => (
                                            <RadixMenuItem
                                                key={item.label} icon={item.icon}
                                                selected={selectedTask?.completionPercentage === item.value || (selectedTask?.completionPercentage === null && item.value === null)}
                                                onSelect={() => handleProgressChange(item.value)}>
                                                {item.label}
                                            </RadixMenuItem>
                                        ))}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </Tooltip.Provider>

                        <Tooltip.Provider>
                            <Popover.Root
                                open={isDatePickerOpen}
                                onOpenChange={(open) => {
                                    setIsDatePickerOpen(open);
                                    if (!open) setIsDateTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isDateTooltipOpen}
                                              onOpenChange={setIsDateTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <Popover.Trigger asChild disabled={isTrash}>
                                            <Button variant="ghost" size="icon" icon="calendar"
                                                    className={twMerge(footerButtonClass, "w-8 h-8", overdue && !isCompleted && !isTrash && "text-red-500 dark:text-red-400")}
                                                    aria-label="Set due date"/>
                                        </Popover.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>
                                        {displayDueDateForRender && isValid(displayDueDateForRender) ? `Due: ${formatRelativeDate(displayDueDateForRender)}` : 'Set Due Date'}
                                        <Tooltip.Arrow
                                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root>
                                <Popover.Portal>
                                    <Popover.Content
                                        className={datePickerContentClasses}
                                        sideOffset={5}
                                        align="start"
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <CustomDatePickerContent initialDate={displayDueDateForPicker}
                                                                 onSelect={handleDatePickerSelect}
                                                                 closePopover={closeDatePickerPopover}/>
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </Tooltip.Provider>

                        <Tooltip.Provider>
                            <DropdownMenu.Root
                                open={isListDropdownOpen}
                                onOpenChange={(open) => {
                                    setIsListDropdownOpen(open);
                                    if (!open) setIsListTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isListTooltipOpen}
                                              onOpenChange={setIsListTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <DropdownMenu.Trigger asChild disabled={isTrash}>
                                            <Button variant="ghost" size="icon"
                                                    icon={displayList === "Inbox" ? "inbox" : "list"}
                                                    className={twMerge(footerButtonClass, "w-8 h-8")}
                                                    aria-label="Change list"/>
                                        </DropdownMenu.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>List: {displayList}<Tooltip.Arrow
                                        className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={twMerge(dropdownContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                                        sideOffset={5}
                                        align="start"
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <DropdownMenu.RadioGroup value={displayList} onValueChange={handleListChange}>
                                            {availableLists.map(list => (
                                                <DropdownMenu.RadioItem key={list} value={list}
                                                                        className={twMerge(
                                                                            "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                                            "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                                            "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                                            "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100"
                                                                        )}>
                                                    <Icon name={list === 'Inbox' ? 'inbox' : 'list'} size={14}
                                                          className="mr-1.5 opacity-70"/>{list}
                                                </DropdownMenu.RadioItem>
                                            ))}
                                        </DropdownMenu.RadioGroup>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </Tooltip.Provider>

                        <Tooltip.Provider>
                            <DropdownMenu.Root
                                open={isPriorityDropdownOpen}
                                onOpenChange={(open) => {
                                    setIsPriorityDropdownOpen(open);
                                    if (!open) setIsPriorityTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isPriorityTooltipOpen}
                                              onOpenChange={setIsPriorityTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <DropdownMenu.Trigger asChild disabled={isTagHandlingDisabled}>
                                            <Button variant="ghost" size="icon" icon="flag"
                                                    className={twMerge(footerButtonClass, "w-8 h-8", displayPriority && priorityMap[displayPriority]?.color)}
                                                    aria-label="Set priority"/>
                                        </DropdownMenu.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>
                                        {displayPriority ? `Priority: P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'}
                                        <Tooltip.Arrow
                                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={dropdownContentClasses}
                                        sideOffset={5}
                                        align="start"
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <DropdownMenu.RadioGroup value={String(displayPriority ?? 'none')}
                                                                 onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>
                                            {[null, 1, 2, 3, 4].map(p => (
                                                <DropdownMenu.RadioItem key={p ?? 'none'} value={String(p ?? 'none')}
                                                                        className={twMerge(
                                                                            "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                                            "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                                            p && priorityMap[p]?.color,
                                                                            "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                                            !p && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100"
                                                                        )}>
                                                    {p && <Icon name="flag" size={14}
                                                                className="mr-1.5"/>}{p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                                </DropdownMenu.RadioItem>
                                            ))}
                                        </DropdownMenu.RadioGroup>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </Tooltip.Provider>

                        <Tooltip.Provider>
                            <Popover.Root
                                open={isTagsPopoverOpen}
                                onOpenChange={(open) => {
                                    setIsTagsPopoverOpen(open);
                                    if (!open) setIsTagsTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isTagsTooltipOpen}
                                              onOpenChange={setIsTagsTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <Popover.Trigger asChild disabled={isTagHandlingDisabled}>
                                            <Button variant="ghost" size="icon" icon="tag"
                                                    className={twMerge(footerButtonClass, "w-8 h-8")}
                                                    aria-label="Manage tags"/>
                                        </Popover.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>
                                        {tagsArray.length > 0 ? `Tags: ${tagsArray.join(', ')}` : 'Add Tags'}
                                        <Tooltip.Arrow
                                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root>
                                <Popover.Portal>
                                    <Popover.Content
                                        className={tagsPopoverContentClasses}
                                        sideOffset={5}
                                        align="start"
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={twMerge("flex items-center flex-wrap bg-transparent rounded-sm w-full min-h-[28px] px-1.5 py-1 backdrop-blur-sm", isTagHandlingDisabled ? "opacity-60 cursor-not-allowed bg-transparent" : "hover:bg-white/15 dark:hover:bg-white/5 focus-within:bg-white/20 dark:focus-within:bg-white/10 cursor-text")}
                                            onClick={handleTagContainerClick} aria-disabled={isTagHandlingDisabled}>
                                            {tagsArray.map((tag) => (
                                                <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)}
                                                         disabled={isTagHandlingDisabled}/>))}
                                            <input ref={tagInputElementRef} type="text" value={tagInputValue}
                                                   onChange={(e) => setTagInputValue(e.target.value)}
                                                   onKeyDown={handleTagInputKeyDown} onBlur={handleTagInputBlur}
                                                   placeholder={tagsArray.length === 0 ? "Add tag..." : ""}
                                                   className={twMerge("flex-1 text-xs border-none focus:ring-0 bg-transparent p-0 m-0 h-[22px] min-w-[60px] self-center", "placeholder:text-muted dark:placeholder:text-neutral-500 placeholder:font-normal", "disabled:bg-transparent disabled:cursor-not-allowed", "dark:text-neutral-300")}
                                                   disabled={isTagHandlingDisabled}
                                                   aria-label="Add a new tag (use comma or Enter to confirm)"/>
                                        </div>
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </Tooltip.Provider>
                    </div>

                    <div className="flex items-center">
                        <Tooltip.Provider>
                            <Popover.Root
                                open={isInfoPopoverOpen}
                                onOpenChange={(open) => {
                                    setIsInfoPopoverOpen(open);
                                    if (!open) setIsInfoTooltipOpen(false);
                                }}
                            >
                                <Tooltip.Root delayDuration={200} open={isInfoTooltipOpen}
                                              onOpenChange={setIsInfoTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <Popover.Trigger asChild>
                                            <Button variant="ghost" size="icon" icon="info"
                                                    className={twMerge(footerButtonClass, "w-8 h-8")}
                                                    aria-label="View task information"/>
                                        </Popover.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className={tooltipContentClass} side="top" sideOffset={6}>
                                            Task Information
                                            <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                                <Popover.Portal>
                                    <Popover.Content
                                        className={twMerge(dropdownContentClasses, "p-3 text-xs w-auto")}
                                        side="top"
                                        align="end"
                                        sideOffset={5}
                                        onCloseAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                                            <p><strong
                                                className="font-medium text-neutral-700 dark:text-neutral-200">Created:</strong> {displayCreatedAt}
                                            </p>
                                            <p><strong
                                                className="font-medium text-neutral-700 dark:text-neutral-200">Updated:</strong> {displayUpdatedAt}
                                            </p>
                                        </div>
                                    </Popover.Content>
                                </Popover.Portal>
                            </Popover.Root>
                        </Tooltip.Provider>
                    </div>
                </div>
            </div>

            <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm} onConfirm={confirmDelete}
                                     taskTitle={selectedTask.title || 'Untitled Task'}/>
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;