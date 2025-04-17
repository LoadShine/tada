// src/components/settings/SettingsModal.tsx
import React from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom } from '@/store/atoms';
import { SettingsTab } from '@/types';
import Icon, { IconName } from '../common/Icon';
import Button from '../common/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

// Define Setting Sections and Items
interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

// Updated list based on SettingsTab type
const settingsSections: SettingsItem[] = [
    { id: 'account', label: 'Account', icon: 'user' },
    { id: 'appearance', label: 'Appearance', icon: 'settings' }, // Using 'settings' instead of 'sun'/'moon'
    { id: 'premium', label: 'Premium', icon: 'crown' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'share' },
    { id: 'about', label: 'About', icon: 'info' },
];

// Placeholder Content Components for each tab
const AccountSettings: React.FC = () => {
    const [currentUser] = useAtom(currentUserAtom);
    return (
        <div className="space-y-5 animate-fade-in">
            {/* User Header */}
            <div className="flex items-center space-x-4 mb-6">
                <motion.div
                    className="w-16 h-16 rounded-full overflow-hidden shadow-medium flex-shrink-0 border border-black/5" // Add subtle border
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
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
                    <h3 className="text-lg font-semibold text-gray-800">{currentUser?.name}</h3>
                    <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                    {currentUser?.isPremium && (
                        <div className="text-xs text-yellow-700 flex items-center mt-1 font-medium bg-yellow-400/20 px-1.5 py-0.5 rounded-full w-fit">
                            <Icon name="crown" size={12} className="mr-1 text-yellow-600" />
                            <span>Premium</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Form-like settings */}
            <div className="space-y-1">
                <SettingsRow label="Name" value={currentUser?.name} action={<Button variant="link" size="sm">Edit</Button>} />
                <SettingsRow label="Email" value={currentUser?.email} />
                <SettingsRow label="Password" action={<Button variant="link" size="sm">Change Password</Button>} />
            </div>
            <hr className="border-border-color/60 my-3"/>
            <div className="space-y-1">
                <SettingsRow label="Google Account" value="Linked" action={<Button variant="link" size="sm" className="text-muted-foreground">Unlink</Button>} />
                <SettingsRow label="Apple Account" action={<Button variant="link" size="sm">Link Apple ID</Button>} />
            </div>
            <hr className="border-border-color/60 my-3"/>
            <div className="space-y-1">
                {/* Use icons in buttons */}
                <SettingsRow label="Backup & Restore">
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" icon="download">Backup</Button>
                        <Button variant="outline" size="sm" icon="upload">Import</Button>
                    </div>
                </SettingsRow>
                {/* <SettingsRow label="Manage Devices" action={<Button variant="link" size="sm">View Devices</Button>} /> */}
                <SettingsRow label="Delete Account" action={<Button variant="link" size="sm" className="text-red-600 hover:text-red-700">Request Deletion</Button>} />
            </div>
        </div>
    );
};

// Helper component for rows
const SettingsRow: React.FC<{label: string, value?: React.ReactNode, action?: React.ReactNode, children?: React.ReactNode}> = ({label, value, action, children}) => (
    <div className="flex justify-between items-center py-2 min-h-[38px]"> {/* Ensure min height */}
        <span className="text-sm text-gray-600 font-medium">{label}</span>
        <div className="text-sm text-gray-800 flex items-center space-x-3">
            {value && <span className="text-muted-foreground">{value}</span>}
            {action}
            {children}
        </div>
    </div>
);

const PlaceholderSettings: React.FC<{ title: string, icon?: IconName }> = ({ title, icon = 'settings' }) => (
    <div className="p-6 text-center text-gray-400 animate-fade-in h-full flex flex-col items-center justify-center">
        <Icon name={icon} size={40} className="mx-auto mb-4 text-gray-300 opacity-70" />
        <p className="text-sm">Settings for <span className="font-medium text-gray-500">{title}</span></p>
        <p className="text-xs mt-1 text-muted">This section is under construction.</p>
    </div>
);


const SettingsModal: React.FC = () => {
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);

    const handleClose = () => setIsSettingsOpen(false);

    const renderContent = () => {
        switch (selectedTab) {
            case 'account': return <AccountSettings />;
            case 'appearance': return <PlaceholderSettings title="Appearance" icon="settings" />;
            case 'premium': return <PlaceholderSettings title="Premium" icon="crown" />;
            case 'notifications': return <PlaceholderSettings title="Notifications" icon="bell" />;
            case 'integrations': return <PlaceholderSettings title="Integrations" icon="share" />;
            case 'about': return <PlaceholderSettings title="About" icon="info" />;
            default: return <AccountSettings />; // Default to account
        }
    };

    return (
        // Backdrop with blur and fade-in
        <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4" // Increased backdrop blur
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleClose} // Close on backdrop click
        >
            {/* Modal Content with scale-in */}
            <motion.div
                className={twMerge(
                    "bg-canvas w-full max-w-3xl h-[70vh] max-h-[650px] rounded-xl shadow-strong flex overflow-hidden border border-black/5", // Slightly larger max height, rounded-xl
                    // "bg-glass-darker backdrop-blur-xl" // Optional: Apply glass effect to modal background itself
                )}
                initial={{ scale: 0.95, y: 10, opacity: 0 }} // Add slight Y offset
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 10, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} // Emphasized easing
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Sidebar */}
                <div className="w-52 bg-canvas-alt border-r border-black/5 p-3 flex flex-col shrink-0">
                    <h2 className="text-base font-semibold mb-4 px-1.5 mt-1 text-gray-700">Settings</h2>
                    <nav className="space-y-0.5 flex-1 overflow-y-auto styled-scrollbar -mr-1 pr-1">
                        {settingsSections.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedTab(item.id)}
                                className={twMerge(
                                    'flex items-center w-full px-1.5 py-1 h-7 text-sm rounded-md transition-colors duration-100 ease-apple', // Use apple ease
                                    selectedTab === item.id
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-800'
                                )}
                            >
                                <Icon name={item.icon} size={15} className="mr-2 opacity-70" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    {/* Logout Button */}
                    <div className="mt-auto pt-3 border-t border-border-color/60">
                        <Button variant="ghost" size="sm" icon="logout" className="w-full justify-start text-muted-foreground hover:text-red-600 h-7">
                            Logout
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-5 overflow-y-auto styled-scrollbar relative bg-canvas">
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="absolute top-2.5 right-2.5 text-muted-foreground hover:bg-black/5 w-7 h-7"
                        aria-label="Close settings"
                    >
                        <Icon name="x" size={16} />
                    </Button>

                    {/* Render selected tab content with animation */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedTab} // Key change triggers animation
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="h-full pt-2" // Add padding top to clear close button
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettingsModal;