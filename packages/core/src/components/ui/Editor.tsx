import React, {forwardRef, memo, useEffect, useImperativeHandle, useRef, useMemo, useCallback} from 'react';
import {twMerge} from 'tailwind-merge';
import {useAtomValue, useSetAtom} from 'jotai';
import {aiSettingsAtom, appearanceSettingsAtom, isSettingsOpenAtom, settingsSelectedTabAtom} from '@/store/jotai.ts';
import {EditorView} from '@codemirror/view';
import {useTranslation} from "react-i18next";
import {AI_PROVIDERS} from "@/config/aiProviders";
import {streamChatCompletionForEditor} from "@/services/aiService";
import Moondown from "@/lib/moondown/moondown.ts";
import {MoondownTranslations} from "@/lib/moondown/core";

interface CodeMirrorEditorProps {
    value: string;
    onChange: (newValue: string) => void;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    onBlur?: () => void;
    onFocus?: () => void;
    taskTitle?: string;
}

export interface CodeMirrorEditorRef {
    focus: () => void;
    getView: () => EditorView | null;
}

/**
 * A React wrapper for the custom Moondown editor, which is based on CodeMirror 6.
 * This component handles initialization, updates, and cleanup of the editor instance.
 */
const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
    ({value, onChange, className, placeholder, readOnly = false, onBlur, onFocus, taskTitle = ''}, ref) => {
        const editorContainerRef = useRef<HTMLDivElement>(null);
        const moondownInstanceRef = useRef<Moondown | null>(null);
        const appearance = useAtomValue(appearanceSettingsAtom);
        const aiSettings = useAtomValue(aiSettingsAtom);
        const setIsSettingsOpen = useSetAtom(isSettingsOpenAtom);
        const setSettingsTab = useSetAtom(settingsSelectedTabAtom);
        const { t, i18n } = useTranslation();

        const theme = useMemo(() => {
            const darkMode = appearance?.darkMode ?? 'system';
            if (darkMode === 'system') {
                return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return darkMode;
        }, [appearance?.darkMode]);

        const moondownTranslations = useMemo((): MoondownTranslations => ({
            'moondown.ai.thinking': t('moondown.ai.thinking'),
            'moondown.slash.aiContinue': t('moondown.slash.aiContinue'),
            'moondown.slash.heading1': t('moondown.slash.heading1'),
            'moondown.slash.heading2': t('moondown.slash.heading2'),
            'moondown.slash.heading3': t('moondown.slash.heading3'),
            'moondown.slash.heading4': t('moondown.slash.heading4'),
            'moondown.slash.insertTable': t('moondown.slash.insertTable'),
            'moondown.slash.insertLink': t('moondown.slash.insertLink'),
            'moondown.slash.quoteBlock': t('moondown.slash.quoteBlock'),
            'moondown.slash.orderedList': t('moondown.slash.orderedList'),
            'moondown.slash.unorderedList': t('moondown.slash.unorderedList'),
            'moondown.slash.codeBlock': t('moondown.slash.codeBlock'),
            'moondown.prompts.textContinuation': t('prompts.textContinuation'),
        }), [t]);

        const handleAIStream = useCallback(async (
            systemPrompt: string,
            userPrompt: string,
            signal: AbortSignal
        ): Promise<ReadableStream<string>> => {
            const currentProvider = AI_PROVIDERS.find(p => p.id === aiSettings?.provider);
            const missingKey = currentProvider?.requiresApiKey && !aiSettings?.apiKey;
            const missingModel = !aiSettings?.model;

            if (!aiSettings || !aiSettings.provider || missingKey || missingModel) {
                setSettingsTab('ai');
                setIsSettingsOpen(true);
                throw new Error("AI configuration required");
            }
            const contextualizedUserPrompt = `Task Title: ${taskTitle}\n\n${userPrompt}`;
            return streamChatCompletionForEditor(aiSettings, systemPrompt, contextualizedUserPrompt, signal);
        }, [aiSettings, taskTitle, setIsSettingsOpen, setSettingsTab]);

        useImperativeHandle(ref, () => ({
            focus: () => moondownInstanceRef.current?.focus(),
            getView: () => moondownInstanceRef.current?.getView() ?? null,
        }), []);

        useEffect(() => {
            let instance: Moondown | null = null;
            if (editorContainerRef.current) {
                instance = new Moondown(editorContainerRef.current, value, {
                    theme,
                    readOnly,
                    placeholder,
                    translations: moondownTranslations,
                    onAIStream: handleAIStream,
                    onChange: (update) => {
                        if (update.docChanged) {
                            onChange(update.state.doc.toString());
                        }
                    },
                    onFocus,
                    onBlur,
                });
                moondownInstanceRef.current = instance;
            }

            return () => {
                instance?.destroy();
                moondownInstanceRef.current = null;
            };
            // The empty dependency array is intentional. We want to initialize the editor only once.
            // All subsequent updates are handled by specific useEffect hooks below.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
            moondownInstanceRef.current?.setTheme(theme);
        }, [theme]);

        useEffect(() => {
            moondownInstanceRef.current?.setTranslations(moondownTranslations);
        }, [moondownTranslations]);

        useEffect(() => {
            moondownInstanceRef.current?.setAIStreamHandler(handleAIStream);
        }, [handleAIStream]);

        const containerClasses = twMerge(
            'cm-editor-container relative h-full w-full overflow-hidden rounded-base',
            readOnly && 'bg-grey-ultra-light/50 dark:bg-neutral-700/30',
            className
        );

        return <div ref={editorContainerRef} className={containerClasses}/>;
    }
);
CodeMirrorEditor.displayName = 'CodeMirrorEditor';

export default memo(CodeMirrorEditor);