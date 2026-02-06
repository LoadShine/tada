/**
 * Unified store exports.
 * 
 * This file re-exports all atoms from the modular store files
 * to maintain backward compatibility with existing imports from '@/store/jotai'.
 */

// Types
export type { Notification, LocalDataAtom } from './types';

// User Profile
export { userProfileLoadingAtom, userProfileAtom } from './user';

// Tasks
export {
    getTaskGroupCategory,
    tasksLoadingAtom,
    tasksErrorAtom,
    tasksAtom,
    selectedTaskIdAtom,
    selectedTaskAtom,
    groupedAllTasksAtom
} from './tasks';

// Lists
export {
    userListsLoadingAtom,
    userListsErrorAtom,
    userListsAtom
} from './lists';

// Derived atoms (depend on multiple modules)
export {
    userListNamesAtom,
    userTagNamesAtom,
    taskCountsAtom,
    rawSearchResultsAtom
} from './derived';

// UI State
export {
    isSettingsOpenAtom,
    settingsSelectedTabAtom,
    isAddListModalOpenAtom,
    currentFilterAtom,
    searchTermAtom,
    notificationsAtom,
    isZenFullScreenAtom,
    aiConnectionStatusAtom,
    aiListAnalyzingTaskIdsAtom,
    scheduledReportModalAtom,
    selectedEchoReportIdAtom,
    selectedSummaryIdAtom,
    addNotificationAtom
} from './ui';

// Settings
export type { DarkModeOption, DefaultNewTaskDueDate } from './settings';
export {
    defaultAppearanceSettingsForApi,
    appearanceSettingsLoadingAtom,
    appearanceSettingsErrorAtom,
    appearanceSettingsAtom,
    defaultPreferencesSettingsForApi,
    preferencesSettingsLoadingAtom,
    preferencesSettingsErrorAtom,
    preferencesSettingsAtom,
    defaultAISettingsForApi,
    aiSettingsLoadingAtom,
    aiSettingsErrorAtom,
    aiSettingsAtom,
    defaultProxySettingsForApi,
    proxySettingsAtom
} from './settings';

// Summary
export type { SummaryPeriodKey, SummaryPeriodOption } from './summary';
export {
    summaryPeriodFilterAtom,
    summaryListFilterAtom,
    summarySelectedTaskIdsAtom,
    summarySelectedFutureTaskIdsAtom,
    storedSummariesLoadingAtom,
    storedSummariesErrorAtom,
    storedSummariesAtom,
    currentSummaryIndexAtom,
    isGeneratingSummaryAtom,
    filteredTasksForSummaryAtom,
    futureTasksForSummaryAtom,
    currentSummaryFilterKeyAtom,
    relevantStoredSummariesAtom,
    currentDisplayedSummaryAtom,
    referencedTasksForSummaryAtom
} from './summary';

// Echo
export { echoReportsAtom } from './echo';

// Data Import/Export
export {
    isImportingAtom,
    isExportingAtom,
    importProgressAtom,
    exportProgressAtom,
    exportDataAtom,
    importDataAtom,
    analyzeImportAtom
} from './data';
