import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {twMerge} from 'tailwind-merge';
import Icon from './Icon';
import {AIModel} from '@/config/aiProviders';
import useDebounce from '@/hooks/useDebounce';

interface ModelComboboxProps {
    /** Currently selected model ID */
    value: string | null;
    /** Callback when model selection changes */
    onChange: (modelId: string) => void;
    /** Available models to choose from */
    models: AIModel[];
    /** Placeholder text when no model is selected */
    placeholder?: string;
    /** Placeholder text for search input */
    searchPlaceholder?: string;
    /** Text shown when no models match the search */
    noResultsText?: string;
    /** Whether the combobox is disabled */
    disabled?: boolean;
    /** Additional className for the trigger element */
    className?: string;
    /** ID for the combobox (for accessibility) */
    id?: string;
}

/** Single model option in the dropdown list */
const ModelOption: React.FC<{
    model: AIModel;
    isSelected: boolean;
    isHighlighted: boolean;
    onSelect: () => void;
    onMouseEnter: () => void;
}> = memo(({model, isSelected, isHighlighted, onSelect, onMouseEnter}) => (
    <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={onSelect}
        onMouseEnter={onMouseEnter}
        className={twMerge(
            "relative flex items-center w-full px-3 h-7",
            "text-[13px] font-light rounded-[4px]",
            "select-none cursor-pointer transition-colors",
            isHighlighted && "bg-grey-ultra-light dark:bg-neutral-600",
            isSelected
                ? "text-primary dark:text-primary-light"
                : "text-grey-dark dark:text-neutral-100"
        )}
    >
        <span className="flex-1 truncate text-left">{model.name}</span>
        {isSelected && (
            <Icon name="check" size={12} strokeWidth={2} className="ml-2 flex-shrink-0"/>
        )}
    </button>
));
ModelOption.displayName = 'ModelOption';

// Static styles
const popoverContentClasses = twMerge(
    "z-[70] bg-white rounded-base shadow-popover",
    "dark:bg-neutral-800 dark:border dark:border-neutral-700",
    "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
);

const searchInputClasses = twMerge(
    "flex-1 bg-transparent text-[13px] font-light",
    "text-grey-dark dark:text-neutral-200",
    "placeholder:text-grey-medium dark:placeholder:text-neutral-500",
    "focus:outline-none"
);

/**
 * A searchable combobox for selecting AI models.
 * - Click to open search dropdown
 * - Supports keyboard navigation (Arrow keys, Enter, Escape)
 * - Auto-selects first model if closed without selection
 */
const ModelCombobox: React.FC<ModelComboboxProps> = memo(({
    value,
    onChange,
    models,
    placeholder = 'Select Model',
    searchPlaceholder = 'Search models...',
    noResultsText = 'No models found',
    disabled = false,
    className,
    id,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const debouncedSearch = useDebounce(searchValue.toLowerCase().trim(), 150);

    const selectedModel = useMemo(
        () => models.find(m => m.id === value),
        [models, value]
    );

    const filteredModels = useMemo(() => {
        if (!debouncedSearch) return models;
        return models.filter(m =>
            m.name.toLowerCase().includes(debouncedSearch) ||
            m.id.toLowerCase().includes(debouncedSearch)
        );
    }, [models, debouncedSearch]);

    // Reset highlight when list changes
    useEffect(() => setHighlightedIndex(0), [filteredModels.length]);

    // Focus input on open, clear search on close
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setSearchValue('');
        }
    }, [isOpen]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (listRef.current && isOpen) {
            const item = listRef.current.children[highlightedIndex] as HTMLElement;
            item?.scrollIntoView({block: 'nearest'});
        }
    }, [highlightedIndex, isOpen]);

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open && !value && filteredModels.length > 0) {
            onChange(filteredModels[0].id);
        }
        setIsOpen(open);
    }, [value, filteredModels, onChange]);

    const handleSelect = useCallback((model: AIModel) => {
        onChange(model.id);
        setIsOpen(false);
        setSearchValue('');
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, filteredModels.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredModels[highlightedIndex]) {
                    handleSelect(filteredModels[highlightedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (!value && filteredModels.length > 0) {
                    onChange(filteredModels[0].id);
                }
                setIsOpen(false);
                break;
        }
    }, [filteredModels, highlightedIndex, handleSelect, value, onChange]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.currentTarget.scrollTop += e.deltaY;
    }, []);

    const triggerClasses = twMerge(
        "flex items-center justify-between w-[240px] h-8 px-3",
        "text-[13px] font-light rounded-base",
        "bg-grey-ultra-light dark:bg-neutral-700",
        "text-grey-dark dark:text-neutral-100",
        "hover:bg-grey-light dark:hover:bg-neutral-600",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        disabled && "opacity-50 cursor-not-allowed",
        className
    );

    return (
        <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Popover.Trigger asChild disabled={disabled}>
                <button
                    id={id}
                    type="button"
                    className={triggerClasses}
                    aria-label={placeholder}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className={twMerge(
                        "truncate",
                        !selectedModel && "text-grey-medium dark:text-neutral-400"
                    )}>
                        {selectedModel?.name ?? placeholder}
                    </span>
                    <Icon
                        name="chevron-down"
                        size={14}
                        strokeWidth={1.5}
                        className="text-grey-medium dark:text-neutral-400"
                    />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    sideOffset={5}
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    asChild
                >
                    <div
                        className={twMerge(popoverContentClasses, "w-[240px] flex flex-col")}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-grey-light dark:border-neutral-700">
                            <div className="flex items-center px-2 h-8 rounded-base bg-grey-ultra-light dark:bg-neutral-750">
                                <Icon
                                    name="search"
                                    size={14}
                                    strokeWidth={1.5}
                                    className="text-grey-medium dark:text-neutral-400 mr-2 flex-shrink-0"
                                />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={searchPlaceholder}
                                    className={searchInputClasses}
                                />
                            </div>
                        </div>

                        {/* Model List */}
                        <div
                            ref={listRef}
                            role="listbox"
                            className="max-h-[224px] overflow-y-auto styled-scrollbar p-1"
                            onWheel={handleWheel}
                        >
                            {filteredModels.length > 0 ? (
                                filteredModels.map((model, index) => (
                                    <ModelOption
                                        key={model.id}
                                        model={model}
                                        isSelected={model.id === value}
                                        isHighlighted={index === highlightedIndex}
                                        onSelect={() => handleSelect(model)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                    />
                                ))
                            ) : (
                                <p className="px-3 py-4 text-center text-[12px] text-grey-medium dark:text-neutral-400 italic">
                                    {noResultsText}
                                </p>
                            )}
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
});

ModelCombobox.displayName = 'ModelCombobox';
export default ModelCombobox;
