import {
    addDays,
    addHours,
    addMinutes,
    addMonths,
    addWeeks,
    differenceInCalendarDays,
    eachDayOfInterval,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format as formatFns,
    getDay,
    getHours,
    getMinutes,
    getMonth,
    getYear,
    isAfter,
    isBefore,
    isSameDay,
    isSameHour,
    isSameMinute,
    isSameMonth,
    isToday as isTodayFns,
    isValid as isValidFns,
    isWithinInterval,
    parseISO,
    setHours,
    setMinutes,
    setMonth,
    setSeconds,
    setYear,
    startOfDay,
    startOfHour,
    startOfMinute,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks
} from 'date-fns';
import {enUS, zhCN} from 'date-fns/locale';
import {TFunction} from "i18next";

// Helper to get date-fns locale object from language string
export const getLocale = (lang: 'en' | 'zh-CN' = 'en') => {
    switch (lang) {
        case 'zh-CN':
            return zhCN;
        case 'en':
        default:
            return enUS;
    }
};

/**
 * Safely parses various date inputs (Date object, timestamp number, string) into a Date object.
 * Returns null if the input is invalid or cannot be parsed.
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

/**
 * Checks if a given date object (or parsed input) is valid.
 */
export const isValid = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    return date !== null && isValidFns(date);
};

/**
 * Formats a date using a specified format string.
 */
export const formatDate = (
    dateInput: Date | number | null | undefined,
    formatString: string = 'MMM d, yyyy',
    lang: 'en' | 'zh-CN' = 'en'
): string => {
    const date = safeParseDate(dateInput)
    if (!date) return ''
    try {
        const locale = getLocale(lang);
        const fixedFormat = formatString.replace(/A/g, 'a')
        return formatFns(date, fixedFormat, { locale })
    } catch (e: any) {
        console.error('Error formatting date:', dateInput, e)
        return 'Invalid Date'
    }
}

/**
 * Formats a date and time. If time is midnight, it's considered "All day".
 */
export const formatDateTime = (dateInput: Date | number | null | undefined, lang: 'en' | 'zh-CN' = 'en'): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';
    if (getHours(date) === 0 && getMinutes(date) === 0) {
        return formatDate(date, 'MMM d, yyyy', lang);
    }
    return formatDate(date, 'MMM d, yyyy, h:mm a', lang);
};

/**
 * Formats a date relative to today. Optionally includes time.
 * If includeTimeIfSet is true and time is midnight, no time will be shown.
 */
export const formatRelativeDate = (
    dateInput: Date | number | null | undefined,
    t: TFunction,
    includeTimeIfSet: boolean = false,
    lang: 'en' | 'zh-CN' = 'en'
): string => {
    const date = safeParseDate(dateInput);
    if (!date) return '';

    const locale = getLocale(lang);
    const today = new Date();
    const inputDayStart = startOfDay(date);
    const todayDayStart = startOfDay(today);
    const diffDays = differenceInCalendarDays(inputDayStart, todayDayStart);

    let timeString = '';
    if (includeTimeIfSet && (getHours(date) !== 0 || getMinutes(date) !== 0)) {
        timeString = `, ${formatFns(date, 'h:mm a', {locale})}`;
    }

    if (diffDays === 0) return `${t('common.today')}${timeString}`;
    if (diffDays === 1) return `${t('common.tomorrow')}${timeString}`;
    if (diffDays === -1) return `Yesterday${timeString}`; // i18next can handle this via key "Yesterday"

    if (diffDays > 1 && diffDays <= 6) { // Within the current week (e.g. "Next Tuesday")
        return `${formatFns(date, 'EEEE', {locale})}${timeString}`;
    }

    // For dates further out or in different years
    const currentYear = today.getFullYear();
    const inputYear = inputDayStart.getFullYear();
    const yearFormat = (inputYear !== currentYear) ? ', yyyy' : '';

    return formatDate(date, `MMM d${yearFormat}${timeString}`, lang);
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

/**
 * Checks if a date (timestamp) is overdue.
 * Considers time: if a task has a specific time set for today and that time has passed, it's overdue.
 * If no time is set (implies midnight), it's overdue if the day is before today.
 */
export const isOverdue = (dateInput: Date | number | null | undefined): boolean => {
    const date = safeParseDate(dateInput);
    if (!date) return false;
    const now = new Date();
    if (isSameDay(date, now) && (getHours(date) !== 0 || getMinutes(date) !== 0)) {
        return isBefore(date, now);
    }
    return isBefore(startOfDay(date), startOfDay(now));
};

/**
 * Creates a new Date object with the time set from a given hour and minute.
 */
export const setTime = (date: Date, hours: number, minutes: number): Date => {
    return setSeconds(setMinutes(setHours(date, hours), minutes), 0);
};

// Re-export necessary date-fns functions
export {
    formatFns as format,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay,
    startOfDay, endOfDay, isBefore, isAfter, addDays, subDays, addWeeks, subWeeks,
    differenceInCalendarDays,
    getMonth, getYear, setMonth, setYear, isWithinInterval,
    isTodayFns as isTodayFns,
    parseISO,
    getHours, getMinutes, setHours, setMinutes, startOfHour, startOfMinute, addHours, addMinutes,
    isSameHour, isSameMinute
};
export {enUS, zhCN};