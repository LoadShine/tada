import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtomValue, useSetAtom} from 'jotai';
import {
    defaultPreferencesSettingsForApi,
    preferencesSettingsAtom,
    preferencesSettingsLoadingAtom,
    selectedTaskAtom,
    selectedTaskIdAtom,
    tasksAtom,
    userListsAtom,
} from '@/store/jotai.ts';
import Icon from '@/components/ui/Icon.tsx';
import Button from '@/components/ui/Button.tsx';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate,} from '@/utils/dateUtils';
import {Subtask, Task, TaskGroupCategory} from '@/types';
import {twMerge} from 'tailwind-merge';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {ProgressIndicator} from './TaskItem';
import {IconName} from "@/components/ui/IconMap.ts";
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
import {useTranslation} from "react-i18next";
import storageManager from '@/services/storageManager.ts';
import CodeMirrorEditor, {CodeMirrorEditorRef} from "@/components/ui/Editor.tsx";
import AddTagsPopoverContent from "@/components/ui/TagInput.tsx";
import CustomDatePickerContent from "@/components/ui/DatePicker.tsx";
import ConfirmDeleteModalRadix from "@/components/ui/ConfirmDeleteModal.tsx";

interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

/**
 * A small pill component to display a single tag.
 */
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

/**
 * A styled wrapper around Radix UI's DropdownMenu.Item for consistent menu item appearance.
 */
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

/**
 * A full-panel component that displays the details of a selected task.
 * It allows for editing all task properties, managing subtasks, and performing actions like deletion or duplication.
 */
const TaskDetail: React.FC = () => {
    const {t} = useTranslation();
    const selectedTask = useAtomValue(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const allUserLists = useAtomValue(userListsAtom);
    const preferencesData = useAtomValue(preferencesSettingsAtom);
    const isLoadingPreferences = useAtomValue(preferencesSettingsLoadingAtom);
    const preferences = useMemo(() => preferencesData ?? defaultPreferencesSettingsForApi(), [preferencesData]);


    const [localTitle, setLocalTitle] = useState(selectedTask?.title || '');
    const [localContent, setLocalContent] = useState(selectedTask?.content || '');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(() => {
        const date = safeParseDate(selectedTask?.dueDate);
        return date && isValid(date) ? date : undefined;
    });

    // Refs to hold the latest state values for use in callbacks that might otherwise capture stale state.
    const localTitleRef = useRef(localTitle);
    const localContentRef = useRef(localContent);
    const localDueDateRef = useRef(localDueDate);
    useEffect(() => { localTitleRef.current = localTitle; }, [localTitle]);
    useEffect(() => { localContentRef.current = localContent; }, [localContent]);
    useEffect(() => { localDueDateRef.current = localDueDate; }, [localDueDate]);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
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

    const hasUnsavedChangesRef = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Saves any pending local changes (title, content, due date) to the global state.
     * This function uses refs to access the latest state, ensuring that debounced calls
     * or calls from unmount effects have the most current data.
     */
    const savePendingChanges = useCallback(() => {
        if (!selectedTask || !hasUnsavedChangesRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        const processedTitle = localTitleRef.current.trim();
        const currentContent = localContentRef.current;
        const currentDueDate = localDueDateRef.current;

        const processedDueDateTimestamp = currentDueDate && isValid(currentDueDate) ? currentDueDate.getTime() : null;

        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            const originalTaskState = prevTasks.find(t => t.id === selectedTask.id);
            if (!originalTaskState) return prevTasks;

            const changesToSave: Partial<Task> = {};
            if (processedTitle !== originalTaskState.title) changesToSave.title = processedTitle || t('common.untitledTask');
            if (currentContent !== (originalTaskState.content || '')) changesToSave.content = currentContent;

            const originalDueTime = originalTaskState.dueDate ?? null;
            if (processedDueDateTimestamp !== originalDueTime) changesToSave.dueDate = processedDueDateTimestamp;

            if (Object.keys(changesToSave).length > 0) {
                return prevTasks.map(t => (t.id === selectedTask.id ? {
                    ...t, ...changesToSave,
                    updatedAt: Date.now()
                } : t));
            }
            return prevTasks;
        });

        hasUnsavedChangesRef.current = false;
    }, [selectedTask, setTasks, t]);


    /**
     * Effect to ensure pending changes are saved when the component unmounts.
     */
    useEffect(() => {
        return () => {
            if (hasUnsavedChangesRef.current) {
                savePendingChanges();
            }
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [savePendingChanges]);

    useEffect(() => {
        if (selectedTask && selectedTask.title === '' && titleInputRef.current) {
            const timer = setTimeout(() => {
                titleInputRef.current?.focus();
                titleInputRef.current?.select();
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [selectedTask]);


    useEffect(() => {
        if (newSubtaskDueDate && newSubtaskDateDisplayRef.current) {
            setSubtaskDateTextWidth(newSubtaskDateDisplayRef.current.offsetWidth);
        } else {
            setSubtaskDateTextWidth(0);
        }
    }, [newSubtaskDueDate, isNewSubtaskDatePickerOpen]);

    /**
     * Triggers a debounced save operation. Marks changes as pending and sets a timeout.
     */
    const triggerSave = useCallback(() => {
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            savePendingChanges();
        }, 700);
    }, [savePendingChanges]);

    /**
     * Updates a specific property of the current task and saves it immediately.
     */
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'subtasks'>>) => {
        if (!selectedTask) return;

        if (hasUnsavedChangesRef.current) {
            savePendingChanges();
        }
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }

        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            return prevTasks.map(t => (t.id === selectedTask.id ? {
                ...t, ...updates,
                updatedAt: Date.now()
            } : t));
        });
    }, [selectedTask, setTasks, savePendingChanges]);


    /**
     * Handles closing the task detail panel, ensuring any pending changes are saved first.
     */
    const handleClose = useCallback(() => {
        if (hasUnsavedChangesRef.current) {
            savePendingChanges();
        }
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

    const handleMainContentBlur = useCallback(() => {
        if (hasUnsavedChangesRef.current) {
            savePendingChanges();
        }
    }, [savePendingChanges]);

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
                setIsHeaderMenuTagsPopoverOpen(false);
            } else if (type === 'tags') {
                setIsHeaderMenuTagsPopoverOpen(true);
                setIsHeaderMenuDatePickerOpen(false);
            }
        } else {
            if (type === 'date') setIsHeaderMenuDatePickerOpen(false);
            if (type === 'tags') setIsHeaderMenuTagsPopoverOpen(false);
        }
    }, []);


    const closeHeaderMenuDatePickerPopover = useCallback(() => {
        handleHeaderMenuPopoverOpenChange(false, 'date');
    }, [handleHeaderMenuPopoverOpenChange]);

    const closeHeaderMenuTagsPopover = useCallback(() => {
        handleHeaderMenuPopoverOpenChange(false, 'tags');
    }, [handleHeaderMenuPopoverOpenChange]);


    const handleListChange = useCallback((newListName: string) => {
        const listObject = allUserLists?.find(l => l.name === newListName);
        if (listObject) {
            updateTask({listName: newListName, listId: listObject.id});
        }
        setIsMoreActionsOpen(false);
    }, [updateTask, allUserLists]);

    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({priority: newPriority});
    }, [updateTask]);

    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({
            completePercentage: newPercentage,
            completed: newPercentage === 100,
        });
    }, [updateTask]);

    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.listName === 'Trash') return;
        const isCurrentlyCompleted = selectedTask.completed || (selectedTask.completePercentage ?? 0) === 100;
        const nextCompleted = !isCurrentlyCompleted;
        const nextPercentage = nextCompleted ? 100 : null;
        updateTask({
            completed: nextCompleted,
            completePercentage: nextPercentage,
        });
        if (nextCompleted) {
            setSelectedTaskId(null);
        }
    }, [selectedTask, updateTask, setSelectedTaskId]);


    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);

    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({listName: 'Trash', completePercentage: null});
        setSelectedTaskId(null);
        closeDeleteConfirm();
    }, [selectedTask, updateTask, setSelectedTaskId, closeDeleteConfirm]);

    const handleDeleteTask = useCallback(() => {
        if (isLoadingPreferences) return;
        if (preferences.confirmDeletions) {
            setIsDeleteDialogOpen(true);
        } else {
            confirmDelete();
        }
    }, [preferences.confirmDeletions, confirmDelete, isLoadingPreferences]);

    const handleDeletePermanently = useCallback(() => {
        setIsPermanentDeleteDialogOpen(true);
    }, []);

    const confirmPermanentDelete = useCallback(() => {
        if (!selectedTask) return;
        storageManager.get().deleteTask(selectedTask.id);
        setTasks(prev => (prev ?? []).filter(t => t.id !== selectedTask.id));
        setSelectedTaskId(null);
        setIsPermanentDeleteDialogOpen(false);
    }, [selectedTask, setTasks, setSelectedTaskId]);

    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.listName !== 'Trash') return;
        updateTask({listName: 'Inbox'});
    }, [selectedTask, updateTask]);

    const handleDuplicateTask = useCallback(() => {
        if (!selectedTask) return;

        savePendingChanges();

        const now = Date.now();
        const localId = `task-${now}-${Math.random().toString(16).slice(2)}`;

        const duplicatedSubtasks = (selectedTask.subtasks || []).map(sub => ({
            ...sub,
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: localId,
            createdAt: now,
            updatedAt: now,
            completedAt: sub.completed ? now : null,
        }));

        // Use refs to get the absolute latest values for duplication
        const newTitle = `${localTitleRef.current || t('common.untitledTask')} (Copy)`;
        const newContent = localContentRef.current;
        const newDueDate = localDueDateRef.current;

        const newTaskData: Omit<Task, 'groupCategory'> & { groupCategory?: TaskGroupCategory } = {
            ...selectedTask,
            id: localId,
            title: newTitle,
            content: newContent,
            dueDate: newDueDate ? newDueDate.getTime() : null,
            order: (selectedTask.order ?? 0) + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completePercentage: null,
            subtasks: duplicatedSubtasks,
        };
        delete newTaskData.groupCategory;

        setTasks(prevValue => {
            const prev = prevValue ?? [];
            const index = prev.findIndex(t => t.id === selectedTask.id);
            const newTasks = [...prev];
            newTasks.splice(index !== -1 ? index + 1 : prev.length, 0, newTaskData as Task);
            return newTasks;
        });

        setSelectedTaskId(localId);
        setIsMoreActionsOpen(false);
    }, [selectedTask, setTasks, setSelectedTaskId, t, savePendingChanges]);


    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            savePendingChanges();
            titleInputRef.current?.blur();
        } else if (e.key === 'Escape' && selectedTask) {
            e.preventDefault();
            if (localTitle !== selectedTask.title) {
                setLocalTitle(selectedTask.title);
            }
            titleInputRef.current?.blur();
        }
    }, [selectedTask, localTitle, savePendingChanges]);

    const isTrash = useMemo(() => selectedTask?.listName === 'Trash', [selectedTask?.listName]);
    const isCompleted = useMemo(() => (selectedTask?.completed || (selectedTask?.completePercentage ?? 0) === 100) && !isTrash, [selectedTask?.completed, selectedTask?.completePercentage, isTrash]);
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
        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            return prevTasks.map(t => t.id === selectedTask.id ? {
                ...t,
                subtasks: [...(t.subtasks || []), newSub].sort((a, b) => a.order - b.order)
            } : t)
        });
        setNewSubtaskTitle('');
        setNewSubtaskDueDate(undefined);
        newSubtaskInputRef.current?.focus();
    }, [selectedTask, newSubtaskTitle, setTasks, isInteractiveDisabled, newSubtaskDueDate]);

    const handleUpdateSubtask = useCallback((subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'parentId' | 'createdAt'>>) => {
        if (!selectedTask) return;
        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            return prevTasks.map(t => t.id === selectedTask.id ? {
                ...t,
                subtasks: (t.subtasks || []).map(sub => sub.id === subtaskId ? {
                    ...sub, ...updates,
                    updatedAt: Date.now()
                } : sub)
            } : t)
        });
    }, [selectedTask, setTasks]);

    const handleDeleteSubtask = useCallback((subtaskId: string) => {
        if (!selectedTask) return;
        setTasks(prevTasksValue => {
            const prevTasks = prevTasksValue ?? [];
            return prevTasks.map(t => t.id === selectedTask.id ? {
                ...t,
                subtasks: (t.subtasks || []).filter(sub => sub.id !== subtaskId)
            } : t)
        });
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
            setTasks(prevTasksValue => {
                const prevTasks = prevTasksValue ?? [];
                return prevTasks.map(t => t.id === selectedTask.id ? {...t, subtasks: finalSubtasks} : t)
            });
        }
    };

    const displayDueDateForPicker = localDueDate;
    const displayDueDateForRender = localDueDate;
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt, preferences?.language) : '', [selectedTask, preferences]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt, preferences?.language) : '', [selectedTask, preferences]);

    const mainPanelClass = useMemo(() => twMerge("h-full flex flex-col", "bg-transparent"), []);
    const headerClass = useMemo(() => twMerge("px-4 py-2 h-[56px] flex items-center justify-between flex-shrink-0", "border-b border-grey-light/50 dark:border-neutral-700/50", "bg-white/50 dark:bg-grey-deep/50 backdrop-blur-md transition-colors duration-300"), []);
    const noPriorityBgColor = 'bg-grey-light dark:bg-neutral-600';
    const popoverContentWrapperClasses = useMemo(() => twMerge(
        "z-[70] bg-white rounded-base shadow-popover dark:bg-neutral-800 dark:border dark:border-neutral-700",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);
    const taskListPriorityMap: Record<number, {
        label: string;
        iconColor: string;
        bgColor: string;
        shortLabel: string;
    }> = useMemo(() => ({
        1: {label: t('priorityLabels.1'), iconColor: 'text-error', bgColor: 'bg-error', shortLabel: 'P1'},
        2: {label: t('priorityLabels.2'), iconColor: 'text-warning', bgColor: 'bg-warning', shortLabel: 'P2'},
        3: {label: t('priorityLabels.3'), iconColor: 'text-info', bgColor: 'bg-info', shortLabel: 'P3'},
    }), [t]);

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
        return t('priorityLabels.none');
    }, [selectedTask, taskListPriorityMap, t]);

    const titleInputClasses = useMemo(() => twMerge("flex-1 text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 leading-tight", "placeholder:text-grey-medium dark:placeholder:text-neutral-500 placeholder:font-normal", (isInteractiveDisabled) && "line-through text-grey-medium dark:text-neutral-400/80", "text-grey-dark dark:text-neutral-100 tracking-tight"), [isInteractiveDisabled]);
    const editorContainerClass = useMemo(() => twMerge("flex-1 min-h-0 overflow-hidden"), []);
    const editorClasses = useMemo(() => twMerge("!h-full text-sm !bg-transparent !border-none !shadow-none", (isInteractiveDisabled) && "opacity-60 cursor-not-allowed", isTrash && "pointer-events-none", "dark:!text-neutral-300"), [isInteractiveDisabled, isTrash]);
    const footerClass = useMemo(() => twMerge("px-4 py-2 h-11 flex items-center justify-between flex-shrink-0", "border-t border-grey-light/50 dark:border-neutral-700/50", "bg-white/70 dark:bg-neutral-850/70 backdrop-blur-sm"), []);
    const actionButtonClass = useMemo(() => twMerge("text-grey-medium dark:text-neutral-400", "hover:bg-black/5 dark:hover:bg-white/10", "hover:text-grey-dark dark:hover:text-neutral-200", "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1", "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-850"), []);
    const footerDateTriggerClass = useMemo(() => twMerge("h-8 flex items-center text-xs px-2 py-1 rounded-base transition-colors duration-150", "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1", "focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-850", "hover:bg-black/5 dark:hover:bg-white/10", (displayDueDateForRender && isValid(displayDueDateForRender)) ? (overdue && !isCompleted && !isTrash ? "text-error dark:text-red-400 font-medium" : "text-primary dark:text-primary-light font-medium") : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200", isTrash && "cursor-not-allowed opacity-60"), [displayDueDateForRender, overdue, isCompleted, isTrash]);
    const dropdownContentClasses = useMemo(() => twMerge("z-[60] min-w-[180px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700", "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide"), []);
    const subtaskDatePickerPopoverWrapperClasses = useMemo(() => twMerge("z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800", "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"), []);
    const newSubtaskInputPaddingLeft = useMemo(() => {
        const iconAreaSpace = 28;
        let dateTextSpace = 0;
        if (newSubtaskDueDate && subtaskDateTextWidth > 0) {
            dateTextSpace = 4 + subtaskDateTextWidth + 4;
        }
        return iconAreaSpace + dateTextSpace;
    }, [newSubtaskDueDate, subtaskDateTextWidth]);

    const getRadioItemClasses = (isSelected: boolean) => twMerge("relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7", "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light", "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700", isSelected ? "bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light" : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100", "data-[disabled]:opacity-50");
    const getSubTriggerClasses = () => twMerge("relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7", "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light", "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 dark:data-[state=open]:bg-neutral-700", "text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark", "dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100 dark:data-[state=open]:text-neutral-100", "data-[disabled]:opacity-50");
    const tooltipContentClass = useMemo(() => twMerge("text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[75]", "data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"), []);
    const progressMenuItems = useMemo(() => [
        {label: t('taskDetail.progressLabels.notStarted'), value: null, icon: 'circle' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.inProgress'), value: 30, icon: 'circle-dot-dashed' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.mostlyDone'), value: 60, icon: 'circle-dot' as IconName, iconStroke: 1.5},
        {label: t('taskDetail.progressLabels.completed'), value: 100, icon: 'circle-check' as IconName, iconStroke: 2},
    ], [t]);

    const availableLists = useMemo(() => (allUserLists ?? []).filter(l => l.name !== 'Trash'), [allUserLists]);

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

    if (isLoadingPreferences) {
        return <div className="h-full flex items-center justify-center"><Icon name="loader" size={24}
                                                                              className="text-primary animate-spin"/>
        </div>;
    }
    if (!selectedTask) return null;

    const headerMenuSubPopoverSideOffset = 5;

    return (
        <>
            <div className={mainPanelClass}>
                <div className={headerClass} data-tauri-drag-region="true">
                    <div className="flex items-center flex-1 min-w-0 gap-x-2.5 mr-3">
                        <ProgressIndicator
                            percentage={selectedTask.completePercentage}
                            isTrash={isTrash}
                            onClick={cycleCompletionPercentage}
                            size={22}
                            className="flex-shrink-0"
                            ariaLabelledby={`task-title-input-${selectedTask.id}`}
                        />

                        {!isInteractiveDisabled && selectedTask.priority && (
                            <Tooltip.Provider delayDuration={300}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                         <span
                                             className={twMerge("w-2.5 h-2.5 rounded-full flex-shrink-0", priorityDotBgColor)}
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
                            placeholder={t('taskDetail.titlePlaceholder')}
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
                                if (openState) {
                                    setIsHeaderMenuDatePickerOpen(false);
                                    setIsHeaderMenuTagsPopoverOpen(false);
                                }
                            }}
                        >
                            <DropdownMenu.Trigger asChild>
                                <Button ref={moreActionsButtonRef} variant="ghost" size="icon"
                                        icon="more-horizontal"
                                        className={twMerge(actionButtonClass, "w-8 h-8")}
                                        aria-label={t('taskDetail.moreActions')}/>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    id="task-detail-more-actions-content"
                                    className={dropdownContentClasses}
                                    sideOffset={5}
                                    align="end"
                                    onCloseAutoFocus={handleMoreActionsDropdownCloseFocus}
                                    onInteractOutside={(e) => {
                                        if (isHeaderMenuDatePickerOpen || isHeaderMenuTagsPopoverOpen) {
                                            const target = e.target as HTMLElement;
                                            if (target.closest('[data-radix-popper-content-wrapper]')) {
                                                e.preventDefault();
                                            }
                                        }
                                    }}
                                >
                                    <div
                                        className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">{t('taskDetail.progress')}
                                    </div>
                                    <div className="flex justify-around items-center px-1.5 py-1">
                                        {progressMenuItems.map(item => {
                                            const isSelected = (selectedTask.completePercentage ?? null) === item.value;
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
                                        className="px-2.5 pt-1.5 pb-0.5 text-[11px] text-grey-medium dark:text-neutral-400 uppercase tracking-wider">{t('common.priority')}
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
                                            title={t('priorityLabels.none')}
                                            aria-pressed={selectedTask.priority === null}
                                            disabled={isInteractiveDisabled}
                                        >
                                            <Icon name="minus" size={14} strokeWidth={1.5}/>
                                        </button>
                                    </div>

                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>

                                    <DropdownMenu.Sub>
                                        <DropdownMenu.SubTrigger
                                            className={getSubTriggerClasses()}
                                            disabled={isTrash}
                                            onPointerEnter={() => {
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
                                            {t('taskDetail.moveTo')}
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={14}
                                                                                strokeWidth={1.5}
                                                                                className="opacity-70"/></div>
                                        </DropdownMenu.SubTrigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.SubContent
                                                className={twMerge(dropdownContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                                                sideOffset={2} alignOffset={-5}>
                                                <DropdownMenu.RadioGroup
                                                    value={selectedTask.listName}
                                                    onValueChange={handleListChange}
                                                >
                                                    {availableLists.map(list => (
                                                        <DropdownMenu.RadioItem
                                                            key={list.id}
                                                            value={list.name}
                                                            className={getRadioItemClasses(selectedTask.listName === list.name)}
                                                            disabled={isTrash}
                                                        >
                                                            <Icon name={list.name === 'Inbox' ? 'inbox' : 'list'}
                                                                  size={14} strokeWidth={1.5}
                                                                  className="mr-2 flex-shrink-0 opacity-80"/>
                                                            <span className="flex-grow">{list.name === 'Inbox' ? t('sidebar.inbox') : list.name}</span>
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
                                            > {t('taskDetail.addTags')} </RadixMenuItem>
                                        </Popover.Trigger>
                                        <Popover.Portal>
                                            <Popover.Content
                                                className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                side="left"
                                                align="start"
                                                sideOffset={headerMenuSubPopoverSideOffset}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onCloseAutoFocus={(e) => {
                                                    e.preventDefault();
                                                    moreActionsButtonRef.current?.focus();
                                                }}
                                                onFocusOutside={(event) => event.preventDefault()}
                                                onPointerDownOutside={(event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (!target.closest('[data-radix-dropdown-menu-trigger]') && !target.closest('[data-radix-popper-content-wrapper]')) {
                                                        handleHeaderMenuPopoverOpenChange(false, 'tags');
                                                    } else {
                                                        event.preventDefault();
                                                    }
                                                }}
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
                                            > {t('taskDetail.setDueDate')}... </RadixMenuItem>
                                        </Popover.Trigger>
                                        <Popover.Portal>
                                            <Popover.Content
                                                className={twMerge(popoverContentWrapperClasses, "p-0")}
                                                side="left"
                                                align="start"
                                                sideOffset={headerMenuSubPopoverSideOffset}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                                onCloseAutoFocus={(e) => {
                                                    e.preventDefault();
                                                    moreActionsButtonRef.current?.focus();
                                                }}
                                                onFocusOutside={(event) => event.preventDefault()}
                                                onPointerDownOutside={(event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (!target.closest('[data-radix-dropdown-menu-trigger]') && !target.closest('[data-radix-popper-content-wrapper]')) {
                                                        handleHeaderMenuPopoverOpenChange(false, 'date');
                                                    } else {
                                                        event.preventDefault();
                                                    }
                                                }}
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

                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>
                                    <RadixMenuItem icon="copy-plus"
                                                   onSelect={handleDuplicateTask}
                                                   disabled={isTrash}>
                                        {t('taskDetail.duplicate')}
                                    </RadixMenuItem>
                                    <DropdownMenu.Separator
                                        className="h-px bg-grey-light dark:bg-neutral-700 my-1"/>
                                    {isTrash ? (
                                        <>
                                            <RadixMenuItem icon="arrow-left"
                                                           onSelect={handleRestore}
                                                           className="text-success dark:text-green-500 data-[highlighted]:!bg-green-500/10 data-[highlighted]:!text-green-600 dark:data-[highlighted]:!bg-green-500/15 dark:data-[highlighted]:!text-green-400">
                                                {t('taskDetail.restore')}
                                            </RadixMenuItem>
                                            <RadixMenuItem
                                                icon="trash"
                                                onSelect={() => setTimeout(() => handleDeletePermanently(), 0)}
                                                isDanger>
                                                {t('taskDetail.deletePermanently')}
                                            </RadixMenuItem>
                                        </>
                                    ) : (
                                        <RadixMenuItem
                                            icon="trash"
                                            onSelect={() => setTimeout(() => handleDeleteTask(), 0)}
                                            isDanger>
                                            {t('taskDetail.moveToTrash')}
                                        </RadixMenuItem>
                                    )}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        <Button variant="ghost" size="icon" icon="x" onClick={handleClose}
                                className={twMerge(actionButtonClass, "w-8 h-8")}
                                aria-label={t('taskDetail.close')}/>
                    </div>
                </div>

                <div
                    className="flex-1 overflow-y-auto styled-scrollbar-thin flex flex-col bg-transparent">
                    <div className={editorContainerClass}>
                        <CodeMirrorEditor
                            key={selectedTask.id}
                            ref={editorRef}
                            value={localContent}
                            onChange={handleContentChange}
                            onBlur={handleMainContentBlur}
                            placeholder={t('taskDetail.notesPlaceholder')}
                            className={editorClasses}
                            readOnly={isInteractiveDisabled}
                            taskTitle={localTitle}
                        />
                    </div>
                    <div
                        className={twMerge(
                            "px-5",
                            "flex-shrink-0 flex flex-col bg-transparent"
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
                                            {t('taskDetail.subtasks')}
                                            <span
                                                className="ml-2 font-normal text-xs text-grey-medium dark:text-neutral-400">
                                                {t('taskDetail.subtasksCompleted', {
                                                    completed: sortedSubtasks.filter(s => s.completed).length,
                                                    total: sortedSubtasks.length
                                                })}
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
                                        className="group relative flex items-center flex-1 h-8 bg-white/50 dark:bg-neutral-800/50 rounded-base transition-all duration-150 ease-in-out border border-transparent dark:border-transparent backdrop-blur-sm">
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
                                                        aria-label={t('subtask.setDueDate')}
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
                                                        {formatRelativeDate(newSubtaskDueDate, t, false, preferences?.language)}
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
                                            placeholder={t('taskDetail.addSubtask')}
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
                                                        className="!h-7 !px-2.5 ml-2 !text-xs">{t('taskDetail.addSubtaskButton')}</Button>
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
                                        <button className={footerDateTriggerClass} aria-label={t('taskDetail.setDueDate')}>
                                            {displayDueDateForRender && isValid(displayDueDateForRender)
                                                ? formatRelativeDate(displayDueDateForRender, t, true, preferences?.language)
                                                : t('taskDetail.setDueDate')
                                            }
                                        </button>
                                    </Popover.Trigger>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className={tooltipContentClass} side="top" sideOffset={6}>
                                        {displayDueDateForRender && isValid(displayDueDateForRender) ? `Due: ${formatRelativeDate(displayDueDateForRender, t, true, preferences?.language)}` : t('taskDetail.setDueDate')}
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
                                                aria-label={t('taskDetail.taskInfo')}/>
                                    </Popover.Trigger>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content className={tooltipContentClass} side="top" sideOffset={6}>
                                        {t('taskDetail.taskInfo')}
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
                                                className="font-medium text-grey-dark dark:text-neutral-200">{t('taskDetail.created')}:</strong>
                                            {displayCreatedAt}
                                        </p>
                                        <p><strong
                                            className="font-medium text-grey-dark dark:text-neutral-200">{t('taskDetail.updated')}:</strong> {displayUpdatedAt}
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
                                         itemTitle={selectedTask.title || t('common.untitledTask')}
                                         title={t('confirmDeleteModal.task.title')}
                                         description={t('confirmDeleteModal.task.description', {itemTitle: selectedTask.title || t('common.untitledTask')})}
                                         confirmText={t('confirmDeleteModal.task.confirmText')}
                                         confirmVariant="danger"
                />
            )}
            {selectedTask && (
                <ConfirmDeleteModalRadix
                    isOpen={isPermanentDeleteDialogOpen}
                    onClose={() => setIsPermanentDeleteDialogOpen(false)}
                    onConfirm={confirmPermanentDelete}
                    itemTitle={selectedTask.title || t('common.untitledTask')}
                    title={t('confirmDeleteModal.permanent.title')}
                    description={t('confirmDeleteModal.permanent.description', {itemTitle: selectedTask.title || t('common.untitledTask')})}
                    confirmText={t('confirmDeleteModal.permanent.confirmText')}
                    confirmVariant="danger"
                />
            )}
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;