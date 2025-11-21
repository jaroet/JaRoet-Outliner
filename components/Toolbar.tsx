
import React, { useRef } from 'react';
import { HomeIcon, AppointmentIcon, UploadIcon, DownloadIcon, SettingsIcon, SunIcon, MoonIcon, SearchIcon, SidebarIcon, StarIcon } from './Icons.tsx';

interface Breadcrumb {
    id: string;
    text: string;
}

interface ToolbarProps {
  onImport: (data: any) => void;
  onExport: () => void;
  breadcrumbs: Breadcrumb[];
  onBreadcrumbClick: (id: string | null) => void;
  fileName: string;
  onOpenSettings: () => void;
  onGoToToday: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onOpenSearch: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  canFavorite: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({
  onImport,
  onExport,
  breadcrumbs,
  onBreadcrumbClick,
  fileName,
  onOpenSettings,
  onGoToToday,
  theme,
  onThemeToggle,
  onOpenSearch,
  isSidebarOpen,
  onToggleSidebar,
  isFavorite,
  onToggleFavorite,
  canFavorite,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          // Basic validation
          if (Array.isArray(data) && data.every(item => 'id' in item && 'text' in item)) {
            onImport(data);
          } else {
            alert('Invalid JSON file format.');
          }
        } catch (error) {
          alert('Error parsing JSON file.');
          console.error(error);
        }
      };
      reader.readAsText(file);
    }
     // Reset file input to allow re-uploading the same file
    if(event.target) {
        event.target.value = '';
    }
  };

  return (
    <div className="flex-shrink-0 sticky top-0 z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 text-[var(--main-color)]">
        <button 
            onClick={onToggleSidebar} 
            className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isSidebarOpen ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
            <SidebarIcon />
        </button>

        <div className="flex-grow flex items-center gap-2 overflow-hidden">
            <button onClick={() => onBreadcrumbClick(null)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <HomeIcon />
            </button>
            {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                <span className="text-gray-400 dark:text-gray-500">/</span>
                <button
                    onClick={() => onBreadcrumbClick(crumb.id)}
                    className="px-2 py-1 text-sm text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors truncate"
                    title={crumb.text}
                >
                    {crumb.text || <em>Untitled</em>}
                </button>
                </React.Fragment>
            ))}
        </div>

      <div className="flex items-center gap-2">
         <button onClick={onOpenSearch} title="Quick Find (Ctrl+Shift+K)" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <SearchIcon />
        </button>
        <button onClick={onGoToToday} title="Go to Today's Log (Ctrl+J)" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <AppointmentIcon className="w-5 h-5" />
        </button>
        <button 
            onClick={onToggleFavorite} 
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${!canFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canFavorite}
        >
            <StarIcon filled={isFavorite} />
        </button>

        <div className="flex items-center gap-1">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
            <button onClick={handleImportClick} title="Import from JSON" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <UploadIcon />
            </button>
            <button onClick={onExport} title="Export to JSON" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <DownloadIcon />
            </button>
            <button onClick={onThemeToggle} title="Toggle Theme" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={onOpenSettings} title="Settings" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <SettingsIcon />
            </button>
        </div>
      </div>
    </div>
  );
});