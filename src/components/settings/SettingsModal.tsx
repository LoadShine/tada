// src/components/settings/SettingsModal.tsx
import React from 'react';
import { useAtom } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom } from '@/store/atoms';
import { SettingsTab } from '@/types';
import Icon, { IconName } from '../common/Icon';
import Button from '../common/Button';
import {AnimatePresence, motion} from 'framer-motion';
import { twMerge } from 'tailwind-merge';

// Define Setting Sections and Items
interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

// Reordered and refined settings sections
const settingsSections: SettingsItem[] = [
    { id: 'account', label: 'Account', icon: 'user' },
    { id: 'appearance', label: 'Appearance', icon: 'settings' }, // Moved up
    { id: 'premium', label: 'Premium', icon: 'crown' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'share' }, // Renamed
    { id: 'collaborate', label: 'Collaboration', icon: 'users' }, // Renamed
    { id: 'shortcuts', label: 'Shortcuts', icon: 'terminal' },
    // Maybe hide less common ones under a 'More' category if needed
    // { id: 'features', label: 'Features', icon: 'layers' },
    // { id: 'smart-list', label: 'Smart List', icon: 'list' },
    // { id: 'date-time', label: 'Date & Time', icon: 'clock' },
    // { id: 'more', label: 'More', icon: 'sliders' },
    { id: 'about', label: 'About', icon: 'info' },
];


// Placeholder Content Components for each tab
const AccountSettings: React.FC = () => {
    const [currentUser] = useAtom(currentUserAtom);
    // Simulate loading state for avatar if needed
    // const [avatarLoading, setAvatarLoading] = React.useState(true);
    // React.useEffect(() => {
    //   if (currentUser?.avatar) {
    //     const img = new Image();
    //     img.src = currentUser.avatar;
    //     img.onload = () => setAvatarLoading(false);
    //     img.onerror = () => setAvatarLoading(false); // Handle error case
    //   } else {
    //     setAvatarLoading(false);
    //   }
    // }, [currentUser?.avatar]);


    return (
        // Use animation class for consistency
        <div className="space-y-6 animate-slide-in-up">
            <div className="flex flex-col items-center pt-4 pb-6 border-b border-gray-200/70">
                <motion.div
                    className="w-20 h-20 rounded-full overflow-hidden mb-3 shadow-medium relative group" // Added relative/group for potential upload button
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 12 }}
                >
                    {/* {avatarLoading && <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>} */}
                    {currentUser?.avatar /*&& !avatarLoading*/ ? (
                        <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-3xl font-medium">
                            {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </div>
                    )}
                    {/* Potential Upload Button Overlay */}
                    {/* <button className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Icon name="upload" size={24} />
                    </button> */}
                </motion.div>
                <h3 className="text-lg font-semibold text-gray-800">{currentUser?.name}</h3>
                <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                {currentUser?.isPremium && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100/70 text-yellow-700 text-xs font-medium">
                        <Icon name="crown" size={13} className="mr-1 text-yellow-600" />
                        <span>Premium</span>
                    </div>
                )}
            </div>

            {/* Form-like settings */}
            <div className="space-y-2">
                {/* Example: Using Button for actions */}
                <SettingsRow label="Name">
                    <Button variant="ghost" size="sm" className="text-gray-700 font-normal">{currentUser?.name}</Button>
                </SettingsRow>
                <SettingsRow label="Password">
                    <Button variant="secondary" size="sm">Change Password</Button>
                </SettingsRow>
                <hr className="border-gray-200/60 !my-4"/>
                <SettingsRow label="Google Account" value={<span className="text-muted-foreground">Linked</span>}>
                    <Button variant="link" size="sm" className="text-muted-foreground font-normal text-xs">Unlink</Button>
                </SettingsRow>
                <SettingsRow label="Apple Account">
                    <Button variant="secondary" size="sm" icon="plus">Link Apple ID</Button>
                </SettingsRow>
                <hr className="border-gray-200/60 !my-4"/>
                <SettingsRow label="Backup & Restore">
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" icon="download">Backup Data</Button>
                        <Button variant="outline" size="sm" icon="upload">Import Data</Button>
                    </div>
                </SettingsRow>
                <hr className="border-gray-200/60 !my-4"/>
                <SettingsRow label="Danger Zone">
                    <Button variant="danger" size="sm" icon="trash">Delete Account</Button>
                </SettingsRow>
            </div>
        </div>
    );
};

// Generic Row Component for Settings - improved layout
export const SettingsRow: React.FC<{label: string, value?: string | React.ReactNode, children?: React.ReactNode, description?: string }> =
    ({label, value, children, description}) => (
        <div className="flex justify-between items-center py-2.5 min-h-[44px]">
            <div>
                <span className="text-sm text-gray-700 font-medium block">{label}</span>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <div className="text-sm text-gray-800 flex items-center space-x-3 flex-shrink-0 pl-4">
                {value && <span className="text-muted-foreground">{value}</span>}
                {children}
            </div>
        </div>
    );

// Placeholder for other sections - refined look
const PlaceholderSettings: React.FC<{ title: string }> = ({ title }) => (
    <div className="p-8 text-center text-gray-500 animate-slide-in-up h-full flex flex-col items-center justify-center">
        <Icon name="settings" size={40} className="mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-600 mb-1">Configure {title}</h3>
        <p className="text-sm text-muted-foreground">Settings for "{title}" are not implemented yet.</p>
    </div>
);


const SettingsModal: React.FC = () => {
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);

    const handleClose = () => setIsSettingsOpen(false);

    const renderContent = () => {
        switch (selectedTab) {
            case 'account': return <AccountSettings />;
            case 'appearance': return <PlaceholderSettings title="Appearance" />;
            case 'premium': return <PlaceholderSettings title="Premium" />;
            case 'notifications': return <PlaceholderSettings title="Notifications" />;
            case 'integrations': return <PlaceholderSettings title="Integrations" />;
            case 'collaborate': return <PlaceholderSettings title="Collaboration" />;
            case 'shortcuts': return <PlaceholderSettings title="Shortcuts" />;
            case 'about': return <PlaceholderSettings title="About" />;
            default: return <AccountSettings />; // Default to account
        }
    };

    return (
        // Backdrop with blur and fade-in
        <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center p-4" // Lighter backdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose} // Close on backdrop click
            transition={{ duration: 0.2 }}
        >
            {/* Modal Content with scale-in */}
            <motion.div
                className="bg-canvas w-full max-w-4xl h-[75vh] max-h-[650px] rounded-xl shadow-strong flex overflow-hidden border border-black/5" // Add subtle border
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0.0, 0.2, 1] }} // Emphasized ease
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Sidebar */}
                <div className="w-52 bg-canvas-alt border-r border-gray-200/60 p-3 flex flex-col shrink-0">
                    <h2 className="text-base font-semibold mb-5 px-2 mt-1 text-gray-800">Settings</h2>
                    <nav className="space-y-0.5 flex-1 overflow-y-auto styled-scrollbar -mr-1 pr-1">
                        {settingsSections.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedTab(item.id)}
                                className={twMerge(
                                    'flex items-center w-full px-2 py-1.5 text-sm rounded-md transition-colors duration-100 ease-apple', // Adjusted padding
                                    selectedTab === item.id
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-gray-600 hover:bg-gray-500/10 hover:text-gray-700 active:bg-gray-500/15',
                                    'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 focus-visible:ring-inset' // Custom focus
                                )}
                            >
                                <Icon name={item.icon} size={16} className="mr-2 flex-shrink-0" />
                                <span className="pt-px">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    {/* Logout Button */}
                    <div className="mt-auto pt-3 border-t border-gray-200/60">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="logout"
                            className="w-full justify-start text-muted-foreground hover:text-red-600 hover:bg-red-500/10 font-normal h-8 pl-2" // Style adjustments
                        >
                            Logout
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative bg-canvas">
                    {/* Close Button - More prominent */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="absolute top-2 right-2 text-muted hover:bg-gray-500/10" // Adjust position
                        aria-label="Close settings"
                    >
                        <Icon name="x" size={20} />
                    </Button>

                    {/* Add padding to content area */}
                    <div className="p-6 pt-8">
                        {/* Render selected tab content with animation */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedTab} // Key change triggers animation
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
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