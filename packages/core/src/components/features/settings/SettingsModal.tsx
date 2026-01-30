import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    addNotificationAtom,
    aiConnectionStatusAtom,
    aiSettingsAtom,
    appearanceSettingsAtom,
    DarkModeOption,
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    defaultProxySettingsForApi,
    DefaultNewTaskDueDate,
    defaultPreferencesSettingsForApi,
    isSettingsOpenAtom,
    preferencesSettingsAtom,
    proxySettingsAtom,
    settingsSelectedTabAtom,
    userListNamesAtom,
    userProfileAtom,
} from '@/store/jotai.ts';
import { AISettings as AISettingsType, SettingsTab, AppearanceSettings as AppearanceSettingsType } from '@/types';
import Icon from '@/components/ui/Icon.tsx';
import Button from '@/components/ui/Button.tsx';
import ModelCombobox from '@/components/ui/ModelCombobox.tsx';
import { twMerge } from 'tailwind-merge';
import { IconName } from "@/components/ui/IconMap.ts";
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
import { useTranslation } from "react-i18next";
import { AIProvider, AI_PROVIDERS } from "@/config/aiProviders";
import { fetchProviderModels, testConnection, isAIConfigValid } from "@/services/aiService";
import DataSettings from './DataSettings';
import { Link } from 'react-router-dom';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchWithProxy, isTauri } from "@/utils/networkUtils";

interface SettingsItem {
    id: SettingsTab;
    labelKey: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    { id: 'appearance', labelKey: 'settings.appearance.title', icon: 'settings' },
    { id: 'preferences', labelKey: 'settings.preferences.title', icon: 'sliders' },
    { id: 'profile', labelKey: 'settings.profile.title', icon: 'user' },
    { id: 'ai', labelKey: 'settings.ai.title', icon: 'sparkles' },
    { id: 'proxy', labelKey: 'settings.proxy.title', icon: 'network' },
    { id: 'data', labelKey: 'settings.data.title', icon: 'hard-drive' },
    { id: 'about', labelKey: 'settings.about.title', icon: 'info' },
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
}> = memo(({ label, value, action, children, description, htmlFor }) => (
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
    const { t } = useTranslation();
    const options: { value: DarkModeOption; label: string; icon: IconName }[] = [
        { value: 'light', label: t('settings.appearance.darkModeOptions.light'), icon: 'sun' },
        { value: 'dark', label: t('settings.appearance.darkModeOptions.dark'), icon: 'moon' },
        { value: 'system', label: t('settings.appearance.darkModeOptions.system'), icon: 'settings' },
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
                    <Icon name={option.icon} size={14} strokeWidth={1.5} className="mr-1.5 opacity-80" />
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
}> = memo(({ colorValue, selected, onClick, themeName }) => (
    <button
        type="button"
        onClick={onClick}
        className={twMerge(
            "w-7 h-7 rounded-full border-2 transition-all duration-150 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep",
            selected ? "ring-2 ring-offset-1 ring-current" : "border-transparent hover:border-grey-medium/50 dark:hover:border-neutral-400/50"
        )}
        style={{ backgroundColor: `hsl(${colorValue})`, borderColor: selected ? `hsl(${colorValue})` : undefined }}
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
    const { t } = useTranslation();
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
    const handleTextSizeChange = (size: 'default' | 'large') => setAppearance(s => ({
        ...(s ?? defaultAppearanceSettingsFromAtoms),
        textSize: size
    }));
    const handleFontWeightChange = (weight: 'light' | 'regular' | 'bold') => setAppearance(s => ({
        ...(s ?? defaultAppearanceSettingsFromAtoms),
        fontWeight: weight
    }));

    return (
        <div className="space-y-6">
            <SettingsRow label={t('settings.appearance.mode')} description={t('settings.appearance.modeDescription')}>
                <DarkModeSelector value={currentAppearance.darkMode} onChange={handleDarkModeChange} />
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

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            {/* Typography Section */}
            <div>
                <h3 className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal mb-3">
                    {t('settings.appearance.typography')}
                </h3>

                <SettingsRow label={t('settings.appearance.textSize')}>
                    <RadioGroup.Root
                        value={currentAppearance.textSize}
                        onValueChange={(val: 'default' | 'large') => handleTextSizeChange(val)}
                        className="flex space-x-1 p-0.5 bg-grey-ultra-light dark:bg-neutral-700 rounded-base"
                    >
                        <RadioGroup.Item value="default" className={twMerge(
                            "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            currentAppearance.textSize === 'default' ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm" : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                        )}>
                            {t('settings.appearance.textSizeOptions.default')}
                        </RadioGroup.Item>
                        <RadioGroup.Item value="large" className={twMerge(
                            "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            currentAppearance.textSize === 'large' ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm" : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                        )}>
                            {t('settings.appearance.textSizeOptions.large')}
                        </RadioGroup.Item>
                    </RadioGroup.Root>
                </SettingsRow>

                <SettingsRow label={t('settings.appearance.fontWeight')}>
                    <RadioGroup.Root
                        value={currentAppearance.fontWeight}
                        onValueChange={(val: 'light' | 'regular' | 'bold') => handleFontWeightChange(val)}
                        className="flex space-x-1 p-0.5 bg-grey-ultra-light dark:bg-neutral-700 rounded-base"
                    >
                        <RadioGroup.Item value="light" className={twMerge(
                            "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            currentAppearance.fontWeight === 'light' ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm" : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                        )}>
                            {t('settings.appearance.fontWeightOptions.light')}
                        </RadioGroup.Item>
                        <RadioGroup.Item value="regular" className={twMerge(
                            "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            currentAppearance.fontWeight === 'regular' ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm" : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                        )}>
                            {t('settings.appearance.fontWeightOptions.regular')}
                        </RadioGroup.Item>
                        <RadioGroup.Item value="bold" className={twMerge(
                            "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                            currentAppearance.fontWeight === 'bold' ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm" : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                        )}>
                            {t('settings.appearance.fontWeightOptions.bold')}
                        </RadioGroup.Item>
                    </RadioGroup.Root>
                </SettingsRow>
            </div>
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
            <Select.Value placeholder={placeholder} />
            <Select.Icon className="text-grey-medium dark:text-neutral-400">
                <Icon name="chevron-down" size={14} strokeWidth={1.5} />
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
                                <Icon name="check" size={12} strokeWidth={2} />
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
    const { t } = useTranslation();
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
        { value: 'none', label: t('settings.preferences.dueDateOptions.none') },
        { value: 'today', label: t('settings.preferences.dueDateOptions.today') },
        { value: 'tomorrow', label: t('settings.preferences.dueDateOptions.tomorrow') },
    ];
    const priorityOptions = [
        { value: 'none', label: t('settings.preferences.priorityOptions.none') },
        { value: '1', label: t('settings.preferences.priorityOptions.1') },
        { value: '2', label: t('settings.preferences.priorityOptions.2') },
        { value: '3', label: t('settings.preferences.priorityOptions.3') },
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
                    { value: 'en', label: t('settings.preferences.languages.en') },
                    { value: 'zh-CN', label: t('settings.preferences.languages.zh-CN') }
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
                        className={twMerge("custom-switch-thumb", currentPreferences.confirmDeletions ? "custom-switch-thumb-on" : "custom-switch-thumb-off")} />
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
                        className={twMerge("custom-switch-thumb", currentPreferences.enableEcho ? "custom-switch-thumb-on" : "custom-switch-thumb-off")} />
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
                                        className={twMerge("custom-switch-thumb", currentPreferences.alwaysUseAITask ? "custom-switch-thumb-on" : "custom-switch-thumb-off")} />
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

            {/* Scheduled Report Generation Section */}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <div className="pt-4">
                <h3 className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal mb-2 flex items-center">
                    <Icon name="clock-8" size={14} strokeWidth={1.5} className="mr-2 opacity-70" />
                    {t('settings.preferences.scheduledReport.title')}
                </h3>
                <p className="text-[11px] text-grey-medium dark:text-neutral-400 mb-3 font-light">
                    {t('settings.preferences.scheduledReport.description')}
                </p>

                <SettingsRow
                    label={t('settings.preferences.scheduledReport.enable')}
                    htmlFor="scheduleEnabledToggle"
                >
                    <Tooltip.Provider>
                        <Tooltip.Root delayDuration={0}>
                            <Tooltip.Trigger asChild>
                                <div className="inline-flex">
                                    <RadixSwitch.Root
                                        id="scheduleEnabledToggle"
                                        checked={currentPreferences.scheduleSettings?.enabled ?? false}
                                        onCheckedChange={(checked) => setPreferences(p => ({
                                            ...(p ?? defaultPreferencesFromAtoms),
                                            scheduleSettings: {
                                                ...(p?.scheduleSettings ?? { enabled: false, time: '18:00', days: [1, 2, 3, 4, 5] }),
                                                enabled: checked
                                            }
                                        }))}
                                        disabled={!isAIConfigured}
                                        aria-label="Toggle scheduled report generation"
                                        className={twMerge(
                                            "custom-switch-track",
                                            currentPreferences.scheduleSettings?.enabled ? "custom-switch-track-on" : "custom-switch-track-off",
                                            !isAIConfigured && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <RadixSwitch.Thumb
                                            className={twMerge("custom-switch-thumb", currentPreferences.scheduleSettings?.enabled ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}
                                        />
                                    </RadixSwitch.Root>
                                </div>
                            </Tooltip.Trigger>
                            {!isAIConfigured && (
                                <Tooltip.Portal>
                                    <Tooltip.Content className={tooltipContentClass} side="left" sideOffset={5}>
                                        {t('settings.preferences.scheduledReport.aiRequiredHint')}
                                        <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            )}
                        </Tooltip.Root>
                    </Tooltip.Provider>
                </SettingsRow>

                {currentPreferences.scheduleSettings?.enabled && (
                    <>
                        <SettingsRow
                            label={t('settings.preferences.scheduledReport.time')}
                            htmlFor="scheduleTimeInput"
                        >
                            <div className="inline-flex items-center">
                                <select
                                    value={(currentPreferences.scheduleSettings?.time ?? '18:00').split(':')[0]}
                                    onChange={(e) => {
                                        const minute = (currentPreferences.scheduleSettings?.time ?? '18:00').split(':')[1];
                                        setPreferences(p => ({
                                            ...(p ?? defaultPreferencesFromAtoms),
                                            scheduleSettings: {
                                                ...(p?.scheduleSettings ?? { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5] }),
                                                time: `${e.target.value}:${minute}`
                                            }
                                        }));
                                    }}
                                    className={twMerge(
                                        "appearance-none w-11 h-8 text-center text-[14px] font-medium tabular-nums",
                                        "bg-grey-ultra-light dark:bg-neutral-700 rounded-md",
                                        "text-grey-dark dark:text-neutral-100",
                                        "border border-grey-light dark:border-neutral-600",
                                        "hover:border-grey-medium dark:hover:border-neutral-500",
                                        "focus:outline-none focus:border-primary dark:focus:border-primary-light",
                                        "transition-colors cursor-pointer"
                                    )}
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={String(i).padStart(2, '0')}>
                                            {String(i).padStart(2, '0')}
                                        </option>
                                    ))}
                                </select>
                                <span className="mx-1.5 text-[14px] font-medium text-grey-medium dark:text-neutral-400">:</span>
                                <select
                                    value={(currentPreferences.scheduleSettings?.time ?? '18:00').split(':')[1]}
                                    onChange={(e) => {
                                        const hour = (currentPreferences.scheduleSettings?.time ?? '18:00').split(':')[0];
                                        setPreferences(p => ({
                                            ...(p ?? defaultPreferencesFromAtoms),
                                            scheduleSettings: {
                                                ...(p?.scheduleSettings ?? { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5] }),
                                                time: `${hour}:${e.target.value}`
                                            }
                                        }));
                                    }}
                                    className={twMerge(
                                        "appearance-none w-11 h-8 text-center text-[14px] font-medium tabular-nums",
                                        "bg-grey-ultra-light dark:bg-neutral-700 rounded-md",
                                        "text-grey-dark dark:text-neutral-100",
                                        "border border-grey-light dark:border-neutral-600",
                                        "hover:border-grey-medium dark:hover:border-neutral-500",
                                        "focus:outline-none focus:border-primary dark:focus:border-primary-light",
                                        "transition-colors cursor-pointer"
                                    )}
                                >
                                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </SettingsRow>

                        <SettingsRow
                            label={t('settings.preferences.scheduledReport.days')}
                        >
                            <div className="inline-flex items-center gap-1">
                                {[
                                    { day: 0, label: t('settings.preferences.scheduledReport.dayLabels.sun') },
                                    { day: 1, label: t('settings.preferences.scheduledReport.dayLabels.mon') },
                                    { day: 2, label: t('settings.preferences.scheduledReport.dayLabels.tue') },
                                    { day: 3, label: t('settings.preferences.scheduledReport.dayLabels.wed') },
                                    { day: 4, label: t('settings.preferences.scheduledReport.dayLabels.thu') },
                                    { day: 5, label: t('settings.preferences.scheduledReport.dayLabels.fri') },
                                    { day: 6, label: t('settings.preferences.scheduledReport.dayLabels.sat') },
                                ].map(({ day, label }) => {
                                    const isSelected = currentPreferences.scheduleSettings?.days?.includes(day) ?? false;
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                                const currentDays = currentPreferences.scheduleSettings?.days ?? [];
                                                const newDays = isSelected
                                                    ? currentDays.filter(d => d !== day)
                                                    : [...currentDays, day].sort((a, b) => a - b);
                                                setPreferences(p => ({
                                                    ...(p ?? defaultPreferencesFromAtoms),
                                                    scheduleSettings: {
                                                        ...(p?.scheduleSettings ?? { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5] }),
                                                        days: newDays
                                                    }
                                                }));
                                            }}
                                            className={twMerge(
                                                "w-7 h-7 rounded-md text-[11px] font-medium",
                                                "transition-all duration-150",
                                                isSelected
                                                    ? "bg-primary text-white dark:bg-primary-light dark:text-grey-deep"
                                                    : "bg-grey-ultra-light dark:bg-neutral-700 text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200 border border-grey-light dark:border-neutral-600"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </SettingsRow>
                    </>
                )}
            </div>
        </div>
    );
});
PreferencesSettings.displayName = 'PreferencesSettings';

/**
 * Persona options for profile selection (same as onboarding)
 */
const PROFILE_PERSONA_OPTIONS: { id: 'dev' | 'product' | 'marketing' | 'sales' | 'ops' | 'admin' | 'research' | 'freelance'; icon: IconName }[] = [
    { id: 'dev', icon: 'code' },
    { id: 'product', icon: 'layout' },
    { id: 'marketing', icon: 'megaphone' },
    { id: 'sales', icon: 'handshake' },
    { id: 'ops', icon: 'users' },
    { id: 'admin', icon: 'building' },
    { id: 'research', icon: 'bar-chart-2' },
    { id: 'freelance', icon: 'coffee' },
];

/**
 * Settings panel for managing user profile (persona, WRM, user note).
 */
const ProfileSettings: React.FC = memo(() => {
    const { t } = useTranslation();
    const [userProfile, setUserProfile] = useAtom(userProfileAtom);

    const currentPersonas = userProfile?.persona ?? [];
    const currentWRM = userProfile?.workRealityModel ?? {
        taskView: null,
        uncertaintyTolerance: null,
        incompletionStyle: null,
        confidence: { taskView: 0.5, uncertaintyTolerance: 0.5, incompletionStyle: 0.5 }
    };
    const currentUserNote = userProfile?.userNote ?? '';

    const togglePersona = (personaId: typeof PROFILE_PERSONA_OPTIONS[number]['id']) => {
        const newPersonas = currentPersonas.includes(personaId)
            ? currentPersonas.filter(p => p !== personaId)
            : [...currentPersonas, personaId];
        setUserProfile({
            ...userProfile!,
            persona: newPersonas.length > 0 ? newPersonas : null,
            updatedAt: Date.now()
        });
    };

    const handleWRMChange = (field: 'taskView' | 'uncertaintyTolerance' | 'incompletionStyle', value: string | null) => {
        setUserProfile({
            ...userProfile!,
            workRealityModel: {
                ...currentWRM,
                [field]: value,
                confidence: {
                    ...currentWRM.confidence,
                    [field]: value ? 0.9 : 0.5
                }
            },
            updatedAt: Date.now()
        });
    };

    const handleUserNoteChange = (note: string) => {
        setUserProfile({
            ...userProfile!,
            userNote: note.trim() || null,
            updatedAt: Date.now()
        });
    };

    const renderWRMOption = (
        field: 'taskView' | 'uncertaintyTolerance' | 'incompletionStyle',
        label: string,
        description: string,
        options: { value: string; label: string }[],
        currentValue: string | null | undefined
    ) => (
        <SettingsRow label={label} description={description}>
            <div className="flex gap-1.5">
                {options.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleWRMChange(field, currentValue === opt.value ? null : opt.value)}
                        className={twMerge(
                            "px-3 py-1.5 text-[12px] rounded-base border transition-colors duration-150",
                            currentValue === opt.value
                                ? "border-primary bg-primary/10 text-primary dark:border-primary-light dark:text-primary-light font-normal"
                                : "border-grey-light dark:border-neutral-700 text-grey-dark dark:text-neutral-200 hover:border-grey-medium dark:hover:border-neutral-600 font-light"
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </SettingsRow>
    );

    return (
        <div className="space-y-0">
            {/* Persona Section */}
            <SettingsRow
                label={t('settings.profile.persona')}
                description={t('settings.profile.personaDescription')}
            >
                <div /> {/* Empty div for spacing */}
            </SettingsRow>
            <div className="grid grid-cols-4 gap-1.5 pb-4">
                {PROFILE_PERSONA_OPTIONS.map((persona) => (
                    <button
                        key={persona.id}
                        type="button"
                        onClick={() => togglePersona(persona.id)}
                        className={twMerge(
                            'p-2 rounded-base border text-center transition-all duration-200 flex flex-col items-center gap-1',
                            currentPersonas.includes(persona.id)
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-grey-light dark:border-neutral-700 hover:border-grey-medium dark:hover:border-neutral-600'
                        )}
                    >
                        <Icon
                            name={persona.icon}
                            size={16}
                            strokeWidth={1.5}
                            className={currentPersonas.includes(persona.id)
                                ? 'text-primary dark:text-primary-light'
                                : 'text-grey-medium dark:text-neutral-400'
                            }
                        />
                        <span className={twMerge(
                            'text-[11px]',
                            currentPersonas.includes(persona.id)
                                ? 'text-primary dark:text-primary-light font-normal'
                                : 'text-grey-dark dark:text-neutral-300 font-light'
                        )}>
                            {t(`onboarding.personas.${persona.id}`)}
                        </span>
                    </button>
                ))}
            </div>

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            {renderWRMOption(
                'taskView',
                t('settings.profile.wrm.taskView'),
                t('settings.profile.wrm.taskViewDescription'),
                [
                    { value: 'process', label: t('settings.profile.wrm.taskViewOptions.process') },
                    { value: 'outcome', label: t('settings.profile.wrm.taskViewOptions.outcome') }
                ],
                currentWRM.taskView
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            {renderWRMOption(
                'uncertaintyTolerance',
                t('settings.profile.wrm.uncertaintyTolerance'),
                t('settings.profile.wrm.uncertaintyToleranceDescription'),
                [
                    { value: 'low', label: t('settings.profile.wrm.uncertaintyToleranceOptions.low') },
                    { value: 'high', label: t('settings.profile.wrm.uncertaintyToleranceOptions.high') }
                ],
                currentWRM.uncertaintyTolerance
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            {renderWRMOption(
                'incompletionStyle',
                t('settings.profile.wrm.incompletionStyle'),
                t('settings.profile.wrm.incompletionStyleDescription'),
                [
                    { value: 'narrative', label: t('settings.profile.wrm.incompletionStyleOptions.narrative') },
                    { value: 'explicit', label: t('settings.profile.wrm.incompletionStyleOptions.explicit') }
                ],
                currentWRM.incompletionStyle
            )}

            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow
                label={t('settings.profile.userNote')}
                description={t('settings.profile.userNoteDescription')}
            >
                <div />
            </SettingsRow>
            <div className="pb-4">
                <textarea
                    value={currentUserNote}
                    onChange={(e) => handleUserNoteChange(e.target.value)}
                    placeholder={t('settings.profile.userNotePlaceholder')}
                    className="w-full h-24 p-3 rounded-base border border-grey-light dark:border-neutral-700 bg-white dark:bg-neutral-750 text-grey-dark dark:text-neutral-100 placeholder:text-grey-medium/60 dark:placeholder:text-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-[13px] font-light"
                />
            </div>
        </div>
    );
});
ProfileSettings.displayName = 'ProfileSettings';

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
    const [loadingContent, setLoadingContent] = useState<{ [key: string]: boolean }>({});

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
                    htmlFor="modelSelect"
                >
                    <div className="flex items-center space-x-2">
                        {/* 统一使用 ModelCombobox，开启 allowCustom 支持手动输入 */}
                        <ModelCombobox
                            id="modelSelect"
                            value={currentSettings.model}
                            onChange={handleModelChange}
                            models={availableModels}
                            placeholder={t('settings.ai.model')}
                            searchPlaceholder={t('settings.ai.searchModels')}
                            noResultsText={t('settings.ai.noModelsFound')}
                            allowCustom={true}
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
 * Settings panel for managing proxy configuration.
 */
const ProxySettings: React.FC = memo(() => {
    const { t } = useTranslation();
    const [proxySettings, setProxySettings] = useAtom(proxySettingsAtom);
    const [isTesting, setIsTesting] = useState(false);
    const addNotification = useSetAtom(addNotificationAtom);

    if (!proxySettings) {
        return <div className="p-4 text-center text-grey-medium">{t('settings.proxy.loading')}</div>;
    }

    const currentSettings = proxySettings ?? defaultProxySettingsForApi();
    const isDesktop = isTauri();

    const handleEnableChange = (enabled: boolean) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        enabled
    }));

    const handleProtocolChange = (protocol: string) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        protocol: protocol as 'http' | 'https' | 'socks5'
    }));

    const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        host: e.target.value
    }));

    const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        port: parseInt(e.target.value) || 0
    }));

    const handleAuthChange = (auth: boolean) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        auth
    }));

    const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        username: e.target.value
    }));

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => setProxySettings(s => ({
        ...(s ?? defaultProxySettingsForApi()),
        password: e.target.value
    }));

    const handleTestProxy = async () => {
        setIsTesting(true);
        try {
            console.log('[Proxy Test] Starting test with:', currentSettings);
            const response = await fetchWithProxy('https://www.google.com', {
                method: 'HEAD',
                cache: 'no-cache'
            }, currentSettings);

            console.log('[Proxy Test] Response:', response.status, response.statusText);

            if (response.ok || (response.status >= 200 && response.status < 400)) {
                addNotification({ type: 'success', message: t('settings.proxy.test.success') });
            } else {
                throw new Error(`HTTP Status: ${response.status} ${response.statusText}`);
            }
        } catch (e: any) {
            console.error('[Proxy Test] Failed:', e);
            const errorMessage = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
            addNotification({ type: 'error', message: t('settings.proxy.test.failed', { error: errorMessage }) });
        } finally {
            setIsTesting(false);
        }
    };

    if (!isDesktop) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <Icon name="alert-circle" size={32} className="text-grey-medium dark:text-neutral-500 mb-4" />
                <h3 className="text-lg font-medium text-grey-dark dark:text-neutral-200 mb-2">
                    {t('settings.proxy.unavailable.title')}
                </h3>
                <p className="text-sm text-grey-medium dark:text-neutral-400 max-w-sm">
                    {t('settings.proxy.unavailable.description')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-0">
            <SettingsRow
                label={t('settings.proxy.enable.label')}
                description={t('settings.proxy.enable.description')}
                htmlFor="proxyToggle"
            >
                <RadixSwitch.Root
                    id="proxyToggle"
                    checked={currentSettings.enabled}
                    onCheckedChange={handleEnableChange}
                    className={twMerge(
                        "custom-switch-track",
                        currentSettings.enabled ? "custom-switch-track-on" : "custom-switch-track-off"
                    )}
                >
                    <RadixSwitch.Thumb
                        className={twMerge("custom-switch-thumb", currentSettings.enabled ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}
                    />
                </RadixSwitch.Root>
            </SettingsRow>

            <div className={twMerge(
                "transition-all duration-300 ease-in-out overflow-hidden",
                currentSettings.enabled ? "max-h-[500px] opacity-100" : "max-h-0 opacity-50"
            )}>
                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow label={t('settings.proxy.protocol.label')} htmlFor="protocolSelect">
                    {renderSelect('protocolSelect', currentSettings.protocol, handleProtocolChange, [
                        { value: 'http', label: 'HTTP' },
                        { value: 'https', label: 'HTTPS' },
                        { value: 'socks5', label: 'SOCKS5' },
                    ], t('settings.proxy.protocol.placeholder'))}
                </SettingsRow>

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow label={t('settings.proxy.host')} htmlFor="hostInput">
                    <input
                        id="hostInput"
                        type="text"
                        value={currentSettings.host}
                        onChange={handleHostChange}
                        placeholder="127.0.0.1"
                        className="w-[200px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
                    />
                </SettingsRow>

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow label={t('settings.proxy.port')} htmlFor="portInput">
                    <input
                        id="portInput"
                        type="number"
                        value={currentSettings.port}
                        onChange={handlePortChange}
                        placeholder="7890"
                        className="w-[100px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
                    />
                </SettingsRow>

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow label={t('settings.proxy.auth.label')} description={t('settings.proxy.auth.description')}>
                    <RadixSwitch.Root
                        checked={currentSettings.auth}
                        onCheckedChange={handleAuthChange}
                        className={twMerge(
                            "custom-switch-track",
                            currentSettings.auth ? "custom-switch-track-on" : "custom-switch-track-off"
                        )}
                    >
                        <RadixSwitch.Thumb
                            className={twMerge("custom-switch-thumb", currentSettings.auth ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}
                        />
                    </RadixSwitch.Root>
                </SettingsRow>

                {currentSettings.auth && (
                    <div className="bg-grey-ultra-light/50 dark:bg-neutral-800/50 rounded-lg p-3 mt-2 mb-2 border border-grey-light dark:border-neutral-700 animate-fadeIn">
                        <div className="space-y-3">
                            <div className="flex items-center">
                                <label className="w-24 text-[12px] text-grey-medium dark:text-neutral-400">{t('settings.proxy.auth.username')}</label>
                                <input
                                    type="text"
                                    value={currentSettings.username}
                                    onChange={handleUsernameChange}
                                    className="flex-1 h-8 px-3 text-[13px] font-light rounded-base bg-white dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary border border-grey-light dark:border-neutral-600"
                                />
                            </div>
                            <div className="flex items-center">
                                <label className="w-24 text-[12px] text-grey-medium dark:text-neutral-400">{t('settings.proxy.auth.password')}</label>
                                <input
                                    type="password"
                                    value={currentSettings.password}
                                    onChange={handlePasswordChange}
                                    className="flex-1 h-8 px-3 text-[13px] font-light rounded-base bg-white dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary border border-grey-light dark:border-neutral-600"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow label={t('settings.proxy.test.label')} description={t('settings.proxy.test.description')}>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="wifi"
                        onClick={handleTestProxy}
                        disabled={isTesting}
                        loading={isTesting}
                        className="text-[13px]"
                    >
                        {t('settings.proxy.test.button')}
                    </Button>
                </SettingsRow>
            </div>
        </div>
    );
});
ProxySettings.displayName = 'ProxySettings';

/**
 * The main modal component for application settings, containing tabs for
 * Appearance, Preferences, AI, Data, and About sections.
 */
const SettingsModal: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);
    const handleOpenChange = useCallback((open: boolean) => {
        setIsSettingsOpen(open);
    }, [setIsSettingsOpen]);
    const handleTabClick = useCallback((id: SettingsTab) => setSelectedTab(id), [setSelectedTab]);
    const renderContent = useMemo(() => {
        switch (selectedTab) {
            case 'appearance':
                return <AppearanceSettings />;
            case 'preferences':
                return <PreferencesSettings />;
            case 'profile':
                return <ProfileSettings />;
            case 'ai':
                return <AISettings />;
            case 'proxy':
                return <ProxySettings />;
            case 'data':
                return <DataSettings />;
            case 'about':
                return <AboutSettings />;
            default:
                return <AppearanceSettings />;
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
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm" />
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
                                        aria-hidden="true" />
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
                                    iconProps={{ strokeWidth: 1.5, size: 12 }} aria-label="Close settings" />
                            </Dialog.Close>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto styled-scrollbar" style={{ scrollbarGutter: 'stable' }}>{renderContent}</div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
SettingsModal.displayName = 'SettingsModal';
export default SettingsModal;