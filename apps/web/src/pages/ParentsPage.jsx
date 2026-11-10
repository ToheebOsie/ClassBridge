import { useState } from 'react';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { errorText, useGuardiansQuery, useInviteGuardianMutation } from '../store/api.js';

const STATUS = {
  active: ['good', 'Has a password'],
  invited: ['info', 'Invitation sent, waiting'],
  expired: ['warn', 'Needs an invitation'],
};

function ParentRow({ g }) {
  const [invite, { isLoading }] = useInviteGuardianMutation();
  const [note, setNote] = useState(null);
  const [tone, label] = STATUS[g.status];
  const send = async () => {
    const res = await invite(g.id);
    setNote(
      res.error
        ? { bad: true, text: errorText(res.error) }
        : { text: `Invitation sent to ${g.phone}${g.email ? ' and ' + g.email : ''}.` },
    );
  };
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{g.fullName}</p>
          <p className="text-sm text-muted">
            {g.phone}
            {g.email ? ` · ${g.email}` : ' · no email on file'}
          </p>
          <p className="mt-1 text-sm text-body">
            {g.children.map((c) => `${c.fullName}${c.className ? ` (${c.className})` : ''}`).join(', ') ||
              'No children linked'}
          </p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant={g.status === 'active' ? 'secondary' : 'primary'} size="sm" disabled={isLoading} onClick={send}>
          {g.status === 'active'
            ? 'Send a link to choose a new password'
            : g.status === 'invited'
              ? 'Resend invitation'
              : 'Send invitation'}
        </Button>
        {g.status === 'active' && <span className="text-xs text-muted">Only if they lost their password.</span>}
      </div>
      {note && (
        <p className={`mt-2 text-sm ${note.bad ? 'text-bad' : 'text-good'}`} role={note.bad ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
    </li>
  );
}

/** Parents and their invitations. A parent without a password can be sent the invitation again. */
export function ParentsPage() {
  const { data } = useGuardiansQuery();
  const [show, setShow] = useState('all');
  const all = data?.guardians || [];
  const waiting = all.filter((g) => g.status !== 'active');
  const shown = show === 'waiting' ? waiting : all;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Parents</h1>
        <p className="mt-1 text-sm text-muted">
          Each parent signs in with their phone number and a password they choose from the invitation. You can send it
          again if they missed it.
        </p>
      </div>
      <Card
        title={`${all.length} parent${all.length === 1 ? '' : 's'}`}
        hint={waiting.length ? `${waiting.length} still without a password.` : 'Everyone has a password.'}
        action={
          <div
            className="inline-flex rounded-lg border border-line-strong p-0.5"
            role="group"
            aria-label="Which parents"
          >
            {[
              ['all', 'All'],
              ['waiting', 'Waiting'],
            ].map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={show === k}
                onClick={() => setShow(k)}
                className={`h-8 rounded-md px-3 text-sm font-semibold ${show === k ? 'bg-accent text-white' : 'text-muted'}`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <p className="text-sm text-muted">
            {show === 'waiting' ? 'Nobody is waiting.' : 'No parents yet. They appear when you onboard a student.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((g) => (
              <ParentRow key={g.id} g={g} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
