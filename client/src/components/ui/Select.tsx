import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
interface SelectOption {
  value: string;
  label: string;
}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  menuPlacement?: 'top' | 'bottom';
}
export function Select({
  label,
  options,
  error,
  isLoading = false,
  loadingLabel = 'Loading options...',
  menuPlacement,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || props.name || Math.random().toString(36).substr(2, 9);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const renderedOptions = useMemo(() => (isLoading ? [{ value: '', label: loadingLabel }] : options), [isLoading, options, loadingLabel]);
  const selectedValue = String((props.value === undefined ? props.defaultValue : props.value) ?? '');
  const selectedLabel = useMemo(
    () => renderedOptions.find((option) => option.value === String(selectedValue ?? ''))?.label || renderedOptions[0]?.label || '',
    [renderedOptions, selectedValue]
  );
  const disabled = props.disabled || isLoading;

  useEffect(() => {
    if (!menuPlacement || !isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isOpen, menuPlacement]);

  const handleCustomSelect = (value: string) => {
    setIsOpen(false);
    props.onChange?.({
      target: { value, name: props.name },
      currentTarget: { value, name: props.name }
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  if (menuPlacement) {
    return (
      <div className="w-full" ref={wrapperRef}>
        {label &&
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-2">

            {label}
          </label>
        }
        <div className="relative">
          <button
            id={selectId}
            type="button"
            disabled={disabled}
            onFocus={(event) => props.onFocus?.(event as unknown as React.FocusEvent<HTMLSelectElement>)}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0563bb] disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {isOpen ? (
            <div
              className={`absolute z-50 max-h-64 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg ${
                menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {renderedOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCustomSelect(option.value)}
                  className={`block w-full px-3 py-2 text-left transition-colors hover:bg-slate-100 ${
                    option.value === selectedValue ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>);
  }

  return (
    <div className="w-full">
      {label &&
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-slate-700 mb-2">

          {label}
        </label>
      }
        <select
          id={selectId}
          className={`flex h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
          {...props}
          disabled={disabled}>

        {renderedOptions.map((option) =>
        <option key={option.value} value={option.value}>
            {option.label}
          </option>
        )}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>);

}
