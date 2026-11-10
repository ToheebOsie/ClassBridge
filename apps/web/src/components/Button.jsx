import { cx } from '../lib/cx.js';

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-strong shadow-sm',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas shadow-sm',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'bg-surface text-bad border border-line-strong hover:bg-bad-soft',
};
const sizes = { md: 'h-10 px-4 text-sm', sm: 'h-8 px-3 text-[13px]' };

/**
 * @param {{ variant?: keyof typeof variants, size?: keyof typeof sizes } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Button({ variant = 'primary', size = 'md', className, ...rest }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
