import { createContext, useContext } from 'react';

export interface TaskItemMenuContextType {
    openItemId: string | null;
    setOpenItemId: (id: string | null) => void;
}

export const TaskItemMenuContext = createContext<TaskItemMenuContextType | undefined>(undefined);

export const useTaskItemMenu = (): TaskItemMenuContextType => {
    const context = useContext(TaskItemMenuContext);
    if (context === undefined) {
        throw new Error('useTaskItemMenu must be used within a TaskItemMenuProvider');
    }
    return context;
};
