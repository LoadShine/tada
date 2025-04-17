import React, { useState } from 'react';
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

    const handleClose = () => setIsOpen(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            return;
        }
        // Case-insensitive check for duplicates
        if (allListNames.some(name => name.toLowerCase() === trimmedName.toLowerCase())) {
            setError(`List "${trimmedName}" already exists.`);
            return;
        }
        if (['Inbox', 'Trash', 'Archive', 'All', 'Today', 'Next 7 Days', 'Completed'].includes(trimmedName)) {
            setError(`"${trimmedName}" is a reserved name.`);
            return;
        }

        setError(null);
        onAdd(trimmedName); // Call the callback passed from Sidebar
        handleClose();
    };

    return (
        // Backdrop with blur and fade-in
        <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleClose} // Close on backdrop click
        >
            {/* Modal Content with scale-in */}
            <motion.div
                className={twMerge(
                    "bg-canvas w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/5",
                    "flex flex-col" // Ensure flex column layout
                )}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-border-color flex justify-between items-center">
                    <h2 className="text-base font-semibold text-gray-800">Create New List</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-black/5 w-7 h-7 -mr-1"
                        aria-label="Close modal"
                    >
                        <Icon name="x" size={16} />
                    </Button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    <div>
                        <label htmlFor="listNameInput" className="block text-xs font-medium text-muted-foreground mb-1">
                            List Name
                        </label>
                        <input
                            id="listNameInput"
                            type="text"
                            value={listName}
                            onChange={(e) => {
                                setListName(e.target.value);
                                if (error) setError(null); // Clear error on typing
                            }}
                            placeholder="e.g., Groceries, Project X"
                            className={twMerge(
                                "w-full h-9 px-3 text-sm bg-canvas-inset border rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted",
                                error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-border-color'
                            )}
                            autoFocus
                        />
                        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="outline" size="md" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" disabled={!listName.trim()}>
                            Create List
                        </Button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

export default AddListModal;