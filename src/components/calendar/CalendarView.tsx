// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task } from '@/types';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay, startOfDay, isBefore, enUS, safeParseDate, isToday as isTodayFn
} from '@/utils/dateUtils'; // Use re-exported functions and utils
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

const DraggableCalendarTask: React.FC<DraggableTaskProps> = ({ task, onClick, style: overlayStyle }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `caltask-${task.id}`, // Unique prefix for calendar tasks
        data: { task, type: 'calendar-task' },
    });

    const style = {
        ...overlayStyle, // Apply overlay styles if provided
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    const isOverdue = task.dueDate != null && isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date())) && !task.completed;

    // Base classes
    const baseClasses = twMerge(
        "w-full text-left px-1.5 py-0.5 rounded-[5px] truncate text-[11px] transition-all duration-100 cursor-grab relative mb-0.5", // Slightly larger radius, margin bottom
        task.completed ? 'bg-gray-100 text-muted line-through italic opacity-70 pointer-events-none' : 'bg-primary/10 text-primary-dark hover:bg-primary/20',
        // Priority indicators as subtle dots
        task.priority === 1 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-500",
        task.priority === 2 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-orange-400",
        // Overdue style overrides priority dot color
        isOverdue && !task.completed && 'text-red-600 bg-red-500/10 hover:bg-red-500/20 before:bg-red-600',
        isDragging && "shadow-medium bg-white ring-1 ring-primary/50", // Style for the original item while dragging
        overlayStyle && "shadow-strong ring-1 ring-primary/50" // Style for the item in the overlay
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
            // layoutId={`calendar-task-${task.id}`} // Optional: Animate across different days? Might be complex.
        >
            {task.title || <span className="italic text-muted">Untitled</span>}
        </button>
    );
}

// --- Droppable Day Cell ---
interface DroppableDayProps {
    day: Date;
    children: React.ReactNode;
    className?: string;
    isOver: boolean; // Pass isOver state down
}

const DroppableDayCellContent: React.FC<DroppableDayProps> = ({ day: _day, children, className, isOver }) => {
    // Cell content styling based on isOver state
    return (
        <div
            className={twMerge(
                className,
                // Subtle highlight effect on drop target
                isOver && 'bg-primary/10 ring-1 ring-inset ring-primary/30 scale-[1.01] transition-all duration-150'
            )}
        >
            {children}
        </div>
    );
};

const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = ({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`, // Unique ID for the day cell
        data: { date: day, type: 'calendar-day' },
    });

    return (
        <div ref={setNodeRef} className="h-full w-full"> {/* Wrapper div for the ref */}
            <DroppableDayCellContent day={day} className={className} isOver={isOver}>
                {children}
            </DroppableDayCellContent>
        </div>
    );
};

// --- Main Calendar View Component ---
const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom); // Use selected task atom
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null); // Track dragging task ID
    const [monthDirection, setMonthDirection] = useState<number>(0); // For animation: 0: none, -1: prev, 1: next

    // Get the task being dragged for the overlay
    const draggingTask = useMemo(() => {
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', ''); // Get original task ID
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);


    // Calculate dates for the grid
    const firstDayCurrentMonth = startOfMonth(currentMonthDate);
    const lastDayCurrentMonth = endOfMonth(currentMonthDate);
    const startDate = startOfWeek(firstDayCurrentMonth, { locale: enUS });
    const endDate = endOfWeek(lastDayCurrentMonth, { locale: enUS });
    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    // Group tasks by due date (memoized)
    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            // Only include non-trashed tasks with a valid due date
            if (task.dueDate && task.list !== 'Trash') {
                const parsedDate = safeParseDate(task.dueDate);
                if (parsedDate) {
                    const dateKey = format(parsedDate, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            }
        });
        // Sort tasks within each day: Priority (High to Low), then Creation Time (Newest First)
        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => ((a.priority ?? 5) - (b.priority ?? 5)) || (b.createdAt - a.createdAt));
        });
        return grouped;
    }, [tasks]);

    // --- Event Handlers ---
    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId); // Select task to show details (if TaskDetail is configured globally)
        // Consider navigating or showing a popover if TaskDetail isn't always visible
    };

    // Month Navigation
    const changeMonth = (direction: -1 | 1) => {
        setMonthDirection(direction);
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
    };
    const goToToday = () => {
        const todayMonthStart = startOfMonth(new Date());
        const currentMonthStart = startOfMonth(currentMonthDate);
        if (isBefore(todayMonthStart, currentMonthStart)) setMonthDirection(-1);
        else if (isBefore(currentMonthStart, todayMonthStart)) setMonthDirection(1);
        else setMonthDirection(0); // No animation if same month
        setCurrentMonthDate(startOfDay(new Date()));
    };

    // DND Handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        // Ensure we are dragging a calendar task
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id); // Select task being dragged
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTaskId(null); // Clear dragging state
        const { active, over } = event;

        // Check if dropped onto a valid day cell and started dragging a calendar task
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;

            if (taskId && targetDay && originalTask) {
                const currentDueDate = originalTask.dueDate ? startOfDay(safeParseDate(originalTask.dueDate)!) : null;
                const newDueDate = startOfDay(targetDay);

                // Only update if the date *actually* changed
                if (!currentDueDate || !isSameDay(currentDueDate, newDueDate)) {
                    setTasks((prevTasks: Task[]) =>
                        prevTasks.map(task => {
                            if (task.id === taskId) {
                                // --- Preserve Time Logic ---
                                const originalDateTime = safeParseDate(task.dueDate);
                                let newTimestamp = newDueDate.getTime(); // Default to start of target day

                                if (originalDateTime) {
                                    // Keep original hours/minutes/seconds if they existed
                                    const hours = originalDateTime.getHours();
                                    const minutes = originalDateTime.getMinutes();
                                    const seconds = originalDateTime.getSeconds();
                                    const updatedDateWithTime = new Date(newDueDate); // Start with target day 00:00
                                    updatedDateWithTime.setHours(hours, minutes, seconds, 0); // Set original time
                                    newTimestamp = updatedDateWithTime.getTime();
                                }
                                // --- End Preserve Time Logic ---

                                return {
                                    ...task,
                                    dueDate: newTimestamp,
                                    updatedAt: Date.now(), // Update timestamp
                                };
                            }
                            return task;
                        })
                    );
                }
                // Keep task selected after drop
                // setSelectedTaskId(taskId);
            }
        }
        // Optional: Deselect task if dropped outside a valid target
        // else { setSelectedTaskId(null); }

    }, [setTasks]);

    // Animation variants for month text change
    const monthTextVariants = {
        initial: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? 10 : (direction < 0 ? -10 : 0), // Subtle slide
        }),
        animate: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.25, ease: 'easeOut' } // Faster transition
        },
        exit: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? -10 : (direction < 0 ? 10 : 0), // Slide opposite direction
            transition: { duration: 0.15, ease: 'easeIn' } // Faster exit
        }),
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- Render Function for a Single Day Cell ---
    const renderCalendarDay = (day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const dayOfWeek = getDay(day); // 0 = Sun, 6 = Sat

        const MAX_VISIBLE_TASKS = 3; // Max tasks to show before "+ X more"

        return (
            <DroppableDayCell
                key={day.toISOString()}
                day={day}
                className={twMerge(
                    'flex flex-col relative transition-colors duration-150 ease-in-out overflow-hidden',
                    'border-t border-l border-border-color/70', // Standard borders
                    // Backgrounds
                    !isCurrentMonthDay && 'bg-canvas-inset/50', // Dim non-current month days
                    isCurrentMonthDay && 'bg-canvas',
                    // Borders - remove outer borders visually handled by container
                    dayOfWeek === 0 && 'border-l-0', // No left border for first column
                    index < 7 && 'border-t-0', // No top border for first row
                    'group' // For hover effects if needed
                )}
            >
                {/* Day Number Header */}
                <div className="flex justify-between items-center px-1.5 pt-1 pb-0.5 flex-shrink-0">
                    {/* Day number */}
                    <span className={clsx(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-150',
                        isToday ? 'bg-primary text-white font-semibold shadow-sm' : 'text-gray-600',
                        !isCurrentMonthDay && !isToday && 'text-gray-400 opacity-60' // Dim non-current month numbers
                    )}>
                        {format(day, 'd')}
                    </span>
                    {/* Task count badge (only for current month days with tasks) */}
                    {dayTasks.length > 0 && isCurrentMonthDay && (
                        <motion.span
                            className="text-[10px] text-muted-foreground bg-gray-100/80 px-1 py-0.5 rounded-full font-mono"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.15 }}
                        >
                            {dayTasks.length}
                        </motion.span>
                    )}
                </div>

                {/* Task List Area */}
                <div className="overflow-y-auto styled-scrollbar flex-1 space-y-0.5 px-1 pb-1 min-h-[50px]"> {/* Min height for drop */}
                    {/* Render tasks only for the current month */}
                    {isCurrentMonthDay && dayTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                        // Optional: Add animation per task if desired, but might be too much
                        <DraggableCalendarTask
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task.id)}
                        />
                    ))}
                    {/* "+ X more" indicator */}
                    {isCurrentMonthDay && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <div className="text-[10px] text-muted pt-0.5 px-1 text-center opacity-80">
                            + {dayTasks.length - MAX_VISIBLE_TASKS} more
                        </div>
                    )}
                </div>
                {/* Subtle gradient overlay for non-current month days */}
                {!isCurrentMonthDay && (
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 opacity-30 pointer-events-none"></div>
                )}
            </DroppableDayCell>
        );
    };


    // --- Main Component Render ---
    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin} // Simple collision detection
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Ensure droppables are measured correctly
        >
            <div className="h-full flex flex-col bg-canvas overflow-hidden">
                {/* Header with Glass Effect */}
                <div className="px-4 py-2 border-b border-black/5 flex justify-between items-center flex-shrink-0 bg-glass-200 backdrop-blur-sm z-10">
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        {/* Today Button */}
                        <Button
                            onClick={goToToday}
                            variant="outline"
                            size="sm"
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)} // Disable if viewing today in current month
                        >
                            Today
                        </Button>
                        {/* Month Navigation */}
                        <div className="flex items-center">
                            {/* Previous Month Button */}
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" aria-label="Previous month" className="w-7 h-7 text-muted-foreground">
                                <Icon name="chevron-left" size={18} />
                            </Button>
                            {/* Animated Month/Year Display */}
                            <AnimatePresence mode="wait" initial={false} custom={monthDirection}>
                                <motion.span
                                    key={format(currentMonthDate, 'yyyy-MM')} // Key changes on month change
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
                            {/* Next Month Button */}
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" aria-label="Next month" className="w-7 h-7 text-muted-foreground">
                                <Icon name="chevron-right" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-hidden p-3"> {/* Padding around the grid */}
                    {/* Grid structure with rounded corners and shadow */}
                    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden shadow-subtle border border-border-color/60 bg-white">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 flex-shrink-0 border-b border-border-color/70">
                            {weekDays.map((day) => (
                                <div key={day} className="text-center py-1.5 text-[11px] font-semibold text-muted-foreground bg-canvas-alt/70 border-l border-border-color/70 first:border-l-0">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days Grid - takes remaining space */}
                        {/* Use grid-rows-6 for standard 6-row layout */}
                        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0"> {/* min-h-0 prevents content growth issues */}
                            {/* Render day cells */}
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for visual feedback */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    // Apply specific styling for the overlay item
                    <DraggableCalendarTask
                        task={draggingTask}
                        onClick={() => {}} // No click action needed for overlay
                        // Pass explicit style for overlay appearance
                        style={{
                            boxShadow: '0 6px 10px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.08)',
                            cursor: 'grabbing'
                        }}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;