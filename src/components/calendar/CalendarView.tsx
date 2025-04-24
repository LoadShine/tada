// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Button from '../common/Button';
import Dropdown, { DropdownRenderProps } from '../common/Dropdown'; // Import Dropdown
import { Task } from '@/types';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, // Import year functions
    isSameMonth, isSameDay, // Import date part functions
    startOfDay, isBefore, enUS, safeParseDate, isToday as isTodayFn, isValid
} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import {
    DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable,
    DragOverlay, pointerWithin, MeasuringStrategy, UniqueIdentifier
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Icon from "@/components/common/Icon";
import {getMonth, getYear, setMonth, setYear} from "date-fns";

// --- Draggable Task Item (Refined Glassmorphism) ---
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
    isOverlay?: boolean;
}
const DraggableCalendarTask: React.FC<DraggableTaskProps> = React.memo(({ task, onClick, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `caltask-${task.id}`,
        data: { task, type: 'calendar-task' },
        disabled: task.completed,
    });

    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);

    // Style: No transform transition, subtle background/opacity transitions
    const style = useMemo(() => ({
        transform: CSS.Translate.toString(transform),
        transition: isOverlay ? undefined : 'background-color 150ms ease-out, border-color 150ms ease-out, opacity 150ms ease-out',
        opacity: isDragging && !isOverlay ? 0.4 : 1,
        zIndex: isDragging ? 1000 : 1,
        cursor: isDragging ? 'grabbing' : (task.completed ? 'default' : 'grab'),
    }), [transform, isDragging, isOverlay, task.completed]);

    // Determine background, border, and text color based on state
    const stateClasses = useMemo(() => {
        if (task.completed) {
            return 'bg-glass-alt/30 border-transparent text-gray-400 line-through italic opacity-70';
        }
        if (overdue) {
            return 'bg-red-500/10 border-red-500/20 text-red-700 hover:bg-red-500/15 hover:border-red-500/30';
        }
        // Subtle glass background for normal tasks
        return 'bg-white/40 border-black/5 text-gray-800 hover:bg-white/60 hover:border-black/10';
    }, [task.completed, overdue]);

    // Priority Dot Color
    const dotColor = useMemo(() => {
        // Don't show dot if completed or no priority/P4
        if (task.completed || (!task.priority && task.priority !== 0) || task.priority === 4) return null;
        if (overdue) return 'bg-red-500'; // Overdue takes precedence visually
        switch (task.priority) {
            case 1: return 'bg-red-500';
            case 2: return 'bg-orange-400';
            case 3: return 'bg-blue-500';
            default: return null;
        }
    }, [task.priority, task.completed, overdue]);


    const baseClasses = useMemo(() => twMerge(
        "flex items-center w-full text-left px-1.5 py-[2px] rounded-[4px] space-x-1.5 group",
        "border backdrop-blur-sm transition-colors duration-150 ease-out", // Base structure + blur
        stateClasses, // Apply state-specific styles
        'text-[11px] font-medium leading-snug truncate', // Typography
        // Overlay: More pronounced glass effect
        isOverlay && "bg-glass-100 backdrop-blur-md shadow-lg border-black/10 !text-gray-800 !opacity-100",
        // Placeholder: Dashed border, faded
        isDragging && !isOverlay && "border-dashed !bg-transparent backdrop-blur-none border-gray-300/70 !text-transparent"
    ), [stateClasses, isOverlay, isDragging]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={baseClasses}
            title={task.title}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        >
            {/* Status Dot - Only show if color is determined */}
            {dotColor && (
                <div className={twMerge("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor)}></div>
            )}
            {/* Task Title */}
            <span className={twMerge("flex-1 truncate", !dotColor && "ml-[9px]")}> {/* Add margin if no dot */}
                {task.title || <span className="italic">Untitled</span>}
            </span>
        </div>
    );
});
DraggableCalendarTask.displayName = 'DraggableCalendarTask';


// --- Year/Month Selector Component ---
interface MonthYearSelectorProps extends DropdownRenderProps { // Inherit close prop
    currentDate: Date;
    onChange: (newDate: Date) => void;
}

const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({ currentDate, onChange, close }) => {
    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate); // 0-indexed

    const [displayYear, setDisplayYear] = useState(currentYear);

    const months = useMemo(() => [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ], []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        let newDate = setMonth(currentDate, monthIndex);
        // If year was changed via arrows, apply that year too
        if (getYear(newDate) !== displayYear) {
            newDate = setYear(newDate, displayYear);
        }
        onChange(newDate);
        close(); // Close after month selection
    }, [currentDate, displayYear, onChange, close]);

    const changeDisplayYear = (direction: -1 | 1) => {
        setDisplayYear(y => y + direction);
    };

    useEffect(() => {
        // Reset display year if the main calendar year changes significantly
        setDisplayYear(getYear(currentDate));
    }, [currentDate]);


    return (
        <div className="p-2 w-56">
            {/* Year Selector */}
            <div className="flex items-center justify-between mb-2">
                <Button
                    variant="ghost" size="icon" icon="chevron-left"
                    onClick={() => changeDisplayYear(-1)}
                    className="w-7 h-7 text-gray-500 hover:bg-black/10"
                    aria-label="Previous year range"
                />
                <span className="text-sm font-medium text-gray-700">{displayYear}</span>
                <Button
                    variant="ghost" size="icon" icon="chevron-right"
                    onClick={() => changeDisplayYear(1)}
                    className="w-7 h-7 text-gray-500 hover:bg-black/10"
                    aria-label="Next year range"
                />
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-4 gap-1">
                {months.map((month, index) => (
                    <Button
                        key={month}
                        variant={(index === currentMonth && displayYear === currentYear) ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => handleMonthChange(index)}
                        className={twMerge(
                            "text-xs !h-7 justify-center",
                            (index === currentMonth && displayYear === currentYear)
                                ? "!bg-primary !text-primary-foreground" // Explicit styling for selected
                                : "text-gray-600 hover:bg-black/10"
                        )}
                        aria-pressed={index === currentMonth && displayYear === currentYear}
                    >
                        {month}
                    </Button>
                ))}
            </div>
        </div>
    );
};


// --- Droppable Day Cell Content (Refined Glassmorphism) ---
interface DroppableDayCellContentProps {
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}
const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = React.memo(({ children, className, isOver }) => {
    // Styling: Subtle background highlight when dragging over
    const cellClasses = useMemo(() => twMerge(
        'h-full w-full transition-colors duration-150 ease-out flex flex-col',
        'relative', // Needed for potential absolute positioned elements inside if any
        className,
        isOver && 'bg-blue-500/10' // Subtle blue tint for drop target
    ), [className, isOver]);

    return <div className={cellClasses}>{children}</div>;
});
DroppableDayCellContent.displayName = 'DroppableDayCellContent';

// --- Droppable Day Cell --- (No functional changes needed)
const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = React.memo(({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`,
        data: { date: day, type: 'calendar-day' },
    });

    return (
        <div ref={setNodeRef} className="h-full w-full"> {/* Removed relative here, added to content */}
            <DroppableDayCellContent className={className} isOver={isOver}>
                {children}
            </DroppableDayCellContent>
        </div>
    );
});
DroppableDayCell.displayName = 'DroppableDayCell';

// --- Main Calendar View Component (Styling & Grid Height Fix & Year/Month Select) ---
const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null);

    // --- Memoized Calculations (Existing logic is sound) ---
    const draggingTask = useMemo(() => { /* ... */
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', '');
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);

    const firstDayCurrentMonth = useMemo(() => startOfMonth(currentMonthDate), [currentMonthDate]);
    const lastDayCurrentMonth = useMemo(() => endOfMonth(currentMonthDate), [currentMonthDate]);
    const startDate = useMemo(() => startOfWeek(firstDayCurrentMonth, { locale: enUS }), [firstDayCurrentMonth]);
    const endDate = useMemo(() => endOfWeek(lastDayCurrentMonth, { locale: enUS }), [lastDayCurrentMonth]);
    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
    const numberOfRows = useMemo(() => daysInGrid.length / 7, [daysInGrid]); // 5 or 6

    const tasksByDueDate = useMemo(() => { /* ... existing grouping/sorting ... */
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
            dayTasks.sort((a, b) => {
                const priorityA = a.completed ? 99 : (a.priority ?? 5);
                const priorityB = b.completed ? 99 : (b.priority ?? 5);
                if (priorityA !== priorityB) return priorityA - priorityB;
                return (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
            });
        });
        return grouped;
    }, [tasks]);

    // --- Callbacks (Existing logic + new date change handler) ---
    const handleTaskClick = useCallback((taskId: string) => { /* ... */
        setSelectedTaskId(taskId);
    }, [setSelectedTaskId]);

    const changeMonth = useCallback((direction: -1 | 1) => { /* ... */
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
    }, []);

    const goToToday = useCallback(() => { /* ... */
        setCurrentMonthDate(startOfDay(new Date()));
    }, []);

    const handleDateChange = useCallback((newDate: Date) => {
        setCurrentMonthDate(startOfDay(newDate)); // Ensure we work with the start of the day
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => { /* ... */
        const { active } = event;
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id);
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => { /* ... existing drag end ... */
        setDraggingTaskId(null);
        const { active, over } = event;
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;
            if (taskId && targetDay && originalTask && !originalTask.completed) {
                const originalDateTime = safeParseDate(originalTask.dueDate);
                const currentDueDateStart = originalDateTime ? startOfDay(originalDateTime) : null;
                const newDueDateStart = startOfDay(targetDay);
                if (!currentDueDateStart || !isSameDay(currentDueDateStart, newDueDateStart)) {
                    setTasks(prevTasks =>
                        prevTasks.map(task => {
                            if (task.id === taskId) {
                                return { ...task, dueDate: newDueDateStart.getTime(), updatedAt: Date.now() };
                            }
                            return task;
                        })
                    );
                }
            }
        }
    }, [setTasks]);

    // --- Render ---
    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []); // Use single letter

    // Day Cell Rendering - Refined Glassmorphism
    const renderCalendarDay = useCallback((day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);

        const MAX_VISIBLE_TASKS = 3;

        return (
            <DroppableDayCell
                key={day.toISOString()}
                day={day}
                // Styling: Subtle border, background based on month
                className={twMerge(
                    'border-t border-l', // Base borders
                    isCurrentMonthDay
                        ? 'border-black/10 bg-glass/30' // Lighter border/bg for current month
                        : 'border-black/5 bg-glass-alt/20 opacity-70', // More muted for other months
                    index % 7 === 0 && 'border-l-0', // No left border for first column
                    index < 7 && 'border-t-0', // No top border for first row
                    'overflow-hidden' // Prevent content overflow issues
                )}
            >
                {/* Day Number Header - Refined */}
                <div className="flex justify-end items-center px-1.5 pt-1 h-6 flex-shrink-0">
                    <span className={clsx(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                        isToday ? 'bg-primary text-white shadow-sm' : 'text-gray-600',
                        !isCurrentMonthDay && !isToday && 'text-gray-400/80',
                    )}>
                        {format(day, 'd')}
                    </span>
                </div>

                {/* Task Area - Refined */}
                <div className="flex-1 space-y-0.5 px-1 pb-1 overflow-y-auto styled-scrollbar-thin min-h-[60px]">
                    {isCurrentMonthDay && dayTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                        <DraggableCalendarTask
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task.id)}
                        />
                    ))}
                    {isCurrentMonthDay && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <div className="text-[10px] text-gray-500 pt-0.5 text-center">
                            + {dayTasks.length - MAX_VISIBLE_TASKS} more
                        </div>
                    )}
                    {/* Optional: Add a subtle indicator for empty days? */}
                    {/* {isCurrentMonthDay && dayTasks.length === 0 && (
                       <div className="h-full w-full flex items-center justify-center text-gray-300 text-3xl">-</div>
                    )} */}
                </div>
            </DroppableDayCell>
        );
    }, [tasksByDueDate, currentMonthDate, handleTaskClick]); // Ensure dependencies are correct

    const isTodayButtonDisabled = useMemo(() => isSameMonth(currentMonthDate, new Date()) && isSameDay(currentMonthDate, new Date()), [currentMonthDate]);

    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            {/* Styling: Main background with subtle texture/gradient if desired, or keep light glass */}
            <div className="h-full flex flex-col bg-glass-alt-100 overflow-hidden">
                {/* Header - Refined with Year/Month Selector */}
                <div className="px-3 md:px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                    {/* Left side: Title or empty space */}
                    <div className="w-20"> {/* Placeholder to balance layout */}
                        <h1 className="text-base font-semibold text-gray-800 truncate">Calendar</h1>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex items-center space-x-2">
                        {/* Today Button */}
                        <Button
                            onClick={goToToday}
                            variant="glass"
                            size="sm"
                            className="!h-8 px-2.5 backdrop-blur-md"
                            disabled={isTodayButtonDisabled}
                        >
                            Today
                        </Button>
                        {/* Prev/Next Month */}
                        <div className="flex items-center">
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left" aria-label="Previous month" className="w-8 h-8 text-gray-500 hover:bg-black/15 rounded-md" />
                            {/* Year/Month Dropdown Trigger */}
                            <Dropdown
                                placement="bottom"
                                contentClassName="!p-0 !shadow-xl" // Override default padding/shadow for custom content
                                trigger={
                                    <Button variant="ghost" size="sm" className="!h-8 px-2 text-sm font-medium text-center tabular-nums text-gray-700 hover:bg-black/15">
                                        {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                                        <Icon name="chevron-down" size={14} className="ml-1 opacity-60"/>
                                    </Button>
                                }
                            >
                                {(props: DropdownRenderProps) => (
                                    <MonthYearSelector
                                        {...props} // Pass close function
                                        currentDate={currentMonthDate}
                                        onChange={handleDateChange}
                                    />
                                )}
                            </Dropdown>
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right" aria-label="Next month" className="w-8 h-8 text-gray-500 hover:bg-black/15 rounded-md" />
                        </div>
                    </div>

                    {/* Right Side: Empty space or other controls */}
                    <div className="w-20"></div> {/* Placeholder */}
                </div>

                {/* Calendar Body */}
                <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-3">
                    {/* Weekday Headers - Refined */}
                    <div className="grid grid-cols-7 flex-shrink-0 mb-1 px-0.5">
                        {weekDays.map((day) => (
                            <div key={day} className="text-center py-1 text-[11px] font-semibold text-gray-500/80 tracking-wide">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Day Grid Container */}
                    <div className="flex-1 min-h-0">
                        {/* Grid structure with dynamic rows */}
                        <div className={twMerge(
                            "grid grid-cols-7 h-full w-full",
                            // Use gap-0 and rely on cell borders/padding
                            "gap-0",
                            // Apply dynamic rows class
                            numberOfRows === 5 ? "grid-rows-5" : "grid-rows-6",
                            "rounded-lg overflow-hidden shadow-lg border border-black/10", // Container style
                            "bg-gradient-to-br from-white/10 via-white/5 to-white/0" // Subtle gradient bg
                        )}>
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <DraggableCalendarTask
                        task={draggingTask}
                        onClick={() => {}}
                        isOverlay={true}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
CalendarView.displayName = 'CalendarView';
export default CalendarView;