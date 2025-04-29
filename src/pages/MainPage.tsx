// src/pages/MainPage.tsx
import React, { useMemo } from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtomValue } from 'jotai';
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';

interface MainPageProps {
    title: string; // Page title (e.g., "Today", "Inbox")
    filter: TaskFilter; // Filter context (used by RouteChangeHandler)
}

const MainPage: React.FC<MainPageProps> = ({ title }) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    // Use cn for class merging, keep transition on flex-basis
    const taskListContainerClass = useMemo(() => cn(
        "flex-1 h-full min-w-0 transition-[flex-basis] duration-300 ease-out", // Use ease-out for smoother end
        selectedTaskId ? "border-r border-border/50" : "" // Use theme border
    ), [selectedTaskId]);

    return (
        <div className="h-full flex flex-1 overflow-hidden">
            {/* TaskList Container */}
            <div className={taskListContainerClass}>
                <TaskList title={title} />
            </div>

            {/* TaskDetail - Animated presence */}
            <AnimatePresence initial={false}>
                {selectedTaskId && <TaskDetail key={`taskDetail-${selectedTaskId}`} />}
            </AnimatePresence>
        </div>
    );
};
MainPage.displayName = 'MainPage';
export default MainPage;