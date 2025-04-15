// src/pages/CalendarPage.tsx
import React from 'react';
import CalendarView from '../components/calendar/CalendarView';

const CalendarPage: React.FC = () => {
    // This page implicitly uses the 'all' filter logic within CalendarView
    // No specific filter needs to be set globally here unless CalendarView relies on it
    return <CalendarView />;
};

export default CalendarPage;