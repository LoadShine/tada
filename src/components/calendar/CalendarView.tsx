// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import { Button } from '@/components/ui/button';
import { Task } from '@/types';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, startOfDay, isBefore,
    safeParseDate, isToday as isTodayFn, isValid, addYears, subYears, enUS
} from '@/lib/utils/dateUtils';
import { cn } from '@/lib/utils';
import {
    DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable,
    DragOverlay, pointerWithin, MeasuringStrategy, UniqueIdentifier
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Icon from "@/components/common/Icon";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar'; // shadcn Calendar
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Draggable Task Item for Calendar ---
interface DraggableTaskProps { task: Task; onClick: () => void; isOverlay?: boolean; }
const DraggableCalendarTask: React.FC<DraggableTaskProps> = React.memo(({ task, onClick, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `caltask-${task.id}`, data: { task, type: 'calendar-task' }, disabled: task.completed,
    });

    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);

    const style: React.CSSProperties = useMemo(() => {
        const base: React.CSSProperties = {
            transform: CSS.Translate.toString(transform),
            transition: isOverlay ? undefined : 'opacity 150ms ease-out, visibility 150ms ease-out',
            zIndex: isDragging ? 1000 : 1,
            cursor: isDragging ? 'grabbing' : (task.completed ? 'default' : 'grab'),
            position: 'relative', opacity: 1, visibility: 'visible',
        };
        if (isDragging && !isOverlay) {
            base.position = 'absolute'; base.opacity = 0; base.visibility = 'hidden'; base.pointerEvents = 'none';
        }
        return base;
    }, [transform, isDragging, isOverlay, task.completed]);

    const stateClasses = useMemo(() => {
        if (task.completed) return 'bg-secondary/40 border-transparent text-muted-foreground line-through italic opacity-75';
        if (overdue) return 'bg-destructive/10 border-destructive/20 text-destructive-foreground/90 hover:bg-destructive/15 hover:border-destructive/30';
        return 'bg-card/60 border-border/50 text-card-foreground hover:bg-card/80 hover:border-border/70';
    }, [task.completed, overdue]);

    const dotColor = useMemo(() => {
        if (task.completed || task.priority === null || task.priority === undefined || task.priority === 4) return null;
        if (overdue) return 'bg-destructive'; // Overdue dot takes precedence
        switch (task.priority) {
            case 1: return 'bg-red-500';
            case 2: return 'bg-orange-400';
            case 3: return 'bg-blue-500';
            default: return null;
        }
    }, [task.priority, task.completed, overdue]);

    const baseClasses = cn(
        "flex items-center w-full text-left px-1.5 py-0.5 rounded text-xs font-medium leading-snug truncate", // Smaller text
        "border backdrop-blur-sm transition-colors duration-100 ease-out",
        stateClasses,
        isOverlay && "bg-popover backdrop-blur-md shadow-lg border-border !text-popover-foreground !opacity-100 !visibility-visible !relative",
    );

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick} className={baseClasses} title={task.title} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
             aria-grabbed={isDragging} aria-disabled={task.completed}>
            {dotColor && ( <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1.5", dotColor)}></div> )}
            <span className={cn("flex-1 truncate", !dotColor && "pl-1")}>{task.title || <span className="italic">Untitled</span>}</span>
        </div>
    );
});
DraggableCalendarTask.displayName = 'DraggableCalendarTask';

// --- Droppable Day Cell ---
interface DroppableDayCellProps { day: Date; children: React.ReactNode; className?: string }
const DroppableDayCell: React.FC<DroppableDayCellProps> = React.memo(({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`, data: { date: day, type: 'calendar-day' },
    });
    const cellClasses = cn(
        'h-full w-full transition-colors duration-150 ease-out flex flex-col relative',
        className, isOver && 'bg-primary/10' // Highlight drop target
    );
    return <div ref={setNodeRef} className={cellClasses}>{children}</div>;
});
DroppableDayCell.displayName = 'DroppableDayCell';

// --- Main Calendar View Component ---
const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const [isMonthYearPickerOpen, setIsMonthYearPickerOpen] = useState(false);

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

    const handleTaskClick = useCallback((taskId: string) => setSelectedTaskId(taskId), [setSelectedTaskId]);
    const changeMonth = useCallback((direction: -1 | 1) => {
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
        setExpandedDays(new Set());
    }, []);
    const goToToday = useCallback(() => { setCurrentMonthDate(startOfDay(new Date())); setExpandedDays(new Set()); }, []);

    // Handle month/year selection from Calendar component
    const handleMonthYearChange = useCallback((date: Date | undefined) => {
        if (date) {
            setCurrentMonthDate(startOfDay(date));
            setIsMonthYearPickerOpen(false); // Close picker on selection
            setExpandedDays(new Set());
        }
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id); // Select on drag start
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
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
                        prevTasks.map(task => task.id === taskId ? { ...task, dueDate: newDueDateStart.getTime(), updatedAt: Date.now() } : task)
                    );
                }
            }
        }
        // Optional: Deselect after drop?
        // setSelectedTaskId(null);
    }, [setTasks]);

    const toggleExpandDay = useCallback((dateKey: string) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dateKey)) newSet.delete(dateKey); else newSet.add(dateKey);
            return newSet;
        });
    }, []);

    const MAX_VISIBLE_TASKS = 4; // Adjusted for potentially smaller text

    const renderCalendarDay = useCallback((day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const isExpanded = expandedDays.has(dateKey);
        const tasksToShow = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_TASKS);
        const hasMoreTasks = dayTasks.length > MAX_VISIBLE_TASKS;

        return (
            <DroppableDayCell key={dateKey} day={day}
                              className={cn(
                                  'border-t border-l',
                                  isCurrentMonthDay ? 'border-border/40 bg-background/30' : 'border-border/20 bg-secondary/20 opacity-70',
                                  index % 7 === 0 && 'border-l-0', // Remove left border for first column
                                  index < 7 && 'border-t-0', // Remove top border for first row
                                  'overflow-hidden'
                              )}>
                {/* Day Number Header */}
                <div className="flex justify-end items-center px-1.5 pt-1 h-6 flex-shrink-0">
                    <span className={cn(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                        isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground',
                        !isCurrentMonthDay && !isToday && 'text-muted-foreground/60',
                    )}>
                        {format(day, 'd')}
                    </span>
                </div>
                {/* Task Area */}
                <ScrollArea className="flex-1 styled-scrollbar-thin" type="auto">
                    <div className="space-y-0.5 px-1 pb-1 min-h-[50px]"> {/* Ensure min height */}
                        {isCurrentMonthDay && tasksToShow.map((task) => (
                            <DraggableCalendarTask key={task.id} task={task} onClick={() => handleTaskClick(task.id)} />
                        ))}
                        {isCurrentMonthDay && hasMoreTasks && (
                            <Button variant="link" size="sm"
                                    onClick={() => toggleExpandDay(dateKey)}
                                    className="w-full text-xs !h-5 justify-center text-primary/80 hover:text-primary"
                                    aria-expanded={isExpanded}>
                                {isExpanded ? 'Show Less' : `+ ${dayTasks.length - MAX_VISIBLE_TASKS} more`}
                            </Button>
                        )}
                    </div>
                </ScrollArea>
            </DroppableDayCell>
        );
    }, [tasksByDueDate, currentMonthDate, handleTaskClick, expandedDays, toggleExpandDay, MAX_VISIBLE_TASKS]);

    const weekDays = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []); // Full names
    const isTodayButtonDisabled = useMemo(() => isSameDay(currentMonthDate, new Date()), [currentMonthDate]);

    // Define date range for month/year picker
    const fromDate = useMemo(() => subYears(currentMonthDate, 5), [currentMonthDate]);
    const toDate = useMemo(() => addYears(currentMonthDate, 5), [currentMonthDate]);

    return (
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} collisionDetection={pointerWithin} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
            <div className="h-full flex flex-col bg-canvas overflow-hidden">
                {/* Header */}
                <div className="px-3 md:px-4 py-2 border-b border-border/50 flex justify-between items-center flex-shrink-0 bg-glass-alt-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                    <div className="w-24">
                        <h1 className="text-lg font-semibold text-foreground truncate flex items-center">
                            <Icon name="calendar-days" className="mr-2 text-primary opacity-80" size={18}/>
                            Calendar
                        </h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button onClick={goToToday} variant="outline" size="sm" className="!h-8 px-2.5" disabled={isTodayButtonDisabled}>Today</Button>
                        {/* Month/Year Picker Popover */}
                        <Popover open={isMonthYearPickerOpen} onOpenChange={setIsMonthYearPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="!h-8 px-3 text-sm font-medium w-36 justify-between tabular-nums">
                                    {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                                    <Icon name="chevron-down" size={14} className="ml-1.5 opacity-60"/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    month={currentMonthDate}
                                    onSelect={handleMonthYearChange} // Use onSelect for single day picker interaction
                                    captionLayout="dropdown" // Use dropdown layout
                                    fromDate={fromDate} // Set range using fromDate/toDate
                                    toDate={toDate}
                                    className="border-none shadow-none"
                                    // Optional: initialFocus to focus the current month
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <div className="flex items-center">
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left" aria-label="Previous month" className="w-8 h-8 text-muted-foreground hover:bg-accent" />
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right" aria-label="Next month" className="w-8 h-8 text-muted-foreground hover:bg-accent" />
                        </div>
                    </div>
                    <div className="w-24"></div> {/* Spacer */}
                </div>

                {/* Calendar Body */}
                <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-3">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 flex-shrink-0 mb-1 px-0.5">
                        {weekDays.map((day, index) => (
                            <div key={`${day}-${index}`} className="text-center py-1 text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
                                {day}
                            </div>
                        ))}
                    </div>
                    {/* Day Grid Container */}
                    <div className="flex-1 min-h-0">
                        {/* Removed gradient background for cleaner look */}
                        <div className={cn(
                            "grid grid-cols-7 h-full w-full gap-0",
                            numberOfRows === 5 ? "grid-rows-5" : "grid-rows-6",
                            "rounded-lg overflow-hidden shadow-md border border-border/30",
                            "bg-background/10" // Subtle background
                        )}>
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (<DraggableCalendarTask task={draggingTask} onClick={() => {}} isOverlay={true}/>) : null}
            </DragOverlay>
        </DndContext>
    );
};
CalendarView.displayName = 'CalendarView';
export default CalendarView;