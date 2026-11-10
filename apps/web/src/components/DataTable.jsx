import { cx } from '../lib/cx.js';

/**
 * Simple table. `columns`: [{ key, header, render?, align?: 'right' }].
 * It scrolls sideways on small screens instead of squeezing the columns.
 */
export function DataTable({ columns, rows, rowKey }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  'py-2.5 pr-4 text-xs font-semibold uppercase tracking-wide text-muted',
                  c.align === 'right' && 'text-right',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className="border-b border-line last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={cx('py-3 pr-4 align-middle', c.align === 'right' && 'num text-right')}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
