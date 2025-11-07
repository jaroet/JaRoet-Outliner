import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bullet } from '../types.ts';
import { FlatBullet } from '../App.tsx';
import { ChevronDownIcon, ChevronRightIcon, CircleIcon, NoteIcon, AppointmentIcon } from './Icons.tsx';

interface BulletItemProps {
  bullet: Bullet;
  level: number;
  onUpdate: (id: string, updates: Partial<Bullet>) => void;
  onAddSibling: (id: string) => void;
  onDelete: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onFocusChange: (id: string | null, position?: 'start' | 'end') => void;
  onZoom: (id: string) => void;
  onFocusMove: (direction: 'up' | 'down', position?: 'start' | 'end') => void;
  onFocusParent: (id: string) => void;
  onFocusChild: (id: string) => void;
  onFoldAll: (id: string, collapse: boolean) => void;
  onMoveBullet: (id: string, direction: 'up' | 'down') => void;
  currentFocusId: string | null;
  focusPosition: 'start' | 'end';
  searchQuery: string;
  onLinkClick: (linkText: string) => void;
  onTriggerLinkPopup: (bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (bullet: FlatBullet) => void) => void;
  onCloseLinkPopup: () => void;
  onLinkNavigate: (direction: 'up' | 'down') => void;
  onLinkSelect: (callback: (selected: FlatBullet) => void) => void;
  isLinkPopupOpen: boolean;
  linkPopupTargetId: string | null;
  isJournalRoot: boolean;
}

const BulletItem: React.FC<BulletItemProps> = ({
  bullet,
  level,
  onUpdate,
  onAddSibling,
  onDelete,
  onIndent,
  onOutdent,
  onFocusChange,
  onZoom,
  onFocusMove,
  onFocusParent,
  onFocusChild,
  onFoldAll,
  onMoveBullet,
  currentFocusId,
  focusPosition,
  searchQuery,
  onLinkClick,
  onTriggerLinkPopup,
  onCloseLinkPopup,
  onLinkNavigate,
  onLinkSelect,
  isLinkPopupOpen,
  linkPopupTargetId,
  isJournalRoot,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const isFocused = currentFocusId === bullet.id;
  
  useEffect(() => {
    if (isFocused) {
      setIsEditing(true);
      if (bullet.note) {
        setIsNoteVisible(true);
      }
    } else {
      setIsEditing(false);
      setIsNoteVisible(false);
      onCloseLinkPopup();
    }
  }, [isFocused, bullet.note, onCloseLinkPopup]);

  useEffect(() => {
    if (isEditing && textInputRef.current) {
        textInputRef.current.focus();
        if (focusPosition === 'start') {
            textInputRef.current.setSelectionRange(0, 0);
        } else { // 'end'
            const len = textInputRef.current.value.length;
            textInputRef.current.setSelectionRange(len, len);
        }
    }
  }, [isEditing, focusPosition]);
    
  useEffect(() => {
    if (isEditing && textInputRef.current) {
      textInputRef.current.style.height = 'auto';
      textInputRef.current.style.height = `${textInputRef.current.scrollHeight}px`;
    }
  }, [isEditing, bullet.text]);

  const hasChildren = bullet.children.length > 0;

  const handleLinkSelection = useCallback((selectedBullet: { text: string }) => {
    const input = textInputRef.current;
    if (!input) return;

    const text = input.value;
    const cursor = input.selectionStart ?? text.length;
    
    const textBeforeCursor = text.substring(0, cursor);
    const lastOpen = textBeforeCursor.lastIndexOf('[[');

    if (lastOpen !== -1) {
        const newText = text.substring(0, lastOpen) + `[[${selectedBullet.text}]]` + text.substring(cursor);
        onUpdate(bullet.id, { text: newText });
        onCloseLinkPopup();

        setTimeout(() => {
            const newCursorPos = (text.substring(0, lastOpen) + `[[${selectedBullet.text}]]`).length;
            input.focus();
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }
  }, [bullet.id, onUpdate, onCloseLinkPopup]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    onUpdate(bullet.id, { text });

    const textBeforeCursor = text.substring(0, cursor ?? 0);
    const lastOpen = textBeforeCursor.lastIndexOf('[[');
    if (lastOpen !== -1) {
      const lastClose = textBeforeCursor.lastIndexOf(']]');
      if (lastClose < lastOpen) {
        const query = textBeforeCursor.substring(lastOpen + 2);
        onTriggerLinkPopup(bullet.id, query, textInputRef, handleLinkSelection);
        return;
      }
    }
    onCloseLinkPopup();
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const input = e.target as HTMLTextAreaElement;
    const isPopupActive = isLinkPopupOpen && linkPopupTargetId === bullet.id;

    if (isPopupActive) {
        let handled = true;
        switch (e.key) {
            case 'ArrowUp':
                onLinkNavigate('up');
                break;
            case 'ArrowDown':
                onLinkNavigate('down');
                break;
            case 'Enter':
                onLinkSelect(handleLinkSelection);
                break;
            case 'Escape': {
                onCloseLinkPopup();
                
                const input = textInputRef.current;
                if (input) {
                    const text = input.value;
                    const cursor = input.selectionStart ?? text.length;

                    const textBeforeCursor = text.substring(0, cursor);
                    const lastOpen = textBeforeCursor.lastIndexOf('[[');
                    if (lastOpen !== -1) {
                        const lastClose = textBeforeCursor.lastIndexOf(']]');
                        if (lastClose < lastOpen) {
                            let textAfterCursor = text.substring(cursor);
                            if (textAfterCursor.startsWith(']]')) {
                                textAfterCursor = textAfterCursor.substring(2);
                            }
                            const newText = text.substring(0, lastOpen) + textAfterCursor;
                            const newCursorPos = lastOpen;
                            onUpdate(bullet.id, { text: newText });

                            setTimeout(() => {
                                if(textInputRef.current) {
                                    textInputRef.current.focus();
                                    textInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                                }
                            }, 0);
                        }
                    }
                }
                break;
            }
            case 'Tab':
                onCloseLinkPopup();
                handled = false; // Allow tab to proceed
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            return;
        }
    }

    if (e.altKey) {
        let handled = true;
        switch (e.key) {
            case 'ArrowUp':
                onMoveBullet(bullet.id, 'up');
                break;
            case 'ArrowDown':
                onMoveBullet(bullet.id, 'down');
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            return;
        }
    }

    if (e.ctrlKey && e.shiftKey) {
        let handled = true;
        switch(e.key) {
            case 'ArrowLeft':
                onFoldAll(bullet.id, true);
                break;
            case 'ArrowRight':
                onFoldAll(bullet.id, false);
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
        let handled = true;
        switch (e.key) {
            case 'ArrowLeft': {
                if (hasChildren && !bullet.isCollapsed) {
                    onUpdate(bullet.id, { isCollapsed: true });
                } else if (level > 0) {
                    onFocusParent(bullet.id);
                }
                break;
            }
            case 'ArrowRight':
                if (hasChildren) onUpdate(bullet.id, { isCollapsed: false });
                break;
            case 'ArrowDown':
                onZoom(bullet.id);
                break;
            default:
                handled = false; // Not a shortcut we handle, let default behavior occur
                break;
        }

        if (handled) {
            e.preventDefault();
            return;
        }
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey) {
            setIsNoteVisible(true);
            setTimeout(() => noteInputRef.current?.focus(), 0);
        } else {
            onAddSibling(bullet.id);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) onOutdent(bullet.id);
        else onIndent(bullet.id);
        break;
      case 'Backspace':
        if (bullet.text === '') {
          e.preventDefault();
          onDelete(bullet.id);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        onFocusMove('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        onFocusMove('down');
        break;
      case 'ArrowLeft':
        if (input.selectionStart === 0) {
            e.preventDefault();
            onFocusParent(bullet.id);
        }
        break;
      case 'ArrowRight':
        if (input.selectionStart === input.value.length) {
            e.preventDefault();
            onFocusMove('down', 'start');
        }
        break;
    }
  };

  const handleNoteBlur = () => {
    if (bullet.note.trim() === '') {
      if (bullet.note !== '') {
        onUpdate(bullet.id, { note: '' });
      }
      setIsNoteVisible(false);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.target as HTMLTextAreaElement;
      if (e.key === 'ArrowUp' && textarea.selectionStart === 0) {
          e.preventDefault();
          setIsNoteVisible(false);
          textInputRef.current?.focus();
      }
      if (e.key === 'ArrowDown' && textarea.selectionStart === textarea.value.length) {
        e.preventDefault();
        onFocusMove('down');
      }
  }

  const toggleCollapse = () => {
    if (hasChildren) {
      onUpdate(bullet.id, { isCollapsed: !bullet.isCollapsed });
    }
  };

  const matchesSearch = (b: Bullet, q: string): boolean => {
      if (!q) return true;
      const query = q.toLowerCase();
      const textMatch = b.text.toLowerCase().includes(query);
      const noteMatch = b.note?.toLowerCase().includes(query);
      const childrenMatch = b.children.some(child => matchesSearch(child, q));
      return textMatch || noteMatch || childrenMatch;
  };
  
  const renderTextWithHighlightAndLinks = (text: string, highlight: string) => {
    const linkRegex = /\[\[(.*?)\]\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
  
    while ((match = linkRegex.exec(text)) !== null) {
      // Text before the link
      if (match.index > lastIndex) {
        parts.push(highlightText(text.substring(lastIndex, match.index), highlight));
      }
      // The link itself
      const linkText = match[1];
      parts.push(
        <button
          key={match.index}
          onClick={() => onLinkClick(linkText)}
          className="bg-[var(--main-color)]/20 hover:bg-[var(--main-color)]/30 text-[var(--main-color)] rounded-sm px-1 py-0 mx-px transition-colors"
        >
          {highlightText(linkText, highlight)}
        </button>
      );
      lastIndex = match.index + match[0].length;
    }
  
    // Text after the last link
    if (lastIndex < text.length) {
      parts.push(highlightText(text.substring(lastIndex), highlight));
    }
  
    return parts;
  };

  if (searchQuery && !matchesSearch(bullet, searchQuery)) {
      return null;
  }
  
  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="bg-yellow-500/50 text-white rounded-sm">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };
  
  const circleColor = bullet.note ? 'var(--note-color)' : 'var(--main-color)';

  return (
    <div className="flex flex-col group">
        <div className={`flex items-start py-1 relative ${isFocused ? 'bg-gray-800/[.6] rounded' : ''}`}>
            <div
                style={{ marginLeft: `${level * 1.5}rem` }}
                className="flex-shrink-0 flex items-center h-6 text-[var(--main-color)]"
            >
                <button
                    onClick={toggleCollapse}
                    className={`transition-opacity duration-150 text-gray-500 hover:text-gray-300 ${hasChildren ? 'opacity-100 cursor-pointer' : 'opacity-0 cursor-default'}`}
                >
                    {bullet.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </button>
                <button onClick={() => onZoom(bullet.id)} className="ml-1 w-6 h-6 flex items-center justify-center transition-colors">
                    {isJournalRoot ? <AppointmentIcon className="w-4 h-4" /> : <CircleIcon className="w-2 h-2" color={circleColor} />}
                </button>
            </div>
            <div className="flex-grow ml-2">
                <div className="flex items-center">
                    <div className="flex-grow">
                        {isEditing ? (
                            <textarea
                                ref={textInputRef}
                                value={bullet.text}
                                onChange={handleTextChange}
                                onKeyDown={handleTextKeyDown}
                                className="w-full bg-transparent outline-none text-gray-200 resize-none overflow-hidden leading-6"
                                rows={1}
                            />
                        ) : (
                            <div onClick={() => onFocusChange(bullet.id)} className="w-full cursor-text min-h-[1.5rem] leading-6">
                            {bullet.text ? renderTextWithHighlightAndLinks(bullet.text, searchQuery) : <span className="text-gray-500">...</span>}
                            </div>
                        )}
                    </div>
                </div>
                {isNoteVisible && (
                    <textarea
                        ref={noteInputRef}
                        value={bullet.note}
                        onChange={(e) => onUpdate(bullet.id, { note: e.target.value })}
                        onKeyDown={handleNoteKeyDown}
                        onBlur={handleNoteBlur}
                        className="w-full text-sm bg-gray-800 text-gray-400 outline-none p-1 rounded-sm mt-1 resize-y"
                        placeholder="Add a note..."
                        rows={3}
                    />
                )}
            </div>
        </div>
      {!bullet.isCollapsed && hasChildren && (
        <div className="border-l border-gray-700/50">
          {bullet.children.map((child) => (
            <BulletItem
                key={child.id}
                bullet={child}
                level={level + 1}
                onUpdate={onUpdate}
                onAddSibling={onAddSibling}
                onDelete={onDelete}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onFocusChange={onFocusChange}
                onZoom={onZoom}
                onFocusMove={onFocusMove}
                onFocusParent={onFocusParent}
                onFocusChild={onFocusChild}
                onFoldAll={onFoldAll}
                onMoveBullet={onMoveBullet}
                currentFocusId={currentFocusId}
                focusPosition={focusPosition}
                searchQuery={searchQuery}
                onLinkClick={onLinkClick}
                onTriggerLinkPopup={onTriggerLinkPopup}
                onCloseLinkPopup={onCloseLinkPopup}
                onLinkNavigate={onLinkNavigate}
                onLinkSelect={onLinkSelect}
                isLinkPopupOpen={isLinkPopupOpen}
                linkPopupTargetId={linkPopupTargetId}
                isJournalRoot={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BulletItem;