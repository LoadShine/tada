// src/App.tsx
import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {Navigate, Outlet, Route, Routes, useLocation, useParams} from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import {TaskFilter} from './types';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    appearanceSettingsAtom,
    appearanceSettingsErrorAtom,
    appearanceSettingsLoadingAtom,
    currentFilterAtom,
    currentUserAtom,
    currentUserErrorAtom,
    currentUserLoadingAtom,
    defaultAppearanceSettingsForApi,
    defaultPreferencesSettingsForApi,
    preferencesSettingsAtom,
    preferencesSettingsErrorAtom,
    preferencesSettingsLoadingAtom,
    selectedTaskIdAtom,
    storedSummariesAtom,
    storedSummariesErrorAtom,
    storedSummariesLoadingAtom,
    tasksAtom,
    tasksErrorAtom,
    tasksLoadingAtom,
    userListsAtom,
} from './store/atoms';
import {startOfDay} from "@/utils/dateUtils";
import {APP_THEMES} from "@/config/themes";
import Icon from "@/components/common/Icon";
import {AnimatePresence, motion} from "framer-motion";
import {twMerge} from "tailwind-merge";

const MainPage = lazy(() => import('./pages/MainPage'));
const SummaryPage = lazy(() => import('./pages/SummaryPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));

const AppLoadingSpinner: React.FC = () => (
    <div
        className="fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-grey-deep/80 z-[20000] backdrop-blur-sm">
        <Icon name="loader" size={32} className="text-primary dark:text-primary-light animate-spin" strokeWidth={1.5}/>
    </div>
);

const SettingsApplicator: React.FC = () => {
    const loadedAppearance = useAtomValue(appearanceSettingsAtom);
    const loadedPreferences = useAtomValue(preferencesSettingsAtom);

    const appearance = loadedAppearance ?? defaultAppearanceSettingsForApi();
    const preferences = loadedPreferences ?? defaultPreferencesSettingsForApi();

    useEffect(() => {
        const applyDarkMode = (mode: 'light' | 'dark' | 'system') => {
            if (mode === 'system') {
                const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', systemPrefersDark);
            } else {
                document.documentElement.classList.toggle('dark', mode === 'dark');
            }
        };
        applyDarkMode(appearance.darkMode);

        let mediaQueryListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | undefined;
        if (appearance.darkMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQueryListener = () => applyDarkMode('system');
            mediaQuery.addEventListener('change', mediaQueryListener);
        }

        const selectedTheme = APP_THEMES.find(theme => theme.id === appearance.themeId) || APP_THEMES[0];
        document.documentElement.style.setProperty('--color-primary-hsl', selectedTheme.colors.primary);
        document.documentElement.style.setProperty('--color-primary-light-hsl', selectedTheme.colors.light);
        document.documentElement.style.setProperty('--color-primary-dark-hsl', selectedTheme.colors.dark);

        if (appearance.backgroundImageUrl && appearance.backgroundImageUrl !== 'none') {
            document.body.style.backgroundImage = `url('${appearance.backgroundImageUrl}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';

            const filterValue = `brightness(${appearance.backgroundImageBrightness}%) ${appearance.backgroundImageBlur > 0 ? `blur(${appearance.backgroundImageBlur}px)` : ''}`;
            document.body.style.filter = filterValue.trim();
        } else {
            document.body.style.backgroundImage = 'none';
            document.body.style.filter = 'none';
        }

        return () => {
            if (mediaQueryListener && appearance && appearance.darkMode === 'system') {
                window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
            }
        };
    }, [appearance]);

    useEffect(() => {
        document.documentElement.lang = preferences.language;
    }, [preferences]);

    return null;
};
SettingsApplicator.displayName = 'SettingsApplicator';

const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const location = useLocation();
    const params = useParams();
    useEffect(() => {
        const {pathname} = location;
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';
        let newFilter: TaskFilter = 'all';
        if (pathname === '/today') newFilter = 'today'; else if (pathname === '/next7days') newFilter = 'next7days'; else if (pathname === '/completed') newFilter = 'completed'; else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`; else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary') newFilter = 'all'; else if (pathname === '/calendar') newFilter = 'all'; else if (pathname === '/all' || pathname === '/') newFilter = 'all';
        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            setSelectedTaskId(null);
        }
    }, [location.pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);
    return <Outlet/>;
};
RouteChangeHandler.displayName = 'RouteChangeHandler';

const ListPageWrapper: React.FC = () => {
    const {listName} = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';
    if (!decodedListName) return <Navigate to="/list/Inbox" replace/>;
    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter}/>;
};
ListPageWrapper.displayName = 'ListPageWrapper';

const TagPageWrapper: React.FC = () => {
    const {tagName} = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';
    if (!decodedTagName) return <Navigate to="/all" replace/>;
    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter}/>;
};
TagPageWrapper.displayName = 'TagPageWrapper';

const DailyTaskRefresh: React.FC = () => {
    const setTasks = useSetAtom(tasksAtom);
    const lastCheckDateRef = useRef<string>(startOfDay(new Date()).toISOString().split('T')[0]);
    useEffect(() => {
        const checkDate = () => {
            const todayDate = startOfDay(new Date()).toISOString().split('T')[0];
            if (todayDate !== lastCheckDateRef.current) {
                console.log(`Date changed from ${lastCheckDateRef.current} to ${todayDate}. Triggering task category refresh.`);
                setTasks(currentTasks => [...(currentTasks ?? [])]);
                lastCheckDateRef.current = todayDate;
            }
        };
        checkDate();
        const intervalId = setInterval(checkDate, 60 * 1000);
        window.addEventListener('focus', checkDate);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', checkDate);
        };
    }, [setTasks]);
    return null;
};
DailyTaskRefresh.displayName = 'DailyTaskRefresh';

interface Notification {
    id: number;
    type: 'loading' | 'error';
    message: string;
}

const GlobalStatusDisplay: React.FC = () => {
    const isLoadingCurrentUser = useAtomValue(currentUserLoadingAtom);
    const isLoadingTasks = useAtomValue(tasksLoadingAtom);
    const isLoadingAppearance = useAtomValue(appearanceSettingsLoadingAtom);
    const isLoadingPreferences = useAtomValue(preferencesSettingsLoadingAtom);
    const isLoadingSummaries = useAtomValue(storedSummariesLoadingAtom);
    const anyLoading = isLoadingCurrentUser || isLoadingTasks || isLoadingAppearance || isLoadingPreferences || isLoadingSummaries;

    const errorCurrentUser = useAtomValue(currentUserErrorAtom);
    const errorTasks = useAtomValue(tasksErrorAtom);
    const errorAppearance = useAtomValue(appearanceSettingsErrorAtom);
    const errorPreferences = useAtomValue(preferencesSettingsErrorAtom);
    const errorSummaries = useAtomValue(storedSummariesErrorAtom);

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const existingErrorMessages = useRef(new Set<string>());

    useEffect(() => {
        const errors = [
            errorCurrentUser, errorTasks, errorAppearance, errorPreferences, errorSummaries
        ].filter((e): e is string => typeof e === 'string');

        errors.forEach(errorMsg => {
            if (!existingErrorMessages.current.has(errorMsg)) {
                const newNotification: Notification = {
                    id: Date.now() + Math.random(),
                    type: 'error',
                    message: errorMsg,
                };
                setNotifications(prev => [...prev, newNotification]);
                existingErrorMessages.current.add(errorMsg);

                setTimeout(() => {
                    removeNotification(newNotification.id);
                }, 5000); // Auto-dismiss after 5 seconds
            }
        });
    }, [errorCurrentUser, errorTasks, errorAppearance, errorPreferences, errorSummaries]);

    const removeNotification = (id: number) => {
        setNotifications(prev => {
            const notificationToRemove = prev.find(n => n.id === id);
            if (notificationToRemove) {
                existingErrorMessages.current.delete(notificationToRemove.message);
            }
            return prev.filter(n => n.id !== id);
        });
    };

    if (!anyLoading && notifications.length === 0) return null;

    return (
        <div
            className="fixed bottom-4 right-4 z-[10000] space-y-2 max-w-sm w-full flex flex-col items-end">
            <AnimatePresence>
                {anyLoading && (
                    <motion.div
                        key="loading-indicator"
                        initial={{opacity: 0, y: 10, scale: 0.95}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, y: 10, scale: 0.95}}
                        transition={{duration: 0.2, ease: "easeOut"}}
                        className="p-3 bg-neutral-800 text-white rounded-lg shadow-xl text-xs flex items-center w-fit"
                    >
                        <Icon name="loader" size={14} className="animate-spin mr-2"/>
                        <span>Loading application data...</span>
                    </motion.div>
                )}
                {notifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        layout
                        initial={{opacity: 0, y: 10, scale: 0.95}}
                        animate={{opacity: 1, y: 0, scale: 1}}
                        exit={{opacity: 0, x: 20, scale: 0.95}}
                        transition={{duration: 0.2, ease: "easeOut"}}
                        className={twMerge(
                            "group p-3 rounded-lg shadow-xl text-xs w-full flex items-start relative",
                            notification.type === 'error' && "bg-error/10 border border-error/20 text-error-dark dark:bg-error/20 dark:border-error/30 dark:text-red-300"
                        )}
                    >
                        <Icon name="alert-circle" size={14}
                              className="mr-2 mt-px flex-shrink-0 text-error dark:text-red-400"/>
                        <span className="flex-1 break-words">{notification.message}</span>
                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="ml-2 -mr-1 -mt-1 p-1 rounded-full opacity-50 group-hover:opacity-100 hover:bg-black/10 transition-opacity"
                            aria-label="Close notification"
                        >
                            <Icon name="x" size={12} strokeWidth={2}/>
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
GlobalStatusDisplay.displayName = 'GlobalStatusDisplay';


const ProtectedRoute: React.FC = () => {
    const currentUser = useAtomValue(currentUserAtom);
    const isLoadingUser = useAtomValue(currentUserLoadingAtom);
    const location = useLocation();

    if (isLoadingUser) {
        return <AppLoadingSpinner/>;
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{from: location}} replace/>;
    }
    return <Outlet/>;
};
ProtectedRoute.displayName = 'ProtectedRoute';

const App: React.FC = () => {
    // These calls ensure the atoms are initialized and start fetching data on app load if necessary.
    useAtomValue(currentUserAtom);
    useAtomValue(tasksAtom);
    useAtomValue(userListsAtom);
    useAtomValue(appearanceSettingsAtom);
    useAtomValue(preferencesSettingsAtom);
    useAtomValue(storedSummariesAtom);

    return (
        <>
            <SettingsApplicator/>
            <DailyTaskRefresh/>
            <GlobalStatusDisplay/>
            <Suspense fallback={<AppLoadingSpinner/>}>
                <Routes>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/register" element={<RegisterPage/>}/>
                    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
                    {/* The /reset-password/:token route is removed as the flow is now handled by forgot-password */}

                    <Route element={<ProtectedRoute/>}>
                        <Route path="/" element={<MainLayout/>}>
                            <Route element={<RouteChangeHandler/>}>
                                <Route index element={<Navigate to="/all" replace/>}/>
                                <Route path="all" element={<MainPage title="All Tasks" filter="all"/>}/>
                                <Route path="today" element={<MainPage title="Today" filter="today"/>}/>
                                <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days"/>}/>
                                <Route path="completed" element={<MainPage title="Completed" filter="completed"/>}/>
                                <Route path="trash" element={<MainPage title="Trash" filter="trash"/>}/>
                                <Route path="summary" element={<SummaryPage/>}/>
                                <Route path="calendar" element={<CalendarPage/>}/>
                                <Route path="list/:listName" element={<ListPageWrapper/>}/>
                                <Route path="list/" element={<Navigate to="/list/Inbox" replace/>}/>
                                <Route path="tag/:tagName" element={<TagPageWrapper/>}/>
                                <Route path="tag/" element={<Navigate to="/all" replace/>}/>
                                <Route path="*" element={<Navigate to="/all" replace/>}/>
                            </Route>
                        </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/login" replace/>}/>
                </Routes>
            </Suspense>
        </>
    );
};
App.displayName = 'App';
export default App;