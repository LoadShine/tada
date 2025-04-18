// src/components/common/AddListModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { isAddListModalOpenAtom, userListNamesAtom } from '@/store/atoms';
import Button from './Button';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface AddListModalProps {
    onAdd: (listName: string) => void; // Callback when list is added
}

const AddListModal: React.FC<AddListModalProps> = ({ onAdd }) => {
    const [, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const [allListNames] = useAtom(userListNamesAtom); // Get existing names for validation
    const [listName, setListName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClose = useCallback(() => setIsOpen(false), [setIsOpen]);

    // Focus input on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50); // Short delay for animation
        return () => clearTimeout(timer);
    }, []);


    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            inputRef.current?.focus();
            return;
        }
        if (allListNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
            setError(`List "${trimmedName}" already exists.`);
            inputRef.current?.select();
            return;
        }
        const reservedNames = ['trash', 'archive', 'all', 'today', 'next 7 days', 'completed'];
        if (reservedNames.includes(trimmedName.toLowerCase())) {
            setError(`"${trimmedName}" is a reserved system name.`);
            inputRef.current?.select();
            return;
        }

        setError(null);
        onAdd(trimmedName);
        handleClose();
    }, [listName, allListNames, onAdd, handleClose]);

    return (
        <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-40 flex items-center justify-center p-4" // Stronger backdrop blur
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleClose}
            aria-modal="true"
            role="dialog"
            aria-labelledby="addListModalTitle"
        >
            {/* Modal Content with STRONG scale-in glass effect */}
            <motion.div
                className={twMerge(
                    // Strongest glass for the main modal panel
                    "bg-glass-100 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10",
                    "flex flex-col"
                )}
                initial={{ scale: 0.9, opacity: 0, y: 20 }} // Slightly more dramatic entrance
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} // Emphasized ease
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
                {/* Header - Slightly less prominent glass */}
                <div className="px-4 py-3 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-alt-100 backdrop-blur-lg"> {/* Header glass */}
                    <h2 id="addListModalTitle" className="text-base font-semibold text-gray-800">Create New List</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        icon="x" // Use icon prop
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-black/15 w-7 h-7 -mr-1" // Glassy hover
                        aria-label="Close modal"
                    />
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="listNameInput" className="block text-xs font-medium text-muted-foreground mb-1.5">
                            List Name
                        </label>
                        <input
                            ref={inputRef}
                            id="listNameInput"
                            type="text"
                            value={listName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setListName(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder="e.g., Groceries, Project X"
                            className={twMerge(
                                // Input with inset glass effect
                                "w-full h-9 px-3 text-sm bg-glass-inset-100 backdrop-blur-md border rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted shadow-inner", // Inset glass
                                error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-black/10', // Use glass-friendly border
                                "focus:bg-glass-inset-200" // Change bg on focus
                            )}
                            aria-required="true"
                            aria-invalid={!!error}
                            aria-describedby={error ? "listNameError" : undefined}
                        />
                        {error && <p id="listNameError" className="text-xs text-red-600 mt-1.5">{error}</p>}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end space-x-2 pt-2">
                        {/* Use glass button for Cancel */}
                        <Button variant="glass" size="md" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" disabled={!listName.trim() || !!error}>
                            Create List
                        </Button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default AddListModal;