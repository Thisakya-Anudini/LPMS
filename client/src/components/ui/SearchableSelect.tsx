import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Search, X, Loader2 } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchableSelectProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  emptyMessage?: string;
  clearable?: boolean;
}

export function SearchableSelect({
  id,
  name,
  label,
  value,
  options,
  onChange,
  placeholder = "Search or select learning path...",
  isLoading = false,
  loadingLabel = "Loading learning paths...",
  disabled = false,
  error,
  className = "",
  emptyMessage = "No matching learning paths found",
  clearable = true,
}: SearchableSelectProps) {
  const generatedId = useId();
  const selectId = id || name || generatedId;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionsListRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const isDisabled = disabled || isLoading;

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value],
  );

  // Synchronize input text with selected option when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : "");
    }
  }, [isOpen, selectedOption]);

  // Filter options based on typed search term when open
  const filteredOptions = useMemo(() => {
    if (!isOpen) {
      return options;
    }
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return options;
    }
    // If search term matches the selected option's label exactly, show all options
    if (selectedOption && selectedOption.label.toLowerCase() === query) {
      return options;
    }
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(query);
      const descMatch = opt.description
        ? opt.description.toLowerCase().includes(query)
        : false;
      return labelMatch || descMatch;
    });
  }, [isOpen, options, searchTerm, selectedOption]);

  // Reset highlight index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Reset search term back to selected option label
        setSearchTerm(selectedOption ? selectedOption.label : "");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, selectedOption]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onChange(selectedValue);
      const selected = options.find((o) => o.value === selectedValue);
      setSearchTerm(selected ? selected.label : "");
      setIsOpen(false);
    },
    [onChange, options],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setSearchTerm("");
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDisabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape" || e.key === "Tab") {
      setIsOpen(false);
      setSearchTerm(selectedOption ? selectedOption.label : "");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev,
      );
      scrollHighlightedIntoView(highlightedIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      scrollHighlightedIntoView(highlightedIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        filteredOptions.length > 0 &&
        highlightedIndex >= 0 &&
        highlightedIndex < filteredOptions.length
      ) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!optionsListRef.current) return;
    const optionElements =
      optionsListRef.current.querySelectorAll<HTMLButtonElement>("[data-option]");
    const targetElement = optionElements[index];
    if (targetElement) {
      targetElement.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      className={`relative w-full ${isOpen ? "z-30" : ""} ${className}`}
      ref={containerRef}
    >
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          {label}
        </label>
      )}

      {/* Combined Search Field + Dropdown Container */}
      <div className="relative">
        {/* Left Search Icon */}
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>

        {/* Search Input Field */}
        <input
          ref={inputRef}
          id={selectId}
          type="text"
          disabled={isDisabled}
          value={searchTerm}
          placeholder={isLoading ? loadingLabel : placeholder}
          onFocus={() => {
            if (!isDisabled) {
              setIsOpen(true);
            }
          }}
          onClick={() => {
            if (!isDisabled) {
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`flex h-11 w-full rounded-lg border bg-white pl-10 pr-16 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
            error
              ? "border-red-500 focus:ring-red-500"
              : isOpen
                ? "border-primary-500 ring-2 ring-primary-500/20"
                : "border-slate-300 hover:border-slate-400"
          }`}
        />

        {/* Right Action Buttons (Clear 'X' + Dropdown '▼') */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {clearable && (value || searchTerm) && !isDisabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={isDisabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            aria-label="Toggle options"
            className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-primary-600" : ""
              }`}
            />
          </button>
        </div>

        {/* Dropdown Options Menu */}
        {isOpen && !isDisabled && (
          <div
            className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
            role="listbox"
          >
            <div
              ref={optionsListRef}
              className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  <p className="font-medium text-slate-600">{emptyMessage}</p>
                  {searchTerm && (
                    <p className="mt-1 text-xs text-slate-400">
                      Try searching with different keywords
                    </p>
                  )}
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = String(option.value) === String(value);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.value || `opt-${index}`}
                      type="button"
                      data-option
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                        isSelected
                          ? "bg-primary-50 text-primary-900 font-semibold"
                          : isHighlighted
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate">{option.label}</div>
                        {option.description && (
                          <div className="mt-0.5 truncate text-xs text-slate-400 font-normal group-hover:text-slate-500">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary-600 ml-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Total items counter */}
            {options.length > 5 && (
              <div className="mt-1.5 border-t border-slate-100 pt-1.5 px-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {filteredOptions.length} of {options.length} learning paths
                </span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      inputRef.current?.focus();
                    }}
                    className="text-primary-600 hover:underline font-medium"
                  >
                    Show all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
