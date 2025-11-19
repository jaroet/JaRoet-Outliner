
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CircleIcon } from './Icons.tsx';
import type { Bullet, FlatBullet } from '../types.ts';

interface ImportSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (targetId: string | null) => void;
    bullets: Bullet[];
}

export const ImportSelectionModal: React.FC<ImportSelectionModalProps> = ({ isOpen, onClose, onConfirm, bullets }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedId(null); // Default to Root
            // Slightly delay focus so the modal renders first
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Optimization: Calculate flat list inside the modal only when open
    const flatBullets: FlatBullet[] = useMemo(() => {
        if (!isOpen) return [];
        
        const results: FlatBullet[] = [];
        const traverse = (nodes: Bullet[], currentPath: string[]) => {
            for (const node of nodes) {
                results.push({
                    id: node.id,
                    text: node.text,
                    path: currentPath,
                    createdAt: node.createdAt,
                    updatedAt: node.updatedAt,
                });
                if (node.children && node.children.length > 0) {
                    traverse(node.children, [...currentPath, node.text || 'Untitled']);
                }
            }
        };
        traverse(bullets, []);
        return results;
    }, [bullets, isOpen]);

    const filteredBullets = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const lowerQuery = searchQuery.toLowerCase();
        return flatBullets.filter(b => b.text.toLowerCase().includes(lowerQuery)).slice(0, 50);
    }, [flatBullets, searchQuery]);

    const handleConfirm = () => {
        onConfirm(selectedId);
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Import Content</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Where do you want to place the imported items?
                    </p>
                </div>

                <div className="p-4 overflow-y-auto flex-grow">
                    {/* Root Option */}
                    <div 
                        onClick={() => setSelectedId(null)}
                        className={`p-3 rounded-md cursor-pointer border transition-colors flex items-center gap-3 mb-4 ${
                            selectedId === null 
                                ? 'bg-[var(--main-color)]/10 border-[var(--main-color)]' 
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedId === null 
                                ? 'border-[var(--main-color)]' 
                                : 'border-gray-400'
                        }`}>
                            {selectedId === null && <div className="w-2 h-2 rounded-full bg-[var(--main-color)]" />}
                        </div>
                        <div>
                            <span className="block font-medium text-gray-800 dark:text-gray-200">Root (Top Level)</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Add as new items at the bottom of your outline</span>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or select a specific item:</div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search for an item..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)] mb-2"
                        />
                        
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                            {filteredBullets.length > 0 ? (
                                <ul>
                                    {filteredBullets.map(bullet => (
                                        <li 
                                            key={bullet.id}
                                            onClick={() => setSelectedId(bullet.id)}
                                            className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                                                selectedId === bullet.id 
                                                    ? 'selected-item-bg text-white' 
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                                            }`}
                                        >
                                            <CircleIcon className="w-1.5 h-1.5 flex-shrink-0" />
                                            <span className="truncate">{bullet.text || <em>Untitled</em>}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                    {searchQuery ? 'No items found' : 'Type to search...'}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {selectedId && (
                        <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded border border-blue-100 dark:border-blue-800">
                            Items will be added as children of the selected item.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="px-4 py-2 rounded-md bg-[var(--main-color)] text-white hover:opacity-90"
                    >
                        Import
                    </button>
                </div>
            </div>
        </div>
    );
};
