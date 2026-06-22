import { ReactNode } from 'react';
import styles from './List.module.css';

export type ListVariant = 'default' | 'bulleted' | 'inline' | 'cards';

export interface ListProps {
  children: ReactNode;
  variant?: ListVariant;
  className?: string;
}

export function List({ children, variant = 'default', className }: ListProps) {
  return (
    <div
      role="list"
      className={[styles.list, styles[variant], className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

export interface ListItemProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function ListItem({ children, className, onClick }: ListItemProps) {
  return (
    <div
      role="listitem"
      onClick={onClick}
      className={[styles.item, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

export default List;
