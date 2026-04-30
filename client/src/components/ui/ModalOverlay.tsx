import React from 'react';
import { createPortal } from 'react-dom';

export function ModalOverlay({
  children,
  className
}: {
  children: React.ReactNode;
  className: string;
}) {
  return createPortal(<div className={className}>{children}</div>, document.body);
}
