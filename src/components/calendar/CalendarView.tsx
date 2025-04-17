// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task } from '@/types';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    getDay,
    startOfDay,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { isToday as isTodayFn, safeParseDate } from "@/utils/dateUtils.ts";

// Draggable Task Item for Calendar
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
}

const DraggableCalendarTask: React.FC<DraggableTaskProps> = ({ task, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `task-${task.id}`,
        data: { task }, // Pass task data
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 1, // Ensure dragged item is on top
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={twMerge(
                "w-full text-left p-1 rounded-sm truncate transition-all duration-150 cursor-grab", // Use grab cursor
                task.completed ? 'bg-gray-100 text-muted line-through' : 'bg-primary/10 text-primary-dark hover:bg-primary/20',
                task.priority === 1 && !task.completed && "border-l-2 border-red-500 pl-0.5",
                task.priority === 2 && !task.completed && "border-l-2 border-orange-400 pl-0.5",
                isDragging && "shadow-lg bg-white ring-1 ring-primary/50" // Style for dragging item
            )}
            title={task.title}
        >
            {task.title}
        </button>
    );
}

// Droppable Day Cell
interface DroppableDayProps {
    day: Date;
    children: React.ReactNode;
    className?: string;
}

const DroppableDayCell: React.FC<DroppableDayProps> = ({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`,
        data: { date: day }, // Pass date data
    });

    return (
        <div
            ref={setNodeRef}
            className={twMerge(
                className,
                isOver && 'bg-primary/10 ring-1 ring-primary/30 transition-colors duration-100' // Highlight when dropping over
            )}
        >
            {children}
        </div>
    );
};


const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTask, setDraggingTask] = useState<Task | null>(null); // Track dragging task for overlay

    const firstDayCurrentMonth = startOfMonth(currentMonthDate);
    const lastDayCurrentMonth = endOfMonth(currentMonthDate);

    const startDate = startOfWeek(firstDayCurrentMonth, { locale: enUS });
    const endDate = endOfWeek(lastDayCurrentMonth, { locale: enUS });

    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            // Include tasks due on this date, regardless of completion status for display, but filter out trashed
            if (task.dueDate && task.list !== 'Trash') {
                const parsedDate = safeParseDate(task.dueDate);
                if (parsedDate) {
                    const dateKey = format(parsedDate, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) {
                        grouped[dateKey] = [];
                    }
                    grouped[dateKey].push(task);
                }
            }
        });
        // Sort tasks within each day (e.g., by priority, then creation time)
        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || a.createdAt - b.createdAt);
        });
        return grouped;
    }, [tasks]);

    const handleTaskClick = (taskId: string) => {
        // Navigate to the main task view to show details?
        // Or open a popover/modal here? For now, just select it.
        setSelectedTaskId(taskId);
        // Maybe navigate('/'); // Navigate to a view where TaskDetail is shown
    };

    const renderCalendarDay = (day: Date) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonth = isSameMonth(day, currentMonthDate);
        const dayIsToday = isSameDay(day, new Date());
        const dayOfWeek = getDay(day); // 0 for Sunday, 6 for Saturday

        return (
            <DroppableDayCell
                key={day.toString()}
                day={day}
                className={twMerge(
                    'h-32 md:h-36 border-t border-l border-gray-200/60 flex flex-col relative transition-colors duration-150 ease-in-out',
                    !isCurrentMonth && 'bg-canvas-inset/50 text-muted',
                    isCurrentMonth && 'bg-canvas hover:bg-gray-50/30',
                    dayIsToday && 'bg-primary/5',
                    dayOfWeek === 0 && 'border-l-0', // No left border for Sunday
                    // Tailwind grid handles borders, but ensure top on first row and left on first col are correct visually
                    'group' // Add group for potential hover effects within cell
                )}
            >
                {/* Day Number */}
                <div className="flex justify-between items-center px-1.5 pt-1.5 pb-1 flex-shrink-0">
                     <span className={clsx(
                         'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                         dayIsToday ? 'bg-primary text-white font-semibold' : 'text-gray-600',
                         !isCurrentMonth && !dayIsToday && 'text-gray-400'
                     )}>
                        {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && isCurrentMonth && (
                        <span className="text-[10px] text-muted-foreground bg-gray-100 px-1 py-0.5 rounded-full font-mono">
                           {dayTasks.length}
                        </span>
                    )}
                </div>

                {/* Task List - Only show tasks for the current month */}
                {isCurrentMonth && (
                    <div className="overflow-y-auto styled-scrollbar flex-1 space-y-1 text-xs px-1 pb-1">
                        {dayTasks.slice(0, 4).map((task) => ( // Show up to 4 tasks
                            <DraggableCalendarTask
                                key={task.id}
                                task={task}
                                onClick={() => handleTaskClick(task.id)}
                            />
                        ))}
                        {dayTasks.length > 4 && (
                            <div className="text-[10px] text-muted-foreground pt-0.5 px-1">+ {dayTasks.length - 4} more</div>
                        )}
                    </div>
                )}
                {/* Placeholder for empty days in current month */}
                {isCurrentMonth && dayTasks.length === 0 && (
                    <div className="flex-1"></div>
                )}
            </DroppableDayCell>
        );
    };

    const previousMonth = () => setCurrentMonthDate(subMonths(currentMonthDate, 1));
    const nextMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, 1));
    const goToToday = () => setCurrentMonthDate(startOfDay(new Date()));

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const task = event.active.data.current?.task;
        if (task) {
            setDraggingTask(task);
            setSelectedTaskId(task.id); // Select task being dragged
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTask(null); // Clear overlay task
        const { active, over } = event;

        if (over) {
            // 安全地转换 UniqueIdentifier 到字符串
            const activeId = String(active.id);
            const overId = String(over.id);

            if (activeId.startsWith('task-') && overId.startsWith('day-')) {
                const taskId = activeId.substring(5); // Extract task ID
                const targetDay = over.data.current?.date as Date | undefined;

                if (taskId && targetDay) {
                    setTasks((prevTasks) => {
                        // 确保 prevTasks 是数组类型
                        if (!Array.isArray(prevTasks)) {
                            // 如果是 Promise，需要等待解析，但在 useCallback 中难以处理
                            // 我们可以简单地返回当前值，等待下一次更新
                            return prevTasks;
                        }

                        return prevTasks.map(task => {
                            if (task.id === taskId) {
                                // Keep existing time, just change the date part
                                const originalDueDate = safeParseDate(task.dueDate);
                                let newDateTime = startOfDay(targetDay).getTime(); // Default to start of day

                                if (originalDueDate) {
                                    // Preserve original time if it existed
                                    const hours = originalDueDate.getHours();
                                    const minutes = originalDueDate.getMinutes();
                                    const seconds = originalDueDate.getSeconds();
                                    newDateTime = new Date(targetDay).setHours(hours, minutes, seconds, 0);
                                }

                                return {
                                    ...task,
                                    dueDate: newDateTime,
                                    updatedAt: Date.now(),
                                };
                            }
                            return task;
                        });
                    });
                    setSelectedTaskId(null); // Deselect task after dropping
                }
            }
        }
    }, [setTasks, setSelectedTaskId]);

    return (
        // Ensure CalendarView fills the height provided by MainLayout
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} collisionDetection={pointerWithin}>
            <div className="h-full flex flex-col bg-canvas">
                {/* Header */}
                <div className="px-4 py-2 border-b border-gray-200/60 flex justify-between items-center flex-shrink-0">
                    {/* Header with glass effect? Maybe too much? Keep it clean for now. */}
                    {/* <div className="px-4 py-2 border-b border-black/5 dark:border-white/5 flex justify-between items-center flex-shrink-0 bg-glass/darker backdrop-blur-sm"> */}
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={goToToday}
                            variant="outline"
                            size="sm"
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)} // Using imported isToday function
                        >
                            Today
                        </Button>
                        <div className="flex items-center">
                            <Button onClick={previousMonth} variant="ghost" size="icon" aria-label="Previous month" className="w-7 h-7">
                                <Icon name="chevron-left" size={18} />
                            </Button>
                            <span className="mx-2 text-sm font-medium w-28 text-center tabular-nums">
                                 {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                            </span>
                            <Button onClick={nextMonth} variant="ghost" size="icon" aria-label="Next month" className="w-7 h-7">
                                <Icon name="chevron-right" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid - Takes remaining space */}
                {/* Use padding on the container for spacing, let grid fill */}
                <div className="flex-1 overflow-hidden p-2">
                    {/* Grid container ensures structure and borders */}
                    <div className="grid grid-cols-7 h-full border-b border-r border-gray-200/60 rounded-lg overflow-hidden shadow-subtle">
                        {/* Weekday Headers */}
                        {weekDays.map((day) => (
                            <div key={day} className="text-center py-1.5 text-[11px] font-medium text-muted-foreground bg-canvas-alt border-l border-t border-gray-200/60 first:border-l-0">
                                {day}
                            </div>
                        ))}
                        {/* Calendar Days - Render days, grid layout handles positioning */}
                        {daysInGrid.map(renderCalendarDay)}
                    </div>
                </div>
            </div>
            {/* Drag Overlay for visual feedback */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <div className="text-xs w-full text-left p-1 rounded-sm truncate shadow-lg bg-white ring-1 ring-primary/50" title={draggingTask.title}>
                        {draggingTask.title}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;