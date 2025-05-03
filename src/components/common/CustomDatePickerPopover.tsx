// src/components/common/CustomDatePickerPopover.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    isValid,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths
} from '@/utils/dateUtils';
import Button from './Button';
import Icon from './Icon';

// --- Internal Content Component ---
interface CustomDatePickerContentProps {
    initialDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    closePopover: () => void;
}

const CustomDatePickerContent: React.FC<CustomDatePickerContentProps> = React.memo(({
                                                                                        initialDate,
                                                                                        onSelect,
                                                                                        closePopover, // Receive close function from parent
                                                                                    }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialDate && isValid(initialDate) ? startOfDay(initialDate) : today);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined);
    const contentRef = useRef<HTMLDivElement>(null); // Ref for content div

    const {calendarDays} = useMemo(() => {
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(viewDate);
        const cStart = startOfWeek(mStart);
        const cEnd = endOfWeek(mEnd);
        const days = eachDayOfInterval({start: cStart, end: cEnd});
        return {calendarDays: days};
    }, [viewDate]);

    const prevMonth = useCallback(() => setViewDate(v => subMonths(v, 1)), []);
    const nextMonth = useCallback(() => setViewDate(v => addMonths(v, 1)), []);
    const goToToday = useCallback(() => {
        const todayDate = startOfDay(new Date());
        setViewDate(todayDate);
        if (!selectedDate || !isSameDay(selectedDate, todayDate)) {
            setSelectedDate(todayDate);
        }
    }, [selectedDate]);

    // Quick select handlers now call onSelect AND closePopover
    const createQuickSelectHandler = useCallback((dateFn: () => Date) => () => {
        const date = startOfDay(dateFn());
        setSelectedDate(date);
        onSelect(date);
        closePopover();
    }, [onSelect, closePopover]);

    const selectToday = useMemo(() => createQuickSelectHandler(() => new Date()), [createQuickSelectHandler]);
    const selectTomorrow = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 1)), [createQuickSelectHandler]);
    const selectNextWeek = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 7)), [createQuickSelectHandler]);
    const selectNextMonth = useMemo(() => createQuickSelectHandler(() => addMonths(new Date(), 1)), [createQuickSelectHandler]);

    // Handle clicking a day in the grid - only stages selection
    const handleSelectDate = useCallback((date: Date) => {
        const dateStart = startOfDay(date);
        const isCurrentlySelected = selectedDate && isSameDay(dateStart, selectedDate);
        const newDate = isCurrentlySelected ? undefined : dateStart;
        setSelectedDate(newDate);
    }, [selectedDate]);

    const handleClearDate = useCallback(() => {
        setSelectedDate(undefined);
        onSelect(undefined);
        closePopover(); // Close after clearing
    }, [onSelect, closePopover]);

    const handleConfirm = useCallback(() => {
        onSelect(selectedDate);
        closePopover(); // Close after confirming
    }, [selectedDate, onSelect, closePopover]);

    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

    useEffect(() => {
        const validInitial = initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined;
        setSelectedDate(validInitial);
        setViewDate(validInitial ?? today);
    }, [initialDate, today]);

    return (
        <div
            ref={contentRef}
            className="date-picker-content bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 p-4 w-[320px]"
            onClick={e => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {/* Quick Date Selection */}
            <div className="flex justify-between mb-4 px-4">
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectToday}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                                aria-label="Select Today">
                            <Icon name="sun" size={20} className="text-gray-500"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Today
                            <Tooltip.Arrow className="fill-black/80"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectTomorrow}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                                aria-label="Select Tomorrow">
                            <Icon name="sunset" size={20} className="text-gray-500"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Tomorrow
                            <Tooltip.Arrow className="fill-black/80"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectNextWeek}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                                aria-label="Select 7 days from now">
                            <div className="relative">
                                <Icon name="calendar" size={20} className="text-gray-500"/>
                                <div
                                    className="absolute top-0 right-0 -mt-1 -mr-1 bg-gray-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"> +7
                                </div>
                            </div>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            +7 Days
                            <Tooltip.Arrow className="fill-black/80"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectNextMonth}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                                aria-label="Select next month">
                            <Icon name="moon" size={20} className="text-gray-500"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Next Month
                            <Tooltip.Arrow className="fill-black/80"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="text-base font-medium text-gray-800">
                    {format(viewDate, 'MMMM yyyy')}
                </div>
                <div className="flex items-center space-x-1">
                    <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left"
                            className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Previous month"/>
                    <Button onClick={goToToday} variant="ghost" size="icon" className="w-7 h-7"
                            aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary" : "bg-gray-300")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                            className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Next month"/>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="mb-4">
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, i) => (
                        <div key={i}
                             className="text-center text-xs text-gray-500 h-8 flex items-center justify-center font-medium">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-0">
                    {calendarDays.map((day, i) => {
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isDaySelected = selectedDate && isSameDay(day, selectedDate);
                        const isDayToday = isToday(day);
                        return (
                            <button
                                key={i}
                                onClick={() => handleSelectDate(day)}
                                className={twMerge(
                                    "h-9 w-9 flex items-center justify-center rounded-full text-sm transition-colors mx-auto",
                                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:z-10", // Focus style
                                    !isCurrentMonth && "text-gray-400/70", // Style for days outside current month
                                    isCurrentMonth && "hover:bg-black/10", // Hover for days in current month
                                    isDayToday && !isDaySelected && "font-semibold text-primary border border-primary/50", // Style for today
                                    !isDayToday && isCurrentMonth && !isDaySelected && "text-gray-800", // Default style for days in month
                                    isDaySelected && "bg-primary text-white font-semibold hover:bg-primary-dark", // Selected style
                                    !isCurrentMonth && "pointer-events-none opacity-50" // Disable interaction for outside days
                                )}
                                aria-label={format(day, 'MMMM d, yyyy')}
                                aria-pressed={isDaySelected}
                                disabled={!isCurrentMonth}
                            >
                                {format(day, 'd')}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-4 border-t border-black/10 pt-3">
                {/* Buttons now call closePopover directly or indirectly */}
                <Button variant="outline" size="md" className="flex-1 justify-center"
                        onClick={handleClearDate}> Clear </Button>
                <Button variant="primary" size="md" className="flex-1 justify-center"
                        onClick={handleConfirm}> OK </Button>
            </div>
        </div>
    );
});
CustomDatePickerContent.displayName = 'CustomDatePickerContent';

export {CustomDatePickerContent};
export default CustomDatePickerContent;