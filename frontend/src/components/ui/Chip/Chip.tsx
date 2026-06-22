import { KeyboardEvent, ReactNode } from 'react';
import styles from './Chip.module.css';

export interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Chip({ children, active = false, onClick, disabled = false, className }: ChipProps) {
  const isInteractive = Boolean(onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      aria-pressed={isInteractive ? active : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={isInteractive && !disabled ? 0 : -1}
      className={[
        styles.chip,
        active && styles.active,
        !isInteractive && styles.static,
        disabled && styles.disabled,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={isInteractive && !disabled ? onClick : undefined}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export interface ChipGroupProps {
  children: ReactNode;
  className?: string;
}

export function ChipGroup({ children, className }: ChipGroupProps) {
  return <div className={[styles.group, className].filter(Boolean).join(' ')}>{children}</div>;
}

export default Chip;
