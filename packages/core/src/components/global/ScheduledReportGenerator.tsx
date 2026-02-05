import React, { useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
    aiSettingsAtom,
    preferencesSettingsAtom,
    tasksAtom,
    scheduledReportModalAtom,
    storedSummariesAtom,
    echoReportsAtom,
    userProfileAtom,
} from '@/store/jotai';
import { isAIConfigValid, generateAiSummary, generateEchoReport } from '@/services/aiService';
import { startOfDay, endOfDay } from '@/utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@/utils/networkUtils';

/**
 * A global, non-visual component that checks for scheduled report generation.
 * 
 * In desktop mode (Tauri), it listens for events from the Rust backend which runs
 * a reliable timer that works even when the app is in the background.
 * 
 * In web mode, it falls back to using setInterval (which may be throttled by the browser).
 */
const ScheduledReportGenerator: React.FC = () => {
    const { t } = useTranslation();
    const aiSettings = useAtomValue(aiSettingsAtom);
    const preferences = useAtomValue(preferencesSettingsAtom);
    const userProfile = useAtomValue(userProfileAtom);
    const tasksData = useAtomValue(tasksAtom);
    const setScheduledReportModal = useSetAtom(scheduledReportModalAtom);
    const setStoredSummaries = useSetAtom(storedSummariesAtom);
    const setEchoReports = useSetAtom(echoReportsAtom);

    // Track if we've already generated today to prevent duplicates
    const lastGeneratedDateRef = useRef<string | null>(null);
    const isGeneratingRef = useRef(false);
    const unlistenRef = useRef<(() => void) | null>(null);

    /**
     * Sync schedule settings to Tauri backend whenever they change
     */
    useEffect(() => {
        if (!isTauri()) return;

        const syncSettingsToBackend = async () => {
            const scheduleSettings = preferences?.scheduleSettings;
            if (!scheduleSettings) return;

            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_schedule_settings', {
                    settings: {
                        enabled: scheduleSettings.enabled,
                        time: scheduleSettings.time,
                        days: scheduleSettings.days,
                    }
                });
                console.log('[ScheduledReportGenerator] ✅ Synced schedule settings to backend');
            } catch (error) {
                console.error('[ScheduledReportGenerator] Failed to sync settings to backend:', error);
            }
        };

        syncSettingsToBackend();
    }, [preferences?.scheduleSettings]);

    const generateReport = useCallback(async (triggerDate?: string) => {
        // Skip if already generating
        if (isGeneratingRef.current) {
            console.log('[ScheduledReportGenerator] Skip: Already generating');
            return;
        }

        // Check if schedule is enabled
        const scheduleSettings = preferences?.scheduleSettings;
        if (!scheduleSettings?.enabled) {
            return; // Silent skip, this is expected when disabled
        }

        // Check if AI is configured
        if (!isAIConfigValid(aiSettings)) {
            console.log('[ScheduledReportGenerator] Skip: AI not configured');
            return;
        }

        const now = new Date();
        const todayDateStr = triggerDate || now.toISOString().split('T')[0];

        // Check if we've already generated today
        if (lastGeneratedDateRef.current === todayDateStr) {
            console.log('[ScheduledReportGenerator] Skip: Already generated today');
            return;
        }

        // Mark as generating immediately
        isGeneratingRef.current = true;
        lastGeneratedDateRef.current = todayDateStr;

        console.log('[ScheduledReportGenerator] ⏰ Triggering scheduled report generation...');
        console.log('[ScheduledReportGenerator] Date:', todayDateStr);

        try {
            // Get today's completed tasks
            const todayStart = startOfDay(now).getTime();
            const todayEnd = endOfDay(now).getTime();

            // Get all tasks, filtering for completed ones today
            const allTasks = tasksData ?? [];
            console.log('[ScheduledReportGenerator] Total tasks:', allTasks.length);

            const todayCompletedTasks = allTasks.filter(task => {
                if (!task.completed) return false;
                if (task.listName === 'Trash') return false;

                // Check completedAt timestamp
                const completedAt = task.completedAt;
                if (!completedAt) return false;

                return completedAt >= todayStart && completedAt <= todayEnd;
            });

            console.log('[ScheduledReportGenerator] Today completed tasks:', todayCompletedTasks.length);
            if (todayCompletedTasks.length > 0) {
                console.log('[ScheduledReportGenerator] Task titles:', todayCompletedTasks.map(t => t.title).join(', '));
            }

            let reportType: 'summary' | 'echo';
            let content = '';
            let reportId = '';

            if (todayCompletedTasks.length > 0) {
                // Generate Daily Report (Summary)
                reportType = 'summary';
                console.log('[ScheduledReportGenerator] 📊 Generating Summary (Daily Report)...');

                const systemPrompt = t('prompts.taskSummary');
                const taskIds = todayCompletedTasks.map(t => t.id);

                const summary = await generateAiSummary(
                    taskIds,
                    [], // No future tasks for scheduled generation
                    'today',
                    'all',
                    aiSettings!,
                    systemPrompt,
                    (chunk) => {
                        content += chunk;
                    },
                    userProfile
                );

                reportId = summary.id;
                content = summary.summaryText;

                // Update stored summaries
                setStoredSummaries(prev => [summary, ...(prev ?? []).filter(s => s.id !== summary.id)]);
                console.log('[ScheduledReportGenerator] ✅ Summary generated, ID:', reportId);
            } else {
                // Generate Echo Report
                reportType = 'echo';
                console.log('[ScheduledReportGenerator] 🔮 Generating Echo (no tasks completed today)...');

                const language = preferences?.language ?? 'zh-CN';

                if (!userProfile?.persona || userProfile.persona.length === 0) {
                    console.log('[ScheduledReportGenerator] ⚠️ No personas configured for Echo');
                }

                const echoReport = await generateEchoReport(
                    userProfile,
                    aiSettings!,
                    t,
                    language,
                    'balanced',
                    '',
                    (chunk) => {
                        content += chunk;
                    }
                );

                reportId = echoReport.id;
                content = echoReport.content;

                // Update echo reports
                setEchoReports(prev => [echoReport, ...(prev ?? []).filter(r => r.id !== echoReport.id)]);
                console.log('[ScheduledReportGenerator] ✅ Echo generated, ID:', reportId);
            }

            // Show the popup modal
            setScheduledReportModal({
                type: reportType,
                content,
                createdAt: Date.now(),
                reportId,
            });

            console.log(`[ScheduledReportGenerator] 🎉 Successfully generated ${reportType} report`);
        } catch (error) {
            console.error('[ScheduledReportGenerator] ❌ Failed to generate scheduled report:', error);
            // Reset last generated date so it can retry on next check
            lastGeneratedDateRef.current = null;
        } finally {
            isGeneratingRef.current = false;
        }
    }, [aiSettings, preferences, userProfile, tasksData, t, setScheduledReportModal, setStoredSummaries, setEchoReports]);

    /**
     * Check and generate (for web fallback / focus event)
     */
    const checkAndGenerate = useCallback(async () => {
        // Check if schedule is enabled
        const scheduleSettings = preferences?.scheduleSettings;
        if (!scheduleSettings?.enabled) {
            return;
        }

        // Get current time info
        const now = new Date();
        const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Check if today is a scheduled day
        if (!scheduleSettings.days.includes(currentDay)) {
            return;
        }

        // Parse scheduled time
        const [scheduledHour, scheduledMinute] = scheduleSettings.time.split(':').map(Number);

        // Check if it's time (within the same minute)
        if (currentHour !== scheduledHour || currentMinute !== scheduledMinute) {
            return;
        }

        await generateReport();
    }, [preferences?.scheduleSettings, generateReport]);

    /**
     * Set up event listeners based on environment
     */
    useEffect(() => {
        const isDesktop = isTauri();

        if (isDesktop) {
            // Desktop mode: Listen for Tauri backend events
            console.log('[ScheduledReportGenerator] Running in desktop mode - using Tauri backend scheduler');

            const setupTauriListener = async () => {
                try {
                    const { listen } = await import('@tauri-apps/api/event');

                    const unlisten = await listen<{
                        timestamp: number;
                        date: string;
                        time: string;
                    }>('schedule-trigger', (event) => {
                        console.log('[ScheduledReportGenerator] 📡 Received schedule-trigger event from backend:', event.payload);
                        generateReport(event.payload.date);
                    });

                    unlistenRef.current = unlisten;
                    console.log('[ScheduledReportGenerator] ✅ Tauri event listener registered');
                } catch (error) {
                    console.error('[ScheduledReportGenerator] Failed to set up Tauri listener:', error);
                }
            };

            setupTauriListener();

            // Also check when window gains focus (in case we missed an event)
            window.addEventListener('focus', checkAndGenerate);

            // Initial check after a short delay
            const initTimeout = setTimeout(checkAndGenerate, 2000);

            return () => {
                if (unlistenRef.current) {
                    unlistenRef.current();
                    unlistenRef.current = null;
                }
                clearTimeout(initTimeout);
                window.removeEventListener('focus', checkAndGenerate);
            };
        } else {
            // Web mode: Use setInterval as fallback
            console.log('[ScheduledReportGenerator] Running in web mode - using setInterval fallback');

            const intervalId = setInterval(checkAndGenerate, 60 * 1000);

            // Also check when window gains focus
            window.addEventListener('focus', checkAndGenerate);

            // Initial check after a short delay
            const initTimeout = setTimeout(checkAndGenerate, 2000);

            return () => {
                clearInterval(intervalId);
                clearTimeout(initTimeout);
                window.removeEventListener('focus', checkAndGenerate);
            };
        }
    }, [checkAndGenerate, generateReport]);

    return null; // This component does not render anything
};

ScheduledReportGenerator.displayName = 'ScheduledReportGenerator';
export default ScheduledReportGenerator;
