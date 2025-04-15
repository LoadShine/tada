// src/components/tasks/TaskItem.tsx
import React from 'react';
import { Task } from '@/types';
import { formatRelativeDate, isOverdue } from '@/utils/dateUtils';
import { useAtom } from 'jotai';
import { selectedTaskIdAtom, tasksAtom, draggingTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import Button from "@/components/common/Button.tsx";

interface TaskItemProps {
    task: Task;
    isOverlay?: boolean; // Flag to indicate if rendering in DragOverlay
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isOverlay = false }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const [draggingId, ] = useAtom(draggingTaskIdAtom); // Use dragging state atom
    const isSelected = selectedTaskId === task.id;
    const isDragging = draggingId === task.id;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging, // Rename to avoid conflict
    } = useSortable({
        id: task.id,
        data: { type: 'task', task }, // Pass task data for potential use in handlers
    });

    // Use CSS transform for smooth movement, handle transition specifically
    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isOverlay ? undefined : (transition || 'transform 200ms ease'), // No transition on overlay
        zIndex: isDragging ? 100 : (isSelected ? 1 : undefined), // Ensure dragging/selected is on top
    };

    const handleTaskClick = () => {
    // const handleTaskClick = (e: React.MouseEvent) => {
        // Prevent click if dragging starts on the item itself (rare but possible)
        if (isSortableDragging) return;
        setSelectedTaskId(task.id);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent task selection when clicking checkbox
        const isChecked = e.target.checked;
        const now = Date.now();

        // If completing a task, find its current index to potentially calculate new order
        // If uncompleting, it should retain its order or go to the top/bottom depending on logic

        setTasks(prevTasks =>
                prevTasks.map(t =>
                    t.id === task.id
                        ? {
                            ...t,
                            completed: isChecked,
                            updatedAt: now,
                            // Reset dueDate if needed when completing? Optional.
                            // dueDate: isChecked ? null : t.dueDate
                        }
                        : t
                )
            // Consider re-sorting or re-fetching filtered tasks after update
            // .sort((a, b) => a.order - b.order) // Re-sort if order might change
        );

        // Optionally unselect when completing
        // if (isChecked && isSelected) {
        //     setSelectedTaskId(null);
        // }
    };

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const overdue = dueDate && !task.completed && isOverdue(dueDate);

    // Shared class names
    const containerClasses = twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-gray-100 group relative min-h-[44px]', // Min height for consistency
        isSelected && !isOverlay && 'bg-primary/5', // Softer selection, not on overlay
        !isDragging && !isOverlay && 'hover:bg-gray-500/5', // Very subtle hover
        // Styles when item is the source item being dragged (opacity set by dnd-kit)
        isDragging && !isOverlay && 'opacity-50 bg-canvas',
        // Styles for the clone in the DragOverlay
        isOverlay && 'bg-white shadow-lg rounded-lg border border-gray-200/80'
    );

    const titleClasses = twMerge(
        "text-sm text-gray-800 leading-snug", // Tighter line height
        task.completed && "line-through text-muted"
    );

    const metaClasses = "flex flex-wrap items-center text-xs text-muted space-x-2 mt-1";

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            className={containerClasses}
            onClick={handleTaskClick}
            layout={!isOverlay} // Animate layout changes only for non-overlay items
            // Reduce initial/exit animation slightly for performance in long lists
            // initial={{ opacity: 0, y: -5 }}
            // animate={{ opacity: 1, y: 0 }}
            // exit={{ opacity: 0, x: -10 }}
            // transition={{ duration: 0.15 }}
        >
            {/* Drag Handle - Conditionally render only for non-overlay */}
            {!isOverlay && (
                <button
                    {...attributes}
                    {...listeners}
                    className="text-muted cursor-grab mr-1.5 mt-px p-1 -ml-1 opacity-0 group-hover:opacity-60 focus-visible:opacity-100 transition-opacity duration-150 focus:outline-none flex-shrink-0"
                    aria-label="Drag task"
                    onClick={e => e.stopPropagation()} // Prevent selection
                >
                    <Icon name="grip-vertical" size={16} strokeWidth={1.5}/>
                </button>
            )}

            {/* Checkbox area - slightly larger tap target */}
            <div className="flex-shrink-0 mr-2.5 pt-px" onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    id={`task-checkbox-${task.id}-${isOverlay}`} // Ensure unique ID for overlay
                    checked={task.completed}
                    onChange={handleCheckboxChange}
                    className={twMerge(
                        "form-checkbox h-4 w-4 rounded border-gray-300/80 focus:ring-primary/80 focus:ring-1 focus:ring-offset-1 text-primary", // Use forms plugin class, refine focus
                        "transition-colors duration-150 ease-in-out cursor-pointer"
                    )}
                    aria-labelledby={`task-title-${task.id}-${isOverlay}`} // Labelled by title
                />
                <label htmlFor={`task-checkbox-${task.id}-${isOverlay}`} className="sr-only">Complete task</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0">
                {/* Wrap title in span for better semantics */}
                <span id={`task-title-${task.id}-${isOverlay}`} className={titleClasses}>
                    {task.title || <span className="text-muted italic">Untitled Task</span>}
                </span>
                {/* Meta Info: Due date, List, Tags */}
                {(!task.completed || isSelected) && ( // Show meta if not completed OR if selected
                    <div className={metaClasses}>
                        {dueDate && !task.completed && (
                            <span className={clsx('flex items-center', overdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                               <Icon name="calendar" size={12} className="mr-0.5 flex-shrink-0" strokeWidth={1.5} />
                                {formatRelativeDate(dueDate)}
                           </span>
                        )}
                        {/* Show list only if not 'Inbox' (or default list) */}
                        {task.list && task.list !== 'Inbox' && (
                            <span className="flex items-center text-muted-foreground max-w-[100px] truncate" title={task.list}>
                               <Icon name="list" size={12} className="mr-0.5 flex-shrink-0" strokeWidth={1.5}/>
                                {task.list}
                           </span>
                        )}
                        {task.tags && task.tags.length > 0 && (
                            <span className="flex items-center space-x-1">
                              {task.tags.slice(0, 2).map(tag => ( // Show max 2 tags inline
                                  <span key={tag} className="inline-flex items-center bg-gray-100 text-gray-600 px-1.5 py-0 rounded-full text-[10px]">
                                     {/* <Icon name="tag" size={10} className="mr-0.5" /> */}
                                      {tag}
                                 </span>
                              ))}
                                {task.tags.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">+{task.tags.length-2}</span>
                                )}
                          </span>
                        )}
                    </div>
                )}
            </div>

            {/* Priority Indicator - More subtle */}
            {task.priority && !task.completed && (
                <div className="ml-2 mt-1 flex-shrink-0" title={`Priority ${task.priority}`}>
                    <Icon name="flag" size={14} strokeWidth={1.5} className={clsx({
                        'text-red-500': task.priority === 1,
                        'text-orange-500': task.priority === 2,
                        'text-blue-500': task.priority === 3,
                        'text-gray-400': task.priority === 4,
                    })} />
                </div>
            )}

            {/* More Actions Button (optional) - Hidden on overlay */}
            {!isOverlay && (
                <div className="absolute top-1/2 right-1.5 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-gray-700" // Smaller icon button
                        onClick={(e) => { e.stopPropagation(); console.log('More actions for', task.id); }}
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