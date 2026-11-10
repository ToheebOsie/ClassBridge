import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { TextField } from '../components/Field.jsx';
import { errorText, useForgotPasswordMutation, useLoginMutation } from '../store/api.js';
import { ROLE_PAGES } from './roles.js';

/** One sign-in page per role: /parent/sign-in, /teacher/sign-in, /student/sign-in, /head/sign-in. */
export function SignIn() {
  const { role } = useParams();
  const page = ROLE_PAGES[role];
  const navigate = useNavigate();
  const [login, { isLoading, error }] = useLoginMutation();
  const [forgot, forgotState] = useForgotPasswordMutation();
  const [values, setValues] = useState({});
  if (!page) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const res = await login({ role, ...values });
    if (!res.error) navigate(`/${role}`, { replace: true });
  };
  const resetFor = () => forgot({ phone: values.phone || '' });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:py-16">
      <div className="min-w-0">
        <Link to="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-offset-4">
          <span
            className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-sm font-bold text-white"
            aria-hidden="true"
          >
            UH
          </span>
          <span>
            <span className="block text-base font-semibold leading-tight text-ink">Unity Heritage College</span>
            <span className="block text-xs text-muted">Powered by ClassBridge</span>
          </span>
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{page.title}</h1>
        <p className="mt-2 max-w-prose text-base text-body">{page.blurb}</p>
        <ul className="mt-6 space-y-3">
          {page.can.map((c) => (
            <li key={c} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <Card className="self-start">
        <form onSubmit={submit} className="space-y-4" noValidate>
          {page.fields.map((f) => (
            <TextField
              key={f.name}
              label={f.label}
              type={f.type}
              autoComplete={f.autoComplete}
              inputMode={f.inputMode}
              value={values[f.name] || ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          ))}
          {error && (
            <p className="text-sm text-bad" role="alert">
              {errorText(error)}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-muted">{page.note}</p>
          {page.forgot && (
            <div className="border-t border-line pt-4 text-sm">
              {forgotState.isSuccess ? (
                <p className="text-good" role="status">
                  {forgotState.data.message}
                </p>
              ) : (
                <button type="button" onClick={resetFor} className="font-medium text-accent hover:underline">
                  Forgot your password? Email me a link
                </button>
              )}
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
