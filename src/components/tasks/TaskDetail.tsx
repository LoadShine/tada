import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    preferencesSettingsAtom,
    selectedTaskAtom,
    selectedTaskIdAtom,
    tasksAtom,
    userListNamesAtom,
} from '@/store/atoms'; // Added preferencesSettingsAtom
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
import AddTagsPopoverContent from '../common/AddTagsPopoverContent';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import {ProgressIndicator} from './TaskItem';
import {IconName} from "@/components/common/IconMap";
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
import {AnimatePresence, motion} from "framer-motion";
import SubtaskItemDetail from "./SubtaskItemDetail";

// --- Helper TagPill Component --- (as previously defined)
interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

const TagPill: React.FC<TagPillProps> = React.memo(({tag, onRemove, disabled}) => (
    <span
        className={twMerge(
            "inline-flex items-center bg-black/5 dark:bg-white/5 text-grey-medium dark:text-neutral-300 rounded px-1.5 py-0.5 text-[11px] mr-1 mb-1 group/pill whitespace-nowrap backdrop-blur-sm",
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
                    className="ml-1 text-grey-medium/70 dark:text-neutral-500 hover:text-error dark:hover:text-red-400 opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-0.5 flex items-center justify-center"
                    aria-label={`Remove tag ${tag}`} tabIndex={-1}>
                <Icon name="x" size={9} strokeWidth={2.5}/>
            </button>
        )}
    </span>
));
TagPill.displayName = 'TagPill';


interface RadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const RadixMenuItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenu.Item>,
    RadixMenuItemProps
>(({
       icon,
       iconColor,
       selected,
       children,
       className,
       isDanger = false,
       ...props
   }, ref) => (
    <DropdownMenu.Item
        ref={ref}
        className={twMerge(
            "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
            isDanger
                ? "text-error data-[highlighted]:bg-error/10 data-[highlighted]:text-error dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300"
                : selected
                    ? "bg-primary-light text-primary data-[highlighted]:bg-primary-light/90 dark:bg-primary-dark/30 dark:text-primary-light dark:data-[highlighted]:bg-primary-dark/40"
                    : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
            !isDanger && !selected && "data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-700",
            "data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        {icon && (<Icon name={icon} size={14} strokeWidth={1.5}
                        className={twMerge("mr-2 flex-shrink-0 opacity-80", iconColor)}
                        aria-hidden="true"/>)}
        <span className="flex-grow">{children}</span>
    </DropdownMenu.Item>
));
RadixMenuItem.displayName = 'RadixMenuItem';

const TaskDetail: React.FC = () => {
    const [selectedTaskInternal] = useAtom(selectedTaskAtom);
    const selectedTask = useAtomValue(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const preferences = useAtomValue(preferencesSettingsAtom); // Added for confirmDeletions

    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isFooterDatePickerOpen, setIsFooterDatePickerOpen] = useState(false);
    const [isHeaderMenuDatePickerOpen, setIsHeaderMenuDatePickerOpen] = useState(false);
    const [isHeaderMenuTagsPopoverOpen, setIsHeaderMenuTagsPopoverOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);

    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    const [isInfoTooltipOpen, setIsInfoTooltipOpen] = useState(false);

    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | undefined>(undefined);
    const [isNewSubtaskDatePickerOpen, setIsNewSubtaskDatePickerOpen] = useState(false);
    const [subtaskDateTextWidth, setSubtaskDateTextWidth] = useState(0);
    const newSubtaskDateDisplayRef = useRef<HTMLSpanElement>(null);
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

    const noPriorityBgColor = 'bg-grey-light dark:bg-neutral-600';

    const popoverContentWrapperClasses = useMemo(() => twMerge(
        "z-[70] bg-white rounded-base shadow-popover dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (selectedTaskInternal) {
                savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
            }
        };
    }, [selectedTaskInternal, localDueDate]); // savePendingChanges is memoized

    const savePendingChanges = useCallback((taskId: string, title: string, content: string, dueDate: Date | undefined) => {
        if (!taskId || !hasUnsavedChangesRef.current || !isMountedRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        const processedTitle = title.trim();
        const processedDueDateTimestamp = dueDate && isValid(dueDate) ? dueDate.getTime() : null;

        setTasks(prevTasks => {
            const originalTaskState = prevTasks.find(t => t.id === taskId);
            if (!originalTaskState) return prevTasks;

            const changesToSave: Partial<Task> = {};
            if (processedTitle !== originalTaskState.title) changesToSave.title = processedTitle || "Untitled Task";
            if (content !== (originalTaskState.content || '')) changesToSave.content = content;

            const originalDueTime = originalTaskState.dueDate ?? null;
            if (processedDueDateTimestamp !== originalDueTime) changesToSave.dueDate = processedDueDateTimestamp;

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
            savePendingChanges(prevTaskId, latestTitleRef.current, latestContentRef.current, localDueDate);
        }

        setNewSubtaskTitle('');
        setNewSubtaskDueDate(undefined);
        hasUnsavedChangesRef.current = false;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        if (selectedTask) {
            const taskTitle = selectedTask.title;
            const taskContent = selectedTask.content || '';
            const taskDueDateObj = safeParseDate(selectedTask.dueDate);

            if (localTitle !== taskTitle) setLocalTitle(taskTitle);
            if (localContent !== taskContent) setLocalContent(taskContent);
            if (localDueDate?.getTime() !== taskDueDateObj?.getTime()) setLocalDueDate(taskDueDateObj && isValid(taskDueDateObj) ? taskDueDateObj : undefined);

            latestTitleRef.current = taskTitle;
            latestContentRef.current = taskContent;

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

            setNewSubtaskTitle('');
            setNewSubtaskDueDate(undefined);

            setIsDeleteDialogOpen(false);
            setIsFooterDatePickerOpen(false);
            // setIsMoreActionsOpen(false); // Handled by its own onOpenChange
            setIsInfoPopoverOpen(false);
            setIsHeaderMenuDatePickerOpen(false);
            setIsHeaderMenuTagsPopoverOpen(false);
        }
    }, [selectedTask, savePendingChanges, localDueDate, selectedTaskInternal, localTitle, localContent]);

    useEffect(() => {
        if (newSubtaskDueDate && newSubtaskDateDisplayRef.current) {
            setSubtaskDateTextWidth(newSubtaskDateDisplayRef.current.offsetWidth);
        } else {
            setSubtaskDateTextWidth(0);
        }
    }, [newSubtaskDueDate, isNewSubtaskDatePickerOpen]);


    const triggerSave = useCallback(() => {
        if (!selectedTaskInternal || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            if (selectedTaskInternal) {
                savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
            }
        }, 700);
    }, [selectedTaskInternal, localDueDate, savePendingChanges]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        if (!selectedTaskInternal || !isMountedRef.current) return;
        if (hasUnsavedChangesRef.current) {
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
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
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
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
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
        }
    }, [selectedTaskInternal, localDueDate, savePendingChanges]);

    const handleFooterDatePickerSelect = useCallback((dateWithTime: Date | undefined) => {
        setLocalDueDate(dateWithTime);
        updateTask({dueDate: dateWithTime ? dateWithTime.getTime() : null});
        setIsFooterDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [updateTask]);

    const handleTagsApply = useCallback((newTags: string[]) => {
        updateTask({tags: newTags});
    }, [updateTask]);


    const closeFooterDatePickerPopover = useCallback(() => {
        setIsFooterDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);

    const handleHeaderMenuPopoverOpenChange = useCallback((open: boolean, type: 'date' | 'tags') => {
        if (open) {
            if (type === 'date') {
                setIsHeaderMenuDatePickerOpen(true);
                setIsHeaderMenuTagsPopoverOpen(false); // Ensure other popover is closed
            } else if (type === 'tags') {
                setIsHeaderMenuTagsPopoverOpen(true);
                setIsHeaderMenuDatePickerOpen(false); // Ensure other popover is closed
            }
        } else {
            // This will be called when the popover requests to be closed
            // (e.g. by its own close button, or an outside interaction if not prevented)
            if (type === 'date') setIsHeaderMenuDatePickerOpen(false);
            if (type === 'tags') setIsHeaderMenuTagsPopoverOpen(false);
        }
    }, [setIsHeaderMenuDatePickerOpen, setIsHeaderMenuTagsPopoverOpen]);


    const closeHeaderMenuDatePickerPopover = useCallback(() => {
        handleHeaderMenuPopoverOpenChange(false, 'date');
    }, [handleHeaderMenuPopoverOpenChange]);

    const closeHeaderMenuTagsPopover = useCallback(() => {
        handleHeaderMenuPopoverOpenChange(false, 'tags');
    }, [handleHeaderMenuPopoverOpenChange]);


    const handleListChange = useCallback((newList: string) => {
        updateTask({list: newList});
        setIsMoreActionsOpen(false);
    }, [updateTask]);

    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({priority: newPriority});
    }, [updateTask]);

    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completionPercentage: newPercentage});
    }, [updateTask]);

    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        const currentPercentage = selectedTask.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
    }, [selectedTask, updateTask]);

    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);

    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({list: 'Trash', completionPercentage: null});
        setSelectedTaskId(null);
        closeDeleteConfirm();
        setIsMoreActionsOpen(false); // Ensure dropdown closes if delete happens via modal
    }, [selectedTask, updateTask, setSelectedTaskId, closeDeleteConfirm]);

    const handleDeleteTask = useCallback(() => {
        if (preferences.confirmDeletions) {
            setIsDeleteDialogOpen(true);
        } else {
            confirmDelete();
        }
    }, [preferences.confirmDeletions, confirmDelete, setIsDeleteDialogOpen]);


    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        updateTask({list: 'Inbox'});
    }, [selectedTask, updateTask]);

    const handleDuplicateTask = useCallback(() => {
        if (!selectedTask) return;
        if (hasUnsavedChangesRef.current && selectedTaskInternal) {
            savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        hasUnsavedChangesRef.current = false;

        const now = Date.now();
        const newParentTaskId = `task-${now}-${Math.random().toString(16).slice(2)}`;
        const taskToDuplicate = selectedTask;

        const duplicatedSubtasks = (taskToDuplicate.subtasks || []).map(sub => ({
            ...sub,
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
            if (selectedTaskInternal) savePendingChanges(selectedTaskInternal.id, latestTitleRef.current, latestContentRef.current, localDueDate);
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
    }, [selectedTask, selectedTaskInternal, localTitle, localDueDate, savePendingChanges]);

    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => (selectedTask?.completionPercentage ?? 0) === 100 && !isTrash, [selectedTask?.completionPercentage, isTrash]);
    const isInteractiveDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);

    const handleAddSubtask = useCallback(() => {
        if (!selectedTask || !newSubtaskTitle.trim() || isInteractiveDisabled) return;
        const now = Date.now();
        const newSub: Subtask = {
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: selectedTask.id,
            title: newSubtaskTitle.trim(),
            completed: false,
            completedAt: null,
            order: (selectedTask.subtasks?.reduce((max, s) => Math.max(max, s.order), 0) || 0) + 1000,
            createdAt: now,
            updatedAt: now,
            dueDate: newSubtaskDueDate ? newSubtaskDueDate.getTime() : null,
        };
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: [...(t.subtasks || []), newSub].sort((a, b) => a.order - b.order)
        } : t));
        setNewSubtaskTitle('');
        setNewSubtaskDueDate(undefined);
        newSubtaskInputRef.current?.focus();
    }, [selectedTask, newSubtaskTitle, setTasks, isInteractiveDisabled, newSubtaskDueDate]);

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
    }, [selectedTask, setTasks]);

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 3}}), useSensor(KeyboardSensor, {}));
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
        "h-full flex flex-col",
        "bg-white dark:bg-neutral-850",
    ), []);

    const headerClass = useMemo(() => twMerge(
        "px-4 py-2 h-[56px] flex items-center justify-between flex-shrink-0",
        "border-b border-grey-light dark:border-neutral-700/60",
        "bg-white dark:bg-neutral-850"
    ), []);

    const taskListPriorityMap: Record<number, {
        label: string;
        iconColor: string;
        bgColor: string;
        shortLabel: string;
    }> = {
        1: {label: 'High Priority', iconColor: 'text-error', bgColor: 'bg-error', shortLabel: 'P1'},
        2: {label: 'Medium Priority', iconColor: 'text-warning', bgColor: 'bg-warning', shortLabel: 'P2'},
        3: {label: 'Low Priority', iconColor: 'text-info', bgColor: 'bg-info', shortLabel: 'P3'},
    };

    const priorityDotBgColor = useMemo(() => {
        if (!selectedTask) return '';
        if (selectedTask.priority && taskListPriorityMap[selectedTask.priority]) {
            return taskListPriorityMap[selectedTask.priority].bgColor;
        }
        return noPriorityBgColor;
    }, [selectedTask, taskListPriorityMap, noPriorityBgColor]);

    const priorityDotLabel = useMemo(() => {
        if (!selectedTask) return '';
        if (selectedTask.priority && taskListPriorityMap[selectedTask.priority]) {
            return taskListPriorityMap[selectedTask.priority].label;
        }
        return 'No Priority';
    }, [selectedTask, taskListPriorityMap]);

    const titleInputClasses = useMemo(() => twMerge(
        "flex-1 text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 leading-tight",
        "placeholder:text-grey-medium dark:placeholder:text-neutral-500 placeholder:font-normal",
        (isInteractiveDisabled) && "line-through text-grey-medium dark:text-neutral-400/80",
        "text-grey-dark dark:text-neutral-100 tracking-tight"
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
        "px-4 py-2 h-11 flex items-center justify-between flex-shrink-0",
        "border-t border-grey-light dark:border-neutral-700/60",
        "bg-white dark:bg-neutral-850"
    ), []);

    const actionButtonClass = useMemo(() => twMerge(
        "text-grey-medium dark:text-neutral-400",
        "hover:bg-grey-ultra-light dark:hover:bg-neutral-700/50",
        "hover:text-grey-dark dark:hover:text-neutral-200",
        "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-850"
    ), []);

    const footerDateTriggerClass = useMemo(() => twMerge(
        "h-8 flex items-center text-xs px-2 py-1 rounded-base transition-colors duration-150",
        "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-850",
        "hover:bg-grey-ultra-light dark:hover:bg-neutral-700/50",
        (displayDueDateForRender && isValid(displayDueDateForRender))
            ? (overdue && !isCompleted && !isTrash ? "text-error dark:text-red-400 font-medium" : "text-primary dark:text-primary-light font-medium")
            : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200",
        isTrash && "cursor-not-allowed opacity-60"
    ), [displayDueDateForRender, overdue, isCompleted, isTrash]);

    const dropdownContentClasses = useMemo(() => twMerge(
        "z-[60] min-w-[180px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide"
    ), []);

    const subtaskDatePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    const newSubtaskInputPaddingLeft = useMemo(() => {
        const iconAreaSpace = 28;
        let dateTextSpace = 0;
        if (newSubtaskDueDate && subtaskDateTextWidth > 0) {
            dateTextSpace = 4 + subtaskDateTextWidth + 4;
        }
        return iconAreaSpace + dateTextSpace;
    }, [newSubtaskDueDate, subtaskDateTextWidth]);

    const getRadioItemClasses = (isSelected: boolean) => twMerge(
        "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
        "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
        "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
        isSelected
            ? "bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light"
            : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
        "data-[disabled]:opacity-50"
    );

    const getSubTriggerClasses = () => twMerge(
        "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
        "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light",
        "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 dark:data-[state=open]:bg-neutral-700",
        "text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark",
        "dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100",
        "data-[disabled]:opacity-50"
    );

    const tooltipContentClass = useMemo(() => twMerge(
        "text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[75]",
        "data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
    ), []);

    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName, iconStroke: 1.5},
        {label: 'In Progress', value: 30, icon: 'circle-dot-dashed' as IconName, iconStroke: 1.5},
        {label: 'Mostly Done', value: 60, icon: 'circle-dot' as IconName, iconStroke: 1.5},
        {label: 'Completed', value: 100, icon: 'circle-check' as IconName, iconStroke: 2},
    ], []);

    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    const handleMoreActionsDropdownCloseFocus = useCallback((event: Event) => {
        if (isHeaderMenuDatePickerOpen || isHeaderMenuTagsPopoverOpen) {
            event.preventDefault();
        } else if (moreActionsButtonRef.current) {
            moreActionsButtonRef.current.focus();
        }
    }, [isHeaderMenuDatePickerOpen, isHeaderMenuTagsPopoverOpen]);

    const sortedSubtasks = useMemo(() => {
        if (!selectedTask?.subtasks) return [];
        return [...selectedTask.subtasks].sort((a, b) => a.order - b.order);
    }, [selectedTask?.subtasks]);

    if (!selectedTask) return null;

    const headerMenuSubPopoverSideOffset = 5;

    return (
        <>
            <div className={mainPanelClass}>
                <div className={headerClass}>
                    <div className="flex items-center flex-1 min-w-0 gap-x-2.5 mr-3">
                        <ProgressIndicator
                            percentage={selectedTask.completionPercentage}
                            isTrash={isTrash}
                            onClick={cycleCompletionPercentage}
                            size={22}
                            className="flex-shrink-0"
                            ariaLabelledby={`task-title-input-${selectedTask.id}`}
                        />

                        {!isInteractiveDisabled && selectedTask && selectedTask.priority && (
                            <Tooltip.Provider delayDuration={300}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                         <span
                                             className={twMerge(
                                                 "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                                 priorityDotBgColor
                                             )}
                                             aria-label={priorityDotLabel}
                                         />
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal>
                                        <Tooltip.Content className={tooltipContentClass} side="bottom" sideOffset={4}>
                                            {priorityDotLabel}
                                            <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900/95"/>
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        )}

                        <input
                            ref={titleInputRef}
                            type="text"
                            value={localTitle}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={handleMainContentBlur}
                            className={titleInputClasses}
                            placeholder="Task title..."
                            disabled={isTrash}
                            aria-label="Task title"
                            id={`task-title-input-${selectedTask.id}`}
                        />
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <DropdownMenu.Root
                            open={isMoreActionsOpen}
                            onOpenChange={(openState) => {
                                setIsMoreActionsOpen(openState);
                                if (!openState) {
                                    // If main dropdown closes, ensure its popovers also close
                                    handleHeaderMenuPopoverOpenChange(false, 'date');
                                    handleHeaderMenuPopoverOpenChange(false, 'tags');
                                }
                            }}
                        >
                            <DropdownMenu.Trigger asChild>
                                <Button ref={moreActionsButtonRef} variant="ghost" size="icon"
                                        icon="more-horizontal"
                                        className={twMerge(actionButtonClass, "w-8 h-8")}
                                        aria-label="More actions"/>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    id="task-detail-more-actions-content"
                                    className={dropdownContentClasses}
                                    sideOffset={5}
                                    align="end"
                                    onCloseAutoFocus={handleMoreActionsDropdownCloseFocus}
                                    onInteractOutside={(e) => {
                                        const target = e.target as HTMLElement;
                                        // If interaction is within a date/tag popover, prevent main dropdown from closing
                                        if (target.closest('[data-radix-popper-content-wrapper]') && (isHeaderMenuDatePickerOpen || isHeaderMenuTagsPopoverOpen)) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    <div
                                        className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">Progress
                                    </div>
                                    <div className="flex justify-around items-center px-1.5 py-1">
                                        {progressMenuItems.map(item => {
                                            const isSelected = (selectedTask.completionPercentage ?? null) === item.value;
                                            return (
                                                <button
                                                    key={item.label}
                                                    onClick={() => handleProgressChange(item.value)}
                                                    className={twMerge(
                                                        "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                        isSelected ? "bg-grey-ultra-light dark:bg-neutral-700 text-primary dark:text-primary-light"
                                                            : "text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-200"
                                                    )}
                                                    title={item.label}
                                                    aria-pressed={isSelected}
                                                    disabled={isInteractiveDisabled}
                                                >
                                                    <Icon name={item.icon} size={14} strokeWidth={item.iconStroke}/>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                    <div
                                        className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">Priority
                                    </div>
                                    <div className="flex justify-around items-center px-1.5 py-1">
                                        {[1, 2, 3].map(pVal => {
                                            const pData = taskListPriorityMap[pVal];
                                            const isSelected = selectedTask.priority === pVal;
                                            return (
                                                <button
                                                    key={pVal}
                                                    onClick={() => handlePriorityChange(pVal)}
                                                    className={twMerge(
                                                        "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                        pData.iconColor,
                                                        isSelected ? "bg-grey-ultra-light dark:bg-neutral-700"
                                                            : "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                                    )}
                                                    title={pData.label}
                                                    aria-pressed={isSelected}
                                                    disabled={isInteractiveDisabled}
                                                >
                                                    <Icon name="flag" size={14} strokeWidth={1.5}/>
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => handlePriorityChange(null)}
                                            className={twMerge(
                                                "flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150 ease-in-out focus:outline-none",
                                                selectedTask.priority === null
                                                    ? "text-grey-dark dark:text-neutral-200 bg-grey-ultra-light dark:bg-neutral-700"
                                                    : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-300 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700"
                                            )}
                                            title="No Priority"
                                            aria-pressed={selectedTask.priority === null}
                                            disabled={isInteractiveDisabled}
                                        >
                                            <Icon name="minus" size={14} strokeWidth={1.5}/>
                                        </button>
                                    </div>

                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                    {/* Add Tags Popover */}
                                    <Popover.Root modal={false} open={isHeaderMenuTagsPopoverOpen}
                                                  onOpenChange={(open) => handleHeaderMenuPopoverOpenChange(open, 'tags')}>
                                        <Popover.Trigger asChild>
                                            <RadixMenuItem
                                                icon="tag"
                                                onSelect={(event) => {
                                                    event.preventDefault();
                                                    handleHeaderMenuPopoverOpenChange(true, 'tags');
                                                }}
                                                disabled={isInteractiveDisabled}
                                            > Add Tags... </RadixMenuItem>
                                        </Popover.Trigger>
                                        <Popover.Portal>
                                            <Popover.Content
                                                className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                side="left" // Open to the left of the trigger item
                                                align="start" // Align top edge of popover with top edge of trigger
                                                sideOffset={headerMenuSubPopoverSideOffset} // Small gap
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onCloseAutoFocus={(e) => e.preventDefault()}
                                                onFocusOutside={(event) => event.preventDefault()}
                                            >
                                                <AddTagsPopoverContent
                                                    taskId={selectedTask.id}
                                                    initialTags={selectedTask.tags || []}
                                                    onApply={handleTagsApply}
                                                    closePopover={closeHeaderMenuTagsPopover}
                                                />
                                            </Popover.Content>
                                        </Popover.Portal>
                                    </Popover.Root>

                                    {/* Set Due Date Popover */}
                                    <Popover.Root modal={false} open={isHeaderMenuDatePickerOpen}
                                                  onOpenChange={(open) => handleHeaderMenuPopoverOpenChange(open, 'date')}>
                                        <Popover.Trigger asChild>
                                            <RadixMenuItem
                                                icon="calendar-plus"
                                                onSelect={(event) => {
                                                    event.preventDefault();
                                                    handleHeaderMenuPopoverOpenChange(true, 'date');
                                                }}
                                                disabled={isInteractiveDisabled}
                                            > Set Due Date... </RadixMenuItem>
                                        </Popover.Trigger>
                                        <Popover.Portal>
                                            <Popover.Content
                                                className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                side="left" // Open to the left of the trigger item
                                                align="start" // Align top edge of popover with top edge of trigger
                                                sideOffset={headerMenuSubPopoverSideOffset} // Small gap
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onCloseAutoFocus={(e) => e.preventDefault()}
                                                onFocusOutside={(event) => event.preventDefault()}
                                            >
                                                <CustomDatePickerContent
                                                    initialDate={displayDueDateForPicker}
                                                    onSelect={(date) => {
                                                        handleFooterDatePickerSelect(date);
                                                        closeHeaderMenuDatePickerPopover();
                                                    }}
                                                    closePopover={closeHeaderMenuDatePickerPopover}
                                                />
                                            </Popover.Content>
                                        </Popover.Portal>
                                    </Popover.Root>

                                    {/* Move to List Submenu */}
                                    <DropdownMenu.Sub>
                                        <DropdownMenu.SubTrigger
                                            className={getSubTriggerClasses()}
                                            disabled={isTrash}
                                            onPointerEnter={() => { // Explicitly close other popovers on hover/focus
                                                if (isHeaderMenuDatePickerOpen) handleHeaderMenuPopoverOpenChange(false, 'date');
                                                if (isHeaderMenuTagsPopoverOpen) handleHeaderMenuPopoverOpenChange(false, 'tags');
                                            }}
                                            onFocus={() => {
                                                if (isHeaderMenuDatePickerOpen) handleHeaderMenuPopoverOpenChange(false, 'date');
                                                if (isHeaderMenuTagsPopoverOpen) handleHeaderMenuPopoverOpenChange(false, 'tags');
                                            }}
                                        >
                                            <Icon name="folder" size={14} strokeWidth={1.5}
                                                  className="mr-2 opacity-80"/>
                                            Move to List
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                strokeWidth={1.5}
                                                                                className="opacity-70"/></div>
                                        </DropdownMenu.SubTrigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.SubContent
                                                className={twMerge(dropdownContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                                                sideOffset={2} alignOffset={-5}>
                                                <DropdownMenu.RadioGroup
                                                    value={selectedTask.list}
                                                    onValueChange={handleListChange}
                                                >
                                                    {availableLists.map(list => (
                                                        <DropdownMenu.RadioItem
                                                            key={list}
                                                            value={list}
                                                            className={getRadioItemClasses(selectedTask.list === list)}
                                                            disabled={isTrash}
                                                        >
                                                            <Icon name={list === 'Inbox' ? 'inbox' : 'list'}
                                                                  size={14} strokeWidth={1.5}
                                                                  className="mr-2 flex-shrink-0 opacity-80"/>
                                                            <span className="flex-grow">{list}</span>
                                                            <DropdownMenu.ItemIndicator
                                                                className="absolute right-2 inline-flex items-center">
                                                                <Icon name="check" size={12} strokeWidth={2}/>
                                                            </DropdownMenu.ItemIndicator>
                                                        </DropdownMenu.RadioItem>
                                                    ))}
                                                </DropdownMenu.RadioGroup>
                                            </DropdownMenu.SubContent>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Sub>

                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>
                                    <RadixMenuItem icon="copy-plus"
                                                   onSelect={handleDuplicateTask}
                                                   disabled={isTrash}>
                                        Duplicate Task
                                    </RadixMenuItem>
                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>
                                    {isTrash ? (
                                        <RadixMenuItem icon="arrow-left"
                                                       onSelect={handleRestore}
                                                       className="text-success dark:text-green-500 data-[highlighted]:!bg-green-500/10 data-[highlighted]:!text-green-600 dark:data-[highlighted]:!bg-green-500/15 dark:data-[highlighted]:!text-green-400">
                                            Restore Task
                                        </RadixMenuItem>
                                    ) : (
                                        <RadixMenuItem icon="trash" onSelect={handleDeleteTask} isDanger>
                                            Move to Trash
                                        </RadixMenuItem>
                                    )}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        <Button variant="ghost" size="icon" icon="x" onClick={handleClose}
                                className={twMerge(actionButtonClass, "w-8 h-8")}
                                aria-label="Close task details"/>
                    </div>
                </div>

                <div
                    className="flex-1 overflow-y-auto styled-scrollbar-thin flex flex-col bg-white dark:bg-neutral-850">
                    <div className={twMerge(editorContainerClass, "p-5 pb-3")}>
                        <CodeMirrorEditor ref={editorRef} value={localContent} onChange={handleContentChange}
                                          onBlur={handleMainContentBlur}
                                          placeholder="Add notes, links, or details here... Markdown is supported."
                                          className={editorClasses} readOnly={isInteractiveDisabled}/>
                    </div>
                    <div
                        className={twMerge(
                            "px-5",
                            "flex-shrink-0 flex flex-col bg-white dark:bg-neutral-850"
                        )}
                    >
                        <div className="h-px bg-grey-light/70 dark:bg-neutral-700/40 mt-2 mb-3"></div>

                        <div className={twMerge(
                            "pb-3",
                            "flex flex-col",
                            sortedSubtasks.length > 0 ? "max-h-[45vh]" : ""
                        )}>
                            {sortedSubtasks.length > 0 && (
                                <>
                                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                        <h3 className="text-sm font-semibold text-grey-dark dark:text-neutral-300">
                                            Subtasks
                                            <span
                                                className="ml-2 font-normal text-xs text-grey-medium dark:text-neutral-400">
                                                ({sortedSubtasks.filter(s => s.completed).length} of {sortedSubtasks.length} completed)
                                            </span>
                                        </h3>
                                    </div>
                                    <div
                                        className="flex-1 overflow-y-auto styled-scrollbar-thin -mx-2 pr-2 mb-3 min-h-[80px]">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter}
                                                    onDragStart={handleSubtaskDragStart}
                                                    onDragEnd={handleSubtaskDragEnd}
                                                    measuring={{droppable: {strategy: MeasuringStrategy.WhileDragging}}}>
                                            <SortableContext items={sortedSubtasks.map(s => `subtask-detail-${s.id}`)}
                                                             strategy={verticalListSortingStrategy}>
                                                <div className="space-y-0.5">
                                                    {sortedSubtasks.map(subtask => (
                                                        <SubtaskItemDetail
                                                            key={subtask.id} subtask={subtask}
                                                            onUpdate={handleUpdateSubtask}
                                                            onDelete={handleDeleteSubtask}
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
                                        "flex items-center flex-shrink-0",
                                        "pt-1.5 pb-1.5",
                                        sortedSubtasks.length > 0
                                            ? "border-t border-grey-light/50 dark:border-neutral-700/30 mt-auto"
                                            : "mt-0"
                                    )}>
                                    <div
                                        className="group relative flex items-center flex-1 h-8 bg-grey-ultra-light dark:bg-neutral-700/60 rounded-base transition-all duration-150 ease-in-out border border-transparent dark:border-transparent">
                                        <div
                                            className="absolute left-0.5 top-1/2 -translate-y-1/2 flex items-center h-full">
                                            <Popover.Root open={isNewSubtaskDatePickerOpen}
                                                          onOpenChange={setIsNewSubtaskDatePickerOpen}>
                                                <Popover.Trigger asChild>
                                                    <button
                                                        type="button"
                                                        className={twMerge(
                                                            "flex items-center justify-center w-6 h-6 rounded-l-base",
                                                            newSubtaskDueDate ? "text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary" : "text-grey-medium hover:text-grey-dark dark:text-neutral-400 dark:hover:text-neutral-200"
                                                        )}
                                                        aria-label="Set subtask due date"
                                                    >
                                                        <Icon name="calendar" size={16} strokeWidth={1.5}/>
                                                    </button>
                                                </Popover.Trigger>
                                                <Popover.Portal>
                                                    <Popover.Content
                                                        sideOffset={5}
                                                        align="start"
                                                        className={subtaskDatePickerPopoverWrapperClasses}
                                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                                        onCloseAutoFocus={(e) => {
                                                            e.preventDefault();
                                                            newSubtaskInputRef.current?.focus();
                                                        }}
                                                    >
                                                        <CustomDatePickerContent
                                                            initialDate={newSubtaskDueDate}
                                                            onSelect={(date) => {
                                                                setNewSubtaskDueDate(date ?? undefined);
                                                                setIsNewSubtaskDatePickerOpen(false);
                                                            }}
                                                            closePopover={() => setIsNewSubtaskDatePickerOpen(false)}
                                                        />
                                                    </Popover.Content>
                                                </Popover.Portal>
                                            </Popover.Root>

                                            {newSubtaskDueDate && (
                                                <div className="flex items-center pl-1 pr-1 h-full pointer-events-none">
                                                    <span
                                                        ref={newSubtaskDateDisplayRef}
                                                        className="text-[12px] text-primary dark:text-primary-light whitespace-nowrap font-medium"
                                                    >
                                                        {formatRelativeDate(newSubtaskDueDate, false)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            ref={newSubtaskInputRef} type="text" value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.nativeEvent.isComposing) {
                                                    return;
                                                }
                                                if (e.key === 'Enter' && newSubtaskTitle.trim()) handleAddSubtask();
                                                if (e.key === 'Escape') {
                                                    setNewSubtaskTitle('');
                                                    setNewSubtaskDueDate(undefined);
                                                }
                                            }}
                                            placeholder=" Add subtask..."
                                            className={twMerge(
                                                "w-full h-full pr-3 text-[13px]",
                                                "bg-transparent border-none outline-none",
                                                "text-grey-dark dark:text-neutral-100 placeholder:text-grey-medium dark:placeholder:text-neutral-400/70",
                                                "transition-colors duration-150 ease-in-out"
                                            )}
                                            style={{paddingLeft: `${newSubtaskInputPaddingLeft}px`}}
                                            aria-label="New subtask title"
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {newSubtaskTitle.trim() && (
                                            <motion.div initial={{opacity: 0, scale: 0.8}}
                                                        animate={{opacity: 1, scale: 1}}
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
                </div>

                <div className={footerClass}>
                    <div className="flex items-center">
                        <Tooltip.Provider><Popover.Root open={isFooterDatePickerOpen} onOpenChange={(open) => {
                            setIsFooterDatePickerOpen(open);
                            if (!open) setIsDateTooltipOpen(false);
                        }}>
                            <Tooltip.Root delayDuration={300} open={isDateTooltipOpen}
                                          onOpenChange={setIsDateTooltipOpen}>
                                <Tooltip.Trigger asChild>
                                    <Popover.Trigger asChild disabled={isTrash}>
                                        <button className={footerDateTriggerClass} aria-label="Set due date">
                                            {displayDueDateForRender && isValid(displayDueDateForRender)
                                                ? formatRelativeDate(displayDueDateForRender, true)
                                                : "Set Due Date"
                                            }
                                        </button>
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
                                        "z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800",
                                        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
                                    )}
                                    sideOffset={5}
                                    align="start"
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                >
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
                                    className={twMerge(dropdownContentClasses, "p-3 text-xs w-auto min-w-0")}
                                    side="top" align="end" sideOffset={5}
                                    onCloseAutoFocus={(e) => e.preventDefault()}>
                                    <div className="space-y-1.5 text-grey-medium dark:text-neutral-300">
                                        <p>
                                            <strong
                                                className="font-medium text-grey-dark dark:text-neutral-200">Created:</strong>
                                            {displayCreatedAt}
                                        </p>
                                        <p><strong
                                            className="font-medium text-grey-dark dark:text-neutral-200">Updated:</strong> {displayUpdatedAt}
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