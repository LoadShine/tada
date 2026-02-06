import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { StoredSummary, Task } from '@/types';
import {
    endOfDay, isAfter, isBefore, isValid,
    safeParseDate, startOfDay, startOfMonth, startOfWeek, subDays, subMonths,
    subWeeks, endOfMonth, endOfWeek
} from '@/utils/dateUtils';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from './types';
import { tasksAtom } from './tasks';

// --- Summary Feature Types ---
export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };

// --- Summary Feature Atoms ---
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());
export const summarySelectedFutureTaskIdsAtom = atom<Set<string>>(new Set<string>());

const baseStoredSummariesAtom = atom<StoredSummary[] | null>(null);
export const storedSummariesLoadingAtom = atom<boolean>(false);
export const storedSummariesErrorAtom = atom<string | null>(null);

export const storedSummariesAtom: LocalDataAtom<StoredSummary[]> = atom(
    (get) => get(baseStoredSummariesAtom),
    (get, set, update) => {
        const service = storageManager.get();
        if (update === RESET) {
            set(baseStoredSummariesAtom, service.fetchSummaries());
            return;
        }
        const updatedSummaries = typeof update === 'function' ? (update as (prev: StoredSummary[] | null) => StoredSummary[])(get(baseStoredSummariesAtom) ?? []) : update;
        set(baseStoredSummariesAtom, updatedSummaries);
        service.updateSummaries(updatedSummaries);
    }
);
storedSummariesAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// --- Helper Functions ---
const getPeriodDates = (period: SummaryPeriodOption) => {
    const todayStart = startOfDay(new Date());
    switch (period) {
        case 'today': return { startDate: todayStart, endDate: endOfDay(todayStart) };
        case 'yesterday': return { startDate: startOfDay(subDays(todayStart, 1)), endDate: endOfDay(subDays(todayStart, 1)) };
        case 'thisWeek': return { startDate: startOfWeek(todayStart), endDate: endOfWeek(todayStart) };
        case 'lastWeek': return { startDate: startOfWeek(subWeeks(todayStart, 1)), endDate: endOfWeek(subWeeks(todayStart, 1)) };
        case 'thisMonth': return { startDate: startOfMonth(todayStart), endDate: endOfMonth(todayStart) };
        case 'lastMonth': return { startDate: startOfMonth(subMonths(todayStart, 1)), endDate: endOfMonth(subMonths(todayStart, 1)) };
        default:
            if (typeof period === 'object' && period.start && period.end) {
                return { startDate: startOfDay(new Date(period.start)), endDate: endOfDay(new Date(period.end)) };
            }
            return { startDate: null, endDate: null };
    }
};

// --- Derived Summary Atoms ---
export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);

    const { startDate, endDate } = getPeriodDates(period);
    if (!startDate || !endDate) return [];

    return allTasks.filter(task => {
        if (task.listName === 'Trash') return false;
        if (listFilter !== 'all' && task.listName !== listFilter) return false;
        const relevantDateTimestamp = task.completed && task.completedAt ? task.completedAt
            : !task.completed && task.dueDate ? task.dueDate
                : task.updatedAt;
        if (!relevantDateTimestamp) return false;

        const relevantDate = safeParseDate(relevantDateTimestamp);
        return relevantDate && isValid(relevantDate) && !isBefore(relevantDate, startDate) && !isAfter(relevantDate, endDate);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
});

export const futureTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const { endDate } = getPeriodDates(period);
    if (!endDate) return [];

    return allTasks.filter(task => {
        if (task.listName === 'Trash' || task.completed) return false;
        if (listFilter !== 'all' && task.listName !== listFilter) return false;
        if (!task.dueDate) return false;

        const dueDate = safeParseDate(task.dueDate);
        return dueDate && isValid(dueDate) && isAfter(dueDate, endDate);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
});

export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr = '';
    if (typeof period === 'string') {
        periodStr = period;
    } else if (period && typeof period === 'object' && period.start && period.end) {
        periodStr = `custom_${startOfDay(new Date(period.start)).getTime()}_${endOfDay(new Date(period.end)).getTime()}`;
    } else {
        periodStr = 'invalid_period';
    }
    const listStr = list;
    return `${periodStr}__${listStr}`;
});

export const relevantStoredSummariesAtom = atom<StoredSummary[]>((get) => {
    const allSummaries = get(storedSummariesAtom) ?? [];
    const filterKeyVal = get(currentSummaryFilterKeyAtom);
    if (filterKeyVal.startsWith('invalid_period')) return [];
    const [periodKey, listKey] = filterKeyVal.split('__');
    return allSummaries.filter(s => s.periodKey === periodKey && s.listKey === listKey).sort((a, b) => b.createdAt - a.createdAt);
});

export const currentDisplayedSummaryAtom = atom<StoredSummary | null>((get) => {
    const summaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    if (index === -1) return null;
    return summaries[index] ?? null;
});

export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const summary = get(currentDisplayedSummaryAtom);
    if (!summary) return [];
    const tasks = get(tasksAtom) ?? [];
    const ids = new Set(summary.taskIds);
    return tasks.filter(t => ids.has(t.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || (a.order ?? 0) - (b.order ?? 0));
});
