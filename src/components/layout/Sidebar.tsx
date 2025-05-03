// src/components/layout/Sidebar.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    isAddListModalOpenAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    taskCountsAtom,
    userDefinedListsAtom,
    userListNamesAtom,
    userTagNamesAtom
} from '@/store/atoms';
import {Task, TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import Button from '../common/Button';
// Keep AddListModal import (it uses Radix Dialog now)
import AddListModal from '../common/AddListModal';
import {IconName} from "@/components/common/IconMap";
import Highlighter from "react-highlight-words";
import {AnimatePresence, motion} from 'framer-motion'; // Keep for search results transition

// Debounce Hook (keep as is)
function useDebounce<T>(value: T, delay: number): T { /* ... as before ... */
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

// Helper function for snippet generation (keep as is)
function generateContentSnippet(content: string, term: string, length: number = 35): string { /* ... as before ... */
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


// Sidebar Navigation Item Component (No Radix changes, pure layout/style)
const SidebarItem: React.FC<{
    to: string;
    filter: TaskFilter;
    icon: IconName;
    label: string;
    count?: number;
    isUserList?: boolean;
}> = memo(({to, filter, icon, label, count, isUserList = false}) => {
    const [currentActiveFilter,] = useAtom(currentFilterAtom);
    const navigate = useNavigate();
    const isActive = useMemo(() => currentActiveFilter === filter, [currentActiveFilter, filter]);
    const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        navigate(to);
    }, [navigate, to]);
    const linkClassName = useMemo(() => twMerge('flex items-center justify-between px-2 py-1 h-7 rounded-md mb-0.5 text-sm group transition-colors duration-30 ease-apple cursor-pointer', isActive ? 'bg-primary/20 text-primary font-medium backdrop-blur-sm' : 'text-gray-600 hover:bg-black/15 hover:text-gray-800 hover:backdrop-blur-sm', 'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-alt-100'), [isActive]);
    const countClassName = useMemo(() => twMerge("text-[10px] font-mono px-1 py-0 rounded-full ml-1 tabular-nums flex-shrink-0 backdrop-blur-sm", isActive ? 'text-primary bg-primary/25' : 'text-muted-foreground bg-black/10 group-hover:bg-black/15'), [isActive]);
    return (
        <Link to={to} onClick={handleClick} className={linkClassName} aria-current={isActive ? 'page' : undefined}>
            <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0 mr-1">
                <Icon name={icon} size={16} className="mr-1.5 flex-shrink-0 opacity-80" aria-hidden="true"/>
                <span className="truncate">{label}</span>
            </div>
            {(count !== undefined && count > 0) && (
                <span className={countClassName} aria-label={`${count} items`}> {count} </span>)}
            {isUserList && <div className="w-4 h-4 ml-1 flex-shrink-0"></div>}
        </Link>
    );
});
SidebarItem.displayName = 'SidebarItem';


// Collapsible Section Component (No Radix changes, uses Framer Motion)
const CollapsibleSection: React.FC<{
    title: string;
    children: React.ReactNode;
    icon?: IconName;
    initiallyOpen?: boolean;
    action?: React.ReactNode;
}> = memo(({title, icon, children, initiallyOpen = true, action}) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const sectionId = useMemo(() => `section-content-${title.replace(/\s+/g, '-')}`, [title]);
    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);
    const chevronClasses = useMemo(() => twMerge("transition-transform duration-200 ease-apple ml-auto opacity-60 group-hover:opacity-80", isOpen ? "rotate-180" : "rotate-0"), [isOpen]);
    return (
        <div className="mt-2 pt-2 border-t border-black/5 first:mt-0 first:pt-0 first:border-t-0">
            <div className="flex items-center justify-between px-2 py-0.5 mb-0.5">
                <button onClick={toggleOpen}
                        className="flex items-center flex-1 min-w-0 h-6 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-gray-700 focus:outline-none group rounded"
                        aria-expanded={isOpen} aria-controls={sectionId}>
                    {icon && <Icon name={icon} size={12} className="mr-1 opacity-70" aria-hidden="true"/>} <span
                    className="mr-1">{title}</span> <Icon name={'chevron-down'} size={14} className={chevronClasses}
                                                          aria-hidden="true"/>
                </button>
                {action && <div className="-mr-1 ml-1 flex-shrink-0">{action}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div id={sectionId} key="content" initial="collapsed" animate="open" exit="collapsed"
                                variants={{
                                    open: {opacity: 1, height: 'auto', marginTop: '0.125rem'},
                                    collapsed: {opacity: 0, height: 0, marginTop: 0}
                                }} transition={{duration: 0.2, ease: "easeOut"}} className="overflow-hidden">
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
CollapsibleSection.displayName = 'CollapsibleSection';


// Main Sidebar Component
const Sidebar: React.FC = () => {
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const userTags = useAtomValue(userTagNamesAtom);
    const searchResults = useAtomValue(rawSearchResultsAtom);
    const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setUserDefinedLists = useSetAtom(userDefinedListsAtom);
    // Use atom for AddListModal state (Radix Dialog controlled by this state)
    const [, setIsAddListModalOpen] = useAtom(isAddListModalOpenAtom);

    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 250);
    const isSearching = useMemo(() => debouncedSearchTerm.trim().length > 0, [debouncedSearchTerm]);

    // Add list handlers (logic remains the same)
    const handleAddNewListClick = useCallback(() => {
        setIsAddListModalOpen(true);
    }, [setIsAddListModalOpen]);
    const handleListAdded = useCallback((newListName: string) => { 
        const trimmedName = newListName.trim();
        if (!trimmedName) return;
        setUserDefinedLists((prevLists = []) => {
            const newListSet = new Set(prevLists);
            newListSet.add(trimmedName);
            return Array.from(newListSet).sort((a, b) => a.localeCompare(b));
        });
        navigate(`/list/${encodeURIComponent(trimmedName)}`); /* Modal closed internally or via state */
    }, [setUserDefinedLists, navigate]);

    // Search input handlers (logic remains the same)
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

    // Memoized data/styles (logic remains the same)
    const myListsToDisplay = useMemo(() => userLists.filter(list => list !== 'Inbox'), [userLists]);
    const tagsToDisplay = useMemo(() => userTags, [userTags]);
    const searchInputClassName = useMemo(() => twMerge("w-full h-7 pl-8 pr-7 text-sm bg-glass-inset-100 backdrop-blur-md border border-black/10 rounded-md focus:border-primary/30 focus:ring-1 focus:ring-primary/20 placeholder:text-muted text-gray-800 shadow-inner focus:bg-glass-inset-200 transition-colors duration-30 ease-apple"), []);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean),
        autoEscape: true,
    }), [debouncedSearchTerm]);
    const searchResultButtonClassName = "flex items-start w-full px-2 py-1.5 text-left rounded-md hover:bg-black/15 hover:backdrop-blur-sm text-sm group transition-colors duration-100 ease-apple focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-alt-100";

    return (
        <>
            <aside
                className="w-56 bg-glass-alt-100 backdrop-blur-xl border-r border-black/10 h-full flex flex-col shrink-0 z-10 pt-3 pb-2 shadow-strong">
                {/* Search Input Area */}
                <div className="px-2.5 mb-2 flex-shrink-0">
                    <div className="relative flex items-center">
                        <label htmlFor="sidebar-search" className="sr-only">Search Tasks</label>
                        <Icon name="search" size={15}
                              className="absolute left-2.5 text-muted pointer-events-none opacity-70 z-10"/>
                        <input ref={searchInputRef} id="sidebar-search" type="search" placeholder="Search"
                               value={searchTerm} onChange={handleSearchChange} className={searchInputClassName}
                               aria-label="Search tasks"/>
                        {/* Use Framer Motion for clear button animation */}
                        <AnimatePresence>
                            {searchTerm && (
                                <motion.div key="clear-search-btn" initial={{scale: 0.7, opacity: 0}}
                                            animate={{scale: 1, opacity: 1}} exit={{scale: 0.7, opacity: 0}}
                                            transition={{duration: 0.1}}
                                            className="absolute right-1 h-full flex items-center z-10">
                                    <Button variant="ghost" size="icon" icon="x-circle" onClick={handleClearSearch}
                                            className="w-5 h-5 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-black/10"
                                            aria-label="Clear search"/>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Scrollable Filters/Search Results Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar">
                    {/* Use Framer Motion for switching between filters and search */}
                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            <motion.div key="search-results" initial={{opacity: 0}} animate={{opacity: 1}}
                                        exit={{opacity: 0}} transition={{duration: 0.1, ease: 'linear'}}
                                        className="px-1.5 pb-2">
                                {searchResults.length > 0 ? (
                                    <>
                                        <p className="text-xs font-medium text-muted px-1 py-1">{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</p>
                                        {searchResults.map((task: Task) => (
                                            <button key={task.id} onClick={() => handleSearchResultClick(task)}
                                                    className={searchResultButtonClassName}
                                                    aria-label={`Search result: ${task.title || 'Untitled Task'}`}>
                                                <Icon
                                                    name={task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list')}
                                                    size={15}
                                                    className="mr-2 mt-[2px] flex-shrink-0 text-muted opacity-70"
                                                    aria-hidden="true"/>
                                                <div className="flex-1 overflow-hidden">
                                                    <Highlighter {...highlighterProps}
                                                                 textToHighlight={task.title || 'Untitled Task'}
                                                                 className={twMerge("block truncate text-gray-800", task.completed && task.list !== 'Trash' && "line-through text-muted", task.list === 'Trash' && "italic text-muted")}/>
                                                    {task.content && generateContentSnippet(task.content, debouncedSearchTerm) && (
                                                        <Highlighter {...highlighterProps}
                                                                     textToHighlight={generateContentSnippet(task.content, debouncedSearchTerm)}
                                                                     className="block truncate text-xs text-muted mt-0.5"/>)}
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                ) : (<p className="text-xs text-muted text-center py-4 px-2 italic">No tasks found
                                    matching "{debouncedSearchTerm}".</p>)}
                            </motion.div>
                        ) : (
                            <motion.div key="filters" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                                        transition={{duration: 0.1, ease: 'linear'}} className="px-1.5 pb-2">
                                <nav className="mb-1">
                                    <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks"
                                                 count={counts.all}/>
                                    <SidebarItem to="/today" filter="today" icon="sun" label="Today"
                                                 count={counts.today}/>
                                    <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days"
                                                 count={counts.next7days}/>
                                    <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox" label="Inbox"
                                                 count={counts.lists['Inbox']}/>
                                </nav>
                                <CollapsibleSection title="My Lists" icon="folder"
                                                    action={<Button variant="ghost" size="icon" icon="folder-plus"
                                                                    className="w-6 h-6 text-muted-foreground hover:text-primary hover:bg-black/15"
                                                                    onClick={handleAddNewListClick}
                                                                    aria-label="Add New List"/>}>
                                    {myListsToDisplay.length === 0 ? (
                                        <p className="text-xs text-muted px-2 py-1 italic">No custom lists
                                            yet.</p>) : (myListsToDisplay.map(listName => (
                                        <SidebarItem key={listName} to={`/list/${encodeURIComponent(listName)}`}
                                                     filter={`list-${listName}`} icon="list" label={listName}
                                                     count={counts.lists[listName]} isUserList={true}/>)))}
                                </CollapsibleSection>
                                {tagsToDisplay.length > 0 && (<CollapsibleSection title="Tags" icon="tag"
                                                                                  initiallyOpen={false}> {tagsToDisplay.map(tagName => (
                                    <SidebarItem key={tagName} to={`/tag/${encodeURIComponent(tagName)}`}
                                                 filter={`tag-${tagName}`} icon="tag" label={`#${tagName}`}
                                                 count={counts.tags[tagName]}/>))} </CollapsibleSection>)}
                                <CollapsibleSection title="System" initiallyOpen={false}>
                                    <SidebarItem to="/completed" filter="completed" icon="check-square"
                                                 label="Completed" count={counts.completed}/>
                                    <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash"
                                                 count={counts.trash}/>
                                </CollapsibleSection>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>
            {/* Add List Modal (Radix Dialog) */}
            {/* Render based on state, Radix handles the rest */}
            <AddListModal onAdd={handleListAdded}/>
        </>
    );
};
Sidebar.displayName = 'Sidebar';
export default Sidebar;