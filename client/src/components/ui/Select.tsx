import React from 'react';
interface SelectOption {
  value: string;
  label: string;
}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}
export function Select({
  label,
  options,
  error,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || props.name || Math.random().toString(36).substr(2, 9);
  return (
    <div className="w-full">
      {label &&
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-slate-700 mb-1">

          {label}
        </label>
      }
      <select
        id={selectId}
        className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0563bb] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}>

        {options.map((option) =>
        <option key={option.value} value={option.value}>
            {option.label}
          </option>
        )}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>);

}
