// src/utils/dateUtils.ts
import {
    format as formatFns,
    isToday as isTodayFns,
    isBefore,
    startOfDay,
    endOfDay,
    addDays,
    parseISO,
    isValid,
    differenceInCalendarDays,
    endOfWeek,
    startOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    getDay,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    addWeeks,
    subWeeks,
    subDays,
    // formatRelative, // Added for relative formatting
} from 'date-fns';
import { enUS } from 'date-fns/locale';

// Consistent locale
const currentLocale = enUS;

/** Safely parses various date inputs into a Date object */
export const safeParseDate = (dateInput: Date | number | string | null | undefined): Date | null => {
    if (dateInput === null || typeof dateInput === 'undefined') return null;
    let date: Date;
    if (dateInput instanceof Date) { date = dateInput; }
    else if (typeof dateInput === 'number') { date = new Date(dateInput); }
    else if (typeof dateInput === 'string') {
        date = parseISO(dateInput);
        if (!isValid(date)) { date = new Date(dateInput); }
    } else { return null; }
    return isValid(date) ? date : null;
};

/** Formats a date using a specified format string */
export const formatDate = (dateInput: Date | number | null | undefined, formatString: string = 'MMM d, yyyy'): string => {
    const date = safeParseDate(dateInput);
    if (!date || !isValid(date)) return '';
    try {
        return formatFns(date, formatString, { locale: currentLocale });
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return "Invalid Date";
    }
};

/** Formats a date and time */
export const formatDateTime = (dateInput: Date | number | null | undefined): string => {
    return formatDate(dateInput, 'MMM d, yyyy, h:mm a');
}

/** Formats a date relative to today (Today, Tomorrow, Yesterday, or specific date) */
export const formatRelativeDate = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date || !isValid(date)) return '';

    const today = startOfDay(new Date());
    const inputDay = startOfDay(date);
    const diffDays = differenceInCalendarDays(inputDay, today);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    // Fallback to standard date format if relative format is not desired or fails
    const currentYear = today.getFullYear();
    const inputYear = inputDay.getFullYear();
    if (inputYear !== currentYear) {
        return formatDate(date, 'MMM d, yyyy'); // e.g., Sep 13, 2023
    }
    return formatDate(date, 'MMM d'); // e.g., Sep 13
};

/** Checks if a date is today */
export const isToday = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date && isValid(date) ? isTodayFns(date) : false;
};

/** Checks if a date is within the next 7 days (inclusive of today) */
export const isWithinNext7Days = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date || !isValid(date)) return false;
    const today = startOfDay(new Date());
    const dateOnly = startOfDay(date); // Compare start of day
    const sevenDaysFromToday = addDays(today, 7);
    // Check if date is on or after today AND strictly before 7 days from today (start of day 8)
    return !isBefore(dateOnly, today) && isBefore(dateOnly, sevenDaysFromToday);
};

/** Checks if a date is before today (overdue) */
export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date || !isValid(date)) return false;
    const today = startOfDay(new Date());
    return isBefore(startOfDay(date), today); // Compare start of day
};

// Re-export necessary functions
export {
    formatFns as format,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay,
    startOfDay, endOfDay, isBefore, isValid, addDays, subDays, addWeeks, subWeeks,
    differenceInCalendarDays,
};
export { enUS };