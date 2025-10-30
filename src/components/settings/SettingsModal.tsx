// src/components/settings/SettingsModal.tsx
import React, {memo, useCallback, useMemo, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    addNotificationAtom,
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
} from '@/store/atoms';
import {AISettings as AISettingsType, SettingsTab} from '@/types';
import Icon from '../common/Icon';
import Button from '../common/Button';
import {twMerge} from 'tailwind-merge';
import {IconName} from "@/components/common/IconMap";
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as RadixSwitch from '@radix-ui/react-switch';
import {
    APP_THEMES,
    APP_VERSION,
    CHANGELOG_HTML,
    PRIVACY_POLICY_HTML,
    TERMS_OF_USE_HTML
} from '@/config/themes';
import {useTranslation} from "react-i18next";
import {AIProvider, AI_PROVIDERS, AIModel} from "@/config/aiProviders";
import {fetchProviderModels, testConnection} from "@/services/aiService";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

interface SettingsItem {
    id: SettingsTab;
    labelKey: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    {id: 'appearance', labelKey: 'settings.appearance.title', icon: 'settings'},
    {id: 'preferences', labelKey: 'settings.preferences.title', icon: 'sliders'},
    {id: 'ai', labelKey: 'settings.ai.title', icon: 'sparkles'},
    {id: 'about', labelKey: 'settings.about.title', icon: 'info'},
];

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


const ColorSwatch: React.FC<{
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
ColorSwatch.displayName = 'ColorSwatch';

const defaultAppearanceSettingsFromAtoms = defaultAppearanceSettingsForApi();

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
                        <ColorSwatch
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

const renderSelect = (id: string, value: string | null, onChange: (value: string) => void, options: {
    value: string,
    label: string
}[], placeholder: string) => (
    <Select.Root value={value ?? undefined} onValueChange={onChange}>
        <Select.Trigger
            id={id}
            className="flex items-center justify-between w-[160px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 hover:bg-grey-light dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                <Select.Viewport>
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

const PreferencesSettings: React.FC = memo(() => {
    const {t} = useTranslation();
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);
    const userLists = useAtomValue(userListNamesAtom) ?? [];

    if (!preferences) {
        return <div className="p-4 text-center text-grey-medium">Loading preferences...</div>;
    }
    const currentPreferences = preferences ?? defaultPreferencesFromAtoms;


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
        </div>
    );
});
PreferencesSettings.displayName = 'PreferencesSettings';

const defaultAISettingsFromAtoms = defaultAISettingsForApi();

const SortableItem: React.FC<{ item: { id: string; name: string }; isDragging: boolean }> = ({ item, isDragging }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className="flex items-center bg-grey-ultra-light dark:bg-neutral-700 rounded-base p-2 text-sm"
        >
            <button
                {...listeners}
                className="cursor-grab touch-none mr-3 text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                aria-label={`Reorder ${item.name}`}
            >
                <Icon name="grip-vertical" size={16} strokeWidth={1.5} />
            </button>
            <span className="text-grey-dark dark:text-neutral-100 font-light">{item.name}</span>
        </div>
    );
};

const AISettings: React.FC = memo(() => {
    const { t } = useTranslation();
    const [aiSettings, setAISettings] = useAtom(aiSettingsAtom);
    const addNotification = useSetAtom(addNotificationAtom);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    if (!aiSettings) {
        return <div className="p-4 text-center text-grey-medium">Loading AI settings...</div>;
    }

    const currentSettings = aiSettings ?? defaultAISettingsForApi();
    const currentProvider = AI_PROVIDERS.find(p => p.id === currentSettings.provider) ?? AI_PROVIDERS[0];

    const handleProviderChange = (providerId: AIProvider['id']) => {
        const newProvider = AI_PROVIDERS.find(p => p.id === providerId);
        if (!newProvider) return;

        setAISettings({
            ...currentSettings,
            provider: providerId,
            model: newProvider.models[0]?.id || '',
            baseUrl: newProvider.defaultBaseUrl || '',
            fetchedModels: [],
            isConnected: false,
        });
    };

    const handleApiKeyChange = (apiKey: string) => {
        setAISettings({
            ...currentSettings,
            apiKey,
            isConnected: false,
        });
    };

    const handleBaseUrlChange = (baseUrl: string) => {
        setAISettings({
            ...currentSettings,
            baseUrl,
            isConnected: false,
        });
    };

    const handleModelChange = (model: string) => {
        setAISettings({
            ...currentSettings,
            model,
        });
    };

    const handleTestConnection = useCallback(async () => {
        if (!currentProvider) return;

        setIsTestingConnection(true);
        try {
            const isConnected = await testConnection(currentSettings);
            setAISettings({
                ...currentSettings,
                isConnected,
            });

            if (isConnected) {
                addNotification({
                    type: 'success',
                    message: `Successfully connected to ${currentProvider.name}`
                });

                // 自动获取模型
                if (currentProvider.listModelsEndpoint) {
                    handleFetchModels();
                }
            } else {
                addNotification({
                    type: 'error',
                    message: `Failed to connect to ${currentProvider.name}`
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Connection failed";
            addNotification({ type: 'error', message: errorMessage });
            setAISettings({
                ...currentSettings,
                isConnected: false,
            });
        } finally {
            setIsTestingConnection(false);
        }
    }, [currentProvider, currentSettings, setAISettings, addNotification]);

    const handleFetchModels = useCallback(async () => {
        if (!currentProvider || isFetchingModels) return;

        if (currentProvider.requiresApiKey && !currentSettings.apiKey) {
            addNotification({ type: 'error', message: "API key is required to fetch models." });
            return;
        }

        setIsFetchingModels(true);
        try {
            const models = await fetchProviderModels(currentSettings);
            setAISettings({
                ...currentSettings,
                fetchedModels: models,
            });

            // 如果当前没有选择模型，自动选择第一个
            if (!currentSettings.model && models.length > 0) {
                setAISettings({
                    ...currentSettings,
                    fetchedModels: models,
                    model: models[0].id,
                });
            }

            addNotification({
                type: 'success',
                message: `Successfully fetched ${models.length} models`
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to fetch models";
            addNotification({ type: 'error', message: errorMessage });
        } finally {
            setIsFetchingModels(false);
        }
    }, [currentProvider, currentSettings, isFetchingModels, setAISettings, addNotification]);

    const modelOptions = useMemo(() => {
        const defaultModels = currentProvider.models || [];
        const fetchedModels = currentSettings.fetchedModels || [];

        // 合并默认模型和获取的模型，去重
        const allModels = [...defaultModels, ...fetchedModels];
        const uniqueModels = Array.from(
            new Map(allModels.map(m => [m.id, m])).values()
        );

        return uniqueModels.map(m => ({ value: m.id, label: m.name }));
    }, [currentProvider.models, currentSettings.fetchedModels]);

    const providerOptions = useMemo(() =>
            AI_PROVIDERS.map(p => ({ value: p.id, label: p.name })),
        []
    );

    return (
        <div className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-[14px] font-medium text-grey-dark dark:text-neutral-100 mb-3">
                        {t('settings.ai.provider')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {AI_PROVIDERS.map((provider) => (
                            <button
                                key={provider.id}
                                onClick={() => handleProviderChange(provider.id)}
                                className={twMerge(
                                    "p-4 rounded-lg border transition-all duration-200",
                                    "text-left hover:shadow-sm",
                                    currentSettings.provider === provider.id
                                        ? "border-primary bg-primary/5 dark:bg-primary-dark/10"
                                        : "border-grey-light dark:border-neutral-600 bg-white dark:bg-neutral-700"
                                )}
                            >
                                <div className="flex items-start space-x-3">
                                    <span className="text-2xl">{provider.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium text-grey-dark dark:text-neutral-100">
                                            {provider.name}
                                        </div>
                                        <div className="text-[11px] text-grey-medium dark:text-neutral-400 mt-1">
                                            {provider.description}
                                        </div>
                                    </div>
                                    {currentSettings.provider === provider.id && (
                                        <Icon name="check" size={16} className="text-primary dark:text-primary-light flex-shrink-0" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-px bg-grey-light dark:bg-neutral-700"></div>

            {/* Configuration */}
            <div className="space-y-0">
                {currentProvider.requiresApiKey && (
                    <>
                        <SettingsRow
                            label={t('settings.ai.apiKey')}
                            description={`Enter your ${currentProvider.name} API key`}
                            htmlFor="apiKeyInput"
                        >
                            <div className="flex items-center space-x-2">
                                <input
                                    id="apiKeyInput"
                                    type="password"
                                    value={currentSettings.apiKey}
                                    onChange={(e) => handleApiKeyChange(e.target.value)}
                                    placeholder="sk-..."
                                    className={twMerge(
                                        "w-[200px] h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                                        "bg-grey-ultra-light dark:bg-neutral-700",
                                        "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                        "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                                        "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                                    )}
                                />
                                {currentSettings.isConnected && (
                                    <Icon name="check-circle" size={16} className="text-green-500" />
                                )}
                            </div>
                        </SettingsRow>
                        <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
                    </>
                )}

                {currentProvider.requiresBaseUrl && (
                    <>
                        <SettingsRow
                            label={t('settings.ai.baseUrl')}
                            description="Base URL for the API endpoint"
                            htmlFor="baseUrlInput"
                        >
                            <input
                                id="baseUrlInput"
                                type="url"
                                value={currentSettings.baseUrl || ''}
                                onChange={(e) => handleBaseUrlChange(e.target.value)}
                                placeholder={currentProvider.defaultBaseUrl || "http://localhost:11434"}
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

                <SettingsRow
                    label="Connection Test"
                    description="Test the connection to your AI provider"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleTestConnection}
                        loading={isTestingConnection}
                        disabled={isTestingConnection || (currentProvider.requiresApiKey && !currentSettings.apiKey)}
                        className="w-[120px]"
                    >
                        {isTestingConnection ? "Testing..." : "Test Connection"}
                    </Button>
                </SettingsRow>

                <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

                <SettingsRow
                    label={t('settings.ai.model')}
                    description="Select the AI model to use"
                    htmlFor="aiModelSelect"
                >
                    <div className="flex items-center space-x-2">
                        {renderSelect(
                            'aiModelSelect',
                            currentSettings.model,
                            handleModelChange,
                            modelOptions,
                            "Select Model"
                        )}
                        {currentProvider.listModelsEndpoint && (
                            <Button
                                variant="ghost"
                                size="icon"
                                icon="refresh-cw"
                                onClick={handleFetchModels}
                                disabled={isFetchingModels || (currentProvider.requiresApiKey && !currentSettings.apiKey)}
                                loading={isFetchingModels}
                                className="w-7 h-7 text-grey-medium dark:text-neutral-400"
                                aria-label="Fetch models"
                            />
                        )}
                    </div>
                </SettingsRow>
            </div>

            {/* Status */}
            {currentSettings.isConnected && currentSettings.model && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center space-x-2">
                        <Icon name="check-circle" size={16} className="text-green-600 dark:text-green-400" />
                        <span className="text-[13px] text-green-700 dark:text-green-300">
                            AI is configured and ready to use with {currentProvider.name} ({currentSettings.model})
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});
AISettings.displayName = 'AISettings';


// ... (AboutSettings and SettingsModal components are unchanged)
const AboutSettings: React.FC = memo(() => {
    const {t} = useTranslation();
    const [activeContent, setActiveContent] = useState<'changelog' | 'privacy' | 'terms' | null>(null);

    const contentMap = useMemo(() => ({
        changelog: {title: t('settings.about.changelog'), html: CHANGELOG_HTML},
        privacy: {title: t('settings.about.privacyPolicy'), html: PRIVACY_POLICY_HTML},
        terms: {title: t('settings.about.termsOfUse'), html: TERMS_OF_USE_HTML},
    }), [t]);

    const renderContent = () => {
        if (!activeContent || !contentMap[activeContent]) return null;
        return (
            <div
                className="mt-4 p-4 rounded-base border border-grey-light dark:border-neutral-700 bg-grey-ultra-light/50 dark:bg-neutral-750/50 max-h-[300px] overflow-y-auto styled-scrollbar-thin">
                <h4 className="text-md font-semibold text-grey-dark dark:text-neutral-100 mb-3">{contentMap[activeContent].title}</h4>
                <div dangerouslySetInnerHTML={{__html: contentMap[activeContent].html}}/>
            </div>
        );
    };

    return (
        <div className="space-y-0">
            <SettingsRow label={t('settings.about.version')} value={APP_VERSION}/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.about.changelog')} action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'changelog' ? null : 'changelog')}>
                    {activeContent === 'changelog' ? t('settings.about.hide') : t('settings.about.view')}
                </Button>
            }/>
            {activeContent === 'changelog' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.about.privacyPolicy')} action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'privacy' ? null : 'privacy')}>
                    {activeContent === 'privacy' ? t('settings.about.hide') : t('settings.about.view')}
                </Button>
            }/>
            {activeContent === 'privacy' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.about.termsOfUse')} action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'terms' ? null : 'terms')}>
                    {activeContent === 'terms' ? t('settings.about.hide') : t('settings.about.view')}
                </Button>
            }/>
            {activeContent === 'terms' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.about.feedback')}
                         description={t('settings.about.feedbackDescription')}>
                <Button as="a" href="mailto:feedback@tada-app.example.com?subject=Tada App Feedback"
                        variant="secondary"
                        size="sm" icon="mail">
                    {t('settings.about.sendEmail')}
                </Button>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label={t('settings.about.reportIssue')}
                         description={t('settings.about.reportIssueDescription')}>
                <Button as="a" href="mailto:support@tada-app.example.com?subject=Tada App Issue Report"
                        variant="secondary" size="sm" icon="alert-circle"
                        className="text-warning hover:!bg-warning/10 dark:text-warning dark:hover:!bg-warning/20">
                    {t('settings.about.reportButton')}
                </Button>
            </SettingsRow>
        </div>
    );
});
AboutSettings.displayName = 'AboutSettings';


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
                        "bg-white dark:bg-neutral-800 w-full max-w-5xl h-[85vh] max-h-[750px]", // Changed size
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