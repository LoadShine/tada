import React, { useMemo, useState } from 'react';
import { TaskItemMenuContext } from './taskItemMenuContextValue';

/**
 * React context to manage the state of which task item's menu/popover is currently open.
 * This ensures that only one menu is open at a time across the entire task list.
 */
export const TaskItemMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [openItemId, setOpenItemId] = useState<string | null>(null);

    // Memoize the context value to prevent unnecessary re-renders of consumers
    const contextValue = useMemo(() => ({
        openItemId,
        setOpenItemId,
    }), [openItemId]);

    return (
        <TaskItemMenuContext.Provider value={contextValue}>
            {children}
        </TaskItemMenuContext.Provider>
    );
};
TaskItemMenuProvider.displayName = 'TaskItemMenuProvider';
