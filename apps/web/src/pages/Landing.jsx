import { Link } from 'react-router-dom';
import { Card } from '../components/Card.jsx';
import { ROLE_PAGES } from './roles.js';

/** The school's front page: the badge and name first, then a sign-in page for each role. */
export function Landing() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-base font-bold text-white"
          aria-hidden="true"
        >
          UH
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Unity Heritage College</h1>
          <p className="text-sm text-muted">Powered by ClassBridge</p>
        </div>
      </div>
      <p className="mt-8 text-base">Who is signing in?</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(ROLE_PAGES).map(([role, p]) => (
          <Link key={role} to={`/${role}/sign-in`} className="block rounded-card focus-visible:outline-offset-4">
            <Card className="h-full transition-colors hover:border-accent">
              <p className="font-semibold text-ink">{p.title.replace(' sign in', '')}</p>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
