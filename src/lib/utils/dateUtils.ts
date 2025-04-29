// src/lib/utils/dateUtils.ts
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
    subWeeks,
    addYears,
    subYears
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
        date = new Date(dateInput.getTime());
    } else if (typeof dateInput === 'number') {
        if (dateInput < -8640000000000000 || dateInput > 8640000000000000) return null;
        date = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        date = parseISO(dateInput);
        if (!isValidFns(date)) {
            date = new Date(dateInput);
        }
    } else {
        return null;
    }
    return isValidFns(date) ? date : null;
};

/** Checks if a given date object (or parsed input) is valid. */
export const isValid = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date !== null && isValidFns(date);
};

/** Formats a date using a specified format string (defaults to 'MMM d, yyyy'). */
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

/** Formats a date relative to today (e.g., 'Today', 'Tomorrow', 'Yesterday', 'Jul 20', 'Jul 20, 2023'). */
export const formatRelativeDate = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';
    const today = startOfDay(new Date());
    const inputDay = startOfDay(date);
    const diffDays = differenceInCalendarDays(inputDay, today);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 6) {
        return formatFns(date, 'EEEE', {locale: currentLocale});
    }
    const currentYear = today.getFullYear();
    const inputYear = inputDay.getFullYear();
    if (inputYear !== currentYear) {
        return formatDate(date, 'MMM d, yyyy');
    }
    return formatDate(date, 'MMM d');
};

/** Checks if a date is today. */
export const isToday = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date ? isTodayFns(date) : false;
};

/** Checks if a date is within the next 7 days (inclusive of today). */
export const isWithinNext7Days = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    const dateOnly = startOfDay(date);
    const sevenDaysFromTodayEnd = endOfDay(addDays(today, 6));
    return !isBefore(dateOnly, today) && !isAfter(dateOnly, sevenDaysFromTodayEnd);
};

/** Checks if a date is before today (overdue). */
export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today);
};

// Re-export necessary date-fns functions
export {
    formatFns as format,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay,
    startOfDay, endOfDay, isBefore, isAfter, addDays, subDays, addWeeks, subWeeks,
    differenceInCalendarDays,
    getMonth, getYear, setMonth, setYear, isWithinInterval,
    isTodayFns as isTodayFns, addYears, subYears
};
export {enUS};