import React, { lazy, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentFilterAtom, selectedTaskIdAtom } from '@/store/jotai';
import { TaskFilter } from '@/types';
import MainLayout from '@/components/features/layout/MainLayout';

// Lazy load pages
const MainPage = lazy(() => import('@/pages/MainPage'));
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));

// --- Route-specific Logic Components ---

const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        const { pathname } = location;
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';

        let newFilter: TaskFilter = 'all';
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary' || pathname === '/calendar' || pathname === '/all' || pathname === '/') newFilter = 'all';

        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            setSelectedTaskId(null);
        }
    }, [location.pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);

    return <Outlet />;
};

const ListPageWrapper: React.FC = () => {
    const { t } = useTranslation();
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';

    if (!decodedListName) return <Navigate to="/list/Inbox" replace />;

    const filter: TaskFilter = `list-${decodedListName}`;
    const title = decodedListName === 'Inbox' ? t('sidebar.inbox') : decodedListName;

    return <MainPage title={title} filter={filter} />;
};

const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';

    if (!decodedTagName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};

// --- Main Router Component ---

const AppRouter: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Routes>
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