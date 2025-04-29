// src/components/summary/SummaryView.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
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
    summaryPeriodFilterAtom, SummaryPeriodKey,
    SummaryPeriodOption,
    summarySelectedTaskIdsAtom,
    tasksAtom,
    userListNamesAtom
} from '@/store/atoms';
import { Button } from '@/components/ui/button'; // Use Button from ui
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'; // Use DropdownMenu
import Icon from '../common/Icon';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { Task } from '@/types';
import { format, formatDateTime, formatRelativeDate, isBefore, isSameDay, isValid, safeParseDate, startOfDay } from '@/lib/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; // Use Checkbox
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Use Tooltip
import useDebounce from '@/hooks/useDebounce';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'; // Use Popover\
import SummaryHistoryModal from './SummaryHistoryModal';
import { ScrollArea } from '@/components/ui/scroll-area'; // Use ScrollArea
import { Badge } from '@/components/ui/badge';
import CustomDateRangePickerPopover from "@/components/common/CustomDateRangePickerPopover.tsx"; // Use Badge

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
    const [rangePickerTriggerElement, setRangePickerTriggerElement] = useState<HTMLDivElement | HTMLButtonElement | null>(null);
    const [rangePopperElement] = useState<HTMLDivElement | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Popper for Date Range Picker
    const {update: updateRangePopper} = usePopper(
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
    const handlePeriodChange = useCallback((value: string) => { // Value is string from DropdownMenuRadioItem
        if (value === 'custom') {
            // This case needs reconsideration. Maybe keep custom trigger separate?
            // Or use a Popover directly instead of DropdownMenu for period.
            // For now, let's assume a Popover approach is better for custom range.
            console.warn("Custom range trigger needs adjustment with DropdownMenu");
        } else {
            setPeriod(value as SummaryPeriodOption); // Cast might be needed
        }
        // Dropdown closes automatically
    }, [setPeriod]);

    const handleOpenCustomRangePicker = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        // The event target for DropdownMenuItem's onClick is an HTMLDivElement
        setRangePickerTriggerElement(event.currentTarget);
        setIsRangePickerOpen(true);
        // Note: The DropdownMenu might close automatically depending on Radix behavior.
        // If it doesn't, you might need to manually close it here or adjust DropdownMenuItem props.
    }, []);


    const handleListChange = useCallback((value: string) => { // Value is string from DropdownMenuRadioItem
        setListFilter(value);
        // Dropdown closes automatically
    }, [setListFilter]);

    const handleTaskSelectionChange = useCallback((taskId: string, checked: boolean | 'indeterminate') => {
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            // Treat indeterminate as unchecked for this logic
            if (checked === true) newSet.add(taskId);
            else newSet.delete(taskId);
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
    const periodOptions = useMemo((): { label: string, value: SummaryPeriodKey }[] => [
        { label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' },
        { label: 'This Week', value: 'thisWeek' }, { label: 'Last Week', value: 'lastWeek' },
        { label: 'This Month', value: 'thisMonth' }, { label: 'Last Month', value: 'lastMonth' },
    ], []);

    // Label for the Custom Range button / selected state
    const selectedPeriodLabel = useMemo(() => {
        const option = periodOptions.find(p => p.value === period);
        if (option) return option.label;
        if (typeof period === 'object') {
            const startStr = format(period.start, 'MMM d');
            const endStr = format(period.end, 'MMM d');
            const startYear = format(period.start, 'yyyy');
            const currentYear = format(new Date(), 'yyyy');
            if (isSameDay(period.start, period.end)) return startYear !== currentYear ? format(period.start, 'MMM d, yyyy') : startStr;
            const endYear = format(period.end, 'yyyy');
            if (startYear !== endYear) return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`;
            else if (startYear !== currentYear) return `${startStr} - ${endStr}, ${startYear}`;
            else return `${startStr} - ${endStr}`;
        }
        return 'Select Period'; // Fallback
    }, [period, periodOptions]);
    const listOptions = useMemo(() => [{
        label: 'All Lists',
        value: 'all'
    }, ...availableLists.map(listName => ({label: listName, value: listName}))], [availableLists]);
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
    const displayedIndex = useMemo(() => totalRelevantSummaries > 0 ? totalRelevantSummaries - currentIndex : 0, [totalRelevantSummaries, currentIndex]);

    // --- Render Functions ---
    const renderReferencedTasksDropdown = () => (
        <div className="w-80 max-h-72 styled-scrollbar overflow-y-auto"> {/* Added max-h and scrollbar */}
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border sticky top-0 bg-popover/95 backdrop-blur-sm z-10">
                Referenced Tasks ({referencedTasks.length})
            </div>
            {referencedTasks.length > 0 ? (
                <ul className="p-1.5 space-y-0.5">
                    {referencedTasks.map(task => (
                        <li key={task.id}
                            className="flex items-start p-1.5 rounded hover:bg-accent transition-colors"
                            title={task.title}>
                            {/* Use Checkbox for visual consistency */}
                            <Checkbox
                                id={`ref-task-${task.id}`} // Unique ID needed for label linking? Or just visual
                                checked={task.completed ? true : (task.completionPercentage && task.completionPercentage > 0 ? 'indeterminate' : false)}
                                disabled // Non-interactive in this context
                                className="w-4 h-4 rounded-full mt-0.5 mr-2.5 flex-shrink-0"
                                aria-hidden="true" // Decorative in this view
                            />
                            <div className="flex-1 overflow-hidden">
                                <p className={cn(
                                    "text-xs font-medium text-foreground leading-snug truncate",
                                    task.completed && "line-through text-muted-foreground"
                                )}>
                                    {task.title || "Untitled"}
                                </p>
                                <div className="flex items-center space-x-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap gap-y-0.5">
                                    {task.completionPercentage && !task.completed && (
                                        <span className="font-medium text-primary/90">[{task.completionPercentage}%]</span>
                                    )}
                                    {task.dueDate && isValid(safeParseDate(task.dueDate)) && (
                                        <span className="flex items-center whitespace-nowrap">
                                            <Icon name="calendar" size={10} className="mr-0.5 opacity-60"/>
                                            {formatRelativeDate(task.dueDate)}
                                        </span>
                                    )}
                                    {task.list && task.list !== 'Inbox' && (
                                        <Badge variant="secondary" className="font-normal px-1 py-0 text-[9px]">
                                            <Icon name="list" size={9} className="mr-0.5 opacity-60 flex-shrink-0"/>
                                            <span className="truncate max-w-[70px]">{task.list}</span>
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground italic p-4 text-center">No referenced tasks found.</p>
            )}
        </div>
    );


    return (
        <div className="h-full flex flex-col bg-canvas overflow-hidden">
            {/* Page Header */}
            <div
                className="px-3 md:px-4 py-2 border-b border-border/50 flex justify-between items-center flex-shrink-0 bg-glass-alt-100 backdrop-blur-lg z-10 h-12 shadow-sm">
                {/* Left Side: Title & History Button */}
                <div className="flex items-center space-x-2">
                    <h1 className="text-lg font-semibold text-foreground truncate flex items-center">
                        <Icon name="sparkles" className="mr-2 text-primary opacity-80" size={18}/>
                        AI Summary
                    </h1>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" icon="history" onClick={openHistoryModal}
                                    className="w-7 h-7 text-muted-foreground hover:bg-accent"
                                    aria-label="View Summary History"/>
                        </TooltipTrigger>
                        <TooltipContent>View All Generated Summaries</TooltipContent>
                    </Tooltip>
                </div>

                {/* Center: Filters */}
                <div className="flex-1 flex justify-center items-center space-x-1">
                    {/* Period Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {/* This button's ref is captured ONLY when the "Custom Range..." item is clicked */}
                            <Button variant="outline" size="sm" className="min-w-[130px] justify-between">
                                <span className="flex items-center"><Icon name="calendar-days" size={14} className="mr-1.5 opacity-70"/>{selectedPeriodLabel}</span>
                                <Icon name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuRadioGroup value={typeof period === 'string' ? period : 'custom-selected'} onValueChange={handlePeriodChange}>
                                {periodOptions.map(p => (<DropdownMenuRadioItem key={p.value} value={p.value}>{p.label}</DropdownMenuRadioItem>))}
                                {typeof period === 'object' && (<DropdownMenuRadioItem key="custom-selected" value="custom-selected">{selectedPeriodLabel}</DropdownMenuRadioItem>)}
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            {/* *** CORRECTED: Use onClick here *** */}
                            <DropdownMenuItem onClick={handleOpenCustomRangePicker} onSelect={(e) => e.preventDefault()} >
                                <Icon name="settings" size={14} className="mr-1.5 opacity-70"/> Set Custom Range...
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Popover for Custom Date Range Picker */}
                    <Popover open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
                        <PopoverTrigger asChild>
                            {/* The trigger is now conceptually linked to the DropdownMenuItem click */}
                            {/* We need an anchor element for Popper, even if invisible */}
                            <div ref={setRangePickerTriggerElement as React.Ref<HTMLDivElement>} style={{ position: 'absolute' }} />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <CustomDateRangePickerPopover
                                initialStartDate={typeof period === 'object' ? new Date(period.start) : undefined}
                                initialEndDate={typeof period === 'object' ? new Date(period.end) : undefined}
                                onApplyRange={handleRangeApply}
                                close={handleCloseRangePicker}
                                triggerElement={rangePickerTriggerElement}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* List Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="min-w-[120px] justify-between">
                                  <span className="flex items-center">
                                     <Icon name="list" size={14} className="mr-1.5 opacity-70"/>
                                      {selectedListLabel}
                                 </span>
                                <Icon name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto styled-scrollbar-thin">
                            <DropdownMenuRadioGroup value={listFilter} onValueChange={handleListChange}>
                                {listOptions.map(l => (
                                    <DropdownMenuRadioItem key={l.value} value={l.value}>
                                        {l.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Right Side: Generate Button */}
                <div className="flex justify-end">
                    <Button
                        variant="default" size="sm"
                        icon={isGenerating ? undefined : "sparkles"}
                        loading={isGenerating} onClick={handleGenerateClick}
                        disabled={isGenerateDisabled}
                        className="px-3"
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 md:p-3 gap-2 md:gap-3 min-h-0">
                {/* Left Pane: Task List */}
                <div className="w-full md:w-[340px] h-1/2 md:h-full flex flex-col bg-glass-alt-100 backdrop-blur-xl rounded-lg shadow-md border border-border/30 overflow-hidden flex-shrink-0">
                    <div className="px-3 py-2 border-b border-border/50 flex justify-between items-center flex-shrink-0 h-11">
                        <h2 className="text-base font-medium text-foreground truncate">Tasks ({filteredTasks.length})</h2>
                        <Checkbox
                            id="select-all-summary-tasks"
                            checked={allTasksSelected ? true : (someTasksSelected ? 'indeterminate' : false)}
                            onCheckedChange={(checked) => {
                                if (checked === true) handleSelectAllTasks();
                                else handleDeselectAllTasks(); // Handles false and indeterminate
                            }}
                            aria-label={allTasksSelected ? "Deselect all tasks" : (someTasksSelected ? "Deselect some tasks" : "Select all tasks")}
                            className="mr-1 data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary/70"
                        />
                    </div>
                    <ScrollArea className="flex-1" type="auto">
                        <div className="p-2 space-y-1">
                            {filteredTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[calc(80vh-8rem)] text-muted-foreground px-4 text-center pt-10">
                                    <Icon name="archive" size={36} className="mb-3 opacity-40"/>
                                    <p className="text-sm font-medium text-foreground/80">No tasks match criteria</p>
                                    <p className="text-xs mt-1">Ensure tasks have &gt; 0% progress and fit the date/list filters.</p>
                                </div>
                            ) : (
                                filteredTasks.map(task => (
                                    <TaskItemMini key={task.id} task={task} isSelected={selectedTaskIds.has(task.id)} onSelectionChange={handleTaskSelectionChange}/>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Pane: Summary */}
                <div className="flex-1 h-1/2 md:h-full flex flex-col bg-card rounded-lg shadow-md border border-border/30 overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4">
                        {totalRelevantSummaries > 0 || isGenerating ? (
                            <>
                                <div className="flex justify-between items-center mb-2 flex-shrink-0 h-7">
                                    <span className="text-xs text-muted-foreground">
                                        {isGenerating ? 'Generating summary...' : (summaryTimestamp ? `Generated: ${summaryTimestamp}` : 'Unsaved Summary')}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        {/* Referenced Tasks Dropdown */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={cn(
                                                        "flex items-center text-xs h-6 px-1.5 rounded",
                                                        !currentSummary || isGenerating ? "text-muted-foreground/50 cursor-not-allowed" : "text-blue-600 hover:bg-blue-500/10 focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:bg-blue-500/10"
                                                    )}
                                                    disabled={!currentSummary || isGenerating}
                                                    aria-haspopup="true"
                                                >
                                                    <Icon name="file-text" size={12} className="mr-1 opacity-70"/>
                                                    {tasksUsedCount} tasks used
                                                    <Icon name="chevron-down" size={12} className="ml-0.5 opacity-60"/>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="p-0">
                                                {/* Content rendered by function */}
                                                {renderReferencedTasksDropdown()}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* History Navigation */}
                                        {totalRelevantSummaries > 1 && !isGenerating && (
                                            <div className="flex items-center border border-border rounded-md ml-2">
                                                <Button variant="ghost" size="icon" icon="chevron-left" onClick={handlePrevSummary} disabled={currentIndex >= totalRelevantSummaries - 1} className="w-6 h-6 text-muted-foreground rounded-r-none border-r border-border" aria-label="Older summary"/>
                                                <span className="text-xs font-medium text-muted-foreground tabular-nums px-1.5">
                                                    {displayedIndex}/{totalRelevantSummaries}
                                                </span>
                                                <Button variant="ghost" size="icon" icon="chevron-right" onClick={handleNextSummary} disabled={currentIndex <= 0} className="w-6 h-6 text-muted-foreground rounded-l-none border-l border-border" aria-label="Newer summary"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0 bg-background rounded-md overflow-hidden relative border border-border/50 shadow-inner">
                                    <CodeMirrorEditor
                                        ref={editorRef} value={summaryEditorContent}
                                        onChange={handleEditorChange}
                                        placeholder={isGenerating ? "Generating..." : "AI generated summary will appear here..."}
                                        className="!h-full !rounded-md"
                                        readOnly={isGenerating}
                                        onBlur={forceSaveCurrentSummary} // Save on blur
                                    />
                                    {hasUnsavedChangesRef.current && (
                                        <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70 italic animate-pulse">saving...</span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6 text-center">
                                <Icon name="sparkles" size={40} className="mb-3 opacity-50"/>
                                <p className="text-sm font-medium text-foreground/80">Generate Your First Summary</p>
                                <p className="text-xs mt-1">Select tasks from the list and click 'Generate'.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary History Modal */}
            <SummaryHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={closeHistoryModal}
                summaries={allStoredSummaries}
                allTasks={allTasks}
            />
        </div>
    );
};
SummaryView.displayName = 'SummaryView';

// --- Child Component: TaskItemMini (Refactored) ---
const TaskItemMini: React.FC<{
    task: Task;
    isSelected: boolean;
    onSelectionChange: (id: string, selected: boolean | 'indeterminate') => void;
}> = React.memo(({ task, isSelected, onSelectionChange }) => {
    const handleChange = (checked: boolean | 'indeterminate') => {
        onSelectionChange(task.id, checked);
    };
    const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
    const uniqueId = `summary-task-${task.id}`;

    // Determine checkbox state based on selection
    const checkboxState = isSelected; // True or false for mini item selection

    return (
        <div
            className={cn(
                "flex items-center p-1.5 rounded-md transition-colors duration-150 ease-apple",
                isSelected ? "bg-primary/15" : "hover:bg-accent",
                task.list === 'Trash' ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            )}
            onClick={() => { if (task.list !== 'Trash') handleChange(!isSelected) }} // Toggle on row click if not trash
        >
            <Checkbox
                id={uniqueId}
                checked={checkboxState}
                onCheckedChange={handleChange}
                aria-label={`Select task: ${task.title || 'Untitled'}`}
                className="mr-2.5 flex-shrink-0 w-4 h-4 data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary/70"
                disabled={task.list === 'Trash'}
                onClick={(e) => e.stopPropagation()} // Prevent label click handler
            />
            <div className="flex-1 overflow-hidden">
                <span className={cn(
                    "text-sm text-foreground block truncate",
                    task.completed && "line-through text-muted-foreground"
                )}>
                    {task.title || <span className="italic">Untitled Task</span>}
                </span>
                <div className="text-xs text-muted-foreground flex items-center space-x-1.5 mt-0.5 flex-wrap gap-y-0.5">
                    {task.completionPercentage && task.completionPercentage < 100 && !task.completed && (
                        <span className="text-primary/90 font-medium text-[11px]">[{task.completionPercentage}%]</span>
                    )}
                    {parsedDueDate && isValid(parsedDueDate) && (
                        <span className={cn(
                            "flex items-center whitespace-nowrap text-[11px]",
                            overdue && !task.completed && "text-destructive font-medium",
                            task.completed && "line-through"
                        )}>
                            <Icon name="calendar" size={11} className="mr-0.5 opacity-70"/> {formatRelativeDate(parsedDueDate)}
                        </span>
                    )}
                    {task.list && task.list !== 'Inbox' && (
                        <Badge variant="secondary" className="font-normal px-1 py-0 text-[10px]">
                            <Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={10} className="mr-0.5 opacity-70"/>
                            <span className="truncate max-w-[70px]">{task.list}</span>
                        </Badge>
                    )}
                    {task.tags && task.tags.length > 0 && (
                        <span className="flex items-center space-x-1">
                             {task.tags.slice(0, 1).map(tag => (
                                 <Badge key={tag} variant="outline" className="font-normal px-1 py-0 text-[10px]">#{tag}</Badge>
                             ))}
                            {task.tags.length > 1 &&
                                <span className="text-[10px] text-muted-foreground/80">+{task.tags.length - 1}</span>
                            }
                         </span>
                    )}
                </div>
            </div>
        </div>
    );
});
TaskItemMini.displayName = 'TaskItemMini';


export default SummaryView;