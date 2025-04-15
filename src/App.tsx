// src/App.tsx
import React from 'react';
import { Routes, Route, useParams, Navigate, useLocation } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useSetAtom } from 'jotai'; // Use useSetAtom for setting state without subscribing
import { currentFilterAtom } from './store/atoms';

// Helper component remains the same, sets filter based on route
const FilterSetter: React.FC<{ filter: TaskFilter; children: React.ReactElement }> = ({ filter, children }) => {
    const setCurrentFilter = useSetAtom(currentFilterAtom);
    const location = useLocation(); // Use location to trigger effect on path change

    React.useEffect(() => {
        setCurrentFilter(filter);
    }, [filter, setCurrentFilter, location.pathname]); // Depend on pathname change

    return children;
};

// Helper component for List routes
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    if (!listName) return <Navigate to="/" replace />; // Redirect if no list name
    const filter: TaskFilter = `list-${listName}`;
    const decodedListName = decodeURIComponent(listName); // Decode potentially encoded names
    return (
        <FilterSetter filter={filter}>
            <MainPage title={decodedListName} filter={filter} />
        </FilterSetter>
    );
};

// Helper component for Tag routes
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    if (!tagName) return <Navigate to="/" replace />; // Redirect if no tag name
    const filter: TaskFilter = `tag-${tagName}`;
    const decodedTagName = decodeURIComponent(tagName);
    return (
        <FilterSetter filter={filter}>
            <MainPage title={`#${decodedTagName}`} filter={filter} />
        </FilterSetter>
    );
};

const App: React.FC = () => {
    return (
        <Routes>
            {/* MainLayout wraps all pages */}
            <Route path="/" element={<MainLayout />}>
                {/* Index route defaults to 'all' filter (All Tasks) */}
                <Route index element={
                    <FilterSetter filter="all">
                        <MainPage title="All Tasks" filter="all" />
                    </FilterSetter>}
                />
                {/* Define routes for main filters */}
                {/* 'all' is handled by index route now */}
                <Route path="today" element={
                    <FilterSetter filter="today">
                        <MainPage title="Today" filter="today" />
                    </FilterSetter>}
                />
                <Route path="next7days" element={
                    <FilterSetter filter="next7days">
                        <MainPage title="Upcoming" filter="next7days" />
                    </FilterSetter>}
                />
                <Route path="completed" element={
                    <FilterSetter filter="completed">
                        <MainPage title="Completed" filter="completed" />
                    </FilterSetter>}
                />
                <Route path="trash" element={
                    <FilterSetter filter="trash">
                        <MainPage title="Trash" filter="trash" />
                    </FilterSetter>}
                />
                {/* Dynamic routes for lists and tags */}
                {/* Ensure listName/tagName can handle special characters if needed */}
                <Route path="list/:listName" element={<ListPageWrapper />} />
                <Route path="tag/:tagName" element={<TagPageWrapper />} />

                {/* Standalone Pages (don't need filter setting via wrapper) */}
                <Route path="summary" element={<SummaryPage />} />
                <Route path="calendar" element={<CalendarPage />} />

                {/* Fallback route - Navigate to index ('all' tasks) */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};

export default App;