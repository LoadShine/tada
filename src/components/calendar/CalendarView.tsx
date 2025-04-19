// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Button from '../common/Button';
import { Task } from '@/types';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay, startOfDay, isBefore, enUS, safeParseDate, isToday as isTodayFn, isValid
} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import {
    DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable,
    DragOverlay, pointerWithin, MeasuringStrategy, UniqueIdentifier
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- Draggable Task Item for Calendar ---
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
    style?: React.CSSProperties; // For DragOverlay
}

const DraggableCalendarTask: React.FC<DraggableTaskProps> = React.memo(({ task, onClick, style: overlayStyle }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `caltask-${task.id}`, // Unique prefix for calendar tasks
        data: { task, type: 'calendar-task' },
    });

    const style = {
        ...overlayStyle, // Apply overlay styles if provided
        transform: CSS.Translate.toString(transform),
        // Smooth transition for transform only
        transition: overlayStyle ? undefined : transform ? 'transform 150ms ease-apple' : undefined,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);

    const baseClasses = twMerge(
        "w-full text-left px-1.5 py-0.5 rounded-[5px] truncate text-[11px] transition-colors duration-150 ease-apple cursor-grab relative mb-0.5", // Keep color transition
        task.completed
            ? 'bg-glass-alt/50 text-muted-foreground line-through italic opacity-60 pointer-events-none backdrop-blur-xs'
            : 'bg-primary/15 text-primary-dark backdrop-blur-sm hover:bg-primary/25 hover:backdrop-blur-sm',
        task.priority === 1 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-500",
        task.priority === 2 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-orange-400",
        overdue && !task.completed && 'text-red-600 bg-red-500/20 backdrop-blur-sm hover:bg-red-500/30 before:bg-red-600',
        isDragging && !overlayStyle && "shadow-medium bg-glass/30 backdrop-blur-sm ring-1 ring-primary/30 opacity-40",
        overlayStyle && "shadow-strong ring-1 ring-primary/30 bg-glass-100 backdrop-blur-lg"
    );

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={baseClasses}
            title={task.title}
        >
            {task.title || <span className="italic text-muted">Untitled</span>}
        </button>
    );
});
DraggableCalendarTask.displayName = 'DraggableCalendarTask';


// --- Droppable Day Cell ---
interface DroppableDayCellContentProps {
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}

const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = React.memo(({ children, className, isOver }) => {
    // Removed motion.div and scale animation
    return (
        <div
            className={twMerge(
                'h-full w-full transition-colors duration-150 ease-apple', // Keep color transition
                className,
                isOver && 'bg-primary/20 backdrop-blur-sm ring-1 ring-inset ring-primary/40'
            )}
        >
            {children}
        </div>
    );
});
DroppableDayCellContent.displayName = 'DroppableDayCellContent';

const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = React.memo(({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`,
        data: { date: day, type: 'calendar-day' },
    });

    return (
        <div ref={setNodeRef} className="h-full w-full relative">
            <DroppableDayCellContent className={className} isOver={isOver}>
                {children}
            </DroppableDayCellContent>
        </div>
    );
});
DroppableDayCell.displayName = 'DroppableDayCell';


// --- Main Calendar View Component ---
const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null);
    // Removed monthDirection state - no animation

    const draggingTask = useMemo(() => {
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', '');
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);

    const firstDayCurrentMonth = useMemo(() => startOfMonth(currentMonthDate), [currentMonthDate]);
    const lastDayCurrentMonth = useMemo(() => endOfMonth(currentMonthDate), [currentMonthDate]);
    const startDate = useMemo(() => startOfWeek(firstDayCurrentMonth, { locale: enUS }), [firstDayCurrentMonth]);
    const endDate = useMemo(() => endOfWeek(lastDayCurrentMonth, { locale: enUS }), [lastDayCurrentMonth]);
    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            if (task.dueDate && task.list !== 'Trash') {
                const parsedDate = safeParseDate(task.dueDate);
                if (parsedDate && isValid(parsedDate)) {
                    const dateKey = format(parsedDate, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            }
        });
        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => ((a.priority ?? 5) - (b.priority ?? 5)) || (b.createdAt - a.createdAt));
        });
        return grouped;
    }, [tasks]);

    const handleTaskClick = useCallback((taskId: string) => {
        setSelectedTaskId(taskId);
    }, [setSelectedTaskId]);

    const changeMonth = useCallback((direction: -1 | 1) => {
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
    }, []);

    const goToToday = useCallback(() => {
        setCurrentMonthDate(startOfDay(new Date()));
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id);
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTaskId(null);
        const { active, over } = event;

        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;

            if (taskId && targetDay && originalTask) {
                const originalDateTime = safeParseDate(originalTask.dueDate);
                const currentDueDateStart = originalDateTime ? startOfDay(originalDateTime) : null;
                const newDueDateStart = startOfDay(targetDay);

                if (!currentDueDateStart || !isSameDay(currentDueDateStart, newDueDateStart)) {
                    setTasks(prevTasks =>
                        prevTasks.map(task => {
                            if (task.id === taskId) {
                                let newTimestamp = newDueDateStart.getTime();
                                const currentTaskDateTime = safeParseDate(task.dueDate);
                                if (currentTaskDateTime && isValid(currentTaskDateTime)) {
                                    const hours = currentTaskDateTime.getHours();
                                    const minutes = currentTaskDateTime.getMinutes();
                                    const seconds = currentTaskDateTime.getSeconds();
                                    const updatedDateWithTime = new Date(newDueDateStart);
                                    updatedDateWithTime.setHours(hours, minutes, seconds, 0);
                                    newTimestamp = updatedDateWithTime.getTime();
                                }
                                return { ...task, dueDate: newTimestamp, updatedAt: Date.now() };
                            }
                            return task;
                        })
                    );
                }
            }
        }
    }, [setTasks]);

    // Removed monthTextVariants

    const weekDays = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);

    const renderCalendarDay = useCallback((day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const dayOfWeek = getDay(day);

        const MAX_VISIBLE_TASKS = 3;

        return (
            <DroppableDayCell
                key={day.toISOString()}
                day={day}
                className={twMerge(
                    'flex flex-col relative transition-colors duration-150 ease-apple overflow-hidden',
                    isCurrentMonthDay ? 'bg-glass/90' : 'bg-glass-alt/60',
                    'border-t border-l border-black/10 backdrop-blur-md',
                    dayOfWeek === 0 && 'border-l-0',
                    index < 7 && 'border-t-0',
                    'group'
                )}
            >
                <div className="flex justify-between items-center px-1.5 pt-1 pb-0.5 flex-shrink-0">
                    <span className={clsx(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-150 ease-apple',
                        isToday ? 'bg-primary text-white font-semibold shadow-sm' : 'text-gray-600',
                        !isCurrentMonthDay && !isToday && 'text-gray-400 opacity-60'
                    )}>
                        {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && isCurrentMonthDay && (
                        // Removed motion.span animation
                        <span className="text-[10px] text-muted-foreground bg-black/10 backdrop-blur-sm px-1 py-0.5 rounded-full font-mono">
                            {dayTasks.length}
                        </span>
                    )}
                </div>
                <div className="overflow-y-auto styled-scrollbar flex-1 space-y-0.5 px-1 pb-1 min-h-[50px]">
                    {isCurrentMonthDay && dayTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                        <DraggableCalendarTask
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task.id)}
                        />
                    ))}
                    {isCurrentMonthDay && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <div className="text-[10px] text-muted-foreground pt-0.5 px-1 text-center opacity-80">
                            + {dayTasks.length - MAX_VISIBLE_TASKS} more
                        </div>
                    )}
                </div>
                {!isCurrentMonthDay && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/20 to-gray-500/10 backdrop-blur-md opacity-80 pointer-events-none rounded-[1px]"></div>
                )}
            </DroppableDayCell>
        );
    }, [tasksByDueDate, currentMonthDate, handleTaskClick]);

    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            <div className="h-full flex flex-col bg-glass backdrop-blur-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-xl z-10 h-11">
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={goToToday}
                            variant="glass"
                            size="sm"
                            className="!h-[30px] px-2.5 backdrop-blur-lg"
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)}
                        >
                            Today
                        </Button>
                        <div className="flex items-center">
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left" aria-label="Previous month" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                            {/* Removed AnimatePresence for month text */}
                            <span className="mx-2 text-sm font-medium w-28 text-center tabular-nums text-gray-700">
                                {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                            </span>
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right" aria-label="Next month" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-3">
                    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden shadow-strong border border-black/10 bg-glass backdrop-blur-xl">
                        <div className="grid grid-cols-7 flex-shrink-0 border-b border-black/10 bg-glass-alt-100 backdrop-blur-xl">
                            {weekDays.map((day) => (
                                <div key={day} className="text-center py-1.5 text-[11px] font-semibold text-muted-foreground border-l border-black/5 first:border-l-0">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <DraggableCalendarTask
                        task={draggingTask}
                        onClick={() => {}}
                        style={{ cursor: 'grabbing' }}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;