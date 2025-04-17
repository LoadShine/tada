// src/components/tasks/TaskItem.tsx
import React from 'react';
import { Task } from '@/types';
import { formatRelativeDate, isOverdue } from '@/utils/dateUtils';
import { useAtom } from 'jotai';
import { selectedTaskIdAtom, tasksAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import Button from "@/components/common/Button.tsx"; // Ensure Button is imported

interface TaskItemProps {
    task: Task;
    isOverlay?: boolean; // To style the item when rendered in DragOverlay
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isOverlay = false }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const isSelected = selectedTaskId === task.id;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: task.completed || task.list === 'Trash', // Disable sorting for completed or trashed tasks
        data: { // Pass task data for context if needed in listeners/sensors
            task,
            type: 'task-item',
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 150ms ease', // Smoother dnd-kit transition
        // Apply styles directly for overlay or dragging state
        ...(isOverlay && { // Styles for the item when in DragOverlay
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'grabbing',
            borderRadius: '6px', // rounded-md
            border: '1px solid rgba(0, 0, 0, 0.05)',
        }),
        ...(isDragging && !isOverlay && { // Styles for the original item while dragging (placeholder)
            opacity: 0.4,
            // backgroundColor: 'rgb(240, 240, 240)', // Optional subtle placeholder bg
        }),
    };

    const handleTaskClick = (e: React.MouseEvent) => {
        // Prevent click propagation if clicking on interactive elements inside
        if ((e.target as HTMLElement).closest('button, input, a')) {
            return;
        }
        // Don't select trashed tasks for detail view
        if (task.list !== 'Trash') {
            setSelectedTaskId(task.id);
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent task selection
        const isChecked = e.target.checked;
        const now = Date.now();
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: isChecked, updatedAt: now } : t
            )
        );
        // Deselect if completing the currently selected task
        if (isChecked && isSelected) {
            setSelectedTaskId(null);
        }
    };

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const overdue = dueDate && !task.completed && isOverdue(dueDate);

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            className={twMerge(
                'task-item flex items-start px-2.5 py-2 border-b border-border-color/60 group relative min-h-[52px] transition-colors duration-100 ease-out', // Base styles
                isSelected && !isDragging && !isOverlay && 'bg-primary/5', // Subtle selection
                !isDragging && !isOverlay && !task.completed && task.list !== 'Trash' && 'hover:bg-gray-50/60', // Hover effect
                task.completed && 'opacity-70', // Dim completed tasks slightly
                isOverlay && 'bg-canvas', // Style for overlay background
                // Give completed/trash items a slightly different feel
                (task.completed || task.list === 'Trash') && 'bg-canvas-alt/30 hover:bg-canvas-alt/30'
            )}
            onClick={handleTaskClick}
            layout // Animate position changes smoothly (from framer-motion)
            initial={false} // Prevent initial animation on first load, let TaskList handle entry
            // Remove exit/animate here as TaskList AnimatePresence handles entry/exit
        >
            {/* Drag Handle - show on hover/focus, only for sortable tasks */}
            {!task.completed && task.list !== 'Trash' && (
                <button
                    {...attributes}
                    {...listeners}
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted cursor-grab mr-2 p-1 -ml-1 opacity-0 group-hover:opacity-60 focus-visible:opacity-100 transition-opacity duration-150 outline-none flex-shrink-0"
                    aria-label="Drag task to reorder"
                    tabIndex={-1} // Avoid tab stop on handle itself
                >
                    <Icon name="grip-vertical" size={15} strokeWidth={2} />
                </button>
            )}
            {/* Add padding compensation if handle is hidden */}
            {(task.completed || task.list === 'Trash') && <div className="w-[27px] flex-shrink-0"></div>} {/* Match handle width + margin */}


            {/* Custom Checkbox - positioned absolutely for alignment? Or keep inline */}
            <div className="flex-shrink-0 mr-2.5 pt-0.5">
                <input
                    type="checkbox"
                    id={`task-checkbox-${task.id}`}
                    checked={task.completed}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()}
                    className={twMerge(
                        "h-4 w-4 rounded border-2 focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 transition duration-100 ease-in-out cursor-pointer",
                        task.completed ? 'bg-gray-300 border-gray-300 text-white' : 'text-primary border-gray-400/80 hover:border-primary/50 bg-canvas',
                    )}
                    disabled={task.list === 'Trash'} // Cannot complete/uncomplete in Trash
                />
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only">Complete task {task.title}</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-0.5">
                <p className={twMerge(
                    "text-sm text-gray-800", // Darker text
                    task.completed && "line-through text-muted",
                    task.list === 'Trash' && "text-muted", // Dim text in trash
                    // Allow wrapping
                )}>
                    {task.title || <span className="text-muted italic">Untitled Task</span>}
                </p>
                {/* Subline - Show relevant info subtly */}
                <div className="flex items-center flex-wrap text-[11px] text-muted space-x-2 mt-0.5 leading-tight">
                    {/* Priority - Icon only for subtlety */}
                    {task.priority && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx("flex items-center font-medium", {
                            'text-red-600': task.priority === 1,
                            'text-orange-500': task.priority === 2,
                            'text-blue-500': task.priority === 3,
                            'text-gray-500': task.priority === 4,
                        })} title={`Priority ${task.priority}`}>
                             <Icon name="flag" size={11} className="mr-0" strokeWidth={2}/> {/* Icon only */}
                         </span>
                    )}
                    {/* Due Date */}
                    {dueDate && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx('flex items-center whitespace-nowrap', overdue && 'text-red-600 font-medium')}>
                             <Icon name="calendar" size={11} className="mr-0.5 opacity-70" />
                            {formatRelativeDate(dueDate)}
                         </span>
                    )}
                    {/* List Name (if not 'Inbox' and filter is 'all' or date-based?) */}
                    {task.list && task.list !== 'Inbox' && !task.completed && task.list !== 'Trash' && !isSelected && ( // Hide if selected or completed/trash
                        <span className="flex items-center whitespace-nowrap bg-gray-100 text-muted-foreground px-1 py-0 rounded text-[10px]">
                             <Icon name="list" size={10} className="mr-0.5 opacity-70" />
                            {task.list}
                         </span>
                    )}
                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && !task.completed && task.list !== 'Trash' && (
                        <span className="flex items-center space-x-1">
                            {task.tags.slice(0, 2).map(tag => ( // Show max 2 tags
                                <span key={tag} className="bg-gray-100 text-muted-foreground px-1 py-0 rounded text-[10px]">#{tag}</span>
                            ))}
                            {task.tags.length > 2 && <span className="text-muted text-[10px]">+{task.tags.length - 2}</span>}
                         </span>
                    )}
                </div>
            </div>

            {/* More Actions Button (optional, shown on hover/focus) */}
            {/* Hide actions in Trash for now */}
            {task.list !== 'Trash' && (
                <div className="absolute top-1.5 right-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={twMerge(
                            "ml-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 h-6 w-6 text-muted-foreground",
                            isSelected && "opacity-100" // Keep visible if selected
                        )}
                        onClick={(e) => { e.stopPropagation(); console.log('More actions for', task.id); /* Implement dropdown menu */ }}
                        aria-label="More actions"
                    >
                        <Icon name="more-horizontal" size={16} />
                    </Button>
                </div>
            )}

        </motion.div>
    );
};

export default TaskItem;