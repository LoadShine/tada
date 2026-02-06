import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { ProxySettings } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from '@/store';

// --- Default Settings ---
export const defaultProxySettingsForApi = (): ProxySettings => ({
    enabled: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890,
    auth: false,
    username: '',
    password: ''
});

// --- Proxy Settings Atoms ---
const baseProxySettingsAtom = atom<ProxySettings | null>(null);

export const proxySettingsAtom: LocalDataAtom<ProxySettings> = atom(
    (get) => get(baseProxySettingsAtom),
    (get, set, newSettingsParam) => {
        const service = storageManager.get();
        if (newSettingsParam === RESET) {
            const settings = service.fetchSettings();
            // Fallback for storage services that might not return proxy yet
            const savedSettings = (settings as any).proxy;
            const defaultSettings = defaultProxySettingsForApi();
            const mergedSettings: ProxySettings = {
                ...defaultSettings,
                ...savedSettings,
            };
            set(baseProxySettingsAtom, mergedSettings);
            return;
        }
        const currentSettings = get(baseProxySettingsAtom) ?? defaultProxySettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: ProxySettings | null) => ProxySettings)(currentSettings) : newSettingsParam;

        const savedSettings = service.updateProxySettings(updatedSettings);
        set(baseProxySettingsAtom, savedSettings);
    }
);
proxySettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
