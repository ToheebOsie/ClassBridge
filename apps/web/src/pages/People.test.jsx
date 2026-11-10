import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../App.jsx';
import { makeStore } from '../store/index.js';

const HEAD = { id: 'h', name: 'Principal', role: 'head' };
const teacher = (o = {}) => ({
  id: 't1',
  fullName: 'Mrs Funke Bello',
  email: 'funke@school.ng',
  formClass: 'JSS 1A',
  subjects: ['Maths'],
  status: 'invited',
  ...o,
});

/** A fake API. Each route function receives the JSON body and returns [status, json] or json. */
function fakeApi(routes, user = HEAD, start = '/head') {
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
      if (!fn) return new Response('{}', { status: 404 });
      const out = fn(body);
      return Array.isArray(out) ? Response.json(out[1], { status: out[0] }) : Response.json(out);
    }),
  );
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[start]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  return calls;
}
afterEach(() => vi.unstubAllGlobals());
const nav = async (label) => fireEvent.click(await screen.findByRole('button', { name: label }));

test('adding a teacher sends the form and says an email invitation went out', async () => {
  const calls = fakeApi({
    'GET /api/staff': () => ({ teachers: [] }),
    'POST /api/staff': (b) => [
      201,
      { teacher: teacher({ fullName: b.fullName, email: b.email }), invitationSent: true },
    ],
  });
  await nav('Teachers');
  fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Mrs Funke Bello' } });
  fireEvent.change(screen.getByLabelText('School email'), { target: { value: 'funke@school.ng' } });
  fireEvent.change(screen.getByLabelText('Form teacher of'), { target: { value: 'JSS 1A' } });
  fireEvent.change(screen.getByLabelText('Subjects (separate with commas)'), { target: { value: 'Maths, Physics' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add teacher and send invitation' }));
  expect(await screen.findByText(/was added/)).toBeTruthy();
  expect(calls.find((c) => c.key === 'POST /api/staff').body).toEqual({
    fullName: 'Mrs Funke Bello',
    email: 'funke@school.ng',
    formClass: 'JSS 1A',
    subjects: ['Maths', 'Physics'],
  });
});

test('a duplicate email or taken form class shows the reason', async () => {
  fakeApi({
    'GET /api/staff': () => ({ teachers: [] }),
    'POST /api/staff': () => [409, { error: 'Someone with this email already has an account.' }],
  });
  await nav('Teachers');
  fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Mrs Funke Bello' } });
  fireEvent.change(screen.getByLabelText('School email'), { target: { value: 'funke@school.ng' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add teacher and send invitation' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/already has an account/);
});

test('resend invitation: the wait message is shown when the school tries too soon', async () => {
  let n = 0;
  fakeApi({
    'GET /api/staff': () => ({ teachers: [teacher()] }),
    'POST /api/staff/t1/invitation': () =>
      n++ ? [429, { error: 'Please wait 10 minutes before sending another.' }] : { ok: true },
  });
  await nav('Teachers');
  fireEvent.click(await screen.findByRole('button', { name: 'Resend invitation' }));
  expect(await screen.findByText('Link sent to funke@school.ng.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Resend invitation' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/wait 10 minutes/));
});

test('removing a teacher asks first and does nothing until confirmed', async () => {
  const calls = fakeApi({
    'GET /api/staff': () => ({ teachers: [teacher({ status: 'active' })] }),
    'POST /api/staff/t1/remove': () => ({ teacher: teacher({ status: 'removed' }) }),
  });
  await nav('Teachers');
  fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
  expect(screen.getByText(/signed out straight away/)).toBeTruthy();
  expect(calls.some((c) => c.key.endsWith('/remove'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Yes, remove Mrs/ }));
  await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/staff/t1/remove')).toBe(true));
});

test('parents page: shows who is waiting and resends their invitation', async () => {
  const guardians = [
    {
      id: 'g1',
      fullName: 'Mrs Okafor',
      phone: '08035550142',
      email: 'o@x.ng',
      status: 'expired',
      children: [{ id: 's1', fullName: 'Adaeze Okafor', className: 'JSS 1A' }],
    },
    { id: 'g2', fullName: 'Mr Bello', phone: '08031112222', email: null, status: 'active', children: [] },
  ];
  const calls = fakeApi({
    'GET /api/guardians': () => ({ guardians }),
    'POST /api/guardians/g1/invitation': () => ({ ok: true }),
  });
  await nav('Parents');
  expect(await screen.findByText('Needs an invitation')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Waiting' }));
  expect(screen.queryByText('Mr Bello')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  expect(await screen.findByText(/Invitation sent to 08035550142 and o@x.ng/)).toBeTruthy();
  expect(calls.filter((c) => c.key === 'POST /api/guardians/g1/invitation')).toHaveLength(1);
});

test('fee schedules: pick a level and term, enter fees, save', async () => {
  const calls = fakeApi({
    'GET /api/fee-schedules': () => ({ schedules: [] }),
    'PUT /api/fee-schedules': (b) => ({ schedule: { id: 'f1', ...b, total: 125000, updatedAt: 'x' } }),
  });
  await nav('Fee schedules');
  fireEvent.click(await screen.findByRole('button', { name: 'JSS 2, Second term' }));
  fireEvent.change(screen.getByLabelText('Item 1 name'), { target: { value: 'Tuition' } });
  fireEvent.change(screen.getByLabelText('Item 1 amount'), { target: { value: '120000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save fees' }));
  expect(await screen.findByText('Saved the JSS 2 fees for Second term.')).toBeTruthy();
  expect(calls.find((c) => c.key === 'PUT /api/fee-schedules').body).toEqual({
    level: 'JSS 2',
    term: 'Second term',
    title: 'School fees',
    items: [{ name: 'Tuition', amount: 120000 }],
  });
});

test('invoice editor fills in the saved fees for the chosen level and can save new ones', async () => {
  const saved = {
    id: 'f1',
    level: 'JSS 1',
    term: 'First term',
    title: 'School fees',
    items: [
      { name: 'Tuition', amount: 120000 },
      { name: 'PTA', amount: 5000 },
    ],
    total: 125000,
    updatedAt: 'x',
  };
  fakeApi({
    'GET /api/students': () => ({ students: [] }),
    'GET /api/invoices': () => ({ invoices: [] }),
    'GET /api/fee-schedules': () => ({ schedules: [saved] }),
  });
  await nav('Invoices');
  fireEvent.click(await screen.findByLabelText('JSS 1A'));
  expect(await screen.findByText(/Saved JSS 1 fees for First term/)).toBeTruthy();
  await waitFor(() => expect(screen.getByLabelText('Item 2 name').value).toBe('PTA'));
  expect(screen.getByLabelText('Item 1 amount').value).toBe('120000');
  // two levels at once: the editor warns instead of guessing
  fireEvent.click(screen.getByLabelText('JSS 2A'));
  expect(await screen.findByText(/different levels/)).toBeTruthy();
});

test('a teacher who follows the invitation link is sent to the teacher sign-in', async () => {
  fakeApi(
    { 'POST /api/auth/parent/set-password': () => ({ ok: true, role: 'teacher' }) },
    undefined,
    '/set-password?token=abcdefghijklmnopqrstuvwxyz',
  );
  fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'funke-pass-1' } });
  fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'funke-pass-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
  expect(await screen.findByText(/your email address/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Go to sign in' }).getAttribute('href')).toBe('/teacher/sign-in');
});
