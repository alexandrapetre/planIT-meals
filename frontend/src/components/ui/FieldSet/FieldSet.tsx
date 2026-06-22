import { ReactNode } from 'react';
import styles from './FieldSet.module.css';

export interface FieldSetProps {
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function FieldSet({ legend, children, className }: FieldSetProps) {
  return (
    <div
      role="group"
      aria-label={typeof legend === 'string' ? legend : undefined}
      className={[styles.fieldset, className].filter(Boolean).join(' ')}
    >
      {legend && <div className={styles.legend}>{legend}</div>}
      {children}
    </div>
  );
}
