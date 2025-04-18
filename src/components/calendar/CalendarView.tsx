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
import { AnimatePresence, motion } from 'framer-motion';

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
        // Smooth transition for transform, slightly reduced duration
        transition: overlayStyle ? undefined : transform ? 'transform 150ms ease-apple' : undefined,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);

    // Enhanced glass effect base
    const baseClasses = twMerge(
        "w-full text-left px-1.5 py-0.5 rounded-[5px] truncate text-[11px] transition-all duration-150 ease-apple cursor-grab relative mb-0.5", // Consistent ease
        // Glass background based on state
        task.completed
            ? 'bg-glass-alt/50 text-muted-foreground line-through italic opacity-60 pointer-events-none backdrop-blur-xs' // Muted completed glass
            : 'bg-primary/15 text-primary-dark backdrop-blur-sm hover:bg-primary/25 hover:backdrop-blur-sm', // Brighter glass base
        // Priority indicators as subtle dots
        task.priority === 1 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-500",
        task.priority === 2 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-orange-400",
        // Overdue style overrides priority dot color - stronger glass
        overdue && !task.completed && 'text-red-600 bg-red-500/20 backdrop-blur-sm hover:bg-red-500/30 before:bg-red-600',
        // Style for the original item while dragging (more transparent glassy)
        isDragging && !overlayStyle && "shadow-medium bg-glass/30 backdrop-blur-sm ring-1 ring-primary/30 opacity-40",
        // Style for the item in the overlay (prominent glass)
        overlayStyle && "shadow-strong ring-1 ring-primary/30 bg-glass-100 backdrop-blur-lg" // Stronger blur
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
    day: Date;
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}

const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = ({ children, className, isOver }) => {
    return (
        <motion.div
            className={twMerge(
                'h-full w-full transition-colors duration-150 ease-apple', // Ensure full size and consistent transition
                className,
                // Subtle highlight effect on drop target (glassy)
                isOver && 'bg-primary/20 backdrop-blur-sm ring-1 ring-inset ring-primary/40' // Slightly stronger ring/blur
            )}
            // Smooth scale animation on hover
            animate={{ scale: isOver ? 1.02 : 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }} // Use a standard smooth ease
        >
            {children}
        </motion.div>
    );
};

const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = React.memo(({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`, // Unique ID for the day cell
        data: { date: day, type: 'calendar-day' },
    });

    return (
        <div ref={setNodeRef} className="h-full w-full relative"> {/* Removed unnecessary bg */}
            <DroppableDayCellContent day={day} className={className} isOver={isOver}>
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
    const [monthDirection, setMonthDirection] = useState<number>(0); // For animation direction

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
            // Sort by priority (ascending, so 1 is highest), then by creation time (newest first)
            dayTasks.sort((a, b) => ((a.priority ?? 5) - (b.priority ?? 5)) || (b.createdAt - a.createdAt));
        });
        return grouped;
    }, [tasks]);

    const handleTaskClick = useCallback((taskId: string) => {
        setSelectedTaskId(taskId);
    }, [setSelectedTaskId]);

    const changeMonth = useCallback((direction: -1 | 1) => {
        setMonthDirection(direction); // Set direction for animation
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
    }, []);

    const goToToday = useCallback(() => {
        const todayMonthStart = startOfMonth(new Date());
        const currentMonthStart = startOfMonth(currentMonthDate);
        // Determine animation direction based on current vs today's month
        if (isBefore(todayMonthStart, currentMonthStart)) setMonthDirection(-1);
        else if (isBefore(currentMonthStart, todayMonthStart)) setMonthDirection(1);
        else setMonthDirection(0); // No direction if already in the same month
        setCurrentMonthDate(startOfDay(new Date()));
    }, [currentMonthDate]);

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

                // Only update if the day has actually changed
                if (!currentDueDateStart || !isSameDay(currentDueDateStart, newDueDateStart)) {
                    setTasks(prevTasks =>
                        prevTasks.map(task => {
                            if (task.id === taskId) {
                                let newTimestamp = newDueDateStart.getTime();
                                const currentTaskDateTime = safeParseDate(task.dueDate);
                                // Preserve original time if it exists
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

    // Smoother animation variants for month text
    const monthTextVariants = useMemo(() => ({
        initial: (direction: number) => ({ opacity: 0, x: direction > 0 ? 15 : (direction < 0 ? -15 : 0) }), // Slightly larger x offset
        animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }, // Apple ease
        exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -15 : (direction < 0 ? 15 : 0), transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }), // Faster exit ease
    }), []);

    const weekDays = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);

    // Memoized render function for calendar days
    const renderCalendarDay = useCallback((day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const dayOfWeek = getDay(day);

        const MAX_VISIBLE_TASKS = 3; // Keep max tasks reasonable

        return (
            <DroppableDayCell
                key={day.toISOString()}
                day={day}
                className={twMerge(
                    'flex flex-col relative transition-colors duration-150 ease-apple overflow-hidden', // Consistent ease
                    // Enhanced glass effect within grid - vary by month
                    isCurrentMonthDay ? 'bg-glass/90' : 'bg-glass-alt/60', // Glassy backgrounds, slightly more opaque
                    'border-t border-l border-black/10 backdrop-blur-md', // Subtle borders, stronger blur
                    dayOfWeek === 0 && 'border-l-0', // Remove left border for Sunday
                    index < 7 && 'border-t-0', // Remove top border for first row
                    'group' // For potential hover effects within the cell
                )}
            >
                {/* Day Number and Task Count */}
                <div className="flex justify-between items-center px-1.5 pt-1 pb-0.5 flex-shrink-0">
                    <span className={clsx(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-150 ease-apple', // Smooth transition
                        isToday ? 'bg-primary text-white font-semibold shadow-sm' : 'text-gray-600',
                        !isCurrentMonthDay && !isToday && 'text-gray-400 opacity-60' // Muted non-current month days
                    )}>
                        {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && isCurrentMonthDay && (
                        <motion.span
                            className="text-[10px] text-muted-foreground bg-black/10 backdrop-blur-sm px-1 py-0.5 rounded-full font-mono" // Glassy count badge
                            // Subtle pop-in animation
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                        >
                            {dayTasks.length}
                        </motion.span>
                    )}
                </div>
                {/* Task List Area - Ensure it scrolls */}
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
                {/* Stronger visual separation for non-current month days */}
                {!isCurrentMonthDay && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/20 to-gray-500/10 backdrop-blur-md opacity-80 pointer-events-none rounded-[1px]"></div> // Stronger blur, subtle gradient
                )}
            </DroppableDayCell>
        );
    }, [tasksByDueDate, currentMonthDate, handleTaskClick]); // Dependencies for memoization

    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            <div className="h-full flex flex-col bg-glass backdrop-blur-xl overflow-hidden"> {/* Strongest glass container */}
                {/* Header with Stronger Glass Effect */}
                <div className="px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-xl z-10 h-11"> {/* Strongest glass header */}
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={goToToday}
                            variant="glass" // Use glass variant
                            size="sm"
                            className="!h-[30px] px-2.5 backdrop-blur-lg" // Ensure blur on button
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)}
                        >
                            Today
                        </Button>
                        <div className="flex items-center">
                            {/* Use Icon component for chevrons */}
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left" aria-label="Previous month" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                            <AnimatePresence mode="wait" initial={false} custom={monthDirection}>
                                <motion.span
                                    key={format(currentMonthDate, 'yyyy-MM')}
                                    className="mx-2 text-sm font-medium w-28 text-center tabular-nums text-gray-700"
                                    custom={monthDirection}
                                    variants={monthTextVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                >
                                    {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                                </motion.span>
                            </AnimatePresence>
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right" aria-label="Next month" className="w-7 h-7 text-muted-foreground hover:bg-black/15" />
                        </div>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-hidden p-3">
                    {/* Grid structure with rounded corners and shadow - Strong glass effect */}
                    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden shadow-strong border border-black/10 bg-glass backdrop-blur-xl"> {/* Enhanced glass grid container */}
                        {/* Weekday Headers - Apply strong glass effect */}
                        <div className="grid grid-cols-7 flex-shrink-0 border-b border-black/10 bg-glass-alt-100 backdrop-blur-xl"> {/* Strongest glass weekday header */}
                            {weekDays.map((day) => (
                                <div key={day} className="text-center py-1.5 text-[11px] font-semibold text-muted-foreground border-l border-black/5 first:border-l-0">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days Grid */}
                        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
                            {/* Render days using the memoized function */}
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for visual feedback */}
            <DragOverlay dropAnimation={null} /* Disable default drop animation */ >
                {draggingTask ? (
                    <DraggableCalendarTask
                        task={draggingTask}
                        onClick={() => {}} // No action needed on overlay click
                        style={{ cursor: 'grabbing' }} // Apply grabbing cursor via style prop
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;