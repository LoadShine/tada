// src/components/settings/SettingsModal.tsx
import React, {memo, useCallback, useMemo} from 'react';
import {useAtom} from 'jotai';
import {currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom} from '@/store/atoms';
import {SettingsTab} from '@/types';
import Icon from '../common/Icon';
import Button from '../common/Button';
import {twMerge} from 'tailwind-merge';
import {IconName} from "@/components/common/IconMap";
import * as Dialog from '@radix-ui/react-dialog';

interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    {
        id: 'account',
        label: 'Account',
        icon: 'user'
    }, {
        id: 'appearance',
        label: 'Appearance',
        icon: 'settings'
    }, {
        id: 'premium',
        label: 'Premium',
        icon: 'crown'
    }, {
        id: 'about',
        label: 'About',
        icon: 'info'
    },
];
const SettingsRow: React.FC<{
    label: string,
    value?: React.ReactNode,
    action?: React.ReactNode,
    children?: React.ReactNode,
    description?: string
}> = memo(({label, value, action, children, description}) => (
    <div className="flex justify-between items-center py-3 min-h-[48px]">
        <div className="flex-1 mr-4"><span
            className="text-[13px] text-grey-dark font-normal block">{label}</span> {description &&
            <p className="text-[11px] text-grey-medium mt-0.5 font-light">{description}</p>} </div>
        <div
            className="text-[13px] text-grey-dark font-light flex items-center space-x-2 flex-shrink-0"> {value && !action && !children &&
            <span className="text-grey-medium text-right font-normal">{value}</span>} {action && !children &&
            <div className="flex justify-end">{action}</div>} {children &&
            <div className="flex justify-end space-x-2">{children}</div>} </div>
    </div>));
SettingsRow.displayName = 'SettingsRow';
const AccountSettings: React.FC = memo(() => {
    const [currentUser] = useAtom(currentUserAtom);
    const handleEdit = useCallback(() => console.log("Edit action triggered"), []);
    const handleChangePassword = useCallback(() => console.log("Change password action triggered"), []);
    const handleUnlink = useCallback(() => console.log("Unlink Google action triggered"), []);
    const handleLinkApple = useCallback(() => console.log("Link Apple ID action triggered"), []);
    const handleBackup = useCallback(() => console.log("Backup action triggered"), []);
    const handleImport = useCallback(() => console.log("Import action triggered"), []);
    const handleDeleteAccount = useCallback(() => console.log("Delete account action triggered"), []);
    const handleLogout = useCallback(() => {
        console.log("Logout action triggered");
    }, []);
    const userName = useMemo(() => currentUser?.name ?? 'Guest User', [currentUser?.name]);
    const userEmail = useMemo(() => currentUser?.email ?? 'No email provided', [currentUser?.email]);
    const isPremium = useMemo(() => currentUser?.isPremium ?? false, [currentUser?.isPremium]);
    const avatarSrc = useMemo(() => currentUser?.avatar, [currentUser?.avatar]);
    const avatarInitial = useMemo(() => currentUser?.name?.charAt(0).toUpperCase(), [currentUser?.name]);
    return (<div className="space-y-6">
        <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-grey-ultra-light"> {avatarSrc ? (
                <img src={avatarSrc} alt={userName} className="w-full h-full object-cover"/>) : (<div
                className="w-full h-full bg-grey-light flex items-center justify-center text-grey-medium text-2xl font-normal"> {avatarInitial ||
                <Icon name="user" size={24} strokeWidth={1}/>} </div>)} </div>
            <div><h3 className="text-[18px] font-normal text-grey-dark">{userName}</h3> <p
                className="text-[13px] text-grey-medium font-light">{userEmail}</p> {isPremium && (<div
                className="text-[11px] text-primary flex items-center mt-1.5 font-normal bg-primary-light px-2 py-0.5 rounded-full w-fit">
                <Icon name="crown" size={12} className="mr-1 text-primary" strokeWidth={1.5}/>
                <span>Premium Member</span></div>)} </div>
        </div>
        <div className="space-y-0"><SettingsRow label="Name" value={userName} action={<Button variant="link" size="sm"
                                                                                              onClick={handleEdit}>Edit</Button>}/>
            <div className="h-px bg-grey-light my-0"></div>
            <SettingsRow label="Email Address" value={userEmail} description="Used for login and notifications."/>
            <div className="h-px bg-grey-light my-0"></div>
            <SettingsRow label="Password" action={<Button variant="link" size="sm" onClick={handleChangePassword}>Change
                Password</Button>}/></div>
        <div className="space-y-0"><h4
            className="text-[11px] font-normal text-grey-medium uppercase tracking-[0.5px] mb-2 mt-4">Connected
            Accounts</h4> <SettingsRow label="Google Account" value={currentUser?.email ? "Linked" : "Not Linked"}
                                       action={currentUser?.email ? <Button variant="link" size="sm"
                                                                            className="text-grey-medium hover:text-error"
                                                                            onClick={handleUnlink}>Unlink</Button> : undefined}/>
            <div className="h-px bg-grey-light my-0"></div>
            <SettingsRow label="Apple ID"
                         action={<Button variant="link" size="sm" onClick={handleLinkApple}>Link Apple ID</Button>}/>
        </div>
        <div className="space-y-0"><h4
            className="text-[11px] font-normal text-grey-medium uppercase tracking-[0.5px] mb-2 mt-4">Data
            Management</h4> <SettingsRow label="Backup & Restore" description="Save or load your task data."> <Button
            variant="secondary" size="sm" icon="download" onClick={handleBackup}>Backup</Button> <Button
            variant="secondary" size="sm" icon="upload" onClick={handleImport}>Import</Button> </SettingsRow>
            <div className="h-px bg-grey-light my-0"></div>
            <SettingsRow label="Delete Account" description="Permanently delete your account and data."
                         action={<Button variant="danger" size="sm" onClick={handleDeleteAccount}>Request
                             Deletion</Button>}/></div>
        <div className="mt-8"><Button variant="secondary" size="md" icon="logout" onClick={handleLogout}
                                      className="w-full sm:w-auto">Logout</Button></div>
    </div>);
});
AccountSettings.displayName = 'AccountSettings';
const PlaceholderSettings: React.FC<{ title: string, icon?: IconName }> = memo(({title, icon = 'settings'}) => (
    <div className="p-6 text-center text-grey-medium h-full flex flex-col items-center justify-center"><Icon name={icon}
                                                                                                             size={40}
                                                                                                             strokeWidth={1}
                                                                                                             className="mx-auto mb-4 text-grey-light opacity-70"/>
        <p className="text-[14px] font-normal text-grey-dark">{title} Settings</p> <p
            className="text-[12px] mt-1.5 text-grey-medium font-light">Configuration options
            for {title.toLowerCase()} will appear here.</p></div>));
PlaceholderSettings.displayName = 'PlaceholderSettings';

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
                return <PlaceholderSettings title="Appearance" icon="settings"/>;
            case 'premium':
                return <PlaceholderSettings title="Premium" icon="crown"/>;
            case 'about':
                return <PlaceholderSettings title="About" icon="info"/>;
            default:
                return <AccountSettings/>;
        }
    }, [selectedTab]);
    const modalTitle = useMemo(() => settingsSections.find(s => s.id === selectedTab)?.label ?? 'Settings', [selectedTab]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white w-full max-w-3xl h-[75vh] max-h-[650px]",
                        "rounded-base shadow-modal flex overflow-hidden",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    aria-describedby={undefined}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                >
                    <div className="w-52 bg-grey-ultra-light p-3 flex flex-col shrink-0">
                        <nav className="space-y-0.5 flex-1 mt-2">
                            {settingsSections.map((item) => (
                                <button key={item.id} onClick={() => handleTabClick(item.id)}
                                        className={twMerge('flex items-center w-full px-3 py-2 h-8 text-[13px] rounded-base transition-colors duration-200 ease-in-out',
                                            selectedTab === item.id ? 'bg-grey-light text-primary font-normal' : 'text-grey-dark font-light hover:bg-grey-light hover:text-grey-dark',
                                            'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-grey-ultra-light'
                                        )} aria-current={selectedTab === item.id ? 'page' : undefined}>
                                    {/* Icon opacity increased for better visibility */}
                                    <Icon name={item.icon} size={16} strokeWidth={1} className="mr-2.5 opacity-90"
                                          aria-hidden="true"/>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
                        <div
                            className="flex items-center justify-between px-6 py-4 border-b border-grey-light flex-shrink-0 h-[60px]">
                            <Dialog.Title className="text-[16px] font-normal text-grey-dark">{modalTitle}</Dialog.Title>
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" icon="x"
                                        className="text-grey-medium hover:bg-grey-light hover:text-grey-dark w-7 h-7 -mr-2"
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