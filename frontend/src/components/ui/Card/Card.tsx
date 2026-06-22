import { ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  compact?: boolean;
  className?: string;
}

export default function Card({ children, compact = false, className }: CardProps) {
  return (
    <div className={[styles.card, compact && styles.compact, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
