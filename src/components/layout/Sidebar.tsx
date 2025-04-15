// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom'; // Import useNavigate
import Icon, { IconName } from '../common/Icon';
import { useAtom } from 'jotai';
import { currentFilterAtom, taskCountsAtom, userListNamesAtom, userTagNamesAtom } from '@/store/atoms';
import { TaskFilter } from '@/types';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';

interface SidebarItemProps {
    filter: TaskFilter; // Use filter type
    icon: IconName;
    label: string;
    count?: number;
    isListOrTag?: boolean; // Flag for user-created items
}

const SidebarItem: React.FC<SidebarItemProps> = ({ filter, icon, label, count }) => {
// const SidebarItem: React.FC<SidebarItemProps> = ({ filter, icon, label, count, isListOrTag }) => {
    const [currentFilter, setCurrentFilter] = useAtom(currentFilterAtom);
    const navigate = useNavigate(); // Hook for navigation
    const isActive = currentFilter === filter;

    // Determine path based on filter type
    let path: string;
    if (filter === 'all') path = '/'; // 'All Tasks' maps to index route
    else if (filter === 'today') path = '/today';
    else if (filter === 'next7days') path = '/next7days';
    else if (filter === 'completed') path = '/completed';
    else if (filter === 'trash') path = '/trash';
    else if (filter.startsWith('list-')) path = `/list/${filter.substring(5)}`;
    else if (filter.startsWith('tag-')) path = `/tag/${filter.substring(4)}`;
    else path = '/'; // Default fallback

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent default NavLink navigation
        setCurrentFilter(filter); // Set the filter state
        navigate(path); // Programmatically navigate
    };

    return (
        // Use a button for click handling, but wrap with NavLink for semantic correctness and potential future styling based on route
        <NavLink
            to={path}
            className={twMerge(
                'flex items-center justify-between pl-2 pr-1.5 py-1 h-7 rounded-md mb-0.5 text-sm group transition-colors duration-100 ease-apple', // Adjusted padding/height/margin
                isActive
                    ? 'bg-primary/10 text-primary font-medium' // Refined active state
                    : 'text-gray-600 hover:bg-gray-500/10 hover:text-gray-700 active:bg-gray-500/15', // Subtle hover/active
                'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 focus-visible:ring-inset' // Custom focus for list items
            )}
            onClick={handleClick}
            aria-current={isActive ? 'page' : undefined}
            title={label} // Add tooltip
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis">
                <Icon name={icon} size={16} className="mr-2 flex-shrink-0" />
                <span className="truncate pt-px">{label}</span> {/* Adjust alignment slightly */}
            </div>
            {count !== undefined && count > 0 && (
                <span className={twMerge(
                    "text-[11px] font-mono px-1.5 py-0 rounded-full ml-2", // Smaller font, adjusted padding
                    isActive ? 'text-primary bg-primary/15' : 'text-muted-foreground bg-gray-100 group-hover:bg-gray-200/70'
                )}>
                    {count}
                </span>
            )}
        </NavLink>
    );
};

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    icon?: IconName;
    initiallyOpen?: boolean; // Control initial state
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, children, initiallyOpen = true }) => {
    const [isOpen, setIsOpen] = React.useState(initiallyOpen);

    return (
        <div className="mt-2 pt-2 border-t border-gray-200/60 first:mt-0 first:pt-0 first:border-t-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-gray-700 focus-visible:outline-none focus-visible:text-gray-800"
                aria-expanded={isOpen}
            >
                <div className="flex items-center">
                    {icon && <Icon name={icon} size={13} className="mr-1 opacity-80" />}
                    <span>{title}</span>
                </div>
                <Icon
                    name='chevron-right' // Use right chevron, rotate when open
                    size={14}
                    className={twMerge(
                        "transform transition-transform duration-200 ease-apple",
                        isOpen && "rotate-90"
                    )}
                />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: { opacity: 1, height: 'auto' },
                            collapsed: { opacity: 0, height: 0 },
                        }}
                        transition={{ duration: 0.25, ease: [0.4, 0.0, 0.2, 1] }} // Smoother ease
                        className="overflow-hidden mt-0.5 space-y-0.5" // Add vertical spacing for items within
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


const Sidebar: React.FC = () => {
    const [counts] = useAtom(taskCountsAtom);
    const [userLists] = useAtom(userListNamesAtom);
    const [userTags] = useAtom(userTagNamesAtom);
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const navigate = useNavigate();

    const handleAddNewList = () => {
        const newListName = prompt("Enter new list name:");
        if (newListName?.trim()) {
            const trimmedName = newListName.trim();
            // In a real app, update a dedicated 'lists' atom/state first.
            // For now, set filter & navigate. A task must be added/moved later.
            const newFilter: TaskFilter = `list-${trimmedName}`;
            setCurrentFilter(newFilter);
            navigate(`/list/${trimmedName}`);
        }
    };

    // Basic Search Handler (Placeholder)
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        console.log("Search Query:", query);
        // Implement search logic here (e.g., filter tasks, navigate to search results page)
    };

    return (
        // Refined width, padding, background
        <aside className="w-60 bg-canvas-alt border-r border-gray-200/60 h-full flex flex-col shrink-0 z-10 pt-3 pb-2">
            {/* Optional Search Bar - Refined Style */}
            <div className="px-3 mb-2">
                <div className="relative">
                    <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search..."
                        onChange={handleSearch}
                        className="form-input w-full h-7 pl-8 pr-2 text-sm bg-canvas-inset border border-gray-200/80 rounded-md focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white placeholder-muted" // Use @tailwindcss/forms class
                    />
                </div>
            </div>

            {/* Main Filters */}
            <nav className="px-2 flex-shrink-0 space-y-0.5">
                {/* 'All Tasks' is now the primary filter, linked to '/' */}
                <SidebarItem filter="all" icon="archive" label="All Tasks" count={counts.all} />
                <SidebarItem filter="today" icon="sun" label="Today" count={counts.today} />
                <SidebarItem filter="next7days" icon="calendar-days" label="Upcoming" count={counts.next7days} />
                {/* Removed 'Inbox' as a top-level filter */}
            </nav>

            {/* Scrollable Area for Lists, Tags, etc. */}
            <div className="flex-1 overflow-y-auto px-2 pt-1 styled-scrollbar">
                {/* Lists Section */}
                <CollapsibleSection title="Lists" icon="list" initiallyOpen={true}>
                    {userLists.map(listName => (
                        <SidebarItem
                            key={listName}
                            filter={`list-${listName}`}
                            // Use 'inbox' icon specifically for the Inbox list
                            icon={listName === 'Inbox' ? 'inbox' : 'list'}
                            label={listName}
                            count={counts.lists[listName]}
                            isListOrTag={true}
                        />
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="plus"
                        className="w-full justify-start mt-1 text-muted-foreground hover:text-primary font-normal h-7 pl-1.5 text-xs" // Adjust style
                        onClick={handleAddNewList}
                    >
                        Add List
                    </Button>
                </CollapsibleSection>

                {/* Tags Section - Only show if tags exist */}
                {userTags.length > 0 && (
                    <CollapsibleSection title="Tags" icon="tag" initiallyOpen={true}>
                        {userTags.map(tagName => (
                            <SidebarItem
                                key={tagName}
                                filter={`tag-${tagName}`}
                                icon="tag"
                                label={tagName}
                                count={counts.tags[tagName]}
                                isListOrTag={true}
                            />
                        ))}
                    </CollapsibleSection>
                )}

                {/* System Filters Section */}
                <CollapsibleSection title="System" initiallyOpen={false}> {/* Initially closed */}
                    <SidebarItem filter="completed" icon="check-square" label="Completed" count={counts.completed} />
                    <SidebarItem filter="trash" icon="trash" label="Trash" count={counts.trash} />
                </CollapsibleSection>
            </div>
        </aside>
    );
};

export default Sidebar;