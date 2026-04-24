import { createContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
