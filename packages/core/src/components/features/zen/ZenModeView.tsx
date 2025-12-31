import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    aiSettingsAtom,
    isSettingsOpenAtom,
    isZenFullScreenAtom,
    preferencesSettingsAtom,
    selectedTaskIdAtom,
    settingsSelectedTabAtom,
    tasksAtom,
    userListsAtom
} from '@/store/jotai.ts';
import {
    addNotificationAtom
} from '@/store/jotai.ts';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {Task} from '@/types';
import {isSameDay, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {useTaskOperations} from '@/hooks/useTaskOperations';
import {twMerge} from 'tailwind-merge';
import {useTranslation} from 'react-i18next';
import {AI_PROVIDERS} from "@/config/aiProviders";
import {analyzeTaskInputWithAI, isAIConfigValid} from "@/services/aiService";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import {ProgressIndicator} from "@/components/features/tasks/TaskItem";
import * as Switch from '@radix-ui/react-switch';
import {TFunction} from "i18next";

// --- Sortable Task Component ---
const ZenTaskItem = ({task, type, isOverlay, t}: { task: Task, type: 'todo' | 'done' | 'overdue', isOverlay?: boolean, t: TFunction }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: task.id,
        data: {task, origin: type},
        disabled: false
    });

    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const {updateTask} = useTaskOperations();

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : (type === 'overdue' ? 0.6 : (type === 'done' ? 0.8 : 1)),
        zIndex: isDragging ? 10 : 1,
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!isDragging && !(e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
            setSelectedTaskId(task.id);
        }
    };

    const toggleComplete = (e: React.MouseEvent) => {
        e.stopPropagation();
        const now = Date.now();

        if (task.completed) {
            updateTask(task.id, {
                completed: false,
                completedAt: null,
                completePercentage: null
            });
        } else {
            updateTask(task.id, {
                completed: true,
                completedAt: now,
                completePercentage: 100,
            });
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Soft delete: move to Trash
        updateTask(task.id, {
            listName: 'Trash',
            completed: false,
            completePercentage: null
        });
    };

    const baseClasses = twMerge(
        "w-full relative font-serif select-none outline-none touch-none truncate px-4 flex-shrink-0 flex items-center justify-center group",
        type === 'todo' ? "py-3 text-[#2A2A2A] max-w-[600px] mx-auto" : "",
        type === 'done' ? "py-1.5 text-[#707070] decoration-[#00000014] max-w-[600px] mx-auto" : "",
        type === 'overdue' ? "py-1 text-[#707070] hover:opacity-100 mb-2 list-none text-left max-w-[200px] justify-start px-0" : ""
    );

    const titleClasses = twMerge(
        "truncate cursor-pointer transition-all duration-300",
        type === 'todo' ? "text-[1.25rem]" : "",
        type === 'done' ? "text-[1rem] line-through" : "",
        type === 'overdue' ? "text-[1.15rem]" : ""
    );

    if (isOverlay) {
        return (
            <div className={twMerge(
                "flex items-center justify-center text-center gap-3",
                "font-serif text-[#2A2A2A] whitespace-nowrap px-4 py-2 bg-[#F8F7F4] shadow-xl rounded-lg border border-[#0000000d]",
                type === 'done' && "text-[#707070] text-[1rem]",
                "cursor-grabbing max-w-[300px] truncate"
            )}>
                <ProgressIndicator
                    percentage={task.completePercentage}
                    isTrash={false}
                    size={type === 'todo' ? 20 : 16}
                    className="flex-shrink-0 opacity-50"
                />
                <span className={twMerge(titleClasses, type === 'done' && "line-through")}>{task.title}</span>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={handleClick}
            className={baseClasses}
            title={task.title}
        >
            {!isDragging && (type === 'todo' || type === 'done') && (
                <div
                    className={twMerge(
                        "absolute bottom-0 left-0 right-0 h-[1px]",
                        "bg-gradient-to-r from-transparent via-[#00000015] to-transparent dark:via-[#ffffff15]",
                        "transform scale-x-0 group-hover:scale-x-100",
                        "transition-transform duration-500 ease-out origin-center",
                        "pointer-events-none"
                    )}
                />
            )}

            <div className="relative flex items-center justify-center w-full max-w-full">

                <span className={titleClasses}>
                    {task.title}
                </span>

                {(type === 'todo' || type === 'done') && (
                    <div className={twMerge(
                        "absolute right-0 flex items-center gap-2",
                        "opacity-0 group-hover:opacity-100 transition-all duration-300",
                        "z-20"
                    )}>
                        {/* Delete Button */}
                        <button
                            onClick={handleDelete}
                            className={twMerge(
                                "p-2 rounded-full",
                                "bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 shadow-sm",
                                "hover:bg-red-500/10 hover:text-red-500 hover:border-red-200",
                                "text-[#707070] dark:text-neutral-300",
                                "flex items-center justify-center"
                            )}
                            title={t('common.delete')}
                        >
                            <Icon name="trash" size={16} strokeWidth={1.5} />
                        </button>

                        {/* Complete/Undo Button */}
                        <button
                            onClick={toggleComplete}
                            className={twMerge(
                                "p-2 rounded-full",
                                "bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 shadow-sm",
                                "hover:bg-white/60 dark:hover:bg-black/60",
                                "text-[#707070] dark:text-neutral-300",
                                "flex items-center justify-center"
                            )}
                            title={type === 'todo' ? t('common.complete') : t('common.undo')}
                        >
                            <Icon
                                name={type === 'todo' ? 'check' : 'undo'}
                                size={16}
                                strokeWidth={type === 'todo' ? 2 : 1.5}
                            />
                        </button>
                    </div>
                )}

                {type === 'done' && task.completedAt && (
                    <span className="font-sans text-[0.75rem] text-[#C0C0C0] no-underline inline-block flex-shrink-0 ml-3 opacity-60">
                        {new Date(task.completedAt).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}
                    </span>
                )}
            </div>
        </div>
    );
};

// --- Droppable Container for Empty Lists ---
const DroppableListContainer = ({id, items, children, className}: { id: string, items: string[], children: React.ReactNode, className?: string }) => {
    const {setNodeRef} = useDroppable({
        id: id,
    });

    return (
        <SortableContext
            id={id}
            items={items}
            strategy={verticalListSortingStrategy}
        >
            <div ref={setNodeRef} className={className}>
                {children}
            </div>
        </SortableContext>
    );
}

const ZenModeView: React.FC = () => {
    const {t, i18n} = useTranslation();
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);
    const tasks = useAtomValue(tasksAtom) ?? [];
    const allUserLists = useAtomValue(userListsAtom);
    const aiSettings = useAtomValue(aiSettingsAtom);
    const addNotification = useSetAtom(addNotificationAtom);
    const setIsSettingsOpen = useSetAtom(isSettingsOpenAtom);
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);
    const [isFullScreen, setIsFullScreen] = useAtom(isZenFullScreenAtom);

    const {updateTask, createTask, createSubtask, batchUpdateTasks} = useTaskOperations();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggingTaskData, setDraggingTaskData] = useState<{task: Task, origin: string} | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // AI Input State
    const [todoInputValue, setTodoInputValue] = useState("");
    const [isAiMode, setIsAiMode] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Determine the language for Zen Mode (Shy Native Mode)
    const zenLanguage = useMemo(() => {
        const appLanguage = preferences?.language || 'en';
        if (preferences?.zenModeShyNative) {
            return appLanguage === 'zh-CN' ? 'en' : 'zh-CN';
        }
        return appLanguage;
    }, [preferences?.language, preferences?.zenModeShyNative]);

    // Get translation function for Zen Mode language
    const tZen = useMemo(() => i18n.getFixedT(zenLanguage), [i18n, zenLanguage]);

    const handleShyNativeToggle = (checked: boolean) => {
        if (preferences) {
            setPreferences({
                ...preferences,
                zenModeShyNative: checked
            });
        }
    };

    const isAIConfigured = useMemo(() => isAIConfigValid(aiSettings), [aiSettings]);

    useEffect(() => {
        if (isAiMode && !isAIConfigured) {
            setIsAiMode(false);
        }
    }, [isAIConfigured, isAiMode]);

    // Clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fullscreen Sync Effect
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, [setIsFullScreen]);

    const toggleFullScreen = async () => {
        // Detect Tauri environment
        // @ts-ignore
        const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

        if (isTauri) {
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const appWindow = getCurrentWindow();
                const isFull = await appWindow.isFullscreen();
                await appWindow.setFullscreen(!isFull);
                setIsFullScreen(!isFull);
                return;
            } catch (e) {
                console.warn("Tauri fullscreen failed, falling back to DOM", e);
            }
        }

        const doc = document as any;
        const docEl = document.documentElement as any;

        const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

        if (!isFullscreen) {
            const requestFullScreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            if (requestFullScreen) {
                requestFullScreen.call(docEl).catch((err: any) => console.error("Fullscreen request failed", err));
            }
        } else {
            const exitFullScreen = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
            if (exitFullScreen) {
                exitFullScreen.call(doc);
            }
        }
    };

    // Task Categorization
    const {todayTodos, todayDones, overdueTasks} = useMemo(() => {
        const today = startOfDay(new Date());
        const todos: Task[] = [];
        const dones: Task[] = [];
        const overdue: Task[] = [];

        tasks.forEach(task => {
            if (task.listName === 'Trash') return;

            const taskDate = safeParseDate(task.dueDate);
            const completedDate = task.completedAt ? new Date(task.completedAt) : null;

            if (task.completed) {
                // Done today
                if (completedDate && isSameDay(completedDate, today)) {
                    dones.push(task);
                }
            } else {
                if (taskDate) {
                    const taskStartDay = startOfDay(taskDate);
                    // Today Todolist
                    if (isSameDay(taskStartDay, today)) {
                        todos.push(task);
                    }
                    // Overdue
                    else if (taskStartDay < today) {
                        overdue.push(task);
                    }
                }
            }
        });

        // Sort dones by completion time (ascending) for display
        dones.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
        // Sort todos by order
        todos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        return {todayTodos: todos, todayDones: dones, overdueTasks: overdue};
    }, [tasks]);

    // Drag Logic
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const {active} = event;
        setActiveId(active.id as string);
        setDraggingTaskData(active.data.current as {task: Task, origin: string});
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        setActiveId(null);
        setDraggingTaskData(null);

        if (!over) return;

        const task = active.data.current?.task as Task;
        const origin = active.data.current?.origin as 'todo' | 'done' | 'overdue';

        let targetContainer = 'todo'; // default

        // Helper to check where it dropped
        const isOverTodoContainer = over.id === 'list-todo-container';
        const isOverDoneContainer = over.id === 'list-done-container';
        const isOverTodoItem = todayTodos.some(t => t.id === over.id);
        const isOverDoneItem = todayDones.some(t => t.id === over.id);

        if (isOverDoneContainer || isOverDoneItem) {
            targetContainer = 'done';
        } else if (isOverTodoContainer || isOverTodoItem) {
            targetContainer = 'todo';
        }

        const now = Date.now();
        const todayStart = startOfDay(new Date()).getTime();

        // 1. Moving between lists (Status Change)
        if (origin !== targetContainer) {
            // Overdue -> Todolist
            if (origin === 'overdue' && targetContainer === 'todo') {
                updateTask(task.id, {dueDate: todayStart, order: now});
            }
            // Overdue -> Done
            else if (origin === 'overdue' && targetContainer === 'done') {
                updateTask(task.id, {
                    completed: true,
                    completedAt: now,
                    completePercentage: 100,
                    dueDate: todayStart
                });
            }
            // Todolist -> Done
            else if (origin === 'todo' && targetContainer === 'done') {
                updateTask(task.id, {
                    completed: true,
                    completedAt: now,
                    completePercentage: 100
                });
            }
            // Done -> Todolist
            else if (origin === 'done' && targetContainer === 'todo') {
                updateTask(task.id, {
                    completed: false,
                    completedAt: null,
                    completePercentage: null,
                    order: now // Move to end of todo
                });
            }
        }
        // 2. Sorting within same list (Todolist only usually)
        else if (origin === 'todo' && targetContainer === 'todo') {
            if (active.id !== over.id) {
                const oldIndex = todayTodos.findIndex(t => t.id === active.id);
                const newIndex = todayTodos.findIndex(t => t.id === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newTodos = arrayMove(todayTodos, oldIndex, newIndex);
                    const prevTask = newTodos[newIndex - 1];
                    const nextTask = newTodos[newIndex + 1];

                    let newOrder: number;
                    if (!prevTask && !nextTask) newOrder = now;
                    else if (!prevTask) newOrder = (nextTask.order ?? 0) - 1000;
                    else if (!nextTask) newOrder = (prevTask.order ?? 0) + 1000;
                    else newOrder = ((prevTask.order ?? 0) + (nextTask.order ?? 0)) / 2;

                    updateTask(task.id, { order: newOrder });
                }
            }
        }
    };

    // Input Logic (Todolist)
    const handleTodoKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && todoInputValue.trim()) {
            if (isAiMode) {
                await handleAiCreation(todoInputValue.trim());
            } else {
                handleStandardCreation(todoInputValue.trim(), false);
            }
        }
        if (e.key === 'Escape' && isAiMode) {
            setIsAiMode(false);
        }
    };

    const handleStandardCreation = (title: string, isDone: boolean) => {
        const defaultList = preferences?.defaultNewTaskList || 'Inbox';
        const targetList = allUserLists?.find(l => l.name === defaultList) ?? allUserLists?.find(l => l.name === 'Inbox');

        if (!targetList) return;

        const now = Date.now();
        createTask({
            title: title,
            content: '',
            listName: targetList.name,
            listId: targetList.id,
            completed: isDone,
            completedAt: isDone ? now : null,
            completePercentage: isDone ? 100 : null,
            dueDate: startOfDay(new Date()).getTime(),
            priority: null,
            order: now,
            tags: [],
            subtasks: []
        });

        if (!isDone) setTodoInputValue("");
    };

    const handleAiCreation = async (prompt: string) => {
        if (isAiProcessing) return;

        if (!isAIConfigured) {
            setSettingsTab('ai');
            setIsSettingsOpen(true);
            return;
        }

        setIsAiProcessing(true);

        try {
            const systemPrompt = tZen('prompts.taskAnalysis', { currentDate: new Date().toLocaleDateString() });
            const aiAnalysis = await analyzeTaskInputWithAI(prompt, aiSettings!, systemPrompt);

            const defaultList = preferences?.defaultNewTaskList || 'Inbox';
            const targetList = allUserLists?.find(l => l.name === defaultList) ?? allUserLists?.find(l => l.name === 'Inbox');

            if (!targetList) throw new Error("Target list not found");

            const now = Date.now();
            const dueDate = aiAnalysis.dueDate ? new Date(aiAnalysis.dueDate).getTime() : startOfDay(new Date()).getTime();

            const newTask = createTask({
                title: aiAnalysis.title || prompt,
                content: aiAnalysis.content,
                listName: targetList.name,
                listId: targetList.id,
                completed: false,
                completedAt: null,
                completePercentage: null,
                dueDate: dueDate,
                priority: aiAnalysis.priority,
                order: now,
                tags: aiAnalysis.tags,
                subtasks: []
            });

            if (aiAnalysis.subtasks && aiAnalysis.subtasks.length > 0) {
                aiAnalysis.subtasks.forEach((sub, index) => {
                    createSubtask(newTask.id, {
                        title: sub.title,
                        order: index * 1000,
                        dueDate: sub.dueDate ? (new Date(sub.dueDate).getTime()) : null
                    });
                });
            }

            setTodoInputValue("");
            setIsAiMode(false);
            addNotification({ type: 'success', message: 'AI Task Created' });

        } catch (error: any) {
            addNotification({ type: 'error', message: error.message || "AI Creation Failed" });
        } finally {
            setIsAiProcessing(false);
        }
    };

    // Input Logic (Done Log)
    const handleDoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            handleStandardCreation(e.currentTarget.value.trim(), true);
            e.currentTarget.value = "";
        }
    };

    const toggleAiMode = () => {
        // Validation check before toggling
        if (!isAIConfigured) {
            setSettingsTab('ai');
            setIsSettingsOpen(true);
            return;
        }

        setIsAiMode(!isAiMode);
        inputRef.current?.focus();
    };

    // Move Overdue Tasks to Today
    const handleRescheduleOverdue = () => {
        if (overdueTasks.length === 0) return;
        const todayStart = startOfDay(new Date()).getTime();
        const updates = overdueTasks.map(t => ({...t, dueDate: todayStart}));
        batchUpdateTasks(updates);
        addNotification({ type: 'success', message: tZen('taskList.rescheduleAll') + ' ' + tZen('common.ok') });
    };

    return (
        <>
            {/* Added data-tauri-drag-region="true" to the root container to enable window dragging */}
            <div
                className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#fdfcfb] via-[#faf9f7] to-[#f7f6f3] text-[#2A2A2A] font-serif cursor-default select-none"
                data-tauri-drag-region="true"
            >

                <div
                    className="fixed inset-0 pointer-events-none z-10 opacity-[0.08] mix-blend-multiply"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 1000 1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paperTexture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0.8 0 0 0 0.1 0 0.7 0 0 0.05 0 0 0.6 0 0 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paperTexture)'/%3E%3C/svg%3E")`,
                        backgroundSize: '400px 400px',
                        backgroundRepeat: 'repeat'
                    }}
                />

                <div
                    className="fixed inset-0 z-0 pointer-events-none"
                    style={{
                        background: `
                            radial-gradient(circle at 25% 25%, rgba(255, 249, 240, 0.8), transparent 50%),
                            radial-gradient(circle at 75% 75%, rgba(245, 242, 235, 0.6), transparent 50%),
                            linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(248, 246, 240, 0.2) 100%)
                        `
                    }}
                />

                <div className="fixed inset-0 z-[1] pointer-events-none">
                    <div
                        className="absolute w-full h-full animate-zen-breathe"
                        style={{
                            background: `
                                radial-gradient(ellipse at 30% 20%, rgba(255, 211, 202, 0.4), transparent 40%),
                                radial-gradient(ellipse at 70% 80%, rgba(250, 204, 200, 0.3), transparent 40%)
                            `
                        }}
                    />
                </div>

                <style>{`
                    @keyframes zen-breathe {
                        0%, 100% { 
                            transform: scale(1) rotate(0deg); 
                            opacity: 0.4; 
                        }
                        50% { 
                            transform: scale(1.05) rotate(0.5deg); 
                            opacity: 0.6; 
                        }
                    }
                    
                    @keyframes zen-noise {
                        0% { transform: translateX(0) translateY(0); }
                        10% { transform: translateX(-1px) translateY(1px); }
                        20% { transform: translateX(1px) translateY(0px); }
                        30% { transform: translateX(0px) translateY(-1px); }
                        40% { transform: translateX(-1px) translateY(-1px); }
                        50% { transform: translateX(1px) translateY(1px); }
                        60% { transform: translateX(0px) translateY(0px); }
                        70% { transform: translateX(-1px) translateY(0px); }
                        80% { transform: translateX(1px) translateY(-1px); }
                        90% { transform: translateX(0px) translateY(1px); }
                        100% { transform: translateX(0) translateY(0); }
                    }
                    
                    .animate-zen-breathe { 
                        animation: zen-breathe 20s infinite ease-in-out; 
                    }
                    
                    .font-display { font-family: 'Italiana', serif; }
                    .font-body { font-family: 'Noto Serif SC', serif; }
                    .mask-gradient-bottom { mask-image: linear-gradient(to bottom, black 70%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%); }
                    .mask-gradient-top { mask-image: linear-gradient(to top, black 80%, transparent 100%); -webkit-mask-image: linear-gradient(to top, black 80%, transparent 100%); }
                    
                    /* Hide scrollbar */
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}</style>

                {/* 2. Drag Context */}
                <DndContext
                    sensors={sensors}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    collisionDetection={closestCenter}
                    measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
                >

                    {/* 3. Layout Axis */}
                    {/* Added data-tauri-drag-region="true" to the layout container as well to ensure full coverage */}
                    <div
                        className="relative z-10 w-full h-full flex flex-col items-center justify-between py-[5vh]"
                        data-tauri-drag-region="true"
                    >

                        {/* Full Screen Toggle Button */}
                        <div className="absolute top-6 left-6 z-50">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleFullScreen}
                                className="w-10 h-10 text-[#707070] hover:text-[#2A2A2A] hover:bg-black/5 rounded-full transition-all duration-300"
                                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                            >
                                <Icon name={isFullScreen ? "minimize-2" : "maximize-2"} size={20} strokeWidth={1.5} />
                            </Button>
                        </div>

                        {/* Shy Native Mode Toggle */}
                        <div className="absolute top-6 right-6 z-50">
                            <div className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-300 cursor-pointer">
                                <span className="text-[12px] text-[#707070] font-sans font-light w-0 overflow-hidden group-hover:w-auto transition-all whitespace-nowrap">
                                    {tZen('zen.shyNativeMode')}
                                </span>
                                <Switch.Root
                                    checked={preferences?.zenModeShyNative || false}
                                    onCheckedChange={handleShyNativeToggle}
                                    className={twMerge(
                                        "w-[30px] h-[16px] rounded-full border border-[#707070]/30 transition-colors duration-200 ease-in-out bg-transparent data-[state=checked]:bg-[#707070]/20"
                                    )}
                                >
                                    <Switch.Thumb className="block w-[12px] h-[12px] bg-[#707070] rounded-full transition-transform duration-200 translate-x-[2px] will-change-transform data-[state=checked]:translate-x-[16px]" />
                                </Switch.Root>
                            </div>
                        </div>

                        {/* Top Cluster: Clock & Todos */}
                        <div className="w-full max-w-[650px] flex flex-col items-center px-4">
                            <div className="font-display text-[9rem] leading-[0.9] text-[#2A2A2A] mb-5 -tracking-[4px] select-none pointer-events-none">
                                {currentTime.toLocaleTimeString(zenLanguage === 'zh-CN' ? 'zh-CN' : 'en-GB', {hour: '2-digit', minute: '2-digit'})}
                            </div>
                            <div className="font-display text-[1.1rem] tracking-[0.3em] text-[#707070] mb-10 uppercase select-none pointer-events-none whitespace-nowrap text-center">
                                {currentTime.toLocaleDateString(zenLanguage, {month: 'long', day: 'numeric'})}
                            </div>

                            <div className="w-full relative mb-5 px-4 md:px-0">
                                {/* Input Underline */}
                                <div className={twMerge(
                                    "absolute bottom-0 left-[10%] w-[80%] h-[1px] transition-colors duration-300",
                                    isAiMode ? "bg-primary/50" : "bg-[#0000000d]"
                                )}></div>

                                <div className="relative w-full flex items-center justify-center">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className={twMerge(
                                            "w-full bg-transparent border-none text-center font-body text-[1.6rem] font-light py-[15px] focus:outline-none placeholder:text-[#C0C0C0] placeholder:italic transition-colors duration-300 truncate",
                                            isAiMode ? "text-primary placeholder:text-primary/50 caret-primary" : "text-[#2A2A2A] caret-[#2A2A2A]"
                                        )}
                                        // Increased padding to avoid AI button overlap
                                        style={{ paddingRight: '4rem', paddingLeft: '4rem' }}
                                        placeholder={isAiProcessing ? tZen('taskList.aiTaskButton.processing') : (isAiMode ? tZen('zen.aiPlaceholder') : tZen('zen.addPlan'))}
                                        value={todoInputValue}
                                        onChange={(e) => setTodoInputValue(e.target.value)}
                                        onKeyDown={handleTodoKeyDown}
                                        disabled={isAiProcessing}
                                    />
                                    {/* Minimalist AI Toggle Button - Fixed to always show */}
                                    <button
                                        onClick={toggleAiMode}
                                        className={twMerge(
                                            "absolute right-[2%] md:right-[5%] top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-black/5",
                                            isAiMode ? "text-primary scale-110" : "text-[#C0C0C0]",
                                            !isAIConfigured && "opacity-50 cursor-not-allowed"
                                        )}
                                        title={tZen('taskList.aiTaskButton.label')}
                                        disabled={isAiProcessing}
                                    >
                                        {isAiProcessing ? <Icon name="loader" className="animate-spin" size={18} strokeWidth={2}/> : <Icon name="sparkles" size={18} strokeWidth={1.5} />}
                                    </button>
                                </div>
                            </div>

                            <DroppableListContainer
                                id="list-todo-container"
                                items={todayTodos.map(t => t.id)}
                                className="w-full max-h-[28vh] overflow-y-auto mask-gradient-bottom pb-10 flex flex-col items-center no-scrollbar min-h-[50px]"
                            >
                                {todayTodos.map(task => (
                                    <ZenTaskItem key={task.id} task={task} type="todo" t={tZen} />
                                ))}
                                {todayTodos.length === 0 && (
                                    <div className="text-[1.25rem] py-3 text-[#C0C0C0] italic font-light opacity-50 select-none pointer-events-none">{tZen('zen.emptyMind')}</div>
                                )}
                            </DroppableListContainer>
                        </div>

                        {/* Bottom Cluster: Done & Input */}
                        <div className="w-full max-w-[650px] flex flex-col items-center justify-end px-4">
                            <DroppableListContainer
                                id="list-done-container"
                                items={todayDones.map(t => t.id)}
                                className="w-full max-h-[25vh] overflow-y-auto mask-gradient-top pt-[30px] mb-5 flex flex-col items-center no-scrollbar min-h-[50px]"
                            >
                                {todayDones.map(task => (
                                    <ZenTaskItem key={task.id} task={task} type="done" t={tZen} />
                                ))}
                            </DroppableListContainer>

                            <div className="w-full relative px-4 md:px-0">
                                <div className="absolute top-0 left-[10%] w-[80%] h-[1px] bg-[#0000000d]"></div>
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none text-center font-body text-[1.1rem] text-[#707070] py-[15px] focus:outline-none placeholder:text-[#C0C0C0] placeholder:italic truncate"
                                    placeholder={tZen('zen.logMemories')}
                                    onKeyDown={handleDoneKeyDown}
                                />
                            </div>
                        </div>

                    </div>

                    {/* 4. Memories (Overdue) Sidebar */}
                    <aside className="fixed left-[4vw] bottom-[5vh] z-20 hidden lg:block max-w-[200px]">
                        <div className="flex items-center justify-between mb-3 w-full pr-4">
                            <div className="font-display text-[1rem] tracking-[0.2em] text-[#C0C0C0] select-none">{tZen('zen.expired')}</div>
                            {overdueTasks.length > 0 && (
                                <button
                                    onClick={handleRescheduleOverdue}
                                    title={tZen('taskList.rescheduleAll')}
                                    className="text-[#C0C0C0] hover:text-[#707070] transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5"
                                >
                                    <Icon name="calendar-plus" size={14} strokeWidth={1.5} />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col items-start max-h-[40vh] overflow-y-auto no-scrollbar">
                            {overdueTasks.map(task => (
                                <ZenTaskItem key={task.id} task={task} type="overdue" t={tZen} />
                            ))}
                            {overdueTasks.length === 0 && <li className="text-[1.15rem] text-[#C0C0C0] opacity-30 italic select-none list-none">{tZen('zen.noRegrets')}</li>}
                        </div>
                    </aside>

                    {/* Drag Overlay - Set dropAnimation to null to disable drift back */}
                    <DragOverlay dropAnimation={null}>
                        {activeId && draggingTaskData ? (
                            <ZenTaskItem task={draggingTaskData.task} type={draggingTaskData.origin as any} isOverlay t={tZen} />
                        ) : null}
                    </DragOverlay>

                </DndContext>
            </div>
        </>
    );
};

export default ZenModeView;