// src/components/common/SelectionCheckbox.tsx
import React, {memo, useMemo} from 'react';
import {twMerge} from 'tailwind-merge';
import Icon from './Icon';
import * as Checkbox from '@radix-ui/react-checkbox';

interface SelectionCheckboxProps {
    id: string;
    checked: boolean;
    indeterminate?: boolean;
    onChange: (checked: boolean) => void;
    'aria-label': string;
    size?: number;
    className?: string;
    disabled?: boolean;
}

const SelectionCheckboxRadix: React.FC<SelectionCheckboxProps> = memo(({
                                                                           id,
                                                                           checked,
                                                                           indeterminate = false,
                                                                           onChange,
                                                                           'aria-label': ariaLabel,
                                                                           size = 16,
                                                                           className,
                                                                           disabled = false,
                                                                       }) => {
    const checkboxState = useMemo((): Checkbox.CheckedState => {
        if (indeterminate) return 'indeterminate';
        return checked;
    }, [checked, indeterminate]);

    const wrapperClasses = useMemo(() => twMerge(
        "relative inline-flex items-center justify-center flex-shrink-0 rounded-full border transition-all duration-200 ease-apple focus-within:ring-1 focus-within:ring-primary/50 focus-within:ring-offset-1",
        "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
        !disabled && "cursor-pointer",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:hover:bg-primary/90 data-[state=checked]:hover:border-primary/90",
        "data-[state=indeterminate]:bg-primary/50 data-[state=indeterminate]:border-primary/50 data-[state=indeterminate]:hover:bg-primary/60 data-[state=indeterminate]:hover:border-primary/60",
        "data-[state=unchecked]:bg-white/40 data-[state=unchecked]:border-gray-400/80 data-[state=unchecked]:hover:border-primary/60",
        className
    ), [disabled, className]);

    const iconName = useMemo(() => {
        if (indeterminate) return 'minus';
        if (checked) return 'check';
        return undefined;
    }, [checked, indeterminate]);

    const iconColor = useMemo(() => {
        if (checked || indeterminate) return 'text-white';
        return 'text-transparent';
    }, [checked, indeterminate]);

    const handleCheckedChange = (radixChecked: Checkbox.CheckedState) => {
        onChange(radixChecked === true);
    };


    return (
        <Checkbox.Root
            id={id}
            checked={checkboxState}
            onCheckedChange={handleCheckedChange}
            disabled={disabled}
            aria-label={ariaLabel}
            className={wrapperClasses}
            style={{width: size, height: size}}
        >
            <Checkbox.Indicator className="absolute inset-0 flex items-center justify-center">
                {iconName && (
                    <Icon
                        name={iconName}
                        size={size * 0.65}
                        className={twMerge("transition-colors duration-100 ease-apple", iconColor)}
                        strokeWidth={3}
                        aria-hidden="true"
                    />
                )}
            </Checkbox.Indicator>
        </Checkbox.Root>
    );
});
SelectionCheckboxRadix.displayName = 'SelectionCheckboxRadix';

export default SelectionCheckboxRadix;