// src/components/layout/Sidebar.tsx
import React from 'react';
import {NavLink, useNavigate} from 'react-router-dom';
import Icon, {IconName} from '../common/Icon';
import {useAtom} from 'jotai';
import {
    currentFilterAtom,
    isAddListModalOpenAtom,
    taskCountsAtom,
    userDefinedListsAtom,
    userListNamesAtom,
    userTagNamesAtom
} from '@/store/atoms';
import {TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import {AnimatePresence, motion} from 'framer-motion';
import Button from '../common/Button';
import AddListModal from '../common/AddListModal'; // Import the modal

interface SidebarItemProps {
    to: string;
    filter: TaskFilter;
    icon: IconName;
    label: string;
    count?: number;
    exact?: boolean; // To control NavLink active matching
    isUserList?: boolean; // Flag for user lists for potential styling/actions
}

const SidebarItem: React.FC<SidebarItemProps> = ({
                                                     to,
                                                     filter,
                                                     icon,
                                                     label,
                                                     count,
                                                     exact = false,
                                                     isUserList = false
                                                 }) => {
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
            end={exact}
            className={({isActive}) =>
                twMerge(
                    'flex items-center justify-between px-2 py-1 h-7 rounded-md mb-0.5 text-sm group transition-colors duration-100 ease-apple', // Base NavLink styles, ease-apple
                    isActive
                        ? 'bg-primary/10 text-primary font-medium' // Active NavLink styles
                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-800' // Inactive NavLink styles
                )
            }
            onClick={handleClick}
            aria-current="page"
        >
            {({isActive}) => (
                <> {/* Use a fragment */}
                    <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0">
                        <Icon name={icon} size={16} className="mr-1.5 flex-shrink-0 opacity-80"/>
                        <span className="truncate">{label}</span>
                    </div>
                    {/* Count indicator */}
                    {count !== undefined && count > 0 && (
                        <motion.span
                            className={twMerge(
                                "text-[10px] font-mono px-1 py-0 rounded-full ml-1.5 tabular-nums flex-shrink-0",
                                isActive
                                    ? 'text-primary bg-primary/15'
                                    : 'text-muted-foreground bg-gray-100 group-hover:bg-gray-200'
                            )}
                            initial={{scale: 0.8, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{duration: 0.15}}
                        >
                            {count}
                        </motion.span>
                    )}
                    {/* Placeholder for potential actions on user lists (hover) */}
                    {isUserList && <div className="w-4 h-4 ml-1"></div>}
                </>
            )}
        </NavLink>
    );
};


interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    icon?: IconName;
    initiallyOpen?: boolean;
    action?: React.ReactNode; // Optional action button (e.g., Add List)
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
                                                                   title,
                                                                   icon,
                                                                   children,
                                                                   initiallyOpen = true,
                                                                   action
                                                               }) => {
    const [isOpen, setIsOpen] = React.useState(initiallyOpen);

    return (
        // Added bottom border for separation when collapsed
        <div className="mt-2 pt-2 border-t border-border-color/60 first:mt-0 first:pt-0 first:border-t-0">
            <div className="flex items-center justify-between px-2 py-0.5"> {/* Container for title and action */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center flex-1 min-w-0 h-6 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-gray-700 focus:outline-none"
                    aria-expanded={isOpen}
                >
                    {icon && <Icon name={icon} size={12} className="mr-1 opacity-70"/>}
                    <span className="mr-1">{title}</span>
                    <Icon
                        name={'chevron-down'}
                        size={14}
                        className={twMerge("transition-transform duration-200 ease-apple", isOpen ? "rotate-180" : "rotate-0", "ml-auto mr-1 opacity-60")} // Chevron on the right
                    />
                </button>
                {/* Render action button if provided */}
                {action && <div className="-mr-1">{action}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: {opacity: 1, height: 'auto', marginTop: '2px'}, // Add small margin when open
                            collapsed: {opacity: 0, height: 0, marginTop: '0px'},
                        }}
                        transition={{duration: 0.2, ease: [0.4, 0, 0.2, 1]}} // Emphasized easing
                        className="overflow-hidden"
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
    const [userLists] = useAtom(userListNamesAtom); // Now includes userDefinedLists
    const [userTags] = useAtom(userTagNamesAtom);
    const [, setCurrentFilter] = useAtom(currentFilterAtom);
    const [, setUserDefinedLists] = useAtom(userDefinedListsAtom);
    const [isModalOpen, setIsModalOpen] = useAtom(isAddListModalOpenAtom);
    const navigate = useNavigate();

    // State for the search input
    const [searchTerm, setSearchTerm] = React.useState('');

    const handleAddNewListClick = () => {
        setIsModalOpen(true); // Open the modal
    };

    const handleListAdded = (newListName: string) => {
        // Update the userDefinedLists atom
        setUserDefinedLists((prevLists) => [...prevLists, newListName]);
        // Set the filter immediately and navigate
        const newListFilter: TaskFilter = `list-${newListName}`;
        setCurrentFilter(newListFilter);
        navigate(`/list/${encodeURIComponent(newListName)}`);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        // Implement search filtering logic here if desired (e.g., update a search filter atom)
        // For now, it just updates the input value
    };

    return (
        <>
            <aside className="w-56 bg-canvas-alt border-r border-black/5 h-full flex flex-col shrink-0 z-10 pt-3 pb-2">
                {/* Search Bar */}
                <div className="px-2.5 mb-2">
                    <div className="relative">
                        <Icon name="search" size={15}
                              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none opacity-60"/>
                        <input
                            type="search"
                            placeholder="Search" // Simplified placeholder
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="w-full h-7 pl-7 pr-2 text-sm bg-canvas-inset border border-black/5 rounded-md focus:border-primary/30 focus:ring-1 focus:ring-primary/20 placeholder:text-muted text-gray-800 shadow-inner" // Subtle inner shadow
                        />
                    </div>
                </div>

                {/* Main Filters */}
                <nav className="px-1.5 flex-shrink-0 mb-1">
                    {/* Updated order: All Tasks, Today, Next 7 Days */}
                    <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks" count={counts.all} exact/>
                    <SidebarItem to="/today" filter="today" icon="sun" label="Today" count={counts.today}/>
                    <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days"
                                 count={counts.next7days}/>
                </nav>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto px-1.5 styled-scrollbar">
                    {/* Lists Section */}
                    <CollapsibleSection
                        title="My Lists"
                        //  icon="list" // Icon removed from header title
                        action={
                            <Button
                                variant="ghost"
                                size="icon"
                                icon="folder-plus" // More specific icon
                                className="w-6 h-6 text-muted-foreground hover:text-primary"
                                onClick={handleAddNewListClick}
                                aria-label="Add List"
                            />
                        }
                    >
                        {userLists.map(listName => (
                            <SidebarItem
                                key={listName}
                                to={`/list/${encodeURIComponent(listName)}`}
                                filter={`list-${listName}`}
                                icon="list" // Keep icon on item
                                label={listName}
                                count={counts.lists[listName]}
                                isUserList={true}
                            />
                        ))}
                        {/* Add List Button moved to section header */}
                    </CollapsibleSection>

                    {/* Tags Section - Conditionally render */}
                    {userTags.length > 0 && (
                        <CollapsibleSection title="Tags" /* icon="tag" */ initiallyOpen={false}>
                            {userTags.map(tagName => (
                                <SidebarItem
                                    key={tagName}
                                    to={`/tag/${encodeURIComponent(tagName)}`}
                                    filter={`tag-${tagName}`}
                                    icon="tag" // Keep icon on item
                                    label={`#${tagName}`}
                                    count={counts.tags[tagName]}
                                />
                            ))}
                        </CollapsibleSection>
                    )}

                    {/* System Filters Section */}
                    <CollapsibleSection title="System" initiallyOpen={false}>
                        <SidebarItem to="/completed" filter="completed" icon="check-square" label="Completed"
                                     count={counts.completed}/>
                        <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash" count={counts.trash}/>
                    </CollapsibleSection>
                </div>
            </aside>

            {/* Add List Modal - Rendered conditionally */}
            <AnimatePresence>
                {isModalOpen && <AddListModal onAdd={handleListAdded}/>}
            </AnimatePresence>
        </>
    );
};

export default Sidebar;