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
    isBefore,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay, pointerWithin, MeasuringStrategy } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { isToday as isTodayFn, safeParseDate } from "@/utils/dateUtils.ts";
import { AnimatePresence, motion } from 'framer-motion';

// Draggable Task Item for Calendar - Refined Styling
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
}

const DraggableCalendarTask: React.FC<DraggableTaskProps> = ({ task, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `task-${task.id}`,
        data: { task, type: 'calendar-task' }, // Add type for context
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 1, // Ensure dragged item is high z-index
    };

    const isOverdue = task.dueDate && isBefore(startOfDay(new Date(task.dueDate)), startOfDay(new Date())) && !task.completed;

    return (
        <motion.button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={twMerge(
                "w-full text-left px-1 py-0.5 rounded-[4px] truncate text-[11px] transition-all duration-100 cursor-grab relative", // Smaller radius, font size
                task.completed ? 'bg-gray-100 text-muted line-through italic opacity-70' : 'bg-primary/10 text-primary-dark hover:bg-primary/20',
                // Priority indicators as dots or subtle borders
                task.priority === 1 && !task.completed && "before:content-[''] before:absolute before:left-0 before:top-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-500 pl-2.5", // Dot indicator + padding
                task.priority === 2 && !task.completed && "before:content-[''] before:absolute before:left-0 before:top-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-orange-400 pl-2.5",
                isOverdue && !task.completed && 'text-red-600 bg-red-500/10 hover:bg-red-500/20 before:bg-red-600', // Overdue styling
                isDragging && "shadow-medium bg-white ring-1 ring-primary/50" // Style for dragging item
            )}
            title={task.title}
            layout // Animate layout changes if tasks reorder within day
        >
            {task.title}
        </motion.button>
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
        data: { date: day, type: 'calendar-day' }, // Add type
    });

    return (
        <div
            ref={setNodeRef}
            className={twMerge(
                className,
                // Subtle highlight effect
                isOver && 'bg-primary/10 ring-1 ring-primary/20 transition-colors duration-150 scale-[1.01]' // Scale up slightly
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
    const [monthDirection, setMonthDirection] = useState<number>(0); // 0: current, -1: prev, 1: next

    const firstDayCurrentMonth = startOfMonth(currentMonthDate);
    const lastDayCurrentMonth = endOfMonth(currentMonthDate);

    const startDate = startOfWeek(firstDayCurrentMonth, { locale: enUS });
    const endDate = endOfWeek(lastDayCurrentMonth, { locale: enUS });

    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            // Only include non-trashed tasks relevant for calendar display
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
        // Sort tasks within each day: Priority (High to Low), then Creation Time (Newest First?)
        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => ((a.priority ?? 5) - (b.priority ?? 5)) || (b.createdAt - a.createdAt));
        });
        return grouped;
    }, [tasks]);

    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
        // Consider navigating to the main task view or opening a popover
        // For now, just selects the task, expecting TaskDetail to appear if configured
    };

    const renderCalendarDay = (day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonth = isSameMonth(day, currentMonthDate);
        const dayIsToday = isSameDay(day, new Date());
        const dayOfWeek = getDay(day); // 0 for Sunday, 6 for Saturday

        return (
            <DroppableDayCell
                key={day.toISOString()} // Use ISO string for stable key
                day={day}
                className={twMerge(
                    'flex flex-col relative transition-colors duration-150 ease-in-out overflow-hidden', // Add overflow hidden
                    'border-t border-l border-border-color/60', // Use consistent border color
                    // Conditional Backgrounds
                    !isCurrentMonth && 'bg-canvas-inset/50', // Dim non-current month days
                    isCurrentMonth && 'bg-canvas',
                    dayIsToday && 'bg-primary/5', // Highlight today subtly
                    // No left border for first column (Sunday)
                    dayOfWeek === 0 && 'border-l-0',
                    // Tailwind grid handles rows, but first row needs top border visually covered by header technically
                    index < 7 && 'border-t-0', // Remove top border for first row of days
                    'group' // Add group for hover effects
                )}
            >
                {/* Day Number - improved styling */}
                <div className="flex justify-between items-center px-1.5 pt-1.5 pb-1 flex-shrink-0">
                     <span className={clsx(
                         'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-150',
                         dayIsToday ? 'bg-primary text-white font-semibold shadow-sm' : 'text-gray-600', // Today marker stands out
                         !isCurrentMonth && !dayIsToday && 'text-gray-400 opacity-70' // Dim non-current month numbers
                     )}>
                        {format(day, 'd')}
                    </span>
                    {/* Task count badge - subtle */}
                    {dayTasks.length > 0 && isCurrentMonth && (
                        <motion.span
                            className="text-[10px] text-muted-foreground bg-gray-100 px-1 py-0.5 rounded-full font-mono"
                            initial={{scale: 0.8, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{duration: 0.15}}
                        >
                            {dayTasks.length}
                        </motion.span>
                    )}
                </div>

                {/* Task List - Only show tasks for the current month */}
                {/* Add subtle fade-in for tasks */}
                <div className="overflow-y-auto styled-scrollbar flex-1 space-y-0.5 text-xs px-1 pb-1 min-h-[60px]"> {/* Min height for drop area */}
                    <AnimatePresence>
                        {isCurrentMonth && dayTasks.slice(0, 3).map((task) => ( // Show up to 3 tasks initially
                            <motion.div
                                key={task.id}
                                layout // Animate position changes
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, transition: {duration: 0.1} }}
                                transition={{ duration: 0.15, delay: 0.05 }}
                            >
                                <DraggableCalendarTask
                                    task={task}
                                    onClick={() => handleTaskClick(task.id)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isCurrentMonth && dayTasks.length > 3 && (
                        <div className="text-[10px] text-muted pt-0.5 px-1">+ {dayTasks.length - 3} more</div>
                    )}
                </div>
                {/* Placeholder for empty days */}
                {/* {!isCurrentMonth && <div className="flex-1 bg-gradient-to-br from-transparent via-transparent to-black/5 opacity-10 pointer-events-none"></div>} */}

            </DroppableDayCell>
        );
    };

    // Month navigation with animation direction
    const previousMonth = () => {
        setMonthDirection(-1);
        setCurrentMonthDate(subMonths(currentMonthDate, 1));
    };
    const nextMonth = () => {
        setMonthDirection(1);
        setCurrentMonthDate(addMonths(currentMonthDate, 1));
    };
    const goToToday = () => {
        const todayMonth = startOfMonth(new Date());
        const currentViewMonth = startOfMonth(currentMonthDate);
        if (isBefore(todayMonth, currentViewMonth)) {
            setMonthDirection(-1);
        } else if (isBefore(currentViewMonth, todayMonth)) {
            setMonthDirection(1);
        } else {
            setMonthDirection(0); // No animation if already in the current month
        }
        setCurrentMonthDate(startOfDay(new Date()));
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Drag and Drop Handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        // Ensure we are dragging a calendar task
        if (active.data.current?.type === 'calendar-task') {
            const task = active.data.current?.task as Task;
            setDraggingTask(task);
            setSelectedTaskId(task.id); // Select task being dragged
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTask(null); // Clear overlay task
        const { active, over } = event;

        // Check if 'over' is a droppable day cell and 'active' is a draggable task
        if (over && over.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.id.toString().substring(5); // Extract task ID from `task-${id}`
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;

            if (taskId && targetDay && originalTask) {
                const currentDueDate = originalTask.dueDate ? startOfDay(new Date(originalTask.dueDate)) : null;
                const newDueDate = startOfDay(targetDay);

                // Only update if the date actually changed
                if (!currentDueDate || !isSameDay(currentDueDate, newDueDate)) {
                    setTasks((prevTasks: Task[]) => {
                        return prevTasks.map(task => {
                            if (task.id === taskId) {
                                // Keep existing time, just change the date part
                                const originalDateTime = safeParseDate(task.dueDate);
                                let newTimestamp = newDueDate.getTime(); // Default to start of day

                                if (originalDateTime) {
                                    // Preserve original time if it existed
                                    const hours = originalDateTime.getHours();
                                    const minutes = originalDateTime.getMinutes();
                                    const seconds = originalDateTime.getSeconds();
                                    // Create new Date object for the target day, then set time
                                    const updatedDate = new Date(targetDay);
                                    updatedDate.setHours(hours, minutes, seconds, 0);
                                    newTimestamp = updatedDate.getTime();
                                }

                                return {
                                    ...task,
                                    dueDate: newTimestamp,
                                    updatedAt: Date.now(),
                                    order: task.order // Preserve original order for now, DND reordering is separate
                                };
                            }
                            return task;
                        });
                    });
                }
                // Deselect task after successful drop? Maybe not, keep it selected.
                // setSelectedTaskId(null);
            }
        }
    }, [setTasks]);

    // Animation variants for month change
    const variants = {
        initial: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? 15 : (direction < 0 ? -15 : 0), // Slide direction
        }),
        animate: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
        },
        exit: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? -15 : (direction < 0 ? 15 : 0), // Slide opposite direction
            transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] }
        }),
    };


    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Helps with dynamic content in droppables
        >
            <div className="h-full flex flex-col bg-canvas overflow-hidden"> {/* Ensure overflow hidden */}
                {/* Header */}
                <div className="px-4 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0">
                    {/* Optional glass effect on header */}
                    {/* <div className="px-4 py-2 border-b border-black/5 flex justify-between items-center flex-shrink-0 bg-glass-alt backdrop-blur-sm"> */}
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={goToToday}
                            variant="outline"
                            size="sm"
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)}
                        >
                            Today
                        </Button>
                        <div className="flex items-center">
                            <Button onClick={previousMonth} variant="ghost" size="icon" aria-label="Previous month" className="w-7 h-7 text-muted-foreground">
                                <Icon name="chevron-left" size={18} />
                            </Button>
                            {/* Animated Month/Year Display */}
                            <AnimatePresence mode="wait" initial={false} custom={monthDirection}>
                                <motion.span
                                    key={format(currentMonthDate, 'yyyy-MM')} // Key changes on month change
                                    className="mx-2 text-sm font-medium w-28 text-center tabular-nums text-gray-700"
                                    custom={monthDirection}
                                    variants={variants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                >
                                    {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                                </motion.span>
                            </AnimatePresence>
                            <Button onClick={nextMonth} variant="ghost" size="icon" aria-label="Next month" className="w-7 h-7 text-muted-foreground">
                                <Icon name="chevron-right" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-hidden p-3"> {/* Add padding around the grid */}
                    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden shadow-subtle border border-border-color/60 bg-white">
                        {/* Weekday Headers - Improved Styling */}
                        <div className="grid grid-cols-7 flex-shrink-0 border-b border-border-color/60">
                            {weekDays.map((day) => (
                                <div key={day} className="text-center py-1.5 text-[11px] font-medium text-muted-foreground bg-canvas-alt border-l border-border-color/60 first:border-l-0">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days Grid - takes remaining space */}
                        <div className="grid grid-cols-7 grid-rows-6 flex-1"> {/* Fixed 6 rows */}
                            {/* AnimatePresence for month transition */}
                            {/* Note: Animating the entire grid might be heavy. Animating the month text is often enough. */}
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for visual feedback - Improved Styling */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <div className="text-xs w-auto text-left px-2 py-1 rounded-md truncate shadow-strong bg-white ring-1 ring-primary/50 font-medium" title={draggingTask.title}>
                        <Icon name="grip-vertical" size={12} className="inline-block mr-1 text-muted opacity-50" />
                        {draggingTask.title}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;