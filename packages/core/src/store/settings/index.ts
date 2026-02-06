// Settings module exports
export type { DarkModeOption } from './appearance';
export {
    defaultAppearanceSettingsForApi,
    appearanceSettingsLoadingAtom,
    appearanceSettingsErrorAtom,
    appearanceSettingsAtom
} from './appearance';

export type { DefaultNewTaskDueDate } from './preferences';
export {
    defaultPreferencesSettingsForApi,
    preferencesSettingsLoadingAtom,
    preferencesSettingsErrorAtom,
    preferencesSettingsAtom
} from './preferences';

export {
    defaultAISettingsForApi,
    aiSettingsLoadingAtom,
    aiSettingsErrorAtom,
    aiSettingsAtom
} from './ai';

export {
    defaultProxySettingsForApi,
    proxySettingsAtom
} from './proxy';
