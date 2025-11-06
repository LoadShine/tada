import React, {createContext, useContext, useMemo, useState} from 'react';

// Define the shape of the context data
interface TaskItemMenuContextType {
    openItemId: string | null; // ID of the task whose menu/picker is open
    setOpenItemId: (id: string | null) => void; // Function to set the open item ID
}

// Create the context with a default value (or undefined and check in consumer)
const TaskItemMenuContext = createContext<TaskItemMenuContextType | undefined>(undefined);

// Create a provider component
export const TaskItemMenuProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [openItemId, setOpenItemId] = useState<string | null>(null);

    // Memoize the context value to prevent unnecessary re-renders of consumers
    const contextValue = useMemo(() => ({
        openItemId,
        setOpenItemId,
    }), [openItemId]); // Only depends on openItemId

    return (
        <TaskItemMenuContext.Provider value={contextValue}>
            {children}
        </TaskItemMenuContext.Provider>
    );
};
TaskItemMenuProvider.displayName = 'TaskItemMenuProvider';


// Custom hook to consume the context, ensures it's used within a provider
export const useTaskItemMenu = (): TaskItemMenuContextType => {
    const context = useContext(TaskItemMenuContext);
    if (context === undefined) {
        throw new Error('useTaskItemMenu must be used within a TaskItemMenuProvider');
    }
    return context;
};