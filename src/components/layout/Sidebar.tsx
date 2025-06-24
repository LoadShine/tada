// src/components/layout/Sidebar.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    defaultPreferencesSettingsForApi,
    isAddListModalOpenAtom,
    preferencesSettingsAtom,
    preferencesSettingsLoadingAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    taskCountsAtom,
    tasksAtom,
    userListNamesAtom,
    userTagNamesAtom
} from '@/store/atoms';
import {Task, TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import Button from '../common/Button';
import AddListModal from '../common/AddListModal';
import {IconName} from "@/components/common/IconMap";
import Highlighter from "react-highlight-words";
import {AnimatePresence, motion} from 'framer-motion';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

function generateContentSnippet(content: string, term: string, length: number = 35): string {
    if (!content || !term) return '';
    const lowerContent = content.toLowerCase();
    const searchWords = term.toLowerCase().split(' ').filter(Boolean);
    let firstMatchIndex = -1;
    let matchedWord = '';
    for (const word of searchWords) {
        const index = lowerContent.indexOf(word);
        if (index !== -1) {
            firstMatchIndex = index;
            matchedWord = word;
            break;
        }
    }
    if (firstMatchIndex === -1) {
        return content.substring(0, length) + (content.length > length ? '...' : '');
    }
    const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
    const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
}

const SidebarItem: React.FC<{
    to: string; filter: TaskFilter; icon: IconName; label: string;
    count?: number; isUserList?: boolean;
}> = memo(({to, filter, icon, label, count}) => {
    const [currentActiveFilter,] = useAtom(currentFilterAtom);
    const navigate = useNavigate();
    const isActive = useMemo(() => currentActiveFilter === filter, [currentActiveFilter, filter]);
    const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        navigate(to);
    }, [navigate, to]);

    const linkClassName = useMemo(() => twMerge(
        'flex items-center justify-between px-2 py-0 h-8 rounded-base mb-0.5 text-[13px] group transition-colors duration-200 ease-in-out cursor-pointer relative',
        isActive
            ? 'bg-grey-ultra-light text-primary dark:bg-primary-dark/20 dark:text-primary-light font-medium'
            : 'text-grey-dark dark:text-neutral-200 font-light hover:bg-grey-ultra-light dark:hover:bg-grey-deep hover:text-grey-dark dark:hover:text-neutral-100',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep'
    ), [isActive]);

    const countClassName = useMemo(() => twMerge(
        "text-[10px] font-light px-1 py-0 rounded-sm ml-1 tabular-nums flex-shrink-0",
        isActive
            ? 'text-primary bg-primary/20 dark:text-primary-light dark:bg-primary-light/10'
            : 'text-grey-medium dark:text-neutral-400 bg-grey-light dark:bg-grey-deep group-hover:bg-grey-light dark:group-hover:bg-grey-deep'
    ), [isActive]);

    return (
        <Link to={to} onClick={handleClick} className={linkClassName} aria-current={isActive ? 'page' : undefined}>
            <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0 mr-1">
                <Icon name={icon} size={16} strokeWidth={1}
                      className="mr-2 flex-shrink-0 opacity-90"
                      aria-hidden="true"/>
                <span className="truncate">{label}</span>
            </div>
            {(count !== undefined && count > 0) && (
                <span className={countClassName} aria-label={`${count} items`}> {count} </span>)}
        </Link>
    );
});
SidebarItem.displayName = 'SidebarItem';

const CollapsibleSection: React.FC<{
    title: string; children: React.ReactNode;
    initiallyOpen?: boolean; action?: React.ReactNode;
}> = memo(({title, children, initiallyOpen = true, action}) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const sectionId = useMemo(() => `section-content-${title.replace(/\s+/g, '-')}`, [title]);
    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    const chevronClasses = useMemo(() => twMerge(
        "transition-transform duration-200 ease-in-out opacity-70 group-hover:opacity-90",
        isOpen ? "rotate-0" : "-rotate-90"
    ), [isOpen]);

    return (
        <div className="pt-4 first:pt-2">
            <div className="flex items-center justify-between px-2 py-0 mb-1">
                <button onClick={toggleOpen}
                        className="flex items-center flex-1 min-w-0 h-6 text-[11px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px] hover:text-grey-dark dark:hover:text-neutral-200 focus:outline-none group rounded pr-1"
                        aria-expanded={isOpen} aria-controls={sectionId}>
                    <Icon name={'chevron-down'} size={14} strokeWidth={1.5}
                          className={twMerge("mr-1.5 flex-shrink-0", chevronClasses)}
                          aria-hidden="true"/>
                    <span className="truncate">{title}</span>
                </button>
                {action && <div className="-mr-1 ml-1 flex-shrink-0">{action}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div id={sectionId} key="content" initial="collapsed" animate="open" exit="collapsed"
                                variants={{
                                    open: {opacity: 1, height: 'auto', marginTop: '2px'},
                                    collapsed: {opacity: 0, height: 0, marginTop: 0}
                                }}
                                transition={{duration: 0.25, ease: "easeOut"}} className="overflow-hidden">
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
CollapsibleSection.displayName = 'CollapsibleSection';

const Sidebar: React.FC = () => {
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const userTags = useAtomValue(userTagNamesAtom);
    const searchResults = useAtomValue(rawSearchResultsAtom);
    const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [, setIsAddListModalOpen] = useAtom(isAddListModalOpenAtom);

    const preferencesData = useAtomValue(preferencesSettingsAtom);
    const isLoadingPreferences = useAtomValue(preferencesSettingsLoadingAtom);
    const preferences = useMemo(() => preferencesData ?? defaultPreferencesSettingsForApi(), [preferencesData]);

    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 250);
    const isSearching = useMemo(() => debouncedSearchTerm.trim().length > 0, [debouncedSearchTerm]);

    const handleAddNewListClick = useCallback(() => {
        setIsAddListModalOpen(true);
    }, [setIsAddListModalOpen]);

    const handleListAdded = useCallback((newListName: string) => {
        const trimmedName = newListName.trim();
        if (!trimmedName) return;
        // Create a placeholder task in the new list to ensure the list is created on the backend
        const now = Date.now();
        const placeholderTask: Task = {
            id: `task-${now}`,
            title: `Welcome to ${trimmedName}`,
            listName: trimmedName,
            order: now,
            completed: false,
            completedAt: null,
            completePercentage: null,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };
        setTasks(prev => [...(prev ?? []), placeholderTask]);
        navigate(`/list/${encodeURIComponent(trimmedName)}`);
    }, [setTasks, navigate]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, [setSearchTerm]);

    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, [setSearchTerm]);

    const handleSearchResultClick = useCallback((task: Task) => {
        setSelectedTaskId(task.id);
    }, [setSelectedTaskId]);

    const myListsToDisplay = useMemo(() => userLists.filter(list => list !== 'Inbox'), [userLists]);
    const tagsToDisplay = useMemo(() => userTags, [userTags]);

    const searchInputClassName = useMemo(() => twMerge(
        "w-full h-[32px] pl-8 pr-7 text-[13px] font-light rounded-base focus:outline-none",
        "bg-grey-ultra-light/70 dark:bg-grey-deep/70",
        "border border-transparent dark:border-transparent",
        "focus:border-transparent dark:focus:border-transparent",
        "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
        "text-grey-dark dark:text-neutral-100",
        "transition-colors duration-200 ease-in-out"
    ), []);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0 dark:bg-primary-dark/30 dark:text-primary-light",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean), autoEscape: true,
    }), [debouncedSearchTerm]);

    const searchResultButtonClassName = "flex items-start w-full px-2 py-1.5 text-left rounded-base hover:bg-grey-ultra-light dark:hover:bg-grey-deep text-[13px] group transition-colors duration-100 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary";

    if (isLoadingPreferences) {
        return (
            <aside className={twMerge(
                "w-full h-full flex flex-col shrink-0 z-10 pt-2.5 pb-2 px-2",
                "bg-transparent items-center justify-center"
            )}>
                <Icon name="loader" size={20} className="text-primary animate-spin"/>
            </aside>
        );
    }

    return (
        <>
            <aside className={twMerge(
                "w-full h-full flex flex-col shrink-0 z-10 pt-2.5 pb-2 px-2",
                "bg-transparent"
            )}>
                <div className="mb-3 flex-shrink-0">
                    <div className="relative flex items-center">
                        <label htmlFor="sidebar-search" className="sr-only">Search Tasks</label>
                        <Icon name="search" size={12} strokeWidth={1.5}
                              className="absolute left-3 text-grey-medium dark:text-neutral-400 pointer-events-none z-10"/>
                        <input ref={searchInputRef} id="sidebar-search" type="search"
                               placeholder={preferences.language === 'zh-CN' ? '搜索任务...' : 'Search Tasks'}
                               value={searchTerm} onChange={handleSearchChange} className={searchInputClassName}
                               aria-label="Search tasks"/>
                        <AnimatePresence>
                            {searchTerm && (
                                <motion.div key="clear-search-btn" initial={{scale: 0.7, opacity: 0}}
                                            animate={{scale: 1, opacity: 1}} exit={{scale: 0.7, opacity: 0}}
                                            transition={{duration: 0.1}}
                                            className="absolute right-1.5 h-full flex items-center z-10">
                                    <Button variant="ghost" size="icon" icon="x-circle" onClick={handleClearSearch}
                                            className="w-5 h-5 text-grey-medium dark:text-neutral-400 opacity-70 hover:opacity-100 hover:bg-grey-light dark:hover:bg-grey-deep"
                                            iconProps={{size: 14, strokeWidth: 1}} aria-label="Clear search"/>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar -mx-0.5 pr-0.5">
                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            <motion.div key="search-results" initial={{opacity: 0}} animate={{opacity: 1}}
                                        exit={{opacity: 0}} transition={{duration: 0.15, ease: 'linear'}}
                                        className="px-0.5 pb-2">
                                {searchResults.length > 0 ? (
                                    <>
                                        <p className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 px-1.5 py-1">{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</p>
                                        {searchResults.map((task: Task) => (
                                            <button key={task.id} onClick={() => handleSearchResultClick(task)}
                                                    className={searchResultButtonClassName}
                                                    aria-label={`Search result: ${task.title || 'Untitled Task'}`}>
                                                <Icon
                                                    name={task.listName === 'Inbox' ? 'inbox' : (task.listName === 'Trash' ? 'trash' : 'list')}
                                                    size={15} strokeWidth={1}
                                                    className="mr-2 mt-[2px] flex-shrink-0 text-grey-medium dark:text-neutral-400 opacity-80"
                                                    aria-hidden="true"/>
                                                <div className="flex-1 overflow-hidden">
                                                    <Highlighter {...highlighterProps}
                                                                 textToHighlight={task.title || 'Untitled Task'}
                                                                 className={twMerge("block truncate font-normal text-grey-dark dark:text-neutral-100", task.completed && task.listName !== 'Trash' && "line-through text-grey-medium dark:text-neutral-400", task.listName === 'Trash' && "italic text-grey-medium dark:text-neutral-400")}/>
                                                    {task.content && generateContentSnippet(task.content, debouncedSearchTerm) && (
                                                        <Highlighter {...highlighterProps}
                                                                     textToHighlight={generateContentSnippet(task.content, debouncedSearchTerm)}
                                                                     className="block truncate text-[11px] font-light text-grey-medium dark:text-neutral-400 mt-0.5"/>)}
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-[12px] text-grey-medium dark:text-neutral-400 text-center py-4 px-2 italic font-light">
                                        {preferences.language === 'zh-CN' ? `没有找到与 "${debouncedSearchTerm}" 匹配的任务。` : `No tasks found matching "${debouncedSearchTerm}".`}
                                    </p>)}
                            </motion.div>
                        ) : (
                            <motion.div key="filters" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                                        transition={{duration: 0.15, ease: 'linear'}} className="px-0.5 pb-2">
                                <nav className="mb-1">
                                    <SidebarItem to="/all" filter="all" icon="archive"
                                                 label={preferences.language === 'zh-CN' ? '所有任务' : "All Tasks"}
                                                 count={counts.all}/>
                                    <SidebarItem to="/today" filter="today" icon="sun"
                                                 label={preferences.language === 'zh-CN' ? '今天' : "Today"}
                                                 count={counts.today}/>
                                    <SidebarItem to="/next7days" filter="next7days" icon="calendar"
                                                 label={preferences.language === 'zh-CN' ? '未来7天' : "Next 7 Days"}
                                                 count={counts.next7days}/>
                                    <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox"
                                                 label={preferences.language === 'zh-CN' ? '收件箱' : "Inbox"}
                                                 count={counts.lists['Inbox']}/>
                                </nav>
                                <CollapsibleSection title={preferences.language === 'zh-CN' ? '我的列表' : "My Lists"}
                                                    action={
                                                        <Button variant="ghost" size="icon" icon="plus"
                                                                className="w-6 h-6 text-grey-medium dark:text-neutral-400 hover:text-primary dark:hover:text-primary-light hover:bg-grey-ultra-light dark:hover:bg-grey-deep"
                                                                iconProps={{size: 16, strokeWidth: 1.5}}
                                                                onClick={handleAddNewListClick}
                                                                aria-label="Add New List"/>
                                                    }>
                                    {myListsToDisplay.length === 0 ? (
                                        <p className="text-[12px] text-grey-medium dark:text-neutral-400 px-2 py-1 italic font-light">
                                            {preferences.language === 'zh-CN' ? '暂无自定义列表。' : 'No custom lists yet.'}
                                        </p>) : (myListsToDisplay.map(listName => (
                                        <SidebarItem key={listName} to={`/list/${encodeURIComponent(listName)}`}
                                                     filter={`list-${listName}`} icon="list" label={listName}
                                                     count={counts.lists[listName]} isUserList={true}/>)))}
                                </CollapsibleSection>
                                {tagsToDisplay.length > 0 && (
                                    <CollapsibleSection title={preferences.language === 'zh-CN' ? '标签' : "Tags"}
                                                        initiallyOpen={false}> {tagsToDisplay.map(tagName => (
                                        <SidebarItem key={tagName} to={`/tag/${encodeURIComponent(tagName)}`}
                                                     filter={`tag-${tagName}`} icon="tag" label={`#${tagName}`}
                                                     count={counts.tags[tagName]}/>))} </CollapsibleSection>)}
                                <CollapsibleSection title={preferences.language === 'zh-CN' ? '系统' : "System"}
                                                    initiallyOpen={false}>
                                    <SidebarItem to="/completed" filter="completed" icon="check-square"
                                                 label={preferences.language === 'zh-CN' ? '已完成' : "Completed"}
                                                 count={counts.completed}/>
                                    <SidebarItem to="/trash" filter="trash" icon="trash"
                                                 label={preferences.language === 'zh-CN' ? '垃圾桶' : "Trash"}
                                                 count={counts.trash}/>
                                </CollapsibleSection>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>
            <AddListModal onAdd={handleListAdded}/>
        </>
    );
};
Sidebar.displayName = 'Sidebar';
export default Sidebar;