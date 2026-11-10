import { useState } from 'react';
import { LEVELS, TERMS, formatNaira } from '@classbridge/shared';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { TextField } from '../components/Field.jsx';
import {
  errorText,
  useDeleteFeeScheduleMutation,
  useFeeSchedulesQuery,
  useSaveFeeScheduleMutation,
} from '../store/api.js';

const emptyItems = () => [{ name: '', amount: '' }];

/** The head's saved fees: one schedule per class level and term. Invoices copy from it; they never stay linked. */
export function FeeSchedulesPage() {
  const { data } = useFeeSchedulesQuery();
  const [save, saving] = useSaveFeeScheduleMutation();
  const [del] = useDeleteFeeScheduleMutation();
  const [pick, setPick] = useState({ level: LEVELS[0], term: TERMS[0] });
  const [title, setTitle] = useState('School fees');
  const [items, setItems] = useState(emptyItems());
  const [msg, setMsg] = useState(null);
  const schedules = data?.schedules || [];
  const find = (level, term) => schedules.find((s) => s.level === level && s.term === term);
  const current = find(pick.level, pick.term);
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const choose = (level, term) => {
    const s = find(level, term);
    setPick({ level, term });
    setTitle(s?.title || 'School fees');
    setItems(s ? s.items.map((i) => ({ name: i.name, amount: String(i.amount) })) : emptyItems());
    setMsg(null);
  };
  const setItem = (n, k, v) => setItems(items.map((it, i) => (i === n ? { ...it, [k]: v } : it)));
  const doSave = async () => {
    const res = await save({
      ...pick,
      title,
      items: items.filter((i) => i.name || i.amount).map((i) => ({ name: i.name, amount: Number(i.amount) })),
    });
    setMsg(
      res.error
        ? { bad: true, text: errorText(res.error) }
        : { text: `Saved the ${pick.level} fees for ${pick.term}.` },
    );
  };
  const doDelete = async () => {
    const res = await del(current.id);
    if (res.error) return setMsg({ bad: true, text: errorText(res.error) });
    choose(pick.level, pick.term);
    setMsg({ text: 'Removed.' });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Fee schedules</h1>
        <p className="mt-1 text-sm text-muted">
          Save the usual fees of each class level once. When you prepare an invoice, one tap fills them in. Changing a
          schedule later never changes invoices already sent.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card title="Saved fees" hint="Fees are the same for every arm of a level (JSS 1A and JSS 1B).">
          <ul className="space-y-4">
            {LEVELS.map((level) => (
              <li key={level}>
                <p className="mb-1.5 text-sm font-semibold text-ink">{level}</p>
                <div className="grid grid-cols-3 gap-2">
                  {TERMS.map((term) => {
                    const s = find(level, term);
                    const on = pick.level === level && pick.term === term;
                    return (
                      <button
                        key={term}
                        type="button"
                        aria-label={`${level}, ${term}`}
                        aria-pressed={on}
                        onClick={() => choose(level, term)}
                        className={`rounded-lg border px-2 py-2 text-left text-xs ${on ? 'border-accent bg-accent-soft' : 'border-line'}`}
                      >
                        <span className="block text-muted">{term.replace(' term', '')}</span>
                        <span className={`num block text-sm font-semibold ${s ? 'text-ink' : 'text-muted'}`}>
                          {s ? formatNaira(s.total) : 'Not set'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          title={`${pick.level}, ${pick.term}`}
          hint={current ? 'Saved. Edit and save to replace it.' : 'Nothing saved yet for this level and term.'}
        >
          <div className="space-y-3">
            <TextField label="Invoice title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">Fee items</legend>
              {items.map((it, n) => (
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
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, i) => i !== n))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setItems([...items, { name: '', amount: '' }])}>
                Add item
              </Button>
              <p className="num text-sm font-semibold text-ink">Total: {formatNaira(total)}</p>
            </fieldset>
            {msg && (
              <p className={`text-sm ${msg.bad ? 'text-bad' : 'text-good'}`} role={msg.bad ? 'alert' : 'status'}>
                {msg.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving.isLoading} onClick={doSave}>
                {saving.isLoading ? 'Saving…' : current ? 'Save changes' : 'Save fees'}
              </Button>
              {current && (
                <Button variant="danger" onClick={doDelete}>
                  Remove this schedule
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
