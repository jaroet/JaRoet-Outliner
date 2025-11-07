import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bullet } from './types.ts';
import BulletItem from './components/BulletItem.tsx';
import Toolbar from './components/Toolbar.tsx';
import LinkPopup from './components/LinkPopup.tsx';
import SearchModal from './components/SearchModal.tsx';

const JOURNAL_ROOT_TEXT = 'Daily Log';

const initialData: Bullet[] = [
  {
    id: 'journal-root',
    text: JOURNAL_ROOT_TEXT,
    note: "Use Ctrl+J to jump to today's log.",
    children: [],
    isCollapsed: false,
  },
  {
    id: '1',
    text: 'Welcome to your Workflowy Clone!',
    note: 'This is a note. Use Shift+Enter to add notes to your bullets.',
    children: [
      {
        id: '2',
        text: 'Features',
        note: '',
        children: [
          { id: '3', text: 'Infinite nested lists', note: '', children: [], isCollapsed: true },
          { id: '4', text: 'Zooming (click the bullet point or use Ctrl+Down)', note: '', children: [], isCollapsed: true },
          { id: '5', text: 'Ctrl+Right to unfold, Ctrl+Left to navigate to parent or fold', note: '', children: [], isCollapsed: true },
          { id: '6', text: 'Search', note: '', children: [], isCollapsed: true },
          { id: '7', text: 'Import/Export JSON data', note: '', children: [], isCollapsed: true },
        ],
        isCollapsed: true,
      },
      {
        id: '8',
        text: 'Hotkeys',
        note: '',
        children: [
            { id: '9', text: 'Enter: Create new item', note: '', children: [], isCollapsed: true },
            { id: '10', text: 'Tab: Indent item', note: '', children: [], isCollapsed: true },
            { id: '11', text: 'Shift+Tab: Outdent item', note: '', children: [], isCollapsed: true },
            { id: '12', text: 'Backspace on empty item: Delete', note: '', children: [], isCollapsed: true },
            { id: '13', text: 'Arrow Up/Down: Navigate items', note: '', children: [], isCollapsed: true },
            { id: '14', text: 'Ctrl+Up: Zoom out', note: '', children: [], isCollapsed: true },
            { id: '15', text: 'Arrow Left (at start): Move to parent', note: '', children: [], isCollapsed: true },
            { id: '16', text: 'Arrow Right (at end): Move to next item', note: '', children: [], isCollapsed: true },
            { id: '17', text: '[[ to link to another item', note: '', children: [], isCollapsed: true },
            { id: '18', text: 'Ctrl+Shift+K: Quick Find', note: '', children: [], isCollapsed: true },
            { id: '19', text: "Ctrl+J: Go to today's daily log", note: '', children: [], isCollapsed: true },
            { id: '20', text: "Alt+Up/Down: Move item up/down", note: '', children: [], isCollapsed: true },
        ],
        isCollapsed: true,
      }
    ],
    isCollapsed: false,
  },
];

const createNewBullet = (text = ''): Bullet => ({
    id: Date.now().toString() + Math.random().toString(),
    text,
    note: '',
    children: [],
    isCollapsed: false,
});

export interface FlatBullet {
    id: string;
    text: string;
    path: string[];
}

interface LinkPopupState {
    isOpen: boolean;
    targetId: string | null;
    query: string;
    position: { top: number; left: number };
    suggestions: FlatBullet[];
    selectedIndex: number;
}

interface AppSettings {
    mainColor: string;
    fileName: string;
    fontFamily: string;
    fontSize: number;
}

// --- Helper Functions ---
function hexToHsl(hex: string): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0, s = 0, l = 0;
    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100);
    l = +(l * 100);
    return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c/2,
        r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { [r,g,b] = [c,x,0] } 
    else if (60 <= h && h < 120) { [r,g,b] = [x,c,0] }
    else if (120 <= h && h < 180) { [r,g,b] = [0,c,x] }
    else if (180 <= h && h < 240) { [r,g,b] = [0,x,c] }
    else if (240 <= h && h < 300) { [r,g,b] = [x,0,c] }
    else if (300 <= h && h < 360) { [r,g,b] = [c,0,x] }
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function deriveNoteColor(hex: string): string {
    const [h, s, l] = hexToHsl(hex);
    const newHue = (h + 150) % 360;
    return hslToHex(newHue, s, Math.min(l + 10, 80));
}

const FONT_LIST = [
  'Arial', 'Verdana', 'Helvetica', 'Tahoma', 'Trebuchet MS', 
  'Times New Roman', 'Georgia', 'Garamond', 
  'Courier New', 'Brush Script MT', 'sans-serif', 'serif', 'monospace'
];

// --- Settings Modal Component ---
interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: AppSettings) => void;
    currentSettings: AppSettings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
    const [settings, setSettings] = useState(currentSettings);

    useEffect(() => {
        if (isOpen) {
            setSettings(currentSettings);
        }
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
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="p-4 text-lg font-semibold border-b border-gray-700">Settings</h2>
                <div className="p-4 space-y-4">
                    <div>
                        <label htmlFor="fileName" className="block text-sm font-medium text-gray-400 mb-1">File Name</label>
                        <input type="text" id="fileName" name="fileName" value={settings.fileName} onChange={handleInputChange} className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"/>
                    </div>
                    <div>
                        <label htmlFor="mainColor" className="block text-sm font-medium text-gray-400 mb-1">Main Color</label>
                        <input type="color" id="mainColor" name="mainColor" value={settings.mainColor} onChange={handleInputChange} className="w-full h-10 p-1 bg-gray-700 rounded-md cursor-pointer"/>
                    </div>
                    <div>
                        <label htmlFor="fontFamily" className="block text-sm font-medium text-gray-400 mb-1">Font</label>
                        <select id="fontFamily" name="fontFamily" value={settings.fontFamily} onChange={handleInputChange} className="w-full bg-gray-700 text-gray-200 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]">
                            {FONT_LIST.map(font => <option key={font} value={font}>{font}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="fontSize" className="block text-sm font-medium text-gray-400 mb-1">Font Size ({settings.fontSize}px)</label>
                        <input type="range" id="fontSize" name="fontSize" min="12" max="24" value={settings.fontSize} onChange={handleFontSizeChange} className="w-full"/>
                    </div>
                </div>
                <div className="p-4 flex justify-end gap-2 border-t border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-md bg-[var(--main-color)] text-white hover:opacity-90">Save</button>
                </div>
            </div>
        </div>
    );
}


const App: React.FC = () => {
    const [bullets, setBullets] = useState<Bullet[]>(initialData);
    const [zoomedBulletId, setZoomedBulletId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusOptions, setFocusOptions] = useState<{ id: string | null; position: 'start' | 'end' }>({ id: null, position: 'end' });
    const isInitialFocusSet = useRef(false);
    const linkPopupRef = useRef<HTMLUListElement>(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [linkSelectionHandler, setLinkSelectionHandler] = useState<{ handler: ((bullet: FlatBullet) => void) | null }>({ handler: null });
    const prevFocusId = useRef<string | null>(null);
    
    const [settings, setSettings] = useState<AppSettings>({
        mainColor: '#60a5fa',
        fileName: 'My Outline',
        fontFamily: 'sans-serif',
        fontSize: 16,
    });
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);


    const [linkPopupState, setLinkPopupState] = useState<LinkPopupState>({
        isOpen: false, targetId: null, query: '', position: { top: 0, left: 0 }, suggestions: [], selectedIndex: 0
    });

    const currentFocusId = focusOptions.id;
    const focusPosition = focusOptions.position;

    const handleFocusChange = useCallback((id: string | null, position: 'start' | 'end' = 'end') => {
        setFocusOptions({ id, position });
    }, []);

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('workflowy-clone-settings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage", error);
        }

        try {
            const savedData = localStorage.getItem('workflowy-clone-data');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                if (!parsedData.find((b: Bullet) => b.text === JOURNAL_ROOT_TEXT)) {
                    parsedData.unshift({
                        id: 'journal-root',
                        text: JOURNAL_ROOT_TEXT,
                        note: "Use Ctrl+J to jump to today's log.",
                        children: [],
                        isCollapsed: false,
                    });
                }
                setBullets(parsedData);
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
            setBullets(initialData);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('workflowy-clone-data', JSON.stringify(bullets));
    }, [bullets]);

    useEffect(() => {
        localStorage.setItem('workflowy-clone-settings', JSON.stringify(settings));
        
        document.title = `${settings.fileName || 'Untitled'} - myOutliner`;
        
        const root = document.documentElement;
        root.style.setProperty('--main-color', settings.mainColor);
        root.style.setProperty('--note-color', deriveNoteColor(settings.mainColor));
        root.style.setProperty('--font-family', settings.fontFamily);
        root.style.setProperty('--font-size', `${settings.fontSize}px`);

    }, [settings]);

    const findBulletAndParent = useCallback((
        id: string,
        nodes: Bullet[],
        parent: Bullet | null = null
      ): { node: Bullet; parent: Bullet | null; siblings: Bullet[]; index: number } | null => {
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
            if (found && found.node.text === '' && found.node.note === '' && found.node.children.length === 0) {
                const newBullets = JSON.parse(JSON.stringify(bullets));
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

    const handleZoom = useCallback((id: string | null) => {
        const oldZoomedBulletId = zoomedBulletId;
        
        // A zoom out is navigating to a parent/ancestor in the breadcrumb path, or to the root.
        const isZoomingOut = (id === null && oldZoomedBulletId !== null) || 
                             (id !== null && breadcrumbs.some(b => b.id === id));
        
        if (id === null) { // Zooming out to root
            setZoomedBulletId(null);
            if (oldZoomedBulletId) {
                // Focus on the bullet we were just zoomed into.
                setTimeout(() => handleFocusChange(oldZoomedBulletId), 0);
            } else {
                 // Fallback: if already at root, focus first visible item.
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
    
        if (bulletToZoom && bulletToZoom.children.length === 0) {
            // This is for zooming into a leaf node. We create a new bullet and focus it.
            const newBullet = createNewBullet();
            const newBullets = JSON.parse(JSON.stringify(bullets));
            const found = findBulletAndParent(id, newBullets);
            if (found) {
                found.node.children.push(newBullet);
                found.node.isCollapsed = false;
                setBullets(newBullets);
                setZoomedBulletId(id);
                setTimeout(() => {
                    handleFocusChange(newBullet.id);
                }, 0);
            } else {
                setZoomedBulletId(id);
            }
        } else if (bulletToZoom && bulletToZoom.children.length > 0) {
            setZoomedBulletId(id);
            if (isZoomingOut && oldZoomedBulletId) {
                // When zooming out, focus on the node we were just in.
                setTimeout(() => handleFocusChange(oldZoomedBulletId), 0);
            } else {
                // When zooming in, focus on the first child.
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
        } else {
            // Fallback for bullet not found
            setZoomedBulletId(id);
        }
    }, [bullets, handleFocusChange, zoomedBulletId, breadcrumbs, findBulletAndParent]);

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

        const newBullets = JSON.parse(JSON.stringify(bullets));
        
        let journalNode = newBullets.find((b: Bullet) => b.text === JOURNAL_ROOT_TEXT);
        if (!journalNode) {
            journalNode = createNewBullet(JOURNAL_ROOT_TEXT);
            newBullets.unshift(journalNode);
        }

        let yearNode = journalNode.children.find((b: Bullet) => b.text === year);
        if (!yearNode) {
            yearNode = createNewBullet(year);
            journalNode.children.push(yearNode);
        }

        let monthNode = yearNode.children.find((b: Bullet) => b.text === month);
        if (!monthNode) {
            monthNode = createNewBullet(month);
            yearNode.children.push(monthNode);
        }
        
        let dayNode = monthNode.children.find((b: Bullet) => b.text === dayText);
        if (!dayNode) {
            dayNode = createNewBullet(dayText);
            monthNode.children.push(dayNode);
        }
        
        setBullets(newBullets);
        handleZoom(monthNode.id);
        setTimeout(() => handleFocusChange(dayNode.id), 0);
    }, [bullets, handleZoom, handleFocusChange]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsSearchModalOpen(prev => !prev);
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

    const mapBullets = (
        nodes: Bullet[],
        callback: (node: Bullet) => Bullet
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
        setBullets(prevBullets =>
            mapBullets(prevBullets, bullet =>
                bullet.id === id ? { ...bullet, ...updates } : bullet
            )
        );
    }, []);

    const addSibling = (targetId: string, newBullet: Bullet) => {
        const newBullets = JSON.parse(JSON.stringify(bullets));
        let baseNodes = newBullets;
        if(zoomedBulletId){
            const zoomed = findBulletAndParent(zoomedBulletId, newBullets);
            if(zoomed) baseNodes = zoomed.node.children;
        }
        const found = findBulletAndParent(targetId, baseNodes);
        if (found) {
            found.siblings.splice(found.index + 1, 0, newBullet);
            setBullets(newBullets);
            handleFocusChange(newBullet.id);
        }
    }

    const handleAddSibling = useCallback((id: string) => {
       addSibling(id, createNewBullet());
    }, [bullets, zoomedBulletId, handleFocusChange, findBulletAndParent]);

    const handleDelete = useCallback((id: string) => {
        const newBullets = JSON.parse(JSON.stringify(bullets));
        const found = findBulletAndParent(id, newBullets);
        if (found) {
            const prevSiblingId = found.index > 0 ? found.siblings[found.index - 1].id : found.parent?.id;
            found.siblings.splice(found.index, 1);
            setBullets(newBullets);
            handleFocusChange(prevSiblingId || null);
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);
    
    const handleIndent = useCallback((id: string) => {
        const newBullets = JSON.parse(JSON.stringify(bullets));
        const found = findBulletAndParent(id, newBullets);
        if (found && found.index > 0) {
            const prevSibling = found.siblings[found.index - 1];
            const [movedNode] = found.siblings.splice(found.index, 1);
            prevSibling.children.push(movedNode);
            prevSibling.isCollapsed = false;
            setBullets(newBullets);
            handleFocusChange(id);
        }
    }, [bullets, handleFocusChange, findBulletAndParent]);
    
    const handleOutdent = useCallback((id: string) => {
        const newBullets = JSON.parse(JSON.stringify(bullets));
        const found = findBulletAndParent(id, newBullets);
        if (found && found.parent) {
            const parentInfo = findBulletAndParent(found.parent.id, newBullets);
            if(parentInfo){
                const [movedNode] = found.siblings.splice(found.index, 1);
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
                    newNode.children = setCollapseRecursively(newNode.children);
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
        const newBullets = JSON.parse(JSON.stringify(bullets));
        const found = findBulletAndParent(id, newBullets);
    
        if (!found) return;
    
        const { siblings, index } = found;
    
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
          ): { node: Bullet; parent: Bullet | null; } | null => {
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
        setBullets(data);
        setZoomedBulletId(null);
        setSearchQuery('');
    };
    
    const handleAddItemToCurrentView = useCallback(() => {
        const newBullet = createNewBullet();
        if (zoomedBulletId) {
            const newBullets = JSON.parse(JSON.stringify(bullets));
            const found = findBulletAndParent(zoomedBulletId, newBullets);
            if (found) {
                found.node.children.push(newBullet);
                found.node.isCollapsed = false;
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

    const flatBullets = useMemo((): FlatBullet[] => {
        const results: FlatBullet[] = [];
        const traverse = (nodes: Bullet[], currentPath: string[]) => {
            for (const node of nodes) {
                results.push({
                    id: node.id,
                    text: node.text,
                    path: currentPath,
                });
                if (node.children && node.children.length > 0) {
                    traverse(node.children, [...currentPath, node.text || 'Untitled']);
                }
            }
        };
        traverse(bullets, []);
        return results;
    }, [bullets]);


    // --- Link Popup Logic ---

    const handleTriggerLinkPopup = useCallback((bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (bullet: FlatBullet) => void) => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setLinkSelectionHandler({ handler: selectionHandler });

        const POPUP_MAX_WIDTH_PX = 768; // Corresponds to Tailwind's max-w-2xl
        const VIEWPORT_PADDING_PX = 16;
        
        let left = rect.left + window.scrollX;
        
        // Ensure the popup doesn't overflow the right edge of the viewport
        if (left + POPUP_MAX_WIDTH_PX > window.innerWidth - VIEWPORT_PADDING_PX) {
            left = window.innerWidth - POPUP_MAX_WIDTH_PX - VIEWPORT_PADDING_PX;
        }

        // Ensure the popup doesn't start off-screen on the left
        left = Math.max(VIEWPORT_PADDING_PX, left);

        const suggestions = !query 
            ? flatBullets.slice(0, 50) // Show some initial items if query is empty
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
            .filter(bullet => bullet.score > 0 && bullet.id !== bulletId) // Don't link to self
            .sort((a, b) => b.score - a.score);

        setLinkPopupState({
            isOpen: true,
            targetId: bulletId,
            query: query,
            position: { top: rect.bottom + window.scrollY, left: left },
            suggestions: suggestions.slice(0, 100), // Limit suggestions
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
        setLinkPopupState(prev => {
            const { suggestions, selectedIndex } = prev;
            let nextIndex = selectedIndex;
            if (direction === 'down') {
                nextIndex = (selectedIndex + 1) % suggestions.length;
            } else {
                nextIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
            }
            return { ...prev, selectedIndex: nextIndex };
        });
    }, [linkPopupState.isOpen]);
    
    const handleLinkSelect = useCallback((callback: (selected: FlatBullet) => void) => {
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
                    if (node.id === targetBullet!.id) {
                        path.push(...newPath);
                        return true;
                    }
                    if (findPath(node.children, newPath)) return true;
                }
                return false;
            };
            findPath(bullets, []);
            
            const parent = path.length > 1 ? path[path.length - 2] : null;
            handleZoom(parent ? parent.id : null);
            setTimeout(() => handleFocusChange(targetBullet!.id, 'end'), 0);
        } else {
            console.warn(`Link target not found: "${linkText}"`);
        }
    }, [bullets, handleZoom, handleFocusChange]);

    const handleNavigate = (bulletId: string) => {
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
            handleZoom(parent ? parent.id : null);
            setIsSearchModalOpen(false);
            // Use timeout to ensure the view has re-rendered before focusing
            setTimeout(() => {
                handleFocusChange(bulletId, 'end');
            }, 0);
        }
    };


    return (
        <div className="h-screen w-screen flex flex-col">
            <Toolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onImport={handleImport}
                onExport={handleExport}
                breadcrumbs={breadcrumbs}
                onBreadcrumbClick={handleZoom}
                fileName={settings.fileName}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
            />
            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                bullets={flatBullets}
                onNavigate={handleNavigate}
            />
            <SettingsModal 
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onSave={setSettings}
                currentSettings={settings}
            />
            <main className="flex-grow overflow-y-auto p-4 md:px-8 lg:px-16 xl:px-32">
                {displayedBullets.length > 0 ? displayedBullets.map(bullet => (
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
                        onLinkClick={handleLinkClick}
                        onTriggerLinkPopup={handleTriggerLinkPopup}
                        onCloseLinkPopup={handleCloseLinkPopup}
                        onLinkNavigate={handleLinkNavigate}
                        onLinkSelect={handleLinkSelect}
                        isLinkPopupOpen={linkPopupState.isOpen}
                        linkPopupTargetId={linkPopupState.targetId}
                        isJournalRoot={bullet.text === JOURNAL_ROOT_TEXT && zoomedBulletId === null}
                    />
                )) : (
                    <div className="flex justify-center items-center h-full text-gray-500">
                        <button onClick={handleAddItemToCurrentView} className="border border-dashed border-gray-600 px-4 py-2 rounded-md hover:bg-gray-800 transition-colors">
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
            </main>
        </div>
    );
};

export default App;