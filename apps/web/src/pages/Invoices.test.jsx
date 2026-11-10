import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../App.jsx';
import { makeStore } from '../store/index.js';
import { readScreenshot } from './ParentInvoices.jsx';

const inv = (o = {}) => ({
  id: 'i1',
  number: 'INV-2026-0001',
  studentId: '2025-J1A-AO-01',
  studentName: 'Adaeze Okafor',
  className: 'JSS 1A',
  title: 'School fees',
  term: 'First term',
  session: '2026/2027',
  dueDate: '2026-09-30',
  note: '',
  items: [{ name: 'Tuition', amount: 100000 }],
  payments: [],
  total: 100000,
  confirmed: 0,
  pending: 0,
  balance: 100000,
  room: 100000,
  status: 'unpaid',
  batchId: null,
  ...o,
});
const receipt = (o = {}) => ({
  number: null,
  invoiceNumber: 'INV-2026-0001',
  studentId: '2025-J1A-AO-01',
  studentName: 'Adaeze Okafor',
  className: 'JSS 1A',
  term: 'First term',
  session: '2026/2027',
  items: [{ name: 'Tuition', amount: 100000 }],
  total: 100000,
  before: 0,
  paid: 40000,
  balance: 60000,
  method: 'Bank transfer',
  reference: 'TRF1',
  paidOn: '2026-09-01',
  ...o,
});

/** A fake API. `routes` maps "METHOD /path" to a function returning the JSON reply. */
function fakeApi(user, routes) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const path = new URL(req.url).pathname;
      if (path === '/api/me') return Response.json({ user, can: [] });
      const body = req.method === 'GET' ? null : await req.json().catch(() => null);
      calls.push({ key: `${req.method} ${path}`, body });
      const fn = routes[`${req.method} ${path}`];
      return fn ? Response.json(fn(body)) : new Response('{}', { status: 404 });
    }),
  );
  return calls;
}
afterEach(() => vi.unstubAllGlobals());
const open = async (role, label) => {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[`/${role}`]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: label }));
};
const HEAD = { id: 'h', name: 'Principal', role: 'head' };
const PARENT = { id: 'p', name: 'Mrs Okafor', role: 'parent' };

test('class invoice: review lists who gets it, then sends only to those left ticked', async () => {
  const students = { students: [] };
  const rec = {
    students: [
      { id: 'a', name: 'Adaeze Okafor', className: 'JSS 1A', alreadyHasIt: false, leftOut: false },
      { id: 'b', name: 'Bayo Ade', className: 'JSS 1A', alreadyHasIt: true, leftOut: false },
    ],
    willSend: [{ id: 'a' }],
  };
  const calls = fakeApi(HEAD, {
    'GET /api/students': () => students,
    'GET /api/invoices': () => ({ invoices: [] }),
    'POST /api/invoices/preview': () => rec,
    'POST /api/invoices': () => ({ created: [{ id: 'x' }], skippedAlreadyHad: 1, batchId: 'b1' }),
  });
  await open('head', 'Invoices');
  fireEvent.click(await screen.findByLabelText('JSS 1A'));
  fireEvent.change(screen.getByLabelText('Pay by'), { target: { value: '2026-09-30' } });
  fireEvent.change(screen.getByLabelText('Item 1 amount'), { target: { value: '100000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review who gets it' }));
  expect(await screen.findByText('Already has it')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Send 1 invoice' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  const sent = calls.find((c) => c.key === 'POST /api/invoices').body;
  expect(sent.mode).toBe('class');
  expect(sent.classes).toEqual(['JSS 1A']);
  expect(sent.items).toEqual([{ name: 'Tuition', amount: 100000 }]);
});

test('receipt is reviewed first and only sent on the second click', async () => {
  const calls = fakeApi(HEAD, {
    'GET /api/payments/pending': () => ({
      pending: [
        {
          invoice: inv({ pending: 40000 }),
          payment: { id: 'p1', amount: 40000, method: 'Bank transfer', reference: 'TRF1', status: 'pending' },
        },
      ],
    }),
    'GET /api/receipts/all': () => ({ receipts: [] }),
    'POST /api/payments/p1/preview': () => ({ receipt: receipt() }),
    'POST /api/payments/p1/confirm': () => ({ alreadyConfirmed: false, receipt: receipt({ number: 'RCP-2026-0001' }) }),
  });
  await open('head', 'Payments');
  fireEvent.click(await screen.findByRole('button', { name: 'Review receipt' }));
  expect(await screen.findByText('Assigned when sent')).toBeTruthy();
  expect(calls.some((c) => c.key.endsWith('/confirm'))).toBe(false); // nothing sent yet
  fireEvent.click(screen.getByRole('button', { name: 'Go back and change' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review receipt' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Send receipt to parent' }));
  await waitFor(() => expect(calls.filter((c) => c.key.endsWith('/confirm'))).toHaveLength(1));
  expect(calls.find((c) => c.key.endsWith('/confirm')).body).toEqual({ amount: 40000 });
});

test('rejecting needs a reason and sends it', async () => {
  const calls = fakeApi(HEAD, {
    'GET /api/payments/pending': () => ({
      pending: [
        { invoice: inv(), payment: { id: 'p1', amount: 40000, method: 'POS', reference: '', status: 'pending' } },
      ],
    }),
    'GET /api/receipts/all': () => ({ receipts: [] }),
    'POST /api/payments/p1/reject': () => ({ ok: true }),
  });
  await open('head', 'Payments');
  fireEvent.click(await screen.findByRole('button', { name: 'Not accepted' }));
  fireEvent.change(screen.getByLabelText('Why is it not accepted?'), { target: { value: 'Not in our bank record' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send back to parent' }));
  await waitFor(() =>
    expect(calls.find((c) => c.key.endsWith('/reject')).body).toEqual({ reason: 'Not in our bank record' }),
  );
});

test('a parent cannot send a payment without a screenshot', async () => {
  const calls = fakeApi(PARENT, {
    'GET /api/my/invoices': () => ({ invoices: [inv()] }),
    'POST /api/my/invoices/seen': () => ({ ok: true }),
  });
  await open('parent', 'Invoices');
  fireEvent.click(await screen.findByRole('button', { name: 'Send payment to the school' }));
  expect(await screen.findByText('Attach the screenshot of your payment receipt.')).toBeTruthy();
  expect(calls.some((c) => c.key.includes('/payments'))).toBe(false);
});

test('screenshot pre-check refuses a wrong type and an oversized picture', async () => {
  await expect(readScreenshot(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(/picture/);
  const big = new File(['x'], 'a.png', { type: 'image/png' });
  Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
  await expect(readScreenshot(big)).rejects.toThrow(/5 MB/);
  await expect(readScreenshot(new File(['x'], 'a.png', { type: 'image/png' }))).resolves.toMatch(/^data:image\/png/);
});

test('parent sees receipts, and a rejected payment shows its reason', async () => {
  fakeApi(PARENT, {
    'GET /api/my/invoices': () => ({
      invoices: [
        inv({
          payments: [
            { id: 'p', amount: 1000, date: '2026-09-01', status: 'rejected', rejectReason: 'Not in our bank record' },
          ],
        }),
      ],
    }),
    'POST /api/my/invoices/seen': () => ({ ok: true }),
    'GET /api/my/receipts': () => ({ receipts: [receipt({ number: 'RCP-2026-0001' })] }),
    'POST /api/my/receipts/seen': () => ({ ok: true }),
  });
  await open('parent', 'Invoices');
  expect(await screen.findByText('Not in our bank record')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Fee receipts' }));
  expect(await screen.findByText('RCP-2026-0001')).toBeTruthy();
});
