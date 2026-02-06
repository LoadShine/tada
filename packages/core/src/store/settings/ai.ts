import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { AISettings } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from '@/store';
import { aiConnectionStatusAtom } from '../ui';

// --- Default Settings ---
export const defaultAISettingsForApi = (): AISettings => ({
    provider: 'openai',
    apiKey: '',
    model: '',
    baseUrl: '',
    availableModels: [],
});

// --- AI Settings Atoms ---
const baseAISettingsAtom = atom<AISettings | null>(null);
export const aiSettingsLoadingAtom = atom<boolean>(false);
export const aiSettingsErrorAtom = atom<string | null>(null);

export const aiSettingsAtom: LocalDataAtom<AISettings> = atom(
    (get) => get(baseAISettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            const savedSettings = service.fetchSettings().ai;
            const defaultSettings = defaultAISettingsForApi();
            const mergedSettings: AISettings = {
                ...defaultSettings,
                ...savedSettings,
            };
            set(baseAISettingsAtom, mergedSettings);
            return;
        }
        const currentSettings = get(baseAISettingsAtom) ?? defaultAISettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AISettings | null) => AISettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updateAISettings(updatedSettings);
        set(baseAISettingsAtom, savedSettings);

        // Reset connection status to idle whenever settings change
        set(aiConnectionStatusAtom, 'idle');
    }
);
aiSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
