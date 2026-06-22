import {
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import styles from './Select.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
}

export interface SelectProps<T extends string = string> {
  value: T | '';
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: Event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, close]);

  const selected = options.find((o) => o.value === value);

  const toggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const pick = (option: SelectOption<T>) => {
    onChange(option.value);
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        const opt = options[focusIdx];
        if (opt) pick(opt);
      }
      return;
    }
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      setFocusIdx((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    }
  };

  const classes = [styles.wrapper, open && styles.open, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={wrapperRef} className={classes}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        className={[styles.trigger, disabled && styles.disabled].filter(Boolean).join(' ')}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? '' : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={styles.caret} />
      </div>
      {open && (
        <div role="listbox" className={styles.listbox}>
          {options.map((option, idx) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-selected={option.value === value}
              data-focused={focusIdx === idx}
              className={styles.option}
              onMouseEnter={() => setFocusIdx(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
