// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtomValue } from 'jotai'; // Use useAtomValue for reading
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { AnimatePresence } from 'framer-motion';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    // Read selectedTaskId using useAtomValue as we don't set it here
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    return (
        // Main container for the Task List / Detail view
        <div className="h-full flex flex-1 overflow-hidden">

            {/* Task List takes available space, min-width ensures it doesn't collapse too much */}
            <div className="flex-1 h-full min-w-0 border-r border-border-color/60"> {/* Added border */}
                {/* Pass title and filter props */}
                <TaskList title={title} filter={filter} />
            </div>

            {/* Task Detail slides in/out using AnimatePresence */}
            {/* initial={false} prevents animation on the initial load */}
            <AnimatePresence initial={false}>
                {/* Conditionally render TaskDetail only if a task is selected */}
                {/* Keying TaskDetail ensures it re-mounts/animates correctly if needed,
                    though the internal state relies on selectedTaskAtom */}
                {selectedTaskId && <TaskDetail key={`detail-${selectedTaskId}`} />}
            </AnimatePresence>

        </div>
    );
};

export default MainPage;