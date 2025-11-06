import React from 'react';
import { useAtom } from 'jotai';
import { notificationsAtom } from '@/store/jotai';
import { AnimatePresence, motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import Icon from '@/components/ui/Icon';

const GlobalStatusDisplay: React.FC = () => {
    const [notifications, setNotifications] = useAtom(notificationsAtom);

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (notifications.length === 0) return null;

    return (
        <div
            className="fixed bottom-4 right-4 z-[10000] space-y-2 max-w-sm w-full flex flex-col items-end">
            <AnimatePresence>
                {notifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        layout
                        initial={{opacity: 0, y: 10, scale: 0.95}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, x: 20, scale: 0.95}}
                        transition={{duration: 0.2, ease: "easeOut"}}
                        className={twMerge(
                            "group p-3 rounded-lg shadow-xl text-xs w-full flex items-start relative",
                            notification.type === 'error' && "bg-error/10 border border-error/20 text-error-dark dark:bg-error/20 dark:border-error/30 dark:text-red-300",
                            notification.type === 'success' && "bg-success/10 border border-success/20 text-green-800 dark:bg-success/20 dark:border-green-500/30 dark:text-green-300"
                        )}
                    >
                        {notification.type === 'error' && <Icon name="alert-circle" size={14} className="mr-2 mt-px flex-shrink-0 text-error dark:text-red-400"/>}
                        {notification.type === 'success' && <Icon name="check-circle" size={14} className="mr-2 mt-px flex-shrink-0 text-success dark:text-green-400"/>}

                        <span className="flex-1 break-words">{notification.message}</span>
                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="ml-2 -mr-1 -mt-1 p-1 rounded-full opacity-50 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                            aria-label="Close notification"
                        >
                            <Icon name="x" size={12} strokeWidth={2}/>
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
GlobalStatusDisplay.displayName = 'GlobalStatusDisplay';
export default GlobalStatusDisplay;