// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtomValue } from 'jotai';
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge'; // Import twMerge

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    return (
        // Main container using flexbox
        <div className="h-full flex flex-1 overflow-hidden">

            {/* Task List Container */}
            {/* Ensure this container does NOT shrink when TaskDetail appears */}
            {/* min-w-0 is important for flex children to shrink below their content size if needed */}
            {/* border-r provides visual separation */}
            <div className={twMerge(
                "flex-1 h-full min-w-0 transition-[width]", // Let width transition smoothly if needed, but flex-1 should handle it
                selectedTaskId ? "border-r border-black/5" : "" // Add border only when detail is shown
            )}
            >
                <TaskList title={title} filter={filter} />
            </div>

            {/* Task Detail slides in/out */}
            {/* AnimatePresence handles the mounting/unmounting animation */}
            <AnimatePresence initial={false}>
                {selectedTaskId && <TaskDetail />}
            </AnimatePresence>

        </div>
    );
};

export default MainPage;