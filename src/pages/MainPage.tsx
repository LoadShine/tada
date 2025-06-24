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
import useMediaQuery from '@/hooks/useMediaQuery';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({title, filter}) => {
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const isLg = useMediaQuery('(min-width: 1024px)');

    return (
        <div className="h-full flex flex-1 overflow-hidden">
            <div
                className={twMerge(
                    "h-full",
                    isLg ? "w-1/2 flex-shrink-0" : "w-full flex-shrink-0",
                    // 修复: 添加暗黑模式背景色和边框色
                    "bg-white dark:bg-neutral-800",
                    "border-r border-grey-light dark:border-neutral-700/50"
                )}
            >
                <TaskList title={title}/>
            </div>

            {isLg ? (
                <div className={twMerge(
                    "h-full flex-1 flex-shrink-0 relative overflow-hidden",
                    // 修复: 添加暗黑模式背景色
                    "bg-white dark:bg-neutral-800"
                )}>
                    {!selectedTaskId && <TaskDetailPlaceholder/>}
                    <AnimatePresence initial={false}>
                        {selectedTaskId && (
                            <motion.div
                                key="taskDetailActualDesktop"
                                className="absolute inset-0 w-full h-full z-10"
                                initial={{x: '100%'}}
                                animate={{x: 0}}
                                exit={{x: '100%'}}
                                transition={{duration: 0.25, ease: [0.33, 1, 0.68, 1]}}
                            >
                                <TaskDetail/>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <AnimatePresence>
                    {selectedTaskId && (
                        <>
                            <motion.div
                                key="drawer-backdrop"
                                className="fixed inset-0 bg-black/40 dark:bg-black/60 z-30 backdrop-blur-sm"
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                exit={{opacity: 0}}
                                transition={{duration: 0.25, ease: "easeInOut"}}
                                onClick={() => setSelectedTaskId(null)}
                            />
                            <motion.div
                                key="drawer-task-detail"
                                className={twMerge(
                                    "fixed top-0 right-0 h-full w-[90%] max-w-md shadow-2xl z-40 flex flex-col",
                                    "bg-white dark:bg-neutral-850"
                                )}
                                initial={{x: '100%'}}
                                animate={{x: 0}}
                                exit={{x: '100%'}}
                                transition={{duration: 0.3, ease: [0.33, 1, 0.68, 1]}}
                            >
                                <TaskDetail/>
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