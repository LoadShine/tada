// src/components/tasks/TaskDetail.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate,} from '@/utils/dateUtils';
import {Subtask, Task} from '@/types';
import {twMerge} from 'tailwind-merge';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import {ProgressIndicator} from './TaskItem'; // Import from TaskItem
import {IconName} from "@/components/common/IconMap";
// import SelectionCheckboxRadix from "@/components/common/SelectionCheckbox"; // Not directly used here
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {arrayMove, SortableContext, verticalListSortingStrategy} from "@dnd-kit/sortable";
// import {CSS} from "@dnd-kit/utilities"; // Not used directly here
import {AnimatePresence, motion} from "framer-motion";
import SubtaskItemDetail from "./SubtaskItemDetail"; // Import the modified SubtaskItemDetail

// --- Helper TagPill Component (Kept for potential future re-use, but not actively used if tags are removed from footer) ---
interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

const TagPill: React.FC<TagPillProps> = React.memo(({tag, onRemove, disabled}) => (
    <span
        className={twMerge(
            "inline-flex items-center bg-black/5 dark:bg-white/5 text-gray-600 dark:text-neutral-300 rounded px-1.5 py-0.5 text-[11px] mr-1 mb-1 group/pill whitespace-nowrap backdrop-blur-sm",
            "transition-colors duration-100 ease-apple",
            disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-black/10 dark:hover:bg-white/10"
        )}
        aria-label={`Tag: ${tag}${disabled ? ' (disabled)' : ''}`}
    >
        {tag}
        {!disabled && (
            <button type="button" onClick={(e) => {
                e.stopPropagation();
                onRemove();
            }}
                    className="ml-1 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-0.5 flex items-center justify-center"
                    aria-label={`Remove tag ${tag}`} tabIndex={-1}>
                <Icon name="x" size={9} strokeWidth={2.5}/>
            </button>
        )}
    </span>
));
TagPill.displayName = 'TagPill';


// --- Reusable Radix Dropdown Menu Item Component (Styled to align with TaskItemRadixMenuItem) ---
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
            "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 font-normal",
            isDanger
                ? "text-red-600 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300"
                : "data-[highlighted]:bg-black/[.07] dark:data-[highlighted]:bg-white/[.07] focus:bg-black/[.07] dark:focus:bg-white/[.07]",
            selected && !isDanger && "bg-primary/15 text-primary data-[highlighted]:bg-primary/20 dark:bg-primary/25 dark:text-primary-light dark:data-[highlighted]:bg-primary/30",
            !selected && !isDanger && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 focus:text-gray-800 dark:focus:text-neutral-50",
            "data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        {icon && (<Icon name={icon} size={15} className={twMerge("mr-2 flex-shrink-0 opacity-70", iconColor)}
                        aria-hidden="true"/>)}
        <span className="flex-grow">{children}</span>
    </DropdownMenu.Item>
));
RadixMenuItem.displayName = 'RadixMenuItem';

// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    const [selectedTaskInternal] = useAtom(selectedTaskAtom); // Renamed to avoid conflict
    const selectedTask = useAtomValue(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    const [localTagsString, setLocalTagsString] = useState(''); // Kept for task tags
    const latestTagsStringRef = useRef(localTagsString);


    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isFooterDatePickerOpen, setIsFooterDatePickerOpen] = useState(false);
    const [isHeaderMenuDatePickerOpen, setIsHeaderMenuDatePickerOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);

    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    const [isInfoTooltipOpen, setIsInfoTooltipOpen] = useState(false);

    // Subtask related states...
    // const [editingSubtaskContentId, setEditingSubtaskContentId] = useState<string | null>(null); // REMOVED
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const newSubtaskInputRef = useRef<HTMLInputElement>(null);
    const [draggingSubtaskId, setDraggingSubtaskId] = useState<UniqueIdentifier | null>(null);

    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
    const latestTitleRef = useRef(localTitle);
    const latestContentRef = useRef(localContent);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (selectedTaskInternal) { // Use selectedTaskInternal from atom for saving on unmount
                savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
            }
        };
    }, [selectedTaskInternal]); // Added selectedTaskInternal to dependency array

    const savePendingChanges = useCallback((taskId: string, title: string, content: string, dueDate: Date | undefined, tagsString: string) => {
        if (!taskId || !hasUnsavedChangesRef.current || !isMountedRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        const processedTitle = title.trim();
        const processedDueDateTimestamp = dueDate && isValid(dueDate) ? dueDate.getTime() : null;
        const processedTags = tagsString.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

        setTasks(prevTasks => {
            const originalTaskState = prevTasks.find(t => t.id === taskId); // Find from prevTasks
            if (!originalTaskState) return prevTasks;

            const changesToSave: Partial<Task> = {};
            if (processedTitle !== originalTaskState.title) changesToSave.title = processedTitle || "Untitled Task";
            if (content !== (originalTaskState.content || '')) changesToSave.content = content;

            const originalDueTime = originalTaskState.dueDate ?? null;
            if (processedDueDateTimestamp !== originalDueTime) changesToSave.dueDate = processedDueDateTimestamp;

            const originalTagsSorted = (originalTaskState.tags ?? []).slice().sort();
            const processedTagsSorted = processedTags.slice().sort();
            if (JSON.stringify(processedTagsSorted) !== JSON.stringify(originalTagsSorted)) changesToSave.tags = processedTags;

            if (Object.keys(changesToSave).length > 0) {
                return prevTasks.map(t => (t.id === taskId ? {
                    ...t, ...changesToSave,
                    updatedAt: Date.now()
                } : t));
            }
            return prevTasks;
        });

        hasUnsavedChangesRef.current = false;
    }, [setTasks]);


    useEffect(() => {
        const prevTaskId = selectedTaskInternal?.id;
        if (prevTaskId && hasUnsavedChangesRef.current) {
            savePendingChanges(prevTaskId, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
        }

        // setEditingSubtaskContentId(null); // REMOVED
        setNewSubtaskTitle('');
        hasUnsavedChangesRef.current = false;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        if (selectedTask) {
            const taskTitle = selectedTask.title;
            const taskContent = selectedTask.content || '';
            const taskDueDateObj = safeParseDate(selectedTask.dueDate);
            const taskTagsString = (selectedTask.tags ?? []).join(', ');

            if (localTitle !== taskTitle) setLocalTitle(taskTitle);
            if (localContent !== taskContent) setLocalContent(taskContent);
            if (localDueDate?.getTime() !== taskDueDateObj?.getTime()) setLocalDueDate(taskDueDateObj && isValid(taskDueDateObj) ? taskDueDateObj : undefined);
            if (localTagsString !== taskTagsString) setLocalTagsString(taskTagsString);

            latestTitleRef.current = taskTitle;
            latestContentRef.current = taskContent;
            latestTagsStringRef.current = taskTagsString;

            if (taskTitle === '' &&
                document.activeElement !== titleInputRef.current &&
                !editorRef.current?.getView()?.hasFocus) {
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

            setIsDeleteDialogOpen(false);
            setIsFooterDatePickerOpen(false);
            setIsHeaderMenuDatePickerOpen(false);
            setIsMoreActionsOpen(false);
            setIsInfoPopoverOpen(false);
        }
    }, [selectedTask, savePendingChanges, localDueDate, localTagsString, selectedTaskInternal, localTitle, localContent]);


    const triggerSave = useCallback(() => {
        if (!selectedTaskInternal || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            if (selectedTaskInternal) { // Check again inside timeout
                savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
            }
        }, 700);
    }, [selectedTaskInternal, localDueDate, savePendingChanges]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        if (!selectedTaskInternal || !isMountedRef.current) return;
        if (hasUnsavedChangesRef.current) {
            // Check again before direct update
            if (selectedTaskInternal) savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
        }
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        hasUnsavedChangesRef.current = false;

        setTasks(prevTasks => prevTasks.map(t => (t.id === selectedTaskInternal.id ? {
            ...t, ...updates,
            updatedAt: Date.now()
        } : t)));
    }, [selectedTaskInternal, setTasks, localDueDate, savePendingChanges]);

    const handleClose = useCallback(() => {
        if (selectedTaskInternal) {
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
        }
        setSelectedTaskId(null);
    }, [selectedTaskInternal, setSelectedTaskId, localDueDate, savePendingChanges]);

    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
        latestTitleRef.current = e.target.value;
        triggerSave();
    }, [triggerSave]);

    const handleContentChange = useCallback((newValue: string) => {
        setLocalContent(newValue);
        latestContentRef.current = newValue;
        triggerSave();
    }, [triggerSave]);

    const handleMainContentBlur = useCallback(() => {
        if (hasUnsavedChangesRef.current && selectedTaskInternal) {
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
        }
    }, [selectedTaskInternal, localDueDate, savePendingChanges]);

    const handleFooterDatePickerSelect = useCallback((dateWithTime: Date | undefined) => {
        setLocalDueDate(dateWithTime);
        updateTask({dueDate: dateWithTime ? dateWithTime.getTime() : null});
        setIsFooterDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [updateTask]);

    const closeFooterDatePickerPopover = useCallback(() => {
        setIsFooterDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);

    const handleHeaderMenuDateSelect = useCallback((dateWithTime: Date | undefined) => {
        setLocalDueDate(dateWithTime);
        updateTask({dueDate: dateWithTime ? dateWithTime.getTime() : null});
        setIsHeaderMenuDatePickerOpen(false);
    }, [updateTask]);

    const closeHeaderMenuDatePickerPopover = useCallback(() => {
        setIsHeaderMenuDatePickerOpen(false);
    }, []);

    const handleListChange = useCallback((newList: string) => updateTask({list: newList}), [updateTask]);
    const handlePriorityChange = useCallback((newPriority: number | null) => updateTask({priority: newPriority}), [updateTask]);
    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completionPercentage: newPercentage});
        if (newPercentage === 100 && selectedTask?.id === selectedTaskId) {
            // Optionally close or handle completion side effects
        }
    }, [updateTask, selectedTask?.id, selectedTaskId]);

    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        const currentPercentage = selectedTask.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
    }, [selectedTask, updateTask]);

    const openDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);

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

    const handleDuplicateTask = useCallback(() => {
        if (!selectedTask) return;
        if (hasUnsavedChangesRef.current && selectedTaskInternal) {
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        hasUnsavedChangesRef.current = false;

        const now = Date.now();
        const newParentTaskId = `task-${now}-${Math.random().toString(16).slice(2)}`;
        const taskToDuplicate = selectedTask;

        const duplicatedSubtasks = (taskToDuplicate.subtasks || []).map(sub => ({
            ...sub, // content will not be spread if not in Subtask type
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: newParentTaskId,
            createdAt: now,
            updatedAt: now,
            completedAt: sub.completed ? now : null,
        }));
        const newTaskData: Partial<Task> = {
            ...taskToDuplicate,
            id: newParentTaskId,
            title: `${taskToDuplicate.title || 'Untitled Task'} (Copy)`,
            order: taskToDuplicate.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: taskToDuplicate.completionPercentage === 100 ? null : taskToDuplicate.completionPercentage,
            subtasks: duplicatedSubtasks,
        };
        delete newTaskData.groupCategory;

        setTasks(prev => {
            const index = prev.findIndex(t => t.id === taskToDuplicate.id);
            const newTasks = [...prev];
            newTasks.splice(index !== -1 ? index + 1 : prev.length, 0, newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!);
        setIsMoreActionsOpen(false);
    }, [selectedTask, setTasks, setSelectedTaskId, savePendingChanges, selectedTaskInternal, localDueDate]);


    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedTaskInternal) savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate, latestTagsStringRef.current);
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
    }, [selectedTask, selectedTaskInternal, localTitle, localDueDate, savePendingChanges]); // Added selectedTaskInternal

    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => (selectedTask?.completionPercentage ?? 0) === 100 && !isTrash, [selectedTask?.completionPercentage, isTrash]);
    const isInteractiveDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);

    const handleAddSubtask = useCallback(() => {
        if (!selectedTask || !newSubtaskTitle.trim() || isInteractiveDisabled) return;
        const now = Date.now();
        const newSub: Subtask = {
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`, parentId: selectedTask.id,
            title: newSubtaskTitle.trim(), completed: false, completedAt: null,
            order: (selectedTask.subtasks?.reduce((max, s) => Math.max(max, s.order), 0) || 0) + 1000,
            createdAt: now, updatedAt: now, dueDate: null, // content: '' REMOVED
        };
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: [...(t.subtasks || []), newSub].sort((a, b) => a.order - b.order)
        } : t));
        setNewSubtaskTitle('');
        newSubtaskInputRef.current?.focus();
    }, [selectedTask, newSubtaskTitle, setTasks, isInteractiveDisabled]);

    const handleUpdateSubtask = useCallback((subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'parentId' | 'createdAt'>>) => {
        if (!selectedTask) return;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: (t.subtasks || []).map(sub => sub.id === subtaskId ? {
                ...sub, ...updates,
                updatedAt: Date.now()
            } : sub)
        } : t));
    }, [selectedTask, setTasks]);

    const handleDeleteSubtask = useCallback((subtaskId: string) => {
        if (!selectedTask) return;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: (t.subtasks || []).filter(sub => sub.id !== subtaskId)
        } : t));
        // if (editingSubtaskContentId === subtaskId) setEditingSubtaskContentId(null); // REMOVED
    }, [selectedTask, setTasks]);

    // const handleToggleEditSubtaskContent = (subtaskId: string | null) => { // REMOVED
    //     setEditingSubtaskContentId(currentId => currentId === subtaskId ? null : subtaskId);
    // };

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 3}}), useSensor(KeyboardSensor, {
        // coordinateGetter: sortableKeyboardCoordinates // Keep if SubtaskItemDetail has keyboard interaction for sorting
    }));
    const handleSubtaskDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === 'subtask-item-detail') setDraggingSubtaskId(event.active.id.toString().replace('subtask-detail-', ''));
    };
    const handleSubtaskDragEnd = (event: DragEndEvent) => {
        setDraggingSubtaskId(null);
        const {active, over} = event;
        if (!selectedTask || !active || !over || active.id === over.id) return;
        if (active.data.current?.type !== 'subtask-item-detail' || over.data.current?.type !== 'subtask-item-detail') return;
        const activeId = active.id.toString().replace('subtask-detail-', '');
        const overId = over.id.toString().replace('subtask-detail-', '');
        const oldIndex = selectedTask.subtasks?.findIndex(s => s.id === activeId) ?? -1;
        const newIndex = selectedTask.subtasks?.findIndex(s => s.id === overId) ?? -1;
        if (oldIndex !== -1 && newIndex !== -1 && selectedTask.subtasks) {
            const reorderedSubtasksRaw = arrayMove(selectedTask.subtasks, oldIndex, newIndex);
            const finalSubtasks = reorderedSubtasksRaw.map((sub, index) => ({...sub, order: (index + 1) * 1000}));
            setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {...t, subtasks: finalSubtasks} : t));
        }
    };

    const displayDueDateForPicker = localDueDate;
    const displayDueDateForRender = localDueDate ?? safeParseDate(selectedTask?.dueDate);
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt) : '', [selectedTask]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt) : '', [selectedTask]);

    const mainPanelClass = useMemo(() => twMerge(
        "h-full flex flex-col", // Removed shadow & z-index, handled by drawer/container
        "bg-neutral-50 dark:bg-neutral-850",
        // "border-l border-neutral-200 dark:border-neutral-700/70" // Border handled by container in MainPage
    ), []);

    const headerClass = useMemo(() => twMerge(
        "px-4 py-2 h-14 flex items-center justify-between flex-shrink-0",
        "border-b border-neutral-200/80 dark:border-neutral-700/60"
    ), []);

    const titleInputClasses = useMemo(() => twMerge(
        "flex-1 text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 mx-3 leading-tight",
        "placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal",
        (isInteractiveDisabled) && "line-through text-neutral-500/80 dark:text-neutral-400/80",
        "text-neutral-800 dark:text-neutral-100 tracking-tight"
    ), [isInteractiveDisabled]);

    const editorContainerClass = useMemo(() => twMerge(
        "flex-1 min-h-0 overflow-hidden",
        "prose dark:prose-invert max-w-none prose-sm prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2"
    ), []);

    const editorClasses = useMemo(() => twMerge(
        "!h-full text-sm !bg-transparent !border-none !shadow-none",
        (isInteractiveDisabled) && "opacity-60 cursor-not-allowed",
        isTrash && "pointer-events-none",
        "dark:!text-neutral-300"
    ), [isInteractiveDisabled, isTrash]);

    const footerClass = useMemo(() => twMerge(
        "px-3 py-2 h-11 flex items-center justify-between flex-shrink-0",
        "border-t border-neutral-200/80 dark:border-neutral-700/60"
    ), []);

    const actionButtonClass = useMemo(() => twMerge(
        "text-neutral-500 dark:text-neutral-400",
        "hover:bg-neutral-500/10 dark:hover:bg-neutral-700/50",
        "hover:text-neutral-700 dark:hover:text-neutral-200",
        "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1",
        "focus-visible:ring-offset-neutral-50 dark:focus-visible:ring-offset-neutral-850"
    ), []);

    const dropdownContentClasses = useMemo(() => twMerge(
        "z-[55] bg-white dark:bg-neutral-800 min-w-[200px] w-52 p-1 rounded-base shadow-modal",
        "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide"
    ), []);

    const headerMenuDatePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[60] p-0 bg-white dark:bg-neutral-800 rounded-base shadow-modal",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    const radioItemClasses = (isSelected: boolean, itemSpecificClasses: string = "", isDanger: boolean = false) => twMerge(
        "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 font-normal",
        isDanger
            ? "text-red-600 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300"
            : "data-[highlighted]:bg-black/[.07] dark:data-[highlighted]:bg-white/[.07] focus:bg-black/[.07] dark:focus:bg-white/[.07]",
        isSelected && !isDanger && "bg-primary/15 text-primary data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary dark:bg-primary/25 dark:text-primary-light data-[state=checked]:dark:bg-primary/25 data-[state=checked]:dark:text-primary-light",
        !isSelected && !isDanger && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 focus:text-gray-800 dark:focus:text-neutral-50",
        "data-[state=checked]:data-[highlighted]:bg-primary/20 data-[state=checked]:dark:data-[highlighted]:bg-primary/30",
        "data-[disabled]:opacity-50",
        itemSpecificClasses
    );

    const tooltipContentClass = useMemo(() => twMerge(
        "text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[75]",
        "data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
    ), []);

    const subTriggerClasses = useMemo(() => twMerge(
        "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
        "text-gray-700 dark:text-neutral-200",
        "focus:bg-black/[.07] dark:focus:bg-white/[.07]",
        "data-[highlighted]:bg-black/[.07] dark:data-[highlighted]:bg-white/[.07]",
        "data-[state=open]:bg-black/[.07] dark:data-[state=open]:bg-white/[.07]",
        "focus:text-gray-800 dark:focus:text-neutral-50",
        "data-[highlighted]:text-gray-800 dark:data-[highlighted]:text-neutral-50",
        "data-[state=open]:text-gray-800 dark:data-[state=open]:text-neutral-50",
        "data-[disabled]:opacity-50"
    ), []);

    const priorityMap: Record<number, {
        label: string;
        icon: IconName;
        color: string
    }> = useMemo(() => ({
        1: {label: 'High', icon: 'flag', color: 'text-red-500 dark:text-red-400'},
        2: {label: 'Medium', icon: 'flag', color: 'text-orange-500 dark:text-orange-400'},
        3: {label: 'Low', icon: 'flag', color: 'text-blue-500 dark:text-blue-400'},
        4: {label: 'Lowest', icon: 'flag', color: 'text-gray-500 dark:text-neutral-400'},
    }), []);

    const progressMenuItems = useMemo(() => [{
        label: 'Not Started', value: null, icon: 'circle' as IconName
    }, {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName}, {
        label: 'Halfway (50%)', value: 50, icon: 'circle-dot' as IconName
    }, {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName}, {
        label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName
    },], []);

    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    const handleMoreActionsDropdownCloseFocus = useCallback((event: Event) => {
        if (isHeaderMenuDatePickerOpen) {
            event.preventDefault();
        }
    }, [isHeaderMenuDatePickerOpen]);

    const sortedSubtasks = useMemo(() => {
        if (!selectedTask?.subtasks) return [];
        return [...selectedTask.subtasks].sort((a, b) => a.order - b.order);
    }, [selectedTask?.subtasks]);

    if (!selectedTask) return null;

    return (
        <>
            <div className={mainPanelClass}>
                <div className={headerClass}>
                    <ProgressIndicator percentage={selectedTask.completionPercentage} isTrash={isTrash}
                                       onClick={cycleCompletionPercentage} size={22} className="flex-shrink-0"
                                       ariaLabelledby={`task-title-input-${selectedTask.id}`}/>
                    <input ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                           onKeyDown={handleTitleKeyDown} onBlur={handleMainContentBlur} className={titleInputClasses}
                           placeholder="Task title..." disabled={isTrash} aria-label="Task title"
                           id={`task-title-input-${selectedTask.id}`}/>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <Popover.Root modal={true} open={isHeaderMenuDatePickerOpen}
                                      onOpenChange={setIsHeaderMenuDatePickerOpen}>
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
                                <Popover.Anchor asChild>
                                    <DropdownMenu.Trigger asChild>
                                        <Button ref={moreActionsButtonRef} variant="ghost" size="icon"
                                                icon="more-horizontal"
                                                className={twMerge(actionButtonClass, "w-8 h-8")}
                                                aria-label="More actions"/>
                                    </DropdownMenu.Trigger>
                                </Popover.Anchor>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={dropdownContentClasses}
                                        sideOffset={5}
                                        align="end"
                                        onCloseAutoFocus={handleMoreActionsDropdownCloseFocus}
                                    >
                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={subTriggerClasses}>
                                                <Icon name="circle-gauge" size={15} className="mr-2 opacity-70"/>
                                                Set Progress
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1.5}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent className={dropdownContentClasses}
                                                                         sideOffset={2} alignOffset={-5}>
                                                    {progressMenuItems.map(item => (
                                                        <RadixMenuItem
                                                            key={item.label}
                                                            icon={item.icon}
                                                            selected={selectedTask?.completionPercentage === item.value || (selectedTask?.completionPercentage === null && item.value === null)}
                                                            onSelect={() => handleProgressChange(item.value)}
                                                            disabled={isTrash}
                                                        >
                                                            {item.label}
                                                        </RadixMenuItem>
                                                    ))}
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>

                                        <RadixMenuItem
                                            icon="calendar-plus"
                                            onSelect={(event) => {
                                                event.preventDefault();
                                                setIsHeaderMenuDatePickerOpen(true);
                                            }}
                                            disabled={isTrash}
                                        >
                                            Set Due Date...
                                        </RadixMenuItem>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>

                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={subTriggerClasses}
                                                                     disabled={isInteractiveDisabled}>
                                                <Icon name="flag" size={15} className="mr-2 opacity-70"/>
                                                Priority
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1.5}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent className={dropdownContentClasses}
                                                                         sideOffset={2} alignOffset={-5}>
                                                    <DropdownMenu.RadioGroup
                                                        value={String(selectedTask.priority ?? 'none')}
                                                        onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}
                                                    >
                                                        {[null, 1, 2, 3, 4].map(p => (
                                                            <DropdownMenu.RadioItem
                                                                key={p ?? 'none'}
                                                                value={String(p ?? 'none')}
                                                                className={radioItemClasses(
                                                                    selectedTask.priority === p,
                                                                    p ? priorityMap[p]?.color : ""
                                                                )}
                                                                disabled={isInteractiveDisabled}
                                                            >
                                                                <Icon name={p ? priorityMap[p]?.icon : "flag"} size={15}
                                                                      className={twMerge("mr-2 flex-shrink-0 opacity-70", p ? priorityMap[p]?.color : "opacity-50")}/>
                                                                <span
                                                                    className="flex-grow">{p ? `P${p} ${priorityMap[p]?.label}` : 'None'}</span>
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger className={subTriggerClasses} disabled={isTrash}>
                                                <Icon name="folder" size={15} className="mr-2 opacity-70"/>
                                                Move to List
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1.5}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={twMerge(dropdownContentClasses, "max-h-40 overflow-y-auto styled-scrollbar-thin")}
                                                    sideOffset={2} alignOffset={-5}>
                                                    <DropdownMenu.RadioGroup
                                                        value={selectedTask.list}
                                                        onValueChange={handleListChange}
                                                    >
                                                        {availableLists.map(list => (
                                                            <DropdownMenu.RadioItem
                                                                key={list}
                                                                value={list}
                                                                className={radioItemClasses(selectedTask.list === list)}
                                                                disabled={isTrash}
                                                            >
                                                                <Icon name={list === 'Inbox' ? 'inbox' : 'list'}
                                                                      size={15}
                                                                      className="mr-2 flex-shrink-0 opacity-70"/>
                                                                <span className="flex-grow">{list}</span>
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                        <RadixMenuItem icon="copy-plus"
                                                       onSelect={handleDuplicateTask}
                                                       disabled={isTrash}>
                                            Duplicate Task
                                        </RadixMenuItem>
                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                        {isTrash ? (
                                            <RadixMenuItem icon="arrow-left"
                                                           onSelect={handleRestore}
                                                           className="text-green-600 dark:text-green-500 data-[highlighted]:!bg-green-500/15 data-[highlighted]:!text-green-700 dark:data-[highlighted]:!text-green-400">
                                                Restore Task
                                            </RadixMenuItem>
                                        ) : (
                                            <RadixMenuItem icon="trash" onSelect={openDeleteConfirm}
                                                           isDanger>
                                                Move to Trash
                                            </RadixMenuItem>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <Popover.Portal>
                                <Popover.Content
                                    className={headerMenuDatePickerPopoverWrapperClasses}
                                    sideOffset={5}
                                    align="end"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => {
                                        e.preventDefault();
                                        moreActionsButtonRef.current?.focus();
                                    }}
                                >
                                    <CustomDatePickerContent
                                        initialDate={localDueDate ?? undefined}
                                        onSelect={handleHeaderMenuDateSelect}
                                        closePopover={closeHeaderMenuDatePickerPopover}
                                    />
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                        <Button variant="ghost" size="icon" icon="x" onClick={handleClose}
                                className={twMerge(actionButtonClass, "w-8 h-8")}
                                aria-label="Close task details"/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar-thin flex flex-col">
                    <div className={twMerge(editorContainerClass, "p-5 pb-3")}>
                        <CodeMirrorEditor ref={editorRef} value={localContent} onChange={handleContentChange}
                                          onBlur={handleMainContentBlur}
                                          placeholder="Add notes, links, or details here... Markdown is supported."
                                          className={editorClasses} readOnly={isInteractiveDisabled}/>
                    </div>
                    <div
                        className={twMerge(
                            "px-5 pt-4 pb-5 border-t border-neutral-200/50 dark:border-neutral-700/40",
                            "flex-shrink-0 flex flex-col",
                            sortedSubtasks.length > 0 ? "max-h-[45vh]" : "" // Max height for subtask area
                        )}
                    >
                        {sortedSubtasks.length > 0 && (
                            <>
                                <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                    <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                                        Subtasks
                                        <span
                                            className="ml-2 font-normal text-xs text-muted-foreground dark:text-neutral-400">
                                            ({sortedSubtasks.filter(s => s.completed).length} of {sortedSubtasks.length} completed)
                                        </span>
                                    </h3>
                                </div>
                                <div
                                    className="flex-1 overflow-y-auto styled-scrollbar-thin -mx-2 pr-2 mb-3 min-h-[80px]">
                                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                                                onDragStart={handleSubtaskDragStart} onDragEnd={handleSubtaskDragEnd}
                                                measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                                        <SortableContext items={sortedSubtasks.map(s => `subtask-detail-${s.id}`)}
                                                         strategy={verticalListSortingStrategy}>
                                            <div className="space-y-0.5">
                                                {sortedSubtasks.map(subtask => (
                                                    <SubtaskItemDetail
                                                        key={subtask.id} subtask={subtask}
                                                        onUpdate={handleUpdateSubtask}
                                                        onDelete={handleDeleteSubtask}
                                                        // isEditingContentForThis={editingSubtaskContentId === subtask.id} // REMOVED
                                                        // onToggleEditContent={handleToggleEditSubtaskContent} // REMOVED
                                                        isTaskCompletedOrTrashed={isInteractiveDisabled}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                        <DragOverlay dropAnimation={null}>
                                            {draggingSubtaskId && selectedTask.subtasks?.find(s => s.id === draggingSubtaskId) ? (
                                                <SubtaskItemDetail
                                                    subtask={selectedTask.subtasks.find(s => s.id === draggingSubtaskId)!}
                                                    onUpdate={() => {
                                                    }}
                                                    onDelete={() => {
                                                    }}
                                                    // isEditingContentForThis={false} // REMOVED
                                                    // onToggleEditContent={() => {}} // REMOVED
                                                    isTaskCompletedOrTrashed={isInteractiveDisabled}
                                                    isDraggingOverlay={true}
                                                />
                                            ) : null}
                                        </DragOverlay>
                                    </DndContext>
                                </div>
                            </>
                        )}

                        {!isInteractiveDisabled && (
                            <div
                                className={twMerge(
                                    "flex items-center flex-shrink-0 h-10 pt-2.5",
                                    sortedSubtasks.length > 0 ? "border-t border-neutral-200/40 dark:border-neutral-700/30 mt-auto" : "mt-1"
                                )}>
                                <input
                                    ref={newSubtaskInputRef} type="text" value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newSubtaskTitle.trim()) handleAddSubtask();
                                        if (e.key === 'Escape') setNewSubtaskTitle('');
                                    }}
                                    placeholder="+ Add subtask..."
                                    className={twMerge(
                                        "flex-1 text-[13px] h-7 px-3 rounded-md transition-all duration-150 ease-apple",
                                        "bg-neutral-200/50 dark:bg-neutral-700/40",
                                        "border border-neutral-300/60 dark:border-neutral-600/80",
                                        "focus:bg-white/70 dark:focus:bg-neutral-700/60 focus:border-primary/60 dark:focus:border-primary/70 focus:ring-1 focus:ring-primary/30 dark:focus:ring-primary/40",
                                        "placeholder:text-neutral-500/80 dark:placeholder:text-neutral-400/70",
                                        "text-neutral-800 dark:text-neutral-100",
                                        "focus:outline-none"
                                    )}
                                    aria-label="New subtask title"
                                />
                                <AnimatePresence>
                                    {newSubtaskTitle.trim() && (
                                        <motion.div initial={{opacity: 0, scale: 0.8}} animate={{opacity: 1, scale: 1}}
                                                    exit={{opacity: 0, scale: 0.8}} transition={{duration: 0.15}}>
                                            <Button variant="primary" size="sm" onClick={handleAddSubtask}
                                                    className="!h-7 !px-2.5 ml-2 !text-xs">Add</Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                <div className={footerClass}>
                    <div className="flex items-center space-x-0.5">
                        <Tooltip.Provider><Popover.Root open={isFooterDatePickerOpen} onOpenChange={(open) => {
                            setIsFooterDatePickerOpen(open);
                            if (!open) setIsDateTooltipOpen(false);
                        }}>
                            <Tooltip.Root delayDuration={300} open={isDateTooltipOpen}
                                          onOpenChange={setIsDateTooltipOpen}>
                                <Tooltip.Trigger asChild>
                                    <Popover.Trigger asChild disabled={isTrash}>
                                        <Button variant="ghost" size="icon" icon="calendar"
                                                className={twMerge(actionButtonClass, "w-8 h-8", overdue && !isCompleted && !isTrash && "text-red-500 dark:text-red-400")}
                                                aria-label="Set due date"/>
                                    </Popover.Trigger>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className={tooltipContentClass} side="top" sideOffset={6}>
                                        {displayDueDateForRender && isValid(displayDueDateForRender) ? `Due: ${formatRelativeDate(displayDueDateForRender, true)}` : 'Set Due Date'}
                                        <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                            <Popover.Portal>
                                <Popover.Content
                                    className={twMerge(
                                        "z-[65] bg-white dark:bg-neutral-800 backdrop-blur-md rounded-lg shadow-lg border border-black/10 dark:border-white/10 p-0",
                                        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
                                    )}
                                    sideOffset={5}
                                    align="start"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}>
                                    <CustomDatePickerContent initialDate={displayDueDateForPicker}
                                                             onSelect={handleFooterDatePickerSelect}
                                                             closePopover={closeFooterDatePickerPopover}/>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root></Tooltip.Provider>
                    </div>

                    <div className="flex items-center">
                        <Tooltip.Provider><Popover.Root open={isInfoPopoverOpen} onOpenChange={(open) => {
                            setIsInfoPopoverOpen(open);
                            if (!open) setIsInfoTooltipOpen(false);
                        }}>
                            <Tooltip.Root delayDuration={300} open={isInfoTooltipOpen}
                                          onOpenChange={setIsInfoTooltipOpen}>
                                <Tooltip.Trigger asChild>
                                    <Popover.Trigger asChild>
                                        <Button variant="ghost" size="icon" icon="info"
                                                className={twMerge(actionButtonClass, "w-8 h-8")}
                                                aria-label="View task information"/>
                                    </Popover.Trigger>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className={tooltipContentClass} side="top" sideOffset={6}>
                                        Task Information
                                        <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900/95"/>
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                            <Popover.Portal>
                                <Popover.Content
                                    className={twMerge(dropdownContentClasses, "p-3 text-xs w-auto")}
                                    side="top" align="end" sideOffset={5}
                                    onCloseAutoFocus={(e) => e.preventDefault()}>
                                    <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                                        <p>
                                            <strong
                                                className="font-medium text-neutral-700 dark:text-neutral-200">Created:</strong>
                                            {displayCreatedAt}
                                        </p>
                                        <p><strong
                                            className="font-medium text-neutral-700 dark:text-neutral-200">Updated:</strong> {displayUpdatedAt}
                                        </p>
                                    </div>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root></Tooltip.Provider>
                    </div>
                </div>
            </div>
            {selectedTask && (
                <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm}
                                         onConfirm={confirmDelete}
                                         itemTitle={selectedTask.title || 'Untitled Task'}
                                         title="Move to Trash?"
                                         confirmText="Move to Trash"
                                         confirmVariant="danger"
                />
            )}
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;