import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-primary-700 text-white hover:bg-primary-800 focus-visible:ring-primary-800 shadow-sm hover:shadow-md',
    secondary:
      'bg-secondary-100 text-secondary-900 border border-secondary-200 hover:bg-secondary-200 focus-visible:ring-secondary-500',
    outline:
      'border border-secondary-300 bg-transparent hover:bg-secondary-50 text-secondary-700 focus-visible:ring-primary-600',
    ghost: 'hover:bg-secondary-100 text-secondary-700 focus-visible:ring-primary-600',
    danger: 'bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-600 shadow-sm hover:shadow-md',
    success: 'bg-success-600 text-white hover:bg-success-700 focus-visible:ring-success-600 shadow-sm hover:shadow-md',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs gap-2',
    md: 'h-10 px-4 py-2 text-sm gap-2',
    lg: 'h-12 px-8 text-base gap-3',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
