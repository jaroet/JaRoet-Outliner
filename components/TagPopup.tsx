import React, { useEffect, useRef } from 'react';

interface TagPopupProps {
    suggestions: string[];
    selectedIndex: number;
    onSelect: (tag: string) => void;
    position: { top: number; left: number };
    containerRef: React.RefObject<HTMLUListElement>;
}

export const TagPopup: React.FC<TagPopupProps> = ({ suggestions, selectedIndex, onSelect, position, containerRef }) => {
  const selectedItemRef = useRef<HTMLLIElement>(null);
  
  useEffect(() => {
    if (selectedItemRef.current) {
        selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto w-auto min-w-[150px]"
      style={{ top: position.top, left: position.left }}
    >
      <ul ref={containerRef}>
        {suggestions.map((tag, index) => (
          <li key={tag} ref={index === selectedIndex ? selectedItemRef : null}>
            <button
              onClick={() => onSelect(tag)}
              className={`w-full text-left px-3 py-2 text-sm ${
                index === selectedIndex ? 'selected-item-bg text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
               title={tag}
            >
              <span className="truncate block">{tag}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};