import { KeyboardEvent, ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
  ariaLabel,
}: CheckboxProps) {
  const toggle = () => {
    if (disabled) return;
    onChange(!checked);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={typeof label === 'string' ? undefined : ariaLabel}
      tabIndex={disabled ? -1 : 0}
      className={[styles.wrapper, disabled && styles.disabled, className]
        .filter(Boolean)
        .join(' ')}
      onClick={toggle}
      onKeyDown={handleKeyDown}
    >
      <span className={[styles.box, checked && styles.checked].filter(Boolean).join(' ')}>
        {checked && <span className={styles.mark} />}
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}
