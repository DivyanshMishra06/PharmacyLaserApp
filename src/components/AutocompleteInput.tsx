import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  inputType?: string;
}

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  required,
  autoFocus,
  inputType = 'text',
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter: show all (up to 8) on empty, filter on typing
  const filtered = value.trim().length > 0
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  const calcPosition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropStyle({
      position: 'fixed',
      top: r.bottom + 3,
      left: r.left,
      width: Math.max(r.width, 200),
      zIndex: 9999,
      maxHeight: 220,
    });
  };

  const openDrop = () => {
    calcPosition();
    setOpen(true);
    setHighlighted(-1);
  };

  const closeDrop = () => setOpen(false);

  const select = (s: string) => {
    onChange(s);
    onSelect?.(s);
    closeDrop();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown') { openDrop(); return; }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        if (highlighted >= 0) {
          e.preventDefault();
          select(filtered[highlighted]);
        }
        break;
      case 'Escape':
      case 'Tab':
        closeDrop();
        break;
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        closeDrop();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reposition on scroll / resize so dropdown tracks the input
  useEffect(() => {
    if (!open) return;
    const reposition = () => calcPosition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // Highlight matching text inside suggestion
  const highlight = (text: string) => {
    if (!value.trim()) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(value.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <span className="font-bold text-blue-600">{text.slice(idx, idx + value.length)}</span>
        {text.slice(idx + value.length)}
      </span>
    );
  };

  return (
    <>
      <input
        ref={inputRef}
        type={inputType}
        value={value}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => { onChange(e.target.value); openDrop(); }}
        onFocus={openDrop}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        required={required}
        autoFocus={autoFocus}
      />

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          style={dropStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto py-1"
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                i === highlighted
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {highlight(s)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
