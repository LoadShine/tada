// src/components/summary/SummaryView.tsx
import React, { useCallback, useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor from '../common/CodeMirrorEditor';
import { useAtom } from 'jotai';
import { tasksAtom } from '@/store/atoms';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { twMerge } from "tailwind-merge";

type SummaryPeriod = 'this-week' | 'last-week' | 'this-month' | 'last-month';

const SummaryView: React.FC = () => {
    const [tasks] = useAtom(tasksAtom);
    const [summaryContent, setSummaryContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [period, setPeriod] = useState<SummaryPeriod>('this-week');

    const getDateRange = useCallback((): { start: Date, end: Date } => {
        const now = new Date();
        switch (period) {
            case 'last-week': {
                const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: enUS });
                const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: enUS });
                return { start: lastWeekStart, end: lastWeekEnd };
            }
            case 'this-month':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            case 'last-month': {
                const lastMonthStart = startOfMonth(subMonths(now, 1));
                const lastMonthEnd = endOfMonth(subMonths(now, 1));
                return { start: lastMonthStart, end: lastMonthEnd };
            }
            case 'this-week':
            default: {
                const currentWeekStart = startOfWeek(now, { locale: enUS });
                const currentWeekEnd = endOfWeek(now, { locale: enUS });
                return { start: currentWeekStart, end: currentWeekEnd };
            }
        }
    }, [period]);

    const formatDateRange = useCallback((startDt: Date, endDt: Date): string => {
        if (!isValid(startDt) || !isValid(endDt)) return "Invalid Date Range";

        const startMonth = format(startDt, 'MMM', { locale: enUS });
        const startDay = format(startDt, 'd');
        const startYear = format(startDt, 'yyyy');
        const endMonth = format(endDt, 'MMM', { locale: enUS });
        const endDay = format(endDt, 'd');
        const endYear = format(endDt, 'yyyy');

        if (startYear !== endYear) {
            return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
        }
        if (startMonth !== endMonth) {
            return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
        }
        if (startDay !== endDay) {
            return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
        }
        return `${startMonth} ${startDay}, ${startYear}`; // Single day range

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


    const generateSummary = useCallback(() => {
        setIsLoading(true);
        setSummaryContent(''); // Clear previous content

        // Simulate API call or complex logic (keep the delay for effect)
        setTimeout(() => {
            const { start: rangeStart, end: rangeEnd } = getDateRange();

            // Ensure tasks are valid and have necessary timestamps
            const validTasks = tasks.filter(task =>
                task && typeof task.updatedAt === 'number' && typeof task.createdAt === 'number'
            );

            const completedInRange = validTasks.filter(task =>
                task.completed &&
                task.updatedAt >= rangeStart.getTime() &&
                task.updatedAt <= rangeEnd.getTime() &&
                task.list !== 'Trash'
            ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); // Sort by completion time DESC

            const addedInRange = validTasks.filter(task =>
                task.createdAt >= rangeStart.getTime() &&
                task.createdAt <= rangeEnd.getTime() &&
                task.list !== 'Trash'
            ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Sort by creation time DESC

            // --- Markdown Generation ---
            const periodTitle = getPeriodLabel(period);
            const dateRangeStr = formatDateRange(rangeStart, rangeEnd);
            let generatedText = `## Summary for ${periodTitle}\n`;
            generatedText += `*${dateRangeStr}*\n\n`; // Italic date range

            generatedText += `### ✅ Completed Tasks (${completedInRange.length})\n`;
            if (completedInRange.length > 0) {
                completedInRange.forEach(task => {
                    generatedText += `- ${task.title || 'Untitled Task'} *(Completed: ${format(new Date(task.updatedAt), 'MMM d')})*\n`;
                });
            } else {
                generatedText += `*No tasks completed during this period.*\n`;
            }

            generatedText += "\n"; // Spacing

            generatedText += `### ➕ Added Tasks (${addedInRange.length})\n`;
            if (addedInRange.length > 0) {
                addedInRange.forEach(task => {
                    generatedText += `- ${task.title || 'Untitled Task'} *(Added: ${format(new Date(task.createdAt), 'MMM d')})*\n`;
                });
            } else {
                generatedText += `*No new tasks added during this period.*\n`;
            }

            // Optional: Add Overdue or Upcoming tasks summary
            // generatedText += "\n### ⚠️ Overdue Tasks\n...";

            setSummaryContent(generatedText);
            setIsLoading(false);
        }, 800); // Slightly shorter simulation delay
    }, [tasks, period, getDateRange, formatDateRange, getPeriodLabel]); // Add dependencies


    const periodOptions: { value: SummaryPeriod; label: string; rangeLabel?: string }[] = [
        { value: 'this-week', label: 'This Week', rangeLabel: formatDateRange(startOfWeek(new Date(), {locale: enUS}), endOfWeek(new Date(), {locale: enUS})) },
        { value: 'last-week', label: 'Last Week', rangeLabel: formatDateRange(startOfWeek(subWeeks(new Date(), 1), {locale: enUS}), endOfWeek(subWeeks(new Date(), 1), {locale: enUS})) },
        { value: 'this-month', label: 'This Month', rangeLabel: format(new Date(), 'MMMM yyyy') },
        { value: 'last-month', label: 'Last Month', rangeLabel: format(subMonths(new Date(), 1), 'MMMM yyyy') },
    ];

    return (
        <div className="h-full flex flex-col bg-canvas">
            {/* Header */}
            <div className="px-4 py-2 border-b border-border-color/60 flex justify-between items-center flex-shrink-0">
                <h1 className="text-lg font-semibold text-gray-800">AI Summary</h1>
                <div className="flex items-center space-x-2">
                    {/* Generate Button */}
                    <Button
                        variant="primary"
                        size="sm"
                        icon="sparkles"
                        onClick={generateSummary}
                        loading={isLoading}
                        disabled={isLoading}
                        className="px-3" // Ensure padding
                    >
                        {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                </div>
            </div>

            {/* Filters Bar - Use Buttons for Period Selection */}
            <div className="px-4 py-1.5 border-b border-border-color/60 flex justify-start items-center flex-shrink-0 bg-canvas-alt space-x-1">
                <span className="text-xs text-muted-foreground mr-2">Period:</span>
                {periodOptions.map(opt => (
                    <Button
                        key={opt.value}
                        onClick={() => setPeriod(opt.value)}
                        variant={period === opt.value ? 'secondary' : 'ghost'}
                        size="sm"
                        className={twMerge(
                            "text-xs h-6 px-2",
                            period === opt.value && "shadow-sm border-border-color" // Add subtle border/shadow to active
                        )}
                        title={opt.rangeLabel || opt.label} // Show range on hover
                    >
                        {opt.label}
                    </Button>
                ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 p-3 overflow-hidden">
                <div className="h-full w-full relative">
                    {/* Loading Overlay - Subtle */}
                    {isLoading && (
                        <motion.div
                            className="absolute inset-0 bg-canvas/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-lg" // Ensure overlay covers editor area
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Icon name="loader" size={24} className="text-primary animate-spin" />
                        </motion.div>
                    )}
                    {/* Editor - Use consistent styling */}
                    <CodeMirrorEditor
                        value={summaryContent}
                        onChange={setSummaryContent} // Allow manual edits if needed
                        className="h-full w-full rounded-lg shadow-inner !border-border-color/80 !bg-canvas" // Explicit bg, subtle border
                        placeholder={isLoading ? "" : "Click 'Generate' to create a report for the selected period, or start typing your own notes...\n\nSupports **Markdown** formatting."}
                        readOnly={isLoading}
                    />
                </div>
            </div>
        </div>
    );
};

export default SummaryView;