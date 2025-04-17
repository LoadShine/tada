// src/components/settings/SettingsModal.tsx
import React from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom } from '@/store/atoms';
import { SettingsTab } from '@/types';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import {IconName} from "@/components/common/IconMap.tsx";

// Define Setting Sections and Items Interface
interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

// Define the sections based on SettingsTab type
const settingsSections: SettingsItem[] = [
    { id: 'account', label: 'Account', icon: 'user' },
    { id: 'appearance', label: 'Appearance', icon: 'settings' }, // More general icon
    { id: 'premium', label: 'Premium', icon: 'crown' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'share' },
    { id: 'about', label: 'About', icon: 'info' },
];

// --- Placeholder Content Components ---

// Helper component for rows in settings pages
const SettingsRow: React.FC<{label: string, value?: React.ReactNode, action?: React.ReactNode, children?: React.ReactNode, description?: string}> =
    ({label, value, action, children, description}) => (
        <div className="flex justify-between items-center py-2.5 min-h-[40px] border-b border-border-color/60 last:border-b-0">
            <div className="flex-1 mr-4">
                <span className="text-sm text-gray-700 font-medium block">{label}</span>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <div className="text-sm text-gray-800 flex items-center space-x-2 flex-shrink-0">
                {/* Render value, action or children */}
                {value && !action && !children && <span className="text-muted-foreground text-right">{value}</span>}
                {action && !children && <div className="flex justify-end">{action}</div>}
                {children && <div className="flex justify-end space-x-2">{children}</div>}
            </div>
        </div>
    );


// Specific Account Settings Content
const AccountSettings: React.FC = () => {
    const [currentUser] = useAtom(currentUserAtom);
    // Placeholder actions - replace with actual logic
    const handleEdit = () => console.log("Edit action");
    const handleChangePassword = () => console.log("Change password action");
    const handleUnlink = () => console.log("Unlink action");
    const handleLinkApple = () => console.log("Link Apple ID action");
    const handleBackup = () => console.log("Backup action");
    const handleImport = () => console.log("Import action");
    const handleDeleteAccount = () => console.log("Delete account action");
    const handleLogout = () => { console.log("Logout action"); /* Add actual logout logic here */ };

    return (
        // Use motion for subtle fade-in of content
        <motion.div
            className="space-y-6" // Add spacing between sections
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            {/* User Profile Header */}
            <div className="flex items-center space-x-4 mb-4">
                <motion.div
                    className="w-16 h-16 rounded-full overflow-hidden shadow-medium flex-shrink-0 border-2 border-white" // Add white border for separation
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                >
                    {currentUser?.avatar ? (
                        <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-2xl font-medium">
                            {currentUser?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                </motion.div>
                <div>
                    <h3 className="text-xl font-semibold text-gray-800">{currentUser?.name}</h3>
                    <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                    {currentUser?.isPremium && (
                        <div className="text-xs text-yellow-700 flex items-center mt-1.5 font-medium bg-yellow-400/20 px-1.5 py-0.5 rounded-full w-fit">
                            <Icon name="crown" size={12} className="mr-1 text-yellow-600" />
                            <span>Premium Member</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Settings */}
            <div className="space-y-0">
                <SettingsRow label="Name" value={currentUser?.name} action={<Button variant="link" size="sm" onClick={handleEdit}>Edit</Button>} />
                <SettingsRow label="Email Address" value={currentUser?.email} description="Used for login and notifications."/>
                <SettingsRow label="Password" action={<Button variant="link" size="sm" onClick={handleChangePassword}>Change Password</Button>} />
            </div>

            {/* Connected Accounts */}
            <div className="space-y-0">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Connected Accounts</h4>
                <SettingsRow label="Google Account" value="Linked" action={<Button variant="link" size="sm" className="text-muted-foreground hover:text-red-600" onClick={handleUnlink}>Unlink</Button>} />
                <SettingsRow label="Apple ID" action={<Button variant="link" size="sm" onClick={handleLinkApple}>Link Apple ID</Button>} />
            </div>

            {/* Data Management */}
            <div className="space-y-0">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Data Management</h4>
                <SettingsRow label="Backup & Restore" description="Save or load your task data.">
                    {/* Use icons in buttons */}
                    <Button variant="outline" size="sm" icon="download" onClick={handleBackup}>Backup</Button>
                    <Button variant="outline" size="sm" icon="upload" onClick={handleImport}>Import</Button>
                </SettingsRow>
                <SettingsRow label="Delete Account" description="Permanently delete your account and data." action={
                    <Button variant="danger" size="sm" onClick={handleDeleteAccount}>Request Deletion</Button>
                } />
            </div>

            {/* Logout Action - Placed logically within Account */}
            <div className="mt-6">
                <Button variant="outline" size="md" icon="logout" onClick={handleLogout} className="w-full sm:w-auto">
                    Logout
                </Button>
            </div>
        </motion.div>
    );
};

// Generic Placeholder for other sections
const PlaceholderSettings: React.FC<{ title: string, icon?: IconName }> = ({ title, icon = 'settings' }) => (
    <motion.div
        className="p-6 text-center text-gray-400 h-full flex flex-col items-center justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
    >
        <Icon name={icon} size={44} className="mx-auto mb-4 text-gray-300 opacity-70" />
        <p className="text-base font-medium text-gray-500">{title} Settings</p>
        <p className="text-xs mt-1.5 text-muted">Configuration options for {title.toLowerCase()} will appear here.</p>
    </motion.div>
);


// Main Settings Modal Component
const SettingsModal: React.FC = () => {
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);
    // const handleLogout = () => { console.log("Logout action"); /* Add actual logout logic */ setIsSettingsOpen(false); };

    const handleClose = () => setIsSettingsOpen(false);

    const renderContent = () => {
        switch (selectedTab) {
            case 'account': return <AccountSettings />;
            case 'appearance': return <PlaceholderSettings title="Appearance" icon="settings" />;
            case 'premium': return <PlaceholderSettings title="Premium" icon="crown" />;
            case 'notifications': return <PlaceholderSettings title="Notifications" icon="bell" />;
            case 'integrations': return <PlaceholderSettings title="Integrations" icon="share" />;
            case 'about': return <PlaceholderSettings title="About" icon="info" />;
            default:
                console.warn("Unknown settings tab:", selectedTab);
                return <AccountSettings />; // Default to account
        }
    };

    return (
        // Backdrop
        <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" // Standard blur/opacity
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleClose} // Close on backdrop click
            aria-modal="true"
            role="dialog"
            aria-labelledby="settingsModalTitle" // Title is inside the modal content
        >
            {/* Modal Content */}
            <motion.div
                className={twMerge(
                    "bg-glass-100 w-full max-w-3xl h-[75vh] max-h-[600px]", // Slightly reduced max-height, use glass bg
                    "rounded-lg shadow-strong flex overflow-hidden border border-black/5" // Standard radius, strong shadow
                )}
                initial={{ scale: 0.95, y: 10, opacity: 0 }} // Subtle entry animation
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 5, opacity: 0, transition: { duration: 0.15 } }} // Subtle exit
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} // Emphasized ease
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Settings Sidebar */}
                <div className="w-52 bg-canvas-alt/80 border-r border-black/5 p-3 flex flex-col shrink-0"> {/* Slightly transparent alt bg */}
                    {/* Optional: Title in sidebar */}
                    {/* <h2 className="text-base font-semibold mb-4 px-1.5 mt-1 text-gray-700">Settings</h2> */}
                    {/* Navigation */}
                    <nav className="space-y-0.5 flex-1 mt-2">
                        {settingsSections.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedTab(item.id)}
                                className={twMerge(
                                    'flex items-center w-full px-2 py-1 h-7 text-sm rounded-md transition-colors duration-100 ease-apple', // Standard item style
                                    selectedTab === item.id
                                        ? 'bg-primary/10 text-primary font-medium' // Active state
                                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-800' // Inactive state
                                )}
                                aria-current={selectedTab === item.id ? 'page' : undefined}
                            >
                                <Icon name={item.icon} size={15} className="mr-2 opacity-70" aria-hidden="true"/>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    {/* Logout Button (Moved to Account section for better context) */}
                    {/* <div className="mt-auto pt-3 border-t border-border-color/60">
                        <Button variant="ghost" size="sm" icon="logout" className="w-full justify-start text-muted-foreground hover:text-red-600 h-7 px-2" onClick={handleLogout}>
                            Logout
                        </Button>
                    </div> */}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-canvas relative">
                    {/* Header within content area */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border-color/60 flex-shrink-0 h-[53px]">
                        <h2 id="settingsModalTitle" className="text-lg font-semibold text-gray-800">
                            {settingsSections.find(s => s.id === selectedTab)?.label ?? 'Settings'}
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            className="text-muted-foreground hover:bg-black/5 w-7 h-7 -mr-2" // Standard close button
                            aria-label="Close settings"
                        >
                            <Icon name="x" size={16} />
                        </Button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 p-5 overflow-y-auto styled-scrollbar">
                        {/* Animated Content Switch */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedTab} // Key change triggers animation
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                            >
                                {renderContent()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettingsModal;