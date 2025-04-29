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
} from '@/lib/utils/dateUtils';
import Button from './Button';
// import Icon from './Icon';
import {AnimatePresence, motion} from 'framer-motion';

// --- Click Away Hook (Include directly or ensure it's importable) ---
const useClickAwayMultiple = (
    refs: (React.RefObject<HTMLElement | null> | HTMLElement | null)[],
    handler: (event: MouseEvent | TouchEvent) => void
) => {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            const isInside = refs.some(refOrEl => {
                const el = refOrEl instanceof HTMLElement ? refOrEl : refOrEl?.current;
                // Check containment OR ignore class on target or ancestors
                return el && (el.contains(target) || (target instanceof Element && !!target.closest('.ignore-click-away')));
            });
            if (!isInside) {
                handler(event);
            }
        };
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', listener);
            document.addEventListener('touchstart', listener);
        }, 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
        // Use refs directly in dependency array if they are stable
        // If triggerElement can change, include it specifically if needed
    }, [refs, handler]); // Adjust dependencies as needed
};


interface CustomDateRangePickerPopoverProps {
    initialStartDate: Date | undefined;
    initialEndDate: Date | undefined;
    onApplyRange: (startDate: Date, endDate: Date) => void;
    close: () => void;
    triggerElement?: HTMLElement | null;
}

const CustomDateRangePickerPopover: React.FC<CustomDateRangePickerPopoverProps> = React.memo(({
                                                                                                  initialStartDate,
                                                                                                  initialEndDate,
                                                                                                  onApplyRange,
                                                                                                  close,
                                                                                                  triggerElement
                                                                                              }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : today);
    const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate && isValid(initialStartDate) ? startOfDay(initialStartDate) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate && isValid(initialEndDate) ? startOfDay(initialEndDate) : undefined);
    const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    // Use stable refs array for click away hook
    const clickAwayRefs = useMemo(
        () => [popoverRef, triggerElement ?? null] as (React.RefObject<HTMLElement | null> | HTMLElement | null)[],
        [triggerElement]
    );
    useClickAwayMultiple(clickAwayRefs, close);

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
    const handleApply = useCallback(() => {
        if (startDate && endDate) {
            onApplyRange(startDate, endDate);
            close();
        } else if (startDate && !endDate) {
            onApplyRange(startDate, startDate);
            close();
        }
    }, [startDate, endDate, onApplyRange, close]);
    const handleMouseEnterDay = (date: Date) => {
        if (startDate && !endDate) {
            setHoveredDate(startOfDay(date));
        }
    }
    const handleMouseLeaveGrid = () => {
        setHoveredDate(undefined);
    }
    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);
    const isApplyDisabled = !(startDate && endDate) && !(startDate && !endDate);

    return (
        <AnimatePresence>
            <motion.div
                ref={popoverRef}
                className="date-range-picker-content ignore-click-away bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 p-4 w-[320px]"
                onClick={e => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                initial={{opacity: 0, scale: 0.95, y: -5}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.95, y: -5, transition: {duration: 0.1}}}
                transition={{duration: 0.15, ease: 'easeOut'}}
            >
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                    <div
                        className="text-base font-medium text-gray-800 flex-1 text-center"> {format(viewDate, 'MMMM yyyy')} </div>
                    <div className="flex items-center space-x-1"><Button onClick={prevMonth} variant="ghost" size="icon"
                                                                         icon="chevron-left"
                                                                         className="w-7 h-7 text-gray-500 hover:bg-black/10"
                                                                         aria-label="Previous month"/> <Button
                        onClick={goToToday} variant="ghost" size="icon" className="w-7 h-7"
                        aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary" : "bg-gray-300")}></div>
                    </Button> <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                                      className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Next month"/>
                    </div>
                </div>
                {/* Selected Range Display */}
                <div
                    className="text-center text-xs text-muted-foreground mb-3 min-h-[16px]"> {startDate && !endDate && `Start: ${format(startDate, 'MMM d, yyyy')}`} {startDate && endDate && `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`} {!startDate && !endDate && `Select start date`} </div>
                {/* Calendar Grid */}
                <div className="mb-3" onMouseLeave={handleMouseLeaveGrid}>
                    <div className="grid grid-cols-7 mb-1"> {weekDays.map((day, i) => (<div key={i}
                                                                                            className="text-center text-xs text-gray-500 h-8 flex items-center justify-center font-medium">{day}</div>))} </div>
                    <div className="grid grid-cols-7 gap-px"> {calendarDays.map((day, i) => {
                        const dayStart = startOfDay(day);
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isDayToday = isToday(day);
                        const isSelectedStart = startDate && isSameDay(dayStart, startDate);
                        const isSelectedEnd = endDate && isSameDay(dayStart, endDate);
                        const potentialEndDate = hoveredDate ?? endDate;
                        const isInRange = startDate && potentialEndDate && !isSelectedStart && !isSelectedEnd && isAfter(dayStart, startDate) && isBefore(dayStart, potentialEndDate);
                        const isHoveringInRange = startDate && !endDate && hoveredDate && !isSelectedStart && !isSameDay(dayStart, hoveredDate) && isAfter(dayStart, startDate) && isBefore(dayStart, hoveredDate);
                        return (<button key={i} onClick={() => handleSelectDate(day)}
                                        onMouseEnter={() => handleMouseEnterDay(day)}
                                        className={twMerge("h-9 w-9 flex items-center justify-center text-sm transition-colors duration-50 ease-linear mx-auto relative", "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:z-10", !isCurrentMonth && "text-gray-400/60 pointer-events-none opacity-60", isCurrentMonth && !isSelectedStart && !isSelectedEnd && "text-gray-800", isDayToday && "font-semibold ring-1 ring-inset ring-primary/30", (isInRange || isHoveringInRange) && isCurrentMonth && "bg-primary/10", isCurrentMonth && !isSelectedStart && !isSelectedEnd && !(isInRange || isHoveringInRange) && "hover:bg-black/10", (isSelectedStart || isSelectedEnd) && "bg-primary text-white font-semibold z-[5]", isSelectedStart && "rounded-l-full", isSelectedEnd && "rounded-r-full", isSelectedStart && isSelectedEnd && "rounded-full", (isInRange || isHoveringInRange) && !isSelectedStart && !isSelectedEnd && "rounded-none", isSelectedStart && !endDate && hoveredDate && isAfter(hoveredDate, startDate) && "rounded-l-full", !isCurrentMonth && "pointer-events-none")}
                                        aria-label={format(day, 'MMMM d, yyyy')}
                                        aria-pressed={isSelectedStart || isSelectedEnd}
                                        disabled={!isCurrentMonth}> {format(day, 'd')} </button>);
                    })} </div>
                </div>
                {/* Action Buttons */}
                <div className="flex space-x-2 mt-2 border-t border-black/10 pt-3"><Button variant="ghost" size="md"
                                                                                           className="flex-1 justify-center text-muted-foreground"
                                                                                           onClick={handleClear}> Clear </Button>
                    <Button variant="outline" size="md" className="flex-1 justify-center"
                            onClick={close}> Cancel </Button> <Button variant="primary" size="md"
                                                                      className="flex-1 justify-center"
                                                                      onClick={handleApply}
                                                                      disabled={isApplyDisabled}> Apply </Button></div>
            </motion.div>
        </AnimatePresence>
    );
});
CustomDateRangePickerPopover.displayName = 'CustomDateRangePickerPopover';

export default CustomDateRangePickerPopover;