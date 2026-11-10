import { useState } from 'react';
import { CLASSES, formatNaira, levelOf } from '@classbridge/shared';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SelectField, TextField } from '../components/Field.jsx';
import { InvoicePaper } from '../components/Papers.jsx';
import {
  errorText,
  useCreateInvoiceMutation,
  useFeeSchedulesQuery,
  useSaveFeeScheduleMutation,
  useEditInvoiceMutation,
  useInvoicesQuery,
  useRecipientsMutation,
  useStudentsQuery,
} from '../store/api.js';

const TERMS = ['First term', 'Second term', 'Third term'];
const STATUS = { paid: ['good', 'Paid in full'], part: ['warn', 'Part paid'], unpaid: ['neutral', 'Not paid'] };
const blank = () => ({
  mode: 'class',
  studentId: '',
  classes: [],
  title: 'School fees',
  term: 'First term',
  session: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
  dueDate: '',
  note: '',
  items: [{ name: 'Tuition', amount: '' }],
});

/** The body the API expects, from the form. */
const toInput = (f, skip = []) => ({
  title: f.title,
  term: f.term,
  session: f.session,
  dueDate: f.dueDate,
  note: f.note,
  items: f.items.filter((i) => i.name || i.amount).map((i) => ({ name: i.name, amount: Number(i.amount) })),
  ...(f.mode === 'class'
    ? { mode: 'class', classes: f.classes, skipStudentIds: skip }
    : { mode: 'student', studentId: f.studentId }),
});

/** The head's invoice editor: one student or whole classes, then a review step before anything is sent. */
function Editor({ onSent }) {
  const { data: studentData } = useStudentsQuery();
  const [form, setForm] = useState(blank());
  const [skip, setSkip] = useState([]);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [recipients] = useRecipientsMutation();
  const { data: feeData } = useFeeSchedulesQuery();
  const [saveSchedule, saving] = useSaveFeeScheduleMutation();
  const [feeNote, setFeeNote] = useState('');
  const [create, { isLoading }] = useCreateInvoiceMutation();
  const students = (studentData?.students || []).filter((s) => s.status === 'active');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const total = form.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const setItem = (n, k, v) =>
    setForm({ ...form, items: form.items.map((it, i) => (i === n ? { ...it, [k]: v } : it)) });
  const toggleClass = (c) =>
    setForm({
      ...form,
      classes: form.classes.includes(c) ? form.classes.filter((x) => x !== c) : [...form.classes, c],
    });

  /* Saved fees: which level is this invoice for, and is there a saved schedule for it? */
  const chosenClass = students.find((x) => x.id === form.studentId)?.currentClass;
  const levels = [...new Set((form.mode === 'class' ? form.classes : chosenClass ? [chosenClass] : []).map(levelOf))];
  const schedule =
    levels.length === 1
      ? (feeData?.schedules || []).find((x) => x.level === levels[0] && x.term === form.term)
      : undefined;
  const untouched = form.items.every((i) => !i.amount); // no amounts typed yet
  const applySaved = (sch = schedule) =>
    setForm((f) => ({
      ...f,
      title: sch.title,
      items: sch.items.map((i) => ({ name: i.name, amount: String(i.amount) })),
    }));
  const itemsValid = form.items.some((i) => i.name && Number(i.amount) > 0);
  const saveAsSchedule = async () => {
    const res = await saveSchedule({
      level: levels[0],
      term: form.term,
      title: form.title,
      items: toInput(form).items,
    });
    setFeeNote(res.error ? errorText(res.error) : `Saved as the ${levels[0]} fees for ${form.term}.`);
  };
  // Fill the fees in automatically, but only while the person has not started typing their own.
  const autoKey = schedule ? `${schedule.id}:${schedule.updatedAt}` : '';
  const [filledFor, setFilledFor] = useState('');
  if (schedule && untouched && filledFor !== autoKey) {
    setFilledFor(autoKey);
    applySaved(schedule);
  }

  const toReview = async () => {
    setError('');
    const res = await recipients(toInput({ ...form, mode: 'class' }, skip));
    if (res.error) return setError(errorText(res.error));
    setReview(res.data);
  };
  const send = async (skipIds = skip) => {
    setError('');
    const res = await create(toInput(form, skipIds));
    if (res.error) return setError(errorText(res.error));
    setReview(null);
    setForm(blank());
    setSkip([]);
    onSent(res.data);
  };
  if (review) {
    const willSend = review.students.filter((s) => !s.alreadyHasIt && !skip.includes(s.id)).length;
    return (
      <Card title="Review before sending" hint="Untick any student who should not get this invoice.">
        <ul className="divide-y divide-line rounded-lg border border-line">
          {review.students.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Send to ${s.name}`}
                checked={!s.alreadyHasIt && !skip.includes(s.id)}
                disabled={s.alreadyHasIt}
                onChange={() => setSkip(skip.includes(s.id) ? skip.filter((x) => x !== s.id) : [...skip, s.id])}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.name}</span>
              <span className="text-muted">{s.className}</span>
              {s.alreadyHasIt && <Badge tone="info">Already has it</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          This will create <strong>{willSend}</strong> invoice{willSend === 1 ? '' : 's'} of {formatNaira(total)} each
          and message the parents on WhatsApp.
        </p>
        {error && (
          <p className="mt-2 text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setReview(null)}>
            Back
          </Button>
          <Button disabled={!willSend || isLoading} onClick={() => send()}>
            {isLoading ? 'Sending…' : `Send ${willSend} invoice${willSend === 1 ? '' : 's'}`}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="New invoice" hint="Classmates usually pay the same fees, so you can send to a whole class at once.">
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-4">
        <div className="inline-flex rounded-lg border border-line-strong p-0.5" role="group" aria-label="Who is it for">
          {[
            ['class', 'Whole class'],
            ['student', 'One student'],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={form.mode === m}
              onClick={() => setForm({ ...form, mode: m })}
              className={`h-8 rounded-md px-3 text-sm font-semibold ${form.mode === m ? 'bg-accent text-white' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.mode === 'class' ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Classes</legend>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm"
                >
                  <input type="checkbox" checked={form.classes.includes(c)} onChange={() => toggleClass(c)} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <SelectField
            label="Student"
            value={form.studentId}
            onChange={set('studentId')}
            options={['', ...students.map((s) => s.id)]}
          />
        )}
        <TextField label="Title" value={form.title} onChange={set('title')} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Term" value={form.term} onChange={set('term')} options={TERMS} />
          <TextField label="Session" value={form.session} onChange={set('session')} />
        </div>
        <TextField label="Pay by" type="date" value={form.dueDate} onChange={set('dueDate')} />
        {levels.length > 1 && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            These classes are in different levels, which usually have different fees. Send each level as its own invoice
            to use its saved fees.
          </p>
        )}
        {schedule && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              Saved {levels[0]} fees for {form.term}: <strong className="num">{formatNaira(schedule.total)}</strong>
            </span>
            <Button variant="secondary" size="sm" onClick={() => applySaved()}>
              Use saved fees
            </Button>
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-ink">Fee items</legend>
          {form.items.map((it, n) => (
            <div key={n} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2">
              <input
                aria-label={`Item ${n + 1} name`}
                value={it.name}
                onChange={(e) => setItem(n, 'name', e.target.value)}
                className="h-10 rounded-lg border border-line-strong px-3 text-sm"
                placeholder="e.g. Tuition"
              />
              <input
                aria-label={`Item ${n + 1} amount`}
                inputMode="numeric"
                value={it.amount}
                onChange={(e) => setItem(n, 'amount', e.target.value.replace(/\D/g, ''))}
                className="num h-10 rounded-lg border border-line-strong px-3 text-sm"
                placeholder="₦"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove item ${n + 1}`}
                disabled={form.items.length === 1}
                onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== n) })}
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setForm({ ...form, items: [...form.items, { name: '', amount: '' }] })}
          >
            Add item
          </Button>
          <p className="num text-sm font-semibold text-ink">Total: {formatNaira(total)}</p>
          {levels.length === 1 &&
            itemsValid &&
            (!schedule || JSON.stringify(schedule.items) !== JSON.stringify(toInput(form).items)) && (
              <Button variant="ghost" size="sm" disabled={saving.isLoading} onClick={saveAsSchedule}>
                {schedule
                  ? `Replace the saved ${levels[0]} fees with these`
                  : `Save these as the ${levels[0]} fees for ${form.term}`}
              </Button>
            )}
          {feeNote && (
            <p className="text-sm text-good" role="status">
              {feeNote}
            </p>
          )}
        </fieldset>
        <TextField label="Note to parents (optional)" value={form.note} onChange={set('note')} />
        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}
        {form.mode === 'class' ? (
          <Button className="w-full" onClick={toReview}>
            Review who gets it
          </Button>
        ) : (
          <Button className="w-full" disabled={isLoading} onClick={() => send([])}>
            {isLoading ? 'Sending…' : 'Send invoice'}
          </Button>
        )}
      </form>
    </Card>
  );
}

/** Edit an invoice already sent; optionally for its whole class batch. */
function EditPanel({ inv, onClose }) {
  const [edit, { isLoading }] = useEditInvoiceMutation();
  const [items, setItems] = useState(inv.items.map((i) => ({ ...i, amount: String(i.amount) })));
  const [dueDate, setDueDate] = useState(inv.dueDate);
  const [batch, setBatch] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async () => {
    const res = await edit({
      id: inv.id,
      title: inv.title,
      term: inv.term,
      session: inv.session,
      dueDate,
      note: inv.note || '',
      items: items.map((i) => ({ name: i.name, amount: Number(i.amount) })),
      applyToBatch: batch,
    });
    if (res.error) return setMsg(errorText(res.error));
    onClose();
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3">
      {items.map((it, n) => (
        <div key={n} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <input
            aria-label={`Item ${n + 1} name`}
            value={it.name}
            className="h-10 rounded-lg border border-line-strong px-3 text-sm"
            onChange={(e) => setItems(items.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)))}
          />
          <input
            aria-label={`Item ${n + 1} amount`}
            value={it.amount}
            inputMode="numeric"
            className="num h-10 rounded-lg border border-line-strong px-3 text-sm"
            onChange={(e) =>
              setItems(items.map((x, i) => (i === n ? { ...x, amount: e.target.value.replace(/\D/g, '') } : x)))
            }
          />
        </div>
      ))}
      <TextField label="Pay by" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      {inv.batchId && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={batch} onChange={(e) => setBatch(e.target.checked)} />
          Apply to everyone in this batch ({inv.batchLabel})
        </label>
      )}
      {msg && (
        <p className="text-sm text-bad" role="alert">
          {msg}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={isLoading} onClick={save}>
          {isLoading ? 'Saving…' : 'Save and notify parents'}
        </Button>
      </div>
    </div>
  );
}

/** Every invoice sent, with who has paid. */
function List() {
  const { data } = useInvoicesQuery();
  const [batch, setBatch] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const all = data?.invoices || [];
  const batches = [...new Map(all.filter((i) => i.batchId).map((i) => [i.batchId, i.batchLabel])).entries()];
  const shown = batch ? all.filter((i) => i.batchId === batch) : all;
  const sum = (k) => shown.reduce((s, i) => s + i[k], 0);
  return (
    <Card title="Invoices sent">
      {all.length === 0 ? (
        <p className="text-sm text-muted">No invoices yet.</p>
      ) : (
        <>
          {batches.length > 0 && (
            <SelectField
              label="Show"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              options={['', ...batches.map(([id]) => id)]}
              className="mb-3 max-w-xs"
            />
          )}
          <p className="num mb-3 text-sm text-muted">
            {shown.length} invoices · billed {formatNaira(sum('total'))} · confirmed {formatNaira(sum('confirmed'))} ·
            outstanding {formatNaira(sum('balance'))}
          </p>
          <ul className="divide-y divide-line">
            {shown.map((i) => {
              const [tone, text] = STATUS[i.status];
              return (
                <li key={i.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setOpen(open === i.id ? null : i.id)}
                    >
                      <span className="block truncate font-medium text-ink">{i.studentName}</span>
                      <span className="font-mono text-xs text-muted">
                        {i.number} · {i.className}
                      </span>
                    </button>
                    <span className="num text-sm">{formatNaira(i.total)}</span>
                    <Badge tone={tone}>{text}</Badge>
                    {i.pending > 0 && <Badge tone="info">Waiting for you</Badge>}
                  </div>
                  {open === i.id && (
                    <div className="mt-3">
                      <InvoicePaper inv={i} />
                      {editing === i.id ? (
                        <EditPanel inv={i} onClose={() => setEditing(null)} />
                      ) : (
                        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(i.id)}>
                          Edit invoice
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

export function InvoicesPage({ onSent }) {
  const [sent, setSent] = useState(null);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted">
          Prepare an invoice once and send it to a class. Each student still gets their own.
        </p>
      </div>
      {sent && (
        <p className="rounded-lg border border-good bg-good-soft px-4 py-3 text-sm text-good" role="status">
          Sent {sent.created.length} invoice{sent.created.length === 1 ? '' : 's'}
          {sent.skippedAlreadyHad ? `, ${sent.skippedAlreadyHad} skipped because they already had it` : ''}. Parents
          were messaged on WhatsApp.
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Editor
          onSent={(r) => {
            setSent(r);
            onSent?.(r);
          }}
        />
        <List />
      </div>
    </div>
  );
}
