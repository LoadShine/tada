import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Icon from '@/components/ui/Icon.tsx';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    isAddListModalOpenAtom,
    preferencesSettingsAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    taskCountsAtom,
    tasksAtom,
    userListsAtom,
    userTagNamesAtom
} from '@/store/jotai.ts';
import {List, Task, TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import Button from '@/components/ui/Button.tsx';
import {IconName} from "@/components/ui/IconMap.ts";
import Highlighter from "react-highlight-words";
import {AnimatePresence, motion} from 'framer-motion';
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import storageManager from '@/services/storageManager.ts';
import {RESET} from "jotai/utils";
import {useTranslation} from "react-i18next";
import AddListModal from "@/components/features/layout/AddListModal.tsx";
import ConfirmDeleteModalRadix from "@/components/ui/ConfirmDeleteModal.tsx";

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
        'flex items-center justify-between px-2 py-0 h-8 rounded-base mb-0.5 text-[13px] group transition-colors duration-200 ease-in-out cursor-pointer relative w-full',
        isActive
            ? 'bg-black/5 text-primary dark:bg-primary-dark/20 dark:text-primary-light font-medium'
            : 'text-grey-dark dark:text-neutral-200 font-light hover:bg-black/5 dark:hover:bg-white/5 hover:text-grey-dark dark:hover:text-neutral-100',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep'
    ), [isActive]);

    const countClassName = useMemo(() => twMerge(
        "text-[10px] font-light px-1 py-0 rounded-sm ml-1 tabular-nums flex-shrink-0",
        isActive
            ? 'text-primary bg-primary/20 dark:text-primary-light dark:bg-primary-light/10'
            : 'text-grey-medium dark:text-neutral-400 bg-black/5 dark:bg-white/5'
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
    const {t} = useTranslation();
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListsAtom);
    const userTags = useAtomValue(userTagNamesAtom);
    const searchResults = useAtomValue(rawSearchResultsAtom);
    const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setListsAtom = useSetAtom(userListsAtom);
    const setTasksAtom = useSetAtom(tasksAtom);
    const [isAddListModalOpen, setIsAddListModalOpen] = useAtom(isAddListModalOpenAtom);
    const [currentFilter, setCurrentFilter] = useAtom(currentFilterAtom);

    const preferences = useAtomValue(preferencesSettingsAtom);

    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listEditInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 250);
    const isSearching = useMemo(() => debouncedSearchTerm.trim().length > 0, [debouncedSearchTerm]);

    const [editingListId, setEditingListId] = useState<string | null>(null);
    const [editingListName, setEditingListName] = useState('');
    const [listToDelete, setListToDelete] = useState<List | null>(null);

    useEffect(() => {
        if (editingListId && listEditInputRef.current) {
            // Use setTimeout to ensure the input is rendered and ready for focus.
            setTimeout(() => {
                listEditInputRef.current?.focus();
                listEditInputRef.current?.select();
            }, 0);
        }
    }, [editingListId]);

    const handleAddNewListClick = useCallback(() => {
        setIsAddListModalOpen(true);
    }, [setIsAddListModalOpen]);

    const handleListAdded = useCallback(() => {
        setIsAddListModalOpen(false);
        setListsAtom(RESET); // Resync with storage
    }, [setListsAtom, setIsAddListModalOpen]);

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

    const handleStartRename = useCallback((list: List) => {
        setEditingListId(list.id);
        setEditingListName(list.name);
    }, []);

    const handleCancelRename = useCallback(() => {
        setEditingListId(null);
        setEditingListName('');
    }, []);

    const handleSaveRename = useCallback(() => {
        if (!editingListId) return;
        const service = storageManager.get();
        const originalList = userLists?.find(l => l.id === editingListId);
        const trimmedName = editingListName.trim();

        if (!originalList || !trimmedName || trimmedName === originalList.name) {
            handleCancelRename();
            return;
        }

        try {
            service.updateList(editingListId, {name: trimmedName});
            if (currentFilter === `list-${encodeURIComponent(originalList.name)}`) {
                navigate(`/list/${encodeURIComponent(trimmedName)}`);
            }
            setListsAtom(RESET);
            setTasksAtom(RESET);
        } catch (e: any) {
            alert(`Error renaming list: ${e.message}`);
        } finally {
            handleCancelRename();
        }
    }, [editingListId, editingListName, userLists, currentFilter, navigate, setListsAtom, setTasksAtom, handleCancelRename]);

    const handleRenameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveRename();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelRename();
        }
    };

    const handleConfirmDelete = useCallback(() => {
        if (!listToDelete) return;
        const service = storageManager.get();
        if (listToDelete.name === 'Inbox') {
            alert("The 'Inbox' list cannot be deleted.");
            setListToDelete(null);
            return;
        }

        try {
            service.deleteList(listToDelete.id);
            if (currentFilter === `list-${encodeURIComponent(listToDelete.name)}`) {
                navigate('/all');
            }
            setListsAtom(RESET);
            setTasksAtom(RESET);
        } catch (e: any) {
            alert(`Error deleting list: ${e.message}`);
        } finally {
            setListToDelete(null);
        }
    }, [listToDelete, currentFilter, navigate, setListsAtom, setTasksAtom]);

    const myListsToDisplay = useMemo(() => userLists?.filter(list => list.name !== 'Inbox') ?? [], [userLists]);
    const inboxList = useMemo(() => userLists?.find(list => list.name === 'Inbox'), [userLists]);
    const tagsToDisplay = useMemo(() => userTags, [userTags]);

    const searchInputClassName = useMemo(() => twMerge(
        "w-full h-[32px] pl-8 pr-7 text-[13px] font-light rounded-base focus:outline-none",
        "bg-black/5 dark:bg-white/5",
        "border border-black/5 dark:border-white/5",
        "focus:border-primary/50 dark:focus:border-primary-light/50",
        "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
        "text-grey-dark dark:text-neutral-100",
        "transition-colors duration-200 ease-in-out"
    ), []);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0 dark:bg-primary-dark/30 dark:text-primary-light",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean), autoEscape: true,
    }), [debouncedSearchTerm]);

    const searchResultButtonClassName = "flex items-start w-full px-2 py-1.5 text-left rounded-base hover:bg-black/5 dark:hover:bg-white/5 text-[13px] group transition-colors duration-100 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary";

    const dropdownContentClasses = "z-[60] min-w-[120px] p-1 bg-white rounded-base shadow-modal dark:bg-neutral-800 dark:border dark:border-neutral-700 data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide";
    const dropdownItemClasses = "relative flex cursor-pointer select-none items-center rounded-base px-2.5 py-1.5 text-[12px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-7 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light dark:focus:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700 text-grey-dark data-[highlighted]:text-grey-dark dark:text-neutral-200 dark:data-[highlighted]:text-neutral-100";

    if (!preferences) {
        return (
            <aside className="w-full h-full flex flex-col shrink-0 z-10 pt-2.5 pb-2 px-2 bg-transparent items-center justify-center">
                <Icon name="loader" size={20} className="text-primary animate-spin"/>
            </aside>
        );
    }

    return (
        <>
            <aside className="w-full h-full flex flex-col shrink-0 z-10 pt-2.5 pb-2 px-2 bg-transparent">
                <div className="mb-3 flex-shrink-0">
                    <div className="relative flex items-center">
                        <label htmlFor="sidebar-search" className="sr-only">Search Tasks</label>
                        <Icon name="search" size={12} strokeWidth={1.5}
                              className="absolute left-3 text-grey-medium dark:text-neutral-400 pointer-events-none z-10"/>
                        <input ref={searchInputRef} id="sidebar-search" type="search"
                               placeholder={t('sidebar.searchPlaceholder')}
                               value={searchTerm} onChange={handleSearchChange} className={searchInputClassName}
                               aria-label="Search tasks"/>
                        <AnimatePresence>
                            {searchTerm && (
                                <motion.div key="clear-search-btn" initial={{scale: 0.7, opacity: 0}}
                                            animate={{scale: 1, opacity: 1}} exit={{scale: 0.7, opacity: 0}}
                                            transition={{duration: 0.1}}
                                            className="absolute right-1.5 h-full flex items-center z-10">
                                    <Button variant="ghost" size="icon" icon="x-circle" onClick={handleClearSearch}
                                            className="w-5 h-5 text-grey-medium dark:text-neutral-400 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
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
                                        <p className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 px-1.5 py-1">{t('sidebar.searchResults', {count: searchResults.length})}</p>
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
                                                                 textToHighlight={task.title || t('common.untitledTask')}
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
                                        {t('sidebar.noSearchResults', {searchTerm: debouncedSearchTerm})}
                                    </p>)}
                            </motion.div>
                        ) : (
                            <motion.div key="filters" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                                        transition={{duration: 0.15, ease: 'linear'}} className="px-0.5 pb-2">
                                <nav className="mb-1">
                                    <SidebarItem to="/all" filter="all" icon="archive"
                                                 label={t('sidebar.allTasks')}
                                                 count={counts.all}/>
                                    <SidebarItem to="/today" filter="today" icon="sun"
                                                 label={t('sidebar.today')}
                                                 count={counts.today}/>
                                    <SidebarItem to="/next7days" filter="next7days" icon="calendar"
                                                 label={t('sidebar.next7days')}
                                                 count={counts.next7days}/>
                                    {inboxList && <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox"
                                                               label={t('sidebar.inbox')}
                                                               count={counts.lists['Inbox']}/>}
                                </nav>
                                <CollapsibleSection title={t('sidebar.myLists')}
                                                    action={
                                                        <Button variant="ghost" size="icon" icon="plus"
                                                                className="w-6 h-6 text-grey-medium dark:text-neutral-400 hover:text-primary dark:hover:text-primary-light hover:bg-black/5 dark:hover:bg-white/5"
                                                                iconProps={{size: 16, strokeWidth: 1.5}}
                                                                onClick={handleAddNewListClick}
                                                                aria-label={t('sidebar.addNewList')}/>
                                                    }>
                                    {myListsToDisplay.length === 0 ? (
                                        <p className="text-[12px] text-grey-medium dark:text-neutral-400 px-2 py-1 italic font-light">
                                            {t('sidebar.noCustomLists')}
                                        </p>) : (myListsToDisplay.map(list => {
                                        const isEditing = editingListId === list.id;
                                        return (
                                            <div key={list.id}
                                                 className="group/listitem relative pr-7 flex items-center h-8 mb-0.5">
                                                {isEditing ? (
                                                    <div
                                                        className="flex items-center w-full px-2 py-0 h-full rounded-base bg-black/5 dark:bg-white/10">
                                                        <Icon name={(list.icon as IconName) || 'list'} size={16}
                                                              strokeWidth={1}
                                                              className="mr-2 flex-shrink-0 opacity-90 text-primary dark:text-primary-light"/>
                                                        <input
                                                            ref={listEditInputRef}
                                                            type="text"
                                                            value={editingListName}
                                                            onChange={(e) => setEditingListName(e.target.value)}
                                                            onBlur={handleSaveRename}
                                                            onKeyDown={handleRenameInputKeyDown}
                                                            className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-primary dark:text-primary-light focus:outline-none p-0 h-full"
                                                        />
                                                    </div>
                                                ) : (
                                                    <SidebarItem to={`/list/${encodeURIComponent(list.name)}`}
                                                                 filter={`list-${list.name}`}
                                                                 icon={(list.icon as IconName) || 'list'}
                                                                 label={list.name}
                                                                 count={counts.lists[list.name]} isUserList={true}/>
                                                )}
                                                <div
                                                    className={twMerge(
                                                        "absolute top-0 right-0 h-full flex items-center transition-opacity",
                                                        isEditing ? "opacity-0" : "opacity-0 group-hover/listitem:opacity-100"
                                                    )}>
                                                    <DropdownMenu.Root>
                                                        <DropdownMenu.Trigger asChild>
                                                            <Button variant="ghost" size="icon"
                                                                    icon="more-horizontal"
                                                                    className="w-6 h-6 text-grey-medium dark:text-neutral-400 focus-visible:ring-0"
                                                                    aria-label={`Actions for ${list.name}`}/>
                                                        </DropdownMenu.Trigger>
                                                        <DropdownMenu.Portal>
                                                            <DropdownMenu.Content
                                                                className={dropdownContentClasses}
                                                                side="right" align="start"
                                                                sideOffset={8}
                                                                onCloseAutoFocus={(e) => e.preventDefault()}
                                                            >
                                                                <DropdownMenu.Item className={dropdownItemClasses}
                                                                                   onSelect={() => handleStartRename(list)}>
                                                                    <Icon name="edit" size={14}
                                                                          className="mr-2 opacity-80"
                                                                          strokeWidth={1.5}/> Rename
                                                                </DropdownMenu.Item>
                                                                <DropdownMenu.Item
                                                                    className={twMerge(dropdownItemClasses, "text-error dark:text-red-400 data-[highlighted]:bg-red-500/10 dark:data-[highlighted]:bg-red-500/20")}
                                                                    onSelect={() => setTimeout(() => setListToDelete(list), 0)}>
                                                                    <Icon name="trash" size={14}
                                                                          className="mr-2 opacity-80"
                                                                          strokeWidth={1.5}/> Delete
                                                                </DropdownMenu.Item>
                                                            </DropdownMenu.Content>
                                                        </DropdownMenu.Portal>
                                                    </DropdownMenu.Root>
                                                </div>
                                            </div>
                                        );
                                    }))}
                                </CollapsibleSection>
                                {tagsToDisplay.length > 0 && (
                                    <CollapsibleSection title={t('sidebar.tags')}
                                                        initiallyOpen={false}> {tagsToDisplay.map(tagName => (
                                        <SidebarItem key={tagName} to={`/tag/${encodeURIComponent(tagName)}`}
                                                     filter={`tag-${tagName}`} icon="tag" label={`#${tagName}`}
                                                     count={counts.tags[tagName]}/>))} </CollapsibleSection>)}
                                <CollapsibleSection title={t('sidebar.system')}
                                                    initiallyOpen={false}>
                                    <SidebarItem to="/completed" filter="completed" icon="check-square"
                                                 label={t('sidebar.completed')}
                                                 count={counts.completed}/>
                                    <SidebarItem to="/trash" filter="trash" icon="trash"
                                                 label={t('sidebar.trash')}
                                                 count={counts.trash}/>
                                </CollapsibleSection>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>
            <AddListModal onAddSuccess={handleListAdded}/>
            {listToDelete && (
                <ConfirmDeleteModalRadix
                    isOpen={!!listToDelete}
                    onClose={() => setListToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    itemTitle={listToDelete.name}
                    title={t('confirmDeleteModal.list.title')}
                    description={t('confirmDeleteModal.list.description', {itemTitle: listToDelete.name})}
                    confirmText={t('confirmDeleteModal.list.confirmText')}
                    confirmVariant="danger"
                />
            )}
        </>
    );
};
Sidebar.displayName = 'Sidebar';
export default Sidebar;