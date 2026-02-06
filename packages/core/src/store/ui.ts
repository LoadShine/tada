import { atom } from 'jotai';
import { SettingsTab, TaskFilter, ScheduledReportData } from '@/types';
import { Notification } from './types';

// --- UI State Atoms ---
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('appearance');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');
export const notificationsAtom = atom<Notification[]>([]);
export const isZenFullScreenAtom = atom<boolean>(false);
export const aiConnectionStatusAtom = atom<'idle' | 'success' | 'error'>('idle');

export const aiListAnalyzingTaskIdsAtom = atom<Set<string>>(new Set<string>());

// --- Scheduled Report Modal Atom ---
export const scheduledReportModalAtom = atom<ScheduledReportData | null>(null);

// --- Selected Report ID Atom ---
export const selectedEchoReportIdAtom = atom<string | null>(null);
export const selectedSummaryIdAtom = atom<string | null>(null);

// --- Notification Actions ---
export const addNotificationAtom = atom(
    null,
    (get, set, newNotification: Omit<Notification, 'id'>) => {
        const id = Date.now() + Math.random();
        set(notificationsAtom, (prev) => [...prev, { ...newNotification, id }]);
        setTimeout(() => {
            set(notificationsAtom, (prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }
);
