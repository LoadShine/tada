// src/components/summary/SummaryView.tsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { tasksAtom, userListNamesAtom } from '@/store/atoms';
import Button from '../common/Button';
import Dropdown, { DropdownRenderProps } from '../common/Dropdown';
import MenuItem from '../common/MenuItem';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import {
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    subMonths, subDays, startOfDay, endOfDay,
    isValid, safeParseDate, formatRelativeDate
} from '@/utils/dateUtils';
import Icon from "@/components/common/Icon";
import {isWithinInterval} from "date-fns";

// --- Period Definitions ---
type PeriodOption =
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month';

interface Period {
    id: PeriodOption;
    label: string;
    getInterval: () => { start: Date; end: Date };
}

const periodOptions: Period[] = [
    {
        id: 'today', label: 'Today', getInterval: () => {
            const now = startOfDay(new Date());
            return { start: now, end: endOfDay(now) };
        }
    },
    {
        id: 'yesterday', label: 'Yesterday', getInterval: () => {
            const yesterday = startOfDay(subDays(new Date(), 1));
            return { start: yesterday, end: endOfDay(yesterday) };
        }
    },
    {
        id: 'this_week', label: 'This Week', getInterval: () => {
            const now = new Date();
            return { start: startOfDay(startOfWeek(now)), end: endOfDay(endOfWeek(now)) };
        }
    },
    {
        id: 'last_week', label: 'Last Week', getInterval: () => {
            const lastWeekStart = startOfDay(startOfWeek(subDays(new Date(), 7)));
            return { start: lastWeekStart, end: endOfDay(endOfWeek(lastWeekStart)) };
        }
    },
    {
        id: 'this_month', label: 'This Month', getInterval: () => {
            const now = new Date();
            return { start: startOfDay(startOfMonth(now)), end: endOfDay(endOfMonth(now)) };
        }
    },
    {
        id: 'last_month', label: 'Last Month', getInterval: () => {
            const lastMonthStart = startOfDay(startOfMonth(subMonths(new Date(), 1)));
            return { start: lastMonthStart, end: endOfDay(endOfMonth(lastMonthStart)) };
        }
    },
    // Add 'Custom' if needed later
];

// --- Status Definitions (Visual Only for now) ---
const statusOptions: { id: string; label: string }[] = [
    { id: 'all', label: 'All Status' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    // Add more statuses if needed
];

// --- Placeholder AI Summary Function ---
const generateAISummary = async (tasksText: string): Promise<string> => {
    console.log("Generating summary for tasks:\n", tasksText);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!tasksText.trim()) {
        return "No tasks provided to generate a summary.";
    }

    // Simple placeholder logic
    const taskLines = tasksText.split('\n').filter(line => line.trim().startsWith('-'));
    const taskCount = taskLines.length;
    const firstTaskTitle = taskLines[0]?.replace(/- \*\*(.*?)\*\*.*$/, '$1') || 'some tasks';

    return `**AI Generated Summary:**

Based on the provided ${taskCount} task(s):
*   There appears to be a focus on "${firstTaskTitle}".
*   Consider prioritizing tasks marked with high importance.
*   Ensure timely completion of tasks nearing their due dates.

*(This is a placeholder response. Replace with actual Gemini API call.)*`;
};


// --- Main Summary View Component ---
const SummaryView: React.FC = () => {
    const allTasks = useAtomValue(tasksAtom);
    const allUserLists = useAtomValue(userListNamesAtom);

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('this_week');
    const [selectedList, setSelectedList] = useState<string>('All Lists');
    const [selectedStatus, ] = useState<string>('all'); // For display only

    const [tasksContent, setTasksContent] = useState<string>('');
    const [summaryContent, setSummaryContent] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const tasksEditorRef = React.useRef<CodeMirrorEditorRef>(null);
    const summaryEditorRef = React.useRef<CodeMirrorEditorRef>(null);

    // Filter tasks based on selections
    const filteredTasks = useMemo(() => {
        const period = periodOptions.find(p => p.id === selectedPeriod);
        if (!period) return [];

        const { start, end } = period.getInterval();

        return allTasks.filter(task => {
            // Exclude trash
            if (task.list === 'Trash') return false;

            // Filter by list
            const listMatch = selectedList === 'All Lists' || task.list === selectedList;
            if (!listMatch) return false;

            // Filter by completion > 0
            if (!task.completionPercentage || task.completionPercentage <= 0) {
                return false;
            }

            // Filter by date period
            if (!task.dueDate) return false; // Only include tasks with due dates for period filtering
            const dueDate = safeParseDate(task.dueDate);
            if (!dueDate || !isValid(dueDate)) return false;

            return isWithinInterval(dueDate, { start, end });
        }).sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0) || (a.order ?? 0) - (b.order ?? 0)); // Sort by due date, then order

    }, [allTasks, selectedPeriod, selectedList]);

    // Format filtered tasks for the editor
    useEffect(() => {
        const formattedContent = filteredTasks.map(task => {
            const dueDateStr = task.dueDate ? ` (Due: ${formatRelativeDate(task.dueDate)})` : '';
            const percentageStr = task.completionPercentage ? ` [${task.completionPercentage}%]` : '';
            const priorityStr = task.priority ? ` (P${task.priority})` : '';
            return `- **${task.title || 'Untitled Task'}**${percentageStr}${priorityStr}${dueDateStr}\n  ${task.content || ''}`.trim();
        }).join('\n\n');

        setTasksContent(formattedContent || `# No tasks found for the selected criteria.\n\nCheck your filters or task completion status.\nTasks need a due date within the period and completion > 0%.`);
        setSummaryContent(''); // Clear summary when filters change
    }, [filteredTasks]);

    // Handle Generate button click
    const handleGenerateClick = useCallback(async () => {
        setIsGenerating(true);
        setSummaryContent('Generating summary...'); // Placeholder while loading
        try {
            const summary = await generateAISummary(tasksContent);
            setSummaryContent(summary);
        } catch (error) {
            console.error("Error generating AI summary:", error);
            setSummaryContent("# Error generating summary.\n\nPlease check the console for details and try again.");
        } finally {
            setIsGenerating(false);
        }
    }, [tasksContent]); // Depend on the current tasksContent

    // Memoized list options for dropdown
    const listOptions = useMemo(() => ['All Lists', ...allUserLists], [allUserLists]);

    // Callback for editor changes (if needed, e.g., for saving edits)
    const handleTasksContentChange = useCallback((newContent: string) => {
        // If we want to allow editing and potentially update tasks based on it,
        // complex parsing logic would be needed here. For now, just update local state.
        setTasksContent(newContent);
    }, []);


    return (
        <div className="h-full flex flex-col bg-glass-alt-100 overflow-hidden p-2 md:p-3">
            {/* Header */}
            <div className="px-3 md:px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                <div className="w-20"> {/* Spacer */}
                    <h1 className="text-base font-semibold text-gray-800 truncate">AI Summary</h1>
                </div>
                <div className="flex items-center space-x-2 flex-wrap">
                    {/* Period Dropdown */}
                    <Dropdown
                        placement="bottom-start"
                        contentClassName="py-1"
                        trigger={
                            <Button variant="glass" size="sm" className="!h-8 px-2 min-w-[110px] text-sm font-medium tabular-nums text-gray-700">
                                {periodOptions.find(p => p.id === selectedPeriod)?.label ?? 'Select Period'}
                                <Icon name="chevron-down" size={14} className="ml-1.5 opacity-60" />
                            </Button>
                        }
                    >
                        {(props: DropdownRenderProps) => (
                            <>
                                {periodOptions.map(period => (
                                    <MenuItem
                                        key={period.id}
                                        selected={selectedPeriod === period.id}
                                        onClick={() => { setSelectedPeriod(period.id); props.close(); }}
                                    >
                                        {period.label}
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Dropdown>

                    {/* List Dropdown */}
                    <Dropdown
                        placement="bottom-start"
                        contentClassName="py-1 max-h-60 overflow-y-auto styled-scrollbar"
                        trigger={
                            <Button variant="glass" size="sm" className="!h-8 px-2 min-w-[110px] text-sm font-medium text-gray-700">
                                <Icon name={selectedList === 'All Lists' ? 'archive' : (selectedList === 'Inbox' ? 'inbox' : 'list')} size={14} className="mr-1 opacity-70" />
                                {selectedList}
                                <Icon name="chevron-down" size={14} className="ml-auto opacity-60" />
                            </Button>
                        }
                    >
                        {(props: DropdownRenderProps) => (
                            <>
                                {listOptions.map(list => (
                                    <MenuItem
                                        key={list}
                                        icon={list === 'All Lists' ? 'archive' : (list === 'Inbox' ? 'inbox' : 'list')}
                                        selected={selectedList === list}
                                        onClick={() => { setSelectedList(list); props.close(); }}
                                    >
                                        {list}
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Dropdown>

                    {/* Status Dropdown (Visual Only for now) */}
                    <Dropdown
                        placement="bottom-start"
                        contentClassName="py-1"
                        trigger={
                            <Button variant="glass" size="sm" className="!h-8 px-2 min-w-[110px] text-sm font-medium text-gray-700">
                                {statusOptions.find(s => s.id === selectedStatus)?.label ?? 'All Status'}
                                <Icon name="chevron-down" size={14} className="ml-1.5 opacity-60" />
                            </Button>
                        }
                    >
                        {(props: DropdownRenderProps) => (
                            <>
                                {statusOptions.map(status => (
                                    <MenuItem
                                        key={status.id}
                                        selected={selectedStatus === status.id}
                                        // Make disabled as it's not functional yet
                                        onClick={() => { /*setSelectedStatus(status.id);*/ props.close(); }}
                                        disabled={true} // Disable selection for now
                                        className="!cursor-not-allowed !opacity-50"
                                    >
                                        {status.label}
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Dropdown>
                </div>

                {/* Generate Button */}
                <div className="w-20 flex justify-end"> {/* Spacer + Button */}
                    <Button
                        variant="primary"
                        size="sm"
                        icon="sparkles"
                        onClick={handleGenerateClick}
                        loading={isGenerating}
                        disabled={isGenerating || !tasksContent.trim() || tasksContent.startsWith('# No tasks found')}
                        className="!h-8 px-3"
                    >
                        Generate
                    </Button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row md:space-x-3 space-y-3 md:space-y-0 p-3 md:p-4">

                {/* Tasks Editor */}
                <div className="flex-1 flex flex-col min-w-0 rounded-lg shadow-lg border border-black/10 overflow-hidden bg-glass/30">
                    <div className="px-4 py-2 border-b border-black/10 bg-glass-alt-100 backdrop-blur-sm">
                        <h2 className="text-sm font-medium text-gray-700">Tasks for Summary ({filteredTasks.length})</h2>
                    </div>
                    <div className="flex-1 min-h-0 relative"> {/* Container for editor */}
                        <CodeMirrorEditor
                            ref={tasksEditorRef}
                            value={tasksContent}
                            onChange={handleTasksContentChange} // Allow editing task content display
                            placeholder="Select filters to view tasks eligible for summary (completion > 0% and due date within period)."
                            readOnly={false} // Make this editor editable
                            className="!absolute !inset-0 !h-full !w-full" // Ensure editor fills container
                        />
                    </div>
                </div>

                {/* Summary Editor */}
                <div className="flex-1 flex flex-col min-w-0 rounded-lg shadow-lg border border-black/10 overflow-hidden bg-glass/30">
                    <div className="px-4 py-2 border-b border-black/10 bg-glass-alt-100 backdrop-blur-sm">
                        <h2 className="text-sm font-medium text-gray-700">Generated Summary</h2>
                    </div>
                    <div className="flex-1 min-h-0 relative"> {/* Container for editor */}
                        <CodeMirrorEditor
                            ref={summaryEditorRef}
                            value={summaryContent}
                            onChange={() => {}} // No-op for read-only editor
                            placeholder="Click 'Generate' to create an AI summary of the tasks on the left."
                            readOnly={true} // Summary is read-only
                            className="!absolute !inset-0 !h-full !w-full" // Ensure editor fills container
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
SummaryView.displayName = 'SummaryView';
export default SummaryView;