import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { formatNaira, invoiceStatus, invoiceTotal, balance } from '@classbridge/shared';
import { setAccent } from '../store/uiSlice.js';
import { AppShell } from '../components/AppShell.jsx';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { SelectField, TextField } from '../components/Field.jsx';
import { Stat } from '../components/Stat.jsx';

/**
 * Component gallery: every building block in use on a realistic head's Invoices page.
 * It is the visual reference for the design system (docs/ui/design-system.md).
 * Sample data only.
 */
const SCHOOL = { name: 'Unity Heritage College', initials: 'UH' };
const NAV = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'reports', label: 'Report sheets', icon: 'doc' },
  { id: 'promotion', label: 'Promotion', icon: 'up', alert: true },
  { id: 'students', label: 'Students and IDs', icon: 'people' },
  { id: 'invoices', label: 'Invoices', icon: 'invoice', alert: true },
  { id: 'receipts', label: 'Receipts', icon: 'card' },
];
const PAYMENT = (amount, status) => ({ amount, status });
const INVOICES = [
  {
    id: 1,
    no: 'INV-2026-0002',
    student: 'Adaeze Okafor',
    items: [
      { name: 'Tuition', amount: 150000 },
      { name: 'Books', amount: 25000 },
      { name: 'PTA levy', amount: 5000 },
    ],
    payments: [],
  },
  {
    id: 2,
    no: 'INV-2026-0001',
    student: 'Chinedu Eze',
    items: [
      { name: 'Tuition', amount: 150000 },
      { name: 'Books', amount: 25000 },
      { name: 'PTA levy', amount: 5000 },
    ],
    payments: [PAYMENT(100000, 'confirmed'), PAYMENT(50000, 'pending')],
  },
  {
    id: 3,
    no: 'INV-2026-0003',
    student: 'Fatima Garba',
    items: [
      { name: 'Tuition', amount: 150000 },
      { name: 'Books', amount: 25000 },
      { name: 'PTA levy', amount: 5000 },
    ],
    payments: [PAYMENT(180000, 'confirmed')],
  },
];
const STATUS = { paid: ['good', 'Paid in full'], part: ['warn', 'Part paid'], unpaid: ['bad', 'Unpaid'] };
const SWATCHES = [
  ['Indigo', '#2740a0'],
  ['Green', '#0f6b4d'],
  ['Maroon', '#8a1c3c'],
  ['Teal', '#0e6f7e'],
];

export function Gallery() {
  const dispatch = useDispatch();
  const accent = useSelector((s) => s.ui.accent);
  const [page, setPage] = useState('invoices');
  const [term, setTerm] = useState('First term');

  // Apply the school's colour to the whole page.
  useEffect(() => {
    document.documentElement.style.setProperty('--school-accent', accent);
  }, [accent]);

  const columns = [
    { key: 'no', header: 'No.', render: (r) => <span className="font-mono text-[13px] text-muted">{r.no}</span> },
    { key: 'student', header: 'Student', render: (r) => <span className="font-medium text-ink">{r.student}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => formatNaira(invoiceTotal(r)) },
    { key: 'balance', header: 'Balance', align: 'right', render: (r) => formatNaira(balance(r)) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const [tone, text] = STATUS[invoiceStatus(r)];
        return <Badge tone={tone}>{text}</Badge>;
      },
    },
  ];

  return (
    <AppShell school={SCHOOL} role="head" user="Principal's office" nav={NAV} current={page} onNavigate={setPage}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-muted">
            Prepare fees for a student or a whole class and confirm what parents pay.
          </p>
        </div>
        <Button>Prepare an invoice</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat value="₦1,980,000" label="Billed this term" note="11 invoices, JSS 2A" />
        <Stat value="₦280,000" label="Confirmed so far" note="2 payments" />
        <Stat value="1" label="Payment to confirm" note="Waiting for you" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title="Invoices sent"
          hint="Newest first"
          action={
            <Button variant="secondary" size="sm">
              Filter
            </Button>
          }
        >
          <DataTable columns={columns} rows={INVOICES} rowKey="id" />
        </Card>

        <div className="space-y-5">
          <Card title="Quick invoice" hint="Form controls">
            <div className="space-y-4">
              <SelectField
                label="Term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                options={['First term', 'Second term', 'Third term']}
              />
              <TextField label="Pay by" type="date" defaultValue="2026-11-15" />
              <TextField label="Fee item" placeholder="For example, Tuition" error="Give the fee item a name" />
              <div className="flex gap-2">
                <Button className="flex-1">Send</Button>
                <Button variant="secondary" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>

          <Card title="School colour" hint="Each school sets its own accent">
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map(([name, hex]) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => dispatch(setAccent(hex))}
                  aria-pressed={accent === hex}
                  className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft"
                >
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: hex }} />
                  {name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="good">Confirmed</Badge>
              <Badge tone="warn">Waiting</Badge>
              <Badge tone="bad">Not accepted</Badge>
              <Badge tone="info">Revised</Badge>
              <Badge>Draft</Badge>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
