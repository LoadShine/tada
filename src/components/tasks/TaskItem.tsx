// src/components/tasks/TaskItem.tsx
import React, { useMemo, useCallback } from 'react';
import { Task, TaskGroupCategory } from '@/types';
import { formatRelativeDate, isOverdue, safeParseDate } from '@/utils/dateUtils';
import { useAtom, useSetAtom } from 'jotai';
import { selectedTaskIdAtom, tasksAtom, searchTermAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from "@/components/common/Button";
import Highlighter from "react-highlight-words"; // For search highlighting

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory; // Category context from list/group
    isOverlay?: boolean; // For drag overlay styling
    style?: React.CSSProperties; // For DND overlay positioning
}

const TaskItem: React.FC<TaskItemProps> = ({ task, groupCategory, isOverlay = false, style: overlayStyle }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const isSelected = selectedTaskId === task.id;

    const isTrashItem = task.list === 'Trash';
    // Allow sorting unless completed OR in trash
    const isSortable = !task.completed && !isTrashItem;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: !isSortable, // Disable sorting for completed/trash items
        data: { task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory },
    });

    // Combine overlay style with DND transform/transition
    const style = useMemo(() => ({
        ...overlayStyle, // Style from DragOverlay
        transform: CSS.Transform.toString(transform),
        transition: transition || (transform ? 'transform 150ms ease-apple' : undefined), // Smooth transform transition
        // Styles for the original item while dragging (placeholder appearance)
        ...(isDragging && !isOverlay && {
            opacity: 0.3,
            cursor: 'grabbing',
            backgroundColor: 'hsla(210, 40%, 98%, 0.5)', // Placeholder glass
            backdropFilter: 'blur(2px)',
            boxShadow: 'none', // Remove shadow from original item
            border: '1px dashed hsla(0, 0%, 0%, 0.1)', // Dashed border for placeholder
        }),
        // Styles for the item rendered in the DragOverlay
        ...(isOverlay && {
            cursor: 'grabbing',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', // Stronger shadow for overlay
            // Glass effect is handled by baseClasses below
        }),
        zIndex: isDragging || isOverlay ? 10 : 1, // Ensure dragging item is on top
    }), [overlayStyle, transform, transition, isDragging, isOverlay]);

    // Handle click on the task item body
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent selection if clicking on interactive elements (buttons, inputs) inside the item
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a')) {
            return;
        }
        setSelectedTaskId(task.id);
    }, [setSelectedTaskId, task.id]);

    // Handle checkbox change directly
    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent task selection when clicking checkbox
        const isChecked = e.target.checked;
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: isChecked, updatedAt: Date.now() } : t
            )
        );
        // Optionally deselect task when completed
        if (isChecked && isSelected) {
            setSelectedTaskId(null);
        }
    }, [setTasks, task.id, isSelected, setSelectedTaskId]);

    // Memoize date parsing and overdue check
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => dueDate && !task.completed && !isTrashItem && isOverdue(dueDate), [dueDate, task.completed, isTrashItem]);

    // Construct base classes with glass effects
    const baseClasses = twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-black/10 group relative min-h-[52px] transition-all duration-150 ease-apple', // Consistent ease, darker border
        // Apply glass background based on state
        isOverlay
            ? 'bg-glass-100 backdrop-blur-lg border rounded-md shadow-strong' // Strong glass for overlay
            : isSelected && !isDragging
                ? 'bg-primary/20 backdrop-blur-sm' // Glassy selection
                : isTrashItem
                    ? 'bg-glass-alt/30 backdrop-blur-xs opacity-50 cursor-pointer hover:bg-black/10' // Faded glass for trash
                    : task.completed
                        ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10' // Faded glass for completed
                        : isSortable
                            ? 'bg-transparent hover:bg-black/10 hover:backdrop-blur-sm cursor-pointer' // Transparent default, hover glass
                            : 'bg-transparent cursor-default', // Non-sortable, non-trash/completed
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={baseClasses}
            onClick={handleTaskClick}
            role="button"
            tabIndex={0} // Make it focusable
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTaskClick(e as any); }}
            aria-selected={isSelected}
            aria-label={`Task: ${task.title || 'Untitled'}`}
        >
            {/* Drag Handle */}
            <div className="flex-shrink-0 h-full flex items-center mr-2">
                {isSortable ? (
                    <button
                        {...attributes}
                        {...listeners}
                        onClick={(e) => e.stopPropagation()} // Prevent task selection
                        className={twMerge(
                            "text-muted cursor-grab p-1 -ml-1 opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 focus-visible:opacity-80", // Show on hover/focus
                            "transition-opacity duration-150 ease-apple outline-none rounded focus-visible:ring-1 focus-visible:ring-primary/50",
                            isDragging && "opacity-50" // Slightly visible when dragging
                        )}
                        aria-label="Drag task to reorder"
                        tabIndex={-1} // Not tabbable itself
                    >
                        <Icon name="grip-vertical" size={15} strokeWidth={2} />
                    </button>
                ) : (
                    // Placeholder to maintain alignment when handle isn't shown
                    <div className="w-[27px]"></div>
                )}
            </div>

            {/* Checkbox */}
            <div className="flex-shrink-0 mr-2.5 pt-[3px]">
                <input
                    type="checkbox"
                    id={`task-checkbox-${task.id}`}
                    checked={task.completed}
                    onChange={handleCheckboxChange}
                    onClick={(e) => e.stopPropagation()} // Prevent task selection
                    className={twMerge(
                        "h-4 w-4 rounded border-2 transition duration-150 ease-apple cursor-pointer appearance-none", // Smoother transition
                        "focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 focus:ring-offset-current/50 focus:outline-none", // Adjust ring offset based on background
                        task.completed
                            ? 'bg-gray-300 border-gray-300 hover:bg-gray-400 hover:border-gray-400'
                            : 'bg-white/30 border-gray-400/80 hover:border-primary/60 backdrop-blur-sm', // Glassy unchecked
                        'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
                        'after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-solid after:border-transparent after:transition-opacity after:duration-100',
                        task.completed ? 'after:border-white after:opacity-100' : 'after:opacity-0',
                        isTrashItem && 'opacity-50 cursor-not-allowed !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400' // Glassy disabled
                    )}
                    aria-labelledby={`task-title-${task.id}`}
                    disabled={isTrashItem}
                />
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only">Complete task</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-[1px]">
                {/* Task Title with Highlighting */}
                <Highlighter
                    highlightClassName="bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs" // Brighter highlight
                    searchWords={searchTerm ? searchTerm.split(' ').filter(Boolean) : []} // Split search term
                    autoEscape={true}
                    textToHighlight={task.title || 'Untitled Task'}
                    id={`task-title-${task.id}`}
                    className={twMerge(
                        "text-sm text-gray-800 leading-snug block", // Use block for proper highlighting layout
                        (task.completed || isTrashItem) && "line-through text-muted-foreground"
                    )}
                />

                {/* Subline: Priority, Date, List, Tags, Content Snippet */}
                <div className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight">
                    {/* Priority Indicator */}
                    {task.priority && task.priority <= 2 && !task.completed && !isTrashItem && (
                        <span className={clsx("flex items-center", { 'text-red-600': task.priority === 1, 'text-orange-500': task.priority === 2 })} title={`Priority ${task.priority}`}>
                            <Icon name="flag" size={11} strokeWidth={2.5}/>
                        </span>
                    )}
                    {/* Due Date */}
                    {dueDate && !task.completed && !isTrashItem && (
                        <span className={clsx('flex items-center whitespace-nowrap', overdue && 'text-red-600 font-medium')}>
                            <Icon name="calendar" size={11} className="mr-0.5 opacity-70" />
                            {formatRelativeDate(dueDate)}
                        </span>
                    )}
                    {/* List Badge (only if not Inbox and not selected) */}
                    {task.list && task.list !== 'Inbox' && !isTrashItem && !task.completed && !isSelected && (
                        // Glassy list badge
                        <span className="flex items-center whitespace-nowrap bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate backdrop-blur-sm" title={task.list}>
                            <Icon name="list" size={10} className="mr-0.5 opacity-70 flex-shrink-0" />
                            <span className="truncate">{task.list}</span>
                        </span>
                    )}
                    {/* Tag Badges */}
                    {task.tags && task.tags.length > 0 && !task.completed && !isTrashItem && (
                        <span className="flex items-center space-x-1">
                             {task.tags.slice(0, 2).map(tag => (
                                 // Glassy tag badge
                                 <span key={tag} className="bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate backdrop-blur-sm" title={tag}>
                                     #{tag}
                                 </span>
                             ))}
                            {task.tags.length > 2 && <span className="text-muted-foreground text-[10px]">+{task.tags.length - 2}</span>}
                         </span>
                    )}
                    {/* Content Snippet Highlight */}
                    {searchTerm && task.content && task.content.toLowerCase().includes(searchTerm.toLowerCase()) && !task.title.toLowerCase().includes(searchTerm.toLowerCase()) && (
                        <Highlighter
                            highlightClassName="bg-yellow-300/70 rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs"
                            searchWords={searchTerm.split(' ').filter(Boolean)}
                            autoEscape={true}
                            textToHighlight={'...' + task.content.substring(task.content.toLowerCase().indexOf(searchTerm.toLowerCase()), task.content.toLowerCase().indexOf(searchTerm.toLowerCase()) + 35) + '...'} // Show snippet
                            className="block truncate text-xs text-muted mt-0.5 italic"
                        />
                    )}
                </div>
            </div>

            {/* More Actions Button (Hidden by default, appears on hover/focus) */}
            {isSortable && !isOverlay && (
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ease-apple">
                    <Button
                        variant="ghost"
                        size="icon"
                        icon="more-horizontal"
                        className="h-6 w-6 text-muted-foreground hover:bg-black/15" // Glassy hover
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent task selection
                            console.log('More actions for task:', task.id);
                            setSelectedTaskId(task.id); // Select task when opening actions
                        }}
                        aria-label={`More actions for ${task.title || 'task'}`}
                        tabIndex={0} // Make focusable
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(TaskItem);