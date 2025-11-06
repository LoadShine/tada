import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { appearanceSettingsAtom, defaultAppearanceSettingsForApi, defaultPreferencesSettingsForApi, preferencesSettingsAtom } from '@/store/jotai';
import { APP_THEMES } from '@/config/app';
import { useTranslation } from 'react-i18next';

const SettingsApplicator: React.FC = () => {
    const loadedAppearance = useAtomValue(appearanceSettingsAtom);
    const loadedPreferences = useAtomValue(preferencesSettingsAtom);
    const { i18n } = useTranslation();

    const appearance = loadedAppearance ?? defaultAppearanceSettingsForApi();
    const preferences = loadedPreferences ?? defaultPreferencesSettingsForApi();

    useEffect(() => {
        const applyDarkMode = (mode: 'light' | 'dark' | 'system') => {
            if (mode === 'system') {
                const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', systemPrefersDark);
            } else {
                document.documentElement.classList.toggle('dark', mode === 'dark');
            }
        };
        applyDarkMode(appearance.darkMode);

        let mediaQueryListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | undefined;
        if (appearance.darkMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQueryListener = () => applyDarkMode('system');
            mediaQuery.addEventListener('change', mediaQueryListener);
        }

        const selectedTheme = APP_THEMES.find(theme => theme.id === appearance.themeId) || APP_THEMES[0];
        document.documentElement.style.setProperty('--color-primary-hsl', selectedTheme.colors.primary);
        document.documentElement.style.setProperty('--color-primary-light-hsl', selectedTheme.colors.light);
        document.documentElement.style.setProperty('--color-primary-dark-hsl', selectedTheme.colors.dark);

        document.documentElement.style.removeProperty('--app-background-image');
        document.documentElement.style.removeProperty('--app-background-filter');
        document.body.style.backgroundColor = '';


        return () => {
            if (mediaQueryListener && appearance && appearance.darkMode === 'system') {
                window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
            }
        };
    }, [appearance]);

    useEffect(() => {
        if (document.documentElement.lang !== preferences.language) {
            document.documentElement.lang = preferences.language;
        }
        if (i18n.language !== preferences.language) {
            i18n.changeLanguage(preferences.language);
        }
    }, [preferences, i18n]);

    return null;
};

SettingsApplicator.displayName = 'SettingsApplicator';
export default SettingsApplicator;