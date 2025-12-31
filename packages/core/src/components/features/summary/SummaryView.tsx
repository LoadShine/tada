import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    addNotificationAtom,
    aiSettingsAtom,
    currentDisplayedSummaryAtom,
    currentSummaryFilterKeyAtom,
    currentSummaryIndexAtom,
    filteredTasksForSummaryAtom,
    futureTasksForSummaryAtom,
    isGeneratingSummaryAtom,
    preferencesSettingsAtom,
    referencedTasksForSummaryAtom,
    relevantStoredSummariesAtom,
    storedSummariesAtom,
    summaryListFilterAtom,
    summaryPeriodFilterAtom,
    SummaryPeriodOption,
    summarySelectedFutureTaskIdsAtom,
    summarySelectedTaskIdsAtom,
    tasksAtom,
    userListNamesAtom,
    isSettingsOpenAtom,
    settingsSelectedTabAtom
} from '@/store/jotai.ts';
import Button from '@/components/ui/Button.tsx';
import Icon from '@/components/ui/Icon.tsx';
import {StoredSummary, Task} from '@/types';
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
import useDebounce from '@/hooks/useDebounce';
import SummaryHistoryModal from './SummaryHistoryModal';
import {AnimatePresence, motion} from 'framer-motion';
import {generateAiSummary, isAIConfigValid} from '@/services/aiService';
import {useTranslation} from "react-i18next";
import storageManager from '@/services/storageManager.ts';
import CodeMirrorEditor, {CodeMirrorEditorRef} from "@/components/ui/Editor.tsx";
import SelectionCheckboxRadix from "@/components/ui/SelectionCheckbox.tsx";
import {CustomDateRangePickerContent} from "@/components/ui/DateRangePicker.tsx";
import {AI_PROVIDERS} from "@/config/aiProviders.ts";

/**
 * Returns the appropriate CSS classes for a Radix DropdownMenu radio item.
 * @param checked Whether the item is currently checked.
 * @returns A string of Tailwind CSS classes.
 */
const getSummaryMenuRadioItemStyle = (checked?: boolean) => twMerge(
    "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7",
    "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
    "dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700",
    checked
        ? "bg-grey-ultra-light text-primary dark:bg-primary-dark/20 dark:text-primary-light"
        : "text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-200 dark:data-[highlighted]:text-neutral-100",
    "data-[disabled]:opacity-50"
);

/**
 * The main view for the AI Summary feature. Allows users to select tasks,
 * generate summaries, view past summaries, and edit generated content.
 */
const SummaryView: React.FC = () => {
    const {t} = useTranslation();
    const [period, setPeriod] = useAtom(summaryPeriodFilterAtom);
    const [listFilter, setListFilter] = useAtom(summaryListFilterAtom);
    const availableLists = useAtomValue(userListNamesAtom);
    const filteredTasks = useAtomValue(filteredTasksForSummaryAtom);
    const futureTasks = useAtomValue(futureTasksForSummaryAtom);
    const [selectedTaskIds, setSelectedTaskIds] = useAtom(summarySelectedTaskIdsAtom);
    const [selectedFutureTaskIds, setSelectedFutureTaskIds] = useAtom(summarySelectedFutureTaskIdsAtom);
    const relevantSummaries = useAtomValue(relevantStoredSummariesAtom);
    const allStoredSummariesData = useAtomValue(storedSummariesAtom);
    const allStoredSummaries = useMemo(() => allStoredSummariesData ?? [], [allStoredSummariesData]);
    const addNotification = useSetAtom(addNotificationAtom);

    const [currentIndex, setCurrentIndex] = useAtom(currentSummaryIndexAtom);
    const currentSummary = useAtomValue(currentDisplayedSummaryAtom);
    const setStoredSummaries = useSetAtom(storedSummariesAtom);
    const filterKey = useAtomValue(currentSummaryFilterKeyAtom);
    const [isGenerating, setIsGenerating] = useAtom(isGeneratingSummaryAtom);
    const referencedTasks = useAtomValue(referencedTasksForSummaryAtom);
    const allTasksData = useAtomValue(tasksAtom);
    const allTasks = useMemo(() => allTasksData ?? [], [allTasksData]);
    const preferences = useAtomValue(preferencesSettingsAtom);
    const aiSettings = useAtomValue(aiSettingsAtom);
    const setIsSettingsOpen = useSetAtom(isSettingsOpenAtom);
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);

    const isAiEnabled = useMemo(() => isAIConfigValid(aiSettings), [aiSettings]);

    const [summaryDisplayContent, setSummaryDisplayContent] = useState('');
    const [summaryEditorContent, setSummaryEditorContent] = useState('');

    const [originalContentOnEdit, setOriginalContentOnEdit] = useState<string>('');

    const debouncedEditorContent = useDebounce(summaryEditorContent, 700);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isInternalEditorUpdate = useRef(false);

    const [editMode, setEditMode] = useState(false);

    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [isRefTasksDropdownOpen, setIsRefTasksDropdownOpen] = useState(false);

    useEffect(() => {
        setSelectedTaskIds(new Set());
        setSelectedFutureTaskIds(new Set());
        setCurrentIndex(0);
        setEditMode(false);
    }, [period, listFilter, setCurrentIndex, setSelectedTaskIds, setSelectedFutureTaskIds]);

    useEffect(() => {
        if (editMode) return;
        if (isGenerating) return;

        const text = currentSummary?.summaryText ?? '';
        setSummaryDisplayContent(text);

        isInternalEditorUpdate.current = true;
        setSummaryEditorContent(text);

        setEditMode(false);
        hasUnsavedChangesRef.current = false;
        setIsRefTasksDropdownOpen(false);
    }, [currentIndex, currentSummary, isGenerating, editMode]);

    const forceSaveCurrentSummary = useCallback(() => {
        if (hasUnsavedChangesRef.current && currentSummary?.id && !isGenerating) {
            const id = currentSummary.id;
            setStoredSummaries(p => (p ?? []).map(s => s.id === id ? {
                ...s,
                summaryText: summaryEditorContent,
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false;
        }
    }, [currentSummary, setStoredSummaries, summaryEditorContent, isGenerating]);

    const handleGenerateClick = useCallback(async () => {
        if (isGenerating) return;

        // Check for AI configuration
        if (!isAiEnabled) {
            setSettingsTab('ai');
            setIsSettingsOpen(true);
            return;
        }

        const service = storageManager.get();

        forceSaveCurrentSummary();
        setEditMode(false);
        setIsGenerating(true);
        setSummaryDisplayContent('');
        setSummaryEditorContent('');
        setCurrentIndex(-1);

        const tasksToSummarize = allTasks.filter(t => selectedTaskIds.has(t.id));
        const futureTasksToConsider = allTasks.filter(t => selectedFutureTaskIds.has(t.id));

        if (tasksToSummarize.length === 0 && futureTasksToConsider.length === 0) {
            setIsGenerating(false);
            return;
        }

        const taskIdsToSummarize = tasksToSummarize.map(t => t.id);
        const futureTaskIdsToConsider = futureTasksToConsider.map(t => t.id);
        const [periodKey, listKey] = filterKey.split('__');

        const systemPrompt = t('prompts.taskSummary');

        try {
            const onDelta = (chunk: string) => {
                setSummaryDisplayContent(prev => prev + chunk);
            };

            const finalSummary = await generateAiSummary(
                taskIdsToSummarize, futureTaskIdsToConsider,
                periodKey, listKey,
                aiSettings!, systemPrompt,
                onDelta
            );

            setStoredSummaries(prev => [finalSummary, ...(prev ?? []).filter(s => s.id !== finalSummary.id)]);
            setTimeout(() => setCurrentIndex(0), 100);

        } catch (error) {
            console.error("Error generating summary:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during summary generation.';
            addNotification({type: 'error', message: `Summary Failed: ${errorMessage}`});
            setSummaryDisplayContent(`## Summary Generation Failed\n\n**Error:**\n\`\`\`\n${errorMessage}\n\`\`\``);
        } finally {
            setIsGenerating(false);
        }
    }, [
        isGenerating, forceSaveCurrentSummary, allTasks, selectedTaskIds, selectedFutureTaskIds,
        filterKey, setStoredSummaries, setCurrentIndex, setIsGenerating, aiSettings, addNotification,
        t, setIsSettingsOpen, setSettingsTab, isAiEnabled
    ]);

    const handleEditorChange = useCallback((newValue: string) => {
        if (isInternalEditorUpdate.current) {
            isInternalEditorUpdate.current = false;
            return;
        }
        setSummaryEditorContent(newValue);
        if (!isGenerating) {
            hasUnsavedChangesRef.current = true;
        }
    }, [isGenerating]);

    const handleStartEditing = useCallback(() => {
        setOriginalContentOnEdit(summaryEditorContent);
        setEditMode(true);
    }, [summaryEditorContent]);

    const handleDoneEditing = useCallback(() => {
        forceSaveCurrentSummary();
        setEditMode(false);
    }, [forceSaveCurrentSummary]);

    const handleCancelEditing = useCallback(() => {
        isInternalEditorUpdate.current = true;
        setSummaryEditorContent(originalContentOnEdit);
        setSummaryDisplayContent(originalContentOnEdit);
        setEditMode(false);
        hasUnsavedChangesRef.current = false;
    }, [originalContentOnEdit]);


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

    const handleFutureTaskSelectionChange = useCallback((taskId: string, isSelected: boolean | 'indeterminate') => {
        if (typeof isSelected === 'boolean') {
            setSelectedFutureTaskIds(prev => {
                const newSet = new Set(prev);
                if (isSelected) newSet.add(taskId); else newSet.delete(taskId);
                return newSet;
            });
        }
    }, [setSelectedFutureTaskIds]);

    const handleSelectAllTasks = useCallback((type: 'current' | 'future') => {
        const tasksToSelect = type === 'current' ? filteredTasks : futureTasks;
        const setter = type === 'current' ? setSelectedTaskIds : setSelectedFutureTaskIds;
        const nonTrashedTaskIds = tasksToSelect.filter(t => t.listName !== 'Trash').map(t => t.id);
        setter(new Set(nonTrashedTaskIds));
    }, [filteredTasks, futureTasks, setSelectedTaskIds, setSelectedFutureTaskIds]);

    const handleDeselectAllTasks = useCallback((type: 'current' | 'future') => {
        const setter = type === 'current' ? setSelectedTaskIds : setSelectedFutureTaskIds;
        setter(new Set());
    }, [setSelectedTaskIds, setSelectedFutureTaskIds]);

    const handleSelectAllToggle = useCallback((type: 'current' | 'future') => (isChecked: boolean | 'indeterminate') => {
        if (isChecked === true) handleSelectAllTasks(type); else handleDeselectAllTasks(type);
    }, [handleSelectAllTasks, handleDeselectAllTasks]);

    const handlePrevSummary = useCallback(() => {
        if (isGenerating) return;
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.min(prev + 1, (relevantSummaries?.length ?? 1) - 1));
    }, [setCurrentIndex, relevantSummaries, forceSaveCurrentSummary, isGenerating]);

    const handleNextSummary = useCallback(() => {
        if (isGenerating) return;
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }, [setCurrentIndex, forceSaveCurrentSummary, isGenerating]);

    const handleRangeApply = useCallback((startDate: Date, endDate: Date) => {
        forceSaveCurrentSummary();
        setPeriod({start: startDate.getTime(), end: endDate.getTime()});
        setIsRangePickerOpen(false);
    }, [setPeriod, setIsRangePickerOpen, forceSaveCurrentSummary]);

    const openHistoryModal = useCallback(() => {
        if (isGenerating) return;
        forceSaveCurrentSummary();
        setIsHistoryModalOpen(true);
    }, [forceSaveCurrentSummary, isGenerating]);

    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);
    const closeRangePicker = useCallback(() => setIsRangePickerOpen(false), []);

    const periodOptions = useMemo((): { label: string, value: SummaryPeriodOption | 'custom' }[] => [
        {label: t('summary.periods.today'), value: 'today'},
        {label: t('summary.periods.yesterday'), value: 'yesterday'},
        {label: t('summary.periods.thisWeek'), value: 'thisWeek'},
        {label: t('summary.periods.lastWeek'), value: 'lastWeek'},
        {label: t('summary.periods.thisMonth'), value: 'thisMonth'},
        {label: t('summary.periods.lastMonth'), value: 'lastMonth'},
        {label: t('summary.periods.custom'), value: 'custom'},
    ], [t]);

    const listOptions = useMemo(() => [{
        label: t('summary.lists.all'), value: 'all'
    }, ...availableLists.filter(name => name !== 'Trash').map(listName => ({
        label: listName === 'Inbox' ? t('sidebar.inbox') : listName, value: listName
    }))], [availableLists, t]);

    const selectedPeriodLabel = useMemo(() => {
        const option = periodOptions.find(p => typeof period === 'string' && p.value === period);
        if (option) return option.label;
        if (typeof period === 'object' && period.start && period.end) {
            const startStr = format(period.start, 'MMM d');
            const endStr = format(period.end, 'MMM d');
            const startYear = format(period.start, 'yyyy');
            const endYear = format(period.end, 'yyyy');
            const currentYear = format(new Date(), 'yyyy');
            if (isSameDay(period.start, period.end)) return startYear !== currentYear ? format(period.start, 'MMM d, yyyy') : startStr;
            if (startYear !== endYear) return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`; else if (startYear !== currentYear) return `${startStr} - ${endStr}, ${startYear}`; else return `${startStr} - ${endStr}`;
        }
        return t('summary.periods.select');
    }, [period, periodOptions, t]);

    const selectedListLabel = useMemo(() => {
        const option = listOptions.find(l => l.value === listFilter);
        return option ? option.label : t('summary.lists.select');
    }, [listFilter, listOptions, t]);

    const isGenerateDisabled = useMemo(() => {
        if (isGenerating) return true;
        if (isAiEnabled) {
            if (selectedTaskIds.size === 0 && selectedFutureTaskIds.size === 0) return true;
            const tasksForSummary = allTasks.filter(t => selectedTaskIds.has(t.id));
            return !tasksForSummary.some(t => t.listName !== 'Trash') && selectedFutureTaskIds.size === 0;
        }
        return false;
    }, [isGenerating, selectedTaskIds, selectedFutureTaskIds, allTasks, isAiEnabled]);


    const tasksUsedCount = useMemo(() => currentSummary?.taskIds.length ?? 0, [currentSummary]);
    const summaryTimestamp = useMemo(() => currentSummary ? formatDateTime(currentSummary.createdAt, preferences?.language) : null, [currentSummary, preferences]);

    const createSelectAllState = (tasks: Task[], selectedIds: Set<string>) => {
        const allSelected = tasks.length > 0 && tasks.every(task => selectedIds.has(task.id));
        const someSelected = tasks.some(task => selectedIds.has(task.id)) && !allSelected;
        if (allSelected) return true;
        if (someSelected) return 'indeterminate';
        return false;
    };

    const selectableTasks = useMemo(() => filteredTasks.filter(t => t.listName !== 'Trash'), [filteredTasks]);
    const selectAllState = useMemo(() => createSelectAllState(selectableTasks, selectedTaskIds), [selectableTasks, selectedTaskIds]);

    const selectableFutureTasks = useMemo(() => futureTasks.filter(t => t.listName !== 'Trash'), [futureTasks]);
    const selectAllFutureState = useMemo(() => createSelectAllState(selectableFutureTasks, selectedFutureTaskIds), [selectableFutureTasks, selectedFutureTaskIds]);

    const totalRelevantSummaries = useMemo(() => relevantSummaries?.length ?? 0, [relevantSummaries]);
    const displayedIndexForUi = useMemo(() => {
        if (isGenerating || currentIndex === -1) return 1;
        return totalRelevantSummaries > 0 ? (currentIndex + 1) : 0;
    }, [totalRelevantSummaries, currentIndex, isGenerating]);
    const totalForUi = useMemo(() => {
        if (isGenerating || currentIndex === -1) return Math.max(1, totalRelevantSummaries);
        return totalRelevantSummaries;
    }, [totalRelevantSummaries, currentIndex, isGenerating]);

    const dropdownAnimationClasses = "data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide";
    const popoverAnimationClasses = "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide";
    const dropdownContentBaseClasses = useMemo(() => twMerge(
        "min-w-[200px] z-[60] bg-white rounded-base shadow-modal p-1 dark:bg-neutral-800 dark:border dark:border-neutral-700",
        dropdownAnimationClasses
    ), [dropdownAnimationClasses]);
    const tooltipContentClass = "text-[11px] bg-grey-dark dark:bg-neutral-900/95 text-white dark:text-neutral-100 px-2 py-1 rounded-base shadow-md select-none z-[70] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const renderReferencedTasksDropdown = () => (
        <div
            className="bg-white dark:bg-neutral-800 rounded-base shadow-modal max-h-72 w-80 styled-scrollbar-thin overflow-y-auto p-1.5">
            <div
                className="px-1.5 py-1 text-[11px] font-normal text-grey-medium dark:text-neutral-400 border-b border-grey-light dark:border-neutral-700 sticky top-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm z-10">{t('summary.referencedTasks')} ({referencedTasks.length})
            </div>
            {referencedTasks.length > 0 ? (<ul className="pt-1 space-y-0.5">{referencedTasks.map(task => (
                <li key={task.id}
                    className="flex items-start p-1.5 rounded-base hover:bg-grey-ultra-light dark:hover:bg-neutral-700 transition-colors"
                    title={task.title}>
                    <div
                        className={twMerge("flex-shrink-0 w-3.5 h-3.5 rounded-full border mt-[1px] mr-2 flex items-center justify-center", task.completed ? "bg-primary border-primary" : task.completePercentage != null && task.completePercentage > 0 ? "border-primary/70 dark:border-primary-light/70" : "bg-white dark:bg-neutral-750 border-grey-light dark:border-neutral-600")}> {task.completed &&
                        <Icon name="check" size={8} strokeWidth={2}
                              className="text-white"/>} {task.completePercentage != null && task.completePercentage > 0 && !task.completed && (
                        <div className="w-1.5 h-1.5 bg-primary/80 dark:bg-primary-light/80 rounded-full"></div>)} </div>
                    <div className="flex-1 overflow-hidden"><p
                        className={twMerge("text-[12px] font-normal text-grey-dark dark:text-neutral-100 leading-snug truncate", task.completed && "line-through text-grey-medium dark:text-neutral-400 font-light")}>{task.title || t('common.untitledTask')}</p>
                        <div
                            className="flex items-center space-x-2 mt-0.5 text-[10px] text-grey-medium dark:text-neutral-400 font-light">
                            {task.completePercentage != null && task.completePercentage > 0 && !task.completed && (
                                <span
                                    className="font-normal text-primary dark:text-primary-light">[{task.completePercentage}%]</span>)} {task.dueDate && isValid(safeParseDate(task.dueDate)) && (
                            <span className="flex items-center whitespace-nowrap"><Icon name="calendar" size={10}
                                                                                        strokeWidth={1}
                                                                                        className="mr-0.5 opacity-80"/>{formatRelativeDate(task.dueDate, t, false, preferences?.language)}</span>)} {task.listName && task.listName !== 'Inbox' && (
                            <span
                                className="flex items-center bg-grey-ultra-light dark:bg-neutral-700 px-1 py-0 rounded-sm max-w-[70px] truncate"
                                title={task.listName}><Icon name={task.listName === 'Trash' ? 'trash' : 'list'} size={9}
                                                            strokeWidth={1}
                                                            className="mr-0.5 opacity-80 flex-shrink-0"/><span
                                className="truncate">{task.listName === 'Inbox' ? t('sidebar.inbox') : task.listName}</span></span>)} </div>
                    </div>
                </li>))}</ul>) : (
                <p className="text-[12px] text-grey-medium dark:text-neutral-400 italic p-4 text-center font-light">{t('summary.noReferencedTasks')}</p>)} </div>);

    const TaskItemMiniInline: React.FC<{
        task: Task;
        isSelected: boolean;
        onSelectionChange: (id: string, selected: boolean | 'indeterminate') => void;
    }> = React.memo(({task, isSelected, onSelectionChange}) => {
        const {t} = useTranslation();
        const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
        const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
        const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
        const uniqueId = `summary-task-${task.id}`;
        const isDisabled = task.listName === 'Trash';
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
                       className={twMerge("flex flex-col p-2 rounded-base transition-colors duration-150 ease-in-out", isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer", isSelected && !isDisabled ? "bg-black/5 dark:bg-white/5" : "hover:bg-black/5 dark:hover:bg-white/5")}
                       onClick={handleLabelClick}>
            <div className="flex items-center">
                <SelectionCheckboxRadix id={uniqueId} checked={isSelected}
                                        onChange={(checkedState) => onSelectionChange(task.id, checkedState)}
                                        aria-label={`Select task: ${task.title || t('common.untitledTask')}`}
                                        className="mr-2 flex-shrink-0" size={16} disabled={isDisabled}/>
                <div className="flex-1 overflow-hidden">
                    <span
                        className={twMerge("text-[13px] font-normal text-grey-dark dark:text-neutral-100 block truncate", task.completed && !isDisabled && "line-through text-grey-medium dark:text-neutral-400 font-light", isDisabled && "text-grey-medium dark:text-neutral-400 font-light")}>{task.title ||
                        <span className="italic">{t('common.untitledTask')}</span>}</span>
                    <div
                        className="text-[11px] font-light text-grey-medium dark:text-neutral-400 flex items-center space-x-2 mt-0.5 flex-wrap gap-y-0.5">
                        {task.completePercentage != null && task.completePercentage > 0 && task.completePercentage < 100 && !isDisabled && (<span
                            className="text-primary dark:text-primary-light font-normal">[{task.completePercentage}%]</span>)}
                        {parsedDueDate && isValid(parsedDueDate) && (<span
                            className={twMerge("flex items-center whitespace-nowrap", overdue && !task.completed && !isDisabled && "text-error dark:text-red-400 font-normal", task.completed && !isDisabled && "line-through")}><Icon
                            name="calendar" size={10} strokeWidth={1}
                            className="mr-0.5 opacity-80"/>{formatRelativeDate(parsedDueDate, t, false, preferences?.language)}</span>)}
                        {task.listName && task.listName !== 'Inbox' && (<span
                            className="flex items-center bg-black/5 dark:bg-white/5 px-1 rounded-sm text-[10px] max-w-[70px] truncate"
                            title={task.listName}><Icon name={task.listName === 'Trash' ? 'trash' : 'list'} size={10}
                                                        strokeWidth={1}
                                                        className="mr-0.5 opacity-80 flex-shrink-0"/><span
                            className="truncate">{task.listName}</span></span>)}
                        {task.tags && task.tags.length > 0 && (
                            <span className="flex items-center space-x-1">{task.tags.slice(0, 1).map(tag => (
                                <span key={tag}
                                      className="bg-black/5 dark:bg-white/5 px-1 rounded-sm text-[10px] max-w-[60px] truncate">#{tag}</span>))}{task.tags.length > 1 &&
                                <span
                                    className="text-[10px] text-grey-medium/80 dark:text-neutral-400/80">+{task.tags.length - 1}</span>}</span>)}
                    </div>
                </div>
            </div>
            {sortedSubtasks && sortedSubtasks.length > 0 && !isDisabled && (
                <div
                    className={twMerge("mt-1.5 pt-1.5 border-t border-grey-light/50 dark:border-neutral-700/50", "pl-[calc(0.5rem+16px+0.5rem)]")}>
                    <AnimatePresence initial={false}>
                        {isSubtasksExpanded && (
                            <motion.div key="subtask-list-animated" initial="collapsed"
                                        animate={isSubtasksExpanded ? "open" : "collapsed"} exit="collapsed" variants={{
                                open: {
                                    opacity: 1,
                                    height: 'auto',
                                    transition: {duration: 0.25, ease: [0.33, 1, 0.68, 1]}
                                },
                                collapsed: {
                                    opacity: 0,
                                    height: 0,
                                    transition: {duration: 0.2, ease: [0.33, 1, 0.68, 1]}
                                }
                            }} className="overflow-hidden">
                                <div
                                    className={twMerge("max-h-28 overflow-y-auto styled-scrollbar-thin pr-1", isSubtasksExpanded ? "pb-1" : "")}> {sortedSubtasks.map(sub => (
                                    <div key={sub.id} className="flex items-center text-[12px] font-light mb-0.5">
                                        <SelectionCheckboxRadix id={`summary-subtask-item-check-${sub.id}`}
                                                                checked={sub.completed} onChange={() => {
                                        }} aria-label={`Subtask: ${sub.title || 'Untitled Subtask'} status`}
                                                                className="mr-1.5 flex-shrink-0 pointer-events-none opacity-80"
                                                                size={11} disabled={true}/>
                                        <span
                                            className={twMerge("truncate text-grey-medium dark:text-neutral-400", sub.completed && "line-through opacity-70")}>{sub.title ||
                                            <span className="italic">{t('common.untitledSubtask')}</span>}</span>
                                    </div>))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence> {!isSubtasksExpanded && subtasksToShow.map(sub => (
                    <div key={`preview-${sub.id}`} className="flex items-center text-[12px] font-light mb-0.5">
                        <SelectionCheckboxRadix id={`summary-subtask-item-preview-check-${sub.id}`}
                                                checked={sub.completed} onChange={() => {
                        }} aria-label={`Subtask: ${sub.title || 'Untitled Subtask'} status`}
                                                className="mr-1.5 flex-shrink-0 pointer-events-none opacity-80"
                                                size={11} disabled={true}/>
                        <span
                            className={twMerge("truncate text-grey-medium dark:text-neutral-400", sub.completed && "line-through opacity-70")}>{sub.title ||
                            <span className="italic">{t('common.untitledSubtask')}</span>}</span>
                    </div>))} {sortedSubtasks.length > INITIAL_VISIBLE_SUBTASKS && (
                    <button type="button" data-subtask-expander="true" onClick={toggleSubtaskExpansion}
                            className={twMerge("text-[10px] text-primary dark:text-primary-light hover:underline mt-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded font-light", "ml-[calc(0.5rem+11px)]")}
                            aria-expanded={isSubtasksExpanded}>{isSubtasksExpanded ? "Show less" : `+ ${hiddenSubtasksCount} more subtask${hiddenSubtasksCount > 1 ? 's' : ''}`}</button>)}
                </div>)}
        </label>);
    });
    TaskItemMiniInline.displayName = 'TaskItemMiniInline';

    return (
        <div className="h-full flex flex-col bg-transparent overflow-hidden">
            <div
                className="px-6 py-0 h-[56px] border-b border-grey-light/50 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0 bg-transparent z-10"
                data-tauri-drag-region="true"
            >
                <div className="w-1/3 flex items-center space-x-2">
                    <h1 className="text-[18px] font-light text-grey-dark dark:text-neutral-100 truncate">{t('iconBar.aiSummary')}</h1>
                    <Tooltip.Provider>
                        <Tooltip.Root delayDuration={200}>
                            <Tooltip.Trigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    icon="history"
                                    onClick={openHistoryModal}
                                    className="w-7 h-7 text-grey-medium dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
                                    iconProps={{size: 16, strokeWidth: 1}}
                                    aria-label={t('summary.history.title')}
                                    disabled={isGenerating}
                                />
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className={tooltipContentClass} sideOffset={4}>
                                    {t('summary.history.tooltip')}
                                    <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900/95"/>
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </Tooltip.Provider>
                </div>
                <div className="flex-1 flex justify-center items-center space-x-1">
                    <Popover.Root modal={true} open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
                        <DropdownMenu.Root open={isPeriodDropdownOpen} onOpenChange={setIsPeriodDropdownOpen}>
                            <Popover.Anchor asChild>
                                <DropdownMenu.Trigger asChild disabled={isGenerating}>
                                    <Button variant="ghost" size="sm"
                                            className="!h-8 px-3 text-grey-dark dark:text-neutral-200 font-light hover:bg-black/5 dark:hover:bg-white/10 bg-white/50 dark:bg-neutral-800/50 min-w-[120px] tabular-nums">
                                        <Icon name="calendar-days" size={14} strokeWidth={1}
                                              className="mr-1.5 opacity-80"/>
                                        {selectedPeriodLabel}
                                        <Icon name="chevron-down" size={14} strokeWidth={1}
                                              className="ml-auto opacity-70 pl-1"/>
                                    </Button>
                                </DropdownMenu.Trigger>
                            </Popover.Anchor>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className={dropdownContentBaseClasses} sideOffset={5}
                                                      align="center" onCloseAutoFocus={e => {
                                    if (isRangePickerOpen) e.preventDefault();
                                }}>
                                    <DropdownMenu.RadioGroup value={typeof period === 'string' ? period : 'custom'}
                                                             onValueChange={handlePeriodValueChange}>
                                        {periodOptions.map(p => (
                                            <DropdownMenu.RadioItem key={p.label}
                                                                    value={typeof p.value === 'string' ? p.value : 'custom'}
                                                                    className={getSummaryMenuRadioItemStyle((typeof period === 'string' && period === p.value) || (typeof period === 'object' && p.value === 'custom'))}>
                                                {p.label}
                                                <DropdownMenu.ItemIndicator
                                                    className="absolute right-2 inline-flex items-center"><Icon
                                                    name="check" size={12}
                                                    strokeWidth={2}/></DropdownMenu.ItemIndicator>
                                            </DropdownMenu.RadioItem>
                                        ))}
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
                        <DropdownMenu.Trigger asChild disabled={isGenerating}>
                            <Button variant="ghost" size="sm"
                                    className="!h-8 px-3 text-grey-dark dark:text-neutral-200 font-light hover:bg-black/5 dark:hover:bg-white/10 bg-white/50 dark:bg-neutral-800/50 min-w-[110px]"><Icon
                                name="list" size={14} strokeWidth={1} className="mr-1.5 opacity-80"/>{selectedListLabel}<Icon
                                name="chevron-down" size={14} strokeWidth={1}
                                className="ml-auto opacity-70 pl-1"/></Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className={twMerge(dropdownContentBaseClasses, "max-h-60 overflow-y-auto styled-scrollbar-thin")}
                                sideOffset={5} align="center" onCloseAutoFocus={e => e.preventDefault()}>
                                <DropdownMenu.RadioGroup value={listFilter} onValueChange={handleListChange}>
                                    {listOptions.map(l => (<DropdownMenu.RadioItem key={l.value} value={l.value}
                                                                                   className={getSummaryMenuRadioItemStyle(listFilter === l.value)}>{l.label}
                                        <DropdownMenu.ItemIndicator
                                            className="absolute right-2 inline-flex items-center"><Icon name="check"
                                                                                                        size={12}
                                                                                                        strokeWidth={2}/></DropdownMenu.ItemIndicator>
                                    </DropdownMenu.RadioItem>))}
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
                <div className="w-1/3 flex justify-end">
                    <Button variant="primary" size="sm" icon={isGenerating ? undefined : "sparkles"}
                            loading={isGenerating} onClick={handleGenerateClick} disabled={isGenerateDisabled}
                            className="!h-8 px-3">
                        <span className="font-normal">{isGenerating ? t('summary.generating') : t('summary.generate')}</span>
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 md:p-4 gap-3 md:gap-4 min-h-0">
                <div
                    className="w-full md:w-[360px] h-1/2 md:h-full flex flex-col bg-transparent overflow-hidden flex-shrink-0">
                    <div
                        className="px-4 py-3 border-b border-grey-light/50 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0 h-12">
                        <h2 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 truncate">
                            {t('summary.tasksTitle')} ({selectableTasks.length})
                        </h2>
                        <SelectionCheckboxRadix
                            id="select-all-summary-tasks"
                            checked={selectAllState === true}
                            indeterminate={selectAllState === 'indeterminate'}
                            onChange={handleSelectAllToggle('current')}
                            aria-label={selectAllState === true ? t('summary.deselectAll') : (selectAllState === 'indeterminate' ? t('summary.deselectSome') : t('summary.selectAll'))}
                            className="mr-1"
                            size={16}
                            disabled={selectableTasks.length === 0 || isGenerating}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto styled-scrollbar-thin p-2 space-y-1">
                        {filteredTasks.length === 0 ? (
                            <div
                                className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-4 text-center pt-10">
                                <Icon name="archive" size={32} strokeWidth={1}
                                      className="mb-3 text-grey-light/70 dark:text-neutral-500/70 opacity-80"/>
                                <p className="text-[13px] font-normal text-grey-dark dark:text-neutral-200">{t('summary.noTasks.title')}</p>
                                <p className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">{t('summary.noTasks.description')}</p>
                            </div>
                        ) : (
                            filteredTasks.map(task => (
                                <TaskItemMiniInline key={task.id} task={task} isSelected={selectedTaskIds.has(task.id)}
                                                    onSelectionChange={handleTaskSelectionChange}/>))
                        )}
                    </div>
                    {/* Future Plans Section */}
                    <div className="h-px bg-grey-light/50 dark:bg-neutral-700/50 my-2"></div>
                    <div
                        className="px-4 py-3 border-b border-grey-light/50 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0 h-12">
                        <h2 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 truncate">
                            {t('summary.futurePlansTitle')} ({selectableFutureTasks.length})
                        </h2>
                        <SelectionCheckboxRadix
                            id="select-all-future-tasks"
                            checked={selectAllFutureState === true}
                            indeterminate={selectAllFutureState === 'indeterminate'}
                            onChange={handleSelectAllToggle('future')}
                            aria-label={selectAllFutureState === true ? t('summary.deselectAll') : (selectAllFutureState === 'indeterminate' ? t('summary.deselectSome') : t('summary.selectAll'))}
                            className="mr-1"
                            size={16}
                            disabled={selectableFutureTasks.length === 0 || isGenerating}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto styled-scrollbar-thin p-2 space-y-1">
                        {futureTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-4 text-center">
                                <p className="text-[12px] font-light">No upcoming tasks found.</p>
                            </div>
                        ) : (
                            futureTasks.map(task => (
                                <TaskItemMiniInline key={task.id} task={task} isSelected={selectedFutureTaskIds.has(task.id)}
                                                    onSelectionChange={handleFutureTaskSelectionChange}/>))
                        )}
                    </div>
                </div>


                <div className="hidden md:block w-px bg-grey-light/50 dark:bg-neutral-700/50 self-stretch my-0"></div>

                <div className="flex-1 h-1/2 md:h-full flex flex-col bg-transparent overflow-hidden">
                    <div
                        className="px-4 py-3 h-12 border-b border-grey-light/50 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0">
                        <span className="text-[11px] font-light text-grey-medium dark:text-neutral-400 truncate">
                            {isGenerating ? t('summary.generating') : (currentIndex === -1 ? t('summary.newSummary') : (summaryTimestamp ? `${t('summary.generated')}: ${summaryTimestamp}` : t('summary.title')))}
                        </span>
                        <div className="flex items-center space-x-1.5">
                            {currentSummary && !isGenerating && !editMode && (
                                <Button variant="ghost" size="sm" icon="pencil" className="!h-7 px-2"
                                        onClick={handleStartEditing}>{t('common.edit')}</Button>
                            )}
                            {currentSummary && !isGenerating && editMode && (
                                <>
                                    <Button variant="ghost" size="sm" className="!h-7 px-2"
                                            onClick={handleCancelEditing}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button variant="primary" size="sm" icon="check" className="!h-7 px-2"
                                            onClick={handleDoneEditing}>
                                        {t('summary.doneEditing')}
                                    </Button>
                                </>
                            )}
                            {(currentSummary && !isGenerating) &&
                                <div className="w-px h-4 bg-grey-light/50 dark:bg-neutral-700/50"></div>}
                            {currentSummary && !isGenerating && (
                                <DropdownMenu.Root open={isRefTasksDropdownOpen}
                                                   onOpenChange={setIsRefTasksDropdownOpen}>
                                    <DropdownMenu.Trigger asChild>
                                        <Button variant="link" size="sm"
                                                className="text-[11px] !h-5 px-1 text-primary hover:text-primary-dark -mr-1"
                                                aria-haspopup="true">
                                            {t('summary.tasksUsed', {count: tasksUsedCount})}
                                            <Icon name="chevron-down" size={12} strokeWidth={1}
                                                  className="ml-0.5 opacity-70"/>
                                        </Button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                            className={twMerge("z-[60] p-0 dark:border dark:border-neutral-700", dropdownAnimationClasses)}
                                            sideOffset={4} align="end" onCloseAutoFocus={e => e.preventDefault()}>
                                            {renderReferencedTasksDropdown()}
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                            )}
                            {totalRelevantSummaries > 0 && !isGenerating && (
                                <>
                                    <Button variant="ghost" size="icon" icon="chevron-left" onClick={handlePrevSummary}
                                            disabled={currentIndex >= totalRelevantSummaries - 1 || editMode} // Disable nav in edit mode
                                            className="w-6 h-6 text-grey-medium dark:text-neutral-400"
                                            iconProps={{size: 14, strokeWidth: 1}} aria-label={t('summary.older')}/>
                                    <span
                                        className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 tabular-nums">{displayedIndexForUi} / {totalForUi}</span>
                                    <Button variant="ghost" size="icon" icon="chevron-right" onClick={handleNextSummary}
                                            disabled={currentIndex <= 0 || editMode} // Disable nav in edit mode
                                            className="w-6 h-6 text-grey-medium dark:text-neutral-400"
                                            iconProps={{size: 14, strokeWidth: 1}} aria-label={t('summary.newer')}/>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        {isGenerating && !summaryDisplayContent && (
                            <div
                                className="absolute inset-0 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-sm flex items-center justify-center z-10">
                                <Icon name="loader" size={20} strokeWidth={1.5}
                                      className="text-primary dark:text-primary-light animate-spin"/>
                            </div>
                        )}

                        {isGenerating || !editMode ? (
                            (summaryDisplayContent || isGenerating) ? (
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none p-4 h-full overflow-y-auto styled-scrollbar-thin">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryDisplayContent}</ReactMarkdown>
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 px-2 text-center">
                                    <Icon name="sparkles" size={32} strokeWidth={1}
                                          className="mb-3 text-grey-light/70 dark:text-neutral-500/70 opacity-80"/>
                                    <p className="text-[13px] font-normal text-grey-dark dark:text-neutral-200">{t('summary.noSummary.title', {defaultValue: 'No summary available'})}</p>
                                    <p className="text-[11px] mt-1 text-grey-medium dark:text-neutral-400 font-light">{t('summary.noSummary.description', {defaultValue: 'Select tasks and generate a new summary.'})}</p>
                                </div>
                            )
                        ) : (
                            <div className="h-full w-full relative overflow-hidden bg-transparent">
                                <CodeMirrorEditor
                                    key={currentSummary?.id ?? 'editing-summary'}
                                    ref={editorRef}
                                    value={summaryEditorContent}
                                    onChange={handleEditorChange}
                                    className="!h-full !bg-transparent !border-none"
                                />
                                {hasUnsavedChangesRef.current && (
                                    <span
                                        className="absolute bottom-2 right-2 text-[10px] text-grey-medium/70 dark:text-neutral-400/70 italic font-light">
                                        {t('common.unsavedChanges')}
                                    </span>
                                )}
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