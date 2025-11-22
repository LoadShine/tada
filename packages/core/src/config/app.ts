export interface ThemeColors {
    primary: string; // HSL string e.g., "3 76% 58%"
    light: string;   // HSL string e.g., "5 100% 89%"
    dark: string;    // HSL string e.g., "3 67% 47%"
}

export interface AppTheme {
    id: string;
    nameKey: string; // i18n key for the theme's display name
    colors: ThemeColors;
}

/**
 * Defines the available themes for the application.
 * Each theme provides HSL color values that are applied as CSS custom properties.
 */
export const APP_THEMES: AppTheme[] = [
    {
        id: 'default-coral',
        nameKey: 'theme.coralRed',
        colors: {
            primary: '3 76% 58%',
            light: '5 100% 89%',
            dark: '3 67% 47%',
        },
    },
    {
        id: 'ocean-blue',
        nameKey: 'theme.oceanBlue',
        colors: {
            primary: '207 82% 56%',
            light: '207 90% 88%',
            dark: '207 90% 40%',
        },
    },
    {
        id: 'forest-green',
        nameKey: 'theme.forestGreen',
        colors: {
            primary: '145 63% 40%',
            light: '145 63% 85%',
            dark: '145 63% 28%',
        },
    },
    {
        id: 'sunset-orange',
        nameKey: 'theme.sunsetOrange',
        colors: {
            primary: '24 94% 51%',
            light: '24 94% 88%',
            dark: '24 94% 35%',
        }
    },
    {
        id: 'royal-purple',
        nameKey: 'theme.royalPurple',
        colors: {
            primary: '262 68% 50%',
            light: '262 86% 88%',
            dark: '262 68% 36%',
        }
    },
    {
        id: 'graphite-grey',
        nameKey: 'theme.graphiteGrey',
        colors: {
            primary: '210 10% 40%',
            light: '210 10% 85%',
            dark: '210 10% 25%',
        }
    }
];

export const APP_VERSION = '0.0.1';

const getContentUrl = (path: string): string => {
    const baseUrl = import.meta.env.BASE_URL;
    return `${baseUrl}${path}`.replace(/\/+/g, '/');
};

export const loadChangelog = async (language: 'en' | 'zh-CN' = 'en'): Promise<string> => {
    try {
        const url = getContentUrl(`content/changelog.${language}.md`);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load changelog');
        return await response.text();
    } catch (error) {
        console.error('Error loading changelog:', error);
        return 'Failed to load changelog content.';
    }
};

export const loadPrivacyPolicy = async (language: 'en' | 'zh-CN' = 'en'): Promise<string> => {
    try {
        const url = getContentUrl(`content/privacy-policy.${language}.md`);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load privacy policy');
        return await response.text();
    } catch (error) {
        console.error('Error loading privacy policy:', error);
        return 'Failed to load privacy policy content.';
    }
};

export const loadTermsOfUse = async (language: 'en' | 'zh-CN' = 'en'): Promise<string> => {
    try {
        const url = getContentUrl(`content/terms-of-use.${language}.md`);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load terms of use');
        return await response.text();
    } catch (error) {
        console.error('Error loading terms of use:', error);
        return 'Failed to load terms of use content.';
    }
};