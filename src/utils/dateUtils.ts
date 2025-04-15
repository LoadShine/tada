// src/utils/dateUtils.ts
import {
    format as formatFns,
    isToday as isTodayFns,
    isYesterday as isYesterdayFns,
    isTomorrow as isTomorrowFns,
    isAfter,
    isBefore,
    startOfDay,
    endOfDay,
    addDays,
    parseISO,
    // fromUnixTime,
    isValid,
    differenceInCalendarDays,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { zhCN } from 'date-fns/locale'; // Import desired locales

// --- Configuration ---
const appLocale = zhCN; // Change to zhCN or others as needed
// ---

export const safeParseDate = (dateInput: Date | number | string | null | undefined): Date | null => {
    if (dateInput === null || dateInput === undefined) return null;

    let date: Date;
    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'number') {
        // Assume milliseconds since epoch if it's a large number, otherwise maybe seconds?
        // Be explicit: ALWAYS use milliseconds for internal timestamps.
        date = new Date(dateInput);
    } else {
        date = parseISO(dateInput);
    }

    return isValid(date) ? date : null;
};


export const formatDate = (dateInput: Date | number | null | undefined, formatString: string = 'P'): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';
    try {
        return formatFns(date, formatString, { locale: appLocale });
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return "Invalid Date";
    }
};

export const formatDateTime = (dateInput: Date | number | null | undefined): string => {
    return formatDate(dateInput, 'Pp'); // e.g., Sep 13, 2018, 12:00:00 AM
};

// Improved relative date formatting
export const formatRelativeDate = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';

    const dateDay = startOfDay(date);

    if (isTodayFns(dateDay)) return 'Today';
    if (isYesterdayFns(dateDay)) return 'Yesterday';
    if (isTomorrowFns(dateDay)) return 'Tomorrow';

    // Check for dates within the current week
    const today = startOfDay(new Date());
    const startOfCurrentWeek = startOfWeek(today, { locale: appLocale });
    const endOfCurrentWeek = endOfWeek(today, { locale: appLocale });

    if (isAfter(dateDay, startOfCurrentWeek) && isBefore(dateDay, endOfCurrentWeek)) {
        return formatDate(date, 'eee'); // e.g., 'Mon', 'Tue'
    }

    // Default to short format like 'MMM d' or 'MMM d, yyyy' if different year
    const currentYear = new Date().getFullYear();
    if (date.getFullYear() === currentYear) {
        return formatDate(date, 'MMM d'); // e.g., Sep 13
    } else {
        return formatDate(date, 'MMM d, yyyy'); // e.g., Sep 13, 2027
    }
};

export const getRelativeDateGroupTitle = (dateInput: Date | number | null | undefined): string => {
    const date = safeParseDate(dateInput);
    if (!date) return 'No Date';

    const dateDay = startOfDay(date);

    if (isTodayFns(dateDay)) return 'Today';
    if (isTomorrowFns(dateDay)) return 'Tomorrow';

    const today = startOfDay(new Date());
    const diffDays = differenceInCalendarDays(dateDay, today);

    if (diffDays > 1 && diffDays <= 7) {
        return formatDate(date, 'eeee'); // e.g., 'Monday'
    }

    // For dates further out or past (excluding today/yesterday/tomorrow)
    const currentYear = today.getFullYear();
    if (date.getFullYear() === currentYear) {
        return formatDate(date, 'eee, MMM d'); // e.g., Mon, Aug 15
    } else {
        return formatDate(date, 'eee, MMM d, yyyy'); // e.g., Mon, Aug 15, 2025
    }
};


export const isToday = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date ? isTodayFns(date) : false;
};

// Checks if the date is strictly within the *next* 7 days (excluding today)
export const isWithinUpcoming7Days = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    // const tomorrow = startOfDay(addDays(today, 1));
    const sevenDaysLater = endOfDay(addDays(today, 7)); // End of the 7th day from today

    // isAfter(date, today) ensures it's not today
    // isBefore(date, sevenDaysLater) ensures it's within the next 7 days range
    return isAfter(date, today) && isBefore(date, sevenDaysLater);
};

export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const today = startOfDay(new Date());
    // Compare start of the input date with start of today
    return isBefore(startOfDay(date), today);
};