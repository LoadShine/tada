// src/components/summary/SummaryView.tsx
import React, {useCallback, useState, useMemo, useRef} from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor'; // Ensure ref type is imported
import { useAtomValue } from 'jotai';
import { tasksAtom } from '@/store/atoms';
import {
    endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, isValid, safeParseDate, startOfDay, enUS
} from '@/utils/dateUtils'; // Use utils
import {AnimatePresence, motion} from 'framer-motion';
import { twMerge } from "tailwind-merge";
import {endOfDay, subWeeks} from "date-fns";

// Define summary periods
type SummaryPeriod = 'this-week' | 'last-week' | 'this-month' | 'last-month';

// --- Helper Functions (Memoized) ---
const useDateCalculations = (period: SummaryPeriod) => {
    const getDateRange = useCallback((): { start: Date, end: Date } => {
        const now = new Date();
        const todayStart = startOfDay(now);
        switch (period) {
            case 'last-week': {
                const lastWeekStart = startOfWeek(subWeeks(todayStart, 1), { locale: enUS });
                const lastWeekEnd = endOfWeek(subWeeks(todayStart, 1), { locale: enUS });
                return { start: lastWeekStart, end: lastWeekEnd };
            }
            case 'this-month':
                return { start: startOfMonth(todayStart), end: endOfMonth(todayStart) };
            case 'last-month': {
                const lastMonthStart = startOfMonth(subMonths(todayStart, 1));
                const lastMonthEnd = endOfMonth(subMonths(todayStart, 1));
                return { start: lastMonthStart, end: lastMonthEnd };
            }
            case 'this-week':
            default: {
                const currentWeekStart = startOfWeek(todayStart, { locale: enUS });
                const currentWeekEnd = endOfWeek(todayStart, { locale: enUS });
                return { start: currentWeekStart, end: currentWeekEnd };
            }
        }
    }, [period]);

    const formatDateRange = useCallback((startDt: Date, endDt: Date): string => {
        if (!isValid(startDt) || !isValid(endDt)) return "Invalid Date Range";

        const startFormat = 'MMM d';
        const endFormat = 'MMM d, yyyy'; // Always include year at the end

        if (startDt.getFullYear() !== endDt.getFullYear()) {
            return `${format(startDt, 'MMM d, yyyy')} - ${format(endDt, endFormat)}`;
        }
        if (startDt.getMonth() !== endDt.getMonth()) {
            return `${format(startDt, startFormat)} - ${format(endDt, endFormat)}`;
        }
        if (startDt.getDate() !== endDt.getDate()) {
            return `${format(startDt, startFormat)} - ${format(endDt, endFormat)}`;
        }
        // Single day range
        return format(startDt, endFormat);
    }, []);

    const getPeriodLabel = useCallback((p: SummaryPeriod): string => {
        switch (p) {
            case 'this-week': return 'This Week';
            case 'last-week': return 'Last Week';
            case 'this-month': return 'This Month';
            case 'last-month': return 'Last Month';
            default: return '';
        }
    }, []);

    const periodOptions = useMemo(() => {
        const now = new Date();
        const thisWeekStart = startOfWeek(now, { locale: enUS });
        const thisWeekEnd = endOfWeek(now, { locale: enUS });
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: enUS });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: enUS });
        const thisMonthStart = startOfMonth(now);
        const thisMonthEnd = endOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));

        return [
            { value: 'this-week', label: 'This Week', rangeLabel: formatDateRange(thisWeekStart, thisWeekEnd) },
            { value: 'last-week', label: 'Last Week', rangeLabel: formatDateRange(lastWeekStart, lastWeekEnd) },
            { value: 'this-month', label: 'This Month', rangeLabel: formatDateRange(thisMonthStart, thisMonthEnd)}, // Show range for clarity
            { value: 'last-month', label: 'Last Month', rangeLabel: formatDateRange(lastMonthStart, lastMonthEnd) }, // Show range for clarity
        ] as const; // Use 'as const' for stricter typing
    }, [formatDateRange]);


    return { getDateRange, formatDateRange, getPeriodLabel, periodOptions };
};


// --- Summary View Component ---
const SummaryView: React.FC = () => {
    const tasks = useAtomValue(tasksAtom); // Read-only tasks
    const [summaryContent, setSummaryContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [period, setPeriod] = useState<SummaryPeriod>('this-week');
    const editorRef = useRef<CodeMirrorEditorRef>(null); // Ref for editor methods

    const { getDateRange, formatDateRange, getPeriodLabel, periodOptions } = useDateCalculations(period);

    const generateSummary = useCallback(async () => {
        setIsLoading(true);
        setSummaryContent(''); // Clear previous content

        // Simulate async operation (e.g., API call, complex processing)
        await new Promise(resolve => setTimeout(resolve, 600)); // Shorter delay

        const { start: rangeStart, end: rangeEnd } = getDateRange();
        const rangeEndInclusive = endOfDay(rangeEnd); // Ensure end date is inclusive

        // Filter tasks completed within the date range (non-trashed)
        const completedInRange = tasks.filter(task =>
            task.completed &&
            task.list !== 'Trash' &&
            task.updatedAt >= rangeStart.getTime() &&
            task.updatedAt <= rangeEndInclusive.getTime() // Use inclusive end time
        ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); // Sort by completion time DESC

        // Filter tasks added within the date range (non-trashed)
        const addedInRange = tasks.filter(task =>
            task.list !== 'Trash' &&
            task.createdAt >= rangeStart.getTime() &&
            task.createdAt <= rangeEndInclusive.getTime() // Use inclusive end time
        ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation time DESC


        // --- Generate Markdown Summary ---
        const periodTitle = getPeriodLabel(period);
        const dateRangeStr = formatDateRange(rangeStart, rangeEnd);

        let generatedText = `# Summary for ${periodTitle}\n`; // H1 for main title
        generatedText += `*${dateRangeStr}*\n\n`; // Italic date range

        // Completed Tasks Section
        generatedText += `## ✅ Completed Tasks (${completedInRange.length})\n`; // H2 for section
        if (completedInRange.length > 0) {
            completedInRange.forEach(task => {
                const completedDate = safeParseDate(task.updatedAt);
                const dateStr = completedDate ? format(completedDate, 'MMM d') : 'Unknown Date';
                generatedText += `- ${task.title || 'Untitled Task'} *(Done: ${dateStr})*\n`; // Simpler completion note
            });
        } else {
            generatedText += `*No tasks completed during this period.*\n`;
        }
        generatedText += "\n"; // Add space between sections

        // Added Tasks Section
        generatedText += `## ➕ Added Tasks (${addedInRange.length})\n`; // H2 for section
        if (addedInRange.length > 0) {
            addedInRange.forEach(task => {
                const createdDate = safeParseDate(task.createdAt);
                const dateStr = createdDate ? format(createdDate, 'MMM d') : 'Unknown Date';
                generatedText += `- ${task.title || 'Untitled Task'} *(Added: ${dateStr})*\n`;
            });
        } else {
            generatedText += `*No new tasks added during this period.*\n`;
        }

        // --- End Markdown Generation ---

        setSummaryContent(generatedText);
        setIsLoading(false);

        // Focus the editor after content generation
        editorRef.current?.focus();

    }, [tasks, period, getDateRange, formatDateRange, getPeriodLabel]); // Dependencies

    // --- Render ---
    return (
        <div className="h-full flex flex-col bg-canvas">
            {/* Header with Glass Effect */}
            <div className="px-4 py-2 border-b border-black/5 flex justify-between items-center flex-shrink-0 bg-glass-200 backdrop-blur-sm z-10 h-11">
                <h1 className="text-lg font-semibold text-gray-800">AI Summary</h1>
                {/* Generate Button */}
                <Button
                    variant="primary"
                    size="sm"
                    icon="sparkles" // Use sparkles icon
                    onClick={generateSummary}
                    loading={isLoading}
                    disabled={isLoading}
                    className="px-3" // Ensure padding
                >
                    {isLoading ? 'Generating...' : 'Generate'}
                </Button>
            </div>

            {/* Filters Bar - Subtle Background */}
            <div className="px-4 py-1.5 border-b border-border-color/60 flex justify-start items-center flex-shrink-0 bg-canvas-alt/80 space-x-1 h-9">
                <span className="text-xs text-muted-foreground mr-2 font-medium">Period:</span>
                {periodOptions.map(opt => (
                    <Button
                        key={opt.value}
                        onClick={() => setPeriod(opt.value)}
                        // Use 'secondary' for active, 'ghost' for inactive
                        variant={period === opt.value ? 'secondary' : 'ghost'}
                        size="sm"
                        className={twMerge(
                            "text-xs h-6 px-2 font-medium", // Ensure font weight consistency
                            // Add subtle border/shadow to active secondary button
                            period === opt.value && "shadow-sm !bg-white border-border-color-medium"
                        )}
                        title={opt.rangeLabel} // Show date range on hover
                        aria-pressed={period === opt.value}
                    >
                        {opt.label}
                    </Button>
                ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 p-3 overflow-hidden relative">
                {/* Add relative positioning to the container */}
                <div className="h-full w-full relative rounded-md overflow-hidden border border-border-color/60 bg-canvas-inset shadow-inner">
                    {/* Loading Overlay - More subtle */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                className="absolute inset-0 bg-canvas/70 backdrop-blur-xs flex items-center justify-center z-10" // Cover editor area
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <Icon name="loader" size={24} className="text-primary animate-spin" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CodeMirror Editor */}
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={summaryContent}
                        onChange={setSummaryContent} // Allow manual edits
                        // Apply styling via className to integrate better
                        className="h-full w-full !border-0 !bg-transparent !shadow-none focus-within:!ring-0" // Remove default CM container styles
                        placeholder={
                            isLoading
                                ? "Generating summary..." // Placeholder during loading
                                : "Click 'Generate' to create a report for the selected period,\nor start typing your own notes...\n\nSupports **Markdown** formatting."
                        }
                        readOnly={isLoading} // Prevent editing while loading
                    />
                </div>
            </div>
        </div>
    );
};

export default SummaryView;