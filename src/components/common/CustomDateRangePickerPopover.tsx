// src/components/common/CustomDateRangePickerPopover.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isAfter,
    isBefore,
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

interface CustomDateRangePickerContentProps {
    initialStartDate: Date | undefined;
    initialEndDate: Date | undefined;
    onApplyRange: (startDate: Date, endDate: Date) => void;
    closePopover: () => void;
}

export const CustomDateRangePickerContent: React.FC<CustomDateRangePickerContentProps> = React.memo(({
                                                                                                         initialStartDate,
                                                                                                         initialEndDate,
                                                                                                         onApplyRange,
                                                                                                         closePopover, // Receive close function
                                                                                                     }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : today);
    const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate && isValid(initialEndDate) ? startOfDay(initialEndDate) : undefined);
    const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
    const contentRef = useRef<HTMLDivElement | null>(null);

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
    const goToToday = useCallback(() => setViewDate(today), [today]);

    const handleSelectDate = useCallback((date: Date) => {
        const dateStart = startOfDay(date);
        if (!startDate || (startDate && endDate)) {
            setStartDate(dateStart);
            setEndDate(undefined);
            setHoveredDate(undefined);
        } else if (startDate && !endDate) {
            if (isBefore(dateStart, startDate)) {
                setEndDate(startDate);
                setStartDate(dateStart);
            } else {
                setEndDate(dateStart);
            }
            setHoveredDate(undefined);
        }
    }, [startDate, endDate]);

    const handleClear = useCallback(() => {
        setStartDate(undefined);
        setEndDate(undefined);
        setHoveredDate(undefined);
    }, []);

    // Apply button now calls onApplyRange AND closePopover
    const handleApply = useCallback(() => {
        let applyStart = startDate;
        let applyEnd = endDate;

        if (startDate && !endDate) {
            applyStart = startDate;
            applyEnd = startDate;
        }

        if (applyStart && applyEnd) {
            onApplyRange(applyStart, applyEnd);
            closePopover(); // Close after applying
        }
    }, [startDate, endDate, onApplyRange, closePopover]);


    const handleMouseEnterDay = (date: Date) => {
        if (startDate && !endDate) {
            setHoveredDate(startOfDay(date));
        }
    }
    const handleMouseLeaveGrid = () => {
        setHoveredDate(undefined);
    }

    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);
    const isApplyDisabled = !startDate;

    useEffect(() => {
        setStartDate(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : undefined);
        setEndDate(initialEndDate && isValid(initialEndDate) ? startOfDay(initialEndDate) : undefined);
        setViewDate(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : today);
    }, [initialStartDate, initialEndDate, today]);

    return (
        <div
            ref={contentRef}
            className="date-range-picker-content bg-glass-100 dark:bg-neutral-800 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-4 w-[320px]"
            // Stop propagation to prevent parent popovers/dropdowns from closing unintentionally
            onClick={e => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-3">
                <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left"
                        className="w-7 h-7 text-gray-500 dark:text-neutral-400 hover:bg-black/10 dark:hover:bg-white/10"
                        aria-label="Previous month"/>
                <div
                    className="text-base font-medium text-gray-800 dark:text-neutral-100 flex-1 text-center tabular-nums">
                    {format(viewDate, 'MMMM yyyy')}
                </div>
                <div className="flex items-center space-x-1">
                    <Button onClick={goToToday} variant="ghost" size="icon" className="w-7 h-7"
                            aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary" : "bg-gray-300 dark:bg-neutral-600")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                            className="w-7 h-7 text-gray-500 dark:text-neutral-400 hover:bg-black/10 dark:hover:bg-white/10"
                            aria-label="Next month"/>
                </div>
            </div>
            {/* Selected Range Display */}
            <div className="text-center text-xs text-muted-foreground dark:text-neutral-400 mb-3 min-h-[16px]">
                {startDate && !endDate && `Start: ${format(startDate, 'MMM d, yyyy')}`}
                {startDate && endDate && `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`}
                {!startDate && !endDate && `Select start date`}
            </div>
            {/* Calendar Grid */}
            <div className="mb-3" onMouseLeave={handleMouseLeaveGrid}>
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, i) => (
                        <div key={i}
                             className="text-center text-xs text-gray-500 dark:text-neutral-400 h-8 flex items-center justify-center font-medium">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                    {calendarDays.map((day, i) => {
                        const dayStart = startOfDay(day);
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isDayToday = isToday(day);
                        const isSelectedStart = startDate && isSameDay(dayStart, startDate);
                        const isSelectedEnd = endDate && isSameDay(dayStart, endDate);
                        const potentialEndDate = hoveredDate ?? endDate;
                        const isInRange = startDate && potentialEndDate && !isSelectedStart && !isSelectedEnd && isAfter(dayStart, startDate) && isBefore(dayStart, potentialEndDate);
                        const isHoveringInRange = startDate && !endDate && hoveredDate && !isSelectedStart && !isSameDay(dayStart, hoveredDate) && isAfter(dayStart, startDate) && isBefore(dayStart, hoveredDate);

                        return (
                            <button
                                key={i}
                                onClick={() => handleSelectDate(day)}
                                onMouseEnter={() => handleMouseEnterDay(day)}
                                className={twMerge(
                                    "h-9 w-9 flex items-center justify-center text-sm transition-colors duration-50 ease-linear mx-auto relative",
                                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:z-10",
                                    !isCurrentMonth && "text-gray-400/60 dark:text-neutral-600 pointer-events-none opacity-60", // Dim non-month days
                                    isCurrentMonth && !isSelectedStart && !isSelectedEnd && "text-gray-800 dark:text-neutral-200", // Default day in month
                                    isDayToday && "font-semibold ring-1 ring-inset ring-primary/30 dark:ring-primary/40", // Today marker
                                    (isInRange || isHoveringInRange) && isCurrentMonth && "bg-primary/10 dark:bg-primary/20", // In range background
                                    isCurrentMonth && !isSelectedStart && !isSelectedEnd && !(isInRange || isHoveringInRange) && "hover:bg-black/10 dark:hover:bg-white/10", // Hover for selectable days
                                    (isSelectedStart || isSelectedEnd) && "bg-primary text-white font-semibold z-[5]", // Selected start/end
                                    // Rounded corners logic for range display
                                    isSelectedStart && !endDate && hoveredDate && isAfter(hoveredDate, startDate) && "rounded-l-full", // Hovering range start
                                    isSelectedStart && endDate && !isSameDay(startDate!, endDate!) && "rounded-l-full", // Range start
                                    isSelectedEnd && startDate && !isSameDay(startDate!, endDate!) && "rounded-r-full", // Range end
                                    isSelectedStart && isSelectedEnd && isSameDay(startDate!, endDate!) && "rounded-full", // Single day selected
                                    (isInRange || isHoveringInRange) && !isSelectedStart && !isSelectedEnd && "rounded-none", // Day within range
                                    !isCurrentMonth && "pointer-events-none"
                                )}
                                aria-label={format(day, 'MMMM d, yyyy')}
                                aria-pressed={!!(isSelectedStart || isSelectedEnd)}
                                disabled={!isCurrentMonth}
                            >
                                {format(day, 'd')}
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* Action Buttons */}
            <div className="flex space-x-2 mt-2 border-t border-black/10 dark:border-white/10 pt-3">
                <Button variant="ghost" size="md"
                        className="flex-1 justify-center text-muted-foreground dark:text-neutral-400"
                        onClick={handleClear}> Clear </Button>
                <Button variant="outline" size="md" className="flex-1 justify-center"
                        onClick={closePopover}> Cancel </Button>
                <Button variant="primary" size="md" className="flex-1 justify-center" onClick={handleApply}
                        disabled={isApplyDisabled}> Apply </Button>
            </div>
        </div>
    );
});
CustomDateRangePickerContent.displayName = 'CustomDateRangePickerContent';
