import { ReactNode } from 'react';
import styles from './FormField.module.css';

export interface FormFieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: boolean;
  children: ReactNode;
  className?: string;
}

export default function FormField({
  label,
  required = false,
  hint,
  error = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <div className={[styles.label, required && styles.required].filter(Boolean).join(' ')}>
          {label}
        </div>
      )}
      {children}
      {hint && (
        <div className={[styles.hint, error && styles.error].filter(Boolean).join(' ')}>{hint}</div>
      )}
    </div>
  );
}
