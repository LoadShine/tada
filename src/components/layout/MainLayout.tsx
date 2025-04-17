// src/components/layout/MainLayout.tsx
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtom } from 'jotai';
import { isSettingsOpenAtom } from '@/store/atoms';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from "@/components/common/Icon";
import { twMerge } from 'tailwind-merge';
// import AddListModal from "@/components/common/AddListModal.tsx"; // Import AddListModal for presence animation

// Simple loading spinner component
const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center h-full w-full bg-canvas">
        {/* Use a motion div for subtle animation */}
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
            <Icon name="loader" size={28} className="text-primary" />
        </motion.div>
    </div>
);

const MainLayout: React.FC = () => {
    const [isSettingsOpen] = useAtom(isSettingsOpenAtom);
    // const [isAddListModalOpen] = useAtom(isAddListModalOpenAtom); // Need this for AnimatePresence
    const location = useLocation();

    // Determine if sidebar should be hidden based on route
    const hideSidebar = location.pathname.startsWith('/calendar') || location.pathname.startsWith('/summary');

    return (
        <div className="flex h-screen bg-canvas overflow-hidden">
            <IconBar />

            {/* Conditionally render Sidebar with animation */}
            <AnimatePresence initial={false}>
                {!hideSidebar && (
                    <motion.div
                        key="sidebar"
                        initial={{ width: 0, opacity: 0, marginRight: '-1px' }} // Start collapsed, negative margin hides border initially
                        animate={{ width: 224, opacity: 1, marginRight: '0px' }} // w-56 = 224px
                        exit={{ width: 0, opacity: 0, marginRight: '-1px', transition: {duration: 0.15} }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="flex-shrink-0 h-full" // Needed for AnimatePresence layout animation
                        style={{ overflow: 'hidden' }} // Prevent content spill during animation
                    >
                        <Sidebar />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main content area */}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col",
                // Use motion layout for smoother transitions when sidebar appears/disappears
                "transition-[margin-left] duration-300 ease-in-out"
            )}>
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet /> {/* Renders the matched route component */}
                </Suspense>
            </main>

            {/* Animated Settings Modal */}
            {/* Combine modal presence checks */}
            <AnimatePresence>
                {isSettingsOpen && <SettingsModal key="settings-modal" />}
                {/* AddListModal is rendered within Sidebar component now for its own AnimatePresence */}
            </AnimatePresence>
        </div>
    );
};

export default MainLayout;