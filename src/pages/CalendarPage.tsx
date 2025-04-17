// src/pages/CalendarPage.tsx
import React from 'react';
import CalendarView from '../components/calendar/CalendarView';

const CalendarPage: React.FC = () => {
    // CalendarView is self-contained and handles its layout within the main content area
    return <CalendarView />;
};

export default CalendarPage;