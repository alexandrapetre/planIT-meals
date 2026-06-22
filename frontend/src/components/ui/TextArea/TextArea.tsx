import { FormEvent, useLayoutEffect, useRef } from 'react';
import styles from './TextArea.module.css';

export interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function TextArea({
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  className,
  ariaLabel,
}: TextAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (node.innerText !== value) {
      node.innerText = value;
    }
  }, [value]);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const next = event.currentTarget.innerText ?? '';
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline={true}
      aria-disabled={disabled || undefined}
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      contentEditable={!disabled}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={[
        styles.textarea,
        disabled && styles.disabled,
        invalid && styles.invalid,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onInput={handleInput}
    />
  );
}
