import { ReactNode } from 'react';
import styles from './Alert.module.css';

export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

export default function Alert({ variant = 'info', children, className }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={[styles.alert, styles[variant], className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
