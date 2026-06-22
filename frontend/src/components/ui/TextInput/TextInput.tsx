import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useLayoutEffect,
  useRef,
} from 'react';
import styles from './TextInput.module.css';

export type TextInputVariant = 'text' | 'email' | 'password';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: TextInputVariant;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
  submitOnEnter?: boolean;
}

export default function TextInput({
  value,
  onChange,
  placeholder,
  variant = 'text',
  disabled = false,
  required = false,
  invalid = false,
  className,
  ariaLabel,
  submitOnEnter = true,
}: TextInputProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.textContent !== value) {
      node.textContent = value;
    }
  }, [value]);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const next = event.currentTarget.textContent ?? '';
    if (next !== value) onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (submitOnEnter) {
        const form = (event.currentTarget as HTMLElement).closest('form');
        form?.requestSubmit();
      }
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
    document.execCommand('insertText', false, text);
  };

  const classes = [
    styles.input,
    variant === 'password' && styles.password,
    disabled && styles.disabled,
    invalid && styles.invalid,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline={false}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      contentEditable={!disabled}
      suppressContentEditableWarning
      spellCheck={variant === 'password' ? false : undefined}
      data-placeholder={placeholder}
      data-variant={variant}
      className={classes}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
}
