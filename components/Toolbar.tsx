import React, { useRef } from 'react';
import { Bullet } from '../types.ts';
import { SearchIcon, UploadIcon, DownloadIcon, HomeIcon, SettingsIcon } from './Icons.tsx';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onImport: (data: Bullet[]) => void;
  onExport: () => void;
  breadcrumbs: Bullet[];
  onBreadcrumbClick: (bulletId: string | null) => void;
  fileName: string;
  onOpenSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onImport,
  onExport,
  breadcrumbs,
  onBreadcrumbClick,
  fileName,
  onOpenSettings,
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
    <div className="sticky top-0 z-10 bg-gray-800/80 backdrop-blur-sm p-2 flex flex-col sm:flex-row items-center gap-4 border-b border-gray-700 text-[var(--main-color)]">
      <div className="flex-grow w-full sm:w-auto">
        <div className="flex items-center gap-2">
            <button onClick={() => onBreadcrumbClick(null)} className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                <HomeIcon />
            </button>
            {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                <span className="text-gray-500">/</span>
                <button
                    onClick={() => onBreadcrumbClick(crumb.id)}
                    className="px-2 py-1 text-sm text-gray-200 rounded-md hover:bg-gray-700 transition-colors truncate max-w-xs"
                    title={crumb.text}
                >
                    {crumb.text || <em>Untitled</em>}
                </button>
                </React.Fragment>
            ))}
            {breadcrumbs.length === 0 && (
                <span className="text-gray-200 font-semibold ml-2 truncate" title={fileName}>{fileName}</span>
            )}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-700 text-gray-200 pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)] transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
            <button onClick={handleImportClick} title="Import from JSON" className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                <UploadIcon />
            </button>
            <button onClick={onExport} title="Export to JSON" className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                <DownloadIcon />
            </button>
            <button onClick={onOpenSettings} title="Settings" className="p-2 rounded-md hover:bg-gray-700 transition-colors">
                <SettingsIcon />
            </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;