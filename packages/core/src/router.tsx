import React, { lazy, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentFilterAtom, selectedTaskIdAtom } from '@/store/jotai';
import { TaskFilter } from '@/types';
import MainLayout from '@/components/features/layout/MainLayout';

// Lazy load pages for better initial load performance.
const MainPage = lazy(() => import('@/pages/MainPage'));
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const ZenPage = lazy(() => import('@/pages/ZenPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const TermsOfUsePage = lazy(() => import('@/pages/TermsOfUsePage'));
const ChangelogPage = lazy(() => import('@/pages/ChangelogPage'));
const EchoPage = lazy(() => import('@/pages/EchoPage')); // Added Echo Page

/**
 * A component that listens for route changes and updates global state accordingly.
 * It synchronizes the `currentFilterAtom` with the URL and resets the `selectedTaskIdAtom`
 * when the main filter changes.
 */
const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const location = useLocation();
    const pathname = location.pathname;
    const params = useParams();

    useEffect(() => {
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';

        let newFilter: TaskFilter = 'all';
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary' || pathname === '/calendar' || pathname === '/zen' || pathname === '/echo' || pathname === '/all' || pathname === '/') newFilter = 'all';

        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            setSelectedTaskId(null); // Deselect task when filter changes
        }
    }, [pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);

    return <Outlet />;
};

/**
 * A wrapper component to render the MainPage for list-based routes (e.g., /list/Inbox).
 * It extracts the list name from the URL parameters to set the title and filter.
 */
const ListPageWrapper: React.FC = () => {
    const { t } = useTranslation();
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';

    if (!decodedListName) return <Navigate to="/list/Inbox" replace />;

    const filter: TaskFilter = `list-${decodedListName}`;
    const title = decodedListName === 'Inbox' ? t('sidebar.inbox') : decodedListName;

    return <MainPage title={title} filter={filter} />;
};

/**
 * A wrapper component to render the MainPage for tag-based routes (e.g., /tag/urgent).
 * It extracts the tag name from the URL parameters to set the title and filter.
 */
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';

    if (!decodedTagName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};

/**
 * The main application router component.
 * It defines all available routes and wraps them in the `MainLayout`.
 */
const AppRouter: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Routes>
            {/* Standalone pages without main layout */}
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-use" element={<TermsOfUsePage />} />
            <Route path="/changelog" element={<ChangelogPage />} />

            {/* Main application routes with layout */}
            <Route path="/" element={<MainLayout />}>
                <Route element={<RouteChangeHandler />}>
                    <Route index element={<Navigate to="/all" replace />} />
                    <Route path="all" element={<MainPage title={t('sidebar.allTasks')} filter="all" />} />
                    <Route path="today" element={<MainPage title={t('sidebar.today')} filter="today" />} />
                    <Route path="next7days" element={<MainPage title={t('sidebar.next7days')} filter="next7days" />} />
                    <Route path="completed" element={<MainPage title={t('sidebar.completed')} filter="completed" />} />
                    <Route path="trash" element={<MainPage title={t('sidebar.trash')} filter="trash" />} />
                    <Route path="summary" element={<SummaryPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="zen" element={<ZenPage />} />
                    <Route path="echo" element={<EchoPage />} />
                    <Route path="list/:listName" element={<ListPageWrapper />} />
                    <Route path="list/" element={<Navigate to="/list/Inbox" replace />} />
                    <Route path="tag/:tagName" element={<TagPageWrapper />} />
                    <Route path="tag/" element={<Navigate to="/all" replace />} />
                    <Route path="*" element={<Navigate to="/all" replace />} />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/all" replace />} />
        </Routes>
    );
};

export default AppRouter;
