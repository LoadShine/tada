// src/components/layout/Sidebar.tsx (Corrected Accordion Trigger)
import React, {memo, useCallback, useMemo, useRef} from 'react';
import {NavLink, useNavigate} from 'react-router-dom';
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
import {cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';
import AddListDialog from '../common/AddListDialog'; // Use the new Dialog component
import {IconName} from "@/components/common/IconMap";
import Highlighter from "react-highlight-words";
import {AnimatePresence, motion} from 'framer-motion';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area'; // Use shadcn ScrollArea
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger,} from "@/components/ui/accordion"; // Use shadcn Accordion
import {Badge} from '@/components/ui/badge'; // Use Badge for counts
import useDebounce from '@/hooks/useDebounce';

// Sidebar Navigation Item Component (Keep as previously corrected)
const SidebarItem: React.FC<{
    to: string; filter: TaskFilter; icon: IconName; label: string; count?: number; isUserList?: boolean;
}> = memo(({to, filter, icon, label, count}) => {
    const [currentActiveFilter] = useAtom(currentFilterAtom);
    const isActive = useMemo(() => currentActiveFilter === filter, [currentActiveFilter, filter]);
    const linkClassName = ({isActive: navIsActive}: {
        isActive: boolean,
        isPending: boolean
    }): string => cn('flex items-center justify-between px-2 py-1 h-7 rounded-md text-sm group transition-colors duration-150 ease-in-out cursor-pointer w-full', (isActive || navIsActive) ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background');
    const countClassName = cn("text-[10px] font-mono px-1.5 py-[1px] rounded-full ml-1 tabular-nums flex-shrink-0 transition-colors duration-150 ease-in-out", isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-accent');
    return (<NavLink to={to} className={linkClassName} aria-current={isActive ? 'page' : undefined}>
        <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0 mr-1"><Icon
            name={icon} size={15} className="mr-2 flex-shrink-0 opacity-70" aria-hidden="true"/> <span
            className="truncate">{label}</span></div>
        {(count !== undefined && count > 0) && (
            <Badge variant="secondary" className={countClassName} aria-label={`${count} items`}>{count}</Badge>)}
    </NavLink>);
});
SidebarItem.displayName = 'SidebarItem';

// Main Sidebar Component (Corrected Accordion Trigger Structure)
const Sidebar: React.FC = () => {
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const userTags = useAtomValue(userTagNamesAtom);
    const searchResults = useAtomValue(rawSearchResultsAtom);
    const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setUserDefinedLists = useSetAtom(userDefinedListsAtom);
    const [, setIsModalOpen] = useAtom(isAddListModalOpenAtom);

    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 250);

    const isSearching = useMemo(() => debouncedSearchTerm.trim().length > 0, [debouncedSearchTerm]);

    const handleAddNewListClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle when clicking the add button
        setIsModalOpen(true);
    }, [setIsModalOpen]);

    const handleListAdded = useCallback((newListName: string) => {
        const trimmedName = newListName.trim();
        if (!trimmedName) return;
        setUserDefinedLists((prevLists = []) => {
            const newListSet = new Set(prevLists);
            newListSet.add(trimmedName);
            return Array.from(newListSet).sort((a, b) => a.localeCompare(b));
        });
        navigate(`/list/${encodeURIComponent(trimmedName)}`);
    }, [setUserDefinedLists, navigate]);

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

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary/20 text-primary font-semibold rounded-[2px] px-0.5 mx-[-0.5px]",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean),
        autoEscape: true,
    }), [debouncedSearchTerm]);

    const searchResultButtonClassName = "flex items-start w-full px-2 py-1.5 text-left rounded-md hover:bg-accent text-sm group transition-colors duration-100 ease-apple focus:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    const generateContentSnippet = (content: string, term: string, length: number = 35): string => {
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
        if (firstMatchIndex === -1) return content.substring(0, length) + (content.length > length ? '...' : '');
        const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
        const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        return snippet;
    }

    return (
        <>
            <aside className="w-full h-full flex flex-col pt-3 pb-2">
                {/* Search Input Area */}
                <div className="px-3 mb-2 flex-shrink-0">
                    <div className="relative flex items-center">
                        <Icon name="search" size={15}
                              className="absolute left-2.5 text-muted-foreground pointer-events-none z-10"/>
                        <Input ref={searchInputRef} id="sidebar-search" type="search" placeholder="Search tasks..."
                               value={searchTerm} onChange={handleSearchChange}
                               className="h-8 pl-8 pr-7 text-sm bg-glass-inset-100 border-border/30 focus:bg-glass-inset-200 focus:border-primary/50"
                               aria-label="Search tasks"/>
                        <AnimatePresence> {searchTerm && (
                            <motion.div key="clear-search-btn" initial={{scale: 0.7, opacity: 0}}
                                        animate={{scale: 1, opacity: 1}} exit={{scale: 0.7, opacity: 0}}
                                        transition={{duration: 0.1}}
                                        className="absolute right-1 h-full flex items-center z-10"><Button
                                variant="ghost" size="icon" icon="x-circle" onClick={handleClearSearch}
                                className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-accent"
                                aria-label="Clear search"/></motion.div>)} </AnimatePresence>
                    </div>
                </div>

                {/* Scrollable Filters/Search Results Area */}
                <ScrollArea className="flex-1 px-1.5">
                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            // Search Results View
                            <motion.div key="search-results" initial={{opacity: 0, y: -5}} animate={{opacity: 1, y: 0}}
                                        exit={{opacity: 0, y: 5}} transition={{duration: 0.15, ease: 'linear'}}
                                        className="pb-2">
                                {searchResults.length > 0 ? (<> <p
                                        className="text-xs font-medium text-muted-foreground px-1 py-1.5">{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</p> {searchResults.map((task: Task) => (
                                        <button key={task.id} onClick={() => handleSearchResultClick(task)}
                                                className={searchResultButtonClassName}
                                                aria-label={`Search result: ${task.title || 'Untitled Task'}`}><Icon
                                            name={task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list')}
                                            size={15}
                                            className="mr-2 mt-[2px] flex-shrink-0 text-muted-foreground opacity-70"
                                            aria-hidden="true"/>
                                            <div className="flex-1 overflow-hidden"><Highlighter {...highlighterProps}
                                                                                                 textToHighlight={task.title || 'Untitled Task'}
                                                                                                 className={cn("block truncate text-sm text-foreground", task.completed && task.list !== 'Trash' && "line-through text-muted-foreground", task.list === 'Trash' && "italic text-muted-foreground")}/> {task.content && generateContentSnippet(task.content, debouncedSearchTerm) && (
                                                <Highlighter {...highlighterProps}
                                                             textToHighlight={generateContentSnippet(task.content, debouncedSearchTerm)}
                                                             className="block truncate text-xs text-muted-foreground mt-0.5"/>)}
                                            </div>
                                        </button>))} </>)
                                    : (<p className="text-xs text-muted-foreground text-center py-6 px-2 italic">No
                                        tasks found for "{debouncedSearchTerm}".</p>)}
                            </motion.div>
                        ) : (
                            // Standard Filter Navigation View
                            <motion.div key="filters" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                                        transition={{duration: 0.15, ease: 'linear'}} className="pb-2 space-y-1">
                                <nav className="space-y-0.5">
                                    <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks"
                                                 count={counts.all}/>
                                    <SidebarItem to="/today" filter="today" icon="sun" label="Today"
                                                 count={counts.today}/>
                                    <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days"
                                                 count={counts.next7days}/>
                                    <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox" label="Inbox"
                                                 count={counts.lists['Inbox']}/>
                                </nav>

                                {/* Use Accordion for Lists and Tags */}
                                <Accordion type="multiple" defaultValue={['my-lists']} className="w-full">
                                    <AccordionItem value="my-lists" className="border-b-0">
                                        {/* *** Corrected Structure: div wraps Trigger and Button *** */}
                                        <div className="flex items-center justify-between pr-2 group">
                                            <AccordionTrigger
                                                className="py-1.5 text-xs text-muted-foreground hover:text-foreground hover:no-underline flex-1 justify-start px-2 [&>svg]:ml-auto">
                                                {/* Content of the trigger button itself */}
                                                <div className="flex items-center flex-1">
                                                    <Icon name="folder" size={14} className="mr-1.5 opacity-70"/>
                                                    <span className="flex-1 text-left">My Lists</span>
                                                </div>
                                                {/* Chevron is automatically added by AccordionTrigger */}
                                            </AccordionTrigger>
                                            {/* Action Button is now a SIBLING of the trigger */}
                                            <Button variant="ghost" size="icon" icon="folder-plus"
                                                    className="w-6 h-6 text-muted-foreground hover:text-primary hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={handleAddNewListClick} aria-label="Add New List"/>
                                        </div>
                                        <AccordionContent
                                            className="pt-1 pb-0 pl-2"> {/* Add padding-left to content */}
                                            <div className="space-y-0.5">
                                                {myListsToDisplay.length === 0
                                                    ? (<p className="text-xs text-muted-foreground px-2 py-1 italic">No
                                                        custom lists yet.</p>)
                                                    : (myListsToDisplay.map(listName => (<SidebarItem key={listName}
                                                                                                      to={`/list/${encodeURIComponent(listName)}`}
                                                                                                      filter={`list-${listName}`}
                                                                                                      icon="list"
                                                                                                      label={listName}
                                                                                                      count={counts.lists[listName]}
                                                                                                      isUserList={true}/>)))
                                                }
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                    {tagsToDisplay.length > 0 && (
                                        <AccordionItem value="tags" className="border-b-0">
                                            {/* Keep simple trigger for tags */}
                                            <AccordionTrigger
                                                className="py-1.5 text-xs text-muted-foreground hover:text-foreground hover:no-underline justify-start px-2">
                                                <Icon name="tag" size={14} className="mr-1.5 opacity-70"/>
                                                <span className="flex-1 text-left">Tags</span>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-1 pb-0 pl-2">
                                                <div className="space-y-0.5">
                                                    {tagsToDisplay.map(tagName => (<SidebarItem key={tagName}
                                                                                                to={`/tag/${encodeURIComponent(tagName)}`}
                                                                                                filter={`tag-${tagName}`}
                                                                                                icon="tag"
                                                                                                label={`${tagName}`}
                                                                                                count={counts.tags[tagName]}/>))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )}

                                    <AccordionItem value="system" className="border-b-0">
                                        {/* Keep simple trigger for system */}
                                        <AccordionTrigger
                                            className="py-1.5 text-xs text-muted-foreground hover:text-foreground hover:no-underline justify-start px-2">
                                            <Icon name="settings" size={14} className="mr-1.5 opacity-70"/>
                                            <span className="flex-1 text-left">System</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-0 pl-2">
                                            <div className="space-y-0.5">
                                                <SidebarItem to="/completed" filter="completed" icon="check-square"
                                                             label="Completed" count={counts.completed}/>
                                                <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash"
                                                             count={counts.trash}/>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                </Accordion>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </ScrollArea>
            </aside>
            {/* Add List Dialog */}
            <AddListDialog onAdd={handleListAdded}/>
        </>
    );
};
Sidebar.displayName = 'Sidebar';
export default Sidebar;