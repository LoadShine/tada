// src/components/layout/MainLayout.tsx
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtomValue } from 'jotai';
import { isSettingsOpenAtom, searchTermAtom } from '@/store/atoms';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from "@/components/common/Icon";
import { twMerge } from 'tailwind-merge';

// Simple Loading Spinner Component
const LoadingSpinner: React.FC = () => (
    // Full screen glass overlay for loading
    <div className="absolute inset-0 flex items-center justify-center bg-glass/70 backdrop-blur-md z-50">
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="text-primary"
        >
            <Icon name="loader" size={32} />
        </motion.div>
    </div>
);

// Main Layout Component
const MainLayout: React.FC = () => {
    const isSettingsOpen = useAtomValue(isSettingsOpenAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const location = useLocation();

    // Hide sidebar for Calendar/Summary unless actively searching
    const hideSidebar = !searchTerm && ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));

    return (
        <div className="flex h-screen bg-canvas-alt overflow-hidden"> {/* Use alt canvas for subtle contrast */}
            <IconBar />

            {/* Animated Sidebar */}
            <AnimatePresence initial={false}>
                {!hideSidebar && (
                    <motion.div
                        key="sidebar"
                        // Animate width and opacity for smooth slide-in/out
                        initial={{ width: 0, opacity: 0, marginRight: 0 }} // Start fully collapsed
                        animate={{ width: 224, opacity: 1, marginRight: 0 }}
                        exit={{ width: 0, opacity: 0, marginRight: 0, transition: { duration: 0.2, ease: 'easeIn' } }} // Faster ease-in exit
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} // Emphasized ease for entrance
                        className="flex-shrink-0 h-full relative" // Add relative positioning if needed
                        style={{ overflow: 'hidden' }} // Crucial to clip content during animation
                    >
                        <Sidebar />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main content area */}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col min-w-0",
                // Apply a base glass effect to the main content area backdrop
                "bg-glass/30 backdrop-blur-lg" // Subtle base glass for main area
            )}>
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet />
                </Suspense>
            </main>

            {/* Animated Modals */}
            <AnimatePresence>
                {isSettingsOpen && <SettingsModal key="settings-modal" />}
                {/* Add other potential modals here */}
            </AnimatePresence>
        </div>
    );
};

export default MainLayout;