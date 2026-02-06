import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { UserProfile, createDefaultUserProfile } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from './types';

// --- User Profile Atom ---
const baseUserProfileAtom = atom<UserProfile | null>(null);
export const userProfileLoadingAtom = atom<boolean>(false);

/**
 * The main atom for managing the user profile (onboarding data).
 */
export const userProfileAtom: LocalDataAtom<UserProfile> = atom(
    (get) => get(baseUserProfileAtom),
    (get, set, update) => {
        if (update === RESET) {
            const service = storageManager.get();
            const profile = service.fetchUserProfile();
            set(baseUserProfileAtom, profile ?? createDefaultUserProfile());
            return;
        }
        const currentProfile = get(baseUserProfileAtom) ?? createDefaultUserProfile();
        const updatedProfile = typeof update === 'function'
            ? (update as (prev: UserProfile | null) => UserProfile)(currentProfile)
            : update;

        const savedProfile = storageManager.get().updateUserProfile(updatedProfile);
        set(baseUserProfileAtom, savedProfile);
    }
);
userProfileAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
