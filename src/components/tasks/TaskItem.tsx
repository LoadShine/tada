// src/components/tasks/TaskItem.tsx
import React, {useMemo} from 'react';
import { Task } from '@/types';
import { formatRelativeDate, isOverdue, safeParseDate } from '@/utils/dateUtils';
import { useAtom } from 'jotai';
import { selectedTaskIdAtom, tasksAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// import { motion } from 'framer-motion';
import Button from "@/components/common/Button"; // Keep Button import if needed for future actions

interface TaskItemProps {
    task: Task;
    isOverlay?: boolean; // To style the item when rendered in DragOverlay
    style?: React.CSSProperties; // Allow passing style from DragOverlay
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isOverlay = false, style: overlayStyle }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const isSelected = selectedTaskId === task.id;

    // Determine if the task is sortable (not completed and not in Trash)
    const isSortable = !task.completed && task.list !== 'Trash';

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: !isSortable, // Disable sorting based on condition
        data: { // Pass task data for context
            task,
            type: 'task-item', // Identify draggable type
        },
    });

    // Combine dnd-kit styles with overlay styles if provided
    const style = {
        ...overlayStyle, // Apply styles from DragOverlay first
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 150ms ease', // Default transition
        // Apply styles for the original item *while* dragging (placeholder appearance)
        ...(isDragging && !isOverlay && {
            opacity: 0.4,
            cursor: 'grabbing',
        }),
        // Ensure overlay has grabbing cursor
        ...(isOverlay && {
            cursor: 'grabbing',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', // Use Tailwind shadow potentially
            borderRadius: '6px', // rounded-md
        }),
        zIndex: isDragging || isOverlay ? 10 : 1, // Ensure dragging/overlay item is on top
    };

    const handleTaskClick = (e: React.MouseEvent) => {
        // Prevent selection if clicking interactive elements or if in Trash
        if ((e.target as HTMLElement).closest('button, input, a') || task.list === 'Trash') {
            return;
        }
        setSelectedTaskId(task.id);

        // Optional: Focus the title input in TaskDetail after selection
        // setTimeout(() => {
        //     (document.querySelector('.task-detail-title-input') as HTMLInputElement)?.focus();
        // }, 50); // Delay slightly
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent task selection when clicking checkbox
        const isChecked = e.target.checked;
        const now = Date.now();
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: isChecked, updatedAt: now } : t
            )
        );
        // If completing the currently selected task, deselect it
        if (isChecked && isSelected) {
            setSelectedTaskId(null);
        }
    };

    // Safely parse due date only once
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => dueDate && !task.completed && isOverdue(dueDate), [dueDate, task.completed]);

    // Base class names
    const baseClasses = twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-border-color/60 group relative min-h-[52px] transition-colors duration-100 ease-out cursor-pointer',
        isSelected && !isDragging && !isOverlay && 'bg-primary/5', // Subtle selection background
        !isSelected && !isDragging && !isOverlay && isSortable && 'hover:bg-gray-50/70', // Hover only on selectable/sortable
        task.completed && 'opacity-70', // Dim completed tasks
        task.list === 'Trash' && 'opacity-60 cursor-default hover:bg-transparent', // Style for trash items
        isOverlay && 'bg-canvas border rounded-md', // Overlay specific background and border
        !isSortable && 'bg-canvas-alt/30 hover:bg-canvas-alt/30 cursor-default', // Different background for non-sortable (completed/trash)
    );

    return (
        // Note: The motion.div for entry/exit animation is handled in TaskList's renderTaskGroup
        <div
            ref={setNodeRef}
            style={style}
            className={baseClasses}
            onClick={handleTaskClick}
            role="button" // Semantically a button if clickable
            tabIndex={0} // Make it focusable
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTaskClick(e as any); }} // Allow activation with Enter/Space
            aria-selected={isSelected}
        >
            {/* Drag Handle - Conditionally rendered and styled */}
            <div className="flex-shrink-0 h-full flex items-center mr-2">
                {isSortable ? (
                    <button
                        {...attributes}
                        {...listeners}
                        onClick={(e) => e.stopPropagation()} // Prevent task selection
                        className={twMerge(
                            "text-muted cursor-grab p-1 -ml-1 opacity-0 group-hover:opacity-60 group-focus-within:opacity-60 focus-visible:opacity-100",
                            "transition-opacity duration-150 outline-none",
                            isDragging && "opacity-60" // Keep handle visible while dragging original
                        )}
                        aria-label="Drag task to reorder"
                        tabIndex={-1} // Not focusable via tab
                    >
                        <Icon name="grip-vertical" size={15} strokeWidth={2} />
                    </button>
                ) : (
                    <div className="w-[27px]"></div> // Placeholder for alignment when not sortable
                )}
            </div>


            {/* Checkbox */}
            <div className="flex-shrink-0 mr-2.5 pt-[3px]"> {/* Adjusted top padding slightly */}
                <input
                    type="checkbox"
                    id={`task-checkbox-${task.id}`}
                    checked={task.completed}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()} // Prevent selection
                    className={twMerge(
                        "h-4 w-4 rounded border-2 transition duration-100 ease-in-out cursor-pointer",
                        "focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 focus:outline-none",
                        task.completed ? 'bg-gray-300 border-gray-300 text-white hover:bg-gray-400 hover:border-gray-400' : 'text-primary border-gray-400/80 hover:border-primary/60 bg-canvas',
                        // Disabled style for trash items
                        task.list === 'Trash' && 'opacity-50 cursor-not-allowed border-gray-300 hover:border-gray-300'
                    )}
                    aria-labelledby={`task-title-${task.id}`}
                    disabled={task.list === 'Trash'} // Cannot check/uncheck in Trash
                />
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only">Complete task</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-[1px]"> {/* Adjusted top padding slightly */}
                {/* Task Title */}
                <p id={`task-title-${task.id}`} className={twMerge(
                    "text-sm text-gray-800 leading-snug", // Use leading-snug for tighter lines
                    task.completed && "line-through text-muted",
                    task.list === 'Trash' && "text-muted line-through", // Also strikethrough in trash
                )}>
                    {task.title || <span className="text-muted italic">Untitled Task</span>}
                </p>

                {/* Subline - Conditionally render info */}
                <div className="flex items-center flex-wrap text-[11px] text-muted space-x-2 mt-1 leading-tight">
                    {/* Priority Indicator (only if high/medium) */}
                    {task.priority && task.priority <= 2 && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx("flex items-center", {
                            'text-red-600': task.priority === 1,
                            'text-orange-500': task.priority === 2,
                        })} title={`Priority ${task.priority}`}>
                            <Icon name="flag" size={11} strokeWidth={2.5}/>
                        </span>
                    )}
                    {/* Due Date */}
                    {dueDate && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx('flex items-center whitespace-nowrap', overdue && 'text-red-600 font-medium')}>
                            <Icon name="calendar" size={11} className="mr-0.5 opacity-70" />
                            {formatRelativeDate(dueDate)}
                        </span>
                    )}
                    {/* List Name (if not Inbox and filter is 'all' or date-based) */}
                    {task.list && task.list !== 'Inbox' && task.list !== 'Trash' && !task.completed && !isSelected && (
                        <span className="flex items-center whitespace-nowrap bg-gray-100 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate" title={task.list}>
                            <Icon name="list" size={10} className="mr-0.5 opacity-70 flex-shrink-0" />
                            <span className="truncate">{task.list}</span>
                        </span>
                    )}
                    {/* Tags (limit displayed) */}
                    {task.tags && task.tags.length > 0 && !task.completed && task.list !== 'Trash' && (
                        <span className="flex items-center space-x-1">
                            {task.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="bg-gray-100 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate" title={tag}>
                                    #{tag}
                                </span>
                            ))}
                            {task.tags.length > 2 && <span className="text-muted text-[10px]">+{task.tags.length - 2}</span>}
                        </span>
                    )}
                </div>
            </div>

            {/* More Actions Button (Optional - show on hover/focus) */}
            {/* Consider implementing a dropdown menu here */}
            {isSortable && !isOverlay && ( // Only show actions for sortable items, not on overlay
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground" // Smaller icon button
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('More actions for task:', task.id);
                            // Trigger dropdown menu logic here
                            setSelectedTaskId(task.id); // Select task when opening actions
                        }}
                        aria-label={`More actions for ${task.title || 'task'}`}
                        tabIndex={0} // Make focusable
                    >
                        <Icon name="more-horizontal" size={16} />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default TaskItem;