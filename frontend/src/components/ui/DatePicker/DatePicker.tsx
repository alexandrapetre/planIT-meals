import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  allowClear?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseISO = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  ariaLabel,
  allowClear = true,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ro' ? 'ro-RO' : 'en-US';

  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseISO(value), [value]);
  const [cursor, setCursor] = useState(() => selectedDate ?? new Date());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: Event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open && selectedDate) setCursor(selectedDate);
  }, [open, selectedDate]);

  const monthLabel = useMemo(
    () =>
      cursor.toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      }),
    [cursor, locale]
  );

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1);
    while (base.getDay() !== 1) base.setDate(base.getDate() + 1);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const dayOfWeek = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - dayOfWeek);
    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const today = useMemo(() => new Date(), []);

  const displayValue = useMemo(() => {
    if (!selectedDate) return '';
    return selectedDate.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDate, locale]);

  const changeMonth = (delta: number) => {
    setCursor((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return next;
    });
  };

  const selectDay = (d: Date) => {
    onChange(toISO(d));
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const selectToday = () => {
    onChange(toISO(new Date()));
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={[styles.wrapper, open && styles.open, className].filter(Boolean).join(' ')}
    >
      <div
        role="button"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        className={[styles.trigger, disabled && styles.disabled].filter(Boolean).join(' ')}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        <span className={displayValue ? '' : styles.placeholder}>
          {displayValue || placeholder || t('datePicker.placeholder')}
        </span>
        <span className={styles.icon}>📅</span>
      </div>

      {open && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <div
              role="button"
              aria-label={t('datePicker.prevMonth')}
              tabIndex={0}
              className={styles.navButton}
              onClick={() => changeMonth(-1)}
            >
              ‹
            </div>
            <div className={styles.title}>{monthLabel}</div>
            <div
              role="button"
              aria-label={t('datePicker.nextMonth')}
              tabIndex={0}
              className={styles.navButton}
              onClick={() => changeMonth(1)}
            >
              ›
            </div>
          </div>

          <div className={styles.weekdays}>
            {weekdayLabels.map((label, i) => (
              <div key={i} className={styles.weekday}>
                {label}
              </div>
            ))}
          </div>

          <div className={styles.grid}>
            {days.map((day) => {
              const outside = day.getMonth() !== cursor.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  aria-label={day.toLocaleDateString(locale)}
                  aria-selected={isSelected}
                  tabIndex={0}
                  className={[
                    styles.day,
                    outside && styles.outside,
                    isToday && !isSelected && styles.today,
                    isSelected && styles.selected,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDay(day)}
                >
                  {day.getDate()}
                </div>
              );
            })}
          </div>

          <div className={styles.footer}>
            <div role="button" tabIndex={0} className={styles.footerAction} onClick={selectToday}>
              {t('datePicker.today')}
            </div>
            {allowClear && selectedDate && (
              <div role="button" tabIndex={0} className={styles.footerAction} onClick={clear}>
                {t('datePicker.clear')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
