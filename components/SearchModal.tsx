import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FlatBullet } from '../App.tsx';
import { SearchIcon } from './Icons.tsx';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  bullets: FlatBullet[];
  onNavigate: (bulletId: string) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, bullets, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredBullets = useMemo(() => {
    if (!query) {
      return bullets;
    }
    const lowerCaseQuery = query.toLowerCase();
    return bullets.filter(b => b.text.toLowerCase().includes(lowerCaseQuery));
  }, [query, bullets]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredBullets.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredBullets.length) % filteredBullets.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBullets[selectedIndex]) {
        onNavigate(filteredBullets[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-30 flex justify-center items-start pt-20"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="p-4 border-b border-gray-700 relative text-[var(--main-color)]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-7">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Quick find..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-gray-900 text-gray-200 pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"
          />
        </div>
        <div className="overflow-y-auto">
          {filteredBullets.length > 0 ? (
            <ul ref={listRef}>
              {filteredBullets.map((bullet, index) => (
                <li
                  key={bullet.id}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  className={`cursor-pointer ${index === selectedIndex ? 'bg-[var(--main-color)]' : 'hover:bg-gray-700'}`}
                  onClick={() => onNavigate(bullet.id)}
                >
                  <div className="px-4 py-2 border-b border-gray-700/50">
                    <p className="text-gray-200 truncate">{bullet.text || <em>Untitled</em>}</p>
                    {bullet.path.length > 0 && (
                        <p className={`text-xs truncate ${
                            index === selectedIndex ? 'text-white/80' : 'text-gray-500'
                        }`}>{bullet.path.join(' / ')}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 p-4 text-center">No results found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;