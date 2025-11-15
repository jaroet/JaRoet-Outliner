import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon } from './Icons';
import type { FlatBullet } from '../types';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    bullets: FlatBullet[];
    onNavigate: (id: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, bullets, onNavigate }) => {
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
  
  // Reset index when query changes to avoid out-of-bounds errors
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const filteredBullets = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return bullets;
    }

    const lowerCaseQuery = trimmedQuery.toLowerCase();
    
    // Split by " OR " to get the main clauses for OR logic
    const orClauses = lowerCaseQuery.split(/\s+or\s+/i);

    // For each clause, split by space to get terms that must all be present (AND logic)
    const searchConditionGroups = orClauses.map(clause => 
        clause.split(/\s+/).filter(term => term)
    );

    return bullets.filter(bullet => {
        const lowerCaseText = bullet.text.toLowerCase();
        
        // A bullet is a match if it satisfies at least one of the OR condition groups
        return searchConditionGroups.some(andTerms => {
            // Within a group, the bullet must contain ALL terms
            return andTerms.every(term => lowerCaseText.includes(term));
        });
    });
  }, [query, bullets]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filteredBullets.length;
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (count === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBullets[selectedIndex]) {
        onNavigate(filteredBullets[selectedIndex].id);
      }
    }
  };

  const highlightMatch = (text: string, q: string) => {
      const trimmedQuery = q.trim();
      if (!trimmedQuery || !text) return text;

      // Extract all individual terms for highlighting, removing 'OR'
      const termsToHighlight = trimmedQuery
          .toLowerCase()
          .replace(/\s+or\s+/gi, ' ')
          .split(/\s+/)
          .filter(Boolean);

      const uniqueTerms = [...new Set(termsToHighlight)];
      if (uniqueTerms.length === 0) return text;

      // Create a regex to find all terms
      const regex = new RegExp(`(${uniqueTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      
      const parts = text.split(regex);

      return (
          <span>
              {parts.map((part, i) => {
                  if (part && uniqueTerms.some(term => term === part.toLowerCase())) {
                      return <span key={i} className="bg-yellow-400/40 dark:bg-yellow-600/40 rounded-sm">{part}</span>;
                  }
                  return part;
              })}
          </span>
      );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 z-30 flex justify-center items-start pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 relative text-[var(--main-color)]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-7">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Quick find... (use #tag, AND, OR)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"
          />
        </div>
        <div className="overflow-y-auto">
          {filteredBullets.length > 0 ? (
            <ul ref={listRef}>
              {filteredBullets.map((bullet, index) => (
                <li
                  key={bullet.id}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  className={`cursor-pointer transition-colors duration-75 ${index === selectedIndex ? 'bg-[var(--main-color)] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={() => onNavigate(bullet.id)}
                >
                  <div className="px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/50">
                    <div className={`text-sm font-medium truncate mb-1 ${index === selectedIndex ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                        {highlightMatch(bullet.text, query) || <em>Untitled</em>}
                    </div>
                    <div className={`text-xs flex flex-wrap items-center gap-1 leading-none ${
                        index === selectedIndex ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                        {bullet.path.length > 0 ? (
                            bullet.path.map((segment, i) => (
                                <React.Fragment key={i}>
                                    <span className="truncate max-w-[200px]" title={segment}>{segment}</span>
                                    {i < bullet.path.length - 1 && (
                                        <span className="opacity-50 flex-shrink-0">/</span>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                             <span className="italic opacity-50">Top level</span>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 p-4 text-center">No results found.</p>
          )}
        </div>
      </div>
    </div>
  );
};