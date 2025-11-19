import React, { useEffect, useRef } from 'react';
import type { FlatBullet } from '../types.ts';

interface LinkPopupProps {
    suggestions: FlatBullet[];
    selectedIndex: number;
    onSelect: (bullet: FlatBullet) => void;
    position: { top: number; left: number };
    containerRef: React.RefObject<HTMLUListElement>;
}

export const LinkPopup: React.FC<LinkPopupProps> = ({ suggestions, selectedIndex, onSelect, position, containerRef }) => {
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
      className="absolute z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto w-full max-w-2xl"
      style={{ top: position.top, left: position.left }}
    >
      <ul ref={containerRef}>
        {suggestions.map((bullet, index) => (
          <li key={bullet.id} ref={index === selectedIndex ? selectedItemRef : null}>
            <button
              onClick={() => onSelect(bullet)}
              className={`w-full text-left px-3 py-2 text-sm ${
                index === selectedIndex ? 'selected-item-bg text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
               title={bullet.text}
            >
              <span className="truncate block">{bullet.text || <em>Untitled</em>}</span>
              {bullet.path.length > 0 && (
                  <span className={`text-xs truncate block ${
                    index === selectedIndex ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'
                  }`}>{bullet.path.join(' / ')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};