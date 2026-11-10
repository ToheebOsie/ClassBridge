import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from '../App.jsx';
import { makeStore } from '../store/index.js';

/** Fake server: answers the API calls the sign-in pages make. */
function fakeApi(handlers) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const url = new URL(req.url).pathname;
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.json().catch(() => undefined);
      calls.push({ url, method: req.method, body, school: req.headers.get('x-school') });
      const res = handlers[`${req.method} ${url}`]?.(body) ?? { status: 404, json: { error: 'nope' } };
      return new Response(JSON.stringify(res.json), {
        status: res.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}
const renderAt = (path) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
afterEach(() => vi.unstubAllGlobals());

describe('sign-in pages', () => {
  test('each role has its own page with its own fields', () => {
    fakeApi({});
    const { unmount } = renderAt('/head/sign-in');
    expect(screen.getByRole('heading', { name: 'School head sign in' })).toBeTruthy();
    expect(screen.getByLabelText('Security code')).toBeTruthy();
    unmount();
    renderAt('/parent/sign-in');
    expect(screen.getByLabelText('Phone number the school has on file')).toBeTruthy();
    expect(screen.queryByLabelText('Security code')).toBeNull();
  });

  test('wrong details show the server message and stay on the page', async () => {
    const calls = fakeApi({
      'POST /api/auth/parent/login': () => ({
        status: 401,
        json: { error: 'Those details do not match. Check them and try again.' },
      }),
      'GET /api/me': () => ({ status: 401, json: {} }),
    });
    renderAt('/parent/sign-in');
    fireEvent.change(screen.getByLabelText('Phone number the school has on file'), {
      target: { value: '08035550142' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/do not match/);
    expect(calls.find((c) => c.url === '/api/auth/parent/login').body).toEqual({
      phone: '08035550142',
      password: 'wrong',
    });
    expect(calls[0].school).toBe('unity');
  });

  test('successful sign-in opens that role’s home with its sidebar and sign out works', async () => {
    let signedIn = false;
    fakeApi({
      'POST /api/auth/parent/login': () => {
        signedIn = true;
        return { json: { user: { id: '1', name: 'Mrs Okafor', role: 'parent' } } };
      },
      'GET /api/me': () =>
        signedIn
          ? { json: { user: { id: '1', name: 'Mrs Okafor', role: 'parent' }, can: ['invoice.view-own'] } }
          : { status: 401, json: {} },
      'POST /api/auth/logout': () => {
        signedIn = false;
        return { json: { ok: true } };
      },
    });
    renderAt('/parent/sign-in');
    fireEvent.change(screen.getByLabelText('Phone number the school has on file'), {
      target: { value: '08035550142' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'right-pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Welcome, Mrs Okafor')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'parent menu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invoices' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Parent sign in' })).toBeTruthy();
  });

  test('a signed-in parent cannot open the head’s home', async () => {
    fakeApi({ 'GET /api/me': () => ({ json: { user: { id: '1', name: 'Mrs Okafor', role: 'parent' }, can: [] } }) });
    renderAt('/head');
    expect(await screen.findByRole('heading', { name: 'School head sign in' })).toBeTruthy();
  });

  test('forgot password emails a link and gives the same message', async () => {
    const calls = fakeApi({
      'POST /api/auth/parent/forgot': () => ({
        json: { ok: true, message: 'If that number has an email on file, we have sent a link to it.' },
      }),
    });
    renderAt('/parent/sign-in');
    fireEvent.change(screen.getByLabelText('Phone number the school has on file'), {
      target: { value: '08035550142' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Email me a link/ }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(calls.find((c) => c.url === '/api/auth/parent/forgot').body).toEqual({ phone: '08035550142' });
  });
});

describe('choose a password', () => {
  test('mismatched passwords are caught before sending; matching ones are sent with the token', async () => {
    const calls = fakeApi({ 'POST /api/auth/parent/set-password': () => ({ json: { ok: true } }) });
    renderAt('/set-password?token=abc123abc123abc123abc123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'first-choice-1' } });
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'different-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByText('The two passwords are not the same.')).toBeTruthy();
    expect(calls.length).toBe(0);
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'first-choice-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(screen.getByText('Password saved')).toBeTruthy());
    expect(calls[0].body).toEqual({ token: 'abc123abc123abc123abc123', password: 'first-choice-1' });
  });

  test('a link without a token cannot be submitted', () => {
    fakeApi({});
    renderAt('/set-password');
    expect(screen.getByRole('button', { name: 'Save password' }).disabled).toBe(true);
  });
});
