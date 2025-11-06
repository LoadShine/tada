import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import Button from '@/components/ui/Button.tsx';
import Icon from '@/components/ui/Icon.tsx';
import {format, formatDistanceToNowStrict, isSameDay, isValid, parseISO, startOfDay, subDays} from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {StoredSummary, Task} from '@/types';
import useDebounce from '@/hooks/useDebounce';
import Highlighter from 'react-highlight-words';
import {IconName} from "@/components/ui/IconMap.ts";
import * as Dialog from '@radix-ui/react-dialog';
import {VisuallyHidden} from '@radix-ui/react-visually-hidden';
import {useTranslation} from "react-i18next";

const getFilterLabels = (periodKey: string, listKey: string, t: (key: string, options?: any) => string): {
    periodLabel: string,
    listLabel: string
} => {
    let periodLabel = 'Date Range';
    let listLabel = t('summary.lists.all');

    const periodTranslations: Record<string, string> = {
        today: t('summary.periods.today'),
        yesterday: t('summary.periods.yesterday'),
        thisWeek: t('summary.periods.thisWeek'),
        lastWeek: t('summary.periods.lastWeek'),
        thisMonth: t('summary.periods.thisMonth'),
        lastMonth: t('summary.periods.lastMonth'),
    };
    periodLabel = periodTranslations[periodKey] || 'Custom Range';

    if (periodKey.startsWith('custom_')) {
        try {
            const [, startTs, endTs] = periodKey.split('_');
            const startDate = new Date(Number(startTs));
            const endDate = new Date(Number(endTs));
            if (isValid(startDate) && isValid(endDate)) {
                const currentYear = new Date().getFullYear();
                const startYear = startDate.getFullYear();
                const endYear = endDate.getFullYear();
                if (isSameDay(startDate, endDate)) periodLabel = format(startDate, startYear === currentYear ? 'MMM d' : 'MMM d, yyyy');
                else {
                    const startFormat = startYear === currentYear ? 'MMM d' : 'MMM d, yyyy';
                    const endFormat = endYear === currentYear ? 'MMM d' : 'MMM d, yyyy';
                    periodLabel = `${format(startDate, startFormat)} - ${format(endDate, endFormat)}`;
                }
            }
        } catch (e) {
            console.error("Error parsing custom date range key:", e);
        }
    }

    if (listKey !== 'all' && listKey.startsWith('list-')) {
        listLabel = listKey.substring(5);
    } else if (listKey !== 'all') {
        listLabel = listKey;
    }

    if (listLabel === 'Inbox') {
        listLabel = t('sidebar.inbox');
    }

    return {periodLabel, listLabel};
};

interface ReferencedTaskItemProps {
    task: Task;
}

const ReferencedTaskItem: React.FC<ReferencedTaskItemProps> = React.memo(({task}) => {
    const {t} = useTranslation();
    const iconName: IconName = task.completed ? "check-square" : "square";
    const iconColor = task.completed ? "text-success" : "text-grey-medium";
    const textColor = task.completed ? "text-grey-medium dark:text-neutral-400" : "text-grey-dark dark:text-neutral-100";
    const showPercentage = !task.completed && task.completePercentage != null && task.completePercentage > 0;

    return (
        <li className="flex items-center py-1.5 px-1 rounded-base transition-colors duration-150 ease-out group"
            title={task.title}>
            <Icon name={iconName} size={12} strokeWidth={1.5}
                  className={twMerge("mr-2 flex-shrink-0 transition-colors opacity-90", iconColor)}/>
            <div className="flex items-baseline flex-1 overflow-hidden">
                <span
                    className={twMerge("text-[12px] font-light truncate", textColor, task.completed && "line-through")}>
                    {task.title || <span className="italic">{t('common.untitledTask')}</span>}
                </span>
                {showPercentage && (<span
                    className="ml-1.5 text-[10px] text-primary dark:text-primary-light font-normal select-none flex-shrink-0">[{task.completePercentage}%]</span>)}
            </div>
        </li>
    );
});
ReferencedTaskItem.displayName = 'ReferencedTaskItem';

interface SummaryHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summaries: StoredSummary[];
    allTasks: Task[];
}

const SummaryHistoryModal: React.FC<SummaryHistoryModalProps> = ({isOpen, onClose, summaries, allTasks,}) => {
    const {t} = useTranslation();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 250);

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            onClose();
            setSelectedSummaryId(null);
            setSearchTerm('');
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            const validSelectionExists = summaries.some(s => s.id === selectedSummaryId);
            if (summaries.length > 0 && !validSelectionExists) setSelectedSummaryId(summaries[0].id);
            else if (summaries.length === 0) setSelectedSummaryId(null);
            if (summaries.length > 0 && !searchInputRef.current?.value) {
                const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen, summaries, selectedSummaryId]);

    const selectedSummary = useMemo(() => summaries.find(s => s.id === selectedSummaryId) ?? null, [selectedSummaryId, summaries]);
    const selectedReferencedTasks = useMemo(() => {
        if (!selectedSummary) return [];
        const referencedIds = new Set(selectedSummary.taskIds);
        return allTasks.filter(task => referencedIds.has(task.id)).sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1) || a.title.localeCompare(b.title));
    }, [selectedSummary, allTasks]);

    const groupedSummaries = useMemo(() => {
        const groups: Record<string, StoredSummary[]> = {};
        [...summaries].sort((a, b) => b.createdAt - a.createdAt).forEach(summary => {
            const date = new Date(summary.createdAt);
            const dateKey = format(date, 'yyyy-MM-dd');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(summary);
        });
        return Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(key => ({
            dateKey: key,
            items: groups[key]
        }));
    }, [summaries]);

    const filteredGroupedSummaries = useMemo(() => {
        if (!debouncedSearchTerm) return groupedSummaries;
        const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
        const searchWords = lowerSearchTerm.split(' ').filter(Boolean);
        const filtered: { dateKey: string; items: StoredSummary[] }[] = [];
        groupedSummaries.forEach(group => {
            const matchingItems = group.items.filter(summary => {
                const {periodLabel, listLabel} = getFilterLabels(summary.periodKey, summary.listKey, t);
                return searchWords.every(word => summary.summaryText.toLowerCase().includes(word) || periodLabel.toLowerCase().includes(word) || listLabel.toLowerCase().includes(word));
            });
            if (matchingItems.length > 0) filtered.push({dateKey: group.dateKey, items: matchingItems});
        });
        return filtered;
    }, [groupedSummaries, debouncedSearchTerm, t]);

    const formatDateGroupKey = (dateKey: string): string => {
        const date = parseISO(dateKey);
        if (!isValid(date)) return "Invalid Date";
        const now = new Date();
        if (isSameDay(date, now)) return t('common.today');
        if (isSameDay(date, startOfDay(subDays(now, 1)))) return 'Yesterday';
        return format(date, date.getFullYear() === now.getFullYear() ? 'MMMM d' : 'MMMM d, yyyy');
    };

    const handleSelectSummary = useCallback((summaryId: string) => setSelectedSummaryId(summaryId), []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        const currentList = filteredGroupedSummaries.flatMap(g => g.items);
        const isCurrentSelectionInFilteredList = currentList.some(s => s.id === selectedSummaryId);
        if (!isCurrentSelectionInFilteredList && currentList.length > 0) {
            setSelectedSummaryId(currentList[0].id);
        } else if (currentList.length === 0) {
            setSelectedSummaryId(null);
        }
    };

    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        searchInputRef.current?.focus();
        const isCurrentSelectionInAllSummaries = summaries.some(s => s.id === selectedSummaryId);
        if (!isCurrentSelectionInAllSummaries && summaries.length > 0) {
            setSelectedSummaryId(summaries[0].id);
        } else if (summaries.length === 0) {
            setSelectedSummaryId(null);
        }
    }, [summaries, selectedSummaryId]);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary dark:bg-primary-dark/30 dark:text-primary-light font-normal rounded-[1px] px-0",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean),
        autoEscape: true,
        textToHighlight: '',
    }), [debouncedSearchTerm]);

    const searchInputWrapperClass = useMemo(() => twMerge(
        "relative flex items-center w-full h-8",
        "bg-grey-ultra-light dark:bg-neutral-700/60",
        "rounded-base",
        "transition-all duration-150 ease-in-out"
    ), []);

    const searchInputClass = useMemo(() => twMerge(
        "w-full h-full pl-8 pr-7 text-[13px] font-light",
        "bg-transparent border-none outline-none",
        "text-grey-dark dark:text-neutral-100",
        "placeholder:text-grey-medium dark:placeholder:text-neutral-400/70"
    ), []);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-50"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[55]",
                        "bg-white dark:bg-neutral-800 w-full max-w-5xl rounded-base shadow-modal flex flex-col max-h-[80vh] h-[80vh] overflow-hidden",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    onEscapeKeyDown={onClose}>
                    <div
                        className="px-6 py-4 border-b border-grey-light dark:border-neutral-700 flex justify-between items-center flex-shrink-0 h-[60px]">
                        <Dialog.Title
                            className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 flex items-center">
                            <Icon name="history" size={16} strokeWidth={1}
                                  className="mr-2 text-grey-medium dark:text-neutral-400"/>{t('summary.history.title')}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-grey-ultra-light hover:text-grey-dark dark:hover:text-neutral-100 w-7 h-7 -mr-1.5"
                                    iconProps={{size: 12, strokeWidth: 1.5}} aria-label={t('summary.history.close')}/>
                        </Dialog.Close>
                    </div>
                    <Dialog.Description asChild><VisuallyHidden>{t('summary.history.description')}</VisuallyHidden></Dialog.Description>
                    <div className="flex flex-1 overflow-hidden min-h-0">
                        <div
                            className="w-[320px] border-r border-grey-light dark:border-neutral-700 flex flex-col overflow-hidden flex-shrink-0 bg-white dark:bg-neutral-800">
                            <div className="p-3 border-b border-grey-light dark:border-neutral-700 flex-shrink-0">
                                <div className={searchInputWrapperClass}>
                                    <Icon name="search" size={14} strokeWidth={1.5}
                                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-medium dark:text-neutral-400 z-10 pointer-events-none"/>
                                    <input ref={searchInputRef} type="search" placeholder={t('summary.history.searchPlaceholder')}
                                           value={searchTerm} onChange={handleSearchChange}
                                           className={searchInputClass}
                                           aria-label={t('summary.history.searchPlaceholder')}/>
                                    {searchTerm && (<button onClick={handleClearSearch}
                                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200 z-10 transition-colors"
                                                            aria-label={t('common.clear')}><Icon name="x-circle" size={14}
                                                                                                 strokeWidth={1}/></button>)}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto styled-scrollbar-thin">
                                {summaries.length === 0 ? (
                                        <p className="text-[12px] text-grey-medium dark:text-neutral-400 text-center py-10 px-4 italic font-light">{t('summary.history.emptyState')}</p>)
                                    : filteredGroupedSummaries.length === 0 ? (
                                            <p className="text-[12px] text-grey-medium dark:text-neutral-400 text-center py-10 px-4 italic font-light">{t('summary.history.noResults', {searchTerm: debouncedSearchTerm})}</p>)
                                        : (filteredGroupedSummaries.map(({dateKey, items}) => (
                                            <div key={dateKey} className="pt-2">
                                                <h3 className="px-3.5 pt-2 pb-1 text-[11px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px] sticky top-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm z-10 border-b border-grey-light dark:border-neutral-700">{formatDateGroupKey(dateKey)}</h3>
                                                <ul className="px-2 py-1">
                                                    {items.map((summary) => {
                                                        const {
                                                            periodLabel,
                                                            listLabel
                                                        } = getFilterLabels(summary.periodKey, summary.listKey, t);
                                                        const isSelected = selectedSummaryId === summary.id;
                                                        const summarySnippet = summary.summaryText.substring(0, 100) + (summary.summaryText.length > 100 ? '...' : '');
                                                        return (
                                                            <li key={summary.id}>
                                                                <button
                                                                    className={twMerge(
                                                                        "w-full text-left p-2.5 hover:bg-grey-ultra-light dark:hover:bg-neutral-750 transition-colors duration-100 ease-out rounded-base mb-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                                                        isSelected && "bg-grey-ultra-light dark:bg-neutral-700 hover:bg-grey-ultra-light dark:hover:bg-neutral-700"
                                                                    )}
                                                                    onClick={() => handleSelectSummary(summary.id)}
                                                                    aria-current={isSelected ? 'page' : undefined}>
                                                                    <div
                                                                        className="flex justify-between items-center mb-1">
                                                                        <span
                                                                            className={twMerge("text-[11px] font-light", isSelected ? "text-grey-dark dark:text-neutral-100" : "text-grey-medium dark:text-neutral-400")}>{format(summary.createdAt, 'p')}</span>
                                                                        <div
                                                                            className="flex items-center space-x-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                                                                            <span
                                                                                className={twMerge(
                                                                                    "inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-light",
                                                                                    isSelected ? "bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light" : "bg-info/10 text-info dark:bg-info/20 dark:text-info-light"
                                                                                )}
                                                                                title={periodLabel}><Icon
                                                                                name="calendar-days" size={10}
                                                                                strokeWidth={1}
                                                                                className="mr-1 opacity-80 flex-shrink-0"/><span
                                                                                className="truncate">{periodLabel}</span></span>
                                                                            <span
                                                                                className={twMerge(
                                                                                    "inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-light",
                                                                                    isSelected ? "bg-grey-light text-grey-dark dark:bg-neutral-600 dark:text-neutral-100" : "bg-grey-light text-grey-medium dark:bg-neutral-750 dark:text-neutral-300"
                                                                                )}
                                                                                title={listLabel}><Icon name="list"
                                                                                                        size={10}
                                                                                                        strokeWidth={1}
                                                                                                        className="mr-1 opacity-80 flex-shrink-0"/><span
                                                                                className="truncate">{listLabel}</span></span>
                                                                        </div>
                                                                    </div>
                                                                    <p className={twMerge("text-[12px] font-light leading-snug", isSelected ? "text-grey-dark dark:text-neutral-100" : "text-grey-medium dark:text-neutral-400")}>
                                                                        <Highlighter {...highlighterProps}
                                                                                     textToHighlight={summarySnippet}/>
                                                                    </p>
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )))}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-800">
                            {selectedSummary ? (
                                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                            <span
                                                className="inline-flex items-center bg-info/10 text-info dark:bg-info/20 dark:text-info-light px-2 py-0.5 rounded-full text-[11px] font-light"><Icon
                                                name="calendar-days" size={11} strokeWidth={1}
                                                className="mr-1 opacity-80"/>{getFilterLabels(selectedSummary.periodKey, selectedSummary.listKey, t).periodLabel}</span>
                                            <span
                                                className="inline-flex items-center bg-grey-light text-grey-medium dark:bg-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded-full text-[11px] font-light"><Icon
                                                name="list" size={11} strokeWidth={1}
                                                className="mr-1 opacity-80"/>{getFilterLabels(selectedSummary.periodKey, selectedSummary.listKey, t).listLabel}</span>
                                        </div>
                                        <span
                                            className="text-[11px] text-grey-medium dark:text-neutral-400 whitespace-nowrap pl-2 font-light">
                                            {formatDistanceToNowStrict(selectedSummary.createdAt, {addSuffix: true})}
                                            {selectedSummary.updatedAt && selectedSummary.updatedAt > selectedSummary.createdAt + 10000 && (
                                                <span className="italic ml-1">(edited)</span>)}
                                        </span>
                                    </div>
                                    <div
                                        className="flex-1 min-h-0 mb-4 rounded-base overflow-hidden relative bg-white dark:bg-neutral-800 border border-grey-light dark:border-neutral-700">
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none p-4 h-full overflow-y-auto styled-scrollbar-thin">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}>{selectedSummary.summaryText}</ReactMarkdown>
                                        </div>
                                    </div>
                                    <div
                                        className="flex-shrink-0 max-h-[30%] overflow-hidden flex flex-col border-t border-grey-light dark:border-neutral-700 pt-3">
                                        <h4 className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px] mb-1.5 px-1 flex-shrink-0">{t('summary.referencedTasks')} ({selectedReferencedTasks.length})</h4>
                                        {selectedReferencedTasks.length > 0 ? (
                                            <ul className="space-y-0.5 flex-1 overflow-y-auto styled-scrollbar-thin pr-1">{selectedReferencedTasks.map(task => (
                                                <ReferencedTaskItem key={task.id} task={task}/>))}</ul>
                                        ) : (
                                            <p className="text-[12px] text-grey-medium dark:text-neutral-400 italic px-1 py-2 font-light">{t('summary.noReferencedTasks')}</p>)}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-grey-medium dark:text-neutral-400 text-[13px] italic p-10 text-center font-light">
                                    <Icon name="file-text" size={32} strokeWidth={1} className="mb-3 opacity-40"/>
                                    {t('summary.history.selectPrompt')}
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
SummaryHistoryModal.displayName = 'SummaryHistoryModal';
export default SummaryHistoryModal;