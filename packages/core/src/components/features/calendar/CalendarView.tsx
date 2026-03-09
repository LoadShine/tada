import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Task } from '@/types';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
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
    subMonths,
    getLocale, addDays, differenceInCalendarDays
} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    MeasuringStrategy,
    pointerWithin,
    UniqueIdentifier,
    useDraggable,
    useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from "react-i18next";
import { Locale } from "date-fns";
import Button from "@/components/ui/Button.tsx";
import { preferencesSettingsAtom, selectedTaskIdAtom, tasksAtom, tasksLoadingAtom } from "@/store/jotai.ts";
import Icon from "@/components/ui/Icon.tsx";
import { useTaskOperations } from '@/hooks/useTaskOperations';

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
            base.opacity = 0;
            base.visibility = 'hidden';
            base.pointerEvents = 'none';
        }
        return base;
    }, [transform, isDragging, isOverlay, task.completed]);

    const taskBlockClasses = useMemo(() => {
        let bgColor = 'bg-primary-light/30 dark:bg-primary-dark/20 backdrop-blur-sm';
        if (task.completed) bgColor = 'bg-grey-light/50 dark:bg-neutral-700/50 backdrop-blur-sm';
        if (overdue) bgColor = 'bg-error/30 dark:bg-error/20 backdrop-blur-sm';

        return twMerge(
            "flex items-center w-full text-left px-1.5 py-0.5 rounded-base space-x-1.5 group h-[22px]",
            "transition-colors duration-150 ease-out",
            bgColor,
            task.completed
                ? "text-grey-medium dark:text-neutral-500 line-through italic opacity-75"
                : "text-grey-dark dark:text-neutral-200 hover:opacity-80 dark:hover:opacity-90",
            'text-[11px] font-light leading-snug truncate',
            isOverlay && "bg-white/90 dark:bg-neutral-750/90 shadow-subtle !text-grey-dark dark:!text-neutral-100 !opacity-100 !visibility-visible !relative",
        );
    }, [task.completed, overdue, isOverlay]);

    return (<div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick}
        className={taskBlockClasses} title={task.title} role="button" tabIndex={0} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            }
        }} aria-grabbed={isDragging} aria-disabled={task.completed}><span className="flex-1 truncate"> {task.title ||
            <span className="italic">Untitled</span>} </span></div>);
});
DraggableCalendarTask.displayName = 'DraggableCalendarTask';


interface MonthYearSelectorProps {
    currentDate: Date;
    onChange: (newDate: Date) => void;
    locale: Locale;
}

const MonthYearSelectorContent: React.FC<MonthYearSelectorProps> = React.memo(({ currentDate, onChange, locale }) => {
    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate);
    const [displayYear, setDisplayYear] = useState(currentYear);
    const months = useMemo(() => Array.from({ length: 12 }, (_, i) => format(setMonth(new Date(), i), 'MMM', { locale })), [locale]);
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
    return (<div className="p-3 w-56 bg-white dark:bg-neutral-750 rounded-base shadow-modal">
        <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" icon="chevron-left"
                onClick={() => changeDisplayYear(-1)}
                className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-600"
                iconProps={{ size: 16, strokeWidth: 1 }}
                aria-label="Previous year" />
            <span className="text-[14px] font-normal text-grey-dark dark:text-neutral-100">{displayYear}</span>
            <Button variant="ghost" size="icon" icon="chevron-right"
                onClick={() => changeDisplayYear(1)}
                className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-600"
                iconProps={{ size: 16, strokeWidth: 1 }} aria-label="Next year" />
        </div>
        <div className="grid grid-cols-3 gap-1"> {months.map((month, index) => (
            <DropdownMenu.Item key={month} onSelect={() => handleMonthChange(index)}
                className={twMerge(
                    "text-[13px] h-8 justify-center flex items-center cursor-pointer select-none rounded-base outline-none transition-colors data-[disabled]:pointer-events-none font-light",
                    "focus:bg-grey-ultra-light dark:focus:bg-neutral-600 data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-600",
                    (index === currentMonth && displayYear === currentYear)
                        ? 'bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light font-normal data-[highlighted]:bg-primary-light dark:data-[highlighted]:bg-primary-dark/40'
                        : 'text-grey-dark dark:text-neutral-100 data-[highlighted]:text-grey-dark dark:data-[highlighted]:text-neutral-50',
                    "data-[disabled]:opacity-50")}
                aria-pressed={index === currentMonth && displayYear === currentYear}> {month} </DropdownMenu.Item>))} </div>
    </div>);
});
MonthYearSelectorContent.displayName = 'MonthYearSelectorContent';

interface DroppableDayCellContentProps {
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}

const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = React.memo(({ children, className, isOver }) => {
    const cellClasses = useMemo(() => twMerge(
        'h-full w-full transition-colors duration-150 ease-out flex flex-col relative',
        className,
        isOver && 'bg-primary-light/50 dark:bg-primary-dark/30'
    ), [className, isOver]);
    return <div className={cellClasses}>{children}</div>;
});
DroppableDayCellContent.displayName = 'DroppableDayCellContent';

const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string; isCovered?: boolean }> = React.memo(({
    day,
    children,
    className,
    isCovered
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`,
        data: { date: day, type: 'calendar-day' },
    });
    return (<div ref={setNodeRef} className="h-full w-full"><DroppableDayCellContent className={className}
        isOver={isOver || !!isCovered}> {children} </DroppableDayCellContent>
    </div>);
});
DroppableDayCell.displayName = 'DroppableDayCell';


const CalendarView: React.FC = () => {
    const { t } = useTranslation();
    const preferences = useAtomValue(preferencesSettingsAtom);
    const [tasksData] = useAtom(tasksAtom);
    const tasks = useMemo(() => tasksData ?? [], [tasksData]);
    const isLoadingTasks = useAtomValue(tasksLoadingAtom);

    const { updateTask } = useTaskOperations();

    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null);
    const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
    const [initialDragDate, setInitialDragDate] = useState<Date | null>(null);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    const dateFnsLocale = useMemo(() => getLocale(preferences?.language), [preferences?.language]);

    const draggingTask = useMemo(() => {
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', '');
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);

    const firstDayCurrentMonth = useMemo(() => startOfMonth(currentMonthDate), [currentMonthDate]);
    const lastDayCurrentMonth = useMemo(() => endOfMonth(currentMonthDate), [currentMonthDate]);
    const startDate = useMemo(() => startOfWeek(firstDayCurrentMonth, { locale: dateFnsLocale }), [firstDayCurrentMonth, dateFnsLocale]);
    const endDate = useMemo(() => endOfWeek(lastDayCurrentMonth, { locale: dateFnsLocale }), [lastDayCurrentMonth, dateFnsLocale]);
    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);
    const numberOfRows = useMemo(() => daysInGrid.length / 7, [daysInGrid]);

    const { singleDayTasksByDate, multiDayTasks } = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        const multi: Task[] = [];
        tasks.forEach(task => {
            if (task.listName === 'Trash') return;
            const parsedDue = safeParseDate(task.dueDate);
            const parsedStart = safeParseDate(task.startDate);

            const hasValidStart = parsedStart && isValid(parsedStart);
            const hasValidDue = parsedDue && isValid(parsedDue);

            if (hasValidStart && hasValidDue) {
                if (!isSameDay(parsedStart, parsedDue)) {
                    multi.push(task);
                } else {
                    const dateKey = format(parsedDue, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            } else if (hasValidDue) {
                const dateKey = format(parsedDue, 'yyyy-MM-dd');
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(task);
            } else if (hasValidStart) {
                const dateKey = format(parsedStart, 'yyyy-MM-dd');
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(task);
            }
        });

        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => {
                const priorityA = a.completed ? 99 : (a.priority ?? 4);
                const priorityB = b.completed ? 99 : (b.priority ?? 4);
                if (priorityA !== priorityB) return priorityA - priorityB;
                const orderA = a.order ?? a.createdAt ?? 0;
                const orderB = b.order ?? b.createdAt ?? 0;
                return orderA - orderB;
            });
        });
        return { singleDayTasksByDate: grouped, multiDayTasks: multi };
    }, [tasks]);

    const dragCoveredDates = useMemo(() => {
        const covered = new Set<string>();
        if (draggingTask && dragOverDate && initialDragDate) {
            const originalDue = safeParseDate(draggingTask.dueDate);
            const originalStart = safeParseDate(draggingTask.startDate);
            const dragOffset = differenceInCalendarDays(startOfDay(dragOverDate), startOfDay(initialDragDate));

            if (originalStart && isValid(originalStart) && originalDue && isValid(originalDue)) {
                const newStart = addDays(startOfDay(originalStart), dragOffset);
                const newDue = addDays(startOfDay(originalDue), dragOffset);
                const durationDays = differenceInCalendarDays(newDue, newStart);
                if (durationDays !== 0) {
                    for (let i = 0; i <= Math.abs(durationDays); i++) {
                        const offset = durationDays > 0 ? i : -i;
                        covered.add(format(addDays(newStart, offset), 'yyyy-MM-dd'));
                    }
                } else {
                    covered.add(format(newStart, 'yyyy-MM-dd'));
                }
            } else if (originalDue && isValid(originalDue)) {
                const newDue = addDays(startOfDay(originalDue), dragOffset);
                covered.add(format(newDue, 'yyyy-MM-dd'));
            } else if (originalStart && isValid(originalStart)) {
                const newStart = addDays(startOfDay(originalStart), dragOffset);
                covered.add(format(newStart, 'yyyy-MM-dd'));
            } else {
                covered.add(format(dragOverDate, 'yyyy-MM-dd'));
            }
        }
        return covered;
    }, [draggingTask, dragOverDate, initialDragDate]);

    const weeks = useMemo(() => {
        const w = [];
        for (let i = 0; i < daysInGrid.length; i += 7) {
            w.push(daysInGrid.slice(i, i + 7));
        }
        return w;
    }, [daysInGrid]);

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

    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (event.active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(event.active.id);
            setSelectedTaskId(event.active.data.current.task.id);
            setInitialDragDate(null);
        }
    }, [setSelectedTaskId]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over, active } = event;
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const targetDay = over.data.current?.date as Date | undefined;
            setDragOverDate(targetDay || null);
            setInitialDragDate(prev => {
                if (!prev && targetDay) return targetDay;
                return prev;
            });
        } else {
            setDragOverDate(null);
        }
    }, []);

    const handleDragCancel = useCallback(() => {
        setDraggingTaskId(null);
        setDragOverDate(null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTaskId(null);
        setDragOverDate(null);
        setInitialDragDate(null);
        const { active, over } = event;
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            const originalTask = active.data.current?.task as Task | undefined;

            if (taskId && targetDay && originalTask && !originalTask.completed && initialDragDate) {
                const originalDue = safeParseDate(originalTask.dueDate);
                const originalStart = safeParseDate(originalTask.startDate);

                let targetDate = startOfDay(targetDay);
                let updates: Partial<Task> = {};
                const dragOffset = differenceInCalendarDays(targetDate, startOfDay(initialDragDate));

                if (dragOffset !== 0) {
                    if (originalDue && isValid(originalDue) && originalStart && isValid(originalStart) && !isSameDay(originalStart, originalDue)) {
                        const newStart = addDays(originalStart, dragOffset);
                        const newDue = addDays(originalDue, dragOffset);
                        updates = { startDate: newStart.getTime(), dueDate: newDue.getTime() };
                    } else if (originalDue && isValid(originalDue)) {
                        const newDue = addDays(originalDue, dragOffset);
                        updates.dueDate = newDue.getTime();
                        if (originalStart && isValid(originalStart)) {
                            const newStart = addDays(originalStart, dragOffset);
                            updates.startDate = newStart.getTime();
                        }
                    } else if (originalStart && isValid(originalStart)) {
                        const newStart = addDays(originalStart, dragOffset);
                        updates.startDate = newStart.getTime();
                    }
                }

                if (Object.keys(updates).length > 0) {
                    updateTask(taskId, updates);
                }
            }
        }
    }, [updateTask, initialDragDate]);

    const toggleExpandDay = useCallback((dateKey: string) => setExpandedDays(prev => {
        const newSet = new Set(prev);
        if (newSet.has(dateKey)) newSet.delete(dateKey); else newSet.add(dateKey);
        return newSet;
    }), []);

    const renderCalendarDay = useCallback((day: Date, isLastInRow: boolean, isLastRow: boolean, ganttHeight: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = singleDayTasksByDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const isExpanded = expandedDays.has(dateKey);
        const MAX_VISIBLE_TASKS = 3;
        const tasksToShow = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE_TASKS);
        const hasMoreTasks = dayTasks.length > MAX_VISIBLE_TASKS && !isExpanded;

        return (
            <DroppableDayCell key={dateKey} day={day}
                isCovered={dragCoveredDates.has(dateKey)}
                className={twMerge(
                    'border-r border-b border-grey-light/50 dark:border-neutral-700/50 flex flex-col',
                    !isCurrentMonthDay && 'bg-black/5 dark:bg-white/5 opacity-70',
                    isLastInRow && 'border-r-0',
                    isLastRow && 'border-b-0',
                    'overflow-hidden p-1 min-h-0 relative'
                )}>
                <div className="flex justify-end items-center h-5 flex-shrink-0 mb-1 z-20 relative">
                    <span
                        className={clsx(
                            'text-[12px] font-light w-5 h-5 flex items-center justify-center rounded-full transition-colors',
                            isToday ? 'bg-primary text-white dark:bg-primary-light dark:text-grey-deep' : (isCurrentMonthDay ? 'text-grey-dark dark:text-neutral-100' : 'text-grey-medium dark:text-neutral-500')
                        )}>{format(day, 'd')}</span>
                </div>
                <div
                    className="flex-1 space-y-0.5 overflow-y-auto styled-scrollbar-thin min-h-[50px] relative z-20">
                    {ganttHeight > 0 && <div style={{ height: `${ganttHeight}px` }} className="flex-shrink-0 w-full" aria-hidden="true" />}
                    {isCurrentMonthDay && tasksToShow.map((task) => (
                        <DraggableCalendarTask key={task.id} task={task} onClick={() => handleTaskClick(task.id)} />))}
                    {isCurrentMonthDay && hasMoreTasks && (
                        <Button onClick={() => toggleExpandDay(dateKey)}
                            variant="link" size="sm"
                            className="w-full text-[11px] !h-5 px-1 text-center py-0.5 text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary font-light"
                            aria-expanded={isExpanded}> + {dayTasks.length - MAX_VISIBLE_TASKS} more </Button>)}
                </div>
            </DroppableDayCell>
        );
    }, [singleDayTasksByDate, currentMonthDate, handleTaskClick, expandedDays, toggleExpandDay, dragCoveredDates]);

    const weekDays = useMemo(() => {
        const start = startOfWeek(new Date(), { locale: dateFnsLocale });
        return Array.from({ length: 7 }).map((_, i) => format(addDays(start, i), 'EEEEEE', { locale: dateFnsLocale }));
    }, [dateFnsLocale]);

    const isTodayButtonDisabled = useMemo(() => isSameDay(currentMonthDate, new Date()) && isSameMonth(currentMonthDate, new Date()), [currentMonthDate]);
    const dropdownAnimationClasses = "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide";

    if (isLoadingTasks) {
        return (
            <div
                className="h-full flex flex-col bg-transparent overflow-hidden items-center justify-center">
                <Icon name="loader" size={24} className="text-primary animate-spin" />
            </div>
        );
    }

    return (
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragCancel={handleDragCancel} collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
            <div
                className="h-full flex flex-col bg-transparent overflow-hidden">
                <div
                    className="px-6 py-0 h-[56px] border-b border-grey-light/50 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0 bg-transparent z-10"
                    data-tauri-drag-region="true"
                >
                    <div className="w-1/3"><h1
                        className="text-[18px] font-light text-grey-dark dark:text-neutral-100 truncate">{t('iconBar.calendar')}</h1>
                    </div>
                    <div className="flex-1 flex justify-center items-center space-x-1">
                        <Button onClick={goToToday} variant="link" size="sm"
                            className="!h-8 px-3 !text-primary dark:!text-primary-light !font-normal"
                            disabled={isTodayButtonDisabled}>{t('common.today')}</Button>
                        <div className="flex items-center">
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" icon="chevron-left"
                                aria-label="Previous month"
                                className="w-8 h-8 text-grey-medium dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
                                iconProps={{ size: 16, strokeWidth: 1 }} />
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="ghost" size="sm"
                                        className="!h-8 px-3 text-[14px] font-normal w-36 text-center tabular-nums text-grey-dark dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10">
                                        {format(currentMonthDate, 'MMMM yyyy', { locale: dateFnsLocale })}
                                        <Icon name="chevron-down" size={14} strokeWidth={1}
                                            className="ml-1.5 opacity-70" />
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={twMerge("z-[55] bg-white dark:bg-neutral-750 rounded-base shadow-modal p-0", dropdownAnimationClasses)}
                                        sideOffset={5} align="center">
                                        <MonthYearSelectorContent currentDate={currentMonthDate}
                                            onChange={handleDateChange} locale={dateFnsLocale} />
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" icon="chevron-right"
                                aria-label="Next month"
                                className="w-8 h-8 text-grey-medium dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
                                iconProps={{ size: 16, strokeWidth: 1 }} />
                        </div>
                    </div>
                    <div className="w-1/3"></div>
                </div>
                <div
                    className="flex-1 overflow-hidden flex flex-col p-4 bg-transparent">
                    <div className="grid grid-cols-7 flex-shrink-0 mb-1 px-0.5">
                        {weekDays.map((day, index) => (<div key={`${day}-${index}`}
                            className="text-center py-1 text-[11px] font-normal text-grey-medium dark:text-neutral-400 tracking-wide uppercase"> {day} </div>))}
                    </div>
                    <div
                        className="flex-1 min-h-0">
                        <div
                            className={twMerge(
                                "flex flex-col h-full w-full rounded-base overflow-hidden border border-grey-light/50 dark:border-neutral-700/50",
                                "bg-white/60 dark:bg-neutral-800/60"
                            )}>
                            {weeks.map((week, weekIndex) => {
                                const weekStart = week[0];
                                const weekEnd = week[6];
                                const weekMultiDayTasks = multiDayTasks.filter(t => {
                                    const s = safeParseDate(t.startDate);
                                    const e = safeParseDate(t.dueDate);
                                    if (!s || !e) return false;
                                    return startOfDay(s) <= startOfDay(weekEnd) && startOfDay(e) >= startOfDay(weekStart);
                                }).sort((a, b) => safeParseDate(a.startDate)!.getTime() - safeParseDate(b.startDate)!.getTime());

                                const lanes: Task[][] = [];
                                weekMultiDayTasks.forEach(task => {
                                    let placed = false;
                                    for (let i = 0; i < lanes.length; i++) {
                                        const lane = lanes[i];
                                        const lastTask = lane[lane.length - 1];
                                        if (startOfDay(safeParseDate(task.startDate)!) > startOfDay(safeParseDate(lastTask.dueDate)!)) {
                                            lane.push(task);
                                            placed = true;
                                            break;
                                        }
                                    }
                                    if (!placed) lanes.push([task]);
                                });

                                const ganttHeight = lanes.length > 0 ? lanes.length * 24 + 4 : 0;
                                const isLastRow = weekIndex === weeks.length - 1;

                                return (
                                    <div key={`week-${weekIndex}`} className="relative flex-1 grid grid-cols-7 min-h-0">
                                        {week.map((day, dayIndex) => renderCalendarDay(day, dayIndex === 6, isLastRow, ganttHeight))}

                                        <div className="absolute top-6 left-0 right-0 pointer-events-none flex flex-col gap-[2px] z-30 px-1" aria-hidden="true">
                                            {lanes.map((lane, laneIdx) => (
                                                <div key={`lane-${laneIdx}`} className="relative h-[22px] w-full">
                                                    {lane.map(task => {
                                                        const s = safeParseDate(task.startDate)!;
                                                        const e = safeParseDate(task.dueDate)!;
                                                        const startOffset = Math.max(0, differenceInCalendarDays(startOfDay(s), startOfDay(weekStart)));
                                                        const endOffset = Math.min(6, differenceInCalendarDays(startOfDay(e), startOfDay(weekStart)));
                                                        const width = endOffset - startOffset + 1;
                                                        return (
                                                            <div key={task.id} className="absolute h-full" style={{ left: `calc(${startOffset * 100 / 7}%)`, width: `calc(${width * 100 / 7}%)`, padding: '0 2px' }}>
                                                                <div className="pointer-events-auto h-full w-full">
                                                                    <DraggableCalendarTask task={task} onClick={() => handleTaskClick(task.id)} isOverlay={false} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <DragOverlay dropAnimation={null}> {draggingTask ? (
                <div className="rounded-base overflow-hidden shadow-lg"><DraggableCalendarTask task={draggingTask}
                    onClick={() => {
                    }} isOverlay={true} />
                </div>) : null} </DragOverlay>
        </DndContext>
    );
};
CalendarView.displayName = 'CalendarView';
export default CalendarView;