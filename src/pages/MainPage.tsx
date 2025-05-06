// src/pages/MainPage.tsx
import React from 'react'; // Removed useMemo as conditional classes are simpler now
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import TaskDetailPlaceholder from '../components/tasks/TaskDetailPlaceholder'; // Import the new placeholder
import {useAtomValue} from 'jotai';
import {selectedTaskIdAtom} from '../store/atoms';
import {TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import {AnimatePresence, motion} from 'framer-motion';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({title}) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    return (
        <div className="h-full flex flex-1 overflow-hidden">
            {/* TaskList Container - Always 50% width */}
            <div className={twMerge(
                "h-full w-1/2 flex-shrink-0", // flex-shrink-0 is important
                "bg-glass/30 dark:bg-neutral-850/40 backdrop-blur-lg",
                "border-r border-neutral-200/70 dark:border-neutral-700/60" // Permanent border
            )}>
                <TaskList title={title}/>
            </div>

            {/* Right Pane Container - Always 50% width, relative positioning for TaskDetail */}
            <div className="h-full w-1/2 flex-shrink-0 relative overflow-hidden">
                {/* Placeholder is always mounted if no task is selected but outside AnimatePresence for TaskDetail */}
                {!selectedTaskId && <TaskDetailPlaceholder/>}

                {/* TaskDetail - Animated presence */}
                {/* TaskDetail slides in/out *over* the placeholder or empty space */}
                <AnimatePresence initial={false}>
                    {selectedTaskId && (
                        <motion.div
                            key="taskDetailActual" // Changed key to ensure it's treated as a different component from placeholder
                            className="absolute inset-0 w-full h-full z-10" // Positioned absolutely to overlay
                            initial={{x: '100%'}}
                            animate={{x: 0}}
                            exit={{x: '100%'}}
                            transition={{duration: 0.30, ease: [0.25, 0.8, 0.5, 1]}}
                        >
                            <TaskDetail/>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
MainPage.displayName = 'MainPage';
export default MainPage;