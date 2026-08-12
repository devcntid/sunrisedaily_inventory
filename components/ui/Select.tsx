import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

interface SelectOption {
  value: string | number;
  label: string;
  isGroup?: boolean;
  disabled?: boolean;
}

interface SelectProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  inputStyle?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  disabled?: boolean;
  creatable?: boolean;
}

export function Select({ value, onChange, options, style, className = '', placeholder, searchable = false, creatable = false, inputStyle, optionStyle, disabled = false }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ opacity: 0, position: 'fixed', left: -9999 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const updatePosition = () => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        // Check if there is enough space at the bottom (assumed max dropdown height 280px)
        const spaceBottom = window.innerHeight - rect.bottom;
        const isBottomSpace = spaceBottom > 280 || spaceBottom > rect.top;
        
        setDropdownStyle({
          position: 'fixed',
          top: isBottomSpace ? rect.bottom + 4 : undefined,
          bottom: isBottomSpace ? undefined : window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
          opacity: 1,
        });
      };
      
      updatePosition();
      // Listen to scroll events on any scrollable parent
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current && 
        !wrapperRef.current.contains(event.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
      ) {
        setIsOpen(false);
        setSearchTerm(''); // Reset search when closed
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let selectedOption = options.find(o => String(o.value) === String(value)) || 
                       options.find(o => String(o.value).toLowerCase() === String(value).toLowerCase());
  if (!selectedOption && value !== undefined && value !== null && String(value).trim() !== '') {
    selectedOption = { value: String(value), label: String(value) };
  }
  
  const filteredOptions = searchable && searchTerm.trim() !== ''
    ? options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }} className={className}>
      <div
        className="input"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          background: disabled ? '#f8fafc' : '#fff',
          width: '100%',
          opacity: disabled ? 0.7 : 1,
          ...inputStyle
        }}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen && searchable) setSearchTerm('');
        }}
      >
        <span title={selectedOption ? selectedOption.label : placeholder || 'Select...'} style={{ color: selectedOption ? 'inherit' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder || 'Select...'}
        </span>
        <ChevronDown size={14} style={{ color: '#64748b', marginLeft: 8, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && mounted && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            ...dropdownStyle,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {searchable && (
            <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
              <Search size={14} style={{ color: '#94a3b8', marginLeft: 4 }} />
              <input 
                type="text" 
                autoFocus
                placeholder={creatable ? "Cari atau ketik baru..." : "Ketik untuk mencari..."} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
              />
            </div>
          )}
          
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filteredOptions.map((opt, i) => (
              opt.isGroup ? (
                <div key={`group-${i}`} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#f8fafc', textTransform: 'uppercase' }}>
                  {opt.label}
                </div>
              ) : (
                <div
                  key={opt.value}
                  onClick={() => {
                    if (opt.disabled) return;
                    setIsOpen(false);
                    setSearchTerm('');
                    requestAnimationFrame(() => {
                      setTimeout(() => {
                        onChange(opt.value);
                      }, 0);
                    });
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    background: String(opt.value) === String(value) ? '#f3f4f6' : '#fff',
                    color: opt.disabled ? '#94a3b8' : '#334155',
                    transition: 'background 0.1s',
                    ...optionStyle
                  }}
                  onMouseEnter={(e) => {
                    if (!opt.disabled && String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!opt.disabled && String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = '#fff';
                    }
                  }}
                >
                  {opt.label}
                </div>
              )
            ))}
            {filteredOptions.length === 0 && !creatable && (
              <div style={{ padding: '12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>Tidak ada pilihan</div>
            )}
            
            {creatable && searchTerm.trim() !== '' && !options.some(o => String(o.label).toLowerCase() === searchTerm.toLowerCase()) && (
              <div
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      onChange(searchTerm.trim());
                    }, 0);
                  });
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  background: '#fff',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  transition: 'background 0.1s',
                  borderTop: filteredOptions.length > 0 ? '1px solid #f1f5f9' : 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                + Tambah "{searchTerm}"
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
