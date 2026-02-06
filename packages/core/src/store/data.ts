import { atom } from 'jotai';
import { RESET } from 'jotai/utils';
import { ExportedData, ImportOptions, ConflictResolution, ImportResult } from '@/types';
import storageManager from '@/services/storageManager';
import { addNotificationAtom } from './ui';
import { tasksAtom } from './tasks';
import { userListsAtom } from './lists';
import { storedSummariesAtom } from './summary';
import { echoReportsAtom } from './echo';
import {
    appearanceSettingsAtom,
    preferencesSettingsAtom,
    aiSettingsAtom,
    proxySettingsAtom
} from './settings';

// --- Import/Export State Atoms ---
export const isImportingAtom = atom<boolean>(false);
export const isExportingAtom = atom<boolean>(false);
export const importProgressAtom = atom<number>(0);
export const exportProgressAtom = atom<number>(0);

export const exportDataAtom = atom(
    null,
    (get, set) => {
        try {
            set(isExportingAtom, true);
            const service = storageManager.get();
            const exportedData = service.exportData();

            const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tada-backup-${new Date().toISOString().split('T')[0]}.json`;

            if (typeof document !== 'undefined') {
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            set(addNotificationAtom, {
                type: 'success',
                message: 'Data exported successfully'
            });

        } catch (error) {
            console.error('Export failed:', error);
            set(addNotificationAtom, {
                type: 'error',
                message: 'Failed to export data'
            });
        } finally {
            set(isExportingAtom, false);
        }
    }
);

export const importDataAtom = atom(
    null,
    (get, set, { data, options, conflictResolutions }: {
        data: ExportedData;
        options: ImportOptions;
        conflictResolutions?: Map<string, ConflictResolution>
    }) => {
        try {
            set(isImportingAtom, true);
            const service = storageManager.get();
            const result = service.importData(data, options, conflictResolutions);

            if (result.success) {
                set(tasksAtom, RESET);
                set(userListsAtom, RESET);
                set(storedSummariesAtom, RESET);
                set(echoReportsAtom, RESET);
                set(appearanceSettingsAtom, RESET);
                set(preferencesSettingsAtom, RESET);
                set(aiSettingsAtom, RESET);
                set(proxySettingsAtom, RESET);

                set(addNotificationAtom, {
                    type: 'success',
                    message: `Import successful: ${result.imported.tasks} tasks, ${result.imported.lists} lists, ${result.imported.summaries} summaries, ${result.imported.echo} echoes.`
                });
            } else {
                set(addNotificationAtom, {
                    type: 'error',
                    message: result.message
                });
            }

            return result;
        } catch (error) {
            console.error('Import failed:', error);
            set(addNotificationAtom, {
                type: 'error',
                message: 'Failed to import data'
            });
            return {
                success: false,
                message: 'Import failed',
                imported: { settings: 0, lists: 0, tasks: 0, summaries: 0, echo: 0 },
                conflicts: [],
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        } finally {
            set(isImportingAtom, false);
        }
    }
);

export const analyzeImportAtom = atom(
    null,
    (get, set, { data, options }: { data: ExportedData; options: ImportOptions }) => {
        try {
            const service = storageManager.get();
            return service.analyzeImport(data, options);
        } catch (error) {
            console.error('Analysis failed:', error);
            return [];
        }
    }
);
