// src/components/tasks/TaskList.tsx
import React, {useCallback, useMemo, useState, useRef, useEffect } from 'react';
import TaskItem from './TaskItem';
import {useAtomValue, useSetAtom} from 'jotai';
import { currentFilterAtom, groupedAllTasksAtom, searchTermAtom, selectedTaskIdAtom, tasksAtom, rawSearchResultsAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CustomDatePickerPopover from '../common/CustomDatePickerPopover';
import {Task, TaskGroupCategory} from '@/types';
import { closestCenter, defaultDropAnimationSideEffects, DndContext, DragEndEvent, DragOverlay, DragStartEvent, DropAnimation, KeyboardSensor, MeasuringStrategy, PointerSensor, UniqueIdentifier, useSensor, useSensors } from '@dnd-kit/core';
import {usePopper} from 'react-popper';
import {arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {AnimatePresence, motion} from 'framer-motion';
import {addDays, startOfDay, isValid, safeParseDate, isOverdue, isWithinNext7Days, isToday, isBefore} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import { TaskItemMenuProvider } from '@/context/TaskItemMenuContext';
// Removed ReactDOM import as it's no longer needed here

interface TaskListProps {
    title: string;
}

// DNDDatePickerState remains the same
interface DndDatePickerState {
    taskId: string;
    targetCategory: TaskGroupCategory;
    referenceElement: HTMLElement;
    isVisible: boolean;
}

// HeaderDatePickerState remains the same
interface HeaderDatePickerState {
    referenceElement: HTMLElement | null;
    isVisible: boolean;
}

// TaskGroupHeader remains the same
const TaskGroupHeader: React.FC<{ title: string; groupKey: TaskGroupCategory; onRescheduleAllClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }> = React.memo(({ title, groupKey, onRescheduleAllClick }) => (
    <div
        className="flex items-center justify-between px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-20"
        style={{
            backgroundColor: 'hsla(220, 40%, 98%, 0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
        }}
    >
        <span>{title}</span>
        {groupKey === 'overdue' && onRescheduleAllClick && (
            <Button
                variant="ghost" size="sm" icon="calendar-check"
                onClick={onRescheduleAllClick}
                className="text-xs !h-5 px-1.5 text-muted-foreground hover:text-primary hover:bg-primary/15 -mr-1"
                title="Reschedule all overdue tasks..."
            >
                Reschedule All
            </Button>
        )}
    </div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';

const dropAnimationConfig: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }), };
const groupTitles: Record<TaskGroupCategory, string> = { overdue: 'Overdue', today: 'Today', next7days: 'Next 7 Days', later: 'Later', nodate: 'No Date', };
const groupOrder: TaskGroupCategory[] = ['overdue', 'today', 'next7days', 'later', 'nodate'];

const TaskList: React.FC<TaskListProps> = ({title: pageTitle}) => {
    const allTasks = useAtomValue(tasksAtom);
    const setTasks = useSetAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const rawSearchResults = useAtomValue(rawSearchResultsAtom);
    const searchTerm = useAtomValue(searchTermAtom);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [dndDatePickerState, setDndDatePickerState] = useState<DndDatePickerState | null>(null);
    const [dndPopperElement, setDndPopperElement] = useState<HTMLDivElement | null>(null);

    // --- Popper for DND Date Picker (Use ABSOLUTE strategy, NO portal) ---
    const { styles: dndPopperStyles, attributes: dndPopperAttributes, update: updateDndPopper } = usePopper(
        dndDatePickerState?.referenceElement,
        dndPopperElement,
        {
            placement: 'bottom-start',
            strategy: 'absolute', // <--- Use absolute positioning
            modifiers: [
                { name: 'offset', options: { offset: [0, 8] } },
                { name: 'preventOverflow', options: { padding: 8, boundary: scrollContainerRef.current ?? undefined } },
                { name: 'flip', options: { padding: 8, boundary: scrollContainerRef.current ?? undefined, fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] } }
            ]
        }
    );
    // ---

    // --- Popper for Header Date Picker (Use ABSOLUTE strategy, NO portal) ---
    const [headerDatePickerState, setHeaderDatePickerState] = useState<HeaderDatePickerState>({ isVisible: false, referenceElement: null });
    const [headerPopperElement, setHeaderPopperElement] = useState<HTMLDivElement | null>(null);
    const { styles: headerPopperStyles, attributes: headerPopperAttributes, update: updateHeaderPopper } = usePopper(
        headerDatePickerState.referenceElement,
        headerPopperElement,
        {
            placement: 'bottom-end',
            strategy: 'absolute', // <--- Use absolute positioning
            modifiers: [
                { name: 'offset', options: { offset: [0, 8] } },
                { name: 'preventOverflow', options: { padding: 8, boundary: scrollContainerRef.current ?? undefined } },
                { name: 'flip', options: { padding: 8, boundary: scrollContainerRef.current ?? undefined, fallbackPlacements: ['top-end', 'bottom-start', 'top-start'] } }
            ]
        }
    );
    // ---

    // --- Effects to update Popper instances when they become visible (still useful for initial render) ---
    useEffect(() => {
        if (dndDatePickerState?.isVisible && scrollContainerRef.current && updateDndPopper) {
            const rafId = requestAnimationFrame(() => updateDndPopper());
            return () => cancelAnimationFrame(rafId);
        }
    }, [dndDatePickerState?.isVisible, updateDndPopper]);

    useEffect(() => {
        if (headerDatePickerState.isVisible && scrollContainerRef.current && updateHeaderPopper) {
            const rafId = requestAnimationFrame(() => updateHeaderPopper());
            return () => cancelAnimationFrame(rafId);
        }
    }, [headerDatePickerState.isVisible, updateHeaderPopper]);
    // ---

    // tasksToDisplay, isGroupedView, isSearching memo remains the same
    const {tasksToDisplay, isGroupedView, isSearching} = useMemo(() => {
        const searching = searchTerm.trim().length > 0; let displayData: Task[] | Record<TaskGroupCategory, Task[]> = []; let grouped = false;
        if (searching) { displayData = rawSearchResults; grouped = false; }
        else if (currentFilterGlobal === 'all') { displayData = groupedTasks; grouped = true; }
        else { let filtered: Task[] = []; const activeTasks = allTasks.filter((task: Task) => task.list !== 'Trash'); const trashedTasks = allTasks.filter((task: Task) => task.list === 'Trash');
            switch (currentFilterGlobal) {
                case 'today': filtered = activeTasks.filter((task: Task) => !task.completed && task.dueDate != null && isToday(task.dueDate)); break;
                case 'next7days': filtered = activeTasks.filter((task: Task) => { if (task.completed || task.dueDate == null) return false; const date = safeParseDate(task.dueDate); return date && isValid(date) && !isOverdue(date) && isWithinNext7Days(date); }); break;
                case 'completed': filtered = activeTasks.filter((task: Task) => task.completed).sort((a: Task, b: Task) => (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0)); break;
                case 'trash': filtered = trashedTasks.sort((a: Task, b: Task) => (b.updatedAt || 0) - (a.updatedAt || 0)); break;
                default: if (currentFilterGlobal.startsWith('list-')) { const listName = currentFilterGlobal.substring(5); filtered = activeTasks.filter((task: Task) => !task.completed && task.list === listName); } else if (currentFilterGlobal.startsWith('tag-')) { const tagName = currentFilterGlobal.substring(4); filtered = activeTasks.filter((task: Task) => !task.completed && task.tags?.includes(tagName)); } else { console.warn(`Unrecognized filter: ${currentFilterGlobal}`); filtered = []; } break;
            } if (currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash') { filtered.sort((a: Task, b: Task) => (a.order - b.order) || (a.createdAt - b.createdAt)); } displayData = filtered; grouped = false; }
        return {tasksToDisplay: displayData, isGroupedView: grouped, isSearching: searching};
    }, [searchTerm, currentFilterGlobal, groupedTasks, rawSearchResults, allTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => { if (isGroupedView) { return groupOrder.flatMap(groupKey => (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey]?.map(task => task.id) ?? [] ); } else { return (tasksToDisplay as Task[]).map(task => task.id); } }, [tasksToDisplay, isGroupedView]);
    const sensors = useSensors( useSensor(PointerSensor, {activationConstraint: {distance: 8}}), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}) );

    // DND Handlers (remain the same)
    const handleDragStart = useCallback((event: DragStartEvent) => { const {active} = event; const activeTask = (isGroupedView ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat() : (tasksToDisplay as Task[])).find((task: Task) => task.id === active.id) ?? allTasks.find((task: Task) => task.id === active.id); if (activeTask && !activeTask.completed && activeTask.list !== 'Trash') { setDraggingTask(activeTask); setSelectedTaskId(activeTask.id); } else { setDraggingTask(null); } }, [tasksToDisplay, isGroupedView, setSelectedTaskId, allTasks]);
    const handleDragEnd = useCallback((event: DragEndEvent) => { const {active, over} = event; setDraggingTask(null); if (!over || !active.data.current?.task || active.id === over.id) { return; } const activeId = active.id as string; const overId = over.id as string; const originalTask = active.data.current.task as Task; const overElement = document.getElementById(`task-item-${overId}`); let targetGroupCategory: TaskGroupCategory | undefined = undefined; if (currentFilterGlobal === 'all' && over.data.current?.type === 'task-item') { targetGroupCategory = over.data.current?.groupCategory as TaskGroupCategory | undefined; } const categoryChanged = targetGroupCategory && targetGroupCategory !== originalTask.groupCategory; const needsDatePicker = categoryChanged && targetGroupCategory && ['overdue', 'next7days', 'later'].includes(targetGroupCategory) && overElement; if (needsDatePicker) { setDndDatePickerState({ taskId: activeId, targetCategory: targetGroupCategory!, referenceElement: overElement, isVisible: true, }); return; } setTasks((currentTasks) => { const oldIndex = currentTasks.findIndex(t => t.id === activeId); const newIndex = currentTasks.findIndex(t => t.id === overId); if (oldIndex === -1 || newIndex === -1) return currentTasks; const currentVisualOrderIds = sortableItems; const activeVisualIndex = currentVisualOrderIds.indexOf(activeId); const overVisualIndex = currentVisualOrderIds.indexOf(overId); if (activeVisualIndex === -1 || overVisualIndex === -1) { console.warn("DragEnd: Task not found in visual order."); return currentTasks; } const movedVisualOrderIds = arrayMove(currentVisualOrderIds, activeVisualIndex, overVisualIndex); const finalMovedVisualIndex = movedVisualOrderIds.indexOf(activeId); const prevTaskId = finalMovedVisualIndex > 0 ? movedVisualOrderIds[finalMovedVisualIndex - 1] : null; const nextTaskId = finalMovedVisualIndex < movedVisualOrderIds.length - 1 ? movedVisualOrderIds[finalMovedVisualIndex + 1] : null; const prevTask = prevTaskId ? currentTasks.find((t: Task) => t.id === prevTaskId) : null; const nextTask = nextTaskId ? currentTasks.find((t: Task) => t.id === nextTaskId) : null; const prevOrder = prevTask?.order; const nextOrder = nextTask?.order; let newOrderValue: number; if (prevOrder === undefined || prevOrder === null) { newOrderValue = (nextOrder ?? Date.now()) - 1000; } else if (nextOrder === undefined || nextOrder === null) { newOrderValue = prevOrder + 1000; } else { const mid = prevOrder + (nextOrder - prevOrder) / 2; if (!Number.isFinite(mid) || mid <= prevOrder || mid >= nextOrder) { newOrderValue = prevOrder + Math.random(); console.warn("Order calc fallback (random)."); } else { newOrderValue = mid; } } if (!Number.isFinite(newOrderValue)) { newOrderValue = Date.now(); console.warn("Order calc fallback (Date.now())."); } let newDueDate: number | null | undefined = undefined; if (categoryChanged && !needsDatePicker && targetGroupCategory) { if (targetGroupCategory === 'today') newDueDate = startOfDay(new Date()).getTime(); else if (targetGroupCategory === 'nodate') newDueDate = null; const currentDueDateObj = safeParseDate(originalTask.dueDate); const currentDueDayStart = currentDueDateObj && isValid(currentDueDateObj) ? startOfDay(currentDueDateObj).getTime() : null; const newDueDayStart = newDueDate !== null && newDueDate !== undefined ? startOfDay(new Date(newDueDate)).getTime() : null; if (currentDueDayStart === newDueDayStart) { newDueDate = undefined; } } return currentTasks.map((task: Task) => { if (task.id === activeId) { const updatedTask = { ...task, order: newOrderValue, updatedAt: Date.now(), ...(newDueDate !== undefined && { dueDate: newDueDate }), }; return updatedTask; } return task; }); }); }, [setTasks, currentFilterGlobal, sortableItems]);
    const handleDndDatePick = useCallback((date: Date | undefined) => { if (!dndDatePickerState) return; const { taskId } = dndDatePickerState; const newDueDate = date && isValid(date) ? startOfDay(date).getTime() : null; setTasks(currentTasks => currentTasks.map((t: Task) => t.id === taskId ? { ...t, dueDate: newDueDate, updatedAt: Date.now() } : t )); setDndDatePickerState(null); }, [dndDatePickerState, setTasks]);
    const closeDndDatePicker = useCallback(() => { setDndDatePickerState(null); }, []);
    const handleAddTask = useCallback(() => { const now = Date.now(); let defaultList = 'Inbox'; let defaultDueDate: number | null = null; let defaultTags: string[] = []; if (currentFilterGlobal.startsWith('list-')) { const listName = currentFilterGlobal.substring(5); if (listName !== 'Trash' && listName !== 'Completed') defaultList = listName; } else if (currentFilterGlobal === 'today') { defaultDueDate = startOfDay(now).getTime(); } else if (currentFilterGlobal.startsWith('tag-')) { defaultTags = [currentFilterGlobal.substring(4)]; } else if (currentFilterGlobal === 'next7days') { defaultDueDate = startOfDay(addDays(now, 1)).getTime(); } let newOrder: number; const visibleTaskIds = sortableItems; if (visibleTaskIds.length > 0) { const firstTaskId = visibleTaskIds[0]; const firstTask = allTasks.find((t: Task) => t.id === firstTaskId); const minOrder = (firstTask && typeof firstTask.order === 'number' && isFinite(firstTask.order)) ? firstTask.order : Date.now(); newOrder = minOrder - 1000; } else { newOrder = Date.now(); } if (!isFinite(newOrder)) { newOrder = Date.now(); console.warn("AddTask: Order calc fallback."); } const newTask: Omit<Task, 'groupCategory'> = { id: `task-${now}-${Math.random().toString(16).slice(2)}`, title: '', completed: false, completedAt: null, list: defaultList, dueDate: defaultDueDate, order: newOrder, createdAt: now, updatedAt: now, content: '', tags: defaultTags, priority: null, }; setTasks(prev => [newTask as Task, ...prev]); setSelectedTaskId(newTask.id); setTimeout(() => { const titleInput = document.getElementById(`task-title-input-${newTask.id}`) as HTMLInputElement | null; titleInput?.focus(); }, 100); }, [currentFilterGlobal, setTasks, setSelectedTaskId, sortableItems, allTasks]);

    // --- Header Reschedule Handlers (remain the same) ---
    const handleOpenHeaderDatePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setHeaderDatePickerState({ referenceElement: event.currentTarget, isVisible: true });
    }, []);
    const handleCloseHeaderDatePicker = useCallback(() => {
        setHeaderDatePickerState({ isVisible: false, referenceElement: null });
    }, []);
    const handleBulkRescheduleDateSelect = useCallback((date: Date | undefined) => {
        if (!date || !isValid(date)) {
            handleCloseHeaderDatePicker();
            return;
        }
        const newDueDateTimestamp = startOfDay(date).getTime();
        setTasks(currentTasks =>
            currentTasks.map((task: Task) => {
                const isTaskOverdue = !task.completed && task.list !== 'Trash' &&
                    task.dueDate != null && isValid(task.dueDate) &&
                    isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date()));
                if (isTaskOverdue) {
                    return { ...task, dueDate: newDueDateTimestamp, updatedAt: Date.now() };
                }
                return task;
            })
        );
        handleCloseHeaderDatePicker();
    }, [setTasks, handleCloseHeaderDatePicker]);
    // ---

    // Render group function (pass scrollContainerRef to TaskItem) - logic unchanged
    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | 'flat-list' | string) => (
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task: Task) => (
                <motion.div key={task.id} layout="position" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10, transition: { duration: 0.15, ease: 'easeIn' } }} transition={{ duration: 0.20, ease: "easeOut" }} className="task-motion-wrapper" id={`task-item-${task.id}`}>
                    <TaskItem
                        task={task}
                        groupCategory={isGroupedView && groupKey !== 'flat-list' ? groupKey as TaskGroupCategory : undefined}
                        scrollContainerRef={scrollContainerRef} // Pass the ref here
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    ), [isGroupedView, scrollContainerRef]); // Add scrollContainerRef dependency

    // Memos (remain the same)
    const isEmpty = useMemo(() => { if (isGroupedView) { return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every((group: Task[]) => group.length === 0); } else { return (tasksToDisplay as Task[]).length === 0; } }, [tasksToDisplay, isGroupedView]);
    const emptyStateTitle = useMemo(() => { if (isSearching) return `No results for "${searchTerm}"`; if (currentFilterGlobal === 'trash') return 'Trash is empty'; if (currentFilterGlobal === 'completed') return 'No completed tasks yet'; return `No tasks in "${pageTitle}"`; }, [isSearching, searchTerm, currentFilterGlobal, pageTitle]);
    const headerClass = useMemo(() => twMerge( "px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 z-10", "bg-glass-alt-100 backdrop-blur-lg" ), []);
    const showAddTaskButton = useMemo(() => !['completed', 'trash'].includes(currentFilterGlobal) && !isSearching, [currentFilterGlobal, isSearching]);

    return (
        <TaskItemMenuProvider>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                {/* Position relative needed for absolute positioning of popovers */}
                <div className="h-full flex flex-col bg-transparent overflow-hidden relative">
                    {/* Header */}
                    <div className={headerClass}>
                        <h1 className="text-base font-semibold text-gray-800 truncate pr-2" title={pageTitle}>{pageTitle}</h1>
                        <div className="flex items-center space-x-1"> {showAddTaskButton && ( <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="px-2.5 !h-[30px]"> Add </Button> )} </div>
                    </div>

                    {/* Scrollable Task List Area - Attach ref here */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto styled-scrollbar relative">
                        {isEmpty ? ( <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10"> <Icon name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : (isSearching ? 'search' : 'archive'))} size={40} className="mb-3 text-gray-300 opacity-80"/> <p className="text-sm font-medium text-gray-500">{emptyStateTitle}</p> {showAddTaskButton && ( <p className="text-xs mt-1 text-muted">Click the '+' button to add a new task.</p> )} </div>
                        ) : (
                            <div>
                                <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                                    {isGroupedView ? (
                                        <>
                                            {groupOrder.map(groupKey => {
                                                const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                                if (groupTasks && groupTasks.length > 0) {
                                                    return ( <div key={groupKey}>
                                                        <TaskGroupHeader
                                                            title={groupTitles[groupKey]} groupKey={groupKey}
                                                            onRescheduleAllClick={groupKey === 'overdue' ? handleOpenHeaderDatePicker : undefined}
                                                        />
                                                        {renderTaskGroup(groupTasks, groupKey)}
                                                    </div> );
                                                } return null;
                                            })}
                                        </>
                                    ) : ( <div className="pt-0.5"> {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')} </div> )}
                                </SortableContext>
                            </div>
                        )}

                        {/* Render DND Date Picker Popover *WITHOUT Portal* */}
                        <AnimatePresence>
                            {dndDatePickerState?.isVisible && (
                                // Apply popper styles and attributes directly
                                <div ref={setDndPopperElement} style={{...dndPopperStyles.popper, zIndex: 60}} {...dndPopperAttributes.popper} className="ignore-click-away">
                                    {/* Component does NOT use portal internally */}
                                    <CustomDatePickerPopover usePortal={false} initialDate={undefined} onSelect={handleDndDatePick} close={closeDndDatePicker} triggerElement={dndDatePickerState.referenceElement} />
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Render Header Date Picker Popover *WITHOUT Portal* */}
                        <AnimatePresence>
                            {headerDatePickerState.isVisible && headerDatePickerState.referenceElement && (
                                // Apply popper styles and attributes directly
                                <div ref={setHeaderPopperElement} style={{...headerPopperStyles.popper, zIndex: 60}} {...headerPopperAttributes.popper} className="ignore-click-away">
                                    {/* Component does NOT use portal internally */}
                                    <CustomDatePickerPopover
                                        usePortal={false}
                                        initialDate={undefined}
                                        onSelect={handleBulkRescheduleDateSelect}
                                        close={handleCloseHeaderDatePicker}
                                        triggerElement={headerDatePickerState.referenceElement}
                                    />
                                </div>
                            )}
                        </AnimatePresence>

                    </div> {/* End scrollable area */}
                </div> {/* End main flex container */}

                {/* Drag Overlay (Portal is fine here as it's temporary and covers UI) */}
                <DragOverlay dropAnimation={dropAnimationConfig}> {draggingTask ? ( <TaskItem task={draggingTask} isOverlay={true} scrollContainerRef={scrollContainerRef}/> ) : null} </DragOverlay>
            </DndContext>
        </TaskItemMenuProvider>
    );
};
TaskList.displayName = 'TaskList';
export default TaskList;