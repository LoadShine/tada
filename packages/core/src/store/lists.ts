import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { List } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from './types';

// --- List Atoms ---
const baseUserListsAtom = atom<List[] | null>(null);
export const userListsLoadingAtom = atom<boolean>(false);
export const userListsErrorAtom = atom<string | null>(null);

export const userListsAtom: LocalDataAtom<List[]> = atom(
    (get) => get(baseUserListsAtom),
    (get, set, update) => {
        if (update === RESET) {
            const service = storageManager.get();
            set(baseUserListsAtom, [...service.fetchLists()]);
            return;
        }
        const nextLists = typeof update === 'function'
            ? (update as (prev: List[] | null) => List[])(get(baseUserListsAtom))
            : update;

        set(baseUserListsAtom, nextLists);
    }
);
userListsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};

// Note: userListNamesAtom and userTagNamesAtom are in derived.ts to avoid circular dependencies
