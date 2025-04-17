// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAtom, useAtomValue } from 'jotai';
import {
    currentFilterAtom,
    isAddListModalOpenAtom,
    taskCountsAtom,
    userDefinedListsAtom, // Use this for creating new lists
    userListNamesAtom, // Use this for displaying lists (includes Inbox)
    userTagNamesAtom
} from '@/store/atoms';
import { TaskFilter } from '@/types';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../common/Button';
import AddListModal from '../common/AddListModal';
import {IconName} from "@/components/common/IconMap.tsx"; // Import the modal

interface SidebarItemProps {
    to: string;
    filter: TaskFilter;
    icon: IconName;
    label: string;
    count?: number;
    exact?: boolean; // To control NavLink active matching
    isUserList?: boolean; // Flag for user lists for potential styling/actions
}

// 添加 NavLinkRenderProps 类型定义（如果尚未定义）
interface NavLinkRenderProps {
    isActive: boolean;
    isPending: boolean;
}

// Sidebar Navigation Item Component
const SidebarItem: React.FC<SidebarItemProps> = ({
                                                     to,
                                                     filter,
                                                     icon,
                                                     label,
                                                     count,
                                                     exact = false,
                                                     isUserList = false // Keep for potential future use (e.g., edit/delete on hover)
                                                 }) => {
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const navigate = useNavigate();

    // Handle click: update filter atom and navigate programmatically
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault(); // Prevent default NavLink behavior
        setCurrentFilter(filter); // Update the central filter state
        navigate(to); // Navigate to the corresponding route
    };

    return (
        <NavLink
            to={to}
            end={exact}
            className={({ isActive }: NavLinkRenderProps) =>
                twMerge(
                    'flex items-center justify-between px-2 py-1 h-7 rounded-md mb-0.5 text-sm group transition-colors duration-100 ease-apple',
                    isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-800'
                )
            }
            onClick={handleClick}
            {...(({ isActive }: NavLinkRenderProps) => isActive ? { 'aria-current': 'page' } : {})}
        >
            {/* Use a render prop to potentially animate content based on active state */}
            {({ isActive }) => (
                <>
                    {/* Label and Icon */}
                    <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0 mr-1">
                        <Icon name={icon} size={16} className="mr-1.5 flex-shrink-0 opacity-80" aria-hidden="true" />
                        <span className="truncate">{label}</span>
                    </div>

                    {/* Count Indicator - Animate presence */}
                    <AnimatePresence>
                        {(count !== undefined && count > 0) && (
                            <motion.span
                                className={twMerge(
                                    "text-[10px] font-mono px-1 py-0 rounded-full ml-1 tabular-nums flex-shrink-0", // Adjusted vertical padding
                                    isActive
                                        ? 'text-primary bg-primary/15'
                                        : 'text-muted-foreground bg-gray-100 group-hover:bg-gray-200'
                                )}
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.7, opacity: 0 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                aria-label={`${count} items`}
                            >
                                {count}
                            </motion.span>
                        )}
                    </AnimatePresence>

                    {/* Placeholder for potential actions (e.g., edit icon on hover for user lists) */}
                    {isUserList && <div className="w-4 h-4 ml-1 flex-shrink-0"></div>}
                </>
            )}
        </NavLink>
    );
};


interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    icon?: IconName; // Optional icon for the header
    initiallyOpen?: boolean;
    action?: React.ReactNode; // Optional action button (e.g., Add List)
}

// Collapsible Section Component
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
                                                                   title,
                                                                   icon,
                                                                   children,
                                                                   initiallyOpen = true,
                                                                   action
                                                               }) => {
    const [isOpen, setIsOpen] = React.useState(initiallyOpen);

    return (
        // Add spacing and border separation
        <div className="mt-2 pt-2 border-t border-border-color/60 first:mt-0 first:pt-0 first:border-t-0">
            {/* Section Header: Title, Toggle, Action */}
            <div className="flex items-center justify-between px-2 py-0.5 mb-0.5">
                {/* Clickable area to toggle */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center flex-1 min-w-0 h-6 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-gray-700 focus:outline-none group"
                    aria-expanded={isOpen}
                    aria-controls={`section-content-${title.replace(/\s+/g, '-')}`} // Accessibility
                >
                    {/* Optional Icon */}
                    {icon && <Icon name={icon} size={12} className="mr-1 opacity-70" aria-hidden="true"/>}
                    {/* Title */}
                    <span className="mr-1">{title}</span>
                    {/* Chevron Indicator */}
                    <Icon
                        name={'chevron-down'}
                        size={14}
                        className={twMerge(
                            "transition-transform duration-200 ease-apple ml-auto opacity-60 group-hover:opacity-80", // Animate rotation, adjust position
                            isOpen ? "rotate-180" : "rotate-0"
                        )}
                        aria-hidden="true"
                    />
                </button>
                {/* Action Button (e.g., Add List) */}
                {action && <div className="-mr-1 ml-1 flex-shrink-0">{action}</div>}
            </div>
            {/* Collapsible Content */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={`section-content-${title.replace(/\s+/g, '-')}`} // Match aria-controls
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: { opacity: 1, height: 'auto', marginTop: '2px' }, // Add slight margin when open
                            collapsed: { opacity: 0, height: 0, marginTop: '0px' },
                        }}
                        transition={{ duration: 0.2, ease: 'easeOut' }} // Faster, standard ease
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Main Sidebar Component
const Sidebar: React.FC = () => {
    // Use useAtomValue for read-only atoms
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListNamesAtom); // Includes 'Inbox' and user-defined lists
    const userTags = useAtomValue(userTagNamesAtom);

    // Use useAtom for atoms that need updating
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const [, setUserDefinedLists] = useAtom(userDefinedListsAtom);
    const [isModalOpen, setIsModalOpen] = useAtom(isAddListModalOpenAtom);

    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleAddNewListClick = () => {
        setIsModalOpen(true); // Open the modal
    };

    // Callback for when a new list is successfully added via the modal
    const handleListAdded = (newListName: string) => {
        // Update the source of truth for user-defined lists
        setUserDefinedLists((prevLists) => [...prevLists, newListName].sort((a,b) => a.localeCompare(b))); // Add and keep sorted
        // Immediately navigate to the new list
        const newListFilter: TaskFilter = `list-${newListName}`;
        setCurrentFilter(newListFilter); // Update filter state
        navigate(`/list/${encodeURIComponent(newListName)}`); // Navigate
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        // Potential future implementation: Debounce and update a search filter atom
        // if (e.target.value.trim()) {
        //     setCurrentFilter(`search-${e.target.value.trim()}`);
        // } else if (currentFilter.startsWith('search-')) {
        //     // Revert to a default filter if search is cleared? Or handle this elsewhere.
        //     setCurrentFilter('all');
        // }
    };

    // Filter out 'Inbox' from the userLists array for rendering under "My Lists"
    const myListsToDisplay = userLists.filter(list => list !== 'Inbox');

    return (
        <>
            {/* Sidebar Container */}
            <aside className="w-56 bg-canvas-alt border-r border-black/5 h-full flex flex-col shrink-0 z-10 pt-3 pb-2">
                {/* Search Bar */}
                <div className="px-2.5 mb-2 flex-shrink-0">
                    <div className="relative">
                        <Icon name="search" size={15}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none opacity-70 z-10"/>
                        <input
                            type="search"
                            placeholder="Search"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="w-full h-7 pl-8 pr-2 text-sm bg-canvas-inset border border-black/5 rounded-md focus:border-primary/30 focus:ring-1 focus:ring-primary/20 placeholder:text-muted text-gray-800 shadow-inner" // Adjusted padding
                            aria-label="Search tasks"
                        />
                    </div>
                </div>

                {/* Main Filters (Non-collapsible) */}
                <nav className="px-1.5 flex-shrink-0 mb-1">
                    {/* Define static filters */}
                    <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks" count={counts.all} exact/>
                    <SidebarItem to="/today" filter="today" icon="sun" label="Today" count={counts.today}/>
                    <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days" count={counts.next7days}/>
                    {/* Optionally include Inbox here if desired */}
                    <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox" label="Inbox" count={counts.lists['Inbox']} />
                </nav>

                {/* Scrollable Area for Collapsible Sections */}
                <div className="flex-1 overflow-y-auto px-1.5 styled-scrollbar">
                    {/* User Lists Section */}
                    {/* Conditionally render if there are lists beyond 'Inbox' */}
                    {myListsToDisplay.length > 0 && (
                        <CollapsibleSection
                            title="My Lists"
                            icon="folder" // Use folder icon for list grouping
                            action={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    icon="folder-plus"
                                    className="w-6 h-6 text-muted-foreground hover:text-primary"
                                    onClick={handleAddNewListClick}
                                    aria-label="Add New List"
                                />
                            }
                        >
                            {myListsToDisplay.map(listName => (
                                <SidebarItem
                                    key={listName}
                                    to={`/list/${encodeURIComponent(listName)}`}
                                    filter={`list-${listName}`}
                                    icon="list" // Keep list icon for individual items
                                    label={listName}
                                    count={counts.lists[listName]}
                                    isUserList={true}
                                />
                            ))}
                        </CollapsibleSection>
                    )}

                    {/* Tags Section - Only render if tags exist */}
                    {userTags.length > 0 && (
                        <CollapsibleSection title="Tags" icon="tag" initiallyOpen={false}>
                            {userTags.map(tagName => (
                                <SidebarItem
                                    key={tagName}
                                    to={`/tag/${encodeURIComponent(tagName)}`}
                                    filter={`tag-${tagName}`}
                                    icon="tag"
                                    label={`#${tagName}`} // Prepend # for clarity
                                    count={counts.tags[tagName]}
                                />
                            ))}
                        </CollapsibleSection>
                    )}

                    {/* System Filters Section (Completed, Trash) */}
                    <CollapsibleSection title="System" initiallyOpen={false}>
                        <SidebarItem to="/completed" filter="completed" icon="check-square" label="Completed" count={counts.completed}/>
                        <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash" count={counts.trash}/>
                        {/* Could add 'Archive' here if implemented */}
                    </CollapsibleSection>
                </div>
            </aside>

            {/* Add List Modal - Rendered conditionally with Animation */}
            {/* AnimatePresence manages the mounting/unmounting animation */}
            <AnimatePresence>
                {isModalOpen && <AddListModal onAdd={handleListAdded}/>}
            </AnimatePresence>
        </>
    );
};

export default Sidebar;