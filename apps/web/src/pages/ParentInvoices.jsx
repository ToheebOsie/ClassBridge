import { useEffect, useState } from 'react';
import { formatNaira } from '@classbridge/shared';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SelectField, TextField } from '../components/Field.jsx';
import { InvoicePaper, ReceiptPaper } from '../components/Papers.jsx';
import {
  errorText,
  useMarkInvoicesSeenMutation,
  useMarkReceiptsSeenMutation,
  useMyInvoicesQuery,
  useMyReceiptsQuery,
  useSubmitPaymentMutation,
} from '../store/api.js';

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const METHODS = ['Bank transfer', 'Cash deposit', 'POS', 'Online'];
const PAY = {
  confirmed: ['good', 'Confirmed'],
  pending: ['info', 'Waiting for the school'],
  rejected: ['bad', 'Not accepted'],
};
const today = () => new Date().toISOString().slice(0, 10);

/** Read a picked file as a data URL, after checking its type and size on this device. */
export function readScreenshot(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type))
      return reject(new Error('Choose a picture (PNG, JPG or WebP) of your payment receipt.'));
    if (file.size > MAX_SCREENSHOT_BYTES)
      return reject(new Error('That picture is too big. Please use one under 5 MB.'));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('We could not read that picture. Try another.'));
    r.readAsDataURL(file);
  });
}

function PayForm({ inv }) {
  const [submit, { isLoading }] = useSubmitPaymentMutation();
  const [f, setF] = useState({
    amount: String(inv.room),
    date: today(),
    method: 'Bank transfer',
    reference: '',
    note: '',
  });
  const [shot, setShot] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = async (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return setShot('');
    try {
      setShot(await readScreenshot(file));
    } catch (err) {
      setShot('');
      setError(err.message);
      e.target.value = '';
    }
  };
  const send = async (e) => {
    e.preventDefault();
    setError('');
    if (!shot) return setError('Attach the screenshot of your payment receipt.');
    const res = await submit({
      invoiceId: inv.id,
      amount: Number(f.amount),
      date: f.date,
      method: f.method,
      reference: f.reference,
      note: f.note,
      screenshot: shot,
    });
    if (res.error) return setError(errorText(res.error));
    setShot('');
  };
  return (
    <form onSubmit={send} noValidate className="mt-4 space-y-3 rounded-lg border border-line bg-canvas p-4">
      <p className="text-sm font-medium text-ink">Send your payment</p>
      <p className="text-sm text-muted">You can still pay up to {formatNaira(inv.room)}.</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Amount paid (₦)"
          inputMode="numeric"
          value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })}
        />
        <TextField label="Date paid" type="date" value={f.date} onChange={set('date')} />
      </div>
      <SelectField label="How did you pay?" value={f.method} onChange={set('method')} options={METHODS} />
      <TextField label="Reference (optional)" value={f.reference} onChange={set('reference')} />
      <TextField
        label="Screenshot of your payment receipt"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={pick}
        hint="Required. A picture under 5 MB."
      />
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isLoading || !f.amount}>
        {isLoading ? 'Sending…' : 'Send payment to the school'}
      </Button>
    </form>
  );
}

export function ParentInvoicesPage() {
  const { data } = useMyInvoicesQuery();
  const [markSeen] = useMarkInvoicesSeenMutation();
  useEffect(() => {
    markSeen();
  }, [markSeen]);
  const invoices = data?.invoices || [];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      {invoices.length === 0 && <p className="text-sm text-muted">No invoices yet.</p>}
      {invoices.map((inv) => (
        <Card
          key={inv.id}
          title={`${inv.studentName}: ${inv.title}`}
          action={
            <Badge tone={inv.status === 'paid' ? 'good' : inv.status === 'part' ? 'warn' : 'neutral'}>
              {inv.status === 'paid' ? 'Paid in full' : inv.status === 'part' ? 'Part paid' : 'Not paid'}
            </Badge>
          }
        >
          <InvoicePaper inv={inv} />
          {inv.payments.length > 0 && (
            <ul className="mt-4 space-y-2">
              {inv.payments.map((p) => {
                const [tone, text] = PAY[p.status];
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="num font-medium">{formatNaira(p.amount)}</span>
                    <span className="text-muted">{p.date}</span>
                    <Badge tone={tone}>{text}</Badge>
                    {p.status === 'rejected' && <span className="text-bad">{p.rejectReason}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {inv.room > 0 ? (
            <PayForm inv={inv} />
          ) : (
            inv.status !== 'paid' && (
              <p className="mt-3 text-sm text-muted">Your payment is waiting for the school to confirm it.</p>
            )
          )}
        </Card>
      ))}
    </div>
  );
}

export function ParentReceiptsPage() {
  const { data } = useMyReceiptsQuery();
  const [markSeen] = useMarkReceiptsSeenMutation();
  useEffect(() => {
    markSeen();
  }, [markSeen]);
  const receipts = data?.receipts || [];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Fee receipts</h1>
      {receipts.length === 0 && (
        <p className="text-sm text-muted">No receipts yet. One appears here when the school confirms a payment.</p>
      )}
      {receipts.map((r) => (
        <ReceiptPaper key={r.number} receipt={r} />
      ))}
    </div>
  );
}
