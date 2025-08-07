// src/components/settings/SettingsModal.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    appearanceSettingsAtom,
    currentUserAtom,
    DarkModeOption,
    defaultAppearanceSettingsForApi,
    DefaultNewTaskDueDate,
    defaultPreferencesSettingsForApi,
    isSettingsOpenAtom,
    preferencesSettingsAtom,
    premiumSettingsAtom,
    settingsSelectedTabAtom,
    userListNamesAtom,
} from '@/store/atoms';
import {SettingsTab} from '@/types';
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
    PREDEFINED_BACKGROUND_IMAGES,
    PRIVACY_POLICY_HTML,
    TERMS_OF_USE_HTML
} from '@/config/themes';
import * as apiService from '@/services/apiService';

interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    {id: 'account', label: 'Account', icon: 'user'},
    {id: 'appearance', label: 'Appearance', icon: 'settings'},
    {id: 'preferences', label: 'Preferences', icon: 'sliders'},
    {id: 'premium', label: 'Premium', icon: 'crown'},
    {id: 'about', label: 'About', icon: 'info'},
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
            {children && <div className="flex justify-end space-x-2">{children}</div>}
        </div>
    </div>
));
SettingsRow.displayName = 'SettingsRow';

const DarkModeSelector: React.FC<{ value: DarkModeOption; onChange: (value: DarkModeOption) => void; }> = memo(({
                                                                                                                    value,
                                                                                                                    onChange
                                                                                                                }) => {
    const options: { value: DarkModeOption; label: string; icon: IconName }[] = [
        {value: 'light', label: 'Light', icon: 'sun'},
        {value: 'dark', label: 'Dark', icon: 'moon'},
        {value: 'system', label: 'System', icon: 'settings'},
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

const BackgroundImagePreview: React.FC<{
    imageUrl: string;
    name: string;
    selected: boolean;
    onClick: () => void;
}> = memo(({imageUrl, name, selected, onClick}) => (
    <button
        type="button"
        onClick={onClick}
        className={twMerge(
            "w-full h-20 rounded-base border-2 overflow-hidden relative group transition-all duration-150 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep",
            selected ? "border-primary dark:border-primary-light" : "border-grey-light hover:border-grey-medium dark:border-neutral-600 dark:hover:border-neutral-400"
        )}
        aria-label={`Select background: ${name}`}
        aria-pressed={selected}
    >
        {imageUrl === 'none' ? (
            <div className="w-full h-full flex items-center justify-center bg-grey-ultra-light dark:bg-grey-deep">
                <Icon name="slash" size={24} className="text-grey-medium dark:text-neutral-500"/>
            </div>
        ) : (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover"/>
        )}
        <div className={twMerge(
            "absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
            {selected && <Icon name="check-circle" size={20} className="text-white"/>}
        </div>
        <span
            className="absolute bottom-1 left-1.5 text-[10px] bg-black/40 text-white px-1 py-0.5 rounded-sm backdrop-blur-sm">{name}</span>
    </button>
));
BackgroundImagePreview.displayName = 'BackgroundImagePreview';


// Account Settings
const AccountSettings: React.FC = memo(() => {
    const [currentUser, setCurrentUserGlobally] = useAtom(currentUserAtom);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(currentUser?.username || '');
    const [isLoading, setIsLoading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (currentUser) {
            setNewName(currentUser.username || '');
        }
    }, [currentUser]);

    const handleEditName = () => setIsEditingName(true);
    const handleCancelEditName = () => {
        setIsEditingName(false);
        setNewName(currentUser?.username || '');
    };
    const handleSaveName = async () => {
        if (!currentUser || newName.trim() === currentUser.username || !newName.trim()) {
            setIsEditingName(false);
            if (!newName.trim()) setNewName(currentUser?.username || '');
            return;
        }
        setIsLoading(true);
        try {
            const updatedUser = await apiService.apiUpdateUser({username: newName.trim()});
            setCurrentUserGlobally(updatedUser);
            setIsEditingName(false);
        } catch (e: any) {
            alert(`Error updating name: ${e.message}`);
        }
        setIsLoading(false);
    };

    const handleChangePassword = async () => {
        const currentPassword = prompt("Enter current password:");
        if (!currentPassword) return;
        const newPassword = prompt("Enter new password (min. 8 characters):");
        if (!newPassword) return;
        if (newPassword.length < 8) {
            alert("New password must be at least 8 characters long.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await apiService.apiChangePassword(currentPassword, newPassword);
            alert(response.message);
        } catch (e: any) {
            alert(`Error changing password: ${e.message}`);
        }
        setIsLoading(false);
    };

    const handleAvatarUploadClick = () => avatarInputRef.current?.click();

    const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const updatedUser = await apiService.apiUploadAvatar(file);
            setCurrentUserGlobally(updatedUser);
        } catch (e: any) {
            alert(`Error uploading avatar: ${e.message}`);
        }
        setIsLoading(false);
        if (event.target) event.target.value = '';
    };

    const handleDeleteAvatar = async () => {
        if (!currentUser?.avatarUrl) return;
        if (confirm("Are you sure you want to delete your avatar?")) {
            setIsLoading(true);
            try {
                const updatedUser = await apiService.apiDeleteAvatar();
                setCurrentUserGlobally(updatedUser);
            } catch (e: any) {
                alert(`Error deleting avatar: ${e.message}`);
            }
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        await setCurrentUserGlobally('logout');
    };

    const userName = useMemo(() => currentUser?.username ?? 'Guest User', [currentUser]);
    const userEmail = useMemo(() => currentUser?.email ?? 'No email provided', [currentUser]);
    const userPhone = useMemo(() => currentUser?.phone ?? 'No phone provided', [currentUser]);
    const isPremium = useMemo(() => currentUser?.isPremium ?? false, [currentUser]);
    const avatarSrc = useMemo(() => currentUser?.avatarUrl, [currentUser]);
    const avatarInitial = useMemo(() => currentUser?.username?.charAt(0).toUpperCase() || '', [currentUser]);
    const displayIdentifier = userEmail || userPhone;

    return (<div className="space-y-6">
        {isLoading && <div
            className="absolute inset-0 bg-white/50 dark:bg-neutral-800/50 flex items-center justify-center z-10"><Icon
            name="loader" className="animate-spin text-primary" size={24}/></div>}

        <div className="flex items-center space-x-4 mb-4">
            <div className="relative group/avatar">
                <div
                    className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-grey-ultra-light dark:bg-neutral-700">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt={userName} className="w-full h-full object-cover"/>
                    ) : (
                        <div
                            className="w-full h-full bg-grey-light dark:bg-neutral-600 flex items-center justify-center text-grey-medium dark:text-neutral-400 text-2xl font-normal">
                            {avatarInitial || <Icon name="user" size={24} strokeWidth={1}/>}
                        </div>
                    )}
                </div>
                <div
                    className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <input type="file" ref={avatarInputRef} onChange={handleAvatarFileChange} accept="image/*" hidden/>
                    <Button variant="ghost" size="icon" icon="upload" onClick={handleAvatarUploadClick}
                            className="text-white hover:bg-white/20" title="Upload new avatar"/>
                    {avatarSrc && <Button variant="ghost" size="icon" icon="trash" onClick={handleDeleteAvatar}
                                          className="text-white hover:bg-white/20" title="Delete avatar"/>}
                </div>
            </div>
            <div>
                <h3 className="text-[18px] font-normal text-grey-dark dark:text-neutral-100">{userName}</h3>
                <p className="text-[13px] text-grey-medium dark:text-neutral-300 font-light">{displayIdentifier}</p>
                {isPremium && (
                    <div
                        className="text-[11px] text-primary dark:text-primary-light flex items-center mt-1.5 font-normal bg-primary-light dark:bg-primary-dark/30 px-2 py-0.5 rounded-full w-fit">
                        <Icon name="crown" size={12} className="mr-1 text-primary dark:text-primary-light"
                              strokeWidth={1.5}/>
                        <span>Premium Member</span>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-0">
            {isEditingName ? (
                <SettingsRow label="Username">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-grow h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light mr-2 w-full sm:w-auto"
                        disabled={isLoading}
                    />
                    <Button variant="primary" size="sm" onClick={handleSaveName} disabled={isLoading}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelEditName} className="ml-1"
                            disabled={isLoading}>Cancel</Button>
                </SettingsRow>
            ) : (
                <SettingsRow label="Username" value={userName}
                             action={<Button variant="link" size="sm" onClick={handleEditName}
                                             disabled={isLoading}>Edit</Button>}/>
            )}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            {userEmail &&
                <SettingsRow label="Email Address" value={userEmail} description="Used for login and notifications."/>}
            {userPhone &&
                <SettingsRow label="Phone Number" value={userPhone} description="Used for login and notifications."/>}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Password" action={<Button variant="link" size="sm" onClick={handleChangePassword}
                                                          disabled={isLoading}>Change Password</Button>}/>
        </div>

        <div className="mt-8">
            <Button variant="secondary" size="md" icon="logout" onClick={handleLogout}
                    className="w-full sm:w-auto" disabled={isLoading}>Logout</Button>
        </div>
    </div>);
});
AccountSettings.displayName = 'AccountSettings';

const defaultAppearanceSettingsFromAtoms = defaultAppearanceSettingsForApi();

const AppearanceSettings: React.FC = memo(() => {
    const [appearance, setAppearance] = useAtom(appearanceSettingsAtom);
    const [customBgUrl, setCustomBgUrl] = useState('');
    const customBgUrlInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (appearance && !PREDEFINED_BACKGROUND_IMAGES.some(img => img.url === appearance.backgroundImageUrl) && appearance.backgroundImageUrl !== 'none') {
            setCustomBgUrl(appearance.backgroundImageUrl);
        } else {
            setCustomBgUrl('');
        }
    }, [appearance]);

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
    const handleBgImageChange = (url: string) => {
        setAppearance(s => ({...(s ?? defaultAppearanceSettingsFromAtoms), backgroundImageUrl: url}));
        if (!PREDEFINED_BACKGROUND_IMAGES.some(img => img.url === url) && url !== 'none') {
            setCustomBgUrl(url);
        } else {
            setCustomBgUrl('');
        }
    };
    const handleCustomBgUrlApply = () => {
        if (customBgUrl.trim()) {
            if (customBgUrl.startsWith('http://') || customBgUrl.startsWith('https://') || customBgUrl.startsWith('data:image')) {
                handleBgImageChange(customBgUrl.trim());
            } else {
                alert("Please enter a valid image URL (starting with http://, https://, or data:image).");
                customBgUrlInputRef.current?.focus();
            }
        }
    };
    const handleBlurChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setAppearance(s => ({
            ...(s ?? defaultAppearanceSettingsFromAtoms),
            backgroundImageBlur: Math.max(0, Math.min(20, value))
        }));
    };
    const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setAppearance(s => ({
            ...(s ?? defaultAppearanceSettingsFromAtoms),
            backgroundImageBrightness: Math.max(0, Math.min(200, value))
        }));
    };


    return (
        <div className="space-y-6">
            <SettingsRow label="Appearance Mode" description="Choose your preferred interface look.">
                <DarkModeSelector value={currentAppearance.darkMode} onChange={handleDarkModeChange}/>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow label="Theme Color" description="Choose an accent color for the application.">
                <div className="flex space-x-2">
                    {APP_THEMES.map(theme => (
                        <ColorSwatch
                            key={theme.id}
                            colorValue={theme.colors.primary}
                            selected={currentAppearance.themeId === theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            themeName={theme.name}
                        />
                    ))}
                </div>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <div>
                <SettingsRow label="Background Image"
                             description="Select a predefined background or set a custom one."/>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1 mb-4">
                    {PREDEFINED_BACKGROUND_IMAGES.map(img => (
                        <BackgroundImagePreview
                            key={img.id}
                            imageUrl={img.url}
                            name={img.name}
                            selected={currentAppearance.backgroundImageUrl === img.url}
                            onClick={() => handleBgImageChange(img.url)}
                        />
                    ))}
                </div>
                <div className="flex items-center space-x-2">
                    <input
                        ref={customBgUrlInputRef}
                        type="url"
                        value={customBgUrl}
                        onChange={(e) => setCustomBgUrl(e.target.value)}
                        placeholder="Enter custom image URL (http://... or data:image/...)"
                        className={twMerge(
                            "flex-grow h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                            "bg-grey-ultra-light dark:bg-neutral-700",
                            "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                            "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                            "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                        )}
                    />
                    <Button variant="secondary" size="md" onClick={handleCustomBgUrlApply}
                            className="flex-shrink-0">Apply URL</Button>
                </div>
            </div>

            {currentAppearance.backgroundImageUrl && currentAppearance.backgroundImageUrl !== 'none' && (
                <>
                    <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
                    <SettingsRow label="Background Blur" htmlFor="bgBlurSlider"
                                 description="Adjust background image blurriness.">
                        <div className="flex items-center space-x-2 w-[180px]">
                            <input id="bgBlurSlider" type="range" min="0" max="20" step="1"
                                   value={currentAppearance.backgroundImageBlur}
                                   onChange={handleBlurChange}
                                   className="range-slider-track flex-grow" aria-label="Background blur amount"/>
                            <span
                                className="text-xs text-grey-medium dark:text-neutral-300 w-8 text-right tabular-nums">{currentAppearance.backgroundImageBlur}px</span>
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Background Brightness" htmlFor="bgBrightnessSlider"
                                 description="Adjust background image brightness.">
                        <div className="flex items-center space-x-2 w-[180px]">
                            <input id="bgBrightnessSlider" type="range" min="0" max="200" step="5"
                                   value={currentAppearance.backgroundImageBrightness}
                                   onChange={handleBrightnessChange}
                                   className="range-slider-track flex-grow"
                                   aria-label="Background brightness percentage"/>
                            <span
                                className="text-xs text-grey-medium dark:text-neutral-300 w-8 text-right tabular-nums">{currentAppearance.backgroundImageBrightness}%</span>
                        </div>
                    </SettingsRow>
                </>
            )}
        </div>
    );
});
AppearanceSettings.displayName = 'AppearanceSettings';

const defaultPreferencesFromAtoms = defaultPreferencesSettingsForApi();

const PreferencesSettings: React.FC = memo(() => {
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
        {value: 'none', label: 'None'},
        {value: 'today', label: 'Today'},
        {value: 'tomorrow', label: 'Tomorrow'},
    ];
    const priorityOptions = [
        {value: 'none', label: 'No Priority'},
        {value: '1', label: 'High (P1)'},
        {value: '2', label: 'Medium (P2)'},
        {value: '3', label: 'Low (P3)'},
    ];
    const listOptions = useMemo(() => {
        return userLists.map(l => ({
            value: l,
            label: l
        }));
    }, [userLists]);

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

    return (
        <div className="space-y-0">
            <SettingsRow label="Language" description="Change the application display language."
                         htmlFor="languageSelect">
                {renderSelect('languageSelect', currentPreferences.language, handleLanguageChange, [{
                    value: 'en',
                    label: 'English'
                }, {value: 'zh-CN', label: '简体中文'}], "Select Language")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default Due Date" description="Set the default due date for newly created tasks."
                         htmlFor="defaultDueDateSelect">
                {renderSelect('defaultDueDateSelect', currentPreferences.defaultNewTaskDueDate, handleDefaultDueDateChange, dueDateOptions, "Select Due Date")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default Priority" description="Set the default priority for newly created tasks."
                         htmlFor="defaultPrioritySelect">
                {renderSelect('defaultPrioritySelect', currentPreferences.defaultNewTaskPriority?.toString() ?? 'none', handleDefaultPriorityChange, priorityOptions, "Select Priority")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default List" description="Set the default list for newly created tasks."
                         htmlFor="defaultListSelect">
                {renderSelect('defaultListSelect', currentPreferences.defaultNewTaskList, handleDefaultListChange, listOptions, "Select List")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Confirm Deletions"
                         description="Show a confirmation dialog before moving tasks to trash."
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

const PremiumSettings: React.FC = memo(() => {
    const premiumInfo = useAtomValue(premiumSettingsAtom);
    const currentUser = useAtomValue(currentUserAtom);
    const [isLoading, setIsLoading] = useState(false);

    const handleUpgrade = async (tierId: string) => {
        if (!currentUser) {
            alert("Please log in to upgrade.");
            return;
        }
        setIsLoading(true);
        // This would call a real backend endpoint to get a checkout URL
        // const response = await apiService.apiUpgradeToPro(currentUser.id, tierId);
        await new Promise(res => setTimeout(res, 1000)); // Simulate network
        setIsLoading(false);
        // if (response.success && response.checkoutUrl) {
        alert(`Simulating redirect to upgrade page for tier ${tierId}.`);
        // window.open(response.checkoutUrl, '_blank');
        // } else {
        //     alert(`Upgrade failed: ${response.error || 'Could not initiate upgrade process.'}`);
        // }
    };

    const handleManageSubscription = async () => {
        if (!currentUser) {
            alert("Please log in to manage your subscription.");
            return;
        }
        setIsLoading(true);
        // This would call a real backend endpoint to get a portal URL
        // const response = await apiService.apiManageSubscription(currentUser.id);
        await new Promise(res => setTimeout(res, 1000)); // Simulate network
        setIsLoading(false);
        // if (response.success && response.portalUrl) {
        alert(`Simulating redirect to subscription management portal.`);
        // window.open(response.portalUrl, '_blank');
        // } else {
        //     alert(`Could not open subscription portal: ${response.error || 'Unknown error.'}`);
        // }
    };

    const premiumTiers = [
        {
            id: "free",
            name: "Free Tier",
            price: "Free",
            features: ["Basic Task Management", "Up to 3 Lists", "Standard AI Summary"],
            current: premiumInfo.tier === 'free'
        },
        {
            id: "pro",
            name: "Pro Tier",
            price: "$5/month",
            features: ["Unlimited Lists & Tasks", "Advanced AI Summary Options", "Priority Support", "Cloud Backup & Sync"],
            current: premiumInfo.tier === 'pro'
        },
    ];

    return (
        <div className="space-y-6 relative">
            {isLoading && <div
                className="absolute inset-0 bg-white/50 dark:bg-neutral-800/50 flex items-center justify-center z-10"><Icon
                name="loader" className="animate-spin text-primary" size={24}/></div>}
            <div
                className="p-4 rounded-base bg-primary-light/50 dark:bg-primary-dark/20 border border-primary/30 dark:border-primary-dark/40">
                <div className="flex items-center">
                    <Icon name="crown" size={24} className="text-primary dark:text-primary-light mr-3"/>
                    <div>
                        <h3 className="text-md font-medium text-primary dark:text-primary-light">
                            {premiumInfo.tier === 'pro' ? "You are a Premium Member!" : "Unlock Premium Features"}
                        </h3>
                        {premiumInfo.tier === 'pro' && premiumInfo.subscribedUntil && (
                            <p className="text-xs text-primary/80 dark:text-primary-light/80">
                                Your subscription is active
                                until {new Date(premiumInfo.subscribedUntil).toLocaleDateString()}.
                            </p>
                        )}
                        {premiumInfo.tier !== 'pro' && (
                            <p className="text-xs text-primary/80 dark:text-primary-light/80">
                                Supercharge your productivity with exclusive features.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {premiumTiers.map(tier => (
                    <div key={tier.name} className={twMerge(
                        "p-4 rounded-lg border",
                        tier.current ? "border-primary dark:border-primary-light bg-primary-light/30 dark:bg-primary-dark/10" : "border-grey-light dark:border-neutral-700 bg-grey-ultra-light dark:bg-neutral-750"
                    )}>
                        <h4 className="text-md font-semibold text-grey-dark dark:text-neutral-100 mb-1">{tier.name}</h4>
                        <p className="text-lg font-medium text-primary dark:text-primary-light mb-3">{tier.price}</p>
                        <ul className="space-y-1.5 text-xs text-grey-medium dark:text-neutral-300 mb-4">
                            {tier.features.map(feature => (
                                <li key={feature} className="flex items-start">
                                    <Icon name="check" size={12} strokeWidth={2.5}
                                          className="text-success mr-1.5 mt-0.5 flex-shrink-0"/>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        {premiumInfo.tier === 'free' && tier.id === "pro" && (
                            <Button variant="primary" fullWidth onClick={() => handleUpgrade(tier.id)}
                                    disabled={isLoading}>Upgrade to Pro</Button>
                        )}
                        {premiumInfo.tier === 'pro' && tier.id === "pro" && (
                            <Button variant="secondary" fullWidth onClick={handleManageSubscription}
                                    disabled={isLoading}>Manage Subscription</Button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});
PremiumSettings.displayName = 'PremiumSettings';

const AboutSettings: React.FC = memo(() => {
    const [activeContent, setActiveContent] = useState<'changelog' | 'privacy' | 'terms' | null>(null);

    const contentMap = {
        changelog: {title: 'Update Changelog', html: CHANGELOG_HTML},
        privacy: {title: 'Privacy Policy', html: PRIVACY_POLICY_HTML},
        terms: {title: 'Terms of Use', html: TERMS_OF_USE_HTML},
    };

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
            <SettingsRow label="Application Version" value={APP_VERSION}/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Changelog" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'changelog' ? null : 'changelog')}>
                    {activeContent === 'changelog' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'changelog' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Privacy Policy" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'privacy' ? null : 'privacy')}>
                    {activeContent === 'privacy' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'privacy' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Terms of Use" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'terms' ? null : 'terms')}>
                    {activeContent === 'terms' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'terms' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Feedback & Suggestions" description="We'd love to hear from you!">
                <Button as="a" href="mailto:feedback@tada-app.example.com?subject=Tada App Feedback"
                        variant="secondary"
                        size="sm" icon="mail">
                    Send Email
                </Button>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Report an Issue" description="Found a bug? Let us know.">
                <Button as="a" href="mailto:support@tada-app.example.com?subject=Tada App Issue Report"
                        variant="secondary" size="sm" icon="alert-circle"
                        className="text-warning hover:!bg-warning/10 dark:text-warning dark:hover:!bg-warning/20">
                    Report Issue
                </Button>
            </SettingsRow>
        </div>
    );
});
AboutSettings.displayName = 'AboutSettings';


const SettingsModal: React.FC = () => {
    const [isOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);
    const handleOpenChange = useCallback((open: boolean) => {
        setIsSettingsOpen(open);
    }, [setIsSettingsOpen]);
    const handleTabClick = useCallback((id: SettingsTab) => setSelectedTab(id), [setSelectedTab]);
    const renderContent = useMemo(() => {
        switch (selectedTab) {
            case 'account':
                return <AccountSettings/>;
            case 'appearance':
                return <AppearanceSettings/>;
            case 'preferences':
                return <PreferencesSettings/>;
            case 'premium':
                return <PremiumSettings/>;
            case 'about':
                return <AboutSettings/>;
            default:
                return <AccountSettings/>;
        }
    }, [selectedTab]);
    const modalTitle = useMemo(() => settingsSections.find(s => s.id === selectedTab)?.label ?? 'Settings', [selectedTab]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white dark:bg-neutral-800 w-full max-w-3xl h-[75vh] max-h-[650px]",
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
                                    <span>{item.label}</span>
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