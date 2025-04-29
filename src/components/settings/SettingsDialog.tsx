// src/components/settings/SettingsDialog.tsx
import React, { useCallback, useMemo, memo } from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom } from '@/store/atoms';
import { SettingsTab } from '@/types';
import Icon from '../common/Icon';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { IconName } from "@/components/common/IconMap";

// Settings Sections Definition (Unchanged)
interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}
const settingsSections: SettingsItem[] = [
    { id: 'account', label: 'Account', icon: 'user' },
    { id: 'appearance', label: 'Appearance', icon: 'settings' },
    { id: 'premium', label: 'Premium', icon: 'crown' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'share' },
    { id: 'about', label: 'About', icon: 'info' },
];

// Reusable Settings Row (Refactored for Simplicity)
const SettingsRow: React.FC<{label: string, children: React.ReactNode, description?: string, className?: string}> =
    memo(({label, children, description, className}) => (
        <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-border last:border-b-0 min-h-[50px]", className)}>
            <div className="mb-1.5 sm:mb-0 sm:mr-4">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 justify-end">
                {children}
            </div>
        </div>
    ));
SettingsRow.displayName = 'SettingsRow';

// Account Settings Panel (Refactored)
const AccountSettings: React.FC = memo(() => {
    const [currentUser] = useAtom(currentUserAtom);
    const handleEdit = useCallback(() => console.log("Edit action triggered"), []);
    const handleChangePassword = useCallback(() => console.log("Change password action triggered"), []);
    const handleUnlink = useCallback(() => console.log("Unlink Google action triggered"), []);
    const handleLinkApple = useCallback(() => console.log("Link Apple ID action triggered"), []);
    const handleBackup = useCallback(() => console.log("Backup action triggered"), []);
    const handleImport = useCallback(() => console.log("Import action triggered"), []);
    const handleDeleteAccount = useCallback(() => console.log("Delete account action triggered"), []);
    const handleLogout = useCallback(() => { console.log("Logout action triggered"); }, []);

    const userName = useMemo(() => currentUser?.name ?? 'Guest User', [currentUser?.name]);
    const userEmail = useMemo(() => currentUser?.email ?? 'No email provided', [currentUser?.email]);
    const isPremium = useMemo(() => currentUser?.isPremium ?? false, [currentUser?.isPremium]);
    const avatarSrc = useMemo(() => currentUser?.avatar, [currentUser?.avatar]);
    const avatarInitial = useMemo(() => currentUser?.name?.charAt(0).toUpperCase(), [currentUser?.name]);

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center space-x-4 mb-4">
                <Avatar className="w-16 h-16 border-2 border-background shadow-md">
                    <AvatarImage src={avatarSrc} alt={userName} />
                    <AvatarFallback className="text-2xl bg-muted">
                        {avatarInitial || <Icon name="user" size={24}/>}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="text-xl font-semibold text-foreground">{userName}</h3>
                    <p className="text-sm text-muted-foreground">{userEmail}</p>
                    {isPremium && (
                        <div className="mt-1.5 inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-400/15 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700/50">
                            <Icon name="crown" size={12} className="mr-1 text-yellow-600 dark:text-yellow-400" />
                            Premium Member
                        </div>
                    )}
                </div>
            </div>

            {/* Account Details */}
            <div>
                <SettingsRow label="Name">
                    <span className="text-sm text-muted-foreground mr-4">{userName}</span>
                    <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
                </SettingsRow>
                <SettingsRow label="Email Address" description="Used for login and notifications.">
                    <span className="text-sm text-muted-foreground">{userEmail}</span>
                </SettingsRow>
                <SettingsRow label="Password">
                    <Button variant="outline" size="sm" onClick={handleChangePassword}>Change Password</Button>
                </SettingsRow>
            </div>

            {/* Connected Accounts */}
            <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-4">Connected Accounts</h4>
                <SettingsRow label="Google Account">
                    <span className="text-sm text-muted-foreground mr-4">{currentUser?.email ? "Linked" : "Not Linked"}</span>
                    {currentUser?.email && <Button variant="link" size="sm" className="text-destructive hover:text-destructive/80 px-1 h-auto" onClick={handleUnlink}>Unlink</Button>}
                </SettingsRow>
                <SettingsRow label="Apple ID">
                    <Button variant="outline" size="sm" onClick={handleLinkApple}>Link Apple ID</Button>
                </SettingsRow>
            </div>

            {/* Data Management */}
            <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-4">Data Management</h4>
                <SettingsRow label="Backup & Restore" description="Save or load your task data.">
                    <Button variant="outline" size="sm" icon="download" onClick={handleBackup}>Backup</Button>
                    <Button variant="outline" size="sm" icon="upload" onClick={handleImport}>Import</Button>
                </SettingsRow>
                <SettingsRow label="Delete Account" description="Permanently delete your account and data.">
                    <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>Request Deletion</Button>
                </SettingsRow>
            </div>

            {/* Logout Button */}
            <div className="mt-6">
                <Button variant="outline" size="default" icon="logout" onClick={handleLogout} className="w-full sm:w-auto">
                    Logout
                </Button>
            </div>
        </div>
    );
});
AccountSettings.displayName = 'AccountSettings';

// Placeholder Settings Panel (Refactored)
const PlaceholderSettings: React.FC<{ title: string, icon?: IconName }> = memo(({ title, icon = 'settings' }) => (
    <div className="p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center min-h-[300px]">
        <Icon name={icon} size={48} className="mb-4 text-muted-foreground/50" />
        <p className="text-base font-medium text-foreground">{title} Settings</p>
        <p className="text-xs mt-1.5">Configuration options for {title.toLowerCase()} will appear here.</p>
    </div>
));
PlaceholderSettings.displayName = 'PlaceholderSettings';

// Main Settings Dialog Component (Refactored)
const SettingsDialog: React.FC = () => {
    const [isOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);

    const handleOpenChange = useCallback((open: boolean) => {
        setIsSettingsOpen(open);
    }, [setIsSettingsOpen]);

    // Memoized content rendering logic (unchanged)
    const renderContent = useMemo(() => {
        switch (selectedTab) {
            case 'account': return <AccountSettings />;
            case 'appearance': return <PlaceholderSettings title="Appearance" icon="settings" />;
            case 'premium': return <PlaceholderSettings title="Premium" icon="crown" />;
            case 'notifications': return <PlaceholderSettings title="Notifications" icon="bell" />;
            case 'integrations': return <PlaceholderSettings title="Integrations" icon="share" />;
            case 'about': return <PlaceholderSettings title="About" icon="info" />;
            default:
                if (process.env.NODE_ENV === 'development') console.warn("Unknown settings tab:", selectedTab);
                return <AccountSettings />; // Fallback
        }
    }, [selectedTab]);

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl h-[75vh] max-h-[650px] p-0 gap-0 grid grid-cols-[210px_1fr] overflow-hidden bg-glass-100 backdrop-blur-xl border-border/50">

                {/* Settings Sidebar */}
                <div className="bg-glass-alt-100 backdrop-blur-xl border-r border-border/50 p-3 flex flex-col h-full">
                    <ScrollArea className="flex-1 mt-2">
                        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as SettingsTab)} orientation="vertical" className="w-full">
                            <TabsList className="flex-col h-auto items-start bg-transparent p-0 w-full space-y-0.5">
                                {settingsSections.map((item) => (
                                    <TabsTrigger
                                        key={item.id}
                                        value={item.id}
                                        className={cn(
                                            "w-full justify-start px-2 py-1 h-7 text-sm font-normal data-[state=active]:font-medium data-[state=active]:shadow-none",
                                            "data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <Icon name={item.icon} size={15} className="mr-2 opacity-70" aria-hidden="true"/>
                                        <span>{item.label}</span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </ScrollArea>
                </div>

                {/* Settings Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-glass/50 backdrop-blur-lg relative">
                    <ScrollArea className="flex-1">
                        <div className="p-5">
                            {renderContent}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
};
SettingsDialog.displayName = 'SettingsDialog';
export default SettingsDialog;