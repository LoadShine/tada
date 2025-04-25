// src/utils/dateUtils.ts
import {
    addDays,
    addMonths,
    addWeeks,
    differenceInCalendarDays,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format as formatFns,
    getDay,
    getMonth,
    getYear,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    isToday as isTodayFns,
    isValid as isValidFns,
    isWithinInterval,
    parseISO,
    setMonth,
    setYear,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks
} from 'date-fns';
import {enUS} from 'date-fns/locale'; // Use English locale

// Consistent locale for formatting
const currentLocale = enUS;

/**
 * Safely parses various date inputs (Date object, timestamp number, string) into a Date object.
 * Returns null if the input is invalid or cannot be parsed.
 * Performance: Relatively cheap operation.
 */
export const safeParseDate = (dateInput: Date | number | string | null | undefined): Date | null => {
    if (dateInput === null || typeof dateInput === 'undefined') return null;

    let date: Date;
    if (dateInput instanceof Date) {
        // Avoid mutation if it's already a Date object
        date = new Date(dateInput.getTime());
    } else if (typeof dateInput === 'number') {
        // Check for valid timestamp range (simple check)
        if (dateInput < -8640000000000000 || dateInput > 8640000000000000) return null;
        date = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        // Prioritize ISO parsing, fallback to Date constructor (which can be unreliable)
        date = parseISO(dateInput);
        if (!isValidFns(date)) {
            date = new Date(dateInput);
        }
    } else {
        return null; // Unsupported type
    }

    // Final check for validity
    return isValidFns(date) ? date : null;
};

/**
 * Checks if a given date object (or parsed input) is valid.
 * Performance: Very cheap.
 */
export const isValid = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date !== null && isValidFns(date);
};


/**
 * Formats a date using a specified format string (defaults to 'MMM d, yyyy').
 * Returns an empty string or 'Invalid Date' if the input is invalid.
 * Performance: Formatting can be noticeable if done excessively in loops. Memoize where possible in UI.
 */
export const formatDate = (dateInput: Date | number | null | undefined, formatString: string = 'MMM d, yyyy'): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';

    try {
        return formatFns(date, formatString, {locale: currentLocale});
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return "Invalid Date";
    }
};

/** Formats a date and time (e.g., 'Jul 20, 2024, 3:05 PM') */
export const formatDateTime = (dateInput: Date | number | null | undefined): string => {
    return formatDate(dateInput, 'MMM d, yyyy, h:mm a');
};

/**
 * Formats a date relative to today (e.g., 'Today', 'Tomorrow', 'Yesterday', 'Jul 20', 'Jul 20, 2023').
 * Performance: Involves date comparisons, slightly more expensive than simple format. Memoize in UI.
 */
export const formatRelativeDate = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';

    const today = startOfDay(new Date());
    const inputDay = startOfDay(date);
    const diffDays = differenceInCalendarDays(inputDay, today);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    // Check if it's within the next 6 days (after tomorrow)
    if (diffDays > 1 && diffDays <= 6) {
        return formatFns(date, 'EEEE', {locale: currentLocale}); // 'Monday', 'Tuesday', etc.
    }

    const currentYear = today.getFullYear();
    const inputYear = inputDay.getFullYear();
    if (inputYear !== currentYear) {
        return formatDate(date, 'MMM d, yyyy'); // Show year if different
    }
    return formatDate(date, 'MMM d'); // Otherwise, just month and day
};

/** Checks if a date is today. Performance: Cheap. */
export const isToday = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date ? isTodayFns(date) : false;
};

/**
 * Checks if a date is within the next 7 days (inclusive of today, up to 6 days from now).
 * Performance: Cheap date comparisons.
 */
export const isWithinNext7Days = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;

    const today = startOfDay(new Date());
    const dateOnly = startOfDay(date);
    // Calculate the end of the 7th day *from today* (which is 6 days ahead)
    const sevenDaysFromTodayEnd = endOfDay(addDays(today, 6));

    // Date must be on or after today AND on or before the end of the 7-day window.
    return !isBefore(dateOnly, today) && !isAfter(dateOnly, sevenDaysFromTodayEnd);
};

/**
 * Checks if a date is before today (overdue). Compares based on the start of the day.
 * Performance: Cheap date comparison.
 */
export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;

    const today = startOfDay(new Date());
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today);
};

// Re-export necessary date-fns functions for use in components
export {
    formatFns as format, // Re-export under original name
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay,
    startOfDay, endOfDay, isBefore, isAfter, addDays, subDays, addWeeks, subWeeks,
    differenceInCalendarDays,
    getMonth, getYear, setMonth, setYear, isWithinInterval,
    isTodayFns as isTodayFns, // Export original under different name if needed
};
export {enUS}; // Export locale if needed elsewhere