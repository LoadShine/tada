// src/components/layout/MainLayout.tsx
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtomValue } from 'jotai'; // Use useAtomValue for read-only state
import { isSettingsOpenAtom } from '@/store/atoms';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from "@/components/common/Icon";
import { twMerge } from 'tailwind-merge';

// Simple Loading Spinner Component
const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-full w-full bg-canvas">
        {/* Use motion for a subtle spinning animation */}
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="text-primary" // Apply color directly
        >
            <Icon name="loader" size={28} />
        </motion.div>
    </div>
);

// Main Layout Component
const MainLayout: React.FC = () => {
    // Read UI state atoms
    const isSettingsOpen = useAtomValue(isSettingsOpenAtom);
    // isAddListModalOpen is managed within Sidebar's AnimatePresence now

    const location = useLocation();

    // Determine if sidebar should be hidden based on route path
    // Hide for Calendar and Summary views
    const hideSidebar = ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));

    return (
        // Main container: Full screen height, flex layout
        <div className="flex h-screen bg-canvas overflow-hidden">
            {/* Icon Bar (Always visible) */}
            <IconBar />

            {/* Conditionally rendered Sidebar with animation */}
            {/* AnimatePresence handles the mount/unmount animation */}
            <AnimatePresence initial={false}>
                {!hideSidebar && (
                    <motion.div
                        key="sidebar" // Consistent key for AnimatePresence
                        // Animation variants
                        initial={{ width: 0, opacity: 0, marginRight: '-1px' }} // Start collapsed, negative margin hides border
                        animate={{ width: 224, opacity: 1, marginRight: '0px' }} // Animate to full width (w-56 = 224px)
                        exit={{ width: 0, opacity: 0, marginRight: '-1px', transition: { duration: 0.15, ease: 'easeIn' } }} // Faster exit
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} // Standard cubic bezier ease
                        className="flex-shrink-0 h-full" // Prevent shrinking, full height
                        style={{ overflow: 'hidden' }} // Clip content during animation
                    >
                        {/* Render the Sidebar component */}
                        <Sidebar />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main content area */}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col", // Flex-grow, hide overflow, relative for potential overlays
                // Apply layout animation for smooth transition when sidebar appears/disappears
                // Using motion.main instead of transition class for better control with framer-motion
            )}>
                {/* Use Suspense for lazy-loaded routes */}
                <Suspense fallback={<LoadingSpinner />}>
                    {/* Outlet renders the component for the matched route */}
                    <Outlet />
                </Suspense>
            </main>

            {/* Animated Modals (Settings, Add List is handled in Sidebar) */}
            <AnimatePresence>
                {isSettingsOpen && <SettingsModal key="settings-modal" />}
            </AnimatePresence>
        </div>
    );
};

export default MainLayout;