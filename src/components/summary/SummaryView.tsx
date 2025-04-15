// src/components/summary/SummaryView.tsx
import React, {useMemo, useState} from 'react';
// import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor from '../common/CodeMirrorEditor';
import {useAtom} from 'jotai';
import {tasksAtom} from '@/store/atoms';
import {endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subWeeks} from 'date-fns';
import {enUS} from 'date-fns/locale';
import {formatRelativeDate, isOverdue} from "@/utils/dateUtils.ts";

type SummaryPeriod = 'this-week' | 'last-week' | 'this-month';

const SummaryView: React.FC = () => {
    const [tasks] = useAtom(tasksAtom);
    const [summaryContent, setSummaryContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentPeriod, setCurrentPeriod] = useState<SummaryPeriod>('this-week');

    // Calculate date ranges based on selected period
    const {startDate, endDate, title} = useMemo(() => {
        const today = new Date();
        let start: Date, end: Date, periodTitle: string;

        switch (currentPeriod) {
            case 'last-week': {
                const startLastWeek = startOfWeek(subWeeks(today, 1), {locale: enUS});
                const endLastWeek = endOfWeek(subWeeks(today, 1), {locale: enUS});
                start = startLastWeek;
                end = endLastWeek;
                periodTitle = `Last Week (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
                break;
            }
            case 'this-month':
                start = startOfMonth(today);
                end = endOfMonth(today);
                periodTitle = `This Month (${format(start, 'MMMM yyyy')})`;
                break;
            case 'this-week':
            default:
                start = startOfWeek(today, {locale: enUS});
                end = endOfWeek(today, {locale: enUS});
                periodTitle = `This Week (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
                break;
        }
        return {startDate: start, endDate: end, title: periodTitle};
    }, [currentPeriod]);


    // Improved placeholder function for generating AI summary
    const generateSummary = () => {
        setIsLoading(true);
        setSummaryContent(''); // Clear previous content while loading

        // Simulate API call or complex logic
        setTimeout(() => {
            // Filter tasks based on the selected period
            const completedInRange = tasks.filter(task =>
                task.completed &&
                task.updatedAt >= startDate.getTime() &&
                task.updatedAt <= endDate.getTime() &&
                task.list !== 'Trash'
            );
            const overdueTasks = tasks.filter(task =>
                !task.completed && task.dueDate && isOverdue(task.dueDate) && task.list !== 'Trash'
            );
            const upcomingTasks = tasks.filter(task =>
                !task.completed && task.dueDate && task.dueDate > new Date().getTime() && task.list !== 'Trash'
            ).sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)).slice(0, 5); // Get next 5 upcoming


            let generatedText = `## Summary: ${title}\n\n`;

            // Section: Completed Tasks
            if (completedInRange.length > 0) {
                generatedText += `**✅ Completed Tasks (${completedInRange.length}):**\n`;
                completedInRange
                    .sort((a, b) => b.updatedAt - a.updatedAt) // Sort by completion date desc
                    .forEach(task => {
                        generatedText += `- ${task.title} *(Completed: ${format(new Date(task.updatedAt), 'MMM d')})*\n`;
                    });
            } else {
                generatedText += `*No tasks completed during this period.*\n`;
            }

            // Section: Overdue Tasks
            if (overdueTasks.length > 0) {
                generatedText += `\n**⚠️ Overdue Tasks (${overdueTasks.length}):**\n`;
                overdueTasks
                    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)) // Sort by due date asc
                    .forEach(task => {
                        generatedText += `- ${task.title} *(Due: ${formatRelativeDate(task.dueDate)})*\n`;
                    });
            }

            // Section: Upcoming Tasks
            if (upcomingTasks.length > 0) {
                generatedText += `\n**🗓️ Upcoming Tasks (Next 5):**\n`;
                upcomingTasks.forEach(task => {
                    generatedText += `- ${task.title} *(Due: ${formatRelativeDate(task.dueDate)})*\n`;
                });
            }


            // Section: General Notes/Suggestions (AI part)
            generatedText += "\n**✨ Insights & Suggestions:**\n";
            if (overdueTasks.length > 2) {
                generatedText += "- Consider reviewing overdue tasks and rescheduling or breaking them down.\n";
            }
            if (completedInRange.length > 5) {
                generatedText += "- Great job on completing several tasks! Keep the momentum going.\n";
            } else {
                generatedText += "- Focus on prioritizing tasks for the upcoming period.\n";
            }
            generatedText += "- Remember to take breaks and celebrate accomplishments!\n";


            setSummaryContent(generatedText);
            setIsLoading(false);
        }, 1200); // Simulate delay
    };

    return (
        // Ensure full height and flex column structure
        <div className="h-full max-h-screen flex flex-col bg-canvas">
            {/* Header */}
            <div
                className="px-4 py-2.5 border-b border-gray-200/70 flex justify-between items-center flex-shrink-0 h-14">
                <h1 className="text-lg font-semibold text-gray-800">AI Summary</h1>
                <div className="flex items-center space-x-2">
                    {/* Period Selector Dropdown (Example) */}
                    <select
                        value={currentPeriod}
                        onChange={(e) => setCurrentPeriod(e.target.value as SummaryPeriod)}
                        disabled={isLoading}
                        className="form-select h-9 text-sm rounded-lg border-gray-300/90 focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                        <option value="this-week">This Week</option>
                        <option value="last-week">Last Week</option>
                        <option value="this-month">This Month</option>
                    </select>
                    <Button
                        variant="primary"
                        size="md"
                        icon="sparkles" // Use sparkles icon
                        onClick={generateSummary}
                        loading={isLoading}
                        disabled={isLoading}
                        className="font-medium"
                    >
                        {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                    {/* <Button variant="ghost" size="icon" aria-label="Summary options" className="text-muted-foreground">
                        <Icon name="more-horizontal" size={18} />
                    </Button> */}
                </div>
            </div>

            {/* No Filters Section Needed */}

            {/* Editor Area - Use flex-1 to fill remaining space */}
            <div className="flex-1 p-3 md:p-4 overflow-hidden">
                {/* Wrapper div ensures editor takes full height */}
                <div
                    className="h-full w-full border border-gray-200/80 rounded-lg shadow-inner bg-white overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-150">
                    <CodeMirrorEditor
                        value={summaryContent}
                        onChange={setSummaryContent} // Allow manual edits
                        className="h-full" // Let CM fill the wrapper
                        placeholder={
                            isLoading ? "✨ Generating your summary..." :
                                "Click 'Generate' to create an AI summary based on your tasks for the selected period,\nor start typing your own notes here...\n\nSupports **Markdown** formatting."
                        }
                        readOnly={isLoading} // Make read-only while loading
                    />
                </div>
            </div>
        </div>
    );
};

export default SummaryView;