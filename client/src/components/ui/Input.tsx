import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || props.name || Math.random().toString(36).substr(2, 9);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-secondary-700 mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`flex h-11 w-full rounded-lg border bg-white px-4 py-3 text-sm placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ${
          error
            ? 'border-error-300 focus:ring-error-500'
            : 'border-secondary-300 hover:border-secondary-400'
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm text-error-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-2 text-sm text-secondary-500">{helperText}</p>
      )}
    </div>
  );
}
