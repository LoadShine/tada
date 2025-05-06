// src/components/tasks/TaskDetailPlaceholder.tsx
import React from 'react';
import Icon from '../common/Icon';
import {twMerge} from 'tailwind-merge';

const TaskDetailPlaceholder: React.FC = () => {
    return (
        <div className={twMerge(
            "h-full flex flex-col items-center justify-center text-center p-8",
            "bg-gradient-to-br from-neutral-100/70 to-neutral-200/60 dark:from-neutral-800/70 dark:to-neutral-900/60", // Same as TaskDetail background
            "backdrop-blur-2xl border-l border-neutral-200/70 dark:border-neutral-700/60" // Same border
        )}>
            <Icon name="file-text" size={48} className="text-neutral-400 dark:text-neutral-500 mb-4 opacity-80"/>
            <h3 className="text-lg font-medium text-neutral-600 dark:text-neutral-300 mb-1">No Task Selected</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Select a task from the list to view its details.
            </p>
        </div>
    );
};

TaskDetailPlaceholder.displayName = 'TaskDetailPlaceholder';
export default TaskDetailPlaceholder;