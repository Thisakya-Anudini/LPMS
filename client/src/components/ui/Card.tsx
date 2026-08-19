import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({
  children,
  className = '',
  bodyClassName = '',
  title,
  description,
  footer,
  action,
  variant = 'default',
}: CardProps) {
  const variants = {
    default: 'bg-white border border-secondary-200 shadow-soft',
    elevated: 'bg-white border border-secondary-200 shadow-medium',
    outlined: 'bg-white border-2 border-secondary-200',
  };

  return (
    <div
      className={`rounded-xl overflow-hidden ${variants[variant]} ${className}`}
    >
      {(title || action) && (
        <div className="px-6 py-5 border-b border-secondary-100 flex justify-between items-start bg-secondary-50/50">
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-secondary-900 leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-secondary-600 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={`p-6 ${bodyClassName}`}>{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-100">
          {footer}
        </div>
      )}
    </div>
  );
}
