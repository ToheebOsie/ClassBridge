import { useId } from 'react';
import { cx } from '../lib/cx.js';

const control =
  'block w-full h-10 rounded-lg border border-line-strong bg-surface px-3 text-base sm:text-sm text-ink ' +
  'placeholder:text-muted shadow-sm focus-visible:border-accent';

/** A label, a control and optional help or error text, wired together for screen readers. */
export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const child =
    typeof children === 'function' ? children({ id, className: cx(control, error && 'border-bad') }) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {child}
      {error ? (
        <p className="mt-1.5 text-sm text-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Text input: <TextField label="Pay by" value=... onChange=... /> */
export function TextField({ label, hint, error, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => <input {...p} {...rest} />}
    </Field>
  );
}

export function SelectField({ label, hint, error, options, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <select {...p} {...rest}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
