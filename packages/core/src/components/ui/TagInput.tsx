import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtomValue} from 'jotai';
import {userTagNamesAtom} from '@/store/jotai.ts';
import Icon from './Icon';
import {twMerge} from 'tailwind-merge';
import useDebounce from "@/hooks/useDebounce";
import {useTranslation} from "react-i18next";

interface AddTagsPopoverContentProps {
    taskId: string;
    initialTags: string[];
    onApply: (newTags: string[]) => void;
    closePopover: () => void;
}

/**
 * A popover content component for adding, removing, and creating tags for a task.
 */
const AddTagsPopoverContent: React.FC<AddTagsPopoverContentProps> = ({
                                                                         taskId,
                                                                         initialTags,
                                                                         onApply,
                                                                         closePopover,
                                                                     }) => {
    const {t} = useTranslation();
    const allUserTags = useAtomValue(userTagNamesAtom);
    const [inputValue, setInputValue] = useState('');
    const debouncedInputForFiltering = useDebounce(inputValue.toLowerCase().trim(), 150);
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(initialTags));
    const inputRef = useRef<HTMLInputElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const isInitialMountOrTaskChangeRef = useRef(true);

    useEffect(() => {
        setSelectedTags(new Set(initialTags));
    }, [initialTags]);

    useEffect(() => {
        setInputValue('');
        isInitialMountOrTaskChangeRef.current = true;

        if (taskId) {
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [taskId]);

    useEffect(() => {
        // Prevent applying changes on initial render or when the task changes.
        if (isInitialMountOrTaskChangeRef.current) {
            isInitialMountOrTaskChangeRef.current = false;
            return;
        }
        onApply(Array.from(selectedTags).sort((a, b) => a.localeCompare(b)));
    }, [selectedTags, onApply]);

    const toggleTagInList = useCallback((tag: string) => {
        setSelectedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
        inputRef.current?.focus();
    }, []);

    const removeTagPill = useCallback((tag: string) => {
        setSelectedTags(prev => {
            const newSet = new Set(prev);
            newSet.delete(tag);
            return newSet;
        });
        inputRef.current?.focus();
    }, []);

    const createNewTag = useCallback(() => {
        const newTag = inputValue.trim();
        if (newTag && !allUserTags.some(t => t.toLowerCase() === newTag.toLowerCase()) && !selectedTags.has(newTag)) {
            setSelectedTags(prev => {
                const newSet = new Set(prev);
                newSet.add(newTag);
                return newSet;
            });
            setInputValue('');
            setTimeout(() => {
                if (listContainerRef.current) {
                    listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
                }
            }, 0);
        }
        inputRef.current?.focus();
    }, [inputValue, allUserTags, selectedTags]);

    const availableTagsToDisplay = useMemo(() => {
        return allUserTags
            .filter(tag => debouncedInputForFiltering ? tag.toLowerCase().includes(debouncedInputForFiltering) : true)
            .sort((a, b) => {
                const aSelected = selectedTags.has(a);
                const bSelected = selectedTags.has(b);
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                return a.localeCompare(b);
            });
    }, [allUserTags, debouncedInputForFiltering, selectedTags]);

    const canCreateCurrentInput = useMemo(() => {
        const trimmedInput = inputValue.trim();
        return trimmedInput.length > 0 &&
            !allUserTags.some(t => t.toLowerCase() === trimmedInput.toLowerCase()) &&
            !selectedTags.has(trimmedInput);
    }, [inputValue, allUserTags, selectedTags]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (canCreateCurrentInput) {
            createNewTag();
        } else if (inputValue.trim()) {
            const existingTag = allUserTags.find(t => t.toLowerCase() === inputValue.trim().toLowerCase());
            if (existingTag && !selectedTags.has(existingTag)) {
                toggleTagInList(existingTag);
                setInputValue('');
            } else if (existingTag && selectedTags.has(existingTag)) {
                setInputValue('');
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && inputValue === '' && selectedTags.size > 0) {
            const lastTag = Array.from(selectedTags).sort((a, b) => a.localeCompare(b)).pop();
            if (lastTag) removeTagPill(lastTag);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closePopover();
        }
    };

    return (
        <div
            className={twMerge(
                "flex flex-col w-[250px] select-none",
                "bg-white dark:bg-neutral-800",
                "border border-grey-light dark:border-neutral-700",
                "rounded-base shadow-popover"
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-2">
                <form
                    onSubmit={handleSubmit}
                    className={twMerge(
                        "flex flex-wrap items-center gap-1.5 p-1.5 rounded-base min-h-[36px]",
                        "bg-grey-ultra-light dark:bg-neutral-750",
                        "cursor-text"
                    )}
                    onClick={() => inputRef.current?.focus()}
                >
                    {Array.from(selectedTags).sort((a, b) => a.localeCompare(b)).map(tag => (
                        <span
                            key={tag}
                            className={twMerge(
                                "flex items-center text-xs px-1.5 py-0.5 rounded-sm font-medium",
                                "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light"
                            )}
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTagPill(tag);
                                }}
                                className={twMerge(
                                    "ml-1.5 -mr-0.5 p-0.5 rounded-full flex items-center justify-center",
                                    "text-primary/70 hover:text-error dark:text-primary-light/70 dark:hover:text-red-400",
                                    "hover:bg-error/10 dark:hover:bg-error/20 transition-colors"
                                )}
                                aria-label={`Remove tag ${tag}`}
                            >
                                <Icon name="x" size={10} strokeWidth={2.5}/>
                            </button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={selectedTags.size === 0 ? t('taskDetail.addTags') : ""}
                        className={twMerge(
                            "flex-grow bg-transparent text-xs p-0 m-0 h-[22px] min-w-[60px]",
                            "text-grey-dark dark:text-neutral-200 placeholder:text-grey-medium dark:placeholder:text-neutral-500",
                            "focus:outline-none"
                        )}
                        onKeyDown={handleKeyDown}
                    />
                </form>
            </div>
            <div className="px-2">
                <div className="h-px bg-grey-light/70 dark:bg-neutral-700/50"></div>
            </div>
            <div
                ref={listContainerRef}
                className="max-h-[160px] overflow-y-auto styled-scrollbar-thin p-1.5 space-y-0.5"
            >
                {canCreateCurrentInput && (
                    <button
                        type="button"
                        onClick={createNewTag}
                        className={twMerge(
                            "relative flex items-center w-full text-left px-1.5 py-0 text-[12px] rounded-base h-7 font-normal",
                            "text-grey-dark dark:text-neutral-300",
                            "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700",
                            "outline-none transition-colors"
                        )}
                    >
                        <Icon name="plus" size={14} strokeWidth={1.5}
                              className="mr-2 flex-shrink-0 text-primary dark:text-primary-light opacity-80"/>
                        <span className="flex-grow truncate">
                            Create: <strong
                            className="font-medium text-primary dark:text-primary-light">{inputValue.trim()}</strong>
                        </span>
                    </button>
                )}
                {availableTagsToDisplay.length > 0 ? (
                    availableTagsToDisplay.map(tag => {
                        const isSelected = selectedTags.has(tag);
                        return (
                            <button
                                type="button"
                                key={tag}
                                onClick={() => toggleTagInList(tag)}
                                className={twMerge(
                                    "relative flex items-center w-full text-left px-1.5 py-0 text-[12px] rounded-base h-7 font-normal",
                                    isSelected ? "text-primary dark:text-primary-light" : "text-grey-dark dark:text-neutral-300",
                                    "hover:bg-grey-ultra-light dark:hover:bg-neutral-700 focus-visible:bg-grey-ultra-light dark:focus-visible:bg-neutral-700",
                                    "outline-none transition-colors"
                                )}
                                aria-pressed={isSelected}
                            >
                                <Icon name="tag" size={14} strokeWidth={1.5}
                                      className={twMerge(
                                          "mr-2 flex-shrink-0 opacity-80",
                                          isSelected ? "text-primary dark:text-primary-light" : "text-grey-medium dark:text-neutral-400"
                                      )}
                                />
                                <span className="flex-grow truncate">{tag}</span>
                                {isSelected && (
                                    <Icon name="check" size={14} strokeWidth={2}
                                          className="ml-2 text-primary dark:text-primary-light flex-shrink-0"/>
                                )}
                            </button>
                        );
                    })
                ) : (!canCreateCurrentInput && inputValue.trim() && (
                    <p className="px-1.5 py-4 text-center text-[11px] text-grey-medium dark:text-neutral-400 italic">
                        No tags found matching "{inputValue.trim()}"
                    </p>
                ))}
                {availableTagsToDisplay.length === 0 && !canCreateCurrentInput && !inputValue.trim() && (
                    allUserTags.length === 0 ? (
                        <p className="px-1.5 py-4 text-center text-[11px] text-grey-medium dark:text-neutral-400 italic">
                            No tags created yet. Type to add a new one.
                        </p>
                    ) : (
                        <p className="px-1.5 py-4 text-center text-[11px] text-grey-medium dark:text-neutral-400 italic">
                            All tags are selected or type to create.
                        </p>
                    )
                )}
            </div>
        </div>
    );
};
AddTagsPopoverContent.displayName = 'AddTagsPopoverContent';
export default AddTagsPopoverContent;