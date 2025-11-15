import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Bullet, FlatBullet, Settings, CoreBullet } from './types';
import { Toolbar } from './components/Toolbar';
import { BulletItem } from './components/BulletItem';
import { SearchModal } from './components/SearchModal';
import { LinkPopup } from './components/LinkPopup';
import { TagPopup } from './components/TagPopup';

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
    id: 'doc-root',
    text: 'Help & Documentation',
    children: [
      {
        id: 'help-placeholder',
        text: 'To view the full documentation and changelog, import the `help-documentation.json` file using the "Import from JSON" button in the toolbar.',
        children: [],
        isCollapsed: false,
      },
    ],
    isCollapsed: true,
  },
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
    const now = Date.now();
    return nodes.map(node => ({
        ...node,
        createdAt: node.createdAt || now,
        updatedAt: node.updatedAt || now,
        children: migrateBullets(node.children),
    }));
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
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
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
    const { useState, useEffect, useCallback, useMemo, useRef } = React;
    const [bullets, setBullets] = useState<Bullet[]>(initialData);
    const [zoomedBulletId, setZoomedBulletId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusOptions, setFocusOptions] = useState<{ id: string | null; position: 'start' | 'end' }>({ id: null, position: 'end' });
    const isInitialFocusSet = useRef(false);
    const linkPopupRef = useRef(null);
    const tagPopupRef = useRef(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [linkSelectionHandler, setLinkSelectionHandler] = useState<{ handler: ((bullet: FlatBullet) => void) | null }>({ handler: null });
    const [tagSelectionHandler, setTagSelectionHandler] = useState<{ handler: ((tag: string) => void) | null }>({ handler: null });
    const prevFocusId = useRef<string | null>(null);
    const dataLoadedRef = useRef(false);
    const prevCoreDataRef = useRef<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const focusBeforeModalRef = useRef<string | null>(null);
    
    const [settings, setSettings] = useState<Settings>({
        mainColor: '#60a5fa',
        fileName: 'My Outline',
        fontFamily: 'sans-serif',
        fontSize: 16,
    });
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const [linkPopupState, setLinkPopupState] = useState({
        isOpen: false, targetId: null as string | null, query: '', position: { top: 0, left: 0 }, suggestions: [] as FlatBullet[], selectedIndex: 0
    });
    const [tagPopupState, setTagPopupState] = useState({
        isOpen: false, targetId: null as string | null, query: '', position: { top: 0, left: 0 }, suggestions: [] as string[], selectedIndex: 0
    });


    const currentFocusId = focusOptions.id;
    const focusPosition = focusOptions.position;

    const handleFocusChange = useCallback((id: string | null, position: 'start' | 'end' = 'end') => {
        setFocusOptions({ id, position });
    }, []);

    const getCoreDataString = useCallback((nodes: Bullet[]) => {
        const removeUiState = (b: Bullet): CoreBullet => {
            return {
                id: b.id,
                text: b.text,
                children: b.children.map(removeUiState),
                originalId: b.originalId,
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
    }, [theme]);

    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark';
        root.classList.toggle('dark', isDark);
    }, [theme]);

    // Load settings and data on initial mount
    useEffect(() => {
        const loadData = async () => {
            // Load theme first to prevent flash of wrong theme
            const savedThemeEntry = await db.keyValuePairs.get('theme');
            const savedTheme = savedThemeEntry?.value;
            if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
                setTheme(savedTheme);
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

            // Always try loading from local DB first as a baseline.
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
        
        document.title = `${settings.fileName || 'Untitled'} - Jaroet Outliner`;
        
        const root = document.documentElement;
        root.style.setProperty('--main-color', settings.mainColor);
        root.style.setProperty('--font-family', settings.fontFamily);
        root.style.setProperty('--font-size', `${settings.fontSize}px`);
        
        // Save main bullet data to IndexedDB
        db.keyValuePairs.put({ key: 'bullets', value: bullets });
        
        const currentCoreData = getCoreDataString(bullets);
        // Logic to detect change if needed for other purposes, kept for consistency
        if (currentCoreData !== prevCoreDataRef.current) {
             prevCoreDataRef.current = currentCoreData;
        }

    }, [settings, bullets, getCoreDataString]);
    
    const flatBullets: FlatBullet[] = useMemo(() => {
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
    }, [bullets]);
    
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        const tagRegex = /#\w+/g;
        for (const bullet of flatBullets) {
            const matches = bullet.text.match(tagRegex);
            if (matches) {
                matches.forEach(tag => tagSet.add(tag));
            }
        }
        return Array.from(tagSet).sort();
    }, [flatBullets]);


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
                }
            }
        }

        prevFocusId.current = currentId;
    }, [focusOptions.id, bullets, findBulletAndParent]);


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

    const handleZoom = useCallback((id: string | null) => {
        const oldZoomedBulletId = zoomedBulletId;
        const isZoomingOut = (id === null && oldZoomedBulletId !== null) || 
                             (id !== null && breadcrumbs.some(b => b.id === id));
        
        if (id === null) { 
            setZoomedBulletId(null);
            if (oldZoomedBulletId) {
                setTimeout(() => handleFocusChange(oldZoomedBulletId), 0);
            } else {
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
                const rootVisibleIds = getVisibleIds(bullets);
                if (rootVisibleIds.length > 0) {
                    handleFocusChange(rootVisibleIds[0]);
                }
            }
            return;
        }
    
        const bulletToZoom = findBulletAndParent(id, bullets)?.node;
    
        if (bulletToZoom && bulletToZoom.children.length === 0 && !bulletToZoom.isReadOnly) {
            const newBullet = createNewBullet();
            const newBullets = structuredClone(bullets);
            const found = findBulletAndParent(id, newBullets);
            if (found) {
                found.node.children.push(newBullet);
                found.node.isCollapsed = false;
                found.node.updatedAt = Date.now();
                setBullets(newBullets);
                setZoomedBulletId(id);
                setTimeout(() => {
                    handleFocusChange(newBullet.id);
                }, 0);
            } else {
                setZoomedBulletId(id);
            }
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
    }, [zoomedBulletId, bullets, handleFocusChange, breadcrumbs, findBulletAndParent]);

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
    
    useEffect(() => {
        if (!isInitialFocusSet.current && visibleBulletIds.length > 0) {
            handleFocusChange(visibleBulletIds[0], 'end');
            isInitialFocusSet.current = true;
        }
    }, [visibleBulletIds, handleFocusChange]);

    const handleGoToJournal = useCallback(() => {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dayText = `${year}-${month}-${day}`;

        const newBullets = structuredClone(bullets);
        
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
        setZoomedBulletId(monthNode.id);
        setTimeout(() => handleFocusChange(dayNode.id), 0);
    }, [bullets, handleFocusChange]);

    const mapBullets = (
        nodes: Bullet[],
        callback: (bullet: Bullet) => Bullet
    ): Bullet[] => {
        return nodes.map(node => {
            const newNode = callback(node);
            return {
                ...newNode,
                children: mapBullets(newNode.children, callback),
            };
        });
    };
    
    const handleUpdate = useCallback((id: string, updates: Partial<Bullet>) => {
        const found = findBulletAndParent(id, bullets);
        if (found?.node.isReadOnly) return;

        setBullets(prevBullets =>
            mapBullets(prevBullets, bullet =>
                bullet.id === id ? { ...bullet, ...updates, updatedAt: Date.now() } : bullet
            )
        );
    }, [bullets, findBulletAndParent]);
    
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                handleOpenSearch();
            }
            else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                handleGoToJournal();
            }
            else if (e.ctrlKey && e.key === 'ArrowUp') {
                e.preventDefault();
                if (zoomedBulletId) {
                    const parentId = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
                    handleZoom(parentId);
                }
            }
            else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !currentFocusId && visibleBulletIds.length > 0) {
                const target = e.target as HTMLElement;
                if(target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleFocusChange(visibleBulletIds[0]);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [zoomedBulletId, breadcrumbs, currentFocusId, visibleBulletIds, handleGoToJournal, handleZoom, handleFocusChange]);

    const handleAddSibling = useCallback((id: string, text = '') => {
        const newBullet = createNewBullet(text);
        const newBullets = structuredClone(bullets);
        const found = findBulletAndParent(id, newBullets);

        if (found) {
            if (found.node.isReadOnly) return;
            found.siblings.splice(found.index + 1, 0, newBullet);
            if (found.parent) {
                found.parent.updatedAt = Date.now();
            }
            setBullets(newBullets);
            handleFocusChange(newBullet.id);
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);

    const handleDelete = useCallback((id: string) => {
        const foundTarget = findBulletAndParent(id, bullets);
        if (foundTarget?.node.isReadOnly) return;

        const newBullets = structuredClone(bullets);
        const found = findBulletAndParent(id, newBullets);
        if (found) {
            const prevSiblingId = found.index > 0 ? found.siblings[found.index - 1].id : found.parent?.id;
            if (found.parent) {
                found.parent.updatedAt = Date.now();
            }
            found.siblings.splice(found.index, 1);
            setBullets(newBullets);
            handleFocusChange(prevSiblingId || null);
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);
    
    const handleIndent = useCallback((id: string) => {
        const foundTarget = findBulletAndParent(id, bullets);
        if (foundTarget?.node.isReadOnly) return;

        const newBullets = structuredClone(bullets);
        const found = findBulletAndParent(id, newBullets);
        if (found && found.index > 0) {
            const prevSibling = found.siblings[found.index - 1];
             if (prevSibling.isReadOnly) return;
            const [movedNode] = found.siblings.splice(found.index, 1);
            movedNode.updatedAt = Date.now();
            prevSibling.children.push(movedNode);
            prevSibling.isCollapsed = false;
            setBullets(newBullets);
            handleFocusChange(id);
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);
    
    const handleOutdent = useCallback((id: string) => {
        const foundTarget = findBulletAndParent(id, bullets);
        if (foundTarget?.node.isReadOnly) return;

        const newBullets = structuredClone(bullets);
        const found = findBulletAndParent(id, newBullets);
        if (found && found.parent) {
            const parentInfo = findBulletAndParent(found.parent.id, newBullets);
            if(parentInfo && !parentInfo.node.isReadOnly){
                const [movedNode] = found.siblings.splice(found.index, 1);
                movedNode.updatedAt = Date.now();
                const subsequentSiblings = found.siblings.splice(found.index);
                movedNode.children.push(...subsequentSiblings);

                parentInfo.siblings.splice(parentInfo.index + 1, 0, movedNode);
                setBullets(newBullets);
                handleFocusChange(id);
            }
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);

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
        const foundTarget = findBulletAndParent(id, bullets);
        if (foundTarget?.node.isReadOnly) return;

        const newBullets = structuredClone(bullets);
        const found = findBulletAndParent(id, newBullets);
    
        if (!found) return;
    
        const { siblings, index } = found;
        found.node.updatedAt = Date.now();
    
        if (direction === 'up') {
            if (index > 0) {
                [siblings[index], siblings[index - 1]] = [siblings[index - 1], siblings[index]];
                setBullets(newBullets);
            }
        } else { // 'down'
            if (index < siblings.length - 1) {
                [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
                setBullets(newBullets);
            }
        }
    }, [bullets, findBulletAndParent]);

    const handleFocusParent = useCallback((id: string) => {
        const currentTree = zoomedBulletId ? displayedBullets : bullets;
        const findInCurrentView = (
            bulletId: string,
            nodes: Bullet[],
            parent: Bullet | null = null
          ): { node: Bullet, parent: Bullet | null } | null => {
            for (const node of nodes) {
              if (node.id === bulletId) {
                return { node, parent };
              }
              const found = findInCurrentView(bulletId, node.children, node);
              if (found) return found;
            }
            return null;
        };
        const found = findInCurrentView(id, currentTree);
        if (found?.parent) {
            handleFocusChange(found.parent.id);
        }
    }, [zoomedBulletId, bullets, displayedBullets, handleFocusChange]);

    const handleFocusChild = useCallback((id: string) => {
        const found = findBulletAndParent(id, bullets);
        if (found?.node && found.node.children.length > 0 && !found.node.isCollapsed) {
            handleFocusChange(found.node.children[0].id, 'start');
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);


    const handleExport = () => {
        const dataStr = JSON.stringify(bullets, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'workflowy_clone_data.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImport = (data: Bullet[]) => {
        const migratedData = migrateBullets(data);
        setBullets(migratedData);
        setZoomedBulletId(null);
        setSearchQuery('');
    };
    
    const handleAddItemToCurrentView = useCallback(() => {
        const newBullet = createNewBullet();
        if (zoomedBulletId) {
            const newBullets = structuredClone(bullets);
            const found = findBulletAndParent(zoomedBulletId, newBullets);
            if (found && !found.node.isReadOnly) {
                found.node.children.push(newBullet);
                found.node.isCollapsed = false;
                found.node.updatedAt = Date.now();
                setBullets(newBullets);
                handleFocusChange(newBullet.id);
            }
        } else {
            setBullets(prev => [...prev, newBullet]);
            handleFocusChange(newBullet.id);
        }
    }, [bullets, zoomedBulletId, handleFocusChange, findBulletAndParent]);

    const handleFocusMove = useCallback((direction: 'up' | 'down', position: 'start' | 'end' = 'end') => {
        if (!currentFocusId) {
            if (visibleBulletIds.length > 0) {
                 handleFocusChange(visibleBulletIds[0], position);
            }
            return;
        }
        const currentIndex = visibleBulletIds.indexOf(currentFocusId);
        if (currentIndex === -1) return;
        let nextIndex;
        if (direction === 'down') {
            nextIndex = currentIndex + 1;
            if (nextIndex < visibleBulletIds.length) {
                handleFocusChange(visibleBulletIds[nextIndex], position);
            }
        } else { // 'up'
            nextIndex = currentIndex - 1;
            if (nextIndex >= 0) {
                handleFocusChange(visibleBulletIds[nextIndex], position);
            }
        }
    }, [currentFocusId, visibleBulletIds, handleFocusChange]);

    const handleOpenSearch = () => {
        focusBeforeModalRef.current = currentFocusId;
        setIsSearchModalOpen(true);
    };

    const handleCloseSearch = () => {
        setIsSearchModalOpen(false);
        if (focusBeforeModalRef.current) {
            const idToRestore = focusBeforeModalRef.current;
            // By setting the position to 'start' and then immediately back to 'end' in a timeout,
            // we ensure the focus effect's dependencies change in BulletItem, forcing it to re-run
            // and re-apply focus, even if the focused ID hasn't changed.
            handleFocusChange(idToRestore, 'start');
            setTimeout(() => {
                handleFocusChange(idToRestore, 'end');
            }, 0);
            focusBeforeModalRef.current = null;
        }
    };


    // --- Link & Tag Popup Logic ---
    const handleTriggerLinkPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedBullet: FlatBullet) => void) => {
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

        const suggestions = !query 
            ? flatBullets.slice(0, 50) 
            : flatBullets.map(bullet => {
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

    }, [flatBullets]);

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
    
    const handleLinkSelect = useCallback((callback: (selectedBullet: FlatBullet) => void) => {
        if (!linkPopupState.isOpen || linkPopupState.suggestions.length === 0) return;
        const selectedBullet = linkPopupState.suggestions[linkPopupState.selectedIndex];
        callback(selectedBullet);
    }, [linkPopupState]);

    const handleLinkClick = useCallback((linkText: string) => {
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
        find(bullets);
    
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
            findPath(bullets, []);
            
            const parent = path.length > 1 ? path[path.length - 2] : null;
            setZoomedBulletId(parent ? parent.id : null);
            setTimeout(() => handleFocusChange((targetBullet as Bullet).id, 'end'), 0);
        } else {
            console.warn(`Link target not found: "${linkText}"`);
        }
    }, [bullets, handleFocusChange]);

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
        
        const lowerCaseQuery = query.toLowerCase();
        const suggestions = allTags.filter(tag => tag.toLowerCase().includes(lowerCaseQuery));

        setTagPopupState({
            isOpen: true,
            targetId: bulletId,
            query: query,
            position: { top: rect.bottom + window.scrollY, left: left },
            suggestions: suggestions.slice(0, 100),
            selectedIndex: 0,
        });
    }, [allTags]);

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
        if (!tagPopupState.isOpen || tagPopupState.suggestions.length === 0) return;
        const selectedTag = tagPopupState.suggestions[tagPopupState.selectedIndex];
        callback(selectedTag);
    }, [tagPopupState]);

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
                        />
                    </div>
                )) : (
                    <div className="flex justify-center items-center h-full text-gray-400 dark:text-gray-500">
                        <button onClick={handleAddItemToCurrentView} className="border border-dashed border-gray-300 dark:border-gray-600 px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                           {zoomedBulletId ? 'Add an item here' : 'Start with a new item'}
                        </button>
                    </div>
                )}
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
            </main>
             <SearchModal
                isOpen={isSearchModalOpen}
                onClose={handleCloseSearch}
                bullets={flatBullets}
                onNavigate={handleNavigate}
                allTags={allTags}
            />
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onSave={setSettings}
                currentSettings={settings}
            />
        </div>
    );
};