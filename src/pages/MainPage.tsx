// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtom } from 'jotai';
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { AnimatePresence } from 'framer-motion';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    const [selectedTaskId] = useAtom(selectedTaskIdAtom);

    return (
        // This component orchestrates TaskList and TaskDetail side-by-side
        <div className="h-full flex flex-1 overflow-hidden">
            {/* Task List takes available space */}
            <div className="flex-1 h-full min-w-0"> {/* min-w-0 prevents overflow */}
                <TaskList title={title} filter={filter} />
            </div>

            {/* Task Detail slides in/out */}
            <AnimatePresence initial={false}> {/* initial=false prevents animation on initial load */}
                {/* Keying TaskDetail ensures it re-mounts/animates when ID changes, though selectedTaskAtom handles content */}
                {selectedTaskId && <TaskDetail key={`detail-${selectedTaskId}`} />}
            </AnimatePresence>
        </div>
    );
};

export default MainPage;