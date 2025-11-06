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
import {useTranslation} from "react-i18next";

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
                                                                                                         closePopover,
                                                                                                     }) => {
    const {t} = useTranslation();
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
        return {calendarDays: eachDayOfInterval({start: cStart, end: cEnd})};
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
    const handleApply = useCallback(() => {
        let applyStart = startDate;
        let applyEnd = endDate;
        if (startDate && !endDate) {
            applyStart = startDate;
            applyEnd = startDate;
        }
        if (applyStart && applyEnd) {
            onApplyRange(applyStart, applyEnd);
            closePopover();
        }
    }, [startDate, endDate, onApplyRange, closePopover]);
    const handleMouseEnterDay = (date: Date) => {
        if (startDate && !endDate) setHoveredDate(startOfDay(date));
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
        <div ref={contentRef} className="bg-white dark:bg-neutral-800 rounded-base shadow-modal p-4 w-[320px]"
             onClick={e => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
             onTouchStart={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
                <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left"
                        className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                        iconProps={{size: 16, strokeWidth: 1}} aria-label="Previous month"/>
                <div
                    className="text-[14px] font-normal text-grey-dark dark:text-neutral-100 flex-1 text-center tabular-nums">{format(viewDate, 'MMMM yyyy')}</div>
                <div className="flex items-center space-x-1">
                    <Button onClick={goToToday} variant="ghost" size="icon" className="w-7 h-7"
                            aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary dark:bg-primary-light" : "bg-grey-light dark:bg-neutral-600")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                            className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                            iconProps={{size: 16, strokeWidth: 1}} aria-label="Next month"/>
                </div>
            </div>
            <div
                className="text-center text-[11px] text-grey-medium dark:text-neutral-400 mb-3 min-h-[16px] font-light">
                {startDate && !endDate && `Start: ${format(startDate, 'MMM d, yyyy')}`}
                {startDate && endDate && `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`}
                {!startDate && !endDate && `Select start date`}
            </div>
            <div className="mb-3" onMouseLeave={handleMouseLeaveGrid}>
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, i) => (
                        <div key={i}
                             className="text-center text-[11px] text-grey-medium dark:text-neutral-400 h-8 flex items-center justify-center font-normal">{day}</div>
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
                                    "h-9 w-9 flex items-center justify-center text-[13px] font-light transition-colors duration-50 ease-linear mx-auto relative rounded-base",
                                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:z-10",
                                    !isCurrentMonth && "text-grey-light dark:text-neutral-600 pointer-events-none opacity-60",
                                    isCurrentMonth && !isSelectedStart && !isSelectedEnd && "text-grey-dark dark:text-neutral-100",
                                    isDayToday && "font-normal ring-1 ring-inset ring-primary/50 dark:ring-primary-light/50",
                                    (isInRange || isHoveringInRange) && isCurrentMonth && "bg-primary-light/50 dark:bg-primary-dark/30",
                                    isCurrentMonth && !isSelectedStart && !isSelectedEnd && !(isInRange || isHoveringInRange) && "hover:bg-grey-ultra-light dark:hover:bg-neutral-700",
                                    (isSelectedStart || isSelectedEnd) && "bg-primary text-white dark:bg-primary-light dark:text-grey-deep font-normal z-[5]",
                                    isSelectedStart && !endDate && hoveredDate && isAfter(hoveredDate, startDate) && "rounded-l-full rounded-r-none",
                                    isSelectedStart && endDate && !isSameDay(startDate!, endDate!) && "rounded-l-full rounded-r-none",
                                    isSelectedEnd && startDate && !isSameDay(startDate!, endDate!) && "rounded-r-full rounded-l-none",
                                    isSelectedStart && isSelectedEnd && isSameDay(startDate!, endDate!) && "rounded-full",
                                    (isInRange || isHoveringInRange) && !isSelectedStart && !isSelectedEnd && "rounded-none",
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
            <div className="flex space-x-2 mt-2 border-t border-grey-light dark:border-neutral-700 pt-3">
                <Button variant="secondary" size="md"
                        className="flex-1 justify-center text-grey-medium dark:text-neutral-300"
                        onClick={handleClear}> {t('common.clear')} </Button>
                <Button variant="secondary" size="md" className="flex-1 justify-center"
                        onClick={closePopover}> {t('common.cancel')} </Button>
                <Button variant="primary" size="md" className="flex-1 justify-center" onClick={handleApply}
                        disabled={isApplyDisabled}> {t('common.apply')} </Button>
            </div>
        </div>
    );
});
CustomDateRangePickerContent.displayName = 'CustomDateRangePickerContent';