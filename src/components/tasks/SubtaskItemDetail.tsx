// src/components/tasks/SubtaskItemDetail.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Subtask} from '@/types';
import Button from '../common/Button';
import {formatRelativeDate, isOverdue, isValid, safeParseDate,} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import SelectionCheckboxRadix from "@/components/common/SelectionCheckbox";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

// --- Subtask Item Component for TaskDetail (Refined UX) ---
interface SubtaskItemDetailProps {
    subtask: Subtask;
    onUpdate: (id: string, updates: Partial<Omit<Subtask, 'id' | 'parentId' | 'createdAt'>>) => void;
    onDelete: (id: string) => void;
    // isEditingContentForThis: boolean; // REMOVED
    // onToggleEditContent: (id: string | null) => void; // REMOVED
    isTaskCompletedOrTrashed: boolean;
    isDraggingOverlay?: boolean;
}

const SubtaskItemDetail: React.FC<SubtaskItemDetailProps> = memo(({
                                                                      subtask,
                                                                      onUpdate,
                                                                      onDelete,
                                                                      // isEditingContentForThis, // REMOVED
                                                                      // onToggleEditContent, // REMOVED
                                                                      isTaskCompletedOrTrashed,
                                                                      isDraggingOverlay = false
                                                                  }) => {
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [localTitle, setLocalTitle] = useState(subtask.title);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    // const contentTextareaRef = useRef<HTMLTextAreaElement>(null); // REMOVED
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    // const [localContentCache, setLocalContentCache] = useState(subtask.content || ''); // REMOVED

    const isDisabledByParent = isTaskCompletedOrTrashed;
    const isDisabled = isDisabledByParent || subtask.completed;

    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
        id: `subtask-detail-${subtask.id}`, data: {subtask, type: 'subtask-item-detail'}, disabled: isDisabledByParent,
    });

    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        if (isDraggingOverlay) return {
            transform: baseTransform,
            transition,
            cursor: 'grabbing',
            zIndex: 1000,
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            background: 'var(--color-canvas-alt, hsl(var(--canvas-alt-h), var(--canvas-alt-s), calc(var(--canvas-alt-l) + 3%)))'
        };
        if (isDragging) return {
            transform: baseTransform,
            transition,
            opacity: 0.6,
            cursor: 'grabbing',
            background: 'var(--color-glass-alt, hsla(var(--glass-alt-h), var(--glass-alt-s), var(--glass-alt-l), 0.2))'
        };
        return {transform: baseTransform, transition};
    }, [transform, transition, isDragging, isDraggingOverlay]);

    useEffect(() => {
        setLocalTitle(subtask.title);
    }, [subtask.title]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // REMOVED useEffect for isEditingContentForThis

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setLocalTitle(e.target.value);
    const saveTitle = () => {
        const trimmedTitle = localTitle.trim();
        if (trimmedTitle && trimmedTitle !== subtask.title) {
            onUpdate(subtask.id, {title: trimmedTitle});
        } else if (!trimmedTitle && subtask.title) {
            setLocalTitle(subtask.title);
        }
        setIsEditingTitle(false);
    };
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') saveTitle();
        if (e.key === 'Escape') {
            setLocalTitle(subtask.title);
            setIsEditingTitle(false);
        }
    };
    const handleCompletionToggle = () => {
        if (!isDisabledByParent) {
            onUpdate(subtask.id, {
                completed: !subtask.completed,
                completedAt: !subtask.completed ? Date.now() : null
            });
        }
    };

    // REMOVED handleContentTextareaChange, saveSubtaskContent, cancelSubtaskContentEdit

    const handleDateSelect = useCallback((dateWithTime: Date | undefined) => {
        if (!isDisabledByParent) {
            onUpdate(subtask.id, {dueDate: dateWithTime ? dateWithTime.getTime() : null});
        }
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [onUpdate, subtask.id, isDisabledByParent]);

    const closeDatePickerPopover = useCallback(() => {
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);

    const openDeleteConfirm = useCallback(() => {
        if (!isDisabledByParent) {
            setIsDeleteConfirmOpen(true);
        }
    }, [isDisabledByParent]);

    const closeDeleteConfirm = useCallback(() => {
        setIsDeleteConfirmOpen(false);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        onDelete(subtask.id);
        closeDeleteConfirm();
    }, [onDelete, subtask.id, closeDeleteConfirm]);

    const subtaskDueDate = useMemo(() => safeParseDate(subtask.dueDate), [subtask.dueDate]);
    const isSubtaskOverdue = useMemo(() => subtaskDueDate && isValid(subtaskDueDate) && !subtask.completed && !isDisabledByParent && isOverdue(subtaskDueDate), [subtaskDueDate, subtask.completed, isDisabledByParent]);
    // const hasContent = useMemo(() => !!subtask.content?.trim(), [subtask.content]); // REMOVED

    const subtaskItemBaseClasses = "group/subtask-detail flex flex-col rounded-lg transition-colors duration-150 ease-apple";
    // const subtaskItemHoverClasses = !isDraggingOverlay && !isDragging && !isEditingContentForThis ? "hover:bg-black/[.025] dark:hover:bg-white/[.025]" : ""; // MODIFIED
    const subtaskItemHoverClasses = !isDraggingOverlay && !isDragging ? "hover:bg-black/[.025] dark:hover:bg-white/[.025]" : "";
    // const subtaskItemEditingContentClasses = isEditingContentForThis ? "bg-black/[.02] dark:bg-white/[.02]" : ""; // REMOVED
    const subtaskItemEditingContentClasses = ""; // Ensure it's an empty string if not used

    const tooltipContentClass = "text-[11px] bg-grey-dark dark:bg-neutral-900/90 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[75] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-white dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={twMerge(
                    subtaskItemBaseClasses,
                    subtaskItemHoverClasses,
                    subtaskItemEditingContentClasses,
                    isDraggingOverlay && "bg-canvas-alt dark:bg-neutral-750 shadow-lg px-1.5",
                    !isDisabledByParent && !isDragging && !isDraggingOverlay && "cursor-grab",
                    isDisabledByParent && "cursor-not-allowed"
                )}
            >
                <div className="flex items-center h-9 px-1.5"> {/* Padding adjusted slightly if needed */}
                    <SelectionCheckboxRadix
                        id={`subtask-detail-check-${subtask.id}`} checked={subtask.completed}
                        onChange={handleCompletionToggle}
                        aria-label={`Mark subtask ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                        className="mr-2.5 flex-shrink-0" size={16} disabled={isDisabledByParent}
                    />
                    <div className={twMerge(
                        "flex-1 min-w-0 py-1 h-full flex items-center"
                    )}
                         onClick={() => !isEditingTitle && !isDisabled && setIsEditingTitle(true)}>
                        {isEditingTitle ? (
                            <input ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                                   onBlur={saveTitle} onKeyDown={handleTitleKeyDown}
                                   className={twMerge(
                                       "w-full text-[13px] bg-transparent focus:outline-none focus:ring-0 border-none p-0 leading-tight font-medium",
                                       subtask.completed ? "line-through text-neutral-500/70 dark:text-neutral-400/70" : "text-neutral-700 dark:text-neutral-100"
                                   )}
                                   placeholder="Subtask title..." disabled={isDisabled}
                            />
                        ) : (
                            <span
                                className={twMerge(
                                    "text-[13px] cursor-text block truncate leading-tight font-medium",
                                    subtask.completed ? "line-through text-neutral-500/70 dark:text-neutral-400/70" : "text-neutral-700 dark:text-neutral-100"
                                )}>
                            {subtask.title || <span className="italic text-muted-foreground/70">Untitled Subtask</span>}
                        </span>
                        )}
                    </div>
                    <div
                        className={twMerge("flex items-center flex-shrink-0 ml-2 space-x-1 transition-opacity duration-150", isEditingTitle ? "opacity-100" : "opacity-0 group-hover/subtask-detail:opacity-100 focus-within:opacity-100")}> {/* MODIFIED condition */}
                        {(subtask.dueDate || !isDisabled) && (
                            <Popover.Root open={isDatePickerOpen} onOpenChange={(open) => {
                                setIsDatePickerOpen(open);
                                if (!open) setIsDateTooltipOpen(false);
                            }}>
                                <Tooltip.Provider><Tooltip.Root delayDuration={300} open={isDateTooltipOpen}
                                                                onOpenChange={setIsDateTooltipOpen}>
                                    <Tooltip.Trigger asChild>
                                        <Popover.Trigger asChild disabled={isDisabled}>
                                            <Button variant="ghost" size="icon" icon="calendar"
                                                    className={twMerge("w-7 h-7",
                                                        isSubtaskOverdue && !subtask.completed && "text-red-500 dark:text-red-400",
                                                        !isSubtaskOverdue && "text-muted-foreground/60 dark:text-neutral-500/60 hover:text-muted-foreground dark:hover:text-neutral-400",
                                                        isDisabled && !subtask.dueDate && "opacity-50 cursor-not-allowed",
                                                        isDisabled && subtask.dueDate && "opacity-60 cursor-not-allowed",
                                                    )}
                                                    aria-label={subtask.dueDate ? `Subtask due: ${formatRelativeDate(subtaskDueDate, true)}` : "Set subtask due date"}
                                            />
                                        </Popover.Trigger>
                                    </Tooltip.Trigger>
                                    <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                     sideOffset={6}>
                                        {subtask.dueDate ? formatRelativeDate(subtaskDueDate, true) : "Set Due Date"}
                                        <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900/90"/>
                                    </Tooltip.Content></Tooltip.Portal>
                                </Tooltip.Root></Tooltip.Provider>
                                <Popover.Portal><Popover.Content
                                    className={datePickerPopoverWrapperClasses}
                                    sideOffset={5}
                                    align="end" onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}>
                                    <CustomDatePickerContent initialDate={subtaskDueDate ?? undefined}
                                                             onSelect={handleDateSelect}
                                                             closePopover={closeDatePickerPopover}/>
                                </Popover.Content></Popover.Portal>
                            </Popover.Root>
                        )}
                        {/* REMOVED Content Edit Button */}
                        <Button variant="ghost" size="icon" icon="trash"
                                onClick={openDeleteConfirm}
                                className={twMerge("w-7 h-7 text-muted-foreground/40 dark:text-neutral-500/40 hover:text-red-500 dark:hover:text-red-400", isDisabledByParent && "opacity-20 cursor-not-allowed")}
                                aria-label="Delete subtask" disabled={isDisabledByParent}
                        />
                    </div>
                </div>
                {/* REMOVED AnimatePresence for content editor */}
            </div>

            <ConfirmDeleteModalRadix
                isOpen={isDeleteConfirmOpen}
                onClose={closeDeleteConfirm}
                onConfirm={handleConfirmDelete}
                itemTitle={subtask.title || 'Untitled Subtask'}
                title="Delete Subtask?"
                description={`Are you sure you want to permanently delete the subtask "${subtask.title || 'Untitled Subtask'}"? This action cannot be undone.`}
                confirmText="Delete"
                confirmVariant="danger"
            />
        </>
    );
});
SubtaskItemDetail.displayName = 'SubtaskItemDetail';

export default SubtaskItemDetail;