import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { PreferencesSettings } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from '@/store';

// --- Default Settings ---
export type DefaultNewTaskDueDate = null | 'today' | 'tomorrow';

export const defaultPreferencesSettingsForApi = (): PreferencesSettings => ({
    language: 'zh-CN', defaultNewTaskDueDate: null, defaultNewTaskPriority: null,
    defaultNewTaskList: 'Inbox', confirmDeletions: true, zenModeShyNative: false,
    enableEcho: true, alwaysUseAITask: false,
    scheduleSettings: { enabled: false, time: '18:00', days: [1, 2, 3, 4, 5] } // default: Mon-Fri at 18:00
});

// --- Preferences Settings Atoms ---
const basePreferencesSettingsAtom = atom<PreferencesSettings | null>(null);
export const preferencesSettingsLoadingAtom = atom<boolean>(false);
export const preferencesSettingsErrorAtom = atom<string | null>(null);

export const preferencesSettingsAtom: LocalDataAtom<PreferencesSettings> = atom(
    (get) => get(basePreferencesSettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            set(basePreferencesSettingsAtom, service.fetchSettings().preferences);
            return;
        }
        const currentSettings = get(basePreferencesSettingsAtom) ?? defaultPreferencesSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: PreferencesSettings) => PreferencesSettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updatePreferencesSettings(updatedSettings);
        set(basePreferencesSettingsAtom, savedSettings);
    }
);
preferencesSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
