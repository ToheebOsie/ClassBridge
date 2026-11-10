import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { TextField } from '../components/Field.jsx';
import { errorText, useSetPasswordMutation } from '../store/api.js';

/** Where a parent or teacher lands from the invitation or reset link: /set-password?token=... */
export function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [setPassword, { isLoading, isSuccess, error, data }] = useSetPasswordMutation();
  const teacher = data?.role === 'teacher';
  const [password, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== again) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    await setPassword({ token, password });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <Card
        title={isSuccess ? 'Password saved' : 'Choose your password'}
        hint={isSuccess ? undefined : 'Use at least 8 characters. Only you will know it.'}
      >
        {isSuccess ? (
          <div className="space-y-4">
            <p>
              You can now sign in with {teacher ? 'your email address' : 'your phone number'} and your new password.
            </p>
            <Link
              to={teacher ? '/teacher/sign-in' : '/parent/sign-in'}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
            />
            <TextField
              label="Type it again"
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              error={mismatch ? 'The two passwords are not the same.' : undefined}
            />
            {error && (
              <p className="text-sm text-bad" role="alert">
                {errorText(error)}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || !token}>
              {isLoading ? 'Saving…' : 'Save password'}
            </Button>
            {!token && (
              <p className="text-sm text-bad">This link is incomplete. Open the link from your message again.</p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
