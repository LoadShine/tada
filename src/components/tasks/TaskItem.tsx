// src/components/tasks/TaskItem.tsx
// Kept essential DND styles, removed others. Memoized.
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
import Highlighter from "react-highlight-words";

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties; // For DND overlay positioning
}

const TaskItem: React.FC<TaskItemProps> = ({ task, groupCategory, isOverlay = false, style: overlayStyle }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const isSelected = selectedTaskId === task.id;

    const isTrashItem = task.list === 'Trash';
    const isSortable = !task.completed && !isTrashItem;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition, // dnd-kit transition for positioning
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: !isSortable,
        data: { task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory },
    });

    // Combine overlay style with DND transform/transition
    const style = useMemo(() => ({
        ...overlayStyle,
        transform: CSS.Transform.toString(transform),
        // ONLY apply dnd-kit's transition when transform is active
        transition: isDragging ? (transition || 'transform 150ms ease-apple') : undefined,
        ...(isDragging && !isOverlay && {
            opacity: 0.3,
            cursor: 'grabbing',
            backgroundColor: 'hsla(210, 40%, 98%, 0.5)',
            backdropFilter: 'blur(2px)',
            boxShadow: 'none',
            border: '1px dashed hsla(0, 0%, 0%, 0.1)',
        }),
        ...(isOverlay && {
            cursor: 'grabbing',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
        }),
        zIndex: isDragging || isOverlay ? 10 : 1,
    }), [overlayStyle, transform, transition, isDragging, isOverlay]);

    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a')) return;
        setSelectedTaskId(task.id);
    }, [setSelectedTaskId, task.id]);

    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const isChecked = e.target.checked;
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: isChecked, updatedAt: Date.now() } : t
            )
        );
        if (isChecked && isSelected) {
            setSelectedTaskId(null);
        }
    }, [setTasks, task.id, isSelected, setSelectedTaskId]);

    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => dueDate && !task.completed && !isTrashItem && isOverdue(dueDate), [dueDate, task.completed, isTrashItem]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const showContentHighlight = useMemo(() => {
        if (!searchTerm || !task.content) return false;
        const lowerContent = task.content.toLowerCase();
        const lowerTitle = task.title.toLowerCase();
        // Show snippet if search term is in content BUT NOT in title
        return searchWords.some(word => lowerContent.includes(word)) && !searchWords.some(word => lowerTitle.includes(word));
    }, [searchTerm, task.content, task.title, searchWords]);


    const baseClasses = twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-black/10 group relative min-h-[52px]',
        // Keep background/color transitions, remove others like scale/opacity unless related to DND state
        'transition-colors duration-150 ease-apple',
        isOverlay
            ? 'bg-glass-100 backdrop-blur-lg border rounded-md shadow-strong'
            : isSelected && !isDragging
                ? 'bg-primary/20 backdrop-blur-sm'
                : isTrashItem
                    ? 'bg-glass-alt/30 backdrop-blur-xs opacity-50 cursor-pointer hover:bg-black/10'
                    : task.completed
                        ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10'
                        : isSortable
                            ? 'bg-transparent hover:bg-black/10 hover:backdrop-blur-sm cursor-pointer'
                            : 'bg-transparent cursor-default',
        // Apply grab cursor only when actively dragging overlay or the sortable item itself
        (isDragging || isOverlay) && 'cursor-grabbing',
        isSortable && !isDragging && !isOverlay && 'cursor-grab' // Default grab cursor for sortable items
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={baseClasses}
            onClick={handleTaskClick}
            role="button"
            tabIndex={0}
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
                        onClick={(e) => e.stopPropagation()}
                        className={twMerge(
                            "text-muted cursor-grab p-1 -ml-1 opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 focus-visible:opacity-80",
                            "transition-opacity duration-150 ease-apple outline-none rounded focus-visible:ring-1 focus-visible:ring-primary/50",
                            isDragging && "opacity-50 cursor-grabbing" // Explicit grabbing cursor when dragging via handle
                        )}
                        aria-label="Drag task to reorder"
                        tabIndex={-1}
                    >
                        <Icon name="grip-vertical" size={15} strokeWidth={2} />
                    </button>
                ) : (
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
                    onClick={(e) => e.stopPropagation()}
                    className={twMerge(
                        "h-4 w-4 rounded border-2 transition-colors duration-150 ease-apple cursor-pointer appearance-none", // Keep color transition
                        "focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 focus:ring-offset-current/50 focus:outline-none",
                        task.completed
                            ? 'bg-gray-300 border-gray-300 hover:bg-gray-400 hover:border-gray-400'
                            : 'bg-white/30 border-gray-400/80 hover:border-primary/60 backdrop-blur-sm',
                        'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
                        'after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-solid after:border-transparent after:transition-opacity after:duration-100',
                        task.completed ? 'after:border-white after:opacity-100' : 'after:opacity-0',
                        isTrashItem && 'opacity-50 cursor-not-allowed !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400'
                    )}
                    aria-labelledby={`task-title-${task.id}`}
                    disabled={isTrashItem}
                />
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only">Complete task</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-[1px]">
                <Highlighter
                    highlightClassName="bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs"
                    searchWords={searchWords}
                    autoEscape={true}
                    textToHighlight={task.title || 'Untitled Task'}
                    id={`task-title-${task.id}`}
                    className={twMerge(
                        "text-sm text-gray-800 leading-snug block",
                        (task.completed || isTrashItem) && "line-through text-muted-foreground"
                    )}
                />

                <div className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight">
                    {task.priority && task.priority <= 2 && !task.completed && !isTrashItem && (
                        <span className={clsx("flex items-center", { 'text-red-600': task.priority === 1, 'text-orange-500': task.priority === 2 })} title={`Priority ${task.priority}`}>
                            <Icon name="flag" size={11} strokeWidth={2.5}/>
                        </span>
                    )}
                    {dueDate && !task.completed && !isTrashItem && (
                        <span className={clsx('flex items-center whitespace-nowrap', overdue && 'text-red-600 font-medium')}>
                            <Icon name="calendar" size={11} className="mr-0.5 opacity-70" />
                            {formatRelativeDate(dueDate)}
                        </span>
                    )}
                    {task.list && task.list !== 'Inbox' && !isTrashItem && !task.completed && (!isSelected || isDragging) && ( // Show list if not selected OR if dragging
                        <span className="flex items-center whitespace-nowrap bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate backdrop-blur-sm" title={task.list}>
                            <Icon name="list" size={10} className="mr-0.5 opacity-70 flex-shrink-0" />
                            <span className="truncate">{task.list}</span>
                        </span>
                    )}
                    {task.tags && task.tags.length > 0 && !task.completed && !isTrashItem && (
                        <span className="flex items-center space-x-1">
                             {task.tags.slice(0, 2).map(tag => (
                                 <span key={tag} className="bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate backdrop-blur-sm" title={tag}>
                                     #{tag}
                                 </span>
                             ))}
                            {task.tags.length > 2 && <span className="text-muted-foreground text-[10px]">+{task.tags.length - 2}</span>}
                         </span>
                    )}
                    {showContentHighlight && (
                        <Highlighter
                            highlightClassName="bg-yellow-300/70 rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={'...' + task.content!.substring(task.content!.toLowerCase().indexOf(searchWords.find(w => task.content!.toLowerCase().includes(w)) || ''), task.content!.toLowerCase().indexOf(searchWords.find(w => task.content!.toLowerCase().includes(w)) || '') + 35) + '...'} // Improved snippet finding
                            className="block truncate text-xs text-muted mt-0.5 italic"
                        />
                    )}
                </div>
            </div>

            {/* More Actions Button */}
            {isSortable && !isOverlay && (
                // No animation on the button itself
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ease-apple">
                    <Button
                        variant="ghost"
                        size="icon"
                        icon="more-horizontal"
                        className="h-6 w-6 text-muted-foreground hover:bg-black/15"
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('More actions for task:', task.id);
                            setSelectedTaskId(task.id);
                        }}
                        aria-label={`More actions for ${task.title || 'task'}`}
                        tabIndex={0}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(TaskItem); // Memoize TaskItem