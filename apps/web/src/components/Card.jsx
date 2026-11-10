import { cx } from '../lib/cx.js';

/** A white panel with an optional title and hint. */
export function Card({ title, hint, action, className, children }) {
  return (
    <section className={cx('rounded-card border bg-surface shadow-card', className || 'border-line')}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
