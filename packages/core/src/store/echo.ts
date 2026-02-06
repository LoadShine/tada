import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { EchoReport } from '@/types';
import storageManager from '@/services/storageManager';
import { LocalDataAtom } from './types';

// --- Echo Feature Atoms ---
const baseEchoReportsAtom = atom<EchoReport[] | null>(null);

export const echoReportsAtom: LocalDataAtom<EchoReport[]> = atom(
    (get) => get(baseEchoReportsAtom),
    (get, set, update) => {
        const service = storageManager.get();
        if (update === RESET) {
            set(baseEchoReportsAtom, service.fetchEchoReports());
            return;
        }
        const updatedReports = typeof update === 'function' ? (update as (prev: EchoReport[] | null) => EchoReport[])(get(baseEchoReportsAtom) ?? []) : update;
        set(baseEchoReportsAtom, updatedReports);
    }
);
echoReportsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};
