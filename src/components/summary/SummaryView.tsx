// src/components/summary/SummaryView.tsx
import React, {useCallback, useState} from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor from '../common/CodeMirrorEditor';
import {useAtom} from 'jotai';
import {tasksAtom} from '@/store/atoms';
import {endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks} from 'date-fns';
import {enUS} from 'date-fns/locale';
import {motion} from 'framer-motion';

type SummaryPeriod = 'this-week' | 'last-week' | 'this-month' | 'last-month';

const SummaryView: React.FC = () => {
    const [tasks] = useAtom(tasksAtom);
    const [summaryContent, setSummaryContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [period, setPeriod] = useState<SummaryPeriod>('this-week'); // Default period

    const getDateRange = useCallback((): { start: Date, end: Date } => {
        const now = new Date();
        switch (period) {
            case 'last-week': {
                const lastWeekStart = startOfWeek(subWeeks(now, 1), {locale: enUS});
                const lastWeekEnd = endOfWeek(subWeeks(now, 1), {locale: enUS});
                return {start: lastWeekStart, end: lastWeekEnd};
            }
            case 'this-month':
                return {start: startOfMonth(now), end: endOfMonth(now)};
            case 'last-month': {
                const lastMonthStart = startOfMonth(subMonths(now, 1));
                const lastMonthEnd = endOfMonth(subMonths(now, 1));
                return {start: lastMonthStart, end: lastMonthEnd};
            }
            case 'this-week':
            default: {
                const currentWeekStart = startOfWeek(now, {locale: enUS});
                const currentWeekEnd = endOfWeek(now, {locale: enUS});
                return {start: currentWeekStart, end: currentWeekEnd};
            }
        }
    }, [period]);

    // const { start, end } = getDateRange();

    const formatDateRange = (startDt: Date, endDt: Date) => {
        const options: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'};
        const yearOptions: Intl.DateTimeFormatOptions = {year: 'numeric', month: 'short', day: 'numeric'};
        const startStr = startDt.toLocaleDateString(enUS.code, options);
        let endStr = endDt.toLocaleDateString(enUS.code, options);
        // Add year if ranges span across years or for clarity on monthly ranges
        if (startDt.getFullYear() !== endDt.getFullYear() || period.includes('month')) {
            endStr = endDt.toLocaleDateString(enUS.code, yearOptions);
        }
        return `${startStr} - ${endStr}`;
    };

    const generateSummary = useCallback(() => {
        setIsLoading(true);
        setSummaryContent(''); // Clear previous content immediately

        // Simulate API call or complex logic
        setTimeout(() => {
            const {start: rangeStart, end: rangeEnd} = getDateRange();

            const completedInRange = tasks.filter(task =>
                task.completed &&
                task.updatedAt >= rangeStart.getTime() &&
                task.updatedAt <= rangeEnd.getTime() &&
                task.list !== 'Trash'
            ).sort((a, b) => b.updatedAt - a.updatedAt); // Sort by completion time

            const addedInRange = tasks.filter(task =>
                task.createdAt >= rangeStart.getTime() &&
                task.createdAt <= rangeEnd.getTime() &&
                task.list !== 'Trash'
            ).sort((a, b) => b.createdAt - a.createdAt); // Sort by creation time


            let generatedText = `## Summary for ${period.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} (${formatDateRange(rangeStart, rangeEnd)})\n\n`;

            if (completedInRange.length > 0) {
                generatedText += `**✅ Completed Tasks (${completedInRange.length}):**\n`;
                completedInRange.forEach(task => {
                    generatedText += `- ${task.title} (Completed: ${format(new Date(task.updatedAt), 'MMM d')})\n`;
                });
            } else {
                generatedText += "**✅ No tasks completed in this period.**\n";
            }

            generatedText += "\n"; // Add spacing

            if (addedInRange.length > 0) {
                generatedText += `**➕ Added Tasks (${addedInRange.length}):**\n`;
                addedInRange.forEach(task => {
                    generatedText += `- ${task.title} (Added: ${format(new Date(task.createdAt), 'MMM d')})\n`;
                });
            } else {
                generatedText += "**➕ No new tasks added in this period.**\n";
            }


            // Add more sections (e.g., upcoming tasks, overdue tasks) if needed
            // generatedText += "\n**Notes:**\n- Start planning for next week's goals.\n";

            setSummaryContent(generatedText);
            setIsLoading(false);
        }, 1000); // Simulate 1 second delay
    }, [tasks, period, getDateRange, formatDateRange]); // Dependencies for the generation logic

    return (
        // Ensure SummaryView fills the height provided by MainLayout
        <div className="h-full flex flex-col bg-canvas">
            {/* Header */}
            <div className="px-4 py-2 border-b border-gray-200/60 flex justify-between items-center flex-shrink-0">
                <h1 className="text-lg font-semibold text-gray-800">AI Summary</h1>
                <div className="flex items-center space-x-2">
                    {/* Add Period Selector Dropdown Here */}
                    {/* <Select value={period} onValueChange={(v) => setPeriod(v as SummaryPeriod)}> ... </Select> */}
                    <Button
                        variant="primary"
                        size="sm"
                        icon="sparkles" // Use sparkles icon
                        onClick={generateSummary}
                        loading={isLoading}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Generating...' : 'Generate Summary'}
                    </Button>
                    {/* <Button variant="ghost" size="icon" aria-label="Summary options" className="w-7 h-7">
                        <Icon name="more-horizontal" size={18} />
                    </Button> */}
                </div>
            </div>

            {/* Filters Bar - Simplified */}
            <div
                className="px-4 py-1.5 border-b border-gray-200/60 flex justify-start items-center flex-shrink-0 bg-canvas-alt space-x-1">
                <span className="text-xs text-muted-foreground mr-2">Period:</span>
                <Button onClick={() => setPeriod('this-week')} variant={period === 'this-week' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="text-xs h-6 px-2">{`This Week (${formatDateRange(startOfWeek(new Date(), {locale: enUS}), endOfWeek(new Date(), {locale: enUS}))})`}</Button>
                <Button onClick={() => setPeriod('this-month')}
                        variant={period === 'this-month' ? 'secondary' : 'ghost'} size="sm"
                        className="text-xs h-6 px-2">{`This Month (${format(new Date(), 'MMMM yyyy')})`}</Button>
                {/* Add more buttons or a dropdown for other periods (Last Week, Last Month) */}
            </div>


            {/* Editor Area - Takes remaining space */}
            <div className="flex-1 p-3 overflow-hidden"> {/* Use small padding */}
                {/* Container ensures editor fills the padded area */}
                <div className="h-full w-full relative">
                    {/* Loading Overlay */}
                    {isLoading && (
                        <motion.div
                            className="absolute inset-0 bg-canvas/50 backdrop-blur-xs flex items-center justify-center z-10"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            exit={{opacity: 0}}
                        >
                            <Icon name="loader" size={24} className="text-primary animate-spin"/>
                        </motion.div>
                    )}
                    {/* Editor itself */}
                    <CodeMirrorEditor
                        value={summaryContent}
                        onChange={setSummaryContent} // Allow manual edits
                        className="h-full w-full rounded-lg shadow-inner !border-gray-200/60" // Ensure full size, subtle border
                        placeholder={isLoading ? "" : "Click 'Generate Summary' to create a report for the selected period, or start typing your own notes...\n\nSupports **Markdown** formatting."}
                        readOnly={isLoading} // Make read-only while loading
                    />
                </div>
            </div>
        </div>
    );
};

export default SummaryView;