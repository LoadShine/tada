// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import TaskDetailPlaceholder from '../components/tasks/TaskDetailPlaceholder';
import {useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskIdAtom} from '../store/atoms';
import {TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import {AnimatePresence, motion} from 'framer-motion';
import useMediaQuery from '@/hooks/useMediaQuery'; // Import the custom hook

interface MainPageProps {
    title: string;
    filter: TaskFilter; // Filter prop is passed to TaskList
}

const MainPage: React.FC<MainPageProps> = ({title, filter}) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom); // For closing drawer via backdrop
    const isLg = useMediaQuery('(min-width: 1024px)'); // Tailwind's lg breakpoint

    return (
        <div className="h-full flex flex-1 overflow-hidden"> {/* Parent flex container */}
            {/* TaskList Container */}
            <div
                className={twMerge(
                    "h-full transition-all duration-300 ease-in-out",
                    isLg ? "w-1/2 flex-shrink-0" : "w-full flex-shrink-0", // Takes half width on lg, full on smaller
                    "bg-white", // Background for TaskList area
                    "border-r border-grey-ultra-light" // Separator for TaskList
                )}
            >
                <TaskList title={title}/>
            </div>

            {/* Right Pane (TaskDetail or Placeholder) */}
            {isLg ? (
                // Desktop: Inline Task Detail or Placeholder
                <div className={twMerge(
                    "h-full w-1/2 flex-shrink-0 relative overflow-hidden bg-white" // Takes the other half on lg, bg-white for placeholder area
                )}>
                    {!selectedTaskId && <TaskDetailPlaceholder/>}
                    <AnimatePresence initial={false}>
                        {selectedTaskId && (
                            <motion.div
                                key="taskDetailActualDesktop" // Unique key for desktop
                                className="absolute inset-0 w-full h-full z-10" // TaskDetail will provide its own background
                                initial={{x: '100%'}} // Slide in from the right edge of this container
                                animate={{x: 0}}
                                exit={{x: '100%'}} // Slide out to the right edge of this container
                                transition={{duration: 0.25, ease: [0.33, 1, 0.68, 1]}} // Original elegant transition
                            >
                                <TaskDetail/>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                // Mobile: Task Detail as a Drawer
                <AnimatePresence>
                    {selectedTaskId && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                key="drawer-backdrop"
                                className="fixed inset-0 bg-black/40 dark:bg-black/60 z-30 backdrop-blur-sm"
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                exit={{opacity: 0}}
                                transition={{duration: 0.25, ease: "easeInOut"}}
                                onClick={() => setSelectedTaskId(null)} // Close on backdrop click
                            />
                            {/* Drawer Content */}
                            <motion.div
                                key="drawer-task-detail"
                                className={twMerge(
                                    "fixed top-0 right-0 h-full w-[90%] max-w-md shadow-2xl z-40 flex flex-col", // Adjusted max-width for elegance
                                    "bg-neutral-50 dark:bg-neutral-850" // Matches TaskDetail's background
                                )}
                                initial={{x: '100%'}}
                                animate={{x: 0}}
                                exit={{x: '100%'}}
                                transition={{duration: 0.3, ease: [0.33, 1, 0.68, 1]}} // Refined easing
                            >
                                <TaskDetail/> {/* TaskDetail itself handles its internal scrolling */}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};
MainPage.displayName = 'MainPage';
export default MainPage;