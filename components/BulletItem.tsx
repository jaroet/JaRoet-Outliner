import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronRightIcon, ChevronDownIcon, CircleIcon, AppointmentIcon } from './Icons';
import type { Bullet } from '../types';

// --- Helper Functions for Rich Text Rendering ---

/**
 * A helper to wrap matched search query terms in a highlighting span.
 */
const highlightText = (text: string, highlight?: string) => {
    if (!text) return text;
    const regex = highlight ? new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
    const parts = highlight ? text.split(regex) : [text];
    
    return (
      <React.Fragment>
        {parts.map((part, i) => {
            if (!part) return null;
            const lines = part.split('\n');
            const partWithBreaks = lines.map((line, j) => (
                <React.Fragment key={j}>
                    {line}
                    {j < lines.length - 1 && <br />}
                </React.Fragment>
            ));

            if (highlight && part.toLowerCase() === highlight.toLowerCase()) {
                return (
                    <span key={i} className="bg-yellow-300/80 dark:bg-yellow-500/50 text-black dark:text-white rounded-sm">
                        {partWithBreaks}
                    </span>
                );
            }
            return <React.Fragment key={i}>{partWithBreaks}</React.Fragment>;
        })}
      </React.Fragment>
    );
};

/**
 * A centralized function to render text with rich formatting (tags, links, etc.).
 * It can be configured to render a full or simplified version.
 */
const renderRichTextContent = (
    text: string, 
    highlight: string | undefined, 
    onLinkClick: (linkText: string) => void,
    options: { renderTagsOnly?: boolean } = {}
): React.ReactNode => {
    const { renderTagsOnly = false } = options;
    if (!text) return null;

    if (renderTagsOnly) {
        const tagRegex = /(#\w+)/g;
        const parts = text.split(tagRegex);
        return (
            <React.Fragment>
                {parts.map((part, index) => {
                    if (part.startsWith('#') && /#\w+/.test(part)) {
                        return (
                            <span key={index} className="bg-teal-400/20 text-teal-300 rounded-md px-1 py-0.5 mx-px text-sm">
                                {part}
                            </span>
                        );
                    }
                    return <span key={index}>{part}</span>;
                })}
            </React.Fragment>
        );
    }
    
    const combinedRegex = /(#\w+|\[\[.*?\]\]|\[[^\]]+?\]\([^)]+?\)|\b(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*|\bwww\.[^\s/$.?#].[^\s]*|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const parts = text.split(combinedRegex);
    
    return (
      <React.Fragment>
        {parts.map((part, index) => {
            if (!part) return null;
            
            if (part.startsWith('#') && /#\w+/.test(part)) {
                return (
                    <span key={index} className="bg-teal-400/20 text-teal-300 rounded-md px-1 py-0.5 mx-px text-sm">
                         {highlightText(part, highlight)}
                    </span>
                );
            }

            if (part.startsWith('[[') && part.endsWith(']]')) {
                const linkText = part.slice(2, -2);
                return (
                    <button key={index} onClick={() => onLinkClick(linkText)} className="bg-[var(--main-color)]/20 hover:bg-[var(--main-color)]/30 text-[var(--main-color)] rounded-sm px-1 py-0 mx-px transition-colors" title={`Go to: ${linkText}`}>
                        {highlightText(linkText, highlight)}
                    </button>
                );
            }
            
            const mdLinkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (mdLinkMatch) {
                const [, text, url] = mdLinkMatch;
                let href = url.trim();
                if (!/^(https?|ftp|mailto):/i.test(href)) {
                   href = `https://${href}`;
                }
                return (
                    <a key={index} href={href} target="_blank" rel="noopener noreferrer" title={`Opens: ${href}`} className="text-[var(--main-color)] underline decoration-dotted hover:decoration-solid">
                       {highlightText(text, highlight)}
                    </a>
                );
            }

            if (/^(https?|ftp):\/\//.test(part) || part.startsWith('www.')) {
                const href = part.startsWith('www.') ? `https://${part}` : part;
                return (
                    <a key={index} href={href} target="_blank" rel="noopener noreferrer" title={`Opens: ${href}`} className="text-[var(--main-color)] underline decoration-dotted hover:decoration-solid">
                        {highlightText(part, highlight)}
                    </a>
                );
            }

            if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part)) {
                return (
                    <a key={index} href={`mailto:${part}`} title={`Email: ${part}`} className="text-[var(--main-color)] underline decoration-dotted hover:decoration-solid">
                        {highlightText(part, highlight)}
                    </a>
                );
            }

            return highlightText(part, highlight);
        })}
      </React.Fragment>
    );
};


interface BulletItemProps {
    bullet: Bullet;
    level: number;
    onUpdate: (id: string, updates: Partial<Bullet>) => void;
    onAddSibling: (id: string, text?: string) => void;
    onDelete: (id: string) => void;
    onIndent: (id: string) => void;
    onOutdent: (id: string) => void;
    onFocusChange: (id: string, position?: 'start' | 'end') => void;
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
    onTriggerLinkPopup: (bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedBullet: any) => void) => void;
    onCloseLinkPopup: () => void;
    onLinkNavigate: (direction: 'up' | 'down') => void;
    onLinkSelect: (callback: (selectedBullet: any) => void) => void;
    isLinkPopupOpen: boolean;
    linkPopupTargetId: string | null;
    onTriggerTagPopup: (bulletId: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, selectionHandler: (selectedTag: string) => void) => void;
    onCloseTagPopup: () => void;
    onTagNavigate: (direction: 'up' | 'down') => void;
    onTagSelect: (callback: (selectedTag: string) => void) => void;
    isTagPopupOpen: boolean;
    tagPopupTargetId: string | null;
    isJournalRoot: boolean;
    onNavigateTo: (id: string) => void;
}

export const BulletItem: React.FC<BulletItemProps> = ({
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
  onTriggerTagPopup,
  onCloseTagPopup,
  onTagNavigate,
  onTagSelect,
  isTagPopupOpen,
  tagPopupTargetId,
  isJournalRoot,
  onNavigateTo,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const isFocused = currentFocusId === bullet.id;
  
  useEffect(() => {
    if (isFocused) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
      onCloseLinkPopup();
      onCloseTagPopup();
    }
  }, [isFocused, onCloseLinkPopup, onCloseTagPopup]);

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

  const handleLinkSelection = useCallback((selectedBullet: any) => {
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
  
  const handleTagSelection = useCallback((selectedTag: string) => {
    const input = textInputRef.current;
    if (!input) return;

    const text = input.value;
    const cursor = input.selectionStart ?? text.length;
    
    const textBeforeCursor = text.substring(0, cursor);
    const match = textBeforeCursor.match(/(?:\s|^)#(\w*)$/);

    if (match) {
        const startIndex = match.index + (match[0].startsWith(' ') ? 1 : 0);
        const newText = text.substring(0, startIndex) + selectedTag + ' ' + text.substring(cursor);
        onUpdate(bullet.id, { text: newText });
        onCloseTagPopup();

        setTimeout(() => {
            const newCursorPos = startIndex + selectedTag.length + 1; // +1 for the space
            input.focus();
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }
  }, [bullet.id, onUpdate, onCloseTagPopup]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    onUpdate(bullet.id, { text });

    const textBeforeCursor = text.substring(0, cursor ?? 0);
    
    const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');
    if (lastOpenBracket !== -1 && textBeforeCursor.lastIndexOf(']]') < lastOpenBracket) {
      const query = textBeforeCursor.substring(lastOpenBracket + 2);
      onTriggerLinkPopup(bullet.id, query, textInputRef, handleLinkSelection);
      return;
    }

    const tagMatch = textBeforeCursor.match(/(?:\s|^)#(\w*)$/);
    if (tagMatch) {
        const query = tagMatch[1];
        onTriggerTagPopup(bullet.id, query, textInputRef, handleTagSelection);
        return;
    }

    onCloseLinkPopup();
    onCloseTagPopup();
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const input = e.target as HTMLTextAreaElement;
    const isPopupActive = isLinkPopupOpen && linkPopupTargetId === bullet.id;
    const isTagPopupActive = isTagPopupOpen && tagPopupTargetId === bullet.id;
    
    if (bullet.isReadOnly) {
        let handled = true;
        if (e.ctrlKey) {
            switch (e.key) {
                case 'ArrowLeft':
                    if (hasChildren && !bullet.isCollapsed) onUpdate(bullet.id, { isCollapsed: true });
                    else if (level > 0) onFocusParent(bullet.id);
                    break;
                case 'ArrowRight':
                    if (hasChildren && bullet.isCollapsed) onUpdate(bullet.id, { isCollapsed: false });
                    break;
                case 'ArrowDown':
                    onZoom(bullet.id);
                    break;
                default:
                    handled = false;
            }
        } else {
            switch(e.key) {
                case 'Enter':
                    if (bullet.originalId) {
                        onNavigateTo(bullet.originalId);
                    } else if (hasChildren) {
                        onUpdate(bullet.id, { isCollapsed: !bullet.isCollapsed });
                    }
                    break;
                case 'ArrowUp': onFocusMove('up'); break;
                case 'ArrowDown': onFocusMove('down'); break;
                case 'ArrowLeft': onFocusParent(bullet.id); break;
                case 'ArrowRight': 
                    if(hasChildren && !bullet.isCollapsed) onFocusChild(bullet.id);
                    else onFocusMove('down', 'start'); 
                    break;
                default: handled = false;
            }
        }

        if (handled) {
            e.preventDefault();
        }
        return;
    }

    if (isTagPopupActive) {
        let handled = true;
        switch (e.key) {
            case 'ArrowUp': onTagNavigate('up'); break;
            case 'ArrowDown': onTagNavigate('down'); break;
            case 'Tab': onTagSelect(handleTagSelection); break;
            case 'Escape': onCloseTagPopup(); break;
            default: handled = false;
        }
        if (handled) { e.preventDefault(); return; }
    }

    if (isPopupActive) {
        let handled = true;
        switch (e.key) {
            case 'ArrowUp': onLinkNavigate('up'); break;
            case 'ArrowDown': onLinkNavigate('down'); break;
            case 'Enter': onLinkSelect(handleLinkSelection); break;
            case 'Tab': onLinkSelect(handleLinkSelection); break;
            case 'Escape': {
                onCloseLinkPopup();
                const text = input.value;
                const cursor = input.selectionStart ?? text.length;
                const textBeforeCursor = text.substring(0, cursor);
                const lastOpen = textBeforeCursor.lastIndexOf('[[');
                if (lastOpen !== -1 && textBeforeCursor.lastIndexOf(']]') < lastOpen) {
                    const newText = text.substring(0, lastOpen) + text.substring(cursor);
                    onUpdate(bullet.id, { text: newText });
                    setTimeout(() => {
                        if(textInputRef.current) {
                            textInputRef.current.focus();
                            textInputRef.current.setSelectionRange(lastOpen, lastOpen);
                        }
                    }, 0);
                }
                break;
            }
            default: handled = false;
        }
        if (handled) { e.preventDefault(); return; }
    }

    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        const selectedText = text.substring(start, end);

        let newText;
        let newCursorPosStart;
        let newCursorPosEnd;

        if (selectedText) {
            newText = `${text.substring(0, start)}[${selectedText}]()${text.substring(end)}`;
            newCursorPosStart = newCursorPosEnd = start + selectedText.length + 3;
        } else {
            newText = `${text.substring(0, start)}[link text]()${text.substring(end)}`;
            newCursorPosStart = start + 1;
            newCursorPosEnd = start + 1 + 'link text'.length;
        }

        onUpdate(bullet.id, { text: newText });

        setTimeout(() => {
            if (textInputRef.current) {
                textInputRef.current.focus();
                textInputRef.current.setSelectionRange(newCursorPosStart, newCursorPosEnd);
            }
        }, 0);
        return;
    }


    if (e.altKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); onMoveBullet(bullet.id, 'up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); onMoveBullet(bullet.id, 'down'); return; }
    }

    if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onFoldAll(bullet.id, true); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); onFoldAll(bullet.id, false); return; }
    }

    if (e.ctrlKey) {
        let handled = true;
        switch (e.key) {
            case 'ArrowLeft':
                if (hasChildren && !bullet.isCollapsed) onUpdate(bullet.id, { isCollapsed: true });
                else if (level > 0) onFocusParent(bullet.id);
                break;
            case 'ArrowRight':
                if (hasChildren && bullet.isCollapsed) onUpdate(bullet.id, { isCollapsed: false });
                else if (hasChildren && !bullet.isCollapsed) onFocusChild(bullet.id);
                break;
            case 'ArrowDown': onZoom(bullet.id); break;
            default: handled = false;
        }
        if (handled) { e.preventDefault(); return; }
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey) {
            const { value, selectionStart, selectionEnd } = input;
            const newValue = value.substring(0, selectionStart) + '\n' + value.substring(selectionEnd);
            onUpdate(bullet.id, { text: newValue });

            setTimeout(() => {
                if (textInputRef.current) {
                    const newCursorPos = selectionStart + 1;
                    textInputRef.current.focus();
                    textInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        } else {
            const { value, selectionStart } = input;
            const textBeforeCursor = value.substring(0, selectionStart);
            const textAfterCursor = value.substring(selectionStart);
            
            onUpdate(bullet.id, { text: textBeforeCursor });
            onAddSibling(bullet.id, textAfterCursor);
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
      case 'ArrowUp': e.preventDefault(); onFocusMove('up'); break;
      case 'ArrowDown': e.preventDefault(); onFocusMove('down'); break;
      case 'ArrowLeft':
        if (input.selectionStart === 0) { e.preventDefault(); onFocusParent(bullet.id); }
        break;
      case 'ArrowRight':
        if (input.selectionStart === input.value.length) { e.preventDefault(); onFocusMove('down', 'start'); }
        break;
    }
  };

  const toggleCollapse = () => {
    if (hasChildren) {
      onUpdate(bullet.id, { isCollapsed: !bullet.isCollapsed });
    }
  };

  const matchesSearch = (b: Bullet, q: string): boolean => {
      if (!q) return true;
      const query = q.toLowerCase();
      const textMatch = b.text.toLowerCase().includes(query);
      const childrenMatch = b.children.some(child => matchesSearch(child, q));
      return textMatch || childrenMatch;
  };

  const renderedRichText = useMemo(() => {
    return renderRichTextContent(bullet.text, searchQuery, onLinkClick);
  }, [bullet.text, searchQuery, onLinkClick]);
  
  const renderedRichTextSimple = useMemo(() => {
    return renderRichTextContent(bullet.text, undefined, () => {}, { renderTagsOnly: true });
  }, [bullet.text]);

  if (searchQuery && !matchesSearch(bullet, searchQuery)) {
      return null;
  }

  const circleColor = 'var(--main-color)';
  
  const handleTextClick = () => {
    if (bullet.isReadOnly) {
        if (bullet.originalId) {
            onNavigateTo(bullet.originalId);
        } else {
            onFocusChange(bullet.id);
        }
    } else {
        onFocusChange(bullet.id);
    }
  };

  const renderBulletIcon = () => {
    if (isJournalRoot) return <AppointmentIcon className="w-4 h-4" />;
    return <CircleIcon className="w-2 h-2" color={circleColor} />;
  }

  return (
    <div className="flex flex-col group">
        <div className={`flex items-start py-1 relative ${isFocused ? 'bg-blue-100 dark:bg-gray-800/[.6] rounded' : ''}`}>
            <div
                style={{ marginLeft: `${level * 1.5}rem` }}
                className="flex-shrink-0 flex items-center h-6 text-[var(--main-color)]"
            >
                <button
                    onClick={toggleCollapse}
                    className={`transition-opacity duration-150 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ${hasChildren ? 'opacity-100 cursor-pointer' : 'opacity-0 cursor-default'}`}
                    aria-label={bullet.isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {bullet.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </button>
                <button onClick={() => onZoom(bullet.id)} className="ml-1 w-6 h-6 flex items-center justify-center transition-colors" aria-label="Zoom in">
                    {renderBulletIcon()}
                </button>
            </div>
            <div className="flex-grow ml-2">
                <div className="flex items-center">
                    <div className="flex-grow">
                        {isEditing ? (
                            <div className="relative">
                                <div
                                    className="absolute top-0 left-0 w-full h-full pointer-events-none leading-6 whitespace-pre-wrap break-words"
                                    aria-hidden="true"
                                >
                                    {renderedRichTextSimple}
                                </div>
                                <textarea
                                    ref={textInputRef}
                                    value={bullet.text}
                                    onChange={handleTextChange}
                                    onKeyDown={handleTextKeyDown}
                                    readOnly={bullet.isReadOnly}
                                    className="w-full bg-transparent outline-none text-transparent caret-gray-800 dark:caret-gray-200 resize-none overflow-hidden leading-6"
                                    rows={1}
                                    aria-label="Edit item"
                                />
                            </div>
                        ) : (
                            <div onClick={handleTextClick} className={`w-full min-h-[1.5rem] leading-6 break-words ${bullet.isReadOnly ? 'cursor-text' : ''}`}>
                            {bullet.text ? renderedRichText : <span className="text-gray-400 dark:text-gray-500">...</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      {!bullet.isCollapsed && hasChildren && (
        <div className="border-l border-gray-300 dark:border-gray-700/50">
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
                onTriggerTagPopup={onTriggerTagPopup}
                onCloseTagPopup={onCloseTagPopup}
                onTagNavigate={onTagNavigate}
                onTagSelect={onTagSelect}
                isTagPopupOpen={isTagPopupOpen}
                tagPopupTargetId={tagPopupTargetId}
                isJournalRoot={false}
                onNavigateTo={onNavigateTo}
            />
          ))}
        </div>
      )}
    </div>
  );
};
