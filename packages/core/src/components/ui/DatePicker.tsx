import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    getHours,
    getMinutes,
    isSameDay,
    isSameMonth,
    isToday,
    isValid,
    setHours as setHoursFns,
    setMinutes as setMinutesFns,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths
} from '@/utils/dateUtils';
import Button from './Button';
import Icon from './Icon';

interface CustomDatePickerContentProps {
    initialDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    closePopover: () => void;
}

const CustomDatePickerContent: React.FC<CustomDatePickerContentProps> = React.memo(({
                                                                                        initialDate,
                                                                                        onSelect,
                                                                                        closePopover,
                                                                                    }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialDate && isValid(initialDate) ? startOfDay(initialDate) : today);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined);
    const formatTimeForValue = (date: Date): string => {
        const h = String(getHours(date)).padStart(2, '0');
        const m = String(getMinutes(date)).padStart(2, '0');
        return `${h}:${m}`;
    };
    const [selectedTimeValue, setSelectedTimeValue] = useState<string>(() => {
        if (initialDate && isValid(initialDate)) {
            if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0 && initialDate.getSeconds() === 0 && initialDate.getMilliseconds() === 0) return "allDay";
            return formatTimeForValue(initialDate);
        }
        return "allDay";
    });
    const contentRef = useRef<HTMLDivElement>(null);
    const {calendarDays} = useMemo(() => {
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(viewDate);
        const cStart = startOfWeek(mStart);
        const cEnd = endOfWeek(mEnd);
        return {calendarDays: eachDayOfInterval({start: cStart, end: cEnd})};
    }, [viewDate]);
    const timeOptions = useMemo(() => {
        const options: { label: string, value: string }[] = [{label: "All day", value: "allDay"}];
        for (let h = 0; h < 24; h++) {
            options.push({label: `${String(h).padStart(2, '0')}:00`, value: `${String(h).padStart(2, '0')}:00`});
            options.push({label: `${String(h).padStart(2, '0')}:30`, value: `${String(h).padStart(2, '0')}:30`});
        }
        return options;
    }, []);
    const prevMonth = useCallback(() => setViewDate(v => subMonths(v, 1)), []);
    const nextMonth = useCallback(() => setViewDate(v => addMonths(v, 1)), []);
    const goToTodayCalendarView = useCallback(() => {
        setViewDate(startOfDay(new Date()));
    }, []);
    const createQuickSelectHandler = useCallback((dateFn: () => Date, timeValue: string = "allDay") => () => {
        const date = startOfDay(dateFn());
        setSelectedDate(date);
        setSelectedTimeValue(timeValue);
        let finalDate = date;
        if (timeValue !== "allDay") {
            const [hours, minutes] = timeValue.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                finalDate = setMinutesFns(setHoursFns(finalDate, hours), minutes);
            }
        }
        onSelect(finalDate);
        closePopover();
    }, [onSelect, closePopover]);
    const selectToday = useMemo(() => createQuickSelectHandler(() => new Date(), "allDay"), [createQuickSelectHandler]);
    const selectTomorrow = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 1), "allDay"), [createQuickSelectHandler]);
    const selectNextWeek = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 7), "allDay"), [createQuickSelectHandler]);
    const selectNextMonth = useMemo(() => createQuickSelectHandler(() => addMonths(new Date(), 1), "allDay"), [createQuickSelectHandler]);
    const handleSelectDate = useCallback((date: Date) => {
        const dateStart = startOfDay(date);
        const isCurrentlySelected = selectedDate && isSameDay(dateStart, selectedDate);
        if (isCurrentlySelected) {
            setSelectedDate(undefined);
        } else {
            setSelectedDate(dateStart);
            if (selectedTimeValue === "allDay" && initialDate && isValid(initialDate) && isSameDay(dateStart, startOfDay(initialDate))) {
                if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0) setSelectedTimeValue("allDay"); else setSelectedTimeValue(formatTimeForValue(initialDate));
            } else if (selectedTimeValue === "allDay") {
                setSelectedTimeValue("allDay");
            }
        }
    }, [selectedDate, selectedTimeValue, initialDate]);
    const handleClearDate = useCallback(() => {
        setSelectedDate(undefined);
        setSelectedTimeValue("allDay");
        onSelect(undefined);
        closePopover();
    }, [onSelect, closePopover]);
    const handleConfirm = useCallback(() => {
        if (selectedDate) {
            let finalDate = startOfDay(selectedDate);
            if (selectedTimeValue !== "allDay") {
                const [hours, minutes] = selectedTimeValue.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    finalDate = setMinutesFns(setHoursFns(finalDate, hours), minutes);
                }
            }
            onSelect(finalDate);
        } else {
            onSelect(undefined);
        }
        closePopover();
    }, [selectedDate, selectedTimeValue, onSelect, closePopover]);
    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);
    useEffect(() => {
        const validInitial = initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined;
        setSelectedDate(validInitial);
        setViewDate(validInitial ?? today);
        if (initialDate && isValid(initialDate)) {
            if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0 && initialDate.getSeconds() === 0 && initialDate.getMilliseconds() === 0) setSelectedTimeValue("allDay"); else setSelectedTimeValue(formatTimeForValue(initialDate));
        } else {
            setSelectedTimeValue("allDay");
        }
    }, [initialDate, today]);
    const displaySelectedTimeLabel = useMemo(() => {
        if (selectedTimeValue === "allDay") return "All day";
        return selectedTimeValue;
    }, [selectedTimeValue]);

    const timeDropdownAnimationClasses = "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide";
    const dropdownContentClasses = twMerge(
        "min-w-[100px] max-h-60 styled-scrollbar-thin overflow-y-auto z-[75] bg-white rounded-base shadow-modal p-1",
        "dark:bg-neutral-750 dark:border dark:border-neutral-600", // Dark mode for dropdown content
        timeDropdownAnimationClasses
    );
    const tooltipContentClass = "text-[11px] bg-grey-dark text-white px-2 py-1 rounded-base shadow-md select-none z-[80] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut dark:bg-neutral-900 dark:text-neutral-100";

    return (
        <div ref={contentRef}
             className="date-picker-content p-4 w-[300px] bg-white dark:bg-neutral-800 rounded-base" // Dark mode for main popover
             onClick={e => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
             onTouchStart={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-4 px-2">
                {[{handler: selectToday, icon: "sun" as const, label: "Today"}, {
                    handler: selectTomorrow,
                    icon: "sunset" as const,
                    label: "Tomorrow"
                }, {
                    handler: selectNextWeek,
                    icon: "calendar" as const,
                    label: "+7 Days",
                    badge: "+7"
                }, {handler: selectNextMonth, icon: "moon" as const, label: "Next Month"}].map(item => (
                    <Tooltip.Provider key={item.label}><Tooltip.Root delayDuration={200}> <Tooltip.Trigger asChild>
                        <button onClick={item.handler}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-grey-ultra-light dark:hover:bg-neutral-700 transition-colors"
                                aria-label={`Select ${item.label}`}> {item.badge ? (
                            <div className="relative"><Icon name={item.icon} size={18} strokeWidth={1}
                                                            className="text-grey-medium dark:text-neutral-400"/>
                                <div
                                    className="absolute top-0 right-0 -mt-1 -mr-1 bg-grey-medium dark:bg-neutral-500 text-white dark:text-neutral-100 text-[8px] font-normal rounded-full w-3.5 h-3.5 flex items-center justify-center">{item.badge}</div>
                            </div>) : (
                            <Icon name={item.icon} size={18} strokeWidth={1}
                                  className="text-grey-medium dark:text-neutral-400"/>)} </button>
                    </Tooltip.Trigger> <Tooltip.Portal><Tooltip.Content className={tooltipContentClass}
                                                                        sideOffset={4}>{item.label}<Tooltip.Arrow
                        className="fill-grey-dark dark:fill-neutral-900"/></Tooltip.Content></Tooltip.Portal>
                    </Tooltip.Root></Tooltip.Provider>))}
            </div>
            <div className="flex items-center justify-between mb-3">
                <div
                    className="text-[14px] font-normal text-grey-dark dark:text-neutral-100">{format(viewDate, 'MMMM yyyy')}</div>
                <div className="flex items-center space-x-0.5">
                    <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left"
                            className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                            iconProps={{size: 16, strokeWidth: 1}} aria-label="Previous month"/>
                    <Button onClick={goToTodayCalendarView} variant="ghost" size="icon" className="w-7 h-7"
                            aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary dark:bg-primary-light" : "bg-grey-light dark:bg-neutral-600")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                            className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                            iconProps={{size: 16, strokeWidth: 1}} aria-label="Next month"/>
                </div>
            </div>
            <div className="mb-3">
                <div className="grid grid-cols-7 mb-1"> {weekDays.map((day, i) => (<div key={i}
                                                                                        className="text-center text-[11px] text-grey-medium dark:text-neutral-400 h-8 flex items-center justify-center font-normal">{day}</div>))} </div>
                <div className="grid grid-cols-7 gap-0">
                    {calendarDays.map((day, i) => {
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isDaySelected = selectedDate && isSameDay(day, selectedDate);
                        const isDayToday = isToday(day);
                        return (<button key={i} onClick={() => handleSelectDate(day)}
                                        className={twMerge(
                                            "h-8 w-8 flex items-center justify-center rounded-full text-[13px] font-light transition-colors mx-auto",
                                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:z-10",
                                            !isCurrentMonth && "text-grey-light dark:text-neutral-600",
                                            isCurrentMonth && "hover:bg-grey-ultra-light dark:hover:bg-neutral-700",
                                            isDayToday && !isDaySelected && "font-normal text-primary dark:text-primary-light border border-primary/50 dark:border-primary-light/50",
                                            !isDayToday && isCurrentMonth && !isDaySelected && "text-grey-dark dark:text-neutral-100",
                                            isDaySelected && "bg-primary text-white dark:bg-primary-light dark:text-grey-deep font-normal hover:bg-primary-dark dark:hover:bg-primary",
                                            !isCurrentMonth && "pointer-events-none opacity-50")}
                                        aria-label={format(day, 'MMMM d, yyyy')} aria-pressed={!!isDaySelected}
                                        disabled={!isCurrentMonth}> {format(day, 'd')} </button>);
                    })}
                </div>
            </div>
            <div
                className="flex items-center justify-between mb-3 pt-3 border-t border-grey-light dark:border-neutral-700">
                <label htmlFor="time-picker-trigger-single-date"
                       className="text-[13px] font-light text-grey-dark dark:text-neutral-100">Time</label>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <Button id="time-picker-trigger-single-date" variant="secondary" size="sm"
                                className="min-w-[90px] !h-7 !px-2.5 !font-light justify-between items-center text-grey-dark dark:text-neutral-100 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 dark:bg-neutral-700"
                                disabled={!selectedDate}>
                            <span className="tabular-nums">{displaySelectedTimeLabel}</span> <Icon name="chevron-down"
                                                                                                   size={12}
                                                                                                   strokeWidth={1.5}
                                                                                                   className="ml-1 opacity-80 text-grey-medium dark:text-neutral-400"/>
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className={dropdownContentClasses}
                            sideOffset={5}
                            align="end"
                            onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                            <DropdownMenu.RadioGroup value={selectedTimeValue} onValueChange={setSelectedTimeValue}>
                                {timeOptions.map(option => (
                                    <DropdownMenu.RadioItem key={option.value} value={option.value}
                                                            className={twMerge(
                                                                "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-[13px] font-light outline-none transition-colors data-[disabled]:pointer-events-none h-7 tabular-nums",
                                                                "focus:bg-grey-ultra-light dark:focus:bg-neutral-600 data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-600",
                                                                "data-[state=checked]:bg-primary-light data-[state=checked]:text-primary dark:data-[state=checked]:bg-primary-dark/30 dark:data-[state=checked]:text-primary-light data-[state=checked]:font-normal",
                                                                "data-[highlighted]:data-[state=checked]:bg-primary-light dark:data-[highlighted]:data-[state=checked]:bg-primary-dark/40",
                                                                "data-[state=unchecked]:text-grey-dark dark:data-[state=unchecked]:text-neutral-100 data-[highlighted]:data-[state=unchecked]:text-grey-dark dark:data-[highlighted]:data-[state=unchecked]:text-neutral-50"
                                                            )}>{option.label}</DropdownMenu.RadioItem>))}
                            </DropdownMenu.RadioGroup>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>
            <div className="flex space-x-2 mt-1">
                <Button variant="secondary" size="md" className="flex-1 justify-center"
                        onClick={handleClearDate}> Clear </Button>
                <Button variant="primary" size="md" className="flex-1 justify-center" onClick={handleConfirm}
                        disabled={!selectedDate}> OK </Button>
            </div>
        </div>
    );
});
CustomDatePickerContent.displayName = 'CustomDatePickerContent';
export {CustomDatePickerContent};
export default CustomDatePickerContent;