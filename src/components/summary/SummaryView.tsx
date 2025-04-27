// src/components/summary/SummaryView.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import ReactDOM from 'react-dom';
import {usePopper} from 'react-popper';
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
    summaryListFilterAtom,
    summaryPeriodFilterAtom,
    SummaryPeriodOption,
    summarySelectedTaskIdsAtom,
    tasksAtom,
    userListNamesAtom
} from '@/store/atoms';
import Button from '../common/Button';
import Dropdown, {DropdownRenderProps} from '../common/Dropdown';
import Icon from '../common/Icon';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {Task} from '@/types';
import {
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
// import { AnimatePresence, motion } from 'framer-motion';
import SelectionCheckbox from '../common/SelectionCheckbox';
// import TaskItemMini from './TaskItemMini';
import {Tooltip} from 'react-tooltip';
import useDebounce from '@/hooks/useDebounce';
import CustomDateRangePickerPopover from '../common/CustomDateRangePickerPopover';
import SummaryHistoryModal from './SummaryHistoryModal'; // Import the History Modal

// --- Placeholder AI Function ---
async function generateAiSummary(tasks: Task[]): Promise<string> {
    console.log("Generating AI summary for tasks:", tasks.map(t => t.title));
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (tasks.length === 0) return "No tasks selected or found for summary generation.";
    // const taskTitles = tasks.map(t => `- ${t.title} (${t.completionPercentage ?? 0}%)`).join('\n');
    const summary = `
Summary for ${tasks.length} selected task(s):

Highlights include progress on **${tasks[0]?.title ?? 'selected tasks'}** (${tasks[0]?.completionPercentage ?? 0}% from list "${tasks[0]?.list ?? ''}").

Overall status seems ${tasks.length > 3 ? 'active' : 'manageable'}.

Consider potential blockers or next steps for tasks like **${tasks[tasks.length - 1]?.title ?? 'other items'}**.

*Simulated summary based on selection.*
    `;
    return summary.trim();
}

// --- Main Summary View Component ---
const SummaryView: React.FC = () => {
    // Atoms
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

    // Local State & Refs
    const [summaryEditorContent, setSummaryEditorContent] = useState('');
    const debouncedEditorContent = useDebounce(summaryEditorContent, 700);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isInternalEditorUpdate = useRef(false);
    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const [rangePickerTriggerElement, setRangePickerTriggerElement] = useState<HTMLButtonElement | null>(null);
    const [rangePopperElement, setRangePopperElement] = useState<HTMLDivElement | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Popper for Date Range Picker
    const {styles: rangePopperStyles, attributes: rangePopperAttributes, update: updateRangePopper} = usePopper(
        rangePickerTriggerElement, rangePopperElement, {
            placement: 'bottom-start', strategy: 'fixed',
            modifiers: [{name: 'offset', options: {offset: [0, 8]}}, {
                name: 'flip',
                options: {padding: 10}
            }, {name: 'preventOverflow', options: {padding: 10}},],
        }
    );

    // --- Effects ---
    useEffect(() => {
        setSelectedTaskIds(new Set());
        setCurrentIndex(0);
    }, [period, listFilter, setCurrentIndex, setSelectedTaskIds]);

    useEffect(() => {
        const summaryToLoad = relevantSummaries[currentIndex];
        const summaryText = summaryToLoad?.summaryText ?? '';
        if (summaryText !== editorRef.current?.getView()?.state.doc.toString()) {
            const isEditorFocused = editorRef.current?.getView()?.hasFocus ?? false;
            if (!isEditorFocused) {
                isInternalEditorUpdate.current = true;
                setSummaryEditorContent(summaryText);
                hasUnsavedChangesRef.current = false;
            }
        }
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

    useEffect(() => {
        if (isRangePickerOpen && updateRangePopper) {
            updateRangePopper();
        }
    }, [isRangePickerOpen, updateRangePopper]);

    // --- Callbacks ---
    const handlePeriodChange = useCallback((newPeriodValue: SummaryPeriodOption | 'custom', closeDropdown?: () => void, event?: React.MouseEvent<HTMLButtonElement>) => {
        if (newPeriodValue === 'custom') {
            // Ensure the trigger element is correctly captured *before* opening
            if (event?.currentTarget) setRangePickerTriggerElement(event.currentTarget);
            else console.warn("Could not get trigger element for range picker"); // Fallback or error handling
            setIsRangePickerOpen(true);
            closeDropdown?.();
        } else {
            setPeriod(newPeriodValue as SummaryPeriodOption);
            setIsRangePickerOpen(false);
            closeDropdown?.();
        }
    }, [setPeriod]);
    const handleListChange = useCallback((newList: string, close?: () => void) => {
        setListFilter(newList);
        close?.();
    }, [setListFilter]);
    const handleTaskSelectionChange = useCallback((taskId: string, isSelected: boolean) => {
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) newSet.add(taskId); else newSet.delete(taskId);
            return newSet;
        });
    }, [setSelectedTaskIds]);
    const handleSelectAllTasks = useCallback(() => {
        setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }, [filteredTasks, setSelectedTaskIds]);
    const handleDeselectAllTasks = useCallback(() => {
        setSelectedTaskIds(new Set());
    }, [setSelectedTaskIds]);
    const handleGenerateClick = useCallback(async () => {
        setIsGenerating(true);
        const tasksToSummarize = allTasks.filter(t => selectedTaskIds.has(t.id));
        try {
            const newSummaryText = await generateAiSummary(tasksToSummarize);
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
        } catch (error) {
            console.error("Error generating summary:", error);
        } finally {
            setIsGenerating(false);
        }
    }, [selectedTaskIds, allTasks, filterKey, setIsGenerating, setStoredSummaries, setCurrentIndex]);
    const handleEditorChange = useCallback((newValue: string) => {
        setSummaryEditorContent(newValue);
        if (!isInternalEditorUpdate.current) {
            hasUnsavedChangesRef.current = true;
        }
        isInternalEditorUpdate.current = false;
    }, []);
    const forceSaveCurrentSummary = useCallback(() => {
        if (hasUnsavedChangesRef.current && currentSummary?.id) {
            const id = currentSummary.id;
            setStoredSummaries(p => p.map(s => s.id === id ? {
                ...s,
                summaryText: summaryEditorContent,
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false;
            console.log("Force saved summary:", id);
        }
    }, [currentSummary?.id, setStoredSummaries, summaryEditorContent]);
    const handlePrevSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.min(prev + 1, relevantSummaries.length - 1));
    }, [setCurrentIndex, relevantSummaries.length, forceSaveCurrentSummary]);
    const handleNextSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }, [setCurrentIndex, forceSaveCurrentSummary]);
    const handleRangeApply = useCallback((startDate: Date, endDate: Date) => {
        setPeriod({start: startDate.getTime(), end: endDate.getTime()});
        setIsRangePickerOpen(false);
    }, [setPeriod]);
    const handleCloseRangePicker = useCallback(() => {
        setIsRangePickerOpen(false);
        setRangePickerTriggerElement(null);
    }, []); // Reset trigger on close
    const openHistoryModal = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

    // --- Memoized Values ---
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
    }, ...availableLists.map(listName => ({label: listName, value: listName}))], [availableLists]);
    const selectedPeriodLabel = useMemo(() => {
        const option = periodOptions.find(p => typeof period === 'string' && p.value === period);
        if (option) return option.label;
        if (typeof period === 'object') {
            const startStr = format(period.start, 'MMM d');
            const endStr = format(period.end, 'MMM d');
            const startYear = format(period.start, 'yyyy');
            const endYear = format(period.end, 'yyyy');
            if (isSameDay(period.start, period.end)) return startYear !== format(new Date(), 'yyyy') ? format(period.start, 'MMM d, yyyy') : startStr;
            const currentYear = format(new Date(), 'yyyy');
            if (startYear !== endYear) return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`; else if (startYear !== currentYear) return `${startStr} - ${endStr}, ${startYear}`; else return `${startStr} - ${endStr}`;
        }
        return 'Select Period';
    }, [period, periodOptions]);
    const selectedListLabel = useMemo(() => {
        const option = listOptions.find(l => l.value === listFilter);
        return option ? option.label : 'Unknown List';
    }, [listFilter, listOptions]);
    const isGenerateDisabled = useMemo(() => isGenerating || selectedTaskIds.size === 0, [isGenerating, selectedTaskIds]);
    const tasksUsedCount = useMemo(() => currentSummary?.taskIds.length ?? 0, [currentSummary]);
    const summaryTimestamp = useMemo(() => currentSummary ? formatDateTime(currentSummary.createdAt) : null, [currentSummary]);
    const allTasksSelected = useMemo(() => filteredTasks.length > 0 && filteredTasks.every(task => selectedTaskIds.has(task.id)), [filteredTasks, selectedTaskIds]);
    const someTasksSelected = useMemo(() => selectedTaskIds.size > 0 && !allTasksSelected, [selectedTaskIds, allTasksSelected]);
    const totalRelevantSummaries = useMemo(() => relevantSummaries.length, [relevantSummaries]);
    const displayedIndex = useMemo(() => totalRelevantSummaries - currentIndex, [totalRelevantSummaries, currentIndex]);

    // --- Render Functions ---
    const renderReferencedTasksDropdown = () => (
        <div
            className="bg-glass-100/95 backdrop-blur-xl rounded-lg shadow-xl border border-black/10 max-h-72 w-80 styled-scrollbar overflow-y-auto">
            <div
                className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-black/10 sticky top-0 bg-glass-100/80 backdrop-blur-md z-10"> Referenced
                Tasks ({referencedTasks.length})
            </div>
            {referencedTasks.length > 0 ? (
                <ul className="p-1.5 space-y-0.5"> {referencedTasks.map(task => (
                    <li key={task.id}
                        className="flex items-start p-1.5 rounded hover:bg-black/5 transition-colors duration-100 ease-apple"
                        title={task.title}>
                        <div
                            className={twMerge("flex-shrink-0 w-4 h-4 rounded-full border mt-[1px] mr-2.5 flex items-center justify-center", task.completed ? "bg-primary/90 border-primary/90" : task.completionPercentage && task.completionPercentage > 0 ? "border-primary/70" : "bg-white/40 border-gray-400/80")}>
                            {task.completed && <Icon name="check" size={9} className="text-white" strokeWidth={3}/>}
                            {task.completionPercentage && task.completionPercentage > 0 && !task.completed && (
                                <div className="w-1.5 h-1.5 bg-primary/80 rounded-full"></div>)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className={twMerge("text-[12.5px] font-medium text-gray-800 leading-snug truncate", task.completed && "line-through text-muted-foreground")}> {task.title || "Untitled"} </p>
                            <div className="flex items-center space-x-2 mt-0.5 text-[10.5px] text-muted-foreground">
                                {task.completionPercentage && !task.completed && (<span
                                    className="font-medium text-primary/90">[{task.completionPercentage}%]</span>)}
                                {task.dueDate && isValid(safeParseDate(task.dueDate)) && (
                                    <span className="flex items-center whitespace-nowrap"> <Icon name="calendar"
                                                                                                 size={10}
                                                                                                 className="mr-0.5 opacity-60"/> {formatRelativeDate(task.dueDate)} </span>)}
                                {task.list && task.list !== 'Inbox' && (<span
                                    className="flex items-center bg-black/10 px-1 py-0 rounded-[3px] max-w-[70px] truncate"
                                    title={task.list}> <Icon name="list" size={9}
                                                             className="mr-0.5 opacity-60 flex-shrink-0"/> <span
                                    className="truncate">{task.list}</span> </span>)}
                            </div>
                        </div>
                    </li>))}
                </ul>
            ) : (<p className="text-xs text-muted-foreground italic p-4 text-center">No referenced tasks found.</p>)}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-glass-alt-100 overflow-hidden">
            {/* Page Header */}
            <div
                className="px-3 md:px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                <div className="w-1/3 flex items-center space-x-2">
                    <h1 className="text-base font-semibold text-gray-800 truncate">AI Summary</h1>
                    <Button variant="ghost" size="icon" icon="history" onClick={openHistoryModal}
                            className="w-7 h-7 text-muted-foreground hover:bg-black/15"
                            aria-label="View Summary History" data-tooltip-id="summary-history-tooltip"
                            data-tooltip-content="View All Generated Summaries"/>
                    <Tooltip id="summary-history-tooltip" place="bottom" className="!z-[60]"/>
                </div>
                <div className="flex-1 flex justify-center items-center space-x-2">
                    {/* Period Dropdown - Wrap trigger in div for Popper ref */}
                    <div> {/* This div doesn't need the ref, the button inside does */}
                        <Dropdown placement="bottom" contentClassName="py-1 w-40" trigger={
                            <Button
                                ref={setRangePickerTriggerElement} // Set ref on the Button itself
                                variant="ghost" size="sm"
                                className="text-sm h-8 px-2 text-gray-700 font-medium hover:bg-black/15 min-w-[120px]"
                            >
                                <Icon name="calendar-days" size={14} className="mr-1.5 opacity-70"/>
                                {selectedPeriodLabel}
                                <Icon name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/>
                            </Button>
                        }>
                            {({close}: DropdownRenderProps) => (<> {periodOptions.map(p => (
                                <button key={typeof p.value === 'string' ? p.value : 'custom'}
                                        onClick={(e) => handlePeriodChange(p.value, close, e)}
                                        className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 focus:outline-none focus-visible:bg-black/10 rounded-[3px]", period === p.value && "bg-primary/20 text-primary font-medium")}
                                        role="menuitemradio"
                                        aria-checked={period === p.value}> {p.label} </button>))} </>)}
                        </Dropdown>
                    </div>
                    {/* List Dropdown */}
                    <Dropdown placement="bottom" contentClassName="py-1 max-h-60 overflow-y-auto styled-scrollbar w-40"
                              trigger={<Button variant="ghost" size="sm"
                                               className="text-sm h-8 px-2 text-gray-700 font-medium hover:bg-black/15 min-w-[110px]">
                                  <Icon name="list" size={14} className="mr-1.5 opacity-70"/> {selectedListLabel} <Icon
                                  name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/> </Button>}>
                        {({close}: DropdownRenderProps) => (<> {listOptions.map(l => (
                            <button key={l.value} onClick={() => handleListChange(l.value, close)}
                                    className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 focus:outline-none focus-visible:bg-black/10 rounded-[3px]", listFilter === l.value && "bg-primary/20 text-primary font-medium")}
                                    role="menuitemradio"
                                    aria-checked={listFilter === l.value}> {l.label} </button>))} </>)}
                    </Dropdown>
                </div>
                <div className="w-1/3 flex justify-end"><Button variant="primary" size="sm"
                                                                icon={isGenerating ? undefined : "sparkles"}
                                                                loading={isGenerating} onClick={handleGenerateClick}
                                                                disabled={isGenerateDisabled}
                                                                className="px-3 !h-8"> {isGenerating ? 'Generating...' : 'Generate'} </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 md:p-3 gap-2 md:gap-3 min-h-0">
                {/* Left Pane: Task List */}
                <div
                    className="w-full md:w-[320px] h-1/2 md:h-full flex flex-col bg-glass-alt-100 backdrop-blur-xl rounded-lg shadow-lg border border-black/10 overflow-hidden flex-shrink-0">
                    <div
                        className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11">
                        <h2 className="text-base font-semibold text-gray-800 truncate">Tasks
                            ({filteredTasks.length})</h2> <SelectionCheckbox id="select-all-summary-tasks"
                                                                             checked={allTasksSelected}
                                                                             indeterminate={someTasksSelected}
                                                                             onChange={() => {
                                                                                 if (allTasksSelected || someTasksSelected) {
                                                                                     handleDeselectAllTasks();
                                                                                 } else {
                                                                                     handleSelectAllTasks();
                                                                                 }
                                                                             }}
                                                                             aria-label={allTasksSelected ? "Deselect all tasks" : (someTasksSelected ? "Deselect all tasks" : "Select all tasks")}
                                                                             className="mr-1" size={18}/></div>
                    <div
                        className="flex-1 overflow-y-auto styled-scrollbar p-2 space-y-1"> {filteredTasks.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center h-full text-gray-400 px-4 text-center pt-10">
                            <Icon name="archive" size={36} className="mb-3 text-gray-300 opacity-80"/> <p
                            className="text-sm font-medium text-gray-500">No tasks match criteria</p> <p
                            className="text-xs mt-1 text-muted">Adjust filters or check task completion status
                            (&gt; 0%).</p></div>) : (filteredTasks.map(task => (
                        <TaskItemMini key={task.id} task={task} isSelected={selectedTaskIds.has(task.id)}
                                      onSelectionChange={handleTaskSelectionChange}/>)))} </div>
                </div>

                {/* Right Pane: Summary */}
                <div
                    className="flex-1 h-1/2 md:h-full flex flex-col bg-glass-100 backdrop-blur-xl rounded-lg shadow-lg border border-black/10 overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden p-3">
                        {totalRelevantSummaries > 0 || isGenerating ? (
                            <>
                                <div className="flex justify-between items-center mb-2 flex-shrink-0 h-6">
                                    <span
                                        className="text-xs text-muted-foreground"> {isGenerating ? 'Generating summary...' : (summaryTimestamp ? `Generated: ${summaryTimestamp}` : 'Unsaved Summary')} </span>
                                    <div className="flex items-center space-x-2">
                                        <Dropdown placement="bottom-end" usePortal={false}
                                                  contentClassName="p-0 w-auto overflow-hidden z-10" trigger={<button
                                            className={twMerge("flex items-center text-xs h-6 px-1.5 rounded transition-colors duration-150 ease-apple focus:outline-none", !currentSummary || isGenerating ? "text-muted-foreground/50 cursor-not-allowed" : "text-blue-600 hover:bg-blue-500/10 focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:bg-blue-500/10")}
                                            disabled={!currentSummary || isGenerating}
                                            data-tooltip-id="summary-ref-tooltip"
                                            data-tooltip-content="View tasks used for this summary"
                                            aria-haspopup="true"><Icon name="file-text" size={12}
                                                                       className="mr-1 opacity-70"/> {tasksUsedCount} tasks
                                            used <Icon name="chevron-down" size={12} className="ml-0.5 opacity-60"/>
                                        </button>}>
                                            {renderReferencedTasksDropdown()}
                                        </Dropdown>
                                        <Tooltip id="summary-ref-tooltip" place="top" className="!z-[60]"/>
                                        {totalRelevantSummaries > 1 && !isGenerating && (<> <Button variant="ghost"
                                                                                                    size="icon"
                                                                                                    icon="chevron-left"
                                                                                                    onClick={handlePrevSummary}
                                                                                                    disabled={currentIndex >= totalRelevantSummaries - 1}
                                                                                                    className="w-6 h-6 text-muted-foreground"
                                                                                                    aria-label="Older summary"/>
                                            <span
                                                className="text-xs font-medium text-muted-foreground tabular-nums"> {displayedIndex} / {totalRelevantSummaries} </span>
                                            <Button variant="ghost" size="icon" icon="chevron-right"
                                                    onClick={handleNextSummary} disabled={currentIndex <= 0}
                                                    className="w-6 h-6 text-muted-foreground"
                                                    aria-label="Newer summary"/> </>)}
                                    </div>
                                </div>
                                <div
                                    className="flex-1 min-h-0 border border-black/10 rounded-md overflow-hidden bg-glass-inset-100 shadow-inner relative">
                                    <CodeMirrorEditor ref={editorRef} value={summaryEditorContent}
                                                      onChange={handleEditorChange}
                                                      placeholder={isGenerating ? "Generating..." : "AI generated summary will appear here..."}
                                                      className="!h-full" readOnly={isGenerating}/>
                                    {hasUnsavedChangesRef.current && (<span
                                        className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70 italic animate-pulse">saving...</span>)}
                                </div>
                            </>
                        ) : (
                            <div
                                className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center">
                                <Icon name="sparkles" size={40} className="mb-3 text-gray-300 opacity-80"/> <p
                                className="text-sm font-medium text-gray-500">Generate Your First Summary</p> <p
                                className="text-xs mt-1 text-muted">Select tasks from the list and click 'Generate'.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Date Range Picker Portal */}
            {isRangePickerOpen && rangePickerTriggerElement && ReactDOM.createPortal(
                <div ref={setRangePopperElement} style={rangePopperStyles.popper} {...rangePopperAttributes.popper}
                     className="z-[60]">
                    <CustomDateRangePickerPopover
                        initialStartDate={typeof period === 'object' ? new Date(period.start) : undefined}
                        initialEndDate={typeof period === 'object' ? new Date(period.end) : undefined}
                        onApplyRange={handleRangeApply}
                        close={handleCloseRangePicker}
                        triggerElement={rangePickerTriggerElement} // Pass trigger for click-away
                    />
                </div>,
                document.body
            )}

            {/* Summary History Modal */}
            <SummaryHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={closeHistoryModal}
                summaries={allStoredSummaries}
                allTasks={allTasks} // Pass all tasks for detail lookup
            />
        </div>
    );
};
SummaryView.displayName = 'SummaryView';

// --- Child Component: TaskItemMini ---
const TaskItemMini: React.FC<{
    task: Task;
    isSelected: boolean;
    onSelectionChange: (id: string, selected: boolean) => void;
}> = React.memo(({task, isSelected, onSelectionChange}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelectionChange(task.id, e.target.checked);
    };
    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
    const uniqueId = `summary-task-${task.id}`;
    return (<label htmlFor={uniqueId}
                   className={twMerge("flex items-center p-1.5 rounded-md cursor-pointer transition-colors duration-150 ease-apple", isSelected ? "bg-primary/15" : "hover:bg-black/10", task.list === 'Trash' ? "opacity-60" : "")}>
        <SelectionCheckbox id={uniqueId} checked={isSelected} onChange={handleChange}
                           aria-label={`Select task: ${task.title || 'Untitled'}`} className="mr-2.5 flex-shrink-0"
                           size={16}/>
        <div className="flex-1 overflow-hidden"><span
            className={twMerge("text-sm text-gray-800 block truncate", task.completed && "line-through text-muted-foreground")}> {task.title ||
            <span className="italic">Untitled Task</span>} </span>
            <div
                className="text-xs text-muted-foreground flex items-center space-x-2 mt-0.5 flex-wrap gap-y-0.5"> {task.completionPercentage && task.completionPercentage < 100 && (
                <span
                    className="text-primary/90 font-medium">[{task.completionPercentage}%]</span>)} {parsedDueDate && isValid(parsedDueDate) && (
                <span
                    className={twMerge("flex items-center whitespace-nowrap", overdue && !task.completed && "text-red-600 font-medium", task.completed && "line-through")}> <Icon
                    name="calendar" size={11}
                    className="mr-0.5 opacity-70"/> {formatRelativeDate(parsedDueDate)} </span>)} {task.list && task.list !== 'Inbox' && (
                <span className="flex items-center bg-black/10 px-1 rounded text-[10px] max-w-[70px] truncate"
                      title={task.list}> <Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={10}
                                               className="mr-0.5 opacity-70"/> <span
                    className="truncate">{task.list}</span> </span>)} {task.tags && task.tags.length > 0 && (
                <span className="flex items-center space-x-1"> {task.tags.slice(0, 1).map(tag => (<span key={tag}
                                                                                                        className="bg-black/10 px-1 rounded text-[10px] max-w-[60px] truncate">#{tag}</span>))} {task.tags.length > 1 &&
                    <span
                        className="text-[10px] text-muted-foreground/80">+{task.tags.length - 1}</span>} </span>)} </div>
        </div>
    </label>);
});
TaskItemMini.displayName = 'TaskItemMini';


export default SummaryView;