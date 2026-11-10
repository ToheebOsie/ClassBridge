import { cx } from '../lib/cx.js';

const tones = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  neutral: 'bg-canvas text-muted border border-line',
};

/** Small status label. Always pair colour with words, never colour alone. */
export function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
