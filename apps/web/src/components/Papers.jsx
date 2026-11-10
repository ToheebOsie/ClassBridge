import { formatNaira } from '@classbridge/shared';

const SCHOOL = { name: 'Unity Heritage College', motto: 'Knowledge with Character', place: 'Ibadan', initials: 'UH' };

/** The printed look shared by invoices and receipts: school header, details grid, items table. */
function Paper({ title, details, items, summary, note, footer, children }) {
  return (
    <article className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
      <header className="flex items-center gap-3 border-b-2 border-ink pb-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-sm font-bold text-white"
          aria-hidden="true"
        >
          {SCHOOL.initials}
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight text-ink">{SCHOOL.name}</p>
          <p className="text-xs text-muted">
            {SCHOOL.motto} · {SCHOOL.place}
          </p>
        </div>
      </header>
      <h3 className="my-4 text-center text-sm font-semibold uppercase tracking-widest text-ink">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {details.map(([k, v, mono]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className={`break-words text-sm font-medium text-ink ${mono ? 'font-mono text-[13px]' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-[16rem] border-collapse text-sm">
          <thead>
            <tr className="bg-canvas text-left">
              <th className="border border-line px-3 py-2 font-semibold text-ink">Fee item</th>
              <th className="num border border-line px-3 py-2 text-right font-semibold text-ink">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={`${i.name}-${n}`}>
                <td className="border border-line px-3 py-2">{i.name}</td>
                <td className="num border border-line px-3 py-2 text-right">{formatNaira(i.amount)}</td>
              </tr>
            ))}
            {summary.map(([label, value, strong]) => (
              <tr key={label} className={strong ? 'font-semibold text-ink' : ''}>
                <td className="border border-line px-3 py-2">{label}</td>
                <td className="num border border-line px-3 py-2 text-right">{formatNaira(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
      {note && <p className="mt-3 text-sm">{note}</p>}
      <p className="mt-5 text-center text-xs text-muted">{footer || 'Powered by ClassBridge'}</p>
    </article>
  );
}

/** An invoice. `inv` is an invoice from the API (or a draft with the same fields). */
export function InvoicePaper({ inv }) {
  const total = inv.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const confirmed = inv.confirmed ?? 0;
  return (
    <Paper
      title={`Fees invoice${inv.title && inv.title !== 'School fees' ? `: ${inv.title}` : ''}${inv.revised ? ' (revised)' : ''}`}
      details={[
        ['Invoice no.', inv.number || 'Assigned when sent', true],
        ['Pay by', inv.dueDate || '–'],
        ['Student', inv.studentName || '–'],
        ['Student ID', inv.studentId || '–', true],
        ['Class', inv.className || '–'],
        ['Term', `${inv.term}, ${inv.session}`],
      ]}
      items={inv.items.filter((i) => i.name || i.amount)}
      summary={[
        ['Total', total, true],
        ['Paid so far, confirmed', confirmed],
        ['Balance to pay', total - confirmed, true],
      ]}
      note={inv.note}
    />
  );
}

/** A receipt, exactly as sent. `receipt.number` is empty in the head's preview. */
export function ReceiptPaper({ receipt: r }) {
  return (
    <Paper
      title="Fees receipt"
      details={[
        ['Receipt no.', r.number || 'Assigned when sent', true],
        ['Date received', r.paidOn || '–'],
        ['Student', r.studentName],
        ['Student ID', r.studentId, true],
        ['Class', r.className || '–'],
        ['Term', `${r.term}, ${r.session}`],
        ['Paid by', r.method || '–'],
        ['Reference', r.reference || '–'],
        ['Invoice', r.invoiceNumber || '–', true],
      ]}
      items={r.items}
      summary={[
        ['Total fees', r.total, true],
        ['Paid earlier this term', r.before],
        ['Paid now', r.paid, true],
        ['Balance outstanding', r.balance, true],
      ]}
    >
      <p
        className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.balance <= 0 ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}`}
      >
        {r.balance <= 0 ? 'Paid in full' : 'Balance outstanding'}
      </p>
    </Paper>
  );
}
