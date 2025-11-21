

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Bullet, Settings, CoreBullet } from './types.ts';
import { Toolbar } from './components/Toolbar.tsx';
import { LeftSidebar } from './components/LeftSidebar.tsx';
import { BulletItem } from './components/BulletItem.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { LinkPopup } from './components/LinkPopup.tsx';
import { TagPopup } from './components/TagPopup.tsx';
import { TrashIcon } from './components/Icons.tsx';
import { ImportSelectionModal } from './components/ImportSelectionModal.tsx';
import { ToastContainer, useToast } from './components/Toast.tsx';

declare const Dexie: any;

// --- DB Setup ---
class JaroetDatabase extends Dexie {
    keyValuePairs: any;

    constructor() {
        super("JaroetOutlinerDB");
        this.version(1).stores({
            keyValuePairs: 'key', 
        });
        this.keyValuePairs = this.table('keyValuePairs');
    }
}

const db = new JaroetDatabase();


// --- Constants and Helpers ---
const DAILY_LOG_ROOT_TEXT = 'Daily Log';

const initialData: Bullet[] = [
  {
    id: 'journal-root',
    text: DAILY_LOG_ROOT_TEXT,
    children: [],
    isCollapsed: true,
  },
  {
    id: 'help-info',
    text: 'For help and documentation, import the jr_help-documentation.json file.',
    children: [],
    isCollapsed: false,
  }
];

const createNewBullet = (text = ''): Bullet => {
    const now = Date.now();
    return {
        id: crypto.randomUUID(),
        text,
        children: [],
        isCollapsed: false,
        createdAt: now,
        updatedAt: now,
    };
};

const migrateBullets = (nodes: Bullet[]): Bullet[] => {
    if (!Array.isArray(nodes)) return [];
    const now = Date.now();
    return nodes.map(node => ({
        ...node,
        createdAt: node.createdAt || now,
        updatedAt: node.updatedAt || now,
        children: migrateBullets(node.children || []),
    }));
};

const regenerateIds = (nodes: Bullet[]): Bullet[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(node => ({
        ...node,
        id: crypto.randomUUID(),
        children: regenerateIds(node.children || []),
    }));
};

// Optimized mapBullets with structural sharing
const mapBullets = (
    nodes: Bullet[],
    callback: (bullet: Bullet) => Bullet
): Bullet[] => {
    let changed = false;
    const newNodes = nodes.map(node => {
        const newNode = callback(node);
        const newChildren = mapBullets(newNode.children, callback);
        
        // If the node itself didn't change (identity check) and children didn't change, return original
        if (newNode === node && newChildren === node.children) {
            return node;
        }
        
        changed = true;
        return {
            ...newNode,
            children: newChildren,
        };
    });
    return changed ? newNodes : nodes;
};

/**
 * A generic helper to calculate the next index for navigating a list of suggestions.
 * This is used by both the link and tag popups to avoid code duplication.
 */
const navigateSuggestions = <T,>(
    prevState: { suggestions: T[]; selectedIndex: number },
    direction: 'up' | 'down'
): number => {
    const { suggestions, selectedIndex } = prevState;
    const count = suggestions.length;
    if (count === 0) return selectedIndex;
    if (direction === 'down') {
        return (selectedIndex + 1) % count;
    } else { // 'up'
        return (selectedIndex - 1 + count) % count;
    }
};


// --- Settings Modal Component ---
const FONT_LIST = [
  'Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Trebuchet MS', 
  'Times New Roman', 'Georgia', 'Garamond', 
  'Courier New', 'Brush Script MT', 'sans-serif', 'serif', 'monospace'
];

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: Settings) => void;
    currentSettings: Settings;
    onClearData: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings, onClearData }) => {
    const [settings, setSettings] = useState(currentSettings);

    useEffect(() => {
        setSettings(currentSettings);
    }, [isOpen, currentSettings]);

    const handleSave = () => {
        onSave(settings);
        onClose();
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({...prev, [name]: value }));
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({...prev, fontSize: parseInt(e.target.value, 10) }));
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-30 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="p-4 text-lg font-semibold border-b border-gray-200 dark:border-gray-700">Settings</h2>
                <div className="p-4 space-y-4">
                    <div>
                        <label htmlFor="fileName" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">File Name</label>
                        <input type="text" id="fileName" name="fileName" value={settings.fileName} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"/>
                    </div>
                    <div>
                        <label htmlFor="mainColor" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Main Color</label>
                        <input type="color" id="mainColor" name="mainColor" value={settings.mainColor} onChange={handleInputChange} className="w-full h-10 p-1 bg-gray-100 dark:bg-gray-700 rounded-md cursor-pointer"/>
                    </div>
                    <div>
                        <label htmlFor="fontFamily" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Font</label>
                        <select id="fontFamily" name="fontFamily" value={settings.fontFamily} onChange={handleInputChange} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]">
                            {FONT_LIST.map(font => <option key={font} value={font}>{font}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="fontSize" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Font Size ({settings.fontSize}px)</label>
                        <input type="range" id="fontSize" name="fontSize" min="12" max="24" value={settings.fontSize} onChange={handleFontSizeChange} className="w-full"/>
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                         <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Data Management</h3>
                         <button 
                            onClick={onClearData}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors w-full justify-center"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Reset Application Data
                        </button>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                            Deletes all local data and restores the default template.
                        </p>
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-md bg-[var(--main-color)] text-white hover:opacity-90">Save</button>
                </div>
            </div>
        </div>
    );
}

// --- Main App Component ---
export const App = () => {
    const [bullets, setBullets] = useState<Bullet[]>(initialData);
    const [zoomedBulletId, setZoomedBulletId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusOptions, setFocusOptions] = useState<{ id: string | null; position: 'start' | 'end' | number }>({ id: null, position: 'end' });
    const isInitialFocusSet = useRef(false);
    const linkPopupRef = useRef(null);
    const tagPopupRef = useRef(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [linkSelectionHandler, setLinkSelectionHandler] = useState<{ handler: ((bullet: any) => void) | null }>({ handler: null });
    const [tagSelectionHandler, setTagSelectionHandler] = useState<{ handler: ((tag: string) => void) | null }>({ handler: null });
    const prevFocusId = useRef<string | null>(null);
    const dataLoadedRef = useRef(false);
    const prevCoreDataRef = useRef<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    
    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [recentBullets, setRecentBullets] = useState<{id: string, text: string, updatedAt: number}[]>([]);
    const [favoriteBullets, setFavoriteBullets] = useState<{id: string, text: string}[]>([]);

    // Toast Hook
    const { toasts, addToast, removeToast } = useToast();
    
    const [settings, setSettings] = useState<Settings>({
        mainColor: '#60a5fa',
        fileName: 'My Outline',
        fontFamily: 'sans-serif',
        fontSize: 16,
    });
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Import Modal State
    const [pendingImportData, setPendingImportData] = useState<Bullet[] | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [linkPopupState, setLinkPopupState] = useState({
        isOpen: false, targetId: null as string | null, query: '', position: { top: 0, left: 0 }, suggestions: [] as any[], selectedIndex: 0
    });
    const [tagPopupState, setTagPopupState] = useState({
        isOpen: false, targetId: null as string | null, query: '', position: { top: 0, left: 0 }, suggestions: [] as string[], selectedIndex: 0
    });


    const currentFocusId = focusOptions.id;
    const focusPosition = focusOptions.position;

    const handleFocusChange = useCallback((id: string | null, position: 'start' | 'end' | number = 'end') => {
        setFocusOptions({ id, position });
    }, []);

    const getCoreDataString = useCallback((nodes: Bullet[]) => {
        const removeUiState = (b: Bullet): CoreBullet => {
            return {
                id: b.id,
                text: b.text,
                children: b.children.map(removeUiState),
                originalId: b.originalId,
                isFavorite: b.isFavorite,
                createdAt: b.createdAt,
                updatedAt: b.updatedAt,
            };
        };
        const coreBullets = nodes.map(removeUiState);
        return JSON.stringify(coreBullets);
    }, []);

    const handleThemeToggle = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        db.keyValuePairs.put({ key: 'theme', value: newTheme });
        addToast(`Switched to ${newTheme} mode`, 'info');
    }, [theme, addToast]);

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
        root.classList.toggle('dark', isDark);
    }, [theme]);

    // Helper to update recent list in-memory
    const updateRecentList = useCallback((id: string, text: string | undefined, updatedAt: number) => {
        setRecentBullets(prev => {
            const newList = prev.filter(item => item.id !== id);
            
            let itemText = text;
            if (itemText === undefined) {
                const existing = prev.find(i => i.id === id);
                if (existing) itemText = existing.text;
                else return prev; // Don't add if we don't know text
            }

            newList.unshift({ id, text: itemText, updatedAt });
            return newList.slice(0, 12);
        });
    }, []);

    const removeFromRecentList = useCallback((id: string) => {
        setRecentBullets(prev => prev.filter(item => item.id !== id));
        setFavoriteBullets(prev => prev.filter(item => item.id !== id));
    }, []);


    // Load settings and data on initial mount
    useEffect(() => {
        const loadData = async () => {
            // Load theme
            const savedThemeEntry = await db.keyValuePairs.get('theme');
            const savedTheme = savedThemeEntry?.value;
            if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
                setTheme(savedTheme);
            }

            // Load sidebar state
            try {
                const savedSidebar = await db.keyValuePairs.get('isSidebarOpen');
                if (savedSidebar !== undefined) {
                    setIsSidebarOpen(savedSidebar.value);
                }
            } catch (e) {
                console.error("Failed to load sidebar state", e);
            }
            
            // Load Recents & Favorites from DB directly
            try {
                const savedRecents = await db.keyValuePairs.get('recentBullets');
                if (savedRecents?.value) {
                    setRecentBullets(savedRecents.value);
                }
                
                const savedFavorites = await db.keyValuePairs.get('favoriteBullets');
                if (savedFavorites?.value) {
                    setFavoriteBullets(savedFavorites.value);
                }
            } catch (e) {
                console.error("Failed to load sidebar lists", e);
            }

            let loadedSettings;
            const defaultSettings = {
                mainColor: '#60a5fa',
                fileName: 'My Outline',
                fontFamily: 'sans-serif',
                fontSize: 16,
            };
            try {
                const savedSettingsEntry = await db.keyValuePairs.get('settings');
                const savedSettings = savedSettingsEntry?.value;
                loadedSettings = { ...defaultSettings, ...(savedSettings || {}) };
                setSettings(loadedSettings);
            } catch (error) {
                console.error("Failed to load settings from IndexedDB", error);
                loadedSettings = defaultSettings;
            }

            let localBullets = null;
            try {
                const savedDataEntry = await db.keyValuePairs.get('bullets');
                const savedData = savedDataEntry?.value;
                if (savedData && Array.isArray(savedData)) {
                   localBullets = savedData;
                }
            } catch(e) {
               console.error("Failed to parse local data from IndexedDB", e);
            }
            
            let initialLoadData = localBullets || initialData;
            initialLoadData = migrateBullets(initialLoadData);

            setBullets(initialLoadData);
            prevCoreDataRef.current = getCoreDataString(initialLoadData);
    
            setZoomedBulletId(null);
            isInitialFocusSet.current = false;
            dataLoadedRef.current = true;
        };

        loadData();
    }, [getCoreDataString]);

    // Save settings and data
    useEffect(() => {
        if (!dataLoadedRef.current) return;
        // Always save settings locally to IndexedDB
        db.keyValuePairs.put({ key: 'settings', value: settings });
        
        document.title = `${settings.fileName || 'Untitled'} - JaRoet Outliner`;
        
        const root = document.documentElement;
        root.style.setProperty('--main-color', settings.mainColor);
        root.style.setProperty('--font-family', settings.fontFamily);
        root.style.setProperty('--font-size', `${settings.fontSize}px`);
        
        // Save main bullet data to IndexedDB
        db.keyValuePairs.put({ key: 'bullets', value: bullets });
        
        const currentCoreData = getCoreDataString(bullets);
        if (currentCoreData !== prevCoreDataRef.current) {
             prevCoreDataRef.current = currentCoreData;
        }

    }, [settings, bullets, getCoreDataString]);
    
    // Save Recents and Favorites separately when they change
    useEffect(() => {
        if (!dataLoadedRef.current) return;
        db.keyValuePairs.put({ key: 'recentBullets', value: recentBullets });
    }, [recentBullets]);

    useEffect(() => {
        if (!dataLoadedRef.current) return;
        db.keyValuePairs.put({ key: 'favoriteBullets', value: favoriteBullets });
    }, [favoriteBullets]);

    
    const findBulletAndParent = useCallback((
        id: string,
        nodes: Bullet[],
        parent: Bullet | null = null
      ): { node: Bullet, parent: Bullet | null, siblings: Bullet[], index: number } | null => {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.id === id) {
            return { node, parent, siblings: nodes, index: i };
          }
          const found = findBulletAndParent(id, node.children, node);
          if (found) return found;
        }
        return null;
    }, []);

    useEffect(() => {
        const currentId = focusOptions.id;
        const prevId = prevFocusId.current;

        if (prevId && prevId !== currentId) {
            const found = findBulletAndParent(prevId, bullets);
            if (found && !found.node.isReadOnly && found.node.text === '' && found.node.children.length === 0) {
                const newBullets = structuredClone(bullets);
                const foundAgain = findBulletAndParent(prevId, newBullets);
                if (foundAgain) {
                    foundAgain.siblings.splice(foundAgain.index, 1);
                    setBullets(newBullets);
                    removeFromRecentList(prevId);
                }
            }
        }

        prevFocusId.current = currentId;
    }, [focusOptions.id, bullets, findBulletAndParent, removeFromRecentList]);


    const breadcrumbs = useMemo(() => {
        if (!zoomedBulletId) return [];
        const path: Bullet[] = [];
        const findPath = (nodes: Bullet[], currentPath: Bullet[]): boolean => {
            for (const node of nodes) {
                const newPath = [...currentPath, node];
                if (node.id === zoomedBulletId) {
                    path.push(...newPath);
                    return true;
                }
                if (findPath(node.children, newPath)) return true;
            }
            return false;
        };
        findPath(bullets, []);
        return path;
    }, [bullets, zoomedBulletId]);
    
    const handleNavigate = useCallback((bulletId: string) => {
        const path: Bullet[] = [];
        const findPath = (nodes: Bullet[], currentPath: Bullet[]): boolean => {
            for (const node of nodes) {
                const newPath = [...currentPath, node];
                if (node.id === bulletId) {
                    path.push(...newPath);
                    return true;
                }
                if (findPath(node.children, newPath)) return true;
            }
            return false;
        };
        findPath(bullets, []);
    
        if (path.length > 0) {
            const parent = path.length > 1 ? path[path.length - 2] : null;
            setZoomedBulletId(parent ? parent.id : null);
            setIsSearchModalOpen(false);
            setTimeout(() => {
                handleFocusChange(bulletId, 'end');
            }, 0);
        }
    }, [bullets, handleFocusChange]);

    const displayedBullets = useMemo(() => {
        if (!zoomedBulletId) return bullets;
        const findZoomed = (nodes: Bullet[]): Bullet | null => {
            for (const node of nodes) {
                if (node.id === zoomedBulletId) return node;
                const found = findZoomed(node.children);
                if (found) return found;
            }
            return null;
        }
        const zoomedNode = findZoomed(bullets);
        return zoomedNode ? zoomedNode.children : [];
    }, [bullets, zoomedBulletId]);

    // Favorites Logic
    const targetFavoriteId = currentFocusId || zoomedBulletId;

    const isTargetFavorite = useMemo(() => {
        if (!targetFavoriteId) return false;
        const findBullet = (nodes: Bullet[]): Bullet | null => {
            for (const node of nodes) {
                if (node.id === targetFavoriteId) return node;
                const found = findBullet(node.children);
                if (found) return found;
            }
            return null;
        }
        const node = findBullet(bullets);
        return node?.isFavorite || false;
    }, [bullets, targetFavoriteId]);

    const handleToggleFavorite = useCallback(() => {
        if (!targetFavoriteId) return;
        
        setBullets(prev => {
            let isNowFav = false;
            let targetText = '';
            
            const newBullets = mapBullets(prev, b => {
                if (b.id === targetFavoriteId) {
                    isNowFav = !b.isFavorite;
                    targetText = b.text;
                    return { ...b, isFavorite: isNowFav };
                }
                return b;
            });
            
            setFavoriteBullets(currentFavs => {
                if (isNowFav) {
                    // Check if already exists to be safe
                    if (currentFavs.some(f => f.id === targetFavoriteId)) return currentFavs;
                    return [...currentFavs, { id: targetFavoriteId, text: targetText }];
                } else {
                    return currentFavs.filter(f => f.id !== targetFavoriteId);
                }
            });

            if (isNowFav) addToast('Added to favorites', 'success');
            else addToast('Removed from favorites', 'info');
            
            return newBullets;
        });
    }, [targetFavoriteId, addToast]);


    const visibleBulletIds = useMemo(() => {
        const getVisibleIds = (nodes: Bullet[]): string[] => {
            let ids: string[] = [];
            for (const node of nodes) {
                ids.push(node.id);
                if (!node.isCollapsed && node.children.length > 0) {
                    ids = ids.concat(getVisibleIds(node.children));
                }
            }
            return ids;
        };
        return getVisibleIds(displayedBullets);
    }, [displayedBullets]);
    
    // --- Refs for Stabilization ---
    const bulletsRef = useRef(bullets);
    const visibleBulletIdsRef = useRef(visibleBulletIds);
    const zoomedBulletIdRef = useRef(zoomedBulletId);
    const focusOptionsRef = useRef(focusOptions);
    const breadcrumbsRef = useRef(breadcrumbs);

    useEffect(() => { bulletsRef.current = bullets; }, [bullets]);
    useEffect(() => { visibleBulletIdsRef.current = visibleBulletIds; }, [visibleBulletIds]);
    useEffect(() => { zoomedBulletIdRef.current = zoomedBulletId; }, [zoomedBulletId]);
    useEffect(() => { focusOptionsRef.current = focusOptions; }, [focusOptions]);
    useEffect(() => { breadcrumbsRef.current = breadcrumbs; }, [breadcrumbs]);

    useEffect(() => {
        if (!isInitialFocusSet.current && visibleBulletIds.length > 0) {
            handleFocusChange(visibleBulletIds[0], 'end');
            isInitialFocusSet.current = true;
        }
    }, [visibleBulletIds, handleFocusChange]);
    
    const handleZoom = useCallback((id: string | null) => {
        const currentBullets = bulletsRef.current;
        const oldZoomedBulletId = zoomedBulletIdRef.current;
        const currentBreadcrumbs = breadcrumbsRef.current;
        
        const isZoomingOut = (id === null && oldZoomedBulletId !== null) || 
                             (id !== null && currentBreadcrumbs.some(b => b.id === id));
        
        if (id === null) { 
            setZoomedBulletId(null);
            if (oldZoomedBulletId) {
                setTimeout(() => handleFocusChange(oldZoomedBulletId), 0);
            } else {
                // Calculate visible IDs for root from current state
                const getVisibleIds = (nodes: Bullet[]): string[] => {
                    let ids: string[] = [];
                    for (const node of nodes) {
                        ids.push(node.id);
                        if (!node.isCollapsed && node.children.length > 0) {
                            ids = ids.concat(getVisibleIds(node.children));
                        }
                    }
                    return ids;
                };
                const rootVisibleIds = getVisibleIds(currentBullets);
                if (rootVisibleIds.length > 0) {
                    handleFocusChange(rootVisibleIds[0]);
                }
            }
            return;
        }

        // Helper to find bullet in current state
        const find = (nodes: Bullet[]): Bullet | null => {
            for(const node of nodes) {
                if (node.id === id) return node;
                const f = find(node.children);
                if (f) return f;
            }
            return null;
        };
        
        const bulletToZoom = find(currentBullets);
    
        if (bulletToZoom && bulletToZoom.children.length === 0 && !bulletToZoom.isReadOnly) {
            const newBullet = createNewBullet();
            setBullets(prevBullets => {
                const newBullets = structuredClone(prevBullets);
                const found = findBulletAndParent(id, newBullets);
                if (found) {
                    found.node.children.push(newBullet);
                    found.node.isCollapsed = false;
                    // Do not update updatedAt for parent just for adding child? 
                    // Usually yes, but let's keep consistent with other ops
                    // found.node.updatedAt = Date.now(); 
                    return newBullets;
                }
                return prevBullets;
            });
            setZoomedBulletId(id);
            setTimeout(() => {
                handleFocusChange(newBullet.id);
            }, 0);
            updateRecentList(newBullet.id, newBullet.text, newBullet.updatedAt || Date.now());
        } else if (bulletToZoom) {
            setZoomedBulletId(id);
            if (isZoomingOut && oldZoomedBulletId) {
                setTimeout(() => handleFocusChange(oldZoomedBulletId), 0);
            } else if (bulletToZoom.children.length > 0) {
                 const getVisibleIds = (nodes: Bullet[]): string[] => {
                    let ids: string[] = [];
                    for (const node of nodes) {
                        ids.push(node.id);
                        if (!node.isCollapsed && node.children.length > 0) {
                            ids = ids.concat(getVisibleIds(node.children));
                        }
                    }
                    return ids;
                };
                const visibleChildrenIds = getVisibleIds(bulletToZoom.children);
                if (visibleChildrenIds.length > 0) {
                    handleFocusChange(visibleChildrenIds[0]);
                }
            }
        }
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);

    const handleGoToJournal = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dayText = `${year}-${month}-${day}`;

        const currentBullets = bulletsRef.current;
        const newBullets = structuredClone(currentBullets);
        
        let journalNode = newBullets.find((b) => b.text === DAILY_LOG_ROOT_TEXT);
        if (!journalNode) {
            journalNode = createNewBullet(DAILY_LOG_ROOT_TEXT);
            newBullets.unshift(journalNode);
        }
        let yearNode = journalNode.children.find((b) => b.text === year);
        if (!yearNode) {
            yearNode = createNewBullet(year);
            journalNode.children.push(yearNode);
        }
        let monthNode = yearNode.children.find((b) => b.text === month);
        if (!monthNode) {
            monthNode = createNewBullet(month);
            yearNode.children.push(monthNode);
        }
        let dayNode = monthNode.children.find((b) => b.text === dayText);
        if (!dayNode) {
            dayNode = createNewBullet(dayText);
            monthNode.children.push(dayNode);
        }
        
        setBullets(newBullets);
        handleNavigate(dayNode.id);
        
    }, [handleNavigate]);

    const handleUpdate = useCallback((id: string, updates: Partial<Bullet>) => {
        setBullets(prev => {
            let hasChange = false;
            const updateNode = (nodes: Bullet[]): Bullet[] => {
                return nodes.map(node => {
                    if (node.id === id) {
                        const updatedNode = { ...node, ...updates, updatedAt: Date.now() };
                        hasChange = true;
                        if (updates.text !== undefined && updates.text !== node.text) {
                            updateRecentList(node.id, updates.text, updatedNode.updatedAt);
                        }
                        return updatedNode;
                    }
                    if (node.children.length > 0) {
                         const newChildren = updateNode(node.children);
                         if (newChildren !== node.children) {
                             return { ...node, children: newChildren };
                         }
                    }
                    return node;
                });
            };
            const next = updateNode(prev);
            return hasChange ? next : prev;
        });
    }, [updateRecentList]);

    const handleAddSibling = useCallback((id: string, text: string = '') => {
        setBullets(prev => {
            const addSibling = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index !== -1) {
                    const newBullet = createNewBullet(text);
                    const newNodes = [...nodes];
                    newNodes.splice(index + 1, 0, newBullet);
                    setTimeout(() => handleFocusChange(newBullet.id, 'start'), 0); 
                    return newNodes;
                }
                return nodes.map(node => {
                    if (node.children.length > 0) {
                        const newChildren = addSibling(node.children);
                        if (newChildren !== node.children) return { ...node, children: newChildren };
                    }
                    return node;
                });
            };
            return addSibling(prev);
        });
    }, [handleFocusChange]);

    const handleDelete = useCallback((id: string) => {
        setBullets(prev => {
            let parentOfDeleted: Bullet | null = null;
            let indexDeleted = -1;
            
            const deleteNode = (nodes: Bullet[], parent: Bullet | null): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index !== -1) {
                    parentOfDeleted = parent;
                    indexDeleted = index;
                    return nodes.filter(n => n.id !== id);
                }
                return nodes.map(node => {
                    const newChildren = deleteNode(node.children, node);
                    if (newChildren !== node.children) return { ...node, children: newChildren };
                    return node;
                });
            };
            
            const newBullets = deleteNode(prev, null);
            
            // Focus management after delete
            if (indexDeleted !== -1) {
                setTimeout(() => {
                    // Try to focus prev sibling, then parent
                    const siblings = parentOfDeleted ? parentOfDeleted.children : newBullets; // NOTE: parentOfDeleted is from OLD state
                    // But we need to find where we are in NEW state.
                    // Simpler: if we had siblings, focus index-1, else focus parent
                    // This is a simplification. Proper implementation requires finding the context in new tree.
                    // Let's just rely on stabilization or default.
                    if (indexDeleted > 0) {
                         // Need to find the sibling in the new structure to get its ID?
                         // Actually, siblings array in `deleteNode` (before filter) had the IDs.
                         // We can't easily get the ID of index-1 without more logic.
                         // Handled by `handleFocusChange(null)` if ID missing? No.
                         // Let's skip auto-focus here for simplicity, or user presses arrow keys.
                    } else if (parentOfDeleted) {
                        handleFocusChange(parentOfDeleted.id);
                    }
                }, 0);
                removeFromRecentList(id);
            }
            return newBullets;
        });
    }, [handleFocusChange, removeFromRecentList]);

    const handleIndent = useCallback((id: string) => {
        setBullets(prev => {
            const indent = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index > 0) {
                    const nodeToIndent = nodes[index];
                    const prevSibling = nodes[index - 1];
                    const newPrevSibling = {
                        ...prevSibling,
                        children: [...prevSibling.children, nodeToIndent],
                        isCollapsed: false 
                    };
                    const newNodes = [...nodes];
                    newNodes.splice(index - 1, 2, newPrevSibling);
                    return newNodes;
                }
                return nodes.map(node => {
                    if(node.children.length > 0) {
                        const newChildren = indent(node.children);
                        if(newChildren !== node.children) return { ...node, children: newChildren };
                    }
                    return node;
                });
            };
            return indent(prev);
        });
    }, []);

    const handleOutdent = useCallback((id: string) => {
         setBullets(prev => {
            let nodeToOutdent: Bullet | null = null;
            
            // Remove node from its current position
            const removeNode = (nodes: Bullet[]): Bullet[] => {
                const idx = nodes.findIndex(n => n.id === id);
                if (idx !== -1) {
                    nodeToOutdent = nodes[idx];
                    return nodes.filter((_, i) => i !== idx);
                }
                return nodes.map(n => ({ ...n, children: removeNode(n.children) }));
            };
            
            // We need a 2-pass or complex recursive approach to insert it into parent's parent.
            // Simplified: find parent, if parent exists, move node to after parent.
            
            const outdentNode = (nodes: Bullet[]): { nodes: Bullet[], success: boolean } => {
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    // Check if child contains the target
                    if (node.children.some(c => c.id === id)) {
                        const childIdx = node.children.findIndex(c => c.id === id);
                        const child = node.children[childIdx];
                        const newChildren = [...node.children];
                        newChildren.splice(childIdx, 1);
                        
                        // Insert after current node `nodes[i]`
                        const newNodes = [...nodes];
                        const newNode = { ...node, children: newChildren };
                        newNodes[i] = newNode;
                        newNodes.splice(i + 1, 0, child);
                        
                        return { nodes: newNodes, success: true };
                    }
                    
                    const res = outdentNode(node.children);
                    if (res.success) {
                        const newNodes = [...nodes];
                        newNodes[i] = { ...node, children: res.nodes };
                        return { nodes: newNodes, success: true };
                    }
                }
                return { nodes, success: false };
            };
            
            const result = outdentNode(prev);
            return result.success ? result.nodes : prev;
        });
    }, []);
    
    const handleMoveBullet = useCallback((id: string, direction: 'up' | 'down') => {
        setBullets(prev => {
             const move = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index !== -1) {
                    if (direction === 'up' && index > 0) {
                        const newNodes = [...nodes];
                        [newNodes[index], newNodes[index - 1]] = [newNodes[index - 1], newNodes[index]];
                        return newNodes;
                    }
                    if (direction === 'down' && index < nodes.length - 1) {
                        const newNodes = [...nodes];
                        [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
                        return newNodes;
                    }
                    return nodes;
                }
                return nodes.map(n => {
                     const newChildren = move(n.children);
                     if (newChildren !== n.children) return { ...n, children: newChildren };
                     return n;
                });
             };
             return move(prev);
        });
    }, []);
    
    const handleMerge = useCallback((id: string) => {
         setBullets(prev => {
            let mergedText = '';
            let prevId: string | null = null;
            
            const merge = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index > 0) {
                    const current = nodes[index];
                    const previous = nodes[index - 1];
                    mergedText = previous.text + current.text;
                    prevId = previous.id;
                    const cursorPosition = previous.text.length;
                    
                    const newPrevious = {
                        ...previous,
                        text: mergedText,
                        children: [...previous.children, ...current.children],
                        updatedAt: Date.now()
                    };
                    
                    // Focus management
                    setTimeout(() => handleFocusChange(previous.id, cursorPosition), 0);

                    const newNodes = [...nodes];
                    newNodes.splice(index - 1, 2, newPrevious);
                    return newNodes;
                } else if (index === 0) {
                     // Can't merge with nothing above in same level
                     return nodes;
                }
                
                return nodes.map(n => {
                     const newChildren = merge(n.children);
                     if (newChildren !== n.children) return { ...n, children: newChildren };
                     return n;
                });
            };
            return merge(prev);
         });
    }, [handleFocusChange]);

    const handleFocusParent = useCallback((id: string) => {
        const found = findBulletAndParent(id, bullets);
        if (found && found.parent) {
            handleFocusChange(found.parent.id);
        }
    }, [bullets, findBulletAndParent, handleFocusChange]);

    const handleFocusChild = useCallback((id: string) => {
        const found = findBulletAndParent(id, bullets);
        if (found && found.node.children.length > 0) {
            handleFocusChange(found.node.children[0].id, 'start');
        }
    }, [bullets, findBulletAndParent, handleFocusChange]);

    const handleFoldAll = useCallback((id: string, collapse: boolean) => {
         setBullets(prev => {
             const toggle = (nodes: Bullet[]): Bullet[] => {
                 return nodes.map(n => {
                     if (n.id === id) {
                         return { ...n, isCollapsed: collapse };
                     }
                     if (n.children.length > 0) {
                         return { ...n, children: toggle(n.children) };
                     }
                     return n;
                 });
             };
             return toggle(prev);
         });
    }, []);

    const getFlatVisibleBullets = useCallback(() => {
        const visible: string[] = [];
        const traverse = (nodes: Bullet[]) => {
            for (const node of nodes) {
                visible.push(node.id);
                if (!node.isCollapsed && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };
        traverse(displayedBullets);
        return visible;
    }, [displayedBullets]);

    const handleFocusMove = useCallback((direction: 'up' | 'down', position: 'start' | 'end' = 'end') => {
        if (!currentFocusId) return;
        const visibleIds = getFlatVisibleBullets();
        const idx = visibleIds.indexOf(currentFocusId);
        if (idx === -1) return;
        
        let nextIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < visibleIds.length) {
            handleFocusChange(visibleIds[nextIdx], position);
        }
    }, [currentFocusId, getFlatVisibleBullets, handleFocusChange]);

    // --- Popup Logic ---
    const handleTriggerLinkPopup = (bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedBullet: any) => void) => {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
             // Basic suggestion search
             const flat = [];
             const traverse = (nodes: Bullet[]) => {
                 for(const n of nodes) {
                     if(n.text.toLowerCase().includes(query.toLowerCase())) {
                         flat.push({ id: n.id, text: n.text, path: [] }); // simplified path
                     }
                     traverse(n.children);
                 }
             };
             traverse(bullets);
             
             setLinkPopupState({
                 isOpen: true,
                 targetId: bulletId,
                 query,
                 position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX },
                 suggestions: flat.slice(0, 10),
                 selectedIndex: 0
             });
             setLinkSelectionHandler({ handler: selectionHandler });
        }
    };

    const handleCloseLinkPopup = useCallback(() => {
        setLinkPopupState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleLinkNavigate = (direction: 'up' | 'down') => {
        setLinkPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions(prev, direction)
        }));
    };

    const handleLinkSelect = () => {
        if (linkPopupState.suggestions.length > 0 && linkSelectionHandler.handler) {
            linkSelectionHandler.handler(linkPopupState.suggestions[linkPopupState.selectedIndex]);
            handleCloseLinkPopup();
        }
    };
    
    const handleTriggerTagPopup = (bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (tag: string) => void) => {
        const rect = inputRef.current?.getBoundingClientRect();
         if (rect) {
             // Collect all tags
             const tags = new Set<string>();
             const traverse = (nodes: Bullet[]) => {
                 for(const n of nodes) {
                     const matches = n.text.match(/#\w+/g);
                     if(matches) matches.forEach(t => tags.add(t));
                     traverse(n.children);
                 }
             };
             traverse(bullets);
             const suggestions = Array.from(tags).filter(t => t.toLowerCase().includes('#' + query.toLowerCase()));

             setTagPopupState({
                 isOpen: true,
                 targetId: bulletId,
                 query,
                 position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX },
                 suggestions: suggestions.slice(0, 10),
                 selectedIndex: 0
             });
             setTagSelectionHandler({ handler: selectionHandler });
         }
    };

    const handleCloseTagPopup = useCallback(() => {
        setTagPopupState(prev => ({ ...prev, isOpen: false }));
    }, []);
    
    const handleTagNavigate = (direction: 'up' | 'down') => {
        setTagPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions(prev, direction)
        }));
    };

    const handleTagSelect = () => {
        if (tagPopupState.suggestions.length > 0 && tagSelectionHandler.handler) {
            tagSelectionHandler.handler(tagPopupState.suggestions[tagPopupState.selectedIndex]);
            handleCloseTagPopup();
        }
    };

    const onLinkClick = useCallback((linkText: string) => {
         // Try to find bullet with that text
         const find = (nodes: Bullet[]): Bullet | null => {
             for(const n of nodes) {
                 if(n.text === linkText) return n;
                 const f = find(n.children);
                 if(f) return f;
             }
             return null;
         };
         const target = find(bullets);
         if(target) handleNavigate(target.id);
         else {
             setIsSearchModalOpen(true);
             setSearchQuery(linkText);
         }
    }, [bullets, handleNavigate]);


    // --- Import/Export ---
    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bullets, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (settings.fileName || "outline") + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const onImport = (data: any) => {
        setPendingImportData(data);
        setIsImportModalOpen(true);
    };
    
    const handleConfirmImport = (targetId: string | null) => {
        if (!pendingImportData) return;
        
        const imported = regenerateIds(migrateBullets(pendingImportData));
        
        setBullets(prev => {
            if (targetId === null) {
                return [...prev, ...imported];
            }
            
            const addToTarget = (nodes: Bullet[]): Bullet[] => {
                return nodes.map(n => {
                    if (n.id === targetId) {
                        return {
                             ...n,
                             children: [...n.children, ...imported],
                             isCollapsed: false
                        };
                    }
                    return { ...n, children: addToTarget(n.children) };
                });
            };
            return addToTarget(prev);
        });
        
        setIsImportModalOpen(false);
        setPendingImportData(null);
        addToast('Import successful', 'success');
    };


    return (
      <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans overflow-hidden transition-colors duration-200">
        <LeftSidebar 
            isOpen={isSidebarOpen} 
            recents={recentBullets} 
            favorites={favoriteBullets}
            onNavigate={handleNavigate}
        />
        <div className="flex-grow flex flex-col h-full overflow-hidden relative">
            <Toolbar
                onImport={onImport}
                onExport={handleExport}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={handleZoom}
                fileName={settings.fileName}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onGoToToday={handleGoToJournal}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onOpenSearch={() => setIsSearchModalOpen(true)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => {
                    const newState = !isSidebarOpen;
                    setIsSidebarOpen(newState);
                    db.keyValuePairs.put({ key: 'isSidebarOpen', value: newState });
                }}
                isFavorite={isTargetFavorite}
                onToggleFavorite={handleToggleFavorite}
                canFavorite={!!(zoomedBulletId || currentFocusId)}
            />
            
            <div className="flex-grow overflow-y-auto p-4" onClick={() => {
                 // Click on empty space focuses last item or root
                 if (displayedBullets.length > 0 && !currentFocusId) {
                     // handleFocusChange(displayedBullets[displayedBullets.length-1].id);
                 }
            }}>
                {displayedBullets.map(bullet => (
                    <BulletItem
                        key={bullet.id}
                        bullet={bullet}
                        level={0}
                        onUpdate={handleUpdate}
                        onAddSibling={handleAddSibling}
                        onDelete={handleDelete}
                        onIndent={handleIndent}
                        onOutdent={handleOutdent}
                        onFocusChange={handleFocusChange}
                        onZoom={handleZoom}
                        onFocusMove={handleFocusMove}
                        onFocusParent={handleFocusParent}
                        onFocusChild={handleFocusChild}
                        onFoldAll={handleFoldAll}
                        onMoveBullet={handleMoveBullet}
                        currentFocusId={currentFocusId}
                        focusPosition={focusPosition}
                        searchQuery={searchQuery}
                        onLinkClick={onLinkClick}
                        onTriggerLinkPopup={handleTriggerLinkPopup}
                        onCloseLinkPopup={handleCloseLinkPopup}
                        onLinkNavigate={handleLinkNavigate}
                        onLinkSelect={handleLinkSelect}
                        isLinkPopupOpen={linkPopupState.isOpen}
                        linkPopupTargetId={linkPopupState.targetId}
                        onTriggerTagPopup={handleTriggerTagPopup}
                        onCloseTagPopup={handleCloseTagPopup}
                        onTagNavigate={handleTagNavigate}
                        onTagSelect={handleTagSelect}
                        isTagPopupOpen={tagPopupState.isOpen}
                        tagPopupTargetId={tagPopupState.targetId}
                        isJournalRoot={bullet.text === DAILY_LOG_ROOT_TEXT}
                        onNavigateTo={handleNavigate}
                        onMerge={handleMerge}
                    />
                ))}
                
                <div 
                    className="h-32 cursor-text opacity-0" 
                    onClick={(e) => {
                         e.stopPropagation();
                         // Add to end logic could go here
                         if (displayedBullets.length === 0) {
                             const newB = createNewBullet();
                             setBullets(prev => {
                                 if (zoomedBulletId) {
                                     // Add to zoomed parent
                                     const add = (nodes: Bullet[]): Bullet[] => {
                                         return nodes.map(n => {
                                             if(n.id === zoomedBulletId) return { ...n, children: [...n.children, newB] };
                                             return { ...n, children: add(n.children) };
                                         });
                                     };
                                     return add(prev);
                                 }
                                 return [...prev, newB];
                             });
                             setTimeout(() => handleFocusChange(newB.id), 0);
                         } else {
                             // Append to current list
                             const last = displayedBullets[displayedBullets.length - 1];
                             handleAddSibling(last.id, '');
                         }
                    }} 
                />
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
            
            <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                onSave={setSettings}
                currentSettings={settings}
                onClearData={async () => {
                    if (confirm("Are you sure you want to delete all data? This cannot be undone.")) {
                        await db.delete();
                        window.location.reload();
                    }
                }}
            />
            
            <SearchModal 
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                bullets={bullets}
                onNavigate={handleNavigate}
            />
            
            <ImportSelectionModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onConfirm={handleConfirmImport}
                bullets={bullets}
            />

            {linkPopupState.isOpen && (
                <LinkPopup 
                    suggestions={linkPopupState.suggestions}
                    selectedIndex={linkPopupState.selectedIndex}
                    onSelect={(item) => {
                         if (linkSelectionHandler.handler) {
                             linkSelectionHandler.handler(item);
                             handleCloseLinkPopup();
                         }
                    }}
                    position={linkPopupState.position}
                    containerRef={linkPopupRef}
                />
            )}
            
            {tagPopupState.isOpen && (
                <TagPopup 
                    suggestions={tagPopupState.suggestions}
                    selectedIndex={tagPopupState.selectedIndex}
                    onSelect={(tag) => {
                        if (tagSelectionHandler.handler) {
                            tagSelectionHandler.handler(tag);
                            handleCloseTagPopup();
                        }
                    }}
                    position={tagPopupState.position}
                    containerRef={tagPopupRef}
                />
            )}
            
            <footer className="flex-shrink-0 p-1 px-4 text-sm text-[var(--main-color)] border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex justify-between items-center z-10">
                <div className="flex items-center gap-2 min-w-0">
                    <span title={settings.fileName} className="truncate">{settings.fileName}</span>
                </div>
                <a 
                    href="https://github.com/jaroet/JaRoet-Outliner/releases" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex-shrink-0 ml-2 hover:underline"
                    title="View Release Notes"
                >
                    Version 0.1.21
                </a>
            </footer>
        </div>
      </div>
    );
};