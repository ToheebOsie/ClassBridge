import { useState } from 'react';
import { CLASSES } from '@classbridge/shared';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SelectField, TextField } from '../components/Field.jsx';
import {
  errorText,
  useAddTeacherMutation,
  useEditTeacherMutation,
  useInviteTeacherMutation,
  useRemoveTeacherMutation,
  useRestoreTeacherMutation,
  useTeachersQuery,
} from '../store/api.js';

const STATUS = { invited: ['info', 'Invitation sent'], active: ['good', 'Active'], removed: ['neutral', 'Removed'] };
const NO_CLASS = 'None';
const subjectsOf = (text) =>
  text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Add form, also used to edit (email cannot change: it is the teacher's sign-in). */
function TeacherForm({ initial, onSaved, onCancel }) {
  const editing = Boolean(initial);
  const [add, addState] = useAddTeacherMutation();
  const [edit, editState] = useEditTeacherMutation();
  const [f, setF] = useState({
    fullName: initial?.fullName || '',
    email: initial?.email || '',
    formClass: initial?.formClass || NO_CLASS,
    subjects: (initial?.subjects || []).join(', '),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const state = editing ? editState : addState;
  const submit = async (e) => {
    e.preventDefault();
    const body = {
      fullName: f.fullName,
      formClass: f.formClass === NO_CLASS ? null : f.formClass,
      subjects: subjectsOf(f.subjects),
    };
    const res = editing ? await edit({ id: initial.id, ...body }) : await add({ ...body, email: f.email });
    if (!res.error) onSaved(res.data);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField label="Full name" value={f.fullName} onChange={set('fullName')} autoComplete="off" />
      <TextField
        label="School email"
        type="email"
        value={f.email}
        onChange={set('email')}
        disabled={editing}
        hint={
          editing
            ? 'The email is their sign-in, so it cannot be changed here.'
            : 'We email them a link to choose their own password.'
        }
      />
      <SelectField
        label="Form teacher of"
        value={f.formClass}
        onChange={set('formClass')}
        options={[NO_CLASS, ...CLASSES]}
      />
      <TextField
        label="Subjects (separate with commas)"
        value={f.subjects}
        onChange={set('subjects')}
        placeholder="Mathematics, Further Maths"
      />
      {state.error && (
        <p className="text-sm text-bad" role="alert">
          {errorText(state.error)}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className={onCancel ? '' : 'w-full'} disabled={state.isLoading}>
          {state.isLoading ? 'Saving…' : editing ? 'Save changes' : 'Add teacher and send invitation'}
        </Button>
      </div>
    </form>
  );
}

function TeacherRow({ t }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState(null); // { tone, text }
  const [invite, inviting] = useInviteTeacherMutation();
  const [remove] = useRemoveTeacherMutation();
  const [restore] = useRestoreTeacherMutation();
  const [tone, label] = STATUS[t.status];

  const sendLink = async () => {
    const res = await invite(t.id);
    setNote(
      res.error ? { tone: 'bad', text: errorText(res.error) } : { tone: 'good', text: `Link sent to ${t.email}.` },
    );
  };
  const act = async (fn) => {
    const res = await fn(t.id);
    setConfirm(false);
    if (res.error) setNote({ tone: 'bad', text: errorText(res.error) });
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{t.fullName}</p>
          <p className="break-all text-sm text-muted">{t.email}</p>
          <p className="mt-1 text-sm text-body">
            {t.formClass ? `Form teacher, ${t.formClass}` : 'No form class'}
            {t.subjects.length > 0 && ` · ${t.subjects.join(', ')}`}
          </p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      {editing ? (
        <div className="mt-3 rounded-lg border border-line bg-canvas p-4">
          <TeacherForm initial={t} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {t.status !== 'removed' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="secondary" size="sm" disabled={inviting.isLoading} onClick={sendLink}>
                {t.status === 'invited' ? 'Resend invitation' : 'Send new password link'}
              </Button>
              {confirm ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => act(remove)}>
                    Yes, remove {t.fullName.split(' ')[0]}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
                  Remove
                </Button>
              )}
            </>
          )}
          {t.status === 'removed' && (
            <Button variant="secondary" size="sm" onClick={() => act(restore)}>
              Restore
            </Button>
          )}
        </div>
      )}
      {confirm && (
        <p className="mt-2 text-sm text-muted">
          They will be signed out straight away and cannot sign in. Their records stay.
        </p>
      )}
      {note && (
        <p
          className={`mt-2 text-sm ${note.tone === 'good' ? 'text-good' : 'text-bad'}`}
          role={note.tone === 'bad' ? 'alert' : 'status'}
        >
          {note.text}
        </p>
      )}
    </li>
  );
}

/** The head's Teachers page: add teachers, see who has set a password, remove or restore. */
export function TeachersPage() {
  const { data } = useTeachersQuery();
  const [done, setDone] = useState(null);
  const teachers = data?.teachers || [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Teachers</h1>
        <p className="mt-1 text-sm text-muted">
          Teachers choose their own password from an email link. You never see or set it.
        </p>
      </div>
      {done && (
        <p className="rounded-lg border border-good bg-good-soft px-4 py-3 text-sm text-good" role="status">
          {done.teacher.fullName} was added.{' '}
          {done.invitationSent
            ? `An email with a link to choose a password was sent to ${done.teacher.email}.`
            : 'No email could be sent. Use “Resend invitation”.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card title="Add a teacher">
          <TeacherForm key={done?.teacher.id || 'new'} onSaved={setDone} />
        </Card>
        <Card title={`Teachers (${teachers.filter((t) => t.status !== 'removed').length})`}>
          {teachers.length === 0 ? (
            <p className="text-sm text-muted">No teachers yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {teachers.map((t) => (
                <TeacherRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
