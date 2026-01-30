import React, { Suspense, useEffect, useState } from 'react';
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