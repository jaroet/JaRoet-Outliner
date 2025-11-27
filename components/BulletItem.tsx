
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronRightIcon, ChevronDownIcon, CircleIcon, AppointmentIcon } from './Icons.tsx';
import type { Bullet } from '../types.ts';

// --- Helper Functions for Rich Text Rendering ---

// Helper to render [[Links]] and #tags
const renderLinksAndTags = (text: string) => {
     // Split by tags or wikilinks
     const parts = text.split(/(\[\[.*?\]\]|#\w+)/g);
     return parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
             return <span key={i} className="text-[var(--main-color)] opacity-80 cursor-pointer hover:underline">{part}</span>;
        }
        if (part.startsWith('#')) {
             return <span key={i} className="text-[var(--main-color)] opacity-80 cursor-pointer hover:underline">{part}</span>;
        }
        
        // Handle newlines
        const lines = part.split('\n');
        return lines.map((line, j) => (
            <React.Fragment key={`${i}-${j}`}>
                {line}
                {j < lines.length - 1 && <br />}
            </React.Fragment>
        ));
     });
};

/**
 * A helper to wrap matched search query terms in a highlighting span.
 */
const highlightText = (text: string, highlight?: string) => {
    if (!text) return text;
    
    const parts = highlight ? text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')) : [text];
    
    return (
      <React.Fragment>
        {parts.map((part, i) => {
            if (!part) return null;

            if (highlight && part.toLowerCase() === highlight.toLowerCase()) {
                const lines = part.split('\n');
                const partWithBreaks = lines.map((line, j) => (
                    <React.Fragment key={j}>
                        {line}
                        {j < lines.length - 1 && <br />}
                    </React.Fragment>
                ));
                return (
                    <span key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-white rounded-sm">
                        {partWithBreaks}
                    </span>
                );
            }
            
            // Render links/tags in non-highlighted parts
            return <React.Fragment key={i}>{renderLinksAndTags(part)}</React.Fragment>;
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
  onFocusChange: (id: string | null, position?: 'start' | 'end' | number, mode?: 'view' | 'edit') => void;
  onZoom: (id: string | null) => void;
  onFocusMove: (direction: 'up' | 'down', position?: 'start' | 'end', mode?: 'view' | 'edit') => void;
  onFocusParent: (id: string) => void;
  onFocusChild: (id: string) => void;
  onFoldAll: (id: string, collapse: boolean, recursive?: boolean) => void;
  onMoveBullet: (id: string, direction: 'up' | 'down') => void;
  currentFocusId: string | null;
  focusPosition: 'start' | 'end' | number;
  focusMode: 'view' | 'edit';
  searchQuery: string;
  onLinkClick: (text: string) => void;
  onTriggerLinkPopup: (id: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, handler: any) => void;
  onCloseLinkPopup: () => void;
  onLinkNavigate: (direction: 'up' | 'down') => void;
  onLinkSelect: (callback: (b: any) => void) => void;
  isLinkPopupOpen: boolean;
  linkPopupTargetId: string | null;
  onTriggerTagPopup: (id: string, query: string, inputRef: React.RefObject<HTMLTextAreaElement>, handler: any) => void;
  onCloseTagPopup: () => void;
  onTagNavigate: (direction: 'up' | 'down') => void;
  onTagSelect: (callback: (t: string) => void) => void;
  isTagPopupOpen: boolean;
  tagPopupTargetId: string | null;
  isJournalRoot: boolean;
  onNavigateTo: (id: string) => void;
  onMerge: (id: string) => void;
}

export const BulletItem: React.FC<BulletItemProps> = React.memo((props) => {
    const {
        bullet, level, onUpdate, onAddSibling, onDelete, onIndent, onOutdent,
        onFocusChange, onZoom, onFocusMove, onFocusParent, onFocusChild, onFoldAll, onMoveBullet,
        currentFocusId, focusPosition, focusMode, searchQuery,
        onTriggerLinkPopup, onCloseLinkPopup, onLinkNavigate, onLinkSelect, isLinkPopupOpen, linkPopupTargetId,
        onTriggerTagPopup, onCloseTagPopup, onTagNavigate, onTagSelect, isTagPopupOpen, tagPopupTargetId,
        onLinkClick, onMerge
    } = props;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const viewRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isFocused = currentFocusId === bullet.id;
    const isEditing = isFocused && focusMode === 'edit';

    // Auto-resize textarea
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing, bullet.text]);

    // Handle Focus
    useEffect(() => {
        if (isFocused) {
            if (isEditing && textareaRef.current) {
                textareaRef.current.focus();
                if (typeof focusPosition === 'number') {
                    textareaRef.current.setSelectionRange(focusPosition, focusPosition);
                } else if (focusPosition === 'start') {
                    textareaRef.current.setSelectionRange(0, 0);
                } else if (focusPosition === 'end') {
                    const len = textareaRef.current.value.length;
                    textareaRef.current.setSelectionRange(len, len);
                }
                // Scroll into view if needed
                textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (!isEditing && viewRef.current) {
                // Ensure focus on the view element when in view mode
                requestAnimationFrame(() => {
                    viewRef.current?.focus();
                });
            }
        }
    }, [isFocused, isEditing, focusPosition]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Popup Navigation
        if ((isLinkPopupOpen && linkPopupTargetId === bullet.id) || (isTagPopupOpen && tagPopupTargetId === bullet.id)) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if(isLinkPopupOpen) onLinkNavigate('up');
                else onTagNavigate('up');
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if(isLinkPopupOpen) onLinkNavigate('down');
                else onTagNavigate('down');
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if(isLinkPopupOpen) {
                     onLinkSelect((selected: any) => {
                         insertTextAtCursor(`[[${selected.text}]]`);
                         onCloseLinkPopup();
                     });
                } else {
                     onTagSelect((selected: string) => {
                         insertTextAtCursor(selected + ' '); // Add space after tag
                         onCloseTagPopup();
                     });
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseLinkPopup();
                onCloseTagPopup();
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onAddSibling(bullet.id);
        } else if (e.key === 'Backspace' && bullet.text === '' && !bullet.children.length) {
            e.preventDefault();
            onDelete(bullet.id);
        } else if (e.key === 'Backspace' && textareaRef.current?.selectionStart === 0 && textareaRef.current?.selectionEnd === 0) {
            e.preventDefault();
            onMerge(bullet.id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                onOutdent(bullet.id);
            } else {
                onIndent(bullet.id);
            }
        } else if (e.key === 'ArrowUp') {
            if (e.ctrlKey) {
                e.preventDefault();
                onMoveBullet(bullet.id, 'up');
            } 
            // Default behavior: move cursor up within the textarea
        } else if (e.key === 'ArrowDown') {
            if (e.ctrlKey) {
                 e.preventDefault();
                 onMoveBullet(bullet.id, 'down');
            } 
            // Default behavior: move cursor down within the textarea
        } else if (e.key === 'Escape') {
             e.preventDefault();
             onFocusChange(bullet.id, undefined, 'view');
        }
    };

    const handleViewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
         if (bullet.isReadOnly) return;
         
         if (e.key === 'Enter') {
             e.preventDefault();
             onFocusChange(bullet.id, 'end', 'edit');
             return;
         }
         
         if (e.key === 'ArrowUp') {
             if (e.altKey) {
                 e.preventDefault();
                 onMoveBullet(bullet.id, 'up');
             } else if (e.ctrlKey || e.metaKey) {
                 // Allow bubbling to handle global Zoom Out
                 return;
             } else {
                 e.preventDefault();
                 onFocusMove('up', undefined, 'view');
             }
             return;
         }
         
         if (e.key === 'ArrowDown') {
             if (e.altKey) {
                 e.preventDefault();
                 onMoveBullet(bullet.id, 'down');
             } else if (e.ctrlKey || e.metaKey) {
                 e.preventDefault();
                 onZoom(bullet.id);
             } else {
                 e.preventDefault();
                 onFocusMove('down', undefined, 'view');
             }
             return;
         }

         if (e.key === 'ArrowLeft') {
             e.preventDefault();
             if (e.ctrlKey || e.metaKey) {
                 // Ctrl+Left: Recursively fold bullet and all sub bullets
                 onFoldAll(bullet.id, true, true);
             } else {
                 // Left Arrow:
                 // 1. If has children AND is expanded -> Collapse (Fold)
                 // 2. Otherwise -> Select parent
                 if (bullet.children.length > 0 && !bullet.isCollapsed) {
                     onUpdate(bullet.id, { isCollapsed: true });
                 } else {
                     onFocusParent(bullet.id);
                 }
             }
             return;
         }

         if (e.key === 'ArrowRight') {
             e.preventDefault();
             if (e.ctrlKey || e.metaKey) {
                 // Ctrl+Right: Recursively unfold bullet and all sub bullets
                 onFoldAll(bullet.id, false, true);
             } else {
                 // Right Arrow:
                 // 1. If has children AND is collapsed -> Expand (Unfold)
                 // 2. Otherwise (expanded or no children) -> Select first child (if exists)
                 if (bullet.children.length > 0 && bullet.isCollapsed) {
                     onUpdate(bullet.id, { isCollapsed: false });
                 } else {
                     onFocusChild(bullet.id);
                 }
             }
             return;
         }
         
         // Backspace: Delete selected bullet and all sub-bullets
         if (e.key === 'Backspace') {
             e.preventDefault();
             onDelete(bullet.id);
         }
    };

    const insertTextAtCursor = (textToInsert: string) => {
        if (!textareaRef.current) return;
        const input = textareaRef.current;
        const text = input.value;
        const cursor = input.selectionStart;
        
        const textBefore = text.substring(0, cursor);
        const linkMatch = textBefore.match(/\[\[([^\]]*)$/);
        const tagMatch = textBefore.match(/#(\w*)$/);

        let newText = text;
        let newCursor = cursor;

        if (isLinkPopupOpen && linkMatch) {
             const start = linkMatch.index!;
             newText = text.substring(0, start) + textToInsert + text.substring(cursor);
             newCursor = start + textToInsert.length;
        } else if (isTagPopupOpen && tagMatch) {
             const start = tagMatch.index!;
             newText = text.substring(0, start) + textToInsert + text.substring(cursor);
             newCursor = start + textToInsert.length;
        } else {
             newText = text.substring(0, cursor) + textToInsert + text.substring(cursor);
             newCursor = cursor + textToInsert.length;
        }

        onUpdate(bullet.id, { text: newText });
        setTimeout(() => {
             if(textareaRef.current) {
                 textareaRef.current.setSelectionRange(newCursor, newCursor);
             }
        }, 0);
    };


    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        onUpdate(bullet.id, { text: newText });

        const cursor = e.target.selectionStart;
        const textBefore = newText.substring(0, cursor);

        const linkMatch = textBefore.match(/\[\[([^\]]*)$/);
        const tagMatch = textBefore.match(/#(\w*)$/);

        if (linkMatch) {
             onTriggerLinkPopup(bullet.id, linkMatch[1], textareaRef, (selected: any) => {
                 insertTextAtCursor(`[[${selected.text}]]`);
                 onCloseLinkPopup();
             });
        } else {
             onCloseLinkPopup();
        }

        if (tagMatch) {
            onTriggerTagPopup(bullet.id, tagMatch[1], textareaRef, (selected: string) => {
                insertTextAtCursor(selected + ' ');
                onCloseTagPopup();
            });
        } else {
            onCloseTagPopup();
        }
    };
    
    const handleViewClick = (e: React.MouseEvent) => {
         const target = e.target as HTMLElement;
         if (target.tagName === 'SPAN' && (target.innerText.startsWith('[[') || target.innerText.startsWith('#'))) {
             onLinkClick(target.innerText.replace(/[\[\]]/g, ''));
             return;
         }
         
         if (!isEditing && !bullet.isReadOnly) {
             onFocusChange(bullet.id, undefined, 'edit');
         }
    };


    return (
        <div className="relative group" ref={containerRef}>
            <div className={`flex items-start py-1 rounded transition-colors ${isFocused && !isEditing ? 'bg-blue-50 dark:bg-gray-800' : ''}`}>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-1 mt-0.5 relative z-10 select-none">
                    <div 
                        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5 transition-colors focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); onZoom(bullet.id); }}
                        onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing
                        tabIndex={-1}
                    >
                         <CircleIcon className="w-2 h-2 text-[var(--main-color)]" />
                    </div>
                     <div 
                        className="absolute -left-6 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); onFoldAll(bullet.id, !bullet.isCollapsed); }}
                        onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing
                        tabIndex={-1}
                    >
                        {bullet.children.length > 0 && (
                            bullet.isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />
                        )}
                    </div>
                </div>

                <div className="flex-grow min-w-0 relative">
                    {isEditing ? (
                        <textarea
                            ref={textareaRef}
                            value={bullet.text}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            className="w-full resize-none bg-transparent outline-none p-0 m-0 text-base leading-relaxed text-gray-800 dark:text-gray-200 font-[family-name:var(--font-family)]"
                            rows={1}
                            placeholder="Type here..."
                            readOnly={bullet.isReadOnly}
                        />
                    ) : (
                        <div 
                            ref={viewRef}
                            className={`text-base leading-relaxed text-gray-800 dark:text-gray-200 min-h-[24px] cursor-text break-words font-[family-name:var(--font-family)] outline-none ${isFocused ? 'ring-2 ring-opacity-20 ring-[var(--main-color)] rounded-sm' : ''}`}
                            onClick={handleViewClick}
                            onKeyDown={handleViewKeyDown}
                            tabIndex={0}
                        >
                            {highlightText(bullet.text, searchQuery) || <span className="text-gray-400 italic">Empty</span>}
                        </div>
                    )}
                </div>
            </div>

            {!bullet.isCollapsed && bullet.children.length > 0 && (
                <div className="ml-6 border-l border-gray-200 dark:border-gray-700 pl-2">
                    {bullet.children.map(child => (
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
                            focusMode={focusMode}
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
                            onNavigateTo={props.onNavigateTo}
                            onMerge={onMerge}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
