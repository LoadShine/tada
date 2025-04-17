// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon, { IconName } from '../common/Icon';
import { useAtom } from 'jotai';
import { currentFilterAtom, taskCountsAtom, userListNamesAtom, userTagNamesAtom } from '@/store/atoms';
import { TaskFilter } from '@/types';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';

interface SidebarItemProps {
    to: string;
    filter: TaskFilter;
    icon: IconName;
    label: string;
    count?: number;
    exact?: boolean; // To control NavLink active matching
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, filter, icon, label, count, exact = false }) => {
    // We need NavLink's isActive for styling, but Jotai atom for filtering logic
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault(); // Prevent NavLink's default navigation
        setCurrentFilter(filter); // Update the filter state
        navigate(to); // Manually navigate
    };

    return (
        <NavLink
            to={to}
            end={exact} // Use 'end' prop for exact matching if specified
            // --- ClassName for the NavLink itself ---
            // This part remains the same, using the function prop correctly
            className={({ isActive }) =>
                twMerge(
                    'flex items-center justify-between px-2.5 py-1 h-7 rounded-md mb-0.5 text-sm group transition-colors duration-100 ease-out', // Base NavLink styles
                    isActive
                        ? 'bg-primary/10 text-primary font-medium' // Active NavLink styles
                        : 'text-gray-600 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200' // Inactive NavLink styles
                )
            }
            onClick={handleClick} // Use our custom click handler
            aria-current="page" // Let NavLink handle aria-current based on its isActive
        >
            {/* --- Children as a function to access isActive --- */}
            {/* Pass a function here. It receives { isActive } */}
            {({ isActive }) => (
                <> {/* Use a fragment to return multiple elements */}
                    <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis">
                        <Icon name={icon} size={16} className="mr-2 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                    </div>
                    {/* Subtle count indicator */}
                    {count !== undefined && count > 0 && (
                        <span className={twMerge( // Use twMerge here
                            "text-[11px] font-mono px-1.5 py-0 rounded-full ml-2 tabular-nums", // Base count styles
                            // NOW we have access to 'isActive' from the children function prop
                            // Calculate the conditional class string *before* passing to twMerge
                            isActive
                                ? 'text-primary bg-primary/15' // Active count styles
                                : 'text-muted-foreground bg-gray-100 group-hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-gray-600' // Inactive count styles (added dark/hover)
                        )}>
                            {count}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );
};


// --- CollapsibleSection and Sidebar remain the same ---

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    icon?: IconName;
    initiallyOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, children, initiallyOpen = true }) => {
    const [isOpen, setIsOpen] = React.useState(initiallyOpen);

    return (
        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 first:mt-0 first:pt-0 first:border-t-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                aria-expanded={isOpen}
            >
                <div className="flex items-center">
                    {icon && <Icon name={icon} size={12} className="mr-1.5" />}
                    <span>{title}</span>
                </div>
                <Icon
                    name={'chevron-down'} // Use ChevronDown, rotate it based on state
                    size={14}
                    className={twMerge("transition-transform duration-200", isOpen ? "rotate-180" : "rotate-0")}
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
                            open: { opacity: 1, height: 'auto', marginTop: '4px' }, // Add margin when open
                            collapsed: { opacity: 0, height: 0, marginTop: '0px' },
                        }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} // Emphasized easing
                        className="overflow-hidden" // No margin here, handled by variants
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
    // const [, setTasks] = useAtom(tasksAtom);
    const navigate = useNavigate();

    // State for the search input
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleAddNewList = () => {
        const newListName = prompt("Enter new list name:");
        if (newListName && newListName.trim() !== '') {
            const trimmedName = newListName.trim();
            // Check if list already exists (case-insensitive)
            if (userLists.some(list => list.toLowerCase() === trimmedName.toLowerCase())) {
                alert(`List "${trimmedName}" already exists.`);
                return;
            }
            // Create a filter for the new list
            const newListFilter: TaskFilter = `list-${trimmedName}`;
            setCurrentFilter(newListFilter); // Set the filter immediately
            navigate(`/list/${encodeURIComponent(trimmedName)}`); // Navigate to the new list's URL
        }
    };

    // Add logic for handling search if needed (e.g., filtering tasks based on searchTerm)
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        // Implement search filtering logic here if desired
    };


    return (
        <aside className="w-60 bg-canvas-alt border-r border-black/5 dark:border-white/5 h-full flex flex-col shrink-0 z-10 pt-3 pb-2">
            {/* Search Bar */}
            <div className="px-3 mb-2">
                <div className="relative">
                    <Icon name="search" size={15} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        className="w-full h-7 pl-7 pr-2 text-sm bg-canvas-inset border border-black/10 dark:border-white/10 rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted text-gray-800"
                    />
                </div>
            </div>

            {/* Main Filters */}
            <nav className="px-2 flex-shrink-0 mb-1">
                {/* Updated order: All Tasks, Today, Next 7 Days */}
                <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks" count={counts.all} exact />
                <SidebarItem to="/today" filter="today" icon="sun" label="Today" count={counts.today} />
                <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days" count={counts.next7days} />
                {/* Inbox removed */}
            </nav>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-2 styled-scrollbar">
                {/* Lists Section */}
                <CollapsibleSection title="My Lists" icon="list">
                    {userLists.map(listName => (
                        <SidebarItem
                            key={listName}
                            to={`/list/${encodeURIComponent(listName)}`} // Ensure list names are URL-safe
                            filter={`list-${listName}`}
                            icon="list"
                            label={listName}
                            count={counts.lists[listName]}
                        />
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="plus"
                        className="w-full justify-start mt-1 text-muted-foreground hover:text-primary text-xs pl-2.5 h-7"
                        onClick={handleAddNewList}
                    >
                        Add List
                    </Button>
                </CollapsibleSection>

                {/* Tags Section - Conditionally render if tags exist */}
                {userTags.length > 0 && (
                    <CollapsibleSection title="Tags" icon="tag" initiallyOpen={false}>
                        {userTags.map(tagName => (
                            <SidebarItem
                                key={tagName}
                                to={`/tag/${encodeURIComponent(tagName)}`} // Ensure tags are URL-safe
                                filter={`tag-${tagName}`}
                                icon="tag"
                                label={`#${tagName}`} // Display with '#'
                                count={counts.tags[tagName]}
                            />
                        ))}
                    </CollapsibleSection>
                )}

                {/* System Filters Section */}
                <CollapsibleSection title="System" initiallyOpen={false}>
                    <SidebarItem to="/completed" filter="completed" icon="check-square" label="Completed" count={counts.completed} />
                    <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash" count={counts.trash} />
                </CollapsibleSection>
            </div>
        </aside>
    );
};

export default Sidebar;