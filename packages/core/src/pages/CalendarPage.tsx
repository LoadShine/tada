import React from 'react';
import CalendarView from "@/components/features/calendar/CalendarView.tsx";

// Simple wrapper component for the Calendar View
const CalendarPage: React.FC = () => {
    // CalendarView internally handles its state and logic (now using Radix DropdownMenu)
    return <CalendarView/>;
};
CalendarPage.displayName = 'CalendarPage';
export default CalendarPage;