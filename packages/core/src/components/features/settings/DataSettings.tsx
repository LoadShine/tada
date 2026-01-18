import React, { memo, useCallback, useState, useRef } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
    addNotificationAtom,
    tasksAtom,
    userListsAtom,
    storedSummariesAtom,
    appearanceSettingsAtom,
    preferencesSettingsAtom,
    aiSettingsAtom
} from '@/store/jotai.ts';
import { ExportedData, ImportOptions, ConflictResolution, DataConflict } from '@/types';
import Icon from '@/components/ui/Icon.tsx';
import Button from '@/components/ui/Button.tsx';
import { twMerge } from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as RadixSwitch from '@radix-ui/react-switch';
import { useTranslation } from "react-i18next";
import storageManager from '@/services/storageManager';
import { syncTasksToServer, getCalendarUrl, testServerConnection } from '@/services/icsService';

/**
 * A generic row component for settings pages, providing a consistent layout
 * for a label, description, and an action/control area.
 */
const SettingsRow: React.FC<{
    label: string,
    value?: React.ReactNode,
    action?: React.ReactNode,
    children?: React.ReactNode,
    description?: string,
    htmlFor?: string,
}> = memo(({ label, value, action, children, description, htmlFor }) => (
    <div className="flex justify-between items-center py-3 min-h-[48px]">
        <div className="flex-1 mr-4">
            <label htmlFor={htmlFor}
                className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal block cursor-default">{label}</label>
            {description &&
                <p className="text-[11px] text-grey-medium dark:text-neutral-400 mt-0.5 font-light">{description}</p>}
        </div>
        <div
            className="text-[13px] text-grey-dark dark:text-neutral-200 font-light flex items-center space-x-2 flex-shrink-0">
            {value && !action && !children &&
                <span className="text-grey-medium dark:text-neutral-300 text-right font-normal">{value}</span>}
            {action && !children && <div className="flex justify-end">{action}</div>}
            {children && <div className="flex justify-end items-center space-x-2">{children}</div>}
        </div>
    </div>
));
SettingsRow.displayName = 'SettingsRow';

/**
 * Component for handling conflicts during import
 */
const ConflictResolutionDialog: React.FC<{
    conflicts: DataConflict[];
    onResolve: (resolutions: Map<string, ConflictResolution>) => void;
    onCancel: () => void;
}> = memo(({ conflicts, onResolve, onCancel }) => {
    const { t } = useTranslation();
    const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());

    const handleResolutionChange = useCallback((conflictId: string, resolution: ConflictResolution) => {
        setResolutions(prev => new Map(prev.set(conflictId, resolution)));
    }, []);

    const handleResolveAll = useCallback(() => {
        onResolve(resolutions);
    }, [resolutions, onResolve]);

    return (
        <Dialog.Root open={true}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-grey-dark/30 dark:bg-black/50 z-40 backdrop-blur-sm" />
                <Dialog.Content className={twMerge(
                    "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                    "bg-white dark:bg-neutral-800 w-full max-w-2xl max-h-[80vh]",
                    "rounded-base shadow-modal flex flex-col overflow-hidden"
                )}>
                    <div className="flex items-center justify-between px-6 py-4 border-b border-grey-light dark:border-neutral-700">
                        <Dialog.Title className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">
                            {t('settings.data.conflicts.title')}
                        </Dialog.Title>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto styled-scrollbar">
                        <p className="text-[13px] text-grey-medium dark:text-neutral-400 mb-4">
                            {t('settings.data.conflicts.description', { count: conflicts.length })}
                        </p>

                        <div className="space-y-4">
                            {conflicts.map((conflict) => (
                                <div key={conflict.id} className="border border-grey-light dark:border-neutral-700 rounded-base p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[14px] font-medium text-grey-dark dark:text-neutral-100">
                                            {conflict.type === 'task' ? conflict.local.title : conflict.local.name}
                                        </h4>
                                        <span className="text-[11px] text-grey-medium dark:text-neutral-400 bg-grey-ultra-light dark:bg-neutral-700 px-2 py-1 rounded">
                                            {conflict.type}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-[12px] mb-3">
                                        <div>
                                            <div className="font-medium text-grey-dark dark:text-neutral-200 mb-1">
                                                {t('settings.data.conflicts.local')}
                                            </div>
                                            <div className="text-grey-medium dark:text-neutral-400">
                                                {t('settings.data.conflicts.updatedAt')}: {new Date(conflict.local.updatedAt || conflict.local.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-medium text-grey-dark dark:text-neutral-200 mb-1">
                                                {t('settings.data.conflicts.imported')}
                                            </div>
                                            <div className="text-grey-medium dark:text-neutral-400">
                                                {t('settings.data.conflicts.updatedAt')}: {new Date(conflict.imported.updatedAt || conflict.imported.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <RadioGroup.Root
                                        value={resolutions.get(conflict.id) || 'keep-newer'}
                                        onValueChange={(value: ConflictResolution) => handleResolutionChange(conflict.id, value)}
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroup.Item
                                                value="keep-local"
                                                className="w-4 h-4 rounded-full border border-grey-medium dark:border-neutral-400 flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            >
                                                <RadioGroup.Indicator className="w-2 h-2 rounded-full bg-white" />
                                            </RadioGroup.Item>
                                            <label className="text-[12px] text-grey-dark dark:text-neutral-200">
                                                {t('settings.data.conflicts.keepLocal')}
                                            </label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroup.Item
                                                value="keep-imported"
                                                className="w-4 h-4 rounded-full border border-grey-medium dark:border-neutral-400 flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            >
                                                <RadioGroup.Indicator className="w-2 h-2 rounded-full bg-white" />
                                            </RadioGroup.Item>
                                            <label className="text-[12px] text-grey-dark dark:text-neutral-200">
                                                {t('settings.data.conflicts.keepImported')}
                                            </label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroup.Item
                                                value="keep-newer"
                                                className="w-4 h-4 rounded-full border border-grey-medium dark:border-neutral-400 flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            >
                                                <RadioGroup.Indicator className="w-2 h-2 rounded-full bg-white" />
                                            </RadioGroup.Item>
                                            <label className="text-[12px] text-grey-dark dark:text-neutral-200">
                                                {t('settings.data.conflicts.keepNewer')}
                                            </label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroup.Item
                                                value="skip"
                                                className="w-4 h-4 rounded-full border border-grey-medium dark:border-neutral-400 flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            >
                                                <RadioGroup.Indicator className="w-2 h-2 rounded-full bg-white" />
                                            </RadioGroup.Item>
                                            <label className="text-[12px] text-grey-dark dark:text-neutral-200">
                                                {t('settings.data.conflicts.skip')}
                                            </label>
                                        </div>
                                    </RadioGroup.Root>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-grey-light dark:border-neutral-700">
                        <Button variant="ghost" onClick={onCancel}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleResolveAll}>
                            {t('settings.data.conflicts.resolve')}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
});
ConflictResolutionDialog.displayName = 'ConflictResolutionDialog';

/**
 * Data management settings component with import/export functionality
 */
const DataSettings: React.FC = () => {
    const { t } = useTranslation();
    const addNotification = useSetAtom(addNotificationAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const [, setLists] = useAtom(userListsAtom);
    const [, setSummaries] = useAtom(storedSummariesAtom);
    const [, setAppearanceSettings] = useAtom(appearanceSettingsAtom);
    const [, setPreferencesSettings] = useAtom(preferencesSettingsAtom);
    const [, setAISettings] = useAtom(aiSettingsAtom);

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [conflicts, setConflicts] = useState<DataConflict[]>([]);
    const [pendingImport, setPendingImport] = useState<{ data: ExportedData; options: ImportOptions } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ICS Calendar Sync
    const tasks = useAtomValue(tasksAtom);
    const [icsServerUrl, setIcsServerUrl] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('tada-ics-server-url') || '' : ''
    );
    const [isSyncingIcs, setIsSyncingIcs] = useState(false);
    const [showIcsUrl, setShowIcsUrl] = useState(false);

    const handleIcsServerUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setIcsServerUrl(url);
        localStorage.setItem('tada-ics-server-url', url);
    }, []);

    const handleSyncIcs = useCallback(async () => {
        if (!icsServerUrl || !tasks) return;

        setIsSyncingIcs(true);
        try {
            // Test connection first
            const isConnected = await testServerConnection(icsServerUrl);
            if (!isConnected) {
                addNotification({ type: 'error', message: t('settings.data.ics.connectionFailed') });
                return;
            }

            const result = await syncTasksToServer(tasks, icsServerUrl);
            if (result.success) {
                addNotification({
                    type: 'success',
                    message: t('settings.data.ics.syncSuccess', { count: result.tasksWithDueDate || 0 })
                });
                setShowIcsUrl(true);
            } else {
                addNotification({ type: 'error', message: result.error || t('settings.data.ics.syncError') });
            }
        } catch (error) {
            addNotification({ type: 'error', message: t('settings.data.ics.syncError') });
        } finally {
            setIsSyncingIcs(false);
        }
    }, [icsServerUrl, tasks, addNotification, t]);

    const handleCopyIcsUrl = useCallback(async () => {
        const url = getCalendarUrl(icsServerUrl);
        try {
            // 优先使用 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url);
            } else {
                // HTTP 环境下的降级方案
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            addNotification({ type: 'success', message: t('settings.data.ics.urlCopied') });
        } catch (err) {
            addNotification({ type: 'error', message: 'Copy failed' });
        }
    }, [icsServerUrl, addNotification, t]);

    const handleExportData = useCallback(async () => {
        try {
            setIsExporting(true);
            const storage = storageManager.get();
            const exportedData = storage.exportData();

            const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tada-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addNotification({
                type: 'success',
                message: t('settings.data.export.success')
            });
        } catch (error) {
            console.error('Export failed:', error);
            addNotification({
                type: 'error',
                message: t('settings.data.export.error')
            });
        } finally {
            setIsExporting(false);
        }
    }, [addNotification, t]);

    const handleImportFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string) as ExportedData;

                if (!data || !data.version || !data.data) {
                    throw new Error('Invalid file format');
                }

                // Default import options
                const options: ImportOptions = {
                    includeEcho: true,
                    includeSettings: true,
                    includeLists: true,
                    includeTasks: true,
                    includeSummaries: true,
                    conflictResolution: 'keep-newer',
                    replaceAllData: false
                };

                // Analyze for conflicts
                const storage = storageManager.get();
                const detectedConflicts = storage.analyzeImport(data, options);

                if (detectedConflicts.length > 0) {
                    setConflicts(detectedConflicts);
                    setPendingImport({ data, options });
                } else {
                    // No conflicts, proceed with import
                    performImport(data, options);
                }

            } catch (error) {
                console.error('Import file parsing failed:', error);
                addNotification({
                    type: 'error',
                    message: t('settings.data.import.invalidFile')
                });
            }
        };
        reader.readAsText(file);
    }, [addNotification, t]);

    const performImport = useCallback((data: ExportedData, options: ImportOptions, conflictResolutions?: Map<string, ConflictResolution>) => {
        try {
            setIsImporting(true);
            const storage = storageManager.get();
            const result = storage.importData(data, options, conflictResolutions);

            if (result.success) {
                // Refresh all atoms to reflect imported data
                setTasks(storage.fetchTasks());
                setLists(storage.fetchLists());
                setSummaries(storage.fetchSummaries());

                const settings = storage.fetchSettings();
                setAppearanceSettings(settings.appearance);
                setPreferencesSettings(settings.preferences);
                setAISettings(settings.ai);

                addNotification({
                    type: 'success',
                    message: t('settings.data.import.success', {
                        tasks: result.imported.tasks,
                        lists: result.imported.lists,
                        summaries: result.imported.summaries
                    })
                });
            } else {
                addNotification({
                    type: 'error',
                    message: result.message
                });
            }
        } catch (error) {
            console.error('Import failed:', error);
            addNotification({
                type: 'error',
                message: t('settings.data.import.error')
            });
        } finally {
            setIsImporting(false);
            setConflicts([]);
            setPendingImport(null);
        }
    }, [addNotification, t, setTasks, setLists, setSummaries, setAppearanceSettings, setPreferencesSettings, setAISettings]);

    const handleConflictsResolved = useCallback((resolutions: Map<string, ConflictResolution>) => {
        if (pendingImport) {
            performImport(pendingImport.data, pendingImport.options, resolutions);
        }
    }, [pendingImport, performImport]);

    const handleConflictsCancel = useCallback(() => {
        setConflicts([]);
        setPendingImport(null);
    }, []);

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImportFile(file);
        }
        // Reset the input so the same file can be selected again
        e.target.value = '';
    }, [handleImportFile]);

    return (
        <div className="space-y-4">
            <div className="space-y-0 divide-y divide-grey-light dark:divide-neutral-700">
                <SettingsRow
                    label={t('settings.data.export.title')}
                    description={t('settings.data.export.description')}
                    action={
                        <Button
                            onClick={handleExportData}
                            disabled={isExporting}
                            icon={isExporting ? 'loader' : 'download'}
                            variant="ghost"
                            size="sm"
                            iconProps={{
                                className: isExporting ? 'animate-spin' : undefined,
                                size: 14
                            }}
                        >
                            {t('settings.data.export.button')}
                        </Button>
                    }
                />

                <SettingsRow
                    label={t('settings.data.import.title')}
                    description={t('settings.data.import.description')}
                    action={
                        <Button
                            onClick={handleImportClick}
                            disabled={isImporting}
                            icon={isImporting ? 'loader' : 'upload'}
                            variant="ghost"
                            size="sm"
                            iconProps={{
                                className: isImporting ? 'animate-spin' : undefined,
                                size: 14
                            }}
                        >
                            {t('settings.data.import.button')}
                        </Button>
                    }
                />
            </div>

            {/* ICS Calendar Sync Section */}
            <div className="space-y-0 divide-y divide-grey-light dark:divide-neutral-700 mt-4 pt-4 border-t border-grey-light dark:border-neutral-700">
                <SettingsRow
                    label={t('settings.data.ics.title')}
                    description={t('settings.data.ics.description')}
                >
                    <input
                        type="text"
                        value={icsServerUrl}
                        onChange={handleIcsServerUrlChange}
                        placeholder={t('settings.data.ics.serverPlaceholder')}
                        className="w-[200px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 border border-grey-light dark:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                        onClick={handleSyncIcs}
                        disabled={isSyncingIcs || !icsServerUrl}
                        icon={isSyncingIcs ? 'loader' : 'refresh-cw'}
                        variant="ghost"
                        size="sm"
                        iconProps={{
                            className: isSyncingIcs ? 'animate-spin' : undefined,
                            size: 14
                        }}
                    >
                        {t('settings.data.ics.syncButton')}
                    </Button>
                </SettingsRow>

                {showIcsUrl && icsServerUrl && (
                    <SettingsRow
                        label={t('settings.data.ics.subscribeUrl')}
                        description={t('settings.data.ics.subscribeDescription')}
                    >
                        <input
                            type="text"
                            readOnly
                            value={getCalendarUrl(icsServerUrl)}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="w-[280px] h-8 px-2 text-[12px] font-mono bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 border border-grey-light dark:border-neutral-600 rounded cursor-text select-all"
                        />
                    </SettingsRow>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
            />

            {conflicts.length > 0 && (
                <ConflictResolutionDialog
                    conflicts={conflicts}
                    onResolve={handleConflictsResolved}
                    onCancel={handleConflictsCancel}
                />
            )}
        </div>
    );
};

DataSettings.displayName = 'DataSettings';
export default DataSettings;