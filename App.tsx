import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Bullet, Settings, CoreBullet, FlatBullet } from './types.ts';
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
    const [focusOptions, setFocusOptions] = useState<{ id: string | null; position: 'start' | 'end' | number; mode: 'view' | 'edit' }>({ id: null, position: 'end', mode: 'view' });
    const isInitialFocusSet = useRef(false);
    const linkPopupRef = useRef(null);
    const tagPopupRef = useRef(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [linkSelectionHandler, setLinkSelectionHandler] = useState<{ handler: ((bullet: any) => void) | null }>({ handler: null });
    const [tagSelectionHandler, setTagSelectionHandler] = useState<{ handler: ((tag: string) => void) | null }>({ handler: null });
    const prevFocusId = useRef<string | null>(null);
    const dataLoadedRef = useRef(false);
    const prevCoreDataRef = useRef<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const focusBeforeModalRef = useRef<string | null>(null);
    
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
    const focusMode = focusOptions.mode;

    const handleFocusChange = useCallback((id: string | null, position: 'start' | 'end' | number = 'end', mode: 'view' | 'edit' = 'view') => {
        setFocusOptions({ id, position, mode });
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
        // 1. Unfold target bullet (if currently collapsed)
        setBullets(prev => mapBullets(prev, b => {
            if (b.id === bulletId) {
                return { ...b, isCollapsed: false };
            }
            return b;
        }));

        // 2. Calculate path to determine parent for zooming
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
        // Use current bullets (structure matches)
        findPath(bullets, []);
    
        if (path.length > 0) {
            const parent = path.length > 1 ? path[path.length - 2] : null;
            setZoomedBulletId(parent ? parent.id : null);
            setIsSearchModalOpen(false);
            setSearchQuery('');
            
            // 3. Set focus on the target bullet in view mode
            setTimeout(() => {
                handleFocusChange(bulletId, 'end', 'view'); 
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
            handleFocusChange(visibleBulletIds[0], 'end', 'view'); // Start in view mode
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
                setTimeout(() => handleFocusChange(oldZoomedBulletId, 'end', 'view'), 0);
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
                    handleFocusChange(rootVisibleIds[0], 'end', 'view');
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
                    return newBullets;
                }
                return prevBullets;
            });
            setZoomedBulletId(id);
            setTimeout(() => {
                handleFocusChange(newBullet.id, 'start', 'edit'); // Start editing new child
            }, 0);
            updateRecentList(newBullet.id, newBullet.text, newBullet.updatedAt || Date.now());
        } else if (bulletToZoom) {
            setZoomedBulletId(id);
            if (isZoomingOut && oldZoomedBulletId) {
                setTimeout(() => handleFocusChange(oldZoomedBulletId, 'end', 'view'), 0);
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
                    handleFocusChange(visibleChildrenIds[0], 'end', 'view');
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
             
             // 1. Journal Root
             let journalNode = newBullets.find((b) => b.text === DAILY_LOG_ROOT_TEXT);
             if (!journalNode) { journalNode = createNewBullet(DAILY_LOG_ROOT_TEXT); newBullets.unshift(journalNode); }
             journalNode.isCollapsed = false;

             // 2. Year
             let yearNode = journalNode.children.find((b) => b.text === year);
             if (!yearNode) { yearNode = createNewBullet(year); journalNode.children.push(yearNode); }
             yearNode.isCollapsed = false;

             // 3. Month
             let monthNode = yearNode.children.find((b) => b.text === month);
             if (!monthNode) { monthNode = createNewBullet(month); yearNode.children.push(monthNode); }
             monthNode.isCollapsed = false;

             // 4. Day
             let dayNode = monthNode.children.find((b) => b.text === dayText);
             if (!dayNode) { dayNode = createNewBullet(dayText); monthNode.children.push(dayNode); }
             dayNode.isCollapsed = false; // Unfold target

             // Schedule zoom/focus update after state change
             setTimeout(() => {
                 setZoomedBulletId(monthNode!.id);
                 setTimeout(() => handleFocusChange(dayNode!.id, 'end', 'view'), 0);
             }, 0);

             return newBullets;
        });
        
        addToast('Opened Daily Log', 'success');
        
    }, [handleFocusChange, addToast]);

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
                    setTimeout(() => handleFocusChange(newBullet.id, 'start', 'edit'), 0); 
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

    const handleMoveBullet = useCallback((id: string, direction: 'up' | 'down') => {
        setBullets(prev => {
            const move = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index !== -1) {
                    const newNodes = [...nodes];
                    if (direction === 'up' && index > 0) {
                        [newNodes[index], newNodes[index - 1]] = [newNodes[index - 1], newNodes[index]];
                    } else if (direction === 'down' && index < nodes.length - 1) {
                        [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
                    }
                    return newNodes;
                }
                return nodes.map(node => ({ ...node, children: move(node.children) }));
            };
            return move(prev);
        });
    }, []);

    const handleIndent = useCallback((id: string) => {
        setBullets(prev => {
            const indent = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index > 0) {
                    const prevSibling = nodes[index - 1];
                    const nodeToMove = nodes[index];
                    const newPrevSibling = {
                        ...prevSibling,
                        children: [...prevSibling.children, nodeToMove],
                        isCollapsed: false 
                    };
                    const newNodes = [...nodes];
                    newNodes.splice(index - 1, 2, newPrevSibling);
                    return newNodes;
                }
                return nodes.map(n => ({ ...n, children: indent(n.children) }));
            };
            return indent(prev);
        });
    }, []);

    const handleOutdent = useCallback((id: string) => {
        setBullets(prev => {
             const process = (nodes: Bullet[]): { nodes: Bullet[], pulled: Bullet | null } => {
                 for(let i = 0; i < nodes.length; i++) {
                     const node = nodes[i];
                     if (node.children.some(c => c.id === id)) {
                         const childIndex = node.children.findIndex(c => c.id === id);
                         const child = node.children[childIndex];
                         const newChildren = [...node.children];
                         newChildren.splice(childIndex, 1);
                         
                         const newParent = { ...node, children: newChildren };
                         const pulled = child;
                         
                         const newNodes = [...nodes];
                         newNodes[i] = newParent;
                         newNodes.splice(i + 1, 0, pulled);
                         return { nodes: newNodes, pulled: null }; 
                     }
                     
                     const result = process(node.children);
                     if (result.nodes !== node.children) {
                         const newNodes = [...nodes];
                         newNodes[i] = { ...node, children: result.nodes };
                         return { nodes: newNodes, pulled: null };
                     }
                 }
                 return { nodes, pulled: null };
             };
             
             return process(prev).nodes;
        });
    }, []);

    const handleMerge = useCallback((id: string) => {
        setBullets(prev => {
            const merge = (nodes: Bullet[]): Bullet[] => {
                const index = nodes.findIndex(n => n.id === id);
                if (index > 0) {
                    const prevSibling = nodes[index - 1];
                    const nodeToMerge = nodes[index];
                    const mergedText = prevSibling.text + nodeToMerge.text;
                    const newPrevSibling = {
                        ...prevSibling,
                        text: mergedText,
                        children: [...prevSibling.children, ...nodeToMerge.children]
                    };
                    
                    const newNodes = [...nodes];
                    newNodes.splice(index - 1, 2, newPrevSibling);
                    
                    setTimeout(() => {
                        handleFocusChange(prevSibling.id, prevSibling.text.length, 'edit');
                    }, 0);
                    
                    return newNodes;
                }
                return nodes.map(n => ({ ...n, children: merge(n.children) }));
            };
            return merge(prev);
        });
    }, [handleFocusChange]);

    const handleDelete = useCallback((id: string) => {
        const visibleIds = visibleBulletIdsRef.current;
        const currentIndex = visibleIds.indexOf(id);
        let nextFocusId = null;
        if (currentIndex > 0) {
            nextFocusId = visibleIds[currentIndex - 1];
        } else if (currentIndex < visibleIds.length - 1) {
            nextFocusId = visibleIds[currentIndex + 1];
        }
        
        setBullets(prev => {
             const deleteNode = (nodes: Bullet[]): Bullet[] => {
                return nodes.filter(n => n.id !== id).map(n => ({
                    ...n,
                    children: deleteNode(n.children)
                }));
             };
             return deleteNode(prev);
        });
        
        if (nextFocusId) {
            handleFocusChange(nextFocusId, 'end', 'edit');
        } else {
             handleFocusChange(null);
        }
        removeFromRecentList(id);
    }, [handleFocusChange, removeFromRecentList]);

    const handleFocusMove = useCallback((direction: 'up' | 'down', position?: 'start' | 'end', mode?: 'view' | 'edit') => {
        const visibleIds = visibleBulletIdsRef.current;
        if (!visibleIds.length) return;

        const currentId = focusOptionsRef.current.id;
        const currentIndex = currentId ? visibleIds.indexOf(currentId) : -1;
        
        let nextIndex;
        if (currentIndex === -1) {
            nextIndex = 0;
        } else if (direction === 'up') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
        } else {
            nextIndex = currentIndex < visibleIds.length - 1 ? currentIndex + 1 : currentIndex;
        }

        const nextId = visibleIds[nextIndex];
        if (nextId) {
            handleFocusChange(nextId, position, mode || focusOptionsRef.current.mode);
        }
    }, [handleFocusChange]);

    const handleFocusParent = useCallback((id: string) => {
        const findParent = (nodes: Bullet[], parentId: string | null): string | null => {
            for(const node of nodes) {
                if (node.id === id) return parentId;
                const found = findParent(node.children, node.id);
                if (found) return found;
            }
            return null;
        };
        const parentId = findParent(bullets, null);
        // If parent is not root (zoomed root or null), focus it
        if (parentId && parentId !== zoomedBulletId) {
            handleFocusChange(parentId, undefined, 'view');
        }
    }, [bullets, zoomedBulletId, handleFocusChange]);

    const handleFocusChild = useCallback((id: string) => {
        const findNode = (nodes: Bullet[]): Bullet | null => {
             for(const node of nodes) {
                 if(node.id === id) return node;
                 const found = findNode(node.children);
                 if(found) return found;
             }
             return null;
        };
        const node = findNode(bullets);
        if (node && node.children.length > 0) {
            handleFocusChange(node.children[0].id, undefined, 'view');
        }
    }, [bullets, handleFocusChange]);

    const handleFoldAll = useCallback((id: string, collapse: boolean, recursive: boolean = false) => {
        setBullets(prev => {
            const setCollapseRecursively = (nodes: Bullet[]): Bullet[] => {
                return nodes.map(node => {
                    const newNode = { ...node };
                    if (newNode.children.length > 0) {
                         newNode.children = setCollapseRecursively(newNode.children);
                         newNode.isCollapsed = collapse;
                    }
                    return newNode;
                });
            };

            const fold = (nodes: Bullet[]): Bullet[] => {
                return nodes.map(n => {
                    if (n.id === id) {
                         const updatedNode = { ...n, isCollapsed: collapse };
                         if (recursive && updatedNode.children.length > 0) {
                             updatedNode.children = setCollapseRecursively(updatedNode.children);
                         }
                         return updatedNode;
                    }
                    if (n.children.length > 0) {
                         const newChildren = fold(n.children);
                         if (newChildren !== n.children) {
                             return { ...n, children: newChildren };
                         }
                    }
                    return n;
                });
            };
            return fold(prev);
        });
    }, []);

    const handleTriggerLinkPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, handler: (selectedBullet: any) => void) => {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
            setLinkPopupState({
                isOpen: true,
                targetId: bulletId,
                query,
                position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX },
                suggestions: [],
                selectedIndex: 0
            });
            setLinkSelectionHandler({ handler });
        }
    }, []);

    const handleCloseLinkPopup = useCallback(() => {
        setLinkPopupState(prev => ({ ...prev, isOpen: false }));
        setLinkSelectionHandler({ handler: null });
    }, []);

    const handleTriggerTagPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, handler: (selectedTag: string) => void) => {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
             setTagPopupState({
                isOpen: true,
                targetId: bulletId,
                query,
                position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX },
                suggestions: [],
                selectedIndex: 0
            });
            setTagSelectionHandler({ handler });
        }
    }, []);
    
    const handleCloseTagPopup = useCallback(() => {
        setTagPopupState(prev => ({ ...prev, isOpen: false }));
        setTagSelectionHandler({ handler: null });
    }, []);
    
    // Derived state for popups
    const linkSuggestions = useMemo(() => {
        if (!linkPopupState.isOpen || !linkPopupState.query) return [];
        const flat: FlatBullet[] = [];
        const traverse = (nodes: Bullet[], path: string[]) => {
            for(const n of nodes) {
                flat.push({ id: n.id, text: n.text, path });
                traverse(n.children, [...path, n.text]);
            }
        };
        traverse(bullets, []);
        return flat.filter(b => b.text.toLowerCase().includes(linkPopupState.query.toLowerCase())).slice(0, 50);
    }, [bullets, linkPopupState.isOpen, linkPopupState.query]);
    
    const tagSuggestions = useMemo(() => {
        if (!tagPopupState.isOpen) return [];
        const tags = new Set<string>();
        const traverse = (nodes: Bullet[]) => {
            for(const n of nodes) {
                const matches = n.text.match(/#\w+/g);
                if (matches) matches.forEach(t => tags.add(t));
                traverse(n.children);
            }
        };
        traverse(bullets);
        return Array.from(tags).filter(t => t.toLowerCase().includes(tagPopupState.query.toLowerCase())).sort().slice(0, 50);
    }, [bullets, tagPopupState.isOpen, tagPopupState.query]);

    const handleLinkNavigate = useCallback((direction: 'up' | 'down') => {
        setLinkPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions({ suggestions: linkSuggestions, selectedIndex: prev.selectedIndex }, direction)
        }));
    }, [linkSuggestions]);

     const handleTagNavigate = useCallback((direction: 'up' | 'down') => {
        setTagPopupState(prev => ({
            ...prev,
            selectedIndex: navigateSuggestions({ suggestions: tagSuggestions, selectedIndex: prev.selectedIndex }, direction)
        }));
    }, [tagSuggestions]);

    const handleLinkSelect = useCallback((callback: (b: any) => void) => {
        if (linkSuggestions[linkPopupState.selectedIndex]) {
            callback(linkSuggestions[linkPopupState.selectedIndex]);
        }
    }, [linkSuggestions, linkPopupState.selectedIndex]);

    const handleTagSelect = useCallback((callback: (t: string) => void) => {
        if (tagSuggestions[tagPopupState.selectedIndex]) {
            callback(tagSuggestions[tagPopupState.selectedIndex]);
        }
    }, [tagSuggestions, tagPopupState.selectedIndex]);


    const handleExport = () => {
        const dataStr = JSON.stringify(bullets, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${settings.fileName || 'outline'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportFile = (data: any) => {
        setPendingImportData(regenerateIds(migrateBullets(data)));
        setIsImportModalOpen(true);
    };

    const handleConfirmImport = (targetId: string | null) => {
        if (pendingImportData) {
            setBullets(prev => {
                if (targetId === null) {
                    return [...prev, ...pendingImportData];
                }
                const addToTarget = (nodes: Bullet[]): Bullet[] => {
                    return nodes.map(n => {
                        if (n.id === targetId) {
                            return { ...n, children: [...n.children, ...pendingImportData] };
                        }
                        return { ...n, children: addToTarget(n.children) };
                    });
                };
                return addToTarget(prev);
            });
            addToast(`Imported ${pendingImportData.length} items`, 'success');
        }
        setIsImportModalOpen(false);
        setPendingImportData(null);
    };

    const handleClearData = () => {
        if (confirm("Are you sure you want to delete all data? This cannot be undone.")) {
            setBullets(initialData);
            setRecentBullets([]);
            setFavoriteBullets([]);
            addToast('Application data reset', 'info');
            setIsSettingsModalOpen(false);
        }
    };


    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                handleOpenSearch();
            } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                handleZoom(null);
                setBullets(prev => prev.map(b => ({ ...b, isCollapsed: true })));
                setTimeout(() => {
                    const currentBullets = bulletsRef.current;
                    if (currentBullets.length > 0) handleFocusChange(currentBullets[0].id, 'start', 'view');
                }, 10);
            } else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                handleGoToJournal();
            } else if (e.ctrlKey && e.key === 'ArrowUp') {
                 // Global Zoom Out
                 e.preventDefault();
                 const zoomedId = zoomedBulletIdRef.current;
                 const crumbs = breadcrumbsRef.current;
                 if (zoomedId) {
                     const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
                     handleZoom(parentId);
                 }
            } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                // Focus Restoration fallback
                const currentFocusId = focusOptionsRef.current.id;
                const visibleIds = visibleBulletIdsRef.current;
                if (!currentFocusId && visibleIds.length > 0) {
                     const target = e.target as HTMLElement;
                     if(target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                         e.preventDefault();
                         handleFocusChange(visibleIds[0], 'end', 'view');
                     }
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => { window.removeEventListener('keydown', handleGlobalKeyDown); };
    }, [handleGoToJournal, handleZoom, handleFocusChange]);

    const handleOpenSearch = () => {
        focusBeforeModalRef.current = currentFocusId;
        setIsSearchModalOpen(true);
    };

    const handleCloseSearch = () => {
        setIsSearchModalOpen(false);
        // Restore focus if needed
        if (focusBeforeModalRef.current) {
            const idToRestore = focusBeforeModalRef.current;
            handleFocusChange(idToRestore, 'start', 'view');
             // small delay to ensure it catches if mode switching is involved
            setTimeout(() => handleFocusChange(idToRestore, 'end', 'view'), 0);
            focusBeforeModalRef.current = null;
        }
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
        setTimeout(() => handleFocusChange(newBullet.id, 'start', 'edit'), 0);
        updateRecentList(newBullet.id, newBullet.text, newBullet.updatedAt || Date.now());
    }, [handleFocusChange, findBulletAndParent, updateRecentList]);

    const handleLinkClick = useCallback((text: string) => {
        // Helper to find ID by text
        const findIdByText = (nodes: Bullet[], searchText: string, exact: boolean): string | null => {
            const target = exact ? searchText : searchText.toLowerCase();
            for (const node of nodes) {
                const nodeText = exact ? node.text : node.text.toLowerCase();
                if (nodeText === target) return node.id;
                
                if (node.children.length > 0) {
                    const found = findIdByText(node.children, searchText, exact);
                    if (found) return found;
                }
            }
            return null;
        };

        let targetId = findIdByText(bullets, text, true); // Exact match
        if (!targetId) {
            targetId = findIdByText(bullets, text, false); // Case-insensitive
        }

        if (targetId) {
            handleNavigate(targetId);
        } else {
            setSearchQuery(text);
            setIsSearchModalOpen(true);
            addToast(`Link target "${text}" not found`, 'info');
        }
    }, [bullets, handleNavigate, addToast]);

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-[var(--main-color)] font-[family-name:var(--font-family)] overflow-hidden transition-colors duration-200">
            <div className="flex-grow flex overflow-hidden">
                <LeftSidebar 
                    isOpen={isSidebarOpen} 
                    recents={recentBullets} 
                    favorites={favoriteBullets} 
                    onNavigate={handleNavigate} 
                />
                
                <div className="flex-grow flex flex-col h-full overflow-hidden relative">
                    <Toolbar
                        onImport={handleImportFile}
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
                            setIsSidebarOpen(prev => {
                                db.keyValuePairs.put({ key: 'isSidebarOpen', value: !prev });
                                return !prev;
                            });
                        }}
                        isFavorite={isTargetFavorite}
                        onToggleFavorite={handleToggleFavorite}
                        canFavorite={!!targetFavoriteId}
                    />

                    <div className="flex-grow overflow-y-auto p-4 sm:p-8" onClick={() => handleFocusChange(null)}>
                        <div className="max-w-4xl mx-auto pb-40">
                             {displayedBullets.length === 0 ? (
                                <div className="text-gray-400 dark:text-gray-500 italic mt-8 text-center cursor-pointer" onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddItemToCurrentView();
                                }}>
                                    Click to add a bullet
                                </div>
                             ) : (
                                 displayedBullets.map(bullet => (
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
                                        focusMode={focusMode}
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
                                        isJournalRoot={bullet.text === DAILY_LOG_ROOT_TEXT}
                                        onNavigateTo={handleNavigate}
                                        onMerge={handleMerge}
                                    />
                                 ))
                             )}
                        </div>
                    </div>

                    <SearchModal 
                        isOpen={isSearchModalOpen} 
                        onClose={handleCloseSearch} 
                        bullets={bullets} 
                        onNavigate={handleNavigate}
                        initialQuery={searchQuery}
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
                        onClose={() => { setIsImportModalOpen(false); setPendingImportData(null); }}
                        onConfirm={handleConfirmImport}
                        bullets={bullets}
                    />

                    <ToastContainer toasts={toasts} removeToast={removeToast} />
                    
                    {linkPopupState.isOpen && (
                        <LinkPopup
                            suggestions={linkSuggestions}
                            selectedIndex={linkPopupState.selectedIndex}
                            onSelect={(b) => linkSelectionHandler.handler && linkSelectionHandler.handler(b)}
                            position={linkPopupState.position}
                            containerRef={linkPopupRef}
                        />
                    )}

                    {tagPopupState.isOpen && (
                        <TagPopup
                            suggestions={tagSuggestions}
                            selectedIndex={tagPopupState.selectedIndex}
                            onSelect={(t) => tagSelectionHandler.handler && tagSelectionHandler.handler(t)}
                            position={tagPopupState.position}
                            containerRef={tagPopupRef}
                        />
                    )}
                </div>
            </div>
            <footer className="flex-shrink-0 p-1 px-4 text-sm text-[var(--main-color)] border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex justify-between items-center z-10 w-full">
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
                      Version 0.1.37
                  </a>
            </footer>
        </div>
    );
};