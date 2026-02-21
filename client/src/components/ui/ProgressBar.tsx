import React from 'react';
interface ProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success';
}
export function ProgressBar({
  progress,
  className = '',
  showLabel = false,
  size = 'md',
  variant = 'default'
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  };
  const colors = {
    default: 'bg-blue-600',
    success: 'bg-green-600'
  };
  return (
    <div className={`w-full ${className}`}>
      {showLabel &&
      <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-slate-700">Progress</span>
          <span className="text-xs font-medium text-slate-700">
            {clampedProgress}%
          </span>
        </div>
      }
      <div className={`w-full bg-slate-200 rounded-full ${heights[size]}`}>
        <div
          className={`${colors[variant]} ${heights[size]} rounded-full transition-all duration-500 ease-out`}
          style={{
            width: `${clampedProgress}%`
          }}>
        </div>
      </div>
    </div>);

}