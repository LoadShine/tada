// src/components/common/CustomDatePickerPopover.tsx
// Updated styles to pixel-perfectly match the screenshot
// Implemented hover-only tooltips
import React, { useState, useMemo, useCallback } from 'react';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    isSameMonth, isSameDay, addMonths, subMonths, format, addDays, addWeeks,
    startOfDay, isToday as isTodayFn // Import isTodayFn explicitly
} from '@/utils/dateUtils';
import Icon from '@/components/common/Icon';
import { twMerge } from 'tailwind-merge';

interface CustomDatePickerPopoverProps {
    initialDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    close: () => void;
}

// Tooltip component for internal use
const Tooltip: React.FC<{ text: string, children: React.ReactElement }> = ({ text, children }) => (
    <div className="relative group">
        {children}
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap bg-gray-800 text-white text-[10px] font-medium rounded py-0.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
            {text}
        </div>
    </div>
);

const CustomDatePickerPopover: React.FC<CustomDatePickerPopoverProps> = ({
                                                                             initialDate,
                                                                             onSelect,
                                                                             close
                                                                         }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(initialDate || today));
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate ? startOfDay(initialDate) : undefined);

    const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
    const startDate = useMemo(() => startOfWeek(monthStart), [monthStart]);
    const endDate = useMemo(() => endOfWeek(monthEnd), [monthEnd]);

    const days = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    const prevMonth = useCallback(() => setCurrentMonth(m => subMonths(m, 1)), []);
    const nextMonth = useCallback(() => setCurrentMonth(m => addMonths(m, 1)), []);

    const handleDateClick = useCallback((day: Date) => {
        setSelectedDate(startOfDay(day));
    }, []);

    const handlePresetSelect = useCallback((date: Date) => {
        setSelectedDate(startOfDay(date));
        onSelect(startOfDay(date));
        close();
    }, [onSelect, close]);

    const handleConfirm = useCallback(() => {
        onSelect(selectedDate);
        close();
    }, [selectedDate, onSelect, close]);

    const handleClear = useCallback(() => {
        setSelectedDate(undefined);
        onSelect(undefined);
        close();
    }, [onSelect, close]);

    const dayNames = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

    return (
        // Container matching screenshot style
        <div className="bg-white rounded-lg shadow-xl p-4 w-[320px] border border-gray-200/80">
            {/* Preset date options with Tooltips */}
            <div className="flex justify-between items-center mb-4">
                <Tooltip text="Today">
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handlePresetSelect(today)}>
                        <Icon name="sun" size={24} className="text-gray-500" />
                    </button>
                </Tooltip>
                <Tooltip text="Tomorrow">
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handlePresetSelect(addDays(today, 1))}>
                        <Icon name="sunset" size={24} className="text-gray-500" />
                    </button>
                </Tooltip>
                <Tooltip text="Next Week">
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handlePresetSelect(addWeeks(today, 1))}>
                        <div className="relative">
                            <Icon name="calendar" size={24} className="text-gray-500" />
                            <div className="absolute -top-0.5 -right-0.5 text-[10px] bg-gray-200 text-gray-600 rounded-sm px-1 font-medium">+7</div>
                        </div>
                    </button>
                </Tooltip>
                <Tooltip text="Next Month">
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => handlePresetSelect(addMonths(today, 1))}>
                        <Icon name="moon" size={24} className="text-gray-500" />
                    </button>
                </Tooltip>
            </div>

            {/* Month header and navigation */}
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-gray-700">{format(currentMonth, 'MMM yyyy')}</h2>
                <div className="flex items-center">
                    <button onClick={prevMonth} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <Icon name="chevron-left" size={18} className="text-gray-500" />
                    </button>
                    <div className="w-2 h-2 bg-gray-300 rounded-full mx-1.5"></div>
                    <button onClick={nextMonth} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <Icon name="chevron-right" size={18} className="text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-0.5 mb-4">
                {dayNames.map((day, i) => (
                    <div key={`header-${i}`} className="text-center text-xs font-medium text-gray-400 mb-1.5">
                        {day}
                    </div>
                ))}
                {days.map((day) => {
                    const dayOfMonth = format(day, 'd');
                    const isCurrent = isSameMonth(day, currentMonth);
                    const isSel = selectedDate && isSameDay(day, selectedDate);
                    const isTod = isTodayFn(day); // Use imported isTodayFn

                    return (
                        <div
                            key={day.toISOString()}
                            className={twMerge(
                                'h-9 flex items-center justify-center', // Cell container
                                isCurrent ? 'cursor-pointer' : 'pointer-events-none'
                            )}
                            onClick={isCurrent ? () => handleDateClick(day) : undefined}
                        >
                            <span className={twMerge(
                                'h-7 w-7 flex items-center justify-center rounded-full text-sm', // Day number span
                                !isCurrent && 'text-gray-300', // Outside month
                                isCurrent && !isSel && 'text-gray-700 hover:bg-gray-100', // Current month, not selected
                                isCurrent && isTod && !isSel && 'font-semibold text-blue-600', // Today, not selected
                                isSel && 'bg-blue-500 text-white font-semibold hover:bg-blue-600' // Selected
                            )}>
                                {dayOfMonth}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Reminder, Repeat sections */}
            <div className="border-t border-gray-200 pt-3">
                <button className="flex items-center justify-between w-full py-2 px-1 rounded hover:bg-gray-100/70 transition-colors text-left">
                    <div className="flex items-center">
                        <Icon name="bell" size={18} className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-600">Reminder</span>
                    </div>
                    <Icon name="chevron-right" size={18} className="text-gray-400" />
                </button>
                <button className="flex items-center justify-between w-full py-2 px-1 rounded hover:bg-gray-100/70 transition-colors text-left">
                    <div className="flex items-center">
                        <Icon name="refresh-cw" size={18} className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-600">Repeat</span>
                    </div>
                    <Icon name="chevron-right" size={18} className="text-gray-400" />
                </button>
            </div>

            {/* Action buttons */}
            <div className="flex mt-4 gap-2">
                <button
                    onClick={handleClear}
                    className="flex-1 py-2 border border-gray-300 rounded-md text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                    Clear
                </button>
                <button
                    onClick={handleConfirm}
                    className="flex-1 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default CustomDatePickerPopover;