import { useState } from 'react';
import { formatNaira } from '@classbridge/shared';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { TextField } from '../components/Field.jsx';
import { ReceiptPaper } from '../components/Papers.jsx';
import {
  errorText,
  useAllReceiptsQuery,
  useConfirmPaymentMutation,
  usePendingQuery,
  usePreviewReceiptMutation,
  useRejectPaymentMutation,
} from '../store/api.js';

/** One payment waiting for the head: compare the screenshot, then review the receipt, then send it. */
function PendingPayment({ item }) {
  const { payment: p, invoice: inv } = item;
  const [amount, setAmount] = useState(String(p.amount));
  const [review, setReview] = useState(null); // the receipt preview, once the head has asked for it
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [preview, { isLoading: previewing }] = usePreviewReceiptMutation();
  const [confirm, { isLoading: sending }] = useConfirmPaymentMutation();
  const [reject, { isLoading: rejectingNow }] = useRejectPaymentMutation();

  const doPreview = async () => {
    setError('');
    const res = await preview({ id: p.id, amount: Number(amount) });
    if (res.error) return setError(errorText(res.error));
    setReview(res.data.receipt);
  };
  const doSend = async () => {
    const res = await confirm({ id: p.id, amount: Number(amount) });
    if (res.error) setError(errorText(res.error));
  };
  const doReject = async () => {
    const res = await reject({ id: p.id, reason });
    if (res.error) setError(errorText(res.error));
  };

  return (
    <li className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-ink">
            {inv.studentName} <span className="text-muted">· {inv.className}</span>
          </p>
          <p className="font-mono text-xs text-muted">
            {inv.number} · {p.method}
            {p.reference ? ` · ${p.reference}` : ''}
          </p>
        </div>
        <p className="num text-lg font-semibold text-ink">{formatNaira(p.amount)}</p>
      </div>
      <img
        src={`/api/payments/${p.id}/screenshot`}
        alt={`Payment screenshot from the parent of ${inv.studentName}`}
        className="mt-3 max-h-72 w-full rounded-lg border border-line bg-canvas object-contain"
      />
      {p.note && <p className="mt-2 text-sm text-muted">Parent’s note: {p.note}</p>}
      {review ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-ink">
            This is exactly what the parent will receive. Check it, then send.
          </p>
          <ReceiptPaper receipt={review} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setReview(null)} disabled={sending}>
              Go back and change
            </Button>
            <Button onClick={doSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send receipt to parent'}
            </Button>
          </div>
        </div>
      ) : rejecting ? (
        <div className="mt-4 space-y-2">
          <TextField label="Why is it not accepted?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReject} disabled={rejectingNow}>
              Send back to parent
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <TextField
            label="Amount you received (₦)"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            hint={`Balance on the invoice: ${formatNaira(inv.balance)}`}
          />
          <Button onClick={doPreview} disabled={previewing || !amount}>
            Review receipt
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)}>
            Not accepted
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function PaymentsPage() {
  const { data } = usePendingQuery();
  const { data: receipts } = useAllReceiptsQuery();
  const [open, setOpen] = useState(null);
  const pending = data?.pending || [];
  const all = receipts?.receipts || [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-1 text-sm text-muted">
          Check each screenshot against your bank record. Nothing reaches the parent until you send the receipt.
        </p>
      </div>
      <Card title={`Waiting for you (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing to confirm.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((it) => (
              <PendingPayment key={it.payment.id} item={it} />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Receipts sent">
        {all.length === 0 ? (
          <p className="text-sm text-muted">No receipts yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {all.map((r) => (
              <li key={r.number} className="py-3">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                  onClick={() => setOpen(open === r.number ? null : r.number)}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.studentName}</span>
                  <span className="font-mono text-xs text-muted">{r.number}</span>
                  <span className="num text-sm">{formatNaira(r.paid)}</span>
                  <Badge tone={r.balance <= 0 ? 'good' : 'warn'}>
                    {r.balance <= 0 ? 'Paid in full' : 'Balance left'}
                  </Badge>
                </button>
                {open === r.number && (
                  <div className="mt-3">
                    <ReceiptPaper receipt={r} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
