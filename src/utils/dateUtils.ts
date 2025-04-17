// src/utils/dateUtils.ts
import {
    format as formatFns, // Alias to avoid conflict
    isToday as isTodayFns,
    isBefore,
    startOfDay,
    endOfDay,
    addDays,
    parseISO,
    isValid,
    differenceInCalendarDays,
    endOfWeek, // Needed for CalendarView calculation
    startOfWeek, // Needed for CalendarView calculation
    eachDayOfInterval, // Needed for CalendarView calculation
    isSameMonth, // Needed for CalendarView calculation
    isSameDay, // Needed for CalendarView calculation
    getDay, // Needed for CalendarView calculation
    addMonths, // Needed for CalendarView calculation
    subMonths, // Needed for CalendarView calculation
    startOfMonth, // Needed for CalendarView calculation
    endOfMonth, // Needed for CalendarView calculation
} from 'date-fns';
import { enUS } from 'date-fns/locale';

// Consistent locale
const currentLocale = enUS;

/** Safely parses various date inputs into a Date object */
export const safeParseDate = (dateInput: Date | number | string | null | undefined): Date | null => {
    if (dateInput === null || typeof dateInput === 'undefined') return null;

    let date: Date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'number') {
        // Assuming the number is a timestamp in milliseconds
        date = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        // Try parsing ISO 8601 first, then fall back to general parsing
        date = parseISO(dateInput);
        if (!isValid(date)) {
            date = new Date(dateInput); // General fallback
        }
    } else {
        return null; // Unsupported type
    }

    return isValid(date) ? date : null;
};

/** Formats a date using a specified format string */
export const formatDate = (dateInput: Date | number | null | undefined, formatString: string = 'MMM d, yyyy'): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';
    try {
        return formatFns(date, formatString, { locale: currentLocale });
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return "Invalid Date";
    }
};

/** Formats a date and time */
export const formatDateTime = (dateInput: Date | number | null | undefined): string => {
    return formatDate(dateInput, 'MMM d, yyyy, h:mm a'); // e.g., Sep 13, 2024, 2:30 PM
}

/** Formats a date relative to today (Today, Tomorrow, Yesterday, or specific date) */
export const formatRelativeDate = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';

    const today = startOfDay(new Date());
    const inputDay = startOfDay(date);
    const diffDays = differenceInCalendarDays(inputDay, today);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    // Include year if the date is not in the current year
    const currentYear = today.getFullYear();
    const inputYear = inputDay.getFullYear();
    if (inputYear !== currentYear) {
        return formatDate(date, 'MMM d, yyyy'); // e.g., Sep 13, 2023
    }

    // Default to standard format for other dates within the current year
    return formatDate(date, 'MMM d'); // e.g., Sep 13
};

/** Checks if a date is today */
export const isToday = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date ? isTodayFns(date) : false;
};

/** Checks if a date is within the next 7 days (including today) */
export const isWithinNext7Days = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    const nextWeekEnd = endOfDay(addDays(today, 6)); // End of the 7th day from today

    // Check if the date is on or after today and before the end of the 7th day
    return !isBefore(startOfDay(date), today) && isBefore(startOfDay(date), addDays(nextWeekEnd, 1));
};


/** Checks if a date is before today (overdue) */
export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    // Compare the start of the input date with the start of today
    return isBefore(startOfDay(date), today);
};

// Re-export date-fns functions needed specifically by CalendarView for cleaner imports there
export {
    formatFns as format, // Rename to avoid conflict with our formatDate
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
    startOfDay,
    isBefore,
    isValid
};
export { enUS }; // Export locale for consistency