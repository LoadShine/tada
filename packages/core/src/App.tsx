import React, { Suspense, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAtomValue } from 'jotai';
import {
    aiSettingsAtom,
    appearanceSettingsAtom,
    preferencesSettingsAtom,
    storedSummariesAtom,
    tasksAtom,
    userListsAtom,
    userProfileAtom,
} from '@/store/jotai';
import AppRouter from '@/router';
import SettingsApplicator from '@/components/global/SettingsApplicator';
import DailyTaskRefresh from '@/components/global/DailyTaskRefresh';
import GlobalStatusDisplay from '@/components/global/GlobalStatusDisplay';
import ScheduledReportGenerator from '@/components/global/ScheduledReportGenerator';
import ScheduledReportModal from '@/components/global/ScheduledReportModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { OnboardingScreen } from '@/components/features/onboarding/OnboardingScreen';
import storageManager from '@/services/storageManager';
import { useIcsAutoSync } from '@/services/icsAutoSync';

/**
 * The root component of the application.
 * It initializes global state from storage, sets up global components,
 * and renders the main application router.
 */
const App: React.FC = () => {
    // These calls ensure the atoms are initialized and start loading data
    // from the storage service on app load. Their values are used by other components.
    useAtomValue(tasksAtom);
    useAtomValue(userListsAtom);
    useAtomValue(appearanceSettingsAtom);
    useAtomValue(preferencesSettingsAtom);
    useAtomValue(aiSettingsAtom);
    useAtomValue(storedSummariesAtom);

    // User profile for onboarding check
    const userProfile = useAtomValue(userProfileAtom);

    // Local state to control onboarding visibility (allows closing without re-render issues)
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Determine if onboarding should be shown
    useEffect(() => {
        if (userProfile && !userProfile.onboardingCompleted) {
            setShowOnboarding(true);
        }
    }, [userProfile]);

    // Auto sync tasks to ICS server when configured
    useIcsAutoSync();
    useHiddenTitleDrag();
    useMacFullscreenClose();
    const isTauri = isTauriRuntime();

    // Ensure all pending writes are flushed when the app unmounts.
    useEffect(() => {
        return () => {
            storageManager.flush().catch(err => {
                console.error('Failed to flush on app unmount:', err);
            });
        };
    }, []);

    const handleOnboardingComplete = () => {
        setShowOnboarding(false);
    };

    return (
        <>
            {isTauri && <div className="hidden-title-drag-strip" data-tauri-drag-region="true" aria-hidden="true" />}

            {/* Onboarding screen - shown on first launch */}
            {showOnboarding && (
                <OnboardingScreen onComplete={handleOnboardingComplete} />
            )}

            {/* Global non-visual components */}
            <SettingsApplicator />
            <DailyTaskRefresh />
            <ScheduledReportGenerator />

            {/* Global UI components */}
            <GlobalStatusDisplay />
            <ScheduledReportModal />

            {/* Main application content with routing */}
            <Suspense fallback={<LoadingSpinner />}>
                <AppRouter />
            </Suspense>
        </>
    );
};

App.displayName = 'App';
export default App;

function useHiddenTitleDrag(): void {
    useEffect(() => {
        if (!isTauriRuntime()) return;

        const interactiveSelector = [
            'a',
            'button',
            'input',
            'select',
            'textarea',
            '[contenteditable="true"]',
            '[role="button"]',
            '[data-no-window-drag]',
            '.cm-editor',
            '[data-radix-popper-content-wrapper]',
        ].join(',');

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            const target = event.target instanceof Element ? event.target : null;
            const dragRegion = target?.closest('[data-tauri-drag-region]');
            if (!target || !dragRegion || target.closest(interactiveSelector)) return;

            event.preventDefault();
            void getCurrentWindow().startDragging().catch(() => undefined);
        };

        document.addEventListener('mousedown', handleMouseDown, true);
        return () => document.removeEventListener('mousedown', handleMouseDown, true);
    }, []);
}

function useMacFullscreenClose(): void {
    useEffect(() => {
        if (!isTauriRuntime() || !isMacPlatform()) return;

        let unlistenCloseRequested: (() => void) | undefined;
        let closeInProgress = false;

        const closeDesktopWindow = async () => {
            if (closeInProgress) return;
            closeInProgress = true;

            await storageManager.flush().catch((error) => {
                console.error('Failed to flush before window close:', error);
            });

            const appWindow = getCurrentWindow();
            try {
                if (await appWindow.isFullscreen()) {
                    await appWindow.setFullscreen(false);
                    await waitForWindowTransition();
                }
            } catch (error) {
                console.error('Failed to leave fullscreen before window close:', error);
            }

            await appWindow.hide().catch((error) => {
                console.error('Failed to hide window:', error);
            });
            closeInProgress = false;
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'w') return;

            event.preventDefault();
            event.stopPropagation();
            void closeDesktopWindow();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        void getCurrentWindow().onCloseRequested(async (event) => {
            event.preventDefault();
            await closeDesktopWindow();
        }).then((cleanup) => {
            unlistenCloseRequested = cleanup;
        });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            unlistenCloseRequested?.();
        };
    }, []);
}

function waitForWindowTransition(ms = 240): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isMacPlatform(): boolean {
    return navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac os');
}

function isTauriRuntime(): boolean {
    return typeof window !== 'undefined' && (
        '__TAURI_INTERNALS__' in window ||
        '__TAURI__' in window ||
        window.location.protocol === 'tauri:' ||
        navigator.userAgent.includes('Tauri')
    );
}
