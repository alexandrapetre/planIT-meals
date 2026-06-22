import { KeyboardEvent, ReactNode, useState } from 'react';
import styles from './Collapsible.module.css';

export interface CollapsibleProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function Collapsible({
  summary,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => setOpen((prev) => !prev);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <div
      className={[styles.wrapper, open && styles.open, className].filter(Boolean).join(' ')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className={styles.summary}
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.caret}>▶</span>
        <span>{summary}</span>
      </div>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  );
}
