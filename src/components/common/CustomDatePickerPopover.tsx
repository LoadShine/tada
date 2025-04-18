// src/components/common/CustomDatePickerPopover.tsx
import React, { useState } from 'react';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    format,
    addDays,
    addWeeks
} from '@/utils/dateUtils';
import Icon from '@/components/common/Icon';

interface CustomDatePickerPopoverProps {
    initialDate: Date | undefined; // Date currently set on the task
    onSelect: (date: Date | undefined) => void; // Callback with Date or undefined for clearing
    close: () => void; // Function to close the popover
}

const CustomDatePickerPopover: React.FC<CustomDatePickerPopoverProps> = ({
                                                                             initialDate,
                                                                             onSelect,
                                                                             close
                                                                         }) => {
    // State for controlling the visible month in the calendar
    const [currentMonth, setCurrentMonth] = useState<Date>(initialDate || new Date());
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

    // Generate calendar days for the current month view
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Navigation handlers
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Date selection handler
    const handleDateClick = (day: Date) => {
        setSelectedDate(day);
    };

    // Handle preset date options with direct selection
    const handleToday = () => {
        const today = new Date();
        setSelectedDate(today);
        onSelect(today);
        close();
    };

    const handleTomorrow = () => {
        const tomorrow = addDays(new Date(), 1);
        setSelectedDate(tomorrow);
        onSelect(tomorrow);
        close();
    };

    const handleNextWeek = () => {
        const nextWeek = addWeeks(new Date(), 1);
        setSelectedDate(nextWeek);
        onSelect(nextWeek);
        close();
    };

    const handleNextMonth = () => {
        const nextMonth = addMonths(new Date(), 1);
        setSelectedDate(nextMonth);
        onSelect(nextMonth);
        close();
    };

    // Handle confirm or cancel
    const handleConfirm = () => {
        onSelect(selectedDate);
        close();
    };

    const handleClear = () => {
        onSelect(undefined);
        close();
    };

    // Generate day name headers
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="bg-white rounded-lg shadow-lg p-4 w-[380px] border border-gray-200">
            {/* Preset date options */}
            <div className="flex justify-between mb-6">
                <div className="relative group">
                    <button
                        className="p-3 rounded-full hover:bg-gray-100"
                        onClick={handleToday}
                    >
                        <Icon name="sun" size={24} className="text-gray-500" />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Today
                    </div>
                </div>

                <div className="relative group">
                    <button
                        className="p-3 rounded-full hover:bg-gray-100"
                        onClick={handleTomorrow}
                    >
                        <Icon name="sunset" size={24} className="text-gray-500" />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Tomorrow
                    </div>
                </div>

                <div className="relative group">
                    <button
                        className="p-3 rounded-full hover:bg-gray-100"
                        onClick={handleNextWeek}
                    >
                        <div className="relative">
                            <Icon name="calendar" size={24} className="text-gray-500" />
                            <div className="absolute top-0 right-0 text-xs bg-gray-300 rounded-sm px-1 text-gray-700">+7</div>
                        </div>
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Next Week
                    </div>
                </div>

                <div className="relative group">
                    <button
                        className="p-3 rounded-full hover:bg-gray-100"
                        onClick={handleNextMonth}
                    >
                        <Icon name="moon" size={24} className="text-gray-500" />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        Next Month
                    </div>
                </div>
            </div>

            {/* Month header and navigation */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">{format(currentMonth, 'MMM yyyy')}</h2>
                <div className="flex">
                    <button
                        onClick={prevMonth}
                        className="mx-1 p-1 rounded-full hover:bg-gray-100"
                    >
                        <Icon name="chevron-left" size={20} className="text-gray-500" />
                    </button>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>
                    <button
                        onClick={nextMonth}
                        className="mx-1 p-1 rounded-full hover:bg-gray-100"
                    >
                        <Icon name="chevron-right" size={20} className="text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0 mb-6">
                {/* Day names */}
                {dayNames.map((day, i) => (
                    <div key={`header-${i}`} className="text-center text-gray-500 mb-2">
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {days.map((day, i) => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                        <div
                            key={`day-${i}`}
                            onClick={() => handleDateClick(day)}
                            className={`
                relative h-10 flex items-center justify-center cursor-pointer
                ${isSelected ? 'text-white' : isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}
              `}
                        >
                            {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                                </div>
                            )}
                            <span className="relative z-10">{format(day, 'd')}</span>
                        </div>
                    );
                })}
            </div>

            {/* Reminder, Repeat sections */}
            <div className="border-t pt-4">
                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center">
                        <Icon name="bell" size={20} className="text-gray-500 mr-2" />
                        <span className="text-gray-700">Reminder</span>
                    </div>
                    <Icon name="chevron-right" size={20} className="text-gray-400" />
                </div>

                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center">
                        <Icon name="refresh-cw" size={20} className="text-gray-500 mr-2" />
                        <span className="text-gray-700">Repeat</span>
                    </div>
                    <Icon name="chevron-right" size={20} className="text-gray-400" />
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex mt-4 gap-3">
                <button
                    onClick={handleClear}
                    className="w-1/2 py-3 border border-gray-300 rounded-md text-gray-600 font-medium"
                >
                    Clear
                </button>
                <button
                    onClick={handleConfirm}
                    className="w-1/2 py-3 bg-blue-500 text-white rounded-md font-medium"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default CustomDatePickerPopover;