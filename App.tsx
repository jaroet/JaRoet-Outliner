
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
    const focusBeforeModalRef = useRef<string | null>(null);
    
    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

        setBullets(prevBullets => {
             const newBullets = structuredClone(prevBullets);
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
            return newBullets;
        });
        
        // Ensure correct navigation
        const ensureJournalPath = (currentNodes: Bullet[]): { nodes: Bullet[], monthId: string, dayId: string } => {
             const newBullets = structuredClone(currentNodes);
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
             return { nodes: newBullets, monthId: monthNode.id, dayId: dayNode.id };
        };

        setBullets(prev => {
            const result = ensureJournalPath(prev);
            setTimeout(() => {
                setZoomedBulletId(result.monthId);
                setTimeout(() => handleFocusChange(result.dayId), 0);
            }, 0);
            return result.nodes;
        });
        addToast('Opened Daily Log', 'success');

    }, [handleFocusChange, addToast]);

    const handleUpdate = useCallback((id: string, updates: Partial<Bullet>) => {
        setBullets(prevBullets => {
            const found = findBulletAndParent(id, prevBullets);
            if (found?.node.isReadOnly) return prevBullets;

            const isStructuralOrContentChange = Object.keys(updates).some(key => key !== 'isCollapsed');
            const newUpdatedAt = isStructuralOrContentChange ? Date.now() : undefined;

            // Update recent list if content changed
            if (updates.text !== undefined) {
                updateRecentList(id, updates.text, newUpdatedAt || Date.now());
                // Update favorite text if it exists
                setFavoriteBullets(prev => prev.map(f => f.id === id ? { ...f, text: updates.text! } : f));
            } else if (isStructuralOrContentChange) {
                // Structural change without text update (unlikely for pure updates, but safe to handle)
                updateRecentList(id, undefined, newUpdatedAt || Date.now());
            }

            return mapBullets(prevBullets, bullet =>
                bullet.id === id ? { 
                    ...bullet, 
                    ...updates, 
                    updatedAt: newUpdatedAt || bullet.updatedAt 
                } : bullet
            );
        });
    }, [findBulletAndParent, updateRecentList]);
    
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                handleOpenSearch();
            }
            else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                handleZoom(null);
                setBullets(prev => prev.map(b => ({ ...b, isCollapsed: true })));
                setTimeout(() => {
                    const currentBullets = bulletsRef.current;
                    if (currentBullets.length > 0) {
                        handleFocusChange(currentBullets[0].id, 'start');
                    }
                }, 10);
            }
            else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                handleGoToJournal();
            }
            else if (e.ctrlKey && e.key === 'ArrowUp') {
                e.preventDefault();
                const zoomedId = zoomedBulletIdRef.current;
                const crumbs = breadcrumbsRef.current;
                if (zoomedId) {
                    const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
                    handleZoom(parentId);
                }
            }
            else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                 const currentFocusId = focusOptionsRef.current.id;
                 const visibleIds = visibleBulletIdsRef.current;
                 
                 if (!currentFocusId && visibleIds.length > 0) {
                    const target = e.target as HTMLElement;
                    if(target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        handleFocusChange(visibleIds[0]);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [handleGoToJournal, handleZoom, handleFocusChange]);

    const handleAddSibling = useCallback((id: string, text = '') => {
        const newBullet = createNewBullet(text);
        setBullets(prevBullets => {
             const newBullets = structuredClone(prevBullets);
             const found = findBulletAndParent(id, newBullets);
             if (found) {
                if (found.node.isReadOnly) return prevBullets;
                found.siblings.splice(found.index + 1, 0, newBullet);
                if (found.parent) {
                    found.parent.updatedAt = Date.now();
                }
                return newBullets;
             }
             return prevBullets;
        });
        // Side effect: focus new bullet
        setTimeout(() => handleFocusChange(newBullet.id), 0);
        updateRecentList(newBullet.id, newBullet.text, newBullet.updatedAt || Date.now());
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);

    const handleDelete = useCallback((id: string) => {
        let prevSiblingId: string | null = null;
        setBullets(prevBullets => {
             const foundTarget = findBulletAndParent(id, prevBullets);
             if (foundTarget?.node.isReadOnly) return prevBullets;

             const newBullets = structuredClone(prevBullets);
             const found = findBulletAndParent(id, newBullets);
             if (found) {
                prevSiblingId = found.index > 0 ? found.siblings[found.index - 1].id : found.parent?.id || null;
                if (found.parent) {
                    found.parent.updatedAt = Date.now();
                }
                found.siblings.splice(found.index, 1);
                return newBullets;
             }
             return prevBullets;
        });
        removeFromRecentList(id);
        setTimeout(() => handleFocusChange(prevSiblingId), 0);
    }, [handleFocusChange, findBulletAndParent, removeFromRecentList]);

    const handleMerge = useCallback((id: string) => {
        setBullets(prevBullets => {
            const foundTarget = findBulletAndParent(id, prevBullets);
            // Guard clause: if not found or readonly
            if (!foundTarget || foundTarget.node.isReadOnly) return prevBullets;

            if (foundTarget.index > 0) {
                const newBullets = structuredClone(prevBullets);
                const found = findBulletAndParent(id, newBullets)!;
                const prevSibling = found.siblings[found.index - 1];
                
                if (prevSibling.isReadOnly) return prevBullets;

                // Calculate cursor position before appending text
                const cursorPosition = prevSibling.text.length;
                
                // Merge text
                prevSibling.text += found.node.text;
                
                // Merge children
                prevSibling.children = [...prevSibling.children, ...found.node.children];
                
                // Update timestamp
                prevSibling.updatedAt = Date.now();
                
                // Ensure expanded if it acquired children
                if (found.node.children.length > 0) {
                    prevSibling.isCollapsed = false;
                }
                
                // Remove the merged node
                found.siblings.splice(found.index, 1);
                if (found.parent) found.parent.updatedAt = Date.now();

                // Update Recent list
                // Remove merged node
                removeFromRecentList(found.node.id);
                // Update prev sibling
                updateRecentList(prevSibling.id, prevSibling.text, prevSibling.updatedAt || Date.now());
                // Update Favorite list if necessary
                setFavoriteBullets(prev => prev.map(f => f.id === prevSibling.id ? { ...f, text: prevSibling.text } : f));


                // Set focus to previous sibling at the merge point
                setTimeout(() => handleFocusChange(prevSibling.id, cursorPosition), 0);
                return newBullets;
            } else {
                // Index 0 handling (No previous sibling)
                // If empty, we delete it (standard "delete empty bullet" behavior)
                if (foundTarget.node.text === '') {
                        const newBullets = structuredClone(prevBullets);
                        const found = findBulletAndParent(id, newBullets)!;
                        const parentId = found.parent?.id || null;
                        
                        found.siblings.splice(found.index, 1);
                        if (found.parent) found.parent.updatedAt = Date.now();
                        
                        removeFromRecentList(found.node.id);

                        setTimeout(() => handleFocusChange(parentId, 'end'), 0);
                        return newBullets;
                }
            }
            
            return prevBullets;
        });
    }, [findBulletAndParent, handleFocusChange, removeFromRecentList, updateRecentList]);

    const handleIndent = useCallback((id: string) => {
        setBullets(prevBullets => {
            const foundTarget = findBulletAndParent(id, prevBullets);
            if (foundTarget?.node.isReadOnly) return prevBullets;

            const newBullets = structuredClone(prevBullets);
            const found = findBulletAndParent(id, newBullets);
            if (found && found.index > 0) {
                const prevSibling = found.siblings[found.index - 1];
                 if (prevSibling.isReadOnly) return prevBullets;
                const [movedNode] = found.siblings.splice(found.index, 1);
                movedNode.updatedAt = Date.now();
                prevSibling.children.push(movedNode);
                prevSibling.isCollapsed = false;
                return newBullets;
            }
            return prevBullets;
        });
        // Structure change, update timestamp
        updateRecentList(id, undefined, Date.now());
        setTimeout(() => handleFocusChange(id), 0);
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);
    
    const handleOutdent = useCallback((id: string) => {
        setBullets(prevBullets => {
            const foundTarget = findBulletAndParent(id, prevBullets);
            if (foundTarget?.node.isReadOnly) return prevBullets;

            const newBullets = structuredClone(prevBullets);
            const found = findBulletAndParent(id, newBullets);
            if (found && found.parent) {
                const parentInfo = findBulletAndParent(found.parent.id, newBullets);
                if(parentInfo && !parentInfo.node.isReadOnly){
                    const [movedNode] = found.siblings.splice(found.index, 1);
                    movedNode.updatedAt = Date.now();
                    const subsequentSiblings = found.siblings.splice(found.index);
                    movedNode.children.push(...subsequentSiblings);

                    parentInfo.siblings.splice(parentInfo.index + 1, 0, movedNode);
                    return newBullets;
                }
            }
            return prevBullets;
        });
        // Structure change, update timestamp
        updateRecentList(id, undefined, Date.now());
        setTimeout(() => handleFocusChange(id), 0);
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);

    const handleFoldAll = useCallback((id: string, collapse: boolean) => {
        const setCollapseRecursively = (nodes: Bullet[]): Bullet[] => {
            return nodes.map(node => {
                const newNode = { ...node };
                if (newNode.children.length > 0) {
                    newNode.isCollapsed = collapse;
                    if (!newNode.isReadOnly) {
                        newNode.children = setCollapseRecursively(newNode.children);
                    }
                }
                return newNode;
            });
        };
    
        const findAndFold = (nodes: Bullet[]): Bullet[] => {
            return nodes.map(node => {
                if (node.id === id) {
                    const updatedNode = { ...node };
                    if(updatedNode.children.length > 0) {
                        updatedNode.isCollapsed = collapse;
                        updatedNode.children = setCollapseRecursively(updatedNode.children);
                    }
                    return updatedNode;
                }
                if (node.children.length > 0) {
                    return { ...node, children: findAndFold(node.children) };
                }
                return node;
            });
        };
    
        setBullets(prevBullets => findAndFold(prevBullets));
    }, []);

    const handleMoveBullet = useCallback((id: string, direction: 'up' | 'down') => {
        setBullets(prevBullets => {
            const foundTarget = findBulletAndParent(id, prevBullets);
            if (foundTarget?.node.isReadOnly) return prevBullets;

            const newBullets = structuredClone(prevBullets);
            const found = findBulletAndParent(id, newBullets);
        
            if (!found) return prevBullets;
        
            const { siblings, index } = found;
            found.node.updatedAt = Date.now();
        
            if (direction === 'up') {
                if (index > 0) {
                    [siblings[index], siblings[index - 1]] = [siblings[index - 1], siblings[index]];
                    return newBullets;
                }
            } else { // 'down'
                if (index < siblings.length - 1) {
                    [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
                    return newBullets;
                }
            }
            return prevBullets;
        });
        // Structure change, update timestamp
        updateRecentList(id, undefined, Date.now());
    }, [findBulletAndParent, updateRecentList]);

    const handleFocusParent = useCallback((id: string) => {
        const zoomedId = zoomedBulletIdRef.current;
        const currentBullets = bulletsRef.current;
        
        // Helper to find in current view scope
        const findInScope = (nodes: Bullet[], targetId: string): Bullet | null => {
            for (const node of nodes) {
                if (node.id === targetId) return node;
                const f = findInScope(node.children, targetId);
                if (f) return f;
            }
            return null;
        }
        
        let scope = currentBullets;
        if (zoomedId) {
            const zoomedNode = findInScope(currentBullets, zoomedId);
            if (zoomedNode) scope = zoomedNode.children;
            else scope = [];
        }

        const findParent = (
            bulletId: string,
            nodes: Bullet[],
            parent: Bullet | null = null
          ): { node: Bullet, parent: Bullet | null } | null => {
            for (const node of nodes) {
              if (node.id === bulletId) {
                return { node, parent };
              }
              const found = findParent(bulletId, node.children, node);
              if (found) return found;
            }
            return null;
        };
        
        const found = findParent(id, scope);
        if (found?.parent) {
            handleFocusChange(found.parent.id);
        }
    }, [handleFocusChange]);

    const handleFocusChild = useCallback((id: string) => {
        const currentBullets = bulletsRef.current;
        const find = (nodes: Bullet[]): Bullet | null => {
             for(const node of nodes) {
                 if (node.id === id) return node;
                 const f = find(node.children);
                 if(f) return f;
             }
             return null;
        };
        const foundNode = find(currentBullets);
        
        if (foundNode && foundNode.children.length > 0 && !foundNode.isCollapsed) {
            handleFocusChange(foundNode.children[0].id, 'start');
        }
    }, [handleFocusChange]);


    const handleExport = () => {
        const dataStr = JSON.stringify(bullets, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        
        const sanitizedFileName = settings.fileName.replace(/[<>:"/\\|?*]/g, '_');
        const exportFileDefaultName = `${sanitizedFileName}_bck_${timestamp}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        addToast('Export started', 'success');
    };

    const handleImport = (data: Bullet[]) => {
        // Instead of overriding immediately, we open the selection modal
        setPendingImportData(data);
        setIsImportModalOpen(true);
    };

    const handleConfirmImport = (targetId: string | null) => {
        if (!pendingImportData) return;
        
        // Ensure imported data matches current schema and has fresh IDs to avoid collisions
        let nodesToImport = migrateBullets(pendingImportData);
        nodesToImport = regenerateIds(nodesToImport);

        // Collect imported items to add to recent list
        const importedItems: {id: string, text: string, updatedAt: number}[] = [];
        const traverse = (nodes: Bullet[]) => {
             for(const n of nodes) {
                 importedItems.push({id: n.id, text: n.text, updatedAt: n.updatedAt || Date.now()});
                 traverse(n.children);
             }
        };
        traverse(nodesToImport);
        
        setRecentBullets(prev => {
            const combined = [...importedItems, ...prev];
            combined.sort((a,b) => b.updatedAt - a.updatedAt);
            return combined.slice(0, 12);
        });


        if (targetId === null) {
            // Add to root
            setBullets(prev => [...prev, ...nodesToImport]);
        } else {
            // Add to specific bullet
            const newBullets = structuredClone(bullets);
            const found = findBulletAndParent(targetId, newBullets);
            if (found && !found.node.isReadOnly) {
                found.node.children.push(...nodesToImport);
                found.node.isCollapsed = false;
                found.node.updatedAt = Date.now();
                setBullets(newBullets);
            }
        }
        
        // Cleanup
        setIsImportModalOpen(false);
        setPendingImportData(null);
        addToast('Items imported successfully', 'success');
    };
    
    const handleAddItemToCurrentView = useCallback(() => {
        const newBullet = createNewBullet();
        const zoomedId = zoomedBulletIdRef.current;
        
        if (zoomedId) {
            setBullets(prevBullets => {
                const newBullets = structuredClone(prevBullets);
                const found = findBulletAndParent(zoomedId, newBullets);
                if (found && !found.node.isReadOnly) {
                    found.node.children.push(newBullet);
                    found.node.isCollapsed = false;
                    found.node.updatedAt = Date.now();
                    return newBullets;
                }
                return prevBullets;
            });
        } else {
            setBullets(prev => [...prev, newBullet]);
        }
        setTimeout(() => handleFocusChange(newBullet.id), 0);
        updateRecentList(newBullet.id, newBullet.text, newBullet.updatedAt || Date.now());
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);

    const handleFocusMove = useCallback((direction: 'up' | 'down', position: 'start' | 'end' | number = 'end') => {
        const currentFocusId = focusOptionsRef.current.id;
        const visibleIds = visibleBulletIdsRef.current;

        if (!currentFocusId) {
            if (visibleIds.length > 0) {
                 handleFocusChange(visibleIds[0], position);
            }
            return;
        }
        const currentIndex = visibleIds.indexOf(currentFocusId);
        if (currentIndex === -1) return;
        let nextIndex;
        if (direction === 'down') {
            nextIndex = currentIndex + 1;
            if (nextIndex < visibleIds.length) {
                handleFocusChange(visibleIds[nextIndex], position);
            }
        } else { // 'up'
            nextIndex = currentIndex - 1;
            if (nextIndex >= 0) {
                handleFocusChange(visibleIds[nextIndex], position);
            }
        }
    }, [handleFocusChange]);

    const handleOpenSearch = () => {
        focusBeforeModalRef.current = currentFocusId;
        setIsSearchModalOpen(true);
    };

    const handleCloseSearch = () => {
        setIsSearchModalOpen(false);
        if (focusBeforeModalRef.current) {
            const idToRestore = focusBeforeModalRef.current;
            handleFocusChange(idToRestore, 'start');
            setTimeout(() => {
                handleFocusChange(idToRestore, 'end');
            }, 0);
            focusBeforeModalRef.current = null;
        }
    };


    // --- Link & Tag Popup Logic ---
    const handleTriggerLinkPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedBullet: any) => void) => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setLinkSelectionHandler({ handler: selectionHandler });

        const POPUP_MAX_WIDTH_PX = 768; // Corresponds to Tailwind's max-w-2xl
        const VIEWPORT_PADDING_PX = 16;
        
        let left = rect.left + window.scrollX;
        
        if (left + POPUP_MAX_WIDTH_PX > window.innerWidth - VIEWPORT_PADDING_PX) {
            left = window.innerWidth - POPUP_MAX_WIDTH_PX - VIEWPORT_PADDING_PX;
        }

        left = Math.max(VIEWPORT_PADDING_PX, left);

        // Calculate flat list only when needed for popup suggestions
        const currentBullets = bulletsRef.current;
        const results: any[] = [];
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
        traverse(currentBullets, []);
        
        const suggestions = !query 
            ? results.slice(0, 50) 
            : results.map(bullet => {
                const lowerText = bullet.text.toLowerCase();
                const lowerQuery = query.toLowerCase();
                let score = 0;
                if (lowerText.startsWith(lowerQuery)) {
                    score = 2;
                } else if (lowerText.includes(lowerQuery)) {
                    score = 1;
                }
                return { ...bullet, score };
            })
            .filter(bullet => bullet.score > 0 && bullet.id !== bulletId) 
            .sort((a, b) => b.score - a.score);

        setLinkPopupState({
            isOpen: true,
            targetId: bulletId,
            query: query,
            position: { top: rect.bottom + window.scrollY, left: left },
            suggestions: suggestions.slice(0, 100), 
            selectedIndex: 0,
        });

    }, []);

    const handleCloseLinkPopup = useCallback(() => {
        setLinkPopupState(prev => {
            if (prev.isOpen) {
                return { ...prev, isOpen: false };
            }
            return prev;
        });
        setLinkSelectionHandler({ handler: null });
    }, []);

    const handleLinkNavigate = useCallback((direction: 'up' | 'down') => {
        if (!linkPopupState.isOpen) return; 
        setLinkPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions(prev, direction),
        }));
    }, [linkPopupState.isOpen]); 
    
    const handleLinkSelect = useCallback((callback: (selectedBullet: any) => void) => {
        setLinkPopupState(prev => {
             if (!prev.isOpen || prev.suggestions.length === 0) return prev;
             const selectedBullet = prev.suggestions[prev.selectedIndex];
             callback(selectedBullet);
             return prev;
        });
    }, []);

    const handleLinkClick = useCallback((linkText: string) => {
        const currentBullets = bulletsRef.current;
        let targetBullet: Bullet | null = null;
        const find = (nodes: Bullet[]): boolean => {
            for (const node of nodes) {
                if (node.text === linkText) {
                    targetBullet = node;
                    return true;
                }
                if (find(node.children)) return true;
            }
            return false;
        };
        find(currentBullets);
    
        if (targetBullet) {
            const path: Bullet[] = [];
            const findPath = (nodes: Bullet[], currentPath: Bullet[]): boolean => {
                for (const node of nodes) {
                    const newPath = [...currentPath, node];
                    if (node.id === (targetBullet as Bullet).id) {
                        path.push(...newPath);
                        return true;
                    }
                    if (findPath(node.children, newPath)) return true;
                }
                return false;
            };
            findPath(currentBullets, []);
            
            const parent = path.length > 1 ? path[path.length - 2] : null;
            setZoomedBulletId(parent ? parent.id : null);
            setTimeout(() => handleFocusChange((targetBullet as Bullet).id, 'end'), 0);
        } else {
            console.warn(`Link target not found: "${linkText}"`);
            addToast(`Link target "${linkText}" not found`, 'error');
        }
    }, [handleFocusChange, addToast]);

    const handleTriggerTagPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedTag: string) => void) => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setTagSelectionHandler({ handler: selectionHandler });

        const POPUP_MAX_WIDTH_PX = 768;
        const VIEWPORT_PADDING_PX = 16;
        let left = rect.left + window.scrollX;
        
        if (left + POPUP_MAX_WIDTH_PX > window.innerWidth - VIEWPORT_PADDING_PX) {
            left = window.innerWidth - POPUP_MAX_WIDTH_PX - VIEWPORT_PADDING_PX;
        }
        left = Math.max(VIEWPORT_PADDING_PX, left);
        
        const currentBullets = bulletsRef.current;
        const tagSet = new Set<string>();
        const tagRegex = /#\w+/g;
        
        const traverse = (nodes: Bullet[]) => {
            for(const node of nodes) {
                const matches = node.text.match(tagRegex);
                if(matches) matches.forEach(t => tagSet.add(t));
                traverse(node.children);
            }
        }
        traverse(currentBullets);
        const allTagsList = Array.from(tagSet).sort();

        const lowerCaseQuery = query.toLowerCase();
        const suggestions = allTagsList.filter(tag => tag.toLowerCase().includes(lowerCaseQuery));

        setTagPopupState({
            isOpen: true,
            targetId: bulletId,
            query: query,
            position: { top: rect.bottom + window.scrollY, left: left },
            suggestions: suggestions.slice(0, 100),
            selectedIndex: 0,
        });
    }, []);

    const handleCloseTagPopup = useCallback(() => {
        setTagPopupState(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
        setTagSelectionHandler({ handler: null });
    }, []);
    
    const handleTagNavigate = useCallback((direction: 'up' | 'down') => {
        if (!tagPopupState.isOpen) return;
        setTagPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions(prev, direction),
        }));
    }, [tagPopupState.isOpen]);

    const handleTagSelect = useCallback((callback: (selectedTag: string) => void) => {
        setTagPopupState(prev => {
            if (!prev.isOpen || prev.suggestions.length === 0) return prev;
            const selectedTag = prev.suggestions[prev.selectedIndex];
            callback(selectedTag);
            return prev;
        });
    }, []);

    const handleClearData = async () => {
        if (window.confirm("Are you sure you want to delete all data and reset the application? This action cannot be undone.")) {
            try {
                await db.keyValuePairs.delete('bullets');
                // Reset to initial data
                const resetData = migrateBullets(initialData);
                setBullets(resetData);
                setZoomedBulletId(null);
                setSearchQuery('');
                setIsSettingsModalOpen(false);
                setRecentBullets([]);
                setFavoriteBullets([]);
                addToast('All data has been reset', 'success');
            } catch (error) {
                console.error("Failed to clear data", error);
                addToast('Failed to clear data', 'error');
            }
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col">
            <Toolbar
                onImport={handleImport}
                onExport={handleExport}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={handleZoom}
                fileName={settings.fileName}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onGoToToday={handleGoToJournal}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onOpenSearch={handleOpenSearch}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => {
                    const newState = !isSidebarOpen;
                    setIsSidebarOpen(newState);
                    db.keyValuePairs.put({ key: 'isSidebarOpen', value: newState });
                }}
                isFavorite={isTargetFavorite}
                onToggleFavorite={handleToggleFavorite}
                canFavorite={targetFavoriteId !== null}
            />
            
            <div className="flex flex-grow overflow-hidden relative">
                <LeftSidebar 
                    isOpen={isSidebarOpen}
                    recents={recentBullets}
                    favorites={favoriteBullets}
                    onNavigate={handleNavigate}
                />

                <main className="flex-grow overflow-y-auto p-4 md:px-8 lg:px-16 xl:px-32 outline-none">
                    {displayedBullets.length > 0 ? displayedBullets.map(bullet => (
                        <div key={bullet.id}>
                            <BulletItem
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
                                onLinkClick={handleLinkClick}
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
                                isJournalRoot={bullet.text === DAILY_LOG_ROOT_TEXT && zoomedBulletId === null}
                                onNavigateTo={handleNavigate}
                                onMerge={handleMerge}
                            />
                        </div>
                    )) : (
                        <div className="flex justify-center items-center h-full text-gray-400 dark:text-gray-500">
                            <button onClick={handleAddItemToCurrentView} className="border border-dashed border-gray-300 dark:border-gray-600 px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            {zoomedBulletId ? 'Add an item here' : 'Start with a new item'}
                            </button>
                        </div>
                    )}
                </main>
            </div>
            
            {/* Popups are absolute/fixed, so they can sit here or inside main if positioned absolutely */}
             {linkPopupState.isOpen && (
                <LinkPopup
                    suggestions={linkPopupState.suggestions}
                    selectedIndex={linkPopupState.selectedIndex}
                    onSelect={(bullet) => {
                        if (linkSelectionHandler.handler) {
                            linkSelectionHandler.handler(bullet);
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
                        }
                    }}
                    position={tagPopupState.position}
                    containerRef={tagPopupRef}
                />
            )}

            <footer className="flex-shrink-0 p-1 px-4 text-xs text-[var(--main-color)] border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex justify-between items-center z-10">
                <div className="flex items-center gap-2 min-w-0">
                    <span title={settings.fileName} className="truncate">{settings.fileName}</span>
                </div>
                <span className="flex-shrink-0 ml-2">Version 0.1.19</span>
            </footer>
             <SearchModal
                isOpen={isSearchModalOpen}
                onClose={handleCloseSearch}
                bullets={bullets}
                onNavigate={handleNavigate}
            />
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onSave={setSettings}
                currentSettings={settings}
                onClearData={handleClearData}
            />
            <ImportSelectionModal
                isOpen={isImportModalOpen}
                onClose={() => {
                    setIsImportModalOpen(false);
                    setPendingImportData(null);
                }}
                onConfirm={handleConfirmImport}
                bullets={bullets}
            />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
};
