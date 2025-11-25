
import React, { useState, useCallback } from 'react';
import { ClockIcon, ChevronDownIcon, ChevronRightIcon, StarIcon } from './Icons.tsx';

interface SidebarItem {
    id: string;
    text: string;
    updatedAt?: number;
}

interface LeftSidebarProps {
    isOpen: boolean;
    recents: SidebarItem[];
    favorites: SidebarItem[];
    onNavigate: (id: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = React.memo(({ isOpen, recents, favorites, onNavigate }) => {
    const [width, setWidth] = useState(256);
    const [isRecentsCollapsed, setIsRecentsCollapsed] = useState(false);
    const [isFavoritesCollapsed, setIsFavoritesCollapsed] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
        const startX = mouseDownEvent.clientX;
        const startWidth = width;

        const doDrag = (mouseMoveEvent: MouseEvent) => {
            const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
            if (newWidth > 150 && newWidth < 600) {
                setWidth(newWidth);
            }
        };

        const stopDrag = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }, [width]);

    if (!isOpen) return null;

    return (
        <div 
            className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col h-full relative group/sidebar"
            style={{ width: `${width}px`, fontSize: 'calc(var(--font-size) * 0.87)' }}
        >
            {/* Resizer Handle */}
            <div 
                className={`absolute right-[-2px] top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-blue-400/50 transition-colors ${isResizing ? 'bg-blue-400/50' : ''}`}
                onMouseDown={startResizing}
            />

            <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
                {/* Favorites Section */}
                <div>
                    <div 
                        className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 select-none"
                        onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <StarIcon className="w-4 h-4" />
                            <span className="font-bold text-[length:var(--font-size)]">Favorites</span>
                        </div>
                        <button className="text-gray-400">
                            {isFavoritesCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                    </div>

                    {!isFavoritesCollapsed && (
                        <div className="p-2">
                            {favorites.length === 0 ? (
                                <div className="text-xs text-gray-400 dark:text-gray-500 text-center my-2 italic">
                                    No favorites yet
                                </div>
                            ) : (
                                <ul className="space-y-0">
                                    {favorites.map(item => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => onNavigate(item.id)}
                                                className="w-full text-left px-3 py-0 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors group"
                                            >
                                                <div className="text-gray-800 dark:text-gray-200 truncate font-medium">
                                                    {item.text || <em className="text-gray-400">Untitled</em>}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* Recents Section */}
                <div className="border-t border-gray-200 dark:border-gray-700">
                    <div 
                        className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 select-none"
                        onClick={() => setIsRecentsCollapsed(!isRecentsCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <ClockIcon className="w-4 h-4" />
                            <span className="font-bold text-[length:var(--font-size)]">Recents</span>
                        </div>
                        <button className="text-gray-400">
                            {isRecentsCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                    </div>

                    {!isRecentsCollapsed && (
                        <div className="p-2">
                            {recents.length === 0 ? (
                                <div className="text-xs text-gray-400 dark:text-gray-500 text-center my-2 italic">
                                    No recent changes
                                </div>
                            ) : (
                                <ul className="space-y-0">
                                    {recents.map(item => (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => onNavigate(item.id)}
                                                className="w-full text-left px-3 py-0 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors group"
                                            >
                                                <div className="text-gray-800 dark:text-gray-200 truncate font-medium">
                                                    {item.text || <em className="text-gray-400">Untitled</em>}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
