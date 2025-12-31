import React, {memo, useCallback, useMemo, useState, useEffect} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    addNotificationAtom,
    aiConnectionStatusAtom,
    aiSettingsAtom,
    appearanceSettingsAtom,
    DarkModeOption,
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    DefaultNewTaskDueDate,
    defaultPreferencesSettingsForApi,
    isSettingsOpenAtom,
    preferencesSettingsAtom,
    settingsSelectedTabAtom,
    userListNamesAtom,
} from '@/store/jotai.ts';
import {AISettings as AISettingsType, SettingsTab} from '@/types';
import Icon from '@/components/ui/Icon.tsx';
import Button from '@/components/ui/Button.tsx';
import ModelCombobox from '@/components/ui/ModelCombobox.tsx';
import {twMerge} from 'tailwind-merge';
import {IconName} from "@/components/ui/IconMap.ts";
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as RadixSwitch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    APP_THEMES,
    APP_VERSION,
    loadChangelog,
    loadPrivacyPolicy,
    loadTermsOfUse
} from '@/config/app.ts';
import {useTranslation} from "react-i18next";
import {AIProvider, AI_PROVIDERS} from "@/config/aiProviders";
import {fetchProviderModels, testConnection, isAIConfigValid} from "@/services/aiService";
import DataSettings from './DataSettings';
import { Link } from 'react-router-dom';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SettingsItem {
    id: SettingsTab;
    labelKey: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    {id: 'appearance', labelKey: 'settings.appearance.title', icon: 'settings'},
    {id: 'preferences', labelKey: 'settings.preferences.title', icon: 'sliders'},
    {id: 'ai', labelKey: 'settings.ai.title', icon: 'sparkles'},
    {id: 'data', labelKey: 'settings.data.title', icon: 'hard-drive'},
    {id: 'about', labelKey: 'settings.about.title', icon: 'info'},
];

/**
 * A generic row component for settings pages, providing a consistent layout
 * for a label, description, and an action/control area.
 */
const SettingsRow: React.FC<{
    label: string,
    value?: React.ReactNode,
    action?: React.ReactNode,
    children?: React.ReactNode,
    description?: string,
    htmlFor?: string,
}> = memo(({label, value, action, children, description, htmlFor}) => (
    <div className="flex justify-between items-center py-3 min-h-[48px]">
        <div className="flex-1 mr-4">
            <label htmlFor={htmlFor}
                   className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal block cursor-default">{label}</label>
            {description &&
                <p className="text-[11px] text-grey-medium dark:text-neutral-400 mt-0.5 font-light">{description}</p>}
        </div>
        <div
            className="text-[13px] text-grey-dark dark:text-neutral-200 font-light flex items-center space-x-2 flex-shrink-0">
            {value && !action && !children &&
                <span className="text-grey-medium dark:text-neutral-300 text-right font-normal">{value}</span>}
            {action && !children && <div className="flex justify-end">{action}</div>}
            {children && <div className="flex justify-end items-center space-x-2">{children}</div>}
        </div>
    </div>
));
SettingsRow.displayName = 'SettingsRow';

/**
 * A radio group component for selecting the dark mode preference (Light, Dark, System).
 */
const DarkModeSelector: React.FC<{ value: DarkModeOption; onChange: (value: DarkModeOption) => void; }> = memo(({
                                                                                                                    value,
                                                                                                                    onChange
                                                                                                                }) => {
    const {t} = useTranslation();
    const options: { value: DarkModeOption; label: string; icon: IconName }[] = [
        {value: 'light', label: t('settings.appearance.darkModeOptions.light'), icon: 'sun'},
        {value: 'dark', label: t('settings.appearance.darkModeOptions.dark'), icon: 'moon'},
        {value: 'system', label: t('settings.appearance.darkModeOptions.system'), icon: 'settings'},
    ];

    return (
        <RadioGroup.Root
            value={value}
            onValueChange={onChange}
            className="flex space-x-1 p-0.5 bg-grey-ultra-light dark:bg-neutral-700 rounded-base"
            aria-label="Appearance mode"
        >
            {options.map(option => (
                <RadioGroup.Item
                    key={option.value}
                    value={option.value}
                    id={`darkMode-${option.value}`}
                    className={twMerge(
                        "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        value === option.value
                            ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm"
                            : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                    )}
                >
                    <Icon name={option.icon} size={14} strokeWidth={1.5} className="mr-1.5 opacity-80"/>
                    {option.label}
                </RadioGroup.Item>
            ))}
        </RadioGroup.Root>
    );
});
DarkModeSelector.displayName = 'DarkModeSelector';

/**
 * A circular color swatch button for theme selection.
 */
const ColorSwitch: React.FC<{
    colorValue: string;
    selected: boolean;
    onClick: () => void;
    themeName: string;
}> = memo(({colorValue, selected, onClick, themeName}) => (
    <button
        type="button"
        onClick={onClick}
        className={twMerge(
            "w-7 h-7 rounded-full border-2 transition-all duration-150 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep",
            selected ? "ring-2 ring-offset-1 ring-current" : "border-transparent hover:border-grey-medium/50 dark:hover:border-neutral-400/50"
        )}
        style={{backgroundColor: `hsl(${colorValue})`, borderColor: selected ? `hsl(${colorValue})` : undefined}}
        aria-label={`Select ${themeName} theme`}
        aria-pressed={selected}
    />
));
ColorSwitch.displayName = 'ColorSwitch';

const defaultAppearanceSettingsFromAtoms = defaultAppearanceSettingsForApi();

/**
 * Settings panel for managing application appearance, including dark mode and theme color.
 */
const AppearanceSettings: React.FC = memo(() => {
    const {t} = useTranslation();
    const [appearance, setAppearance] = useAtom(appearanceSettingsAtom);

    if (!appearance) {
        return <div className="p-4 text-center text-grey-medium">Loading appearance settings...</div>;
    }

    const currentAppearance = appearance ?? defaultAppearanceSettingsFromAtoms;

    const handleThemeChange = (themeId: string) => setAppearance(s => ({
        ...(s ?? defaultAppearanceSettingsFromAtoms),
        themeId
    }));
    const handleDarkModeChange = (mode: DarkModeOption) => setAppearance(s => ({
        ...(s ?? defaultAppearanceSettingsFromAtoms),
        darkMode: mode
    }));

    return (
        <div className="space-y-6">
            <SettingsRow label={t('settings.appearance.mode')} description={t('settings.appearance.modeDescription')}>
                <DarkModeSelector value={currentAppearance.darkMode} onChange={handleDarkModeChange}/>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow label={t('settings.appearance.themeColor')}
                         description={t('settings.appearance.themeColorDescription')}>
                <div className="flex space-x-2">
                    {APP_THEMES.map(theme => (
                        <ColorSwitch
                            key={theme.id}
                            colorValue={theme.colors.primary}
                            selected={currentAppearance.themeId === theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            themeName={t(theme.nameKey)}
                        />
                    ))}
                </div>
            </SettingsRow>
        </div>
    );
});
AppearanceSettings.displayName = 'AppearanceSettings';

const defaultPreferencesFromAtoms = defaultPreferencesSettingsForApi();

/**
 * A reusable helper function to render a Radix Select component.
 */
const renderSelect = (id: string, value: string | null, onChange: (value: string) => void, options: {
    value: string,
    label: string
}[], placeholder: string, triggerClassName?: string, viewportClassName?: string, disabled?: boolean) => (
    <Select.Root value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
            id={id}
            className={twMerge(
                "flex items-center justify-between w-[160px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 hover:bg-grey-light dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                disabled && "opacity-50 cursor-not-allowed",
                triggerClassName
            )}
            aria-label={placeholder}
        >
            <Select.Value placeholder={placeholder}/>
            <Select.Icon className="text-grey-medium dark:text-neutral-400">
                <Icon name="chevron-down" size={14} strokeWidth={1.5}/>
            </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
            <Select.Content
                className="z-[60] min-w-[160px] bg-white dark:bg-neutral-750 rounded-base shadow-popover p-1 overflow-hidden animate-popoverShow"
                position="popper" sideOffset={5}
            >
                <Select.Viewport className={twMerge(viewportClassName)}>
                    {options.map(opt => (
                        <Select.Item
                            key={opt.value}
                            value={opt.value}
                            className="relative flex items-center h-7 px-3 text-[13px] font-light rounded-[4px] select-none cursor-pointer data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-600 data-[highlighted]:outline-none text-grey-dark dark:text-neutral-100 data-[state=checked]:text-primary dark:data-[state=checked]:text-primary-light"
                        >
                            <Select.ItemText>{opt.label}</Select.ItemText>
                            <Select.ItemIndicator className="absolute right-2">
                                <Icon name="check" size={12} strokeWidth={2}/>
                            </Select.ItemIndicator>
                        </Select.Item>
                    ))}
                </Select.Viewport>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
);

/**
 * Settings panel for managing user preferences like language and default task properties.
 */
const PreferencesSettings: React.FC = memo(() => {
    const {t} = useTranslation();
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);
    const aiSettings = useAtomValue(aiSettingsAtom);
    const userLists = useAtomValue(userListNamesAtom) ?? [];

    const isAIConfigured = useMemo(() => isAIConfigValid(aiSettings), [aiSettings]);

    if (!preferences) {
        return <div className="p-4 text-center text-grey-medium">Loading preferences...</div>;
    }
    const currentPreferences = preferences ?? defaultPreferencesFromAtoms;

    // Effect to auto-disable "Always Use AI Task" if AI is not configured
    useEffect(() => {
        if (!isAIConfigured && currentPreferences.alwaysUseAITask) {
            setPreferences(p => ({
                ...(p ?? defaultPreferencesFromAtoms),
                alwaysUseAITask: false
            }));
        }
    }, [isAIConfigured, currentPreferences.alwaysUseAITask, setPreferences]);

    const handleLanguageChange = (value: string) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        language: value as 'en' | 'zh-CN'
    }));
    const handleDefaultDueDateChange = (value: string) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        defaultNewTaskDueDate: value === 'none' ? null : value as DefaultNewTaskDueDate
    }));
    const handleDefaultPriorityChange = (value: string) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        defaultNewTaskPriority: value === 'none' ? null : parseInt(value, 10)
    }));
    const handleDefaultListChange = (value: string) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        defaultNewTaskList: value
    }));
    const handleConfirmDeletionsChange = (checked: boolean) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        confirmDeletions: checked
    }));
    const handleEchoToggle = (checked: boolean) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        enableEcho: checked
    }));
    const handleAlwaysUseAITaskToggle = (checked: boolean) => setPreferences(p => ({
        ...(p ?? defaultPreferencesFromAtoms),
        alwaysUseAITask: checked
    }));

    const dueDateOptions = [
        {value: 'none', label: t('settings.preferences.dueDateOptions.none')},
        {value: 'today', label: t('settings.preferences.dueDateOptions.today')},
        {value: 'tomorrow', label: t('settings.preferences.dueDateOptions.tomorrow')},
    ];
    const priorityOptions = [
        {value: 'none', label: t('settings.preferences.priorityOptions.none')},
        {value: '1', label: t('settings.preferences.priorityOptions.1')},
        {value: '2', label: t('settings.preferences.priorityOptions.2')},
        {value: '3', label: t('settings.preferences.priorityOptions.3')},
    ];
    const listOptions = useMemo(() => {
        return userLists.map(l => ({
            value: l,
            label: l === 'Inbox' ? t('sidebar.inbox') : l
        }));
    }, [userLists, t]);

    const tooltipContentClass = "text-[11px] bg-grey-dark dark:bg-neutral-900 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[60] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    return (
        <div className="space-y-0">
            <SettingsRow label={t('settings.preferences.language')}
                         description={t('settings.preferences.languageDescription')}
                         htmlFor="languageSelect">
                {renderSelect('languageSelect', currentPreferences.language, handleLanguageChange, [
                    {value: 'en', label: t('settings.preferences.languages.en')},
                    {value: 'zh-CN', label: t('settings.preferences.languages.zh-CN')}
                ], "Select Language")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.defaultDueDate')}
                         description={t('settings.preferences.defaultDueDateDescription')}
                         htmlFor="defaultDueDateSelect">
                {renderSelect('defaultDueDateSelect', currentPreferences.defaultNewTaskDueDate, handleDefaultDueDateChange, dueDateOptions, "Select Due Date")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.defaultPriority')}
                         description={t('settings.preferences.defaultPriorityDescription')}
                         htmlFor="defaultPrioritySelect">
                {renderSelect('defaultPrioritySelect', currentPreferences.defaultNewTaskPriority?.toString() ?? 'none', handleDefaultPriorityChange, priorityOptions, "Select Priority")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.defaultList')}
                         description={t('settings.preferences.defaultListDescription')}
                         htmlFor="defaultListSelect">
                {renderSelect('defaultListSelect', currentPreferences.defaultNewTaskList, handleDefaultListChange, listOptions, "Select List")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.confirmDeletions')}
                         description={t('settings.preferences.confirmDeletionsDescription')}
                         htmlFor="confirmDeletionsToggle">
                <RadixSwitch.Root
                    id="confirmDeletionsToggle"
                    checked={currentPreferences.confirmDeletions}
                    onCheckedChange={handleConfirmDeletionsChange}
                    aria-label="Toggle confirm deletions"
                    className={twMerge(
                        "custom-switch-track",
                        currentPreferences.confirmDeletions ? "custom-switch-track-on" : "custom-switch-track-off"
                    )}
                >
                    <RadixSwitch.Thumb
                        className={twMerge("custom-switch-thumb", currentPreferences.confirmDeletions ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}/>
                </RadixSwitch.Root>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.enableEcho')}
                         description={t('settings.preferences.enableEchoDescription')}
                         htmlFor="echoToggle">
                <RadixSwitch.Root
                    id="echoToggle"
                    checked={currentPreferences.enableEcho}
                    onCheckedChange={handleEchoToggle}
                    aria-label="Toggle echo feature"
                    className={twMerge(
                        "custom-switch-track",
                        currentPreferences.enableEcho ? "custom-switch-track-on" : "custom-switch-track-off"
                    )}
                >
                    <RadixSwitch.Thumb
                        className={twMerge("custom-switch-thumb", currentPreferences.enableEcho ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}/>
                </RadixSwitch.Root>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.preferences.alwaysUseAITask')}
                         description={t('settings.preferences.alwaysUseAITaskDescription')}
                         htmlFor="alwaysUseAITaskToggle">
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={0}>
                        <Tooltip.Trigger asChild>
                            <div className="inline-flex">
                                <RadixSwitch.Root
                                    id="alwaysUseAITaskToggle"
                                    checked={currentPreferences.alwaysUseAITask}
                                    onCheckedChange={handleAlwaysUseAITaskToggle}
                                    disabled={!isAIConfigured}
                                    aria-label="Toggle always use AI task"
                                    className={twMerge(
                                        "custom-switch-track",
                                        currentPreferences.alwaysUseAITask ? "custom-switch-track-on" : "custom-switch-track-off",
                                        !isAIConfigured && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <RadixSwitch.Thumb
                                        className={twMerge("custom-switch-thumb", currentPreferences.alwaysUseAITask ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}/>
                                </RadixSwitch.Root>
                            </div>
                        </Tooltip.Trigger>
                        {!isAIConfigured && (
                            <Tooltip.Portal>
                                <Tooltip.Content className={tooltipContentClass} side="left" sideOffset={5}>
                                    {t('settings.preferences.alwaysUseAITaskDisabledHint')}
                                    <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        )}
                    </Tooltip.Root>
                </Tooltip.Provider>
            </SettingsRow>
        </div>
    );
});
PreferencesSettings.displayName = 'PreferencesSettings';

/**
 * A selectable card representing an AI provider.
 */
const ProviderCard: React.FC<{
    provider: AIProvider;
    isSelected: boolean;
    onClick: () => void;
}> = memo(({ provider, isSelected, onClick }) => {
    const { t } = useTranslation();

    return (
        <button
            onClick={onClick}
            className={twMerge(
                "flex items-center px-3 py-2 rounded-lg border transition-all duration-200 w-full h-11",
                isSelected
                    ? "border-primary dark:border-primary-light bg-primary/5 dark:bg-primary-dark/20"
                    : "border-grey-light dark:border-neutral-600 hover:border-grey-medium dark:hover:border-neutral-500 hover:bg-grey-ultra-light dark:hover:bg-neutral-700/50"
            )}
        >
            <div className="w-6 h-6 mr-3 flex items-center justify-center flex-shrink-0">
                <img
                    src={`icons/ai-providers/${provider.id}.png`}
                    alt={t(provider.nameKey)}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                        // Fallback to generic AI icon if provider icon is missing
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
                <Icon
                    name="sparkles"
                    size={20}
                    className={twMerge(
                        "hidden",
                        isSelected ? "text-primary dark:text-primary-light" : "text-grey-medium dark:text-neutral-400"
                    )}
                />
            </div>
            <span className={twMerge(
                "text-[13px] font-medium truncate",
                isSelected ? "text-primary dark:text-primary-light" : "text-grey-dark dark:text-neutral-200"
            )}>
                {t(provider.nameKey)}
            </span>
        </button>
    );
});
ProviderCard.displayName = 'ProviderCard';

/**
 * Settings panel displaying information about the application, such as version,
 * changelog, privacy policy, and links for feedback.
 */
const AboutSettings: React.FC = memo(() => {
    const { t, i18n } = useTranslation();
    const [showChangelog, setShowChangelog] = useState(false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [showTermsOfUse, setShowTermsOfUse] = useState(false);
    const [changelogContent, setChangelogContent] = useState<string>('');
    const [privacyContent, setPrivacyContent] = useState<string>('');
    const [termsContent, setTermsContent] = useState<string>('');
    const [loadingContent, setLoadingContent] = useState<{[key: string]: boolean}>({});

    const loadContent = async (type: 'changelog' | 'privacy' | 'terms') => {
        const language = i18n.language === 'zh-CN' ? 'zh-CN' : 'en';
        setLoadingContent(prev => ({ ...prev, [type]: true }));

        try {
            let content = '';
            switch (type) {
                case 'changelog':
                    content = await loadChangelog(language);
                    setChangelogContent(content);
                    break;
                case 'privacy':
                    content = await loadPrivacyPolicy(language);
                    setPrivacyContent(content);
                    break;
                case 'terms':
                    content = await loadTermsOfUse(language);
                    setTermsContent(content);
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${type}:`, error);
        } finally {
            setLoadingContent(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleToggleChangelog = async () => {
        if (!showChangelog && !changelogContent) {
            await loadContent('changelog');
        }
        setShowChangelog(!showChangelog);
    };

    const handleTogglePrivacy = async () => {
        if (!showPrivacyPolicy && !privacyContent) {
            await loadContent('privacy');
        }
        setShowPrivacyPolicy(!showPrivacyPolicy);
    };

    const handleToggleTerms = async () => {
        if (!showTermsOfUse && !termsContent) {
            await loadContent('terms');
        }
        setShowTermsOfUse(!showTermsOfUse);
    };

    return (
        <div className="space-y-0">
            <SettingsRow
                label={t('settings.about.version')}
                value={APP_VERSION}
            />
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow
                label={t('settings.about.changelog')}
                action={
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleChangelog}
                            disabled={loadingContent.changelog}
                            className="text-[13px]"
                        >
                            {showChangelog ? t('settings.about.hide') : t('settings.about.view')}
                        </Button>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            icon="external-link"
                            className="text-[13px]"
                        >
                            <Link to="/changelog">{t('settings.about.viewFull')}</Link>
                        </Button>
                    </div>
                }
            />
            {showChangelog && (
                <div className="pl-0 pr-0 pb-4">
                    <div
                        className="text-[12px] text-grey-medium dark:text-neutral-400 bg-grey-ultra-light dark:bg-neutral-700 rounded-base p-3 max-h-[200px] overflow-y-auto styled-scrollbar">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {changelogContent}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow
                label={t('settings.about.privacyPolicy')}
                action={
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleTogglePrivacy}
                            disabled={loadingContent.privacy}
                            className="text-[13px]"
                        >
                            {showPrivacyPolicy ? t('settings.about.hide') : t('settings.about.view')}
                        </Button>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            icon="external-link"
                            className="text-[13px]"
                        >
                            <Link to="/privacy-policy">{t('settings.about.viewFull')}</Link>
                        </Button>
                    </div>
                }
            />
            {showPrivacyPolicy && (
                <div className="pl-0 pr-0 pb-4">
                    <div
                        className="text-[12px] text-grey-medium dark:text-neutral-400 bg-grey-ultra-light dark:bg-neutral-700 rounded-base p-3 max-h-[200px] overflow-y-auto styled-scrollbar">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {privacyContent}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow
                label={t('settings.about.termsOfUse')}
                action={
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleTerms}
                            disabled={loadingContent.terms}
                            className="text-[13px]"
                        >
                            {showTermsOfUse ? t('settings.about.hide') : t('settings.about.view')}
                        </Button>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            icon="external-link"
                            className="text-[13px]"
                        >
                            <Link to="/terms-of-use">{t('settings.about.viewFull')}</Link>
                        </Button>
                    </div>
                }
            />
            {showTermsOfUse && (
                <div className="pl-0 pr-0 pb-4">
                    <div
                        className="text-[12px] text-grey-medium dark:text-neutral-400 bg-grey-ultra-light dark:bg-neutral-700 rounded-base p-3 max-h-[200px] overflow-y-auto styled-scrollbar">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {privacyContent}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow
                label={t('settings.about.reportIssue')}
                description={t('settings.about.reportIssueDescription')}
                action={
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="external-link"
                        onClick={() => window.open('https://github.com/LoadShine/tada/issues')}
                        className="text-[13px]"
                    >
                        {t('settings.about.reportButton')}
                    </Button>
                }
            />
        </div>
    );
});
AboutSettings.displayName = 'AboutSettings';

/**
 * Settings panel for configuring the AI provider, API key, model, and other related parameters.
 */
const AISettings: React.FC = memo(() => {
    const { t } = useTranslation();
    const [aiSettings, setAISettings] = useAtom(aiSettingsAtom);
    const addNotification = useSetAtom(addNotificationAtom);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [connectionStatus, setConnectionStatus] = useAtom(aiConnectionStatusAtom);

    if (!aiSettings) {
        return <div className="p-4 text-center text-grey-medium">Loading AI settings...</div>;
    }

    const currentSettings = aiSettings ?? defaultAISettingsForApi();
    const currentProvider = AI_PROVIDERS.find(p => p.id === currentSettings.provider) ?? AI_PROVIDERS[0];
    const availableModels = currentSettings.availableModels ?? currentProvider.models;
    const isCustomProvider = currentProvider.id === 'custom';

    const handleProviderChange = (providerId: AIProvider['id']) => {
        const newProvider = AI_PROVIDERS.find(p => p.id === providerId);
        if (!newProvider) return;

        setAISettings((prev) => ({
            ...(prev ?? defaultAISettingsForApi()),
            provider: providerId,
            apiKey: providerId === prev?.provider
                ? prev.apiKey
                : (providerId === 'custom' ? 'no-api-key-is-required' : ''),
            model: newProvider.models[0]?.id ?? '',
            baseUrl: newProvider.defaultBaseUrl ?? '',
            availableModels: newProvider.models,
        }));
    };

    const handleApiKeyChange = (apiKey: string) => {
        setAISettings((prev) => ({
            ...(prev ?? defaultAISettingsForApi()),
            apiKey,
        }));
    };

    const handleModelChange = (model: string) => {
        setAISettings((prev) => ({
            ...(prev ?? defaultAISettingsForApi()),
            model,
        }));
    };

    const handleBaseUrlChange = (baseUrl: string) => {
        setAISettings((prev) => ({
            ...(prev ?? defaultAISettingsForApi()),
            baseUrl,
        }));
    };

    const handleFetchModels = useCallback(async () => {
        if (!currentProvider || isFetchingModels || isCustomProvider) return;

        if (currentProvider.requiresApiKey && !currentSettings.apiKey) {
            addNotification({ type: 'error', message: "API key is required to fetch models." });
            return;
        }

        setIsFetchingModels(true);
        try {
            const models = await fetchProviderModels(currentSettings);
            setAISettings((prev) => ({
                ...(prev ?? defaultAISettingsForApi()),
                availableModels: models,
                model: models[0]?.id ?? prev?.model ?? '',
            }));
            addNotification({
                type: 'success',
                message: `Successfully fetched ${models.length} models for ${t(currentProvider.nameKey)}.`
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            addNotification({ type: 'error', message: `Failed to fetch models: ${errorMessage}` });
        } finally {
            setIsFetchingModels(false);
        }
    }, [currentProvider, currentSettings, isFetchingModels, isCustomProvider, setAISettings, addNotification, t]);

    const handleTestConnection = useCallback(async () => {
        if (!currentProvider || isTestingConnection) return;

        if (currentProvider.requiresApiKey && !currentSettings.apiKey) {
            addNotification({ type: 'error', message: "API key is required to test connection." });
            return;
        }

        if (!currentSettings.model) {
            addNotification({ type: 'error', message: "Please select a model first." });
            return;
        }

        setIsTestingConnection(true);
        try {
            const success = await testConnection(currentSettings);
            if (success) {
                addNotification({ type: 'success', message: t('settings.ai.connectionSuccessful') });
                setConnectionStatus('success');
            } else {
                addNotification({ type: 'error', message: t('settings.ai.connectionFailed') });
                setConnectionStatus('error');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('settings.ai.connectionFailed');
            addNotification({ type: 'error', message: errorMessage });
            setConnectionStatus('error');
        } finally {
            setIsTestingConnection(false);
        }
    }, [currentProvider, currentSettings, isTestingConnection, addNotification, t, setConnectionStatus]);

    const isConfigurallyReady = (currentProvider.requiresApiKey ? !!currentSettings.apiKey : true) && !!currentSettings.model;
    let statusColor = "bg-orange-400";
    let statusText = t('settings.ai.statusIncomplete');

    if (isConfigurallyReady) {
        if (connectionStatus === 'error') {
            statusColor = "bg-error";
            statusText = t('settings.ai.statusFailed');
        } else if (connectionStatus === 'success') {
            statusColor = "bg-success";
            statusText = t('settings.ai.statusVerified');
        } else {
            statusColor = "bg-green-500";
            statusText = t('settings.ai.statusReady');
        }
    }

    return (
        <div className="space-y-6">
            {/* Provider Selection */}
            <div>
                <div className="mb-4">
                    <h3 className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal">
                        {t('settings.ai.selectProvider')}
                    </h3>
                    <p className="text-[11px] text-grey-medium dark:text-neutral-400 mt-0.5">
                        {t('settings.ai.selectProviderDescription')}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {AI_PROVIDERS.map(provider => (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            isSelected={currentSettings.provider === provider.id}
                            onClick={() => handleProviderChange(provider.id)}
                        />
                    ))}
                </div>
            </div>

            <div className="h-px bg-grey-light dark:bg-neutral-700"></div>

            {/* Configuration Section */}
            <div className="space-y-0">
                {/* API Key */}
                {currentProvider.requiresApiKey && (
                    <>
                        <SettingsRow
                            label={t('settings.ai.apiKey')}
                            description={t('settings.ai.apiKeyDescription', { providerName: t(currentProvider.nameKey) })}
                            htmlFor="apiKeyInput"
                        >
                            <div className="flex items-center space-x-2">
                                <div className="relative">
                                    <input
                                        id="apiKeyInput"
                                        type={showApiKey ? "text" : "password"}
                                        value={currentSettings.apiKey}
                                        onChange={(e) => handleApiKeyChange(e.target.value)}
                                        placeholder={t('settings.ai.apiKeyPlaceholder')}
                                        className={twMerge(
                                            "w-[240px] h-8 px-3 pr-9 text-[13px] font-light rounded-base focus:outline-none",
                                            "bg-grey-ultra-light dark:bg-neutral-700",
                                            "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                            "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                                            "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className={twMerge(
                                            "absolute right-2 top-1/2 -translate-y-1/2",
                                            "text-grey-medium dark:text-neutral-400",
                                            "hover:text-grey-dark dark:hover:text-neutral-200",
                                            "transition-colors duration-200 ease-in-out",
                                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                                        )}
                                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                                    >
                                        <Icon
                                            name={showApiKey ? "eye-off" : "eye"}
                                            size={14}
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                </div>
                                {currentProvider.listModelsEndpoint && !isCustomProvider && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        icon="refresh-cw"
                                        onClick={handleFetchModels}
                                        disabled={isFetchingModels || !currentSettings.apiKey}
                                        loading={isFetchingModels}
                                        className="w-7 h-7 text-grey-medium dark:text-neutral-400"
                                        aria-label="Fetch models"
                                    />
                                )}
                            </div>
                        </SettingsRow>
                        <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
                    </>
                )}

                {/* Base URL for custom/local providers */}
                {currentProvider.requiresBaseUrl && (
                    <>
                        <SettingsRow
                            label={t('settings.ai.baseUrl')}
                            description={t('settings.ai.baseUrlDescription')}
                            htmlFor="baseUrlInput"
                        >
                            <input
                                id="baseUrlInput"
                                type="url"
                                value={currentSettings.baseUrl ?? ''}
                                onChange={(e) => handleBaseUrlChange(e.target.value)}
                                placeholder={currentProvider.defaultBaseUrl ?? 'https://api.openai.com'}
                                className={twMerge(
                                    "w-[240px] h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                                    "bg-grey-ultra-light dark:bg-neutral-700",
                                    "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                    "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                                    "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                                )}
                            />
                        </SettingsRow>
                        <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
                    </>
                )}

                {/* Model Selection or Input */}
                <SettingsRow
                    label={t('settings.ai.model')}
                    description={isCustomProvider
                        ? t('settings.ai.modelDescriptionCustom')
                        : t('settings.ai.modelDescription')
                    }
                    htmlFor={isCustomProvider ? "modelInput" : "modelSelect"}
                >
                    <div className="flex items-center space-x-2">
                        {isCustomProvider ? (
                            <input
                                id="modelInput"
                                type="text"
                                value={currentSettings.model}
                                onChange={(e) => handleModelChange(e.target.value)}
                                placeholder="Enter model name (e.g. gpt-4, claude-3-sonnet)"
                                className={twMerge(
                                    "w-[240px] h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                                    "bg-grey-ultra-light dark:bg-neutral-700",
                                    "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                    "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                                    "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                                )}
                            />
                        ) : (
                            <>
                                <ModelCombobox
                                    id="modelSelect"
                                    value={currentSettings.model}
                                    onChange={handleModelChange}
                                    models={availableModels}
                                    placeholder={t('settings.ai.model')}
                                    searchPlaceholder={t('settings.ai.searchModels')}
                                    noResultsText={t('settings.ai.noModelsFound')}
                                />
                                {currentProvider.listModelsEndpoint && !currentProvider.requiresApiKey && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        icon="refresh-cw"
                                        onClick={handleFetchModels}
                                        disabled={isFetchingModels}
                                        loading={isFetchingModels}
                                        className="w-7 h-7 text-grey-medium dark:text-neutral-400"
                                        aria-label="Fetch models"
                                    />
                                )}
                            </>
                        )}
                    </div>
                </SettingsRow>

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                {/* Connection Test */}
                <SettingsRow
                    label={t('settings.ai.connectionTest')}
                    description={t('settings.ai.connectionTestDescription')}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="wifi"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection || !currentSettings.model || (currentProvider.requiresApiKey && !currentSettings.apiKey)}
                        loading={isTestingConnection}
                        className="text-[13px]"
                    >
                        {t('settings.ai.testConnection')}
                    </Button>
                </SettingsRow>
            </div>

            {/* Status indicator */}
            <div className="pt-4 border-t border-grey-light dark:border-neutral-700">
                <div className="flex items-center space-x-2">
                    <div className={twMerge(
                        "w-2 h-2 rounded-full",
                        statusColor
                    )} />
                    <span className="text-[11px] text-grey-medium dark:text-neutral-400">
                        {statusText}
                    </span>
                </div>
            </div>
        </div>
    );
});
AISettings.displayName = 'AISettings';

/**
 * The main modal component for application settings, containing tabs for
 * Appearance, Preferences, AI, Data, and About sections.
 */
const SettingsModal: React.FC = () => {
    const {t} = useTranslation();
    const [isOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);
    const handleOpenChange = useCallback((open: boolean) => {
        setIsSettingsOpen(open);
    }, [setIsSettingsOpen]);
    const handleTabClick = useCallback((id: SettingsTab) => setSelectedTab(id), [setSelectedTab]);
    const renderContent = useMemo(() => {
        switch (selectedTab) {
            case 'appearance':
                return <AppearanceSettings/>;
            case 'preferences':
                return <PreferencesSettings/>;
            case 'ai':
                return <AISettings />;
            case 'data':
                return <DataSettings />;
            case 'about':
                return <AboutSettings/>;
            default:
                return <AppearanceSettings/>;
        }
    }, [selectedTab]);
    const modalTitle = useMemo(() => {
        const section = settingsSections.find(s => s.id === selectedTab);
        return section ? t(section.labelKey) : t('settings.title');
    }, [selectedTab, t]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white dark:bg-neutral-800 w-full max-w-5xl h-[85vh] max-h-[750px]",
                        "rounded-base shadow-modal flex overflow-hidden",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    aria-describedby={undefined}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                >
                    <div
                        className="w-52 bg-grey-ultra-light/80 dark:bg-grey-deep/80 backdrop-blur-sm p-3 flex flex-col shrink-0 border-r border-grey-light/50 dark:border-neutral-700/50">
                        <nav className="space-y-0.5 flex-1 mt-2">
                            {settingsSections.map((item) => (
                                <button key={item.id} onClick={() => handleTabClick(item.id)}
                                        className={twMerge('flex items-center w-full px-3 py-2 h-8 text-[13px] rounded-base transition-colors duration-200 ease-in-out',
                                            selectedTab === item.id
                                                ? 'bg-grey-light text-primary dark:bg-primary-dark/30 dark:text-primary-light font-normal'
                                                : 'text-grey-dark dark:text-neutral-200 font-light hover:bg-grey-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100',
                                            'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-grey-ultra-light dark:focus-visible:ring-offset-grey-deep'
                                        )} aria-current={selectedTab === item.id ? 'page' : undefined}>
                                    <Icon name={item.icon} size={16} strokeWidth={1}
                                          className="mr-2.5 opacity-90"
                                          aria-hidden="true"/>
                                    <span>{t(item.labelKey)}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-800 relative">
                        <div
                            className="flex items-center justify-between px-6 py-4 border-b border-grey-light dark:border-neutral-700 flex-shrink-0 h-[60px]">
                            <Dialog.Title
                                className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">{modalTitle}</Dialog.Title>
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" icon="x"
                                        className="text-grey-medium dark:text-neutral-400 hover:bg-grey-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100 w-7 h-7 -mr-2"
                                        iconProps={{strokeWidth: 1.5, size: 12}} aria-label="Close settings"/>
                            </Dialog.Close>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto styled-scrollbar">{renderContent}</div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
SettingsModal.displayName = 'SettingsModal';
export default SettingsModal;