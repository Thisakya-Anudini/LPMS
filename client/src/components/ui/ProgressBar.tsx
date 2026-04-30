import React from 'react';

interface ProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  animated?: boolean;
}

export function ProgressBar({
  progress,
  className = '',
  showLabel = false,
  size = 'md',
  variant = 'default',
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colors = {
    default: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-secondary-700">Progress</span>
          <span className="text-sm font-semibold text-secondary-900">
            {clampedProgress}%
          </span>
        </div>
      )}
      <div className={`w-full bg-secondary-200 rounded-full ${heights[size]} overflow-hidden`}>
        <div
          className={`${colors[variant]} ${heights[size]} rounded-full transition-all duration-700 ease-out ${
            animated ? 'animate-fade-in' : ''
          }`}
          style={{
            width: `${clampedProgress}%`,
          }}
        />
      </div>
    </div>
  );
}
