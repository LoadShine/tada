// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtomValue } from 'jotai';
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { twMerge } from 'tailwind-merge';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    return (
        <div className="h-full flex flex-1 overflow-hidden">
            <div className={twMerge(
                "flex-1 h-full min-w-0", // Removed transition class - flex handles resizing
                selectedTaskId ? "border-r border-black/5" : ""
            )}
            >
                <TaskList title={title} filter={filter} />
            </div>

            {selectedTaskId && <TaskDetail />}
        </div>
    );
};

export default MainPage;