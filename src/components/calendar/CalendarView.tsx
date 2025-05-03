// src/components/calendar/CalendarView.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useAtom, useSetAtom} from 'jotai';
import {selectedTaskIdAtom, tasksAtom} from '@/store/atoms';
import Button from '../common/Button';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {Task} from '@/types';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    enUS,
    format,
    getMonth,
    getYear,
    isBefore,
    isSameDay,
    isSameMonth,
    isToday as isTodayFn,
    isValid,
    safeParseDate,
    setMonth,
    setYear,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths
} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MeasuringStrategy,
    pointerWithin,
    UniqueIdentifier,
    useDraggable,
    useDroppable
} from '@dnd-kit/core';
import {CSS} from '@dnd-kit/utilities';
import Icon from "@/components/common/Icon";

// --- Draggable Task Item ---
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
    isOverlay?: boolean;
}

const DraggableCalendarTask: React.FC<DraggableTaskProps> = React.memo(({task, onClick, isOverlay = false}) => {
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
        id: `caltask-${task.id}`,
        data: {task, type: 'calendar-task'},
        disabled: task.completed,
    });
    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
    const style: React.CSSProperties = useMemo(() => {
        const base: React.CSSProperties = {
            transform: CSS.Translate.toString(transform),
            transition: isOverlay ? undefined : 'opacity 150ms ease-out, visibility 150ms ease-out',
            zIndex: isDragging ? 1000 : 1,
            cursor: isDragging ? 'grabbing' : (task.completed ? 'default' : 'grab'),
            position: 'relative',
            opacity: 1,
            visibility: 'visible',
        };
        if (isDragging && !isOverlay) {
            base.position = 'absolute';
            base.opacity = 0;
            base.visibility = 'hidden';
            base.pointerEvents = 'none';
        }
        return base;
    }, [transform, isDragging, isOverlay, task.completed]);
    const stateClasses = useMemo(() => {
        if (task.completed) {
            return 'bg-glass-alt/40 border-transparent text-gray-500 line-through italic opacity-75';
        }
        if (overdue) {
            return 'bg-red-500/15 border-red-500/30 text-red-700 hover:bg-red-500/20 hover:border-red-500/40';
        }
        return 'bg-white/50 border-black/10 text-gray-800 hover:bg-white/70 hover:border-black/15';
    }, [task.completed, overdue]);
    const dotColor = useMemo(() => {
        if (task.completed || (!task.priority && task.priority !== 0) || task.priority === 4) return null;
        if (overdue) return 'bg-red-500';
        switch (task.priority) {
            case 1:
                return 'bg-red-500';
            case 2:
                return 'bg-orange-400';
            case 3:
                return 'bg-blue-500';
            default:
                return null;
        }
    }, [task.priority, task.completed, overdue]);
    const baseClasses = useMemo(() => twMerge("flex items-center w-full text-left px-2 py-1 rounded-md space-x-2 group", "border-[1.5px] backdrop-blur-sm transition-colors duration-150 ease-out", stateClasses, 'text-[12.5px] font-medium leading-snug truncate', isOverlay && "bg-glass-100 backdrop-blur-md shadow-lg border-black/20 !text-gray-800 !opacity-100 !visibility-visible !relative",), [stateClasses, isOverlay]);
    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick} className={baseClasses}
             title={task.title} role="button" tabIndex={0} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        }} aria-grabbed={isDragging} aria-disabled={task.completed}>
            {dotColor && (<div className={twMerge("w-2 h-2 rounded-full flex-shrink-0", dotColor)}></div>)}
            <span className={twMerge("flex-1 truncate", !dotColor && "ml-[10px]")}> {task.title ||
                <span className="italic">Untitled</span>} </span>
        </div>
    );
});
DraggableCalendarTask.displayName = 'DraggableCalendarTask';


// --- Year/Month Selector Component ---
interface MonthYearSelectorProps {
    currentDate: Date;
    onChange: (newDate: Date) => void;
}

const MonthYearSelectorContent: React.FC<MonthYearSelectorProps> = React.memo(({currentDate, onChange}) => {
    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate);
    const [displayYear, setDisplayYear] = useState(currentYear);
    const months = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);

    const handleMonthChange = useCallback((monthIndex: number) => {
        let newDate = setMonth(currentDate, monthIndex);
        if (getYear(newDate) !== displayYear) {
            newDate = setYear(newDate, displayYear);
        }
        onChange(newDate);
    }, [currentDate, displayYear, onChange]);

    const changeDisplayYear = (direction: -1 | 1) => setDisplayYear(y => y + direction);

    useEffect(() => {
        setDisplayYear(getYear(currentDate));
    }, [currentDate]);

    return (
        <div className="p-2 w-56">
            {/* Year Selector */}
            <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="icon" icon="chevron-left" onClick={() => changeDisplayYear(-1)}
                        className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Previous year"/>
                <span className="text-sm font-medium text-gray-700">{displayYear}</span>
                <Button variant="ghost" size="icon" icon="chevron-right" onClick={() => changeDisplayYear(1)}
                        className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Next year"/>
            </div>
            {/* Month Grid */}
            <div className="grid grid-cols-4 gap-1">
                {months.map((month, index) => (
                    <DropdownMenu.Item
                        key={month}
                        onSelect={() => handleMonthChange(index)}
                        className={twMerge(
                            "text-xs !h-7 justify-center flex items-center cursor-pointer select-none rounded outline-none transition-colors data-[disabled]:pointer-events-none",
                            "focus:bg-black/10 data-[highlighted]:bg-black/10", // Hover/Focus style
                            (index === currentMonth && displayYear === currentYear)
                                ? 'bg-primary text-primary-foreground data-[highlighted]:bg-primary-dark' // Selected style
                                : 'text-gray-600 data-[highlighted]:text-gray-800', // Default style
                            "data-[disabled]:opacity-50"
                        )}
                        aria-pressed={index === currentMonth && displayYear === currentYear}
                    >
                        {month}
                    </DropdownMenu.Item>
                ))}
            </div>
        </div>
    );
});
MonthYearSelectorContent.displayName = 'MonthYearSelectorContent';


// --- Droppable Day Cell Content ---
interface DroppableDayCellContentProps {
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}

const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = React.memo(({children, className, isOver}) => {
    const cellClasses = useMemo(() => twMerge('h-full w-full transition-colors duration-150 ease-out flex flex-col', 'relative', className, isOver && 'bg-blue-500/10'), [className, isOver]);
    return <div className={cellClasses}>{children}</div>;
});
DroppableDayCellContent.displayName = 'DroppableDayCellContent';

// --- Droppable Day Cell ---
const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = React.memo(({
                                                                                                                 day,
                                                                                                                 children,
                                                                                                                 className
                                                                                                             }) => {
    const {isOver, setNodeRef} = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`,
        data: {date: day, type: 'calendar-day'},
    });
    return (<div ref={setNodeRef} className="h-full w-full"><DroppableDayCellContent className={className}
                                                                                     isOver={isOver}> {children} </DroppableDayCellContent>
    </div>);
});
DroppableDayCell.displayName = 'DroppableDayCell';

// --- Main Calendar View Component ---
const CalendarView: React.FC = () => {
    // State and atoms
    const [tasks, setTasks] = useAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    // Memoized values
    const draggingTask = useMemo(() => { 
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', '');
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);
    const firstDayCurrentMonth = useMemo(() => startOfMonth(currentMonthDate), [currentMonthDate]);
    const lastDayCurrentMonth = useMemo(() => endOfMonth(currentMonthDate), [currentMonthDate]);
    const startDate = useMemo(() => startOfWeek(firstDayCurrentMonth, {locale: enUS}), [firstDayCurrentMonth]);
    const endDate = useMemo(() => endOfWeek(lastDayCurrentMonth, {locale: enUS}), [lastDayCurrentMonth]);
    const daysInGrid = useMemo(() => eachDayOfInterval({start: startDate, end: endDate}), [startDate, endDate]);
    const numberOfRows = useMemo(() => daysInGrid.length / 7, [daysInGrid]);
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
            dayTasks.sort((a, b) => {
                const priorityA = a.completed ? 99 : (a.priority ?? 5);
                const priorityB = b.completed ? 99 : (b.priority ?? 5);
                if (priorityA !== priorityB) return priorityA - priorityB;
                const orderA = a.order ?? a.createdAt ?? 0;
                const orderB = b.order ?? b.createdAt ?? 0;
                return orderA - orderB;
            });
        });
        return grouped;
    }, [tasks]);

    // Callbacks
    const handleTaskClick = useCallback((taskId: string) => setSelectedTaskId(taskId), [setSelectedTaskId]);
    const changeMonth = useCallback((direction: -1 | 1) => {
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
        setExpandedDays(new Set());
    }, []);
    const goToToday = useCallback(() => {
        setCurrentMonthDate(startOfDay(new Date()));
        setExpandedDays(new Set());
    }, []);
    const handleDateChange = useCallback((newDate: Date) => {
        setCurrentMonthDate(startOfDay(newDate));
        setExpandedDays(new Set());
    }, []);

    // Drag Handlers
    const handleDragStart = useCallback((event: DragStartEvent) => { 
        const {active} = event;
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id);
        }
    }, [setSelectedTaskId]);
    const handleDragEnd = useCallback((event: DragEndEvent) => { 
        setDraggingTaskId(null);
        const {active, over} = event;
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;
            if (taskId && targetDay && originalTask && !originalTask.completed) {
                const originalDateTime = safeParseDate(originalTask.dueDate);
                const currentDueDateStart = originalDateTime ? startOfDay(originalDateTime) : null;
                const newDueDateStart = startOfDay(targetDay);
                if (!currentDueDateStart || !isSameDay(currentDueDateStart, newDueDateStart)) {
                    setTasks(prevTasks => prevTasks.map(task => (task.id === taskId ? {
                        ...task,
                        dueDate: newDueDateStart.getTime()
                    } : task)));
                }
            }
        }
    }, [setTasks]);

    // Show More callback
    const toggleExpandDay = useCallback((dateKey: string) => setExpandedDays(prev => {
        const newSet = new Set(prev);
        if (newSet.has(dateKey)) newSet.delete(dateKey); else newSet.add(dateKey);
        return newSet;
    }), []);

    // Render function for calendar days
    const renderCalendarDay = useCallback((day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const isExpanded = expandedDays.has(dateKey);
        const MAX_VISIBLE_TASKS = 5;
        const tasksToShow = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_TASKS);
        const hasMoreTasks = dayTasks.length > MAX_VISIBLE_TASKS;
        return (
            <DroppableDayCell key={dateKey} day={day}
                              className={twMerge('border-t border-l', isCurrentMonthDay ? 'border-black/10 bg-glass/30' : 'border-black/5 bg-glass-alt/20 opacity-70', index % 7 === 0 && 'border-l-0', index < 7 && 'border-t-0', 'overflow-hidden')}>
                <div className="flex justify-end items-center px-1.5 pt-1 h-6 flex-shrink-0"><span
                    className={clsx('text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-white shadow-sm' : 'text-gray-600', !isCurrentMonthDay && !isToday && 'text-gray-400/80',)}>{format(day, 'd')}</span>
                </div>
                <div className="flex-1 space-y-0.5 px-1 pb-1 overflow-y-auto styled-scrollbar-thin min-h-[60px]">
                    {isCurrentMonthDay && tasksToShow.map((task) => (
                        <DraggableCalendarTask key={task.id} task={task} onClick={() => handleTaskClick(task.id)}/>))}
                    {isCurrentMonthDay && hasMoreTasks && (<button onClick={() => toggleExpandDay(dateKey)}
                                                                   className="w-full text-[10px] text-center text-blue-600 hover:text-blue-800 py-0.5 px-1 rounded bg-blue-500/5 hover:bg-blue-500/10 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                                                   aria-expanded={isExpanded}>{isExpanded ? 'Show Less' : `+ ${dayTasks.length - MAX_VISIBLE_TASKS} more`}</button>)}
                </div>
            </DroppableDayCell>
        );
    }, [tasksByDueDate, currentMonthDate, handleTaskClick, expandedDays, toggleExpandDay]);

    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);
    const isTodayButtonDisabled = useMemo(() => isSameDay(currentMonthDate, new Date()), [currentMonthDate]);

    return (
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} collisionDetection={pointerWithin}
                    measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
            <div className="h-full flex flex-col bg-glass-alt-100 overflow-hidden">
                {/* Header */}
                <div
                    className="px-3 md:px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                    <div className="w-20"><h1 className="text-base font-semibold text-gray-800 truncate">Calendar</h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button onClick={goToToday} variant="glass" size="sm" className="!h-8 px-2.5 backdrop-blur-md"
                                disabled={isTodayButtonDisabled}> Today </Button>
                        <div className="flex items-center">
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left"
                                    aria-label="Previous month"
                                    className="w-8 h-8 text-gray-500 hover:bg-black/15 rounded-md"/>
                            {/* Radix Dropdown for Month/Year */}
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="ghost" size="sm"
                                            className="!h-8 px-2 text-sm font-medium w-32 text-center tabular-nums text-gray-700 hover:bg-black/15">
                                        {format(currentMonthDate, 'MMMM yyyy', {locale: enUS})}
                                        <Icon name="chevron-down" size={14} className="ml-1.5 opacity-60"/>
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={twMerge(
                                            "z-[55] bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 p-0",
                                            "data-[state=open]:animate-slideUpAndFade",
                                            "data-[state=closed]:animate-slideDownAndFade"
                                        )}
                                        sideOffset={5}
                                        align="center">
                                        {/* Render the content component */}
                                        <MonthYearSelectorContent
                                            currentDate={currentMonthDate}
                                            onChange={handleDateChange}
                                        />
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right"
                                    aria-label="Next month"
                                    className="w-8 h-8 text-gray-500 hover:bg-black/15 rounded-md"/>
                        </div>
                    </div>
                    <div className="w-20"></div>
                </div>

                {/* Calendar Body */}
                <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-3">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 flex-shrink-0 mb-1 px-0.5"> {weekDays.map((day, index) => (
                        <div key={`${day}-${index}`}
                             className="text-center py-1 text-[11px] font-semibold text-gray-500/80 tracking-wide"> {day} </div>))} </div>
                    {/* Day Grid Container */}
                    <div className="flex-1 min-h-0">
                        <div
                            className={twMerge("grid grid-cols-7 h-full w-full", "gap-0", numberOfRows === 5 ? "grid-rows-5" : "grid-rows-6", "rounded-lg overflow-hidden shadow-lg border border-black/10", "bg-gradient-to-br from-white/10 via-white/5 to-white/0")}>
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>
            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}> {draggingTask ? (
                <DraggableCalendarTask task={draggingTask} onClick={() => {
                }} isOverlay={true}/>) : null} </DragOverlay>
        </DndContext>
    );
};
CalendarView.displayName = 'CalendarView';
export default CalendarView;