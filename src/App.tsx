// src/App.tsx
import React, {useEffect, useRef} from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom, useSetAtom } from 'jotai';
import { currentFilterAtom, selectedTaskIdAtom, tasksAtom } from './store/atoms';
import { startOfDay } from "@/lib/utils/dateUtils"; // Assuming dateUtils is moved to lib

// Route Change Handler Component (Logic unchanged)
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
        else if (pathname === '/summary') newFilter = 'all';
        else if (pathname === '/calendar') newFilter = 'all';
        else if (pathname === '/all' || pathname === '/') newFilter = 'all';

        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            setSelectedTaskId(null);
        }
    }, [location.pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);

    return <Outlet />;
};

// List Page Wrapper Component (Logic unchanged)
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';
    if (!decodedListName) return <Navigate to="/list/Inbox" replace />;
    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter} />;
};
ListPageWrapper.displayName = 'ListPageWrapper';

// Tag Page Wrapper Component (Logic unchanged)
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';
    if (!decodedTagName) return <Navigate to="/all" replace />;
    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};
TagPageWrapper.displayName = 'TagPageWrapper';

// Daily Task Refresh Component (Logic unchanged)
const DailyTaskRefresh: React.FC = () => {
    const setTasks = useSetAtom(tasksAtom);
    const lastCheckDateRef = useRef<string>(startOfDay(new Date()).toISOString().split('T')[0]);

    useEffect(() => {
        const checkDate = () => {
            const todayDate = startOfDay(new Date()).toISOString().split('T')[0];
            if (todayDate !== lastCheckDateRef.current) {
                console.log(`Date changed from ${lastCheckDateRef.current} to ${todayDate}. Triggering task category refresh.`);
                setTasks(currentTasks => [...currentTasks]);
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

// Main Application Component (Routing structure unchanged)
const App: React.FC = () => {
    return (
        <>
            <DailyTaskRefresh />
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route element={<RouteChangeHandler/>}>
                        <Route index element={<Navigate to="/all" replace />} />
                        <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                        <Route path="today" element={<MainPage title="Today" filter="today" />} />
                        <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                        <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                        <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />
                        <Route path="summary" element={<SummaryPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="list/:listName" element={<ListPageWrapper />} />
                        <Route path="list/" element={<Navigate to="/list/Inbox" replace />} />
                        <Route path="tag/:tagName" element={<TagPageWrapper />} />
                        <Route path="tag/" element={<Navigate to="/all" replace />} />
                        <Route path="*" element={<Navigate to="/all" replace />} />
                    </Route>
                </Route>
            </Routes>
        </>
    );
};
App.displayName = 'App';
export default App;