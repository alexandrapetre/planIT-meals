import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Modal.module.css';

export type ModalSize = 'default' | 'large' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: ModalSize;
  padded?: boolean;
  closeOnOverlay?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  size = 'default',
  padded = true,
  closeOnOverlay = true,
  children,
  footer,
  ariaLabel,
}: ModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const dialogClass = [
    styles.dialog,
    size === 'large' && styles.dialogLarge,
    size === 'full' && styles.dialogFull,
  ]
    .filter(Boolean)
    .join(' ');

  const handleOverlay = () => {
    if (closeOnOverlay) onClose();
  };

  const handleDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlay}
      role="presentation"
    >
      <div
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
        onClick={handleDialog}
      >
        <div
          className={styles.closeButton}
          role="button"
          tabIndex={0}
          aria-label={t('common.close')}
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ×
        </div>
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
          </div>
        )}
        <div
          className={[styles.body, padded && styles.bodyPadded]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
