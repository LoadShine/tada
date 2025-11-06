import React, { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { tasksAtom } from '@/store/jotai';
import { startOfDay } from '@/utils/dateUtils';

const DailyTaskRefresh: React.FC = () => {
    const setTasks = useSetAtom(tasksAtom);
    const lastCheckDateRef = useRef<string>(startOfDay(new Date()).toISOString().split('T')[0]);
    useEffect(() => {
        const checkDate = () => {
            const todayDate = startOfDay(new Date()).toISOString().split('T')[0];
            if (todayDate !== lastCheckDateRef.current) {
                console.log(`Date changed from ${lastCheckDateRef.current} to ${todayDate}. Triggering task category refresh.`);
                setTasks(currentTasks => [...(currentTasks ?? [])]);
                lastCheckDateRef.current = todayDate;
            }
        };
        checkDate();
        const intervalId = setInterval(checkDate, 60 * 1000);
        window.addEventListener('focus', checkDate);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', checkDate);
        };
    }, [setTasks]);
    return null;
};

DailyTaskRefresh.displayName = 'DailyTaskRefresh';
export default DailyTaskRefresh;