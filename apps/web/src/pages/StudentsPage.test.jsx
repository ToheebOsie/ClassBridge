import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../App.jsx';
import { makeStore } from '../store/index.js';

const HEAD = { user: { id: 'h', name: 'Principal', role: 'head' }, can: ['students.onboard'] };
function fakeApi({ onboard }) {
  const posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      const path = new URL(req.url).pathname;
      if (path === '/api/me') return Response.json(HEAD);
      if (path === '/api/students' && req.method === 'GET')
        return Response.json({
          students: [
            { id: '2025-J1A-AO-01', fullName: 'Adaeze Okafor', currentClass: 'JSS 1A', status: 'active' },
            { id: '2019-J1A-CO-01', fullName: 'Chiamaka Obi', currentClass: null, status: 'graduated' },
          ],
        });
      if (path === '/api/students' && req.method === 'POST') {
        posts.push(await req.json());
        return onboard();
      }
      return new Response('{}', { status: 404 });
    }),
  );
  return posts;
}
afterEach(() => vi.unstubAllGlobals());
const open = async () => {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/head']}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Students and IDs' }));
};
const fill = () => {
  fireEvent.change(screen.getByLabelText("Student's full name"), { target: { value: 'Tobiloba Adeyemi' } });
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-02-03' } });
  fireEvent.change(screen.getByLabelText('Admission number'), { target: { value: 'UHC/2025/105' } });
  fireEvent.change(screen.getByLabelText('Full name', { selector: 'input' }), { target: { value: 'Mr Adeyemi' } });
  fireEvent.change(screen.getByLabelText('Phone number (WhatsApp)'), { target: { value: '08031234567' } });
};

test('the head sees every student, with graduated ones marked as archived', async () => {
  fakeApi({ onboard: () => Response.json({}) });
  await open();
  expect(await screen.findByText('2025-J1A-AO-01')).toBeTruthy();
  expect(screen.getByText('Graduated, in archive')).toBeTruthy();
});

test('onboarding sends the form and shows the ID and PIN once', async () => {
  const posts = fakeApi({
    onboard: () =>
      Response.json(
        {
          student: { id: '2025-J1A-TA-01', fullName: 'Tobiloba Adeyemi' },
          pin: '4821',
          guardian: { existing: false },
          invitationSent: true,
        },
        { status: 201 },
      ),
  });
  await open();
  await screen.findByText('2025-J1A-AO-01');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Onboard student' }));
  expect(await screen.findByText('Student onboarded')).toBeTruthy();
  expect(screen.getByText('2025-J1A-TA-01')).toBeTruthy();
  expect(screen.getByText('4821')).toBeTruthy();
  expect(screen.getByText(/invitation on WhatsApp and email/)).toBeTruthy();
  expect(posts[0]).toMatchObject({
    fullName: 'Tobiloba Adeyemi',
    enrolClass: 'JSS 1A',
    guardian: { fullName: 'Mr Adeyemi', phone: '08031234567' },
  });
  expect(typeof posts[0].enrolYear).toBe('number');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByText('4821')).toBeNull();
});

test('a duplicate student shows the server message', async () => {
  fakeApi({
    onboard: () =>
      Response.json(
        { error: 'This student is already enrolled with ID 2025-J1A-AO-01. A student is never given a second ID.' },
        { status: 409 },
      ),
  });
  await open();
  await screen.findByText('2025-J1A-AO-01');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Onboard student' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/never given a second ID/);
});
