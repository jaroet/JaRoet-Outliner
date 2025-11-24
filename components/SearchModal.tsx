

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SearchIcon } from './Icons.tsx';
import { TagPopup } from './TagPopup.tsx';
import type { Bullet, FlatBullet } from '../types.ts';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    bullets: Bullet[];
    onNavigate: (id: string) => void;
    initialQuery?: string;
}

type Tab = 'search' | 'edited' | 'created';

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, bullets, onNavigate, initialQuery }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);
  const tagPopupRef = useRef<HTMLUListElement>(null);

  const [tagPopupState, setTagPopupState] = useState({
    isOpen: false,
    suggestions: [] as string[],
    selectedIndex: 0,
  });

  // Optimization: Only calculate flat list when modal is open
  const flatBullets: FlatBullet[] = useMemo(() => {
      if (!isOpen) return [];
      
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
  }, [bullets, isOpen]);

  const allTags = useMemo(() => {
      if (!isOpen) return [];
      const tagSet = new Set<string>();
      const tagRegex = /#\w+/g;
      for (const bullet of flatBullets) {
          const matches = bullet.text.match(tagRegex);
          if (matches) {
              matches.forEach(tag => tagSet.add(tag));
          }
      }
      return Array.from(tagSet).sort();
  }, [flatBullets, isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      setActiveTab('search');
      handleCloseTagPopup();
    }
  }, [isOpen, initialQuery]);
  
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab]);

  const listContent = useMemo(() => {
    let sourceList: FlatBullet[];
    
    if (activeTab === 'edited') {
        sourceList = [...flatBullets].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (activeTab === 'created') {
        sourceList = [...flatBullets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
        sourceList = flatBullets;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return sourceList;
    }

    const lowerCaseQuery = trimmedQuery.toLowerCase();
    const orClauses = lowerCaseQuery.split(/\s+or\s+/i);
    const searchConditionGroups = orClauses.map(clause => 
        clause.split(/\s+/).filter(term => term)
    );

    return sourceList.filter(bullet => {
        const lowerCaseText = bullet.text.toLowerCase();
        return searchConditionGroups.some(andTerms => {
            return andTerms.every(term => lowerCaseText.includes(term));
        });
    });
  }, [query, flatBullets, activeTab]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleCloseTagPopup = useCallback(() => {
    setTagPopupState(prev => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  const handleTagSelection = useCallback((selectedTag: string) => {
    const input = inputRef.current;
    if (!input) return;

    const text = input.value;
    const cursor = input.selectionStart ?? text.length;

    const textBeforeCursor = text.substring(0, cursor);
    const match = textBeforeCursor.match(/(?:\s|^)#(\w*)$/);

    if (match) {
        const startIndex = match.index + (match[0].startsWith(' ') ? 1 : 0);
        const newText = text.substring(0, startIndex) + selectedTag + ' ' + text.substring(cursor);
        setQuery(newText);
        handleCloseTagPopup();

        setTimeout(() => {
            const newCursorPos = startIndex + selectedTag.length + 1;
            input.focus();
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }
  }, [handleCloseTagPopup]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    setQuery(text);

    if (cursor === null) {
      handleCloseTagPopup();
      return;
    }

    const textBeforeCursor = text.substring(0, cursor);
    const tagMatch = textBeforeCursor.match(/(?:\s|^)#(\w*)$/);
    
    if (tagMatch) {
        const query = tagMatch[1];
        const lowerCaseQuery = query.toLowerCase();
        const suggestions = allTags.filter(tag => tag.toLowerCase().includes(lowerCaseQuery));

        if (suggestions.length > 0) {
            setTagPopupState({
                isOpen: true,
                suggestions: suggestions.slice(0, 100),
                selectedIndex: 0,
            });
        } else {
            handleCloseTagPopup();
        }
    } else {
        handleCloseTagPopup();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (tagPopupState.isOpen && tagPopupState.suggestions.length > 0) {
        let handled = true;
        switch (e.key) {
            case 'ArrowUp':
                setTagPopupState(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex - 1 + prev.suggestions.length) % prev.suggestions.length,
                }));
                break;
            case 'ArrowDown':
                setTagPopupState(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length,
                }));
                break;
            case 'Tab':
                const selectedTag = tagPopupState.suggestions[tagPopupState.selectedIndex];
                handleTagSelection(selectedTag);
                break;
            case 'Escape':
                handleCloseTagPopup();
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            return;
        }
    }

    if (e.ctrlKey) {
        const tabs: Tab[] = ['search', 'edited', 'created'];
        const currentIndex = tabs.indexOf(activeTab);
        let handled = true;

        if (e.key === 'ArrowRight') {
            const nextIndex = (currentIndex + 1) % tabs.length;
            setActiveTab(tabs[nextIndex]);
        } else if (e.key === 'ArrowLeft') {
            const nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            setActiveTab(tabs[nextIndex]);
        } else {
            handled = false;
        }

        if (handled) {
            e.preventDefault();
            return;
        }
    }

    const count = listContent.length;
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (count === 0 && e.key !== 'Enter') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (listContent.length > 0 && listContent[selectedIndex]) {
        onNavigate(listContent[selectedIndex].id);
      }
    }
  };

  const highlightMatch = (text: string, q: string) => {
      const trimmedQuery = q.trim();
      if (!trimmedQuery || !text) return text;
      const termsToHighlight = trimmedQuery.toLowerCase().replace(/\s+or\s+/gi, ' ').split(/\s+/).filter(Boolean);
      const uniqueTerms = [...new Set(termsToHighlight)];
      if (uniqueTerms.length === 0) return text;
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

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: false,
    });
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
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-[var(--main-color)]">
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <SearchIcon />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Quick find... (use #tag, AND, OR)"
                    value={query}
                    onChange={handleQueryChange}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--main-color)]"
                />
                 {tagPopupState.isOpen && inputRef.current && (
                    <TagPopup
                        suggestions={tagPopupState.suggestions}
                        selectedIndex={tagPopupState.selectedIndex}
                        onSelect={handleTagSelection}
                        position={{
                            top: inputRef.current.offsetHeight + 4,
                            left: 0
                        }}
                        containerRef={tagPopupRef}
                    />
                )}
            </div>
            <div className="mt-3 flex border-b border-gray-200 dark:border-gray-700 text-sm">
                {(['search', 'edited', 'created'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 capitalize -mb-px border-b-2 transition-colors ${
                            activeTab === tab 
                                ? 'border-[var(--main-color)] text-[var(--main-color)]' 
                                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab === 'edited' ? 'Recently modified' : (tab === 'created' ? 'Recently created' : 'Search')}
                    </button>
                ))}
            </div>
        </div>

        <div className="overflow-y-auto">
          {listContent.length > 0 ? (
            <ul ref={listRef}>
              {listContent.map((bullet, index) => (
                <li
                  key={bullet.id}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  className={`cursor-pointer transition-colors duration-75 ${index === selectedIndex ? 'selected-item-bg text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={() => onNavigate(bullet.id)}
                >
                  <div className="px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex justify-between items-start gap-4">
                        <div className={`text-sm font-medium truncate mb-1 flex-grow ${index === selectedIndex ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                            {highlightMatch(bullet.text, query) || <em>Untitled</em>}
                        </div>
                        <div className={`text-xs flex-shrink-0 whitespace-nowrap ${index === selectedIndex ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                            {formatDateTime(activeTab === 'created' ? bullet.createdAt : bullet.updatedAt)}
                        </div>
                    </div>
                    <div className={`text-xs flex flex-wrap items-center gap-1 leading-none ${
                        index === selectedIndex ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
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