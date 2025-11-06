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
    size?: number; // e.g., 16 for TaskItem, 12 for SubtaskItem
    className?: string;
    disabled?: boolean;
}

const SelectionCheckboxRadix: React.FC<SelectionCheckboxProps> = memo(({
                                                                           id,
                                                                           checked,
                                                                           indeterminate = false,
                                                                           onChange,
                                                                           'aria-label': ariaLabel,
                                                                           size = 16, // Default to 16px per spec
                                                                           className,
                                                                           disabled = false,
                                                                       }) => {
    const checkboxState = useMemo((): Checkbox.CheckedState => {
        if (indeterminate) return 'indeterminate';
        return checked;
    }, [checked, indeterminate]);

    const wrapperClasses = useMemo(() => twMerge(
        "relative inline-flex items-center justify-center flex-shrink-0 rounded-full transition-all duration-200 ease-in-out", // Rounded-full for circular checkbox
        "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        // Unchecked state: 1px #EEEEF2 border (border-grey-light)
        checkboxState === false && "border border-grey-light hover:border-primary-dark",
        // Checked or Indeterminate state: Filled with primary color #FF9466
        (checkboxState === true || checkboxState === 'indeterminate') && "bg-primary border-primary hover:bg-primary-dark hover:border-primary-dark",
        className
    ), [disabled, className, checkboxState]);

    const iconName = useMemo(() => {
        if (indeterminate) return 'minus';
        if (checked) return 'check';
        return undefined;
    }, [checked, indeterminate]);

    const iconColor = "text-white"; // Icon is always white when visible
    const iconSize = size * 0.6; // Icon size relative to checkbox size

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
            style={{
                width: size,
                height: size,
                borderWidth: checkboxState === false ? '1px' : '0px'
            }} // Explicit 1px border only when unchecked
        >
            <Checkbox.Indicator className="absolute inset-0 flex items-center justify-center">
                {iconName && (
                    <Icon
                        name={iconName}
                        size={iconSize}
                        className={twMerge("transition-colors duration-100 ease-in-out", iconColor)}
                        strokeWidth={size > 12 ? 2 : 1.5} // Thicker stroke for larger checkbox icon
                        aria-hidden="true"
                    />
                )}
            </Checkbox.Indicator>
        </Checkbox.Root>
    );
});
SelectionCheckboxRadix.displayName = 'SelectionCheckboxRadix';
export default SelectionCheckboxRadix;