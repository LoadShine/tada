// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import { tasksAtom, selectedTaskIdAtom, draggingTaskIdAtom } from '@/store/atoms';
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
    startOfDay
} from 'date-fns';
import { enUS } from 'date-fns/locale'; // Use appropriate locale
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    useDraggable,
    useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
// import { motion } from 'framer-motion';

// Draggable Task Item for Calendar
interface DraggableTaskProps {
    task: Task;
    isOverlay?: boolean;
}
const DraggableTask: React.FC<DraggableTaskProps> = ({ task, isOverlay = false }) => {
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
        data: { task }, // Pass task data
    });

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 1000 : undefined, // Ensure overlay is on top
    } : {};

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }} // Select task on click, stop propagation
            className={twMerge(
                "w-full text-left p-1 rounded truncate transition-colors duration-150 text-xs cursor-grab",
                task.completed ? 'bg-gray-100 text-muted line-through' : 'bg-primary/10 text-primary-dark hover:bg-primary/20',
                // Priority border
                task.priority === 1 && !task.completed && "border-l-2 border-red-500 pl-0.5",
                task.priority === 2 && !task.completed && "border-l-2 border-orange-400 pl-0.5",
                task.priority === 3 && !task.completed && "border-l-2 border-blue-400 pl-0.5",
                // Overlay specific styles
                isOverlay && 'shadow-lg bg-white opacity-90 border border-gray-200',
                // Reduce opacity of source item while dragging
                isDragging && !isOverlay && 'opacity-30'
            )}
            title={task.title}
        >
            {task.title}
        </button>
    );
};

// Droppable Calendar Day Cell
interface DroppableDayProps {
    day: Date;
    children: React.ReactNode;
    className?: string;
    isOver: boolean;
}
const DroppableDay = React.forwardRef<HTMLDivElement, DroppableDayProps>(
    ({ day, children, className, isOver }, ref) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const { setNodeRef } = useDroppable({
            id: dateKey, // Use date string as ID
            data: { date: day }, // Pass date object
        });

        return (
            <div
                ref={(node) => {
                    setNodeRef(node);
                    if (typeof ref === 'function') ref(node);
                    else if (ref) ref.current = node;
                }}
                className={twMerge(
                    className,
                    // Highlight when dragging over
                    isOver && 'outline outline-2 outline-primary/50 outline-offset-[-1px] bg-primary/5'
                )}
            >
                {children}
            </div>
        );
    });
DroppableDay.displayName = 'DroppableDay';

const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingId, setDraggingId] = useAtom(draggingTaskIdAtom); // Use global dragging state
    const [overDroppableId, setOverDroppableId] = useState<string | null>(null);

    const firstDayCurrentMonth = startOfMonth(currentMonthDate);
    const lastDayCurrentMonth = endOfMonth(currentMonthDate);

    const startDate = startOfWeek(firstDayCurrentMonth, { locale: enUS });
    const endDate = endOfWeek(lastDayCurrentMonth, { locale: enUS });

    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    // Group tasks by due date (only non-completed, non-trashed)
    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            if (task.dueDate && !task.completed && task.list !== 'Trash') {
                const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(task);
                // Sort tasks within a day (e.g., by priority or order)
                grouped[dateKey].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || a.order - b.order);
            }
        });
        return grouped;
    }, [tasks]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setDraggingId(event.active.id as string);
        setOverDroppableId(null);
    }, [setDraggingId]);

    const handleDragOver = useCallback((event: DragEndEvent) => {
        const { over } = event;
        setOverDroppableId(over ? over.id as string : null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingId(null);
        setOverDroppableId(null);

        if (over && active.id !== over.id) {
            const taskId = active.id as string;
            // const targetDateKey = over.id as string; // Droppable ID is 'yyyy-MM-dd'
            const targetDate = over.data?.current?.date as Date | undefined;

            if (taskId && targetDate) {
                // Update the task's due date
                setTasks(currentTasks =>
                    currentTasks.map(task =>
                        task.id === taskId
                            ? { ...task, dueDate: startOfDay(targetDate).getTime(), updatedAt: Date.now() }
                            : task
                    )
                );
                // Maybe select the task after moving?
                setSelectedTaskId(taskId);
            }
        }
    }, [setTasks, setDraggingId, setSelectedTaskId]);

    const draggingTask = useMemo(() => tasks.find(t => t.id === draggingId), [tasks, draggingId]);

    const renderCalendarDay = (day: Date) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonth = isSameMonth(day, currentMonthDate);
        const isToday = isSameDay(day, new Date());
        const isWeekend = getDay(day) === 0 || getDay(day) === 6;

        const dayClasses = twMerge(
            'min-h-[120px] h-auto border-t border-l border-gray-200/60 p-1.5 flex flex-col relative transition-colors duration-150 ease-in-out',
            !isCurrentMonth && 'bg-canvas-inset text-muted',
            isCurrentMonth && 'bg-canvas hover:bg-gray-50/50',
            isToday && 'bg-primary/5',
            isWeekend && isCurrentMonth && !isToday && 'bg-canvas-alt/50', // Subtle weekend highlight
            getDay(day) === 0 && 'border-l-0', // No left border for Sunday
            'transition-shadow duration-150',
            overDroppableId === dateKey && 'shadow-inner' // Indicate potential drop target
        );

        return (
            <DroppableDay key={day.toString()} day={day} className={dayClasses} isOver={overDroppableId === dateKey}>
                {/* Day Number */}
                <div className="flex justify-between items-center mb-1 h-5">
                     <span className={clsx(
                         'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                         isToday ? 'bg-primary text-white font-semibold' : 'text-gray-600',
                         !isCurrentMonth && !isToday && 'text-gray-400/80',
                         isWeekend && !isToday && 'text-gray-500' // Slightly different weekend number color
                     )}>
                        {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && isCurrentMonth && (
                        <span className="text-[10px] text-muted-foreground bg-gray-100/80 px-1 py-0 rounded-full font-mono">
                             {dayTasks.length}
                         </span>
                    )}
                </div>

                {/* Task List - Ensure it can grow */}
                {isCurrentMonth && (
                    <div className="overflow-y-auto styled-scrollbar flex-1 space-y-1 text-xs pr-1 -mr-1">
                        {dayTasks.slice(0, 4).map((task) => ( // Show up to 4 tasks
                            <DraggableTask key={task.id} task={task} />
                        ))}
                        {dayTasks.length > 4 && (
                            <div className="text-xs text-muted-foreground pt-0.5 text-center mt-1">
                                +{dayTasks.length - 4} more
                            </div>
                        )}
                    </div>
                )}
                {/* If day is not current month, maybe show tasks faded? */}
                {/* {!isCurrentMonth && dayTasks.length > 0 && (...)} */}
            </DroppableDay>
        );
    };

    const previousMonth = () => setCurrentMonthDate(subMonths(currentMonthDate, 1));
    const nextMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, 1));
    const goToToday = () => setCurrentMonthDate(startOfDay(new Date()));

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Or use date-fns locale

    return (
        // Wrap Calendar in DndContext
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver} // Track over events for highlighting drop zones
            onDragCancel={() => { setDraggingId(null); setOverDroppableId(null); }}
        >
            {/* Ensure full height and flex column */}
            <div className="h-full max-h-screen flex flex-col bg-canvas">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-gray-200/70 flex justify-between items-center flex-shrink-0 h-14">
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        <Button
                            onClick={goToToday}
                            variant="secondary" // Use secondary for less emphasis than primary action
                            size="md"
                            disabled={isSameMonth(currentMonthDate, new Date())}
                            className="font-medium"
                        >
                            Today
                        </Button>
                        <div className="flex items-center">
                            <Button onClick={previousMonth} variant="ghost" size="icon" aria-label="Previous month">
                                <Icon name="chevron-left" size={18} />
                            </Button>
                            {/* Wider month/year display */}
                            <span className="mx-2 text-sm font-medium w-36 text-center text-gray-700">
                                 {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                            </span>
                            <Button onClick={nextMonth} variant="ghost" size="icon" aria-label="Next month">
                                <Icon name="chevron-right" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid - Use flex-1 to take remaining space */}
                <div className="flex-1 overflow-auto styled-scrollbar p-2">
                    {/* Grid container with borders */}
                    <div className="grid grid-cols-7 border-b border-r border-gray-200/60 rounded-lg overflow-hidden shadow-subtle bg-canvas">
                        {/* Weekday Headers */}
                        {weekDays.map((day) => (
                            <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground bg-canvas-alt border-l border-t border-gray-200/60 first:border-l-0 h-9 flex items-center justify-center">
                                {day}
                            </div>
                        ))}
                        {/* Calendar Days */}
                        {daysInGrid.map(renderCalendarDay)}
                    </div>
                </div>
            </div>

            {/* Drag Overlay for calendar tasks */}
            <DragOverlay dropAnimation={null} zIndex={1000}>
                {draggingId && draggingTask ? (
                    // Render a clone of the task being dragged
                    <DraggableTask task={draggingTask} isOverlay={true} />
                ) : null}
            </DragOverlay>

        </DndContext>
    );
};

export default CalendarView;