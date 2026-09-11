import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BookOpen, Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  title?: string;
  status?: string;
}

interface SearchableSelectProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

export function SearchableSelect({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose a learning path...',
  searchPlaceholder = 'Search learning paths...',
  emptyMessage = 'No learning paths found.',
  disabled = false,
  required = false,
  error,
  className = '',
}: SearchableSelectProps) {
  const generatedId = useId();
  const selectId = id || name || generatedId;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionsListRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Selected option display text
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => {
      const matchLabel = option.label.toLowerCase().includes(query);
      const matchTitle = option.title ? option.title.toLowerCase().includes(query) : false;
      const matchStatus = option.status ? option.status.toLowerCase().includes(query) : false;
      return matchLabel || matchTitle || matchStatus;
    });
  }, [options, searchTerm]);

  // Handle open / close
  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, []);

  // Autofocus search input on open
  useEffect(() => {
    if (isOpen) {
      // Find initial highlighted index matching current value
      const initialIdx = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !optionsListRef.current) return;
    const items = optionsListRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]');
    const targetItem = items[highlightedIndex];
    if (targetItem) {
      targetItem.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Selection handler
  const handleSelectOption = (selectedValue: string) => {
    onChange(selectedValue);
    closeDropdown();
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          handleSelectOption(filteredOptions[highlightedIndex].value);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        closeDropdown();
        break;
      }
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef} onKeyDown={handleKeyDown}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          {label}
        </label>
      )}

      {/* Hidden input for native form submission */}
      <input
        type="hidden"
        id={selectId}
        name={name}
        value={value}
        required={required}
      />

      {/* Main trigger button */}
      <button
        ref={triggerRef}
        type="button"
        id={`${selectId}-button`}
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-left text-sm transition-all duration-150 cursor-pointer ${
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500'
            : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
        } ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''} ${className}`}
      >
        <span
          className={`truncate ${
            selectedOption ? 'text-slate-900 font-medium' : 'text-slate-500'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary-600' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          id={`${selectId}-listbox`}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 w-full rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col"
        >
          {/* Search box inside the opened dropdown */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-md placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setHighlightedIndex(0);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div
            ref={optionsListRef}
            className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectOption(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary-50/80 text-primary-900 font-medium'
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <BookOpen
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? 'text-primary-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">
                        {option.title || option.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {option.status && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                            option.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : option.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {option.status}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary-600 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-7 px-4 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-1.5">
                <BookOpen className="h-6 w-6 text-slate-300 stroke-[1.5]" />
                <p className="font-medium text-slate-600">{emptyMessage}</p>
                <p className="text-xs text-slate-400">
                  Try adjusting your search terms
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
