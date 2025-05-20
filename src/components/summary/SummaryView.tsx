// src/components/summary/SummaryView.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import {
    currentDisplayedSummaryAtom,
    currentSummaryFilterKeyAtom,
    currentSummaryIndexAtom,
    filteredTasksForSummaryAtom,
    isGeneratingSummaryAtom,
    referencedTasksForSummaryAtom,
    relevantStoredSummariesAtom,
    storedSummariesAtom,
    StoredSummary,
    SUMMARY_FIELD_OPTIONS,
    summaryListFilterAtom,
    summaryPeriodFilterAtom,
    SummaryPeriodOption,
    summarySelectedFieldsAtom,
    summarySelectedTaskIdsAtom,
    tasksAtom,
    userListNamesAtom,
} from '@/store/atoms';
import Button from '../common/Button';
import Icon from '../common/Icon';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {Task} from '@/types';
import {
    addDays,
    format,
    formatDateTime,
    formatRelativeDate,
    isBefore,
    isSameDay,
    isValid,
    safeParseDate,
    startOfDay
} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import SelectionCheckboxRadix from '../common/SelectionCheckbox';
import useDebounce from '@/hooks/useDebounce';
import {CustomDateRangePickerContent} from '../common/CustomDateRangePickerPopover';
import SummaryHistoryModal from './SummaryHistoryModal';
import {AnimatePresence, motion} from 'framer-motion';

async function generateAiSummary(
    tasks: Task[],
    selectedFields: string[],
    fieldLabelsMap: { [id: string]: string }
): Promise<string> {
    console.log("Generating AI summary for tasks:", tasks.map(t => t.title), "selectedFields:", selectedFields);
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

    if (tasks.length === 0 && selectedFields.length === 0) return "No tasks selected or fields chosen for summary generation.";
    if (tasks.length === 0) return "No tasks selected to summarize. Please select tasks based on your filters.";

    const completedCount = tasks.filter(t => t.completed).length;
    const inProgressCount = tasks.length - completedCount;
    const lists = Array.from(new Set(tasks.map(t => t.list))).join(', ') || 'various lists';

    let summary = `Summary for ${tasks.length} task(s) from list(s): ${lists}.\n`;
    summary += `- ${completedCount} completed, ${inProgressCount} in progress.\n\n`;

    if (selectedFields.length === 0) {
        summary += "No specific summary sections were selected. General overview:\n";
        if (inProgressCount > 0) {
            const highPriority = tasks.find(t => !t.completed && t.priority === 1);
            const mediumPriority = tasks.find(t => !t.completed && t.priority === 2);
            const overdue = tasks.find(t => !t.completed && t.dueDate && isBefore(startOfDay(safeParseDate(t.dueDate)!), startOfDay(new Date())));
            summary += "- Focus areas: ";
            if (highPriority) summary += `High priority task **"${highPriority.title}"** needs attention. `;
            else if (mediumPriority) summary += `Medium priority task **"${mediumPriority.title}"** should be addressed. `;
            else if (overdue) summary += `Overdue task **"${overdue.title}"** requires action. `;
            else {
                const firstInProgress = tasks.find(t => !t.completed);
                summary += `Continue progress on **"${firstInProgress?.title ?? 'current tasks'}"**. `;
            }
        } else if (completedCount > 0) {
            summary += "- All selected tasks are complete. Well done!";
        } else {
            summary += "- No tasks to report on for a general overview.";
        }
    } else {
        selectedFields.forEach(fieldId => {
            const label = fieldLabelsMap[fieldId] || fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            summary += `**${label}:**\n`;

            switch (fieldId) {
                case 'accomplishments':
                    if (completedCount > 0) {
                        const completedTitles = tasks.filter(t => t.completed).slice(0, 3).map(t => `"${t.title}"`).join(', ');
                        summary += `- Successfully completed ${completedCount} task(s), including: ${completedTitles}${completedCount > 3 ? ' and others' : ''}.\n`;
                    } else {
                        summary += `- Focused on ongoing tasks rather than completions today.\n`;
                    }
                    const importantInProgress = tasks.filter(t => !t.completed && (t.priority === 1 || t.priority === 2)).slice(0, 2).map(t => `"${t.title}"`).join(' and ');
                    if (importantInProgress) summary += `- Made significant progress on: ${importantInProgress}.\n`;
                    else if (inProgressCount > 0) summary += `- Continued work on various ongoing tasks.\n`;
                    break;
                case 'tomorrowPlan':
                    const nextUpTasks = tasks.filter(t => !t.completed)
                        .sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4) || (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
                        .slice(0, 3);
                    if (nextUpTasks.length > 0) {
                        summary += `- Plan to address: ${nextUpTasks.map(t => `"${t.title}"`).join(', ')}.\n`;
                        if (nextUpTasks.some(t => t.dueDate && isSameDay(safeParseDate(t.dueDate)!, addDays(new Date(), 1)))) {
                            summary += `- Some of these tasks are scheduled for tomorrow.\n`;
                        }
                    } else if (tasks.length > 0 && completedCount === tasks.length) {
                        summary += `- All selected tasks are complete. Plan new tasks or review upcoming projects.\n`;
                    } else {
                        summary += `- Review overall project status and define next actionable steps.\n`;
                    }
                    break;
                case 'challenges':
                    const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && isBefore(startOfDay(safeParseDate(t.dueDate)!), startOfDay(new Date())));
                    const highPriorityIncomplete = tasks.filter(t => !t.completed && t.priority === 1);
                    if (overdueTasks.length > 0) {
                        summary += `- Key challenge: Addressing ${overdueTasks.length} overdue task(s), e.g., ${overdueTasks.slice(0, 2).map(t => `"${t.title}"`).join(', ')}.\n`;
                    } else if (highPriorityIncomplete.length > 0) {
                        summary += `- Challenge: Ensuring timely completion of high priority task(s) like ${highPriorityIncomplete.slice(0, 2).map(t => `"${t.title}"`).join(', ')}.\n`;
                    } else {
                        summary += `- No major critical challenges identified from the current task list. Continuous monitoring is advised.\n`;
                    }
                    break;
                case 'teamCommunication':
                    summary += `- Maintain clear communication with team members regarding task dependencies and project updates.\n`;
                    summary += `- Proactively share progress and impediments if any.\n`;
                    break;
                case 'learnings':
                    summary += `- Reflect on any new insights, tools, or techniques encountered or utilized during today's work.\n`;
                    summary += `- Consider how these learnings can be applied to future tasks for efficiency.\n`;
                    break;
                case 'blockers':
                    summary += `- Identify any current impediments slowing down progress (e.g., waiting for information, resource constraints).\n`;
                    summary += `- Formulate steps to mitigate or escalate these blockers.\n`;
                    break;
                case 'opportunities':
                    summary += `- Explore potential improvements to current workflows or processes.\n`;
                    summary += `- Consider any new ideas or suggestions that arose from today's activities.\n`;
                    break;
                default:
                    summary += `- [AI-generated content for "${label}" based on task analysis will go here.]\n`;
                    break;
            }
            summary += "\n";
        });
    }

    summary += `*This is a simulated AI summary, reflecting task data and selected summary fields.*`;
    return summary.trim();
}

const getSummaryMenuRadioItemStyle = (checked?: boolean) => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
    checked
        ? "bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light"
        : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
    "data-[disabled]:opacity-50"
);


const SummaryView: React.FC = () => {
    const [period, setPeriod] = useAtom(summaryPeriodFilterAtom);
    const [listFilter, setListFilter] = useAtom(summaryListFilterAtom);
    const availableLists = useAtomValue(userListNamesAtom);
    const filteredTasks = useAtomValue(filteredTasksForSummaryAtom);
    const [selectedTaskIds, setSelectedTaskIds] = useAtom(summarySelectedTaskIdsAtom);
    const relevantSummaries = useAtomValue(relevantStoredSummariesAtom);
    const allStoredSummaries = useAtomValue(storedSummariesAtom);
    const [currentIndex, setCurrentIndex] = useAtom(currentSummaryIndexAtom);
    const currentSummary = useAtomValue(currentDisplayedSummaryAtom);
    const setStoredSummaries = useSetAtom(storedSummariesAtom);
    const filterKey = useAtomValue(currentSummaryFilterKeyAtom);
    const [isGenerating, setIsGenerating] = useAtom(isGeneratingSummaryAtom);
    const referencedTasks = useAtomValue(referencedTasksForSummaryAtom);
    const allTasks = useAtomValue(tasksAtom);
    const [selectedFields, setSelectedFields] = useAtom(summarySelectedFieldsAtom);

    const [summaryEditorContent, setSummaryEditorContent] = useState('');
    const debouncedEditorContent = useDebounce(summaryEditorContent, 700);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isInternalEditorUpdate = useRef(false);

    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [isRefTasksDropdownOpen, setIsRefTasksDropdownOpen] = useState(false);
    const [isFieldsDropdownOpen, setIsFieldsDropdownOpen] = useState(false);

    useEffect(() => {
        setSelectedTaskIds(new Set());
        setCurrentIndex(0);
        hasUnsavedChangesRef.current = false;
    }, [period, listFilter, setCurrentIndex, setSelectedTaskIds]);

    useEffect(() => {
        const summaryToLoad = relevantSummaries[currentIndex];
        const summaryText = summaryToLoad?.summaryText ?? '';
        const currentEditorText = editorRef.current?.getView()?.state.doc.toString();
        if (summaryText !== currentEditorText) {
            isInternalEditorUpdate.current = true;
            setSummaryEditorContent(summaryText);
            hasUnsavedChangesRef.current = false;
        }
        setIsRefTasksDropdownOpen(false);
    }, [currentIndex, relevantSummaries]);

    useEffect(() => {
        if (hasUnsavedChangesRef.current && currentSummary?.id) {
            const summaryIdToUpdate = currentSummary.id;
            setStoredSummaries(prev => prev.map(s => s.id === summaryIdToUpdate ? {
                ...s,
                summaryText: debouncedEditorContent,
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false;
        }
    }, [debouncedEditorContent, currentSummary?.id, setStoredSummaries]);

    const forceSaveCurrentSummary = useCallback(() => {
        if (hasUnsavedChangesRef.current && currentSummary?.id) {
            const id = currentSummary.id;
            setStoredSummaries(p => p.map(s => s.id === id ? {
                ...s,
                summaryText: summaryEditorContent,
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false;
        }
    }, [currentSummary?.id, setStoredSummaries, summaryEditorContent]);

    const handlePeriodValueChange = useCallback((selectedValue: string) => {
        forceSaveCurrentSummary();
        if (selectedValue === 'custom') {
            setTimeout(() => {
                setIsRangePickerOpen(true);
            }, 50);
        } else {
            setPeriod(selectedValue as SummaryPeriodOption);
            setIsRangePickerOpen(false);
        }
    }, [setPeriod, setIsRangePickerOpen, forceSaveCurrentSummary]);

    const handleListChange = useCallback((newList: string) => {
        forceSaveCurrentSummary();
        setListFilter(newList);
    }, [setListFilter, forceSaveCurrentSummary]);

    const handleTaskSelectionChange = useCallback((taskId: string, isSelected: boolean | 'indeterminate') => {
        if (typeof isSelected === 'boolean') {
            setSelectedTaskIds(prev => {
                const newSet = new Set(prev);
                if (isSelected) newSet.add(taskId); else newSet.delete(taskId);
                return newSet;
            });
        }
    }, [setSelectedTaskIds]);

    const handleSelectAllTasks = useCallback(() => {
        const nonTrashedTaskIds = filteredTasks.filter(t => t.list !== 'Trash').map(t => t.id);
        setSelectedTaskIds(new Set(nonTrashedTaskIds));
    }, [filteredTasks, setSelectedTaskIds]);

    const handleDeselectAllTasks = useCallback(() => {
        setSelectedTaskIds(new Set());
    }, [setSelectedTaskIds]);

    const handleSelectAllToggle = useCallback((isChecked: boolean | 'indeterminate') => {
        if (isChecked === true) handleSelectAllTasks(); else handleDeselectAllTasks();
    }, [handleSelectAllTasks, handleDeselectAllTasks]);

    const fieldLabelsMap = useMemo(() => Object.fromEntries(SUMMARY_FIELD_OPTIONS.map(f => [f.id, f.label])), []);

    const handleGenerateClick = useCallback(async () => {
        forceSaveCurrentSummary();
        setIsGenerating(true);
        const tasksToSummarize = allTasks.filter(t => selectedTaskIds.has(t.id) && t.list !== 'Trash');
        try {
            const newSummaryText = await generateAiSummary(tasksToSummarize, selectedFields, fieldLabelsMap);
            const [periodKey, listKey] = filterKey.split('__');
            const newSummaryEntry: StoredSummary = {
                id: `summary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                createdAt: Date.now(),
                periodKey,
                listKey,
                taskIds: tasksToSummarize.map(t => t.id),
                summaryText: newSummaryText,
            };
            setStoredSummaries(prev => [newSummaryEntry, ...prev]);
            setCurrentIndex(0);
            hasUnsavedChangesRef.current = false;
        } catch (error) {
            console.error("Error generating summary:", error);
            isInternalEditorUpdate.current = true;
            setSummaryEditorContent(`Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
            hasUnsavedChangesRef.current = false;
        } finally {
            setIsGenerating(false);
        }
    }, [selectedTaskIds, allTasks, filterKey, setIsGenerating, setStoredSummaries, setCurrentIndex, forceSaveCurrentSummary, selectedFields, fieldLabelsMap]);

    const handleEditorChange = useCallback((newValue: string) => {
        if (!isInternalEditorUpdate.current) {
            setSummaryEditorContent(newValue);
            hasUnsavedChangesRef.current = true;
        }
        isInternalEditorUpdate.current = false;
    }, []);

    const handlePrevSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.min(prev + 1, relevantSummaries.length - 1));
    }, [setCurrentIndex, relevantSummaries.length, forceSaveCurrentSummary]);

    const handleNextSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }, [setCurrentIndex, forceSaveCurrentSummary]);

    const handleRangeApply = useCallback((startDate: Date, endDate: Date) => {
        forceSaveCurrentSummary();
        setPeriod({start: startDate.getTime(), end: endDate.getTime()});
        setIsRangePickerOpen(false);
    }, [setPeriod, setIsRangePickerOpen, forceSaveCurrentSummary]);

    const openHistoryModal = useCallback(() => {
        forceSaveCurrentSummary();
        setIsHistoryModalOpen(true);
    }, [forceSaveCurrentSummary]);

    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);
    const closeRangePicker = useCallback(() => setIsRangePickerOpen(false), []);

    const periodOptions = useMemo((): { label: string, value: SummaryPeriodOption | 'custom' }[] => [{
        label: 'Today',
        value: 'today'
    }, {label: 'Yesterday', value: 'yesterday'}, {label: 'This Week', value: 'thisWeek'}, {
        label: 'Last Week',
        value: 'lastWeek'
    }, {label: 'This Month', value: 'thisMonth'}, {label: 'Last Month', value: 'lastMonth'}, {
        label: 'Custom Range...',
        value: 'custom'
    },], []);

    const listOptions = useMemo(() => [{
        label: 'All Lists',
        value: 'all'
    }, ...availableLists.filter(name => name !== 'Trash').map(listName => ({
        label: listName,
        value: listName
    }))], [availableLists]);

    const selectedPeriodLabel = useMemo(() => {
        const option = periodOptions.find(p => typeof period === 'string' && p.value === period);
        if (option) return option.label;
        if (typeof period === 'object') {
            const startStr = format(period.start, 'MMM d');
            const endStr = format(period.end, 'MMM d');
            const startYear = format(period.start, 'yyyy');
            const endYear = format(period.end, 'yyyy');
            const currentYear = format(new Date(), 'yyyy');
            if (isSameDay(period.start, period.end)) return startYear !== currentYear ? format(period.start, 'MMM d, yyyy') : startStr;
            if (startYear !== endYear) return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`; else if (startYear !== currentYear) return `${startStr} - ${endStr}, ${startYear}`; else return `${startStr} - ${endStr}`;
        }
        return 'Select Period';
    }, [period, periodOptions]);

    const selectedListLabel = useMemo(() => {
        const option = listOptions.find(l => l.value === listFilter);
        return option ? option.label : 'Select List';
    }, [listFilter, listOptions]);

    const isGenerateDisabled = useMemo(() => {
        if (isGenerating) return true;
        if (selectedTaskIds.size === 0) return true;
        const selectedTasks = allTasks.filter(t => selectedTaskIds.has(t.id));
        return !selectedTasks.some(t => t.list !== 'Trash');
    }, [isGenerating, selectedTaskIds, allTasks]);

    const tasksUsedCount = useMemo(() => currentSummary?.taskIds.length ?? 0, [currentSummary]);
    const summaryTimestamp = useMemo(() => currentSummary ? formatDateTime(currentSummary.createdAt) : null, [currentSummary]);
    const selectableTasks = useMemo(() => filteredTasks.filter(t => t.list !== 'Trash'), [filteredTasks]);
    const allSelectableTasksSelected = useMemo(() => selectableTasks.length > 0 && selectableTasks.every(task => selectedTaskIds.has(task.id)), [selectableTasks, selectedTaskIds]);
    const someSelectableTasksSelected = useMemo(() => selectableTasks.some(task => selectedTaskIds.has(task.id)) && !allSelectableTasksSelected, [selectedTaskIds, allSelectableTasksSelected, selectableTasks]);

    const selectAllState = useMemo(() => {
        if (allSelectableTasksSelected) return true;
        if (someSelectableTasksSelected) return 'indeterminate';
        return false;
    }, [allSelectableTasksSelected, someSelectableTasksSelected]);

    const totalRelevantSummaries = useMemo(() => relevantSummaries.length, [relevantSummaries]);
    const displayedIndex = useMemo(() => totalRelevantSummaries > 0 ? (currentIndex + 1) : 0, [totalRelevantSummaries, currentIndex]);

    const dropdownAnimationClasses = "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide";
    const popoverAnimationClasses = "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide";

    const dropdownContentBaseClasses = useMemo(() => twMerge(
        "min-w-[200px] z-[60] bg-white rounded-base shadow-modal p-1 dark:bg-neutral-800 dark:border dark:border-neutral-700",
        dropdownAnimationClasses
    ), [dropdownAnimationClasses]);

    const tooltipContentClass = "text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[70] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const handleFieldSelectionChange = useCallback((fieldId: string) => {
        setSelectedFields(prev =>
            prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
        );
    }, [setSelectedFields]);

    const summaryFieldItemStyle = (checked?: boolean) => twMerge(
        "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
        "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
        "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
        checked
            ? "text-primary dark:text-primary-light"
            : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-200 dark:data-[highlighted]:text-neutral-100",
        "data-[disabled]:opacity-50"
    );

    const renderReferencedTasksDropdown = () => (
        <div
            className="bg-white dark:bg-neutral-800 rounded-base shadow-modal max-h-72 w-80 styled-scrollbar-thin overflow-y-auto p-1.5">
            <div
                className="px-1.5 py-1 text-[11px] font-normal text-grey-medium dark:text-neutral-400 border-b border-grey-light dark:border-neutral-700 sticky top-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm z-10">Referenced
                Tasks ({referencedTasks.length})
            </div>
            {referencedTasks.length > 0 ? (<ul className="pt-1 space-y-0.5">{referencedTasks.map(task => (
                <li key={task.id}
                    className="flex items-start p-1.5 rounded-base hover:bg-grey-ultra-light dark:hover:bg-neutral-700 transition-colors"
                    title={task.title}>
                    <div
                        className={twMerge("flex-shrink-0 w-3.5 h-3.5 rounded-full border mt-[1px] mr-2 flex items-center justify-center", task.completed ? "bg-primary border-primary" : task.completionPercentage && task.completionPercentage > 0 ? "border-primary/70 dark:border-primary-light/70" : "bg-white dark:bg-neutral-750 border-grey-light dark:border-neutral-600")}> {task.completed &&
                        <Icon name="check" size={8} strokeWidth={2}
                              className="text-white"/>} {task.completionPercentage && task.completionPercentage > 0 && !task.completed && (
                        <div className="w-1.5 h-1.5 bg-primary/80 dark:bg-primary-light/80 rounded-full"></div>)} </div>
                    <div className="flex-1 overflow-hidden"><p
                        className={twMerge("text-[12px] font-normal text-grey-dark dark:text-neutral-100 leading-snug truncate", task.completed && "line-through text-grey-medium dark:text-neutral-400 font-light")}>{task.title || "Untitled"}</p>
                        <div
                            className="flex items-center space-x-2 mt-0.5 text-[10px] text-grey-medium dark:text-neutral-400 font-light"> {task.completionPercentage && !task.completed && (
                            <span
                                className="font-normal text-primary dark:text-primary-light">[{task.completionPercentage}%]</span>)} {task.dueDate && isValid(safeParseDate(task.dueDate)) && (
                            <span className="flex items-center whitespace-nowrap"><Icon name="calendar" size={10}
                                                                                        strokeWidth={1}
                                                                                        className="mr-0.5 opacity-80"/>{formatRelativeDate(task.dueDate, false)}</span>)} {task.list && task.list !== 'Inbox' && (
                            <span
                                className="flex items-center bg-grey-ultra-light dark:bg-neutral-700 px-1 py-0 rounded-sm max-w-[70px] truncate"
                                title={task.list}><Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={9}
                                                        strokeWidth={1}
                                                        className="mr-0.5 opacity-80 flex-shrink-0"/><span
                                className="truncate">{task.list}</span></span>)} </div>
                    </div>
                </li>))}</ul>) : (
                <p className="text-[12px] text-grey-medium dark:text-neutral-400 italic p-4 text-center font-light">No
                    referenced tasks
                    found.</p>)} </div>);

    const TaskItemMiniInline: React.FC<{
        task: Task;
        isSelected: boolean;
        onSelectionChange: (id: string, selected: boolean | 'indeterminate') => void;
    }> = React.memo(({task, isSelected, onSelectionChange}) => {
        const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
        const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
        const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
        const uniqueId = `summary-task-${task.id}`;
        const isDisabled = task.list === 'Trash';
        const INITIAL_VISIBLE_SUBTASKS = 1;

        const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
            if ((e.target as HTMLElement).closest('[data-subtask-expander="true"]')) {
                e.preventDefault();
                return;
            }
            if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
            if (!isDisabled) onSelectionChange(task.id, !isSelected);
        };

        const toggleSubtaskExpansion = (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            setIsSubtasksExpanded(prev => !prev);
        };

        const sortedSubtasks = useMemo(() => {
            if (!task.subtasks) return [];
            return [...task.subtasks].sort((a, b) => a.order - b.order);
        }, [task.subtasks]);

        const subtasksToShow = useMemo(() => {
            if (!sortedSubtasks) return [];
            return isSubtasksExpanded ? sortedSubtasks : sortedSubtasks.slice(0, INITIAL_VISIBLE_SUBTASKS);
        }, [sortedSubtasks, isSubtasksExpanded, INITIAL_VISIBLE_SUBTASKS]);

        const hiddenSubtasksCount = useMemo(() => {
            if (!sortedSubtasks) return 0;
            return Math.max(0, sortedSubtasks.length - INITIAL_VISIBLE_SUBTASKS);
        }, [sortedSubtasks, INITIAL_VISIBLE_SUBTASKS]);

        return (<label htmlFor={uniqueId}
                       className={twMerge(
                           "flex flex-col p-2 rounded-base transition-colors duration-150 ease-in-out",
                           isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                           isSelected && !isDisabled ? "bg-grey-ultra-light dark:bg-neutral-700" : "hover:bg-grey-ultra-light dark:hover:bg-neutral-750"
                       )}
                       onClick={handleLabelClick}>
            <div className="flex items-center"><SelectionCheckboxRadix id={uniqueId} checked={isSelected}
                                                                       onChange={(checkedState) => onSelectionChange(task.id, checkedState)}
                                                                       aria-label={`Select task: ${task.title || 'Untitled Task'}`}
                                                                       className="mr-2 flex-shrink-0 pointer-events-none"
                                                                       size={16} disabled={isDisabled}/>
                <div className="flex-1 overflow-hidden"><span
                    className={twMerge("text-[13px] font-normal text-grey-dark dark:text-neutral-100 block truncate", task.completed && !isDisabled && "line-through text-grey-medium dark:text-neutral-400 font-light", isDisabled && "text-grey-medium dark:text-neutral-400 font-light")}>{task.title ||
                    <span className="italic">Untitled Task</span>}</span>
                    <div
                        className="text-[11px] font-light text-grey-medium dark:text-neutral-400 flex items-center space-x-2 mt-0.5 flex-wrap gap-y-0.5"> {task.completionPercentage && task.completionPercentage < 100 && !isDisabled && (
                        <span
                            className="text-primary dark:text-primary-light font-normal">[{task.completionPercentage}%]</span>)} {parsedDueDate && isValid(parsedDueDate) && (
                        <span
                            className={twMerge("flex items-center whitespace-nowrap", overdue && !task.completed && !isDisabled && "text-error dark:text-red-400 font-normal", task.completed && !isDisabled && "line-through")}><Icon
                            name="calendar" size={10} strokeWidth={1}
                            className="mr-0.5 opacity-80"/>{formatRelativeDate(parsedDueDate, false)}</span>)} {task.list && task.list !== 'Inbox' && (
                        <span
                            className="flex items-center bg-grey-ultra-light dark:bg-neutral-700 px-1 rounded-sm text-[10px] max-w-[70px] truncate"
                            title={task.list}><Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={10}
                                                    strokeWidth={1} className="mr-0.5 opacity-80 flex-shrink-0"/><span
                            className="truncate">{task.list}</span></span>)} {task.tags && task.tags.length > 0 && (
                        <span className="flex items-center space-x-1">{task.tags.slice(0, 1).map(tag => (<span key={tag}
                                                                                                               className="bg-grey-ultra-light dark:bg-neutral-700 px-1 rounded-sm text-[10px] max-w-[60px] truncate">#{tag}</span>))}{task.tags.length > 1 &&
                            <span
                                className="text-[10px] text-grey-medium/80 dark:text-neutral-400/80">+{task.tags.length - 1}</span>}</span>)} </div>
                </div>
            </div>
            {sortedSubtasks && sortedSubtasks.length > 0 && !isDisabled && (
                <div
                    className={twMerge("mt-1.5 pt-1.5 border-t border-grey-light dark:border-neutral-700", "pl-[calc(0.5rem+16px+0.5rem)]")}>
                    <AnimatePresence initial={false}>
                        <motion.div key="subtask-list-animated" initial="collapsed"
                                    animate={isSubtasksExpanded ? "open" : "collapsed"} exit="collapsed" variants={{
                            open: {
                                opacity: 1,
                                height: 'auto',
                                transition: {duration: 0.25, ease: [0.33, 1, 0.68, 1]}
                            }, collapsed: {opacity: 0, height: 0, transition: {duration: 0.2, ease: [0.33, 1, 0.68, 1]}}
                        }} className="overflow-hidden">
                            <div
                                className={twMerge("max-h-28 overflow-y-auto styled-scrollbar-thin pr-1", isSubtasksExpanded ? "pb-1" : "")}> {sortedSubtasks.map(sub => (
                                <div key={sub.id} className="flex items-center text-[12px] font-light mb-0.5">
                                    <SelectionCheckboxRadix id={`summary-subtask-item-check-${sub.id}`}
                                                            checked={sub.completed} onChange={() => {
                                    }} aria-label={`Subtask: ${sub.title || 'Untitled Subtask'} status`}
                                                            className="mr-1.5 flex-shrink-0 pointer-events-none opacity-80"
                                                            size={11} disabled={true}/><span
                                    className={twMerge("truncate text-grey-medium dark:text-neutral-400", sub.completed && "line-through opacity-70")}>{sub.title ||
                                    <span className="italic">Untitled Subtask</span>}</span></div>))} </div>
                        </motion.div>
                    </AnimatePresence> {!isSubtasksExpanded && subtasksToShow.map(sub => (
                    <div key={`preview-${sub.id}`} className="flex items-center text-[12px] font-light mb-0.5">
                        <SelectionCheckboxRadix id={`summary-subtask-item-preview-check-${sub.id}`}
                                                checked={sub.completed} onChange={() => {
                        }} aria-label={`Subtask: ${sub.title || 'Untitled Subtask'} status`}
                                                className="mr-1.5 flex-shrink-0 pointer-events-none opacity-80"
                                                size={11} disabled={true}/><span
                        className={twMerge("truncate text-grey-medium dark:text-neutral-400", sub.completed && "line-through opacity-70")}>{sub.title ||
                        <span className="italic">Untitled Subtask</span>}</span>
                    </div>))} {sortedSubtasks.length > INITIAL_VISIBLE_SUBTASKS && (
                    <button type="button" data-subtask-expander="true" onClick={toggleSubtaskExpansion}
                            className={twMerge("text-[10px] text-primary dark:text-primary-light hover:underline mt-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded font-light", "ml-[calc(0.5rem+11px)]")}
                            aria-expanded={isSubtasksExpanded}>{isSubtasksExpanded ? "Show less" : `+ ${hiddenSubtasksCount} more subtask${hiddenSubtasksCount > 1 ? 's' : ''}`}</button>)}
                </div>)} </label>);
    });
    TaskItemMiniInline.displayName = 'TaskItemMiniInline';

    return (
        <div className="h-full flex flex-col bg-white dark:bg-neutral-800 overflow-hidden">
            <div
                className="px-6 py-0 h-[56px] border-b border-grey-light dark:border-neutral-700 flex justify-between items-center flex-shrink-0 bg-white dark:bg-neutral-800 z-10">
                <div className="w-1/3 flex items-center space-x-2">
                    <h1 className="text-[18px] font-light text-grey-dark dark:text-neutral-100 truncate">AI Summary</h1>
                    <Tooltip.Provider><Tooltip.Root delayDuration={200}><Tooltip.Trigger asChild><Button variant="ghost"
                                                                                                         size="icon"
                                                                                                         icon="history"
                                                                                                         onClick={openHistoryModal}
                                                                                                         className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                                                                                                         iconProps={{
                                                                                                             size: 16,
                                                                                                             strokeWidth: 1
                                                                                                         }}
                                                                                                         aria-label="View Summary History"/></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                        className={tooltipContentClass} sideOffset={4}>View All Generated Summaries<Tooltip.Arrow
                        className="fill-grey-dark dark:fill-neutral-900/95"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
                </div>
                <div className="flex-1 flex justify-center items-center space-x-1">
                    <Popover.Root modal={true} open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
                        <DropdownMenu.Root open={isPeriodDropdownOpen} onOpenChange={setIsPeriodDropdownOpen}>
                            <Popover.Anchor asChild><DropdownMenu.Trigger asChild>
                                <Button variant="ghost" size="sm"
                                        className="!h-8 px-3 text-grey-dark dark:text-neutral-200 font-light hover:bg-grey-ultra-light dark:hover:bg-neutral-700 dark:bg-neutral-750 dark:border-neutral-600 min-w-[120px] tabular-nums">
                                    <Icon
                                        name="calendar-days" size={14} strokeWidth={1}
                                        className="mr-1.5 opacity-80"/>
                                    {selectedPeriodLabel}
                                    <Icon
                                        name="chevron-down"
                                        size={14} strokeWidth={1}
                                        className="ml-auto opacity-70 pl-1"/>
                                </Button>
                            </DropdownMenu.Trigger></Popover.Anchor>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className={dropdownContentBaseClasses}
                                    sideOffset={5} align="center" onCloseAutoFocus={e => e.preventDefault()}>
                                    <DropdownMenu.RadioGroup value={typeof period === 'string' ? period : 'custom'}
                                                             onValueChange={handlePeriodValueChange}>
                                        {periodOptions.map(p => (
                                            <DropdownMenu.RadioItem key={p.label}
                                                                    value={typeof p.value === 'string' ? p.value : 'custom'}
                                                                    className={getSummaryMenuRadioItemStyle(
                                                                        (typeof period === 'string' && period === p.value) || (typeof period === 'object' && p.value === 'custom')
                                                                    )}
                                            >
                                                {p.label}
                                                <DropdownMenu.ItemIndicator
                                                    className="absolute right-2 inline-flex items-center">
                                                    <Icon name="check" size={12} strokeWidth={2}/>
                                                </DropdownMenu.ItemIndicator>
                                            </DropdownMenu.RadioItem>))}
                                    </DropdownMenu.RadioGroup>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        <Popover.Portal>
                            <Popover.Content side="bottom" align="center" sideOffset={5}
                                             className={twMerge("z-[70] p-0 bg-white rounded-base shadow-modal dark:bg-neutral-800", popoverAnimationClasses)}
                                             onOpenAutoFocus={(e) => e.preventDefault()}
                                             onCloseAutoFocus={(e) => e.preventDefault()}>
                                <CustomDateRangePickerContent
                                    initialStartDate={typeof period === 'object' ? new Date(period.start) : undefined}
                                    initialEndDate={typeof period === 'object' ? new Date(period.end) : undefined}
                                    onApplyRange={handleRangeApply} closePopover={closeRangePicker}/>
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>
                    <DropdownMenu.Root open={isListDropdownOpen} onOpenChange={setIsListDropdownOpen}>
                        <DropdownMenu.Trigger asChild><Button variant="ghost" size="sm"
                                                              className="!h-8 px-3 text-grey-dark dark:text-neutral-200 font-light hover:bg-grey-ultra-light dark:hover:bg-neutral-700 dark:bg-neutral-750 dark:border-neutral-600 min-w-[110px]"><Icon
                            name="list" size={14} strokeWidth={1}
                            className="mr-1.5 opacity-80"/>{selectedListLabel}<Icon name="chevron-down"
                                                                                    size={14}
                                                                                    strokeWidth={1}
                                                                                    className="ml-auto opacity-70 pl-1"/></Button></DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className={twMerge(dropdownContentBaseClasses, "max-h-60 overflow-y-auto styled-scrollbar-thin")}
                                sideOffset={5} align="center" onCloseAutoFocus={e => e.preventDefault()}>
                                <DropdownMenu.RadioGroup value={listFilter} onValueChange={handleListChange}>
                                    {listOptions.map(l => (<DropdownMenu.RadioItem key={l.value} value={l.value}
                                                                                   className={getSummaryMenuRadioItemStyle(listFilter === l.value)}
                                    >{l.label}
                                        <DropdownMenu.ItemIndicator
                                            className="absolute right-2 inline-flex items-center">
                                            <Icon name="check" size={12} strokeWidth={2}/>
                                        </DropdownMenu.ItemIndicator>
                                    </DropdownMenu.RadioItem>))}
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
                <div className="w-1/3 flex justify-end">
                    <Button variant="primary" size="sm" icon={isGenerating ? undefined : "sparkles"}
                            loading={isGenerating} onClick={handleGenerateClick} disabled={isGenerateDisabled}
                            className="!h-8 px-3"><span
                        className="font-normal">{isGenerating ? 'Generating...' : 'Generate'}</span></Button>
                </div>
            </div>
            <div
                className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 md:p-4 gap-3 md:gap-4 min-h-0">
                {/* Left Panel: Task List */}
                <div
                    className="w-full md:w-[360px] h-1/2 md:h-full flex flex-col bg-white dark:bg-neutral-800 overflow-hidden flex-shrink-0">
                    <div
                        className="px-4 py-3 border-b border-grey-light dark:border-neutral-700 flex justify-between items-center flex-shrink-0 h-12">
                        <h2 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 truncate">Tasks
                            ({selectableTasks.length})</h2>
                        <SelectionCheckboxRadix id="select-all-summary-tasks" checked={selectAllState === true}
                                                indeterminate={selectAllState === 'indeterminate'}
                                                onChange={handleSelectAllToggle}
                                                aria-label={allSelectableTasksSelected ? "Deselect all tasks" : (someSelectableTasksSelected ? "Deselect some tasks" : "Select all tasks")}
                                                className="mr-1" size={16} disabled={selectableTasks.length === 0}/>
                    </div>
                    <div className="flex-1 overflow-y-auto styled-scrollbar-thin p-2 space-y-1">
                        {filteredTasks.length === 0 ? (
                            <div
                                className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-4 text-center pt-10">
                                <Icon name="archive" size={32} strokeWidth={1}
                                      className="mb-3 text-grey-light dark:text-neutral-500 opacity-80"/><p
                                className="text-[13px] font-normal text-grey-dark dark:text-neutral-200">No relevant
                                tasks found</p><p
                                className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">Adjust
                                filters or check task
                                status/progress.</p></div>
                        ) : (filteredTasks.map(task => (
                            <TaskItemMiniInline key={task.id} task={task} isSelected={selectedTaskIds.has(task.id)}
                                                onSelectionChange={handleTaskSelectionChange}/>)))}
                    </div>
                </div>

                {/* Vertical Separator (visible on md screens and up) */}
                <div className="hidden md:block w-px bg-grey-light dark:bg-neutral-700 self-stretch my-0"></div>

                {/* Right Panel: Summary Editor */}
                <div
                    className="flex-1 h-1/2 md:h-full flex flex-col bg-white dark:bg-neutral-800 overflow-hidden">
                    {/* Header section for Summary */}
                    <div
                        className="px-4 py-3 h-12 border-b border-grey-light dark:border-neutral-700 flex justify-between items-center flex-shrink-0">
                        {(totalRelevantSummaries > 0 || isGenerating) ? (
                            <span
                                className="text-[11px] font-light text-grey-medium dark:text-neutral-400 truncate">
                                {isGenerating ? 'Generating summary...' : (summaryTimestamp ? `Generated: ${summaryTimestamp}` : 'Unsaved Summary')}
                            </span>
                        ) : (
                            <h2 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 truncate">Summary</h2>
                        )}
                        <div className="flex items-center space-x-1.5">
                            <DropdownMenu.Root open={isRefTasksDropdownOpen}
                                               onOpenChange={setIsRefTasksDropdownOpen}>
                                <DropdownMenu.Trigger asChild disabled={!currentSummary || isGenerating}>
                                    <Button
                                        variant="link" size="sm"
                                        className="text-[11px] !h-5 px-1 text-primary hover:text-primary-dark -mr-1"
                                        aria-haspopup="true">
                                        {tasksUsedCount} tasks used
                                        <Icon name="chevron-down" size={12} strokeWidth={1}
                                              className="ml-0.5 opacity-70"/>
                                    </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={twMerge("z-[60] p-0 dark:border dark:border-neutral-700", dropdownAnimationClasses)}
                                        sideOffset={4}
                                        align="end"
                                        onCloseAutoFocus={e => e.preventDefault()}
                                    >
                                        {renderReferencedTasksDropdown()}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>

                            {totalRelevantSummaries > 1 && !isGenerating && (<>
                                <Button variant="ghost" size="icon" icon="chevron-left"
                                        onClick={handlePrevSummary}
                                        disabled={currentIndex >= totalRelevantSummaries - 1}
                                        className="w-6 h-6 text-grey-medium dark:text-neutral-400"
                                        iconProps={{size: 14, strokeWidth: 1}} aria-label="Older summary"/>
                                <span
                                    className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 tabular-nums">{displayedIndex} / {totalRelevantSummaries}</span>
                                <Button variant="ghost" size="icon" icon="chevron-right"
                                        onClick={handleNextSummary} disabled={currentIndex <= 0}
                                        className="w-6 h-6 text-grey-medium dark:text-neutral-400"
                                        iconProps={{size: 14, strokeWidth: 1}} aria-label="Newer summary"/>
                            </>)}

                            <DropdownMenu.Root open={isFieldsDropdownOpen} onOpenChange={setIsFieldsDropdownOpen}>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="ghost" size="sm" icon="list-checks"
                                            className="text-grey-medium dark:text-neutral-400 !h-7 px-2 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                                            aria-label="Customize summary fields"
                                            aria-haspopup="true"
                                            aria-expanded={isFieldsDropdownOpen}
                                    />
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={twMerge(dropdownContentBaseClasses, "min-w-[240px] p-1.5")}
                                        sideOffset={5} align="end"
                                        onCloseAutoFocus={e => e.preventDefault()}
                                    >
                                        <div
                                            className="px-2 pb-1.5 pt-0.5 text-[11px] font-normal text-grey-medium dark:text-neutral-400 border-b border-grey-light dark:border-neutral-700 mb-1">
                                            Select Summary Sections
                                        </div>
                                        {SUMMARY_FIELD_OPTIONS.map(field => {
                                            const isSelected = selectedFields.includes(field.id);
                                            return (
                                                <DropdownMenu.Item
                                                    key={field.id}
                                                    className={summaryFieldItemStyle(isSelected)}
                                                    onSelect={(event) => {
                                                        event.preventDefault();
                                                        handleFieldSelectionChange(field.id);
                                                    }}
                                                    textValue={field.label}
                                                >
                                                    <div
                                                        className="w-5 h-5 flex items-center justify-center mr-2 flex-shrink-0">
                                                        {isSelected && (
                                                            <Icon name="check" size={15} strokeWidth={2.5}
                                                                  className="text-primary dark:text-primary-light"/>
                                                        )}
                                                    </div>
                                                    {field.label}
                                                </DropdownMenu.Item>
                                            );
                                        })}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </div>
                    </div>

                    {/* Main content area for summary (editor or placeholder) */}
                    <div className="flex-1 min-h-0 p-4">
                        {(totalRelevantSummaries > 0 || isGenerating) ? (
                            <div className="h-full w-full relative overflow-hidden bg-white dark:bg-neutral-800">
                                <CodeMirrorEditor
                                    key={isGenerating ? 'generating' : (currentSummary?.id ?? 'no-summary')}
                                    ref={editorRef} value={summaryEditorContent} onChange={handleEditorChange}
                                    placeholder={isGenerating ? "Generating..." : "AI generated summary will appear here..."}
                                    className="!h-full !bg-transparent !border-none"
                                    readOnly={isGenerating || !currentSummary}/>
                                {hasUnsavedChangesRef.current && !isGenerating && currentSummary && (<span
                                    className="absolute bottom-2 right-2 text-[10px] text-grey-medium/70 dark:text-neutral-400/70 italic animate-pulse font-light">saving...</span>)}
                                {isGenerating && (<div
                                    className="absolute inset-0 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-sm flex items-center justify-center z-10">
                                    <Icon name="loader" size={20} strokeWidth={1.5}
                                          className="text-primary dark:text-primary-light animate-spin"/></div>)}
                            </div>
                        ) : (
                            <div
                                className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-2 text-center">
                                <Icon name="sparkles" size={32} strokeWidth={1}
                                      className="mb-3 text-grey-light dark:text-neutral-500 opacity-80"/>
                                <p className="text-[13px] font-normal text-grey-dark dark:text-neutral-200">No Summary
                                    Available</p>
                                <p className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">Select
                                    tasks and click
                                    'Generate' or adjust filters.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <SummaryHistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} summaries={allStoredSummaries}
                                 allTasks={allTasks}/>
        </div>
    );
};
SummaryView.displayName = 'SummaryView';
export default SummaryView;