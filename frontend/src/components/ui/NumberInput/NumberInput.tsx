import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useLayoutEffect,
  useRef,
} from 'react';
import styles from './NumberInput.module.css';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  showSteppers?: boolean;
  className?: string;
  ariaLabel?: string;
}

const clamp = (n: number, min?: number, max?: number) => {
  let next = n;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
};

const sanitize = (raw: string, allowDecimals: boolean) => {
  let cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!allowDecimals) cleaned = cleaned.replace(/\./g, '');
  cleaned = cleaned.replace(/(?!^)-/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned;
};

export default function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 1,
  allowDecimals = true,
  disabled = false,
  invalid = false,
  showSteppers = false,
  className,
  ariaLabel,
}: NumberInputProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const displayed = node.textContent ?? '';
    const stringValue = Number.isFinite(value) ? String(value) : '';
    if (displayed !== stringValue) {
      node.textContent = stringValue;
    }
  }, [value]);

  const emit = (raw: string) => {
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      onChange(0);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed, min, max));
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const raw = node.textContent ?? '';
    const cleaned = sanitize(raw, allowDecimals);
    if (cleaned !== raw) {
      node.textContent = cleaned;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    emit(cleaned);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const form = (event.currentTarget as HTMLElement).closest('form');
      form?.requestSubmit();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clamp(value + step, min, max));
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(clamp(value - step, min, max));
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = sanitize(
      event.clipboardData.getData('text/plain'),
      allowDecimals
    );
    document.execCommand('insertText', false, text);
  };

  const increment = () => onChange(clamp(value + step, min, max));
  const decrement = () => onChange(clamp(value - step, min, max));

  const decDisabled = disabled || (typeof min === 'number' && value <= min);
  const incDisabled = disabled || (typeof max === 'number' && value >= max);

  return (
    <div
      className={[
        styles.wrapper,
        invalid && styles.invalid,
        disabled && styles.disabled,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showSteppers && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="decrement"
          onMouseDown={(e) => e.preventDefault()}
          onClick={decrement}
          className={[styles.step, decDisabled && styles.stepDisabled]
            .filter(Boolean)
            .join(' ')}
          style={{ borderLeft: 'none', borderRight: '1px solid var(--border)' }}
        >
          −
        </div>
      )}
      <div
        ref={ref}
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        contentEditable={!disabled}
        suppressContentEditableWarning
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        data-placeholder={placeholder}
        className={styles.field}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {showSteppers && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="increment"
          onMouseDown={(e) => e.preventDefault()}
          onClick={increment}
          className={[styles.step, incDisabled && styles.stepDisabled]
            .filter(Boolean)
            .join(' ')}
        >
          +
        </div>
      )}
    </div>
  );
}
