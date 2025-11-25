import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { userListsAtom, tasksAtom } from '@/store/jotai';
import { RESET } from 'jotai/utils';
import storageManager from '@/services/storageManager';
import { List } from '@/types';

/**
 * A custom hook that provides methods to perform CRUD operations on user lists.
 * It ensures that updates are reflected in the global state (Atom) immediately
 * and persisted to the storage service.
 */
export const useListOperations = () => {
    const setLists = useSetAtom(userListsAtom);
    const setTasks = useSetAtom(tasksAtom);

    const createList = useCallback((listData: { name: string }) => {
        const service = storageManager.get();
        const newList = service.createList(listData);

        // Optimistically update the lists atom with a new array reference
        setLists((prev) => {
            const currentLists = prev ?? [];
            return [...currentLists, newList];
        });

        return newList;
    }, [setLists]);

    const updateList = useCallback((id: string, updates: Partial<List>) => {
        const service = storageManager.get();
        const updatedList = service.updateList(id, updates);

        // Update the specific list in the atom
        setLists((prev) => {
            const currentLists = prev ?? [];
            return currentLists.map((l) => (l.id === id ? updatedList : l));
        });

        // If the name changed, we should refresh tasks as they store denormalized list names
        if (updates.name) {
            setTasks(RESET);
        }

        return updatedList;
    }, [setLists, setTasks]);

    const deleteList = useCallback((id: string) => {
        const service = storageManager.get();
        service.deleteList(id);

        // Remove the list from the atom
        setLists((prev) => {
            const currentLists = prev ?? [];
            return currentLists.filter((l) => l.id !== id);
        });

        // Deleting a list moves its tasks to Inbox or Trash (logic in service),
        // so we must refresh the tasks atom to reflect these changes in the UI.
        setTasks(RESET);
    }, [setLists, setTasks]);

    return {
        createList,
        updateList,
        deleteList
    };
};