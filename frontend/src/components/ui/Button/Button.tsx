import { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  type?: 'button' | 'submit';
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  block?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  size = 'md',
  disabled = false,
  block = false,
  className,
  ariaLabel,
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    block && styles.block,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const activate = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (type === 'submit') {
      const form = (event.currentTarget as HTMLElement).closest('form');
      if (form) {
        event.preventDefault();
        form.requestSubmit();
      }
    }
    onClick?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.currentTarget as HTMLElement).click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      className={classes}
      onClick={activate}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
