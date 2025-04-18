// src/components/common/CustomDatePickerPopover.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { DayPicker, SelectSingleEventHandler, CustomComponents } from 'react-day-picker'; // Import SelectSingleEventHandler and CustomComponents
import { startOfDay, addDays, isSameDay, isValid } from '@/utils/dateUtils'; // Added isValid
import { enUS } from 'date-fns/locale';
import Button from './Button';
import Icon from './Icon';
import { twMerge } from 'tailwind-merge';
import { IconName } from "@/components/common/IconMap.tsx";

interface CustomDatePickerPopoverProps {
    initialDate: Date | undefined; // Date currently set on the task
    onSelect: (date: Date | undefined) => void; // Callback with Date or undefined for clearing
    close: () => void; // Function to close the popover
}

// Define the custom components type explicitly if needed, though often inferred
const customDayPickerComponents: Partial<CustomComponents> = {
    IconLeft: () => <Icon name="chevron-left" size={16} />,
    IconRight: () => <Icon name="chevron-right" size={16} />,
} as any;


const CustomDatePickerPopover: React.FC<CustomDatePickerPopoverProps> = ({
                                                                             initialDate,
                                                                             onSelect,
                                                                             close
                                                                         }) => {
    // Use initialDate for month only if it's valid, otherwise default to today
    const validInitialMonth = initialDate && isValid(initialDate) ? initialDate : new Date();
    const [currentMonth, setCurrentMonth] = useState(validInitialMonth);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);

    const today = useMemo(() => startOfDay(new Date()), []);
    const tomorrow = useMemo(() => startOfDay(addDays(today, 1)), [today]);
    const nextWeekDate = useMemo(() => startOfDay(addDays(today, 7)), [today]);

    // Handlers for quick select icons
    const handleQuickSelect = useCallback((type: 'today' | 'tomorrow' | 'nextWeek' | 'noDate') => {
        let dateToSelect: Date | undefined;
        switch (type) {
            case 'today': dateToSelect = today; break;
            case 'tomorrow': dateToSelect = tomorrow; break;
            case 'nextWeek': dateToSelect = nextWeekDate; break;
            case 'noDate': dateToSelect = undefined; break;
        }
        setSelectedDate(dateToSelect);
        onSelect(dateToSelect); // Immediately update parent on quick select
        close();
    }, [today, tomorrow, nextWeekDate, onSelect, close]);

    // Handler for DayPicker selection - Use correct type
    const handleDayPickerSelect: SelectSingleEventHandler = useCallback((day: Date | undefined) => {
        // day is Date | undefined directly from the component
        const newSelectedDay = day ? startOfDay(day) : undefined;
        setSelectedDate(newSelectedDay);
        // Don't close immediately, wait for OK/Clear or another quick select
    }, []);

    const handleOk = useCallback(() => {
        onSelect(selectedDate);
        close();
    }, [selectedDate, onSelect, close]);

    const handleClear = useCallback(() => {
        setSelectedDate(undefined);
        // No need to call onSelect here, as OK confirms the change.
        // If instant clear is desired, uncomment the line below.
        // onSelect(undefined);
        close();
    }, [close]); // Removed onSelect dependency if clear doesn't auto-save

    const handleMonthChange = (month: Date) => {
        setCurrentMonth(month);
    };

    // Render quick action icon buttons
    const renderQuickActionButton = (
        icon: IconName,
        label: string,
        action: () => void,
        isActive?: boolean
    ) => (
        <button
            type="button" // Explicitly set type
            onClick={action}
            className={twMerge(
                "flex flex-col items-center justify-center p-2 rounded-md transition-colors duration-150 ease-apple w-14 h-14", // Fixed size
                "hover:bg-black/10 active:bg-black/15",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground"
            )}
            aria-label={label}
            title={label}
            aria-pressed={isActive} // Add aria-pressed for accessibility
        >
            <Icon name={icon} size={20} className="mb-1"/>
            <span className="text-[10px] font-medium">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col w-[280px] bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 overflow-hidden">
            {/* Top Tabs (Static for now, Date is selected) */}
            <div className="flex border-b border-black/10 h-9">
                <button type="button" className="flex-1 text-sm font-medium text-center text-primary border-b-2 border-primary h-full flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50">
                    Date
                </button>
                <button type="button" className="flex-1 text-sm font-medium text-center text-muted-foreground h-full flex items-center justify-center hover:bg-black/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50">
                    Duration
                </button>
            </div>

            {/* Quick Select Icons */}
            <div className="flex justify-around p-2 border-b border-black/5">
                {renderQuickActionButton('sun', 'Today', () => handleQuickSelect('today'), selectedDate && isSameDay(selectedDate, today))}
                {renderQuickActionButton('sunset', 'Tomorrow', () => handleQuickSelect('tomorrow'), selectedDate && isSameDay(selectedDate, tomorrow))}
                {renderQuickActionButton('calendar-plus', '+7 Days', () => handleQuickSelect('nextWeek'), selectedDate && isSameDay(selectedDate, nextWeekDate))}
                {renderQuickActionButton('moon', 'No Date', () => handleQuickSelect('noDate'), selectedDate === undefined)}
            </div>

            {/* Calendar */}
            <div className="p-2">
                <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDayPickerSelect}
                    month={currentMonth}
                    onMonthChange={handleMonthChange}
                    showOutsideDays
                    fixedWeeks
                    locale={enUS}
                    // Custom class names to use Tailwind via index.css overrides
                    classNames={{
                        root: 'rdp-custom', // Add a root class for scoping overrides
                        caption: 'rdp-caption',
                        caption_label: 'rdp-caption_label',
                        nav: 'rdp-nav',
                        nav_button: 'rdp-nav_button',
                        // Ensure keys match expected types
                        button_previous: 'rdp-nav_button--prev',
                        button_next: 'rdp-nav_button--next',
                        table: 'rdp-table',
                        head_row: 'rdp-head_row',
                        head_cell: 'rdp-head_cell',
                        row: 'rdp-row',
                        cell: 'rdp-cell',
                        day: 'rdp-day',
                        day_today: 'rdp-day_today',
                        day_selected: 'rdp-day_selected',
                        day_outside: 'rdp-day_outside',
                        day_disabled: 'rdp-day_disabled',
                    }}
                    // Pass the explicitly typed components object
                    components={customDayPickerComponents}
                />
            </div>

            {/* Time / Reminder / Repeat (Static placeholders) */}
            <div className="border-t border-b border-black/10 text-sm">
                <button type="button" className="flex items-center justify-between w-full px-3 py-2 hover:bg-black/5 transition-colors focus:outline-none focus-visible:bg-black/5">
                    <span className="flex items-center text-gray-700">
                        <Icon name="clock" size={14} className="mr-2 opacity-70"/> Time
                    </span>
                    <Icon name="chevron-right" size={16} className="text-muted-foreground opacity-50"/>
                </button>
                <button type="button" className="flex items-center justify-between w-full px-3 py-2 border-t border-black/5 hover:bg-black/5 transition-colors focus:outline-none focus-visible:bg-black/5">
                    <span className="flex items-center text-gray-700">
                         <Icon name="bell" size={14} className="mr-2 opacity-70"/> Reminder
                    </span>
                    <Icon name="chevron-right" size={16} className="text-muted-foreground opacity-50"/>
                </button>
                <button type="button" className="flex items-center justify-between w-full px-3 py-2 border-t border-black/5 hover:bg-black/5 transition-colors focus:outline-none focus-visible:bg-black/5">
                     <span className="flex items-center text-gray-700">
                         <Icon name="refresh-cw" size={14} className="mr-2 opacity-70"/> Repeat
                     </span>
                    <Icon name="chevron-right" size={16} className="text-muted-foreground opacity-50"/>
                </button>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end p-2 space-x-2 bg-glass-alt-100 backdrop-blur-lg border-t border-black/10">
                <Button variant="glass" size="sm" onClick={handleClear}>
                    Clear
                </Button>
                <Button variant="primary" size="sm" onClick={handleOk}>
                    OK
                </Button>
            </div>
        </div>
    );
};

export default CustomDatePickerPopover;