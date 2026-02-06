import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { AppearanceSettings } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from '@/store';

// --- Default Settings ---
export type DarkModeOption = 'light' | 'dark' | 'system';

export const defaultAppearanceSettingsForApi = (): AppearanceSettings => ({
    themeId: 'default-coral',
    darkMode: 'system',
    interfaceDensity: 'default',
    textSize: 'default',
    fontWeight: 'light'
});

// --- Appearance Settings Atoms ---
const baseAppearanceSettingsAtom = atom<AppearanceSettings | null>(null);
export const appearanceSettingsLoadingAtom = atom<boolean>(false);
export const appearanceSettingsErrorAtom = atom<string | null>(null);

export const appearanceSettingsAtom: LocalDataAtom<AppearanceSettings> = atom(
    (get) => get(baseAppearanceSettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            set(baseAppearanceSettingsAtom, service.fetchSettings().appearance);
            return;
        }
        const currentSettings = get(baseAppearanceSettingsAtom) ?? defaultAppearanceSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AppearanceSettings) => AppearanceSettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updateAppearanceSettings(updatedSettings);
        set(baseAppearanceSettingsAtom, savedSettings);
    }
);
appearanceSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
