// src/components/common/AddListModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { isAddListModalOpenAtom, userListNamesAtom } from '@/store/atoms';
import Icon from './Icon';
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

    const handleClose = () => setIsOpen(false);

    // Focus input on mount
    useEffect(() => {
        // Timeout needed to allow modal animation to potentially finish
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50); // Short delay
        return () => clearTimeout(timer);
    }, []);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            inputRef.current?.focus();
            return;
        }
        // Case-insensitive check for duplicates
        if (allListNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
            setError(`List "${trimmedName}" already exists.`);
            inputRef.current?.select(); // Select text for easy replacement
            return;
        }
        // Check against reserved system names (case-insensitive)
        const reservedNames = ['inbox', 'trash', 'archive', 'all', 'today', 'next 7 days', 'completed'];
        if (reservedNames.includes(trimmedName.toLowerCase())) {
            setError(`"${trimmedName}" is a reserved system name.`);
            inputRef.current?.select();
            return;
        }
        // Add more validation if needed (e.g., length, special characters)

        setError(null);
        onAdd(trimmedName); // Call the callback passed from Sidebar
        handleClose(); // Close modal on successful submission
    };

    return (
        // AnimatePresence should wrap this component where it's rendered (in Sidebar)
        // Backdrop with blur and fade-in
        <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" // Slightly darker backdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleClose} // Close on backdrop click
            aria-modal="true"
            role="dialog"
            aria-labelledby="addListModalTitle"
        >
            {/* Modal Content with scale-in */}
            <motion.div
                className={twMerge(
                    "bg-glass-100 w-full max-w-sm rounded-lg shadow-strong overflow-hidden border border-black/5", // Use glass bg, standard radius
                    "flex flex-col" // Ensure flex column layout
                )}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-black/5 flex justify-between items-center flex-shrink-0">
                    <h2 id="addListModalTitle" className="text-base font-semibold text-gray-800">Create New List</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-black/5 w-7 h-7 -mr-1" // Standard icon button size/style
                        aria-label="Close modal"
                    >
                        <Icon name="x" size={16} />
                    </Button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4"> {/* Increased padding slightly */}
                    <div>
                        <label htmlFor="listNameInput" className="block text-xs font-medium text-muted-foreground mb-1.5">
                            List Name
                        </label>
                        <input
                            ref={inputRef}
                            id="listNameInput"
                            type="text"
                            value={listName}
                            onChange={(e) => {
                                setListName(e.target.value);
                                if (error) setError(null); // Clear error on typing
                            }}
                            placeholder="e.g., Groceries, Project X"
                            className={twMerge(
                                "w-full h-9 px-3 text-sm bg-canvas-inset border rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted", // Standard input style
                                error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-border-color-medium' // Use medium border color
                            )}
                            // autoFocus removed, using useEffect hook instead
                            aria-required="true"
                            aria-invalid={!!error}
                            aria-describedby={error ? "listNameError" : undefined}
                        />
                        {error && <p id="listNameError" className="text-xs text-red-600 mt-1.5">{error}</p>}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="outline" size="md" onClick={handleClose}>
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