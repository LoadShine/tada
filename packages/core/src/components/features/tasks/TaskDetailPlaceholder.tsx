import React from 'react';
import Icon from '@/components/ui/Icon.tsx';
import {twMerge} from 'tailwind-merge';
import {useTranslation} from "react-i18next";

const TaskDetailPlaceholder: React.FC = () => {
    const {t} = useTranslation();
    return (
        <div className={twMerge(
            "h-full flex flex-col items-center justify-center text-center p-8",
            "bg-transparent", // 改为透明
        )}>
            <Icon name="file-text" size={40} strokeWidth={1}
                  className="text-grey-light/70 dark:text-neutral-600/70 mb-4 opacity-80"/>
            <h3 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 mb-1">{t('taskDetailPlaceholder.title')}</h3>
            <p className="text-[13px] font-light text-grey-medium dark:text-neutral-400">
                {t('taskDetailPlaceholder.description')}
            </p>
        </div>
    );
};

TaskDetailPlaceholder.displayName = 'TaskDetailPlaceholder';
export default TaskDetailPlaceholder;