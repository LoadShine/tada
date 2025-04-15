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
    filter: TaskFilter; // Pass the specific filter
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    const [selectedTaskId] = useAtom(selectedTaskIdAtom);

    return (
        // Ensure this container fills the space provided by MainLayout's <main>
        <div className="h-full flex flex-1 overflow-hidden">
            {/* Task List takes available space, minimum width prevents collapse */}
            <div className="flex-1 h-full min-w-0 overflow-hidden">
                <TaskList title={title} filter={filter} />
            </div>

            {/* Task Detail slides in/out */}
            <AnimatePresence initial={false}>
                {selectedTaskId && <TaskDetail />}
            </AnimatePresence>
        </div>
    );
};

export default MainPage;