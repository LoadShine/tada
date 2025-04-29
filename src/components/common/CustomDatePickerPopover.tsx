// src/components/common/CustomDatePickerPopover.tsx
import React, { useState, useMemo, useCallback, useRef } from 'react'; // Added useRef
import ReactDOM from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { Tooltip } from 'react-tooltip';
import {
    addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
    format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth,
    startOfWeek, subMonths, isValid
} from '@/lib/utils/dateUtils';
import Button from './Button';
import Icon from './Icon';
import { motion, AnimatePresence } from 'framer-motion';
import useClickAway from '@/hooks/useClickAway'; // <<< Import useClickAway

interface CustomDatePickerPopoverProps {
    initialDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    close: () => void;
    triggerElement?: HTMLElement | null; // Still useful for positioning if not using portal
    usePortal?: boolean;
}

// Internal content component remains largely the same, but adds useClickAway
const CustomDatePickerPopoverContent: React.FC<CustomDatePickerPopoverProps> = React.memo(({
                                                                                               initialDate,
                                                                                               onSelect,
                                                                                               close,
                                                                                               triggerElement // Keep triggerElement prop for potential useClickAway logic with trigger
                                                                                           }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialDate && isValid(initialDate) ? startOfDay(initialDate) : today);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined);
    const popoverRef = useRef<HTMLDivElement>(null); // <<< Ref for the popover content

    // <<< Apply useClickAway hook >>>
    // We pass both the popover content ref and the trigger element ref (if available)
    // This prevents closing if the user clicks the trigger button again while the popover is open.
    // const refsToWatch: React.RefObject<HTMLElement>[] = [popoverRef];
    if (triggerElement instanceof HTMLElement) {
        // Create a RefObject on the fly if triggerElement is passed and is an HTMLElement
        // Note: This isn't ideal as the ref isn't stable, but works for preventing trigger clicks closing.
        // A more robust way would be to require the trigger ref to be passed if needed.
        // However, for this specific problem in TaskList, triggerElement isn't strictly necessary
        // for the click-away logic *of the popover itself*. We primarily need the popoverRef.
        // Let's keep it simple and just watch the popoverRef for now.
        // If issues arise with trigger clicks, this part can be revisited.
    }
    useClickAway(popoverRef, close); // Watch only the popover content itself

    // --- Rest of the component logic remains the same ---

    const { calendarDays } = useMemo(() => {
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(viewDate);
        const cStart = startOfWeek(mStart);
        const cEnd = endOfWeek(mEnd);
        const days = eachDayOfInterval({ start: cStart, end: cEnd });
        return { monthStart: mStart, monthEnd: mEnd, calendarStart: cStart, calendarEnd: cEnd, calendarDays: days };
    }, [viewDate]);

    const tooltipIdPrefix = useMemo(() => `date-picker-tooltip-${Math.random().toString(36).substring(7)}`, []); // Unique prefix per instance

    const prevMonth = useCallback(() => setViewDate(v => subMonths(v, 1)), []);
    const nextMonth = useCallback(() => setViewDate(v => addMonths(v, 1)), []);
    const goToToday = useCallback(() => {
        const todayDate = startOfDay(new Date());
        setViewDate(todayDate);
        if (!selectedDate || !isSameDay(selectedDate, todayDate)) {
            setSelectedDate(todayDate);
        }
    }, [selectedDate]);

    const createQuickSelectHandler = useCallback((dateFn: () => Date) => () => {
        const date = startOfDay(dateFn());
        setSelectedDate(date);
        setViewDate(date);
        onSelect(date);
        close();
    }, [onSelect, close]);

    const selectToday = useMemo(() => createQuickSelectHandler(() => new Date()), [createQuickSelectHandler]);
    const selectTomorrow = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 1)), [createQuickSelectHandler]);
    const selectNextWeek = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 7)), [createQuickSelectHandler]);
    const selectNextMonth = useMemo(() => createQuickSelectHandler(() => addMonths(new Date(), 1)), [createQuickSelectHandler]);

    const handleSelectDate = useCallback((date: Date) => {
        const dateStart = startOfDay(date);
        const isCurrentlySelected = selectedDate && isSameDay(dateStart, selectedDate);
        const newDate = isCurrentlySelected ? undefined : dateStart;
        setSelectedDate(newDate);
    }, [selectedDate]);

    const handleClearDate = useCallback(() => {
        setSelectedDate(undefined);
        onSelect(undefined);
        close();
    }, [onSelect, close]);

    const handleConfirm = useCallback(() => {
        onSelect(selectedDate);
        close();
    }, [selectedDate, onSelect, close]);

    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

    return (
        // <<< Attach ref and ignore-click-away class >>>
        <div
            ref={popoverRef}
            className="date-picker-content ignore-click-away bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 p-4 w-[320px]"
            // Stop propagation needed to prevent triggering parent click-away handlers if nested
            onClick={e => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {/* Quick Date Selection Icons */}
            <div className="flex justify-between mb-4 px-4">
                <button
                    onClick={selectToday}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                    data-tooltip-id={`${tooltipIdPrefix}today`} data-tooltip-content="Today"
                    aria-label="Select Today"
                >
                    <Icon name="sun" size={20} className="text-gray-500"/>
                </button>
                <Tooltip id={`${tooltipIdPrefix}today`} place="top" className="!z-[60]"/>

                <button
                    onClick={selectTomorrow}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                    data-tooltip-id={`${tooltipIdPrefix}tomorrow`} data-tooltip-content="Tomorrow"
                    aria-label="Select Tomorrow"
                >
                    <Icon name="sunset" size={20} className="text-gray-500"/>
                </button>
                <Tooltip id={`${tooltipIdPrefix}tomorrow`} place="top" className="!z-[60]"/>

                <button
                    onClick={selectNextWeek}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                    data-tooltip-id={`${tooltipIdPrefix}next-week`} data-tooltip-content="+7 Days"
                    aria-label="Select 7 days from now"
                >
                    <div className="relative">
                        <Icon name="calendar" size={20} className="text-gray-500"/>
                        <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-gray-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                            +7
                        </div>
                    </div>
                </button>
                <Tooltip id={`${tooltipIdPrefix}next-week`} place="top" className="!z-[60]"/>

                <button
                    onClick={selectNextMonth}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 transition-colors"
                    data-tooltip-id={`${tooltipIdPrefix}next-month`} data-tooltip-content="Next Month"
                    aria-label="Select next month"
                >
                    <Icon name="moon" size={20} className="text-gray-500"/>
                </button>
                <Tooltip id={`${tooltipIdPrefix}next-month`} place="top" className="!z-[60]"/>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="text-base font-medium text-gray-800">
                    {format(viewDate, 'MMMM yyyy')}
                </div>
                <div className="flex items-center space-x-1">
                    <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left" className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Previous month"/>
                    <Button onClick={goToToday} variant="ghost" size="icon" className="w-7 h-7" aria-label="Go to current month">
                        <div className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary" : "bg-gray-300")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right" className="w-7 h-7 text-gray-500 hover:bg-black/10" aria-label="Next month"/>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="mb-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, i) => (
                        <div key={i} className="text-center text-xs text-gray-500 h-8 flex items-center justify-center font-medium">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
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
                                    !isCurrentMonth && "text-gray-400/70 hover:bg-transparent",
                                    isCurrentMonth && "hover:bg-black/10",
                                    isDayToday && !isDaySelected && "font-semibold text-primary border border-primary/50",
                                    !isDayToday && isCurrentMonth && !isDaySelected && "text-gray-800",
                                    isDaySelected && "bg-primary text-white font-semibold hover:bg-primary-dark",
                                    !isCurrentMonth && "pointer-events-none opacity-50"
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
                <Button
                    variant="outline"
                    size="md"
                    className="flex-1 justify-center"
                    onClick={handleClearDate}
                >
                    Clear
                </Button>
                <Button
                    variant="primary"
                    size="md"
                    className="flex-1 justify-center"
                    onClick={handleConfirm}
                >
                    OK
                </Button>
            </div>
        </div>
    );
});
CustomDatePickerPopoverContent.displayName = 'CustomDatePickerPopoverContent';


// Main Popover component - wrapper for portal logic (remains the same)
const CustomDatePickerPopover: React.FC<CustomDatePickerPopoverProps> = ({ usePortal = false, ...props }) => {
    const content = (
        <AnimatePresence>
            <motion.div
                className="date-picker-popover z-[60]" // Keep high z-index
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
            >
                {/* Pass all props down, including triggerElement */}
                <CustomDatePickerPopoverContent {...props} />
            </motion.div>
        </AnimatePresence>
    );

    return usePortal ? ReactDOM.createPortal(content, document.body) : content;
};
CustomDatePickerPopover.displayName = 'CustomDatePickerPopover';
export default CustomDatePickerPopover;