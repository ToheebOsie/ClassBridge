import { useState } from 'react';
import { CLASSES } from '@classbridge/shared';
import { Badge } from '../components/Badge.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { SelectField, TextField } from '../components/Field.jsx';
import { errorText, useOnboardStudentMutation, useStudentsQuery } from '../store/api.js';

const blank = () => ({
  fullName: '',
  dateOfBirth: '',
  admissionNo: '',
  enrolYear: String(new Date().getFullYear()),
  enrolClass: 'JSS 1A',
  gName: '',
  gPhone: '',
  gEmail: '',
});
const STATUS = {
  active: ['good', 'Enrolled'],
  graduated: ['info', 'Graduated, in archive'],
  left: ['neutral', 'Left, in archive'],
};

/**
 * The head's "Students and IDs" page. Onboarding issues the Student ID (never changes, kept after
 * graduation), a PIN for the student, and sends the parent an invitation to choose a password.
 */
export function StudentsPage() {
  const { data } = useStudentsQuery();
  const [onboard, { isLoading, error, reset }] = useOnboardStudentMutation();
  const [form, setForm] = useState(blank());
  const [done, setDone] = useState(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const res = await onboard({
      fullName: form.fullName,
      dateOfBirth: form.dateOfBirth,
      admissionNo: form.admissionNo,
      enrolYear: Number(form.enrolYear),
      enrolClass: form.enrolClass,
      guardian: { fullName: form.gName, phone: form.gPhone, email: form.gEmail },
    });
    if (!res.error) {
      setDone(res.data);
      setForm(blank());
    }
  };

  const columns = [
    { key: 'id', header: 'Student ID', render: (s) => <span className="font-mono text-[13px] text-ink">{s.id}</span> },
    { key: 'fullName', header: 'Name', render: (s) => <span className="font-medium text-ink">{s.fullName}</span> },
    { key: 'currentClass', header: 'Class', render: (s) => s.currentClass || '–' },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const [tone, text] = STATUS[s.status] || STATUS.active;
        return <Badge tone={tone}>{text}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Students and IDs</h1>
        <p className="mt-1 text-sm text-muted">
          Every student gets one ID at onboarding. It never changes and stays with them after graduation.
        </p>
      </div>

      {done && (
        <Card title="Student onboarded" className="border-good">
          <p>Give the student these sign-in details. The PIN is shown only now, so write it down.</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Name</dt>
              <dd className="font-medium text-ink">{done.student.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Student ID</dt>
              <dd className="font-mono font-semibold text-ink">{done.student.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">PIN</dt>
              <dd className="font-mono font-semibold text-ink">{done.pin}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-body">
            {done.invitationSent
              ? 'The parent was sent an invitation on WhatsApp and email to choose their password.'
              : done.guardian.existing
                ? 'The parent already has an account. This child now appears on it, and no new message was sent.'
                : 'The parent has no email or WhatsApp invitation sent yet. Resend it from the parent’s record.'}
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => setDone(null)}>
            Done
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card title="Onboard a student" hint="One form for the student and their parent or guardian.">
          <form onSubmit={submit} className="space-y-4" noValidate onChange={() => error && reset()}>
            <TextField
              label="Student's full name"
              value={form.fullName}
              onChange={set('fullName')}
              autoComplete="off"
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
              <TextField
                label="Admission number"
                value={form.admissionNo}
                onChange={set('admissionNo')}
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Year enrolled" type="number" value={form.enrolYear} onChange={set('enrolYear')} />
              <SelectField label="Class" value={form.enrolClass} onChange={set('enrolClass')} options={CLASSES} />
            </div>
            <p className="border-t border-line pt-4 text-sm font-medium text-ink">Parent or guardian</p>
            <TextField label="Full name" value={form.gName} onChange={set('gName')} autoComplete="off" />
            <TextField
              label="Phone number (WhatsApp)"
              type="tel"
              value={form.gPhone}
              onChange={set('gPhone')}
              hint="Their sign-in name. A parent with several children uses one number."
            />
            <TextField
              label="Email"
              type="email"
              value={form.gEmail}
              onChange={set('gEmail')}
              hint="Used for the invitation and to reset a forgotten password."
            />
            {error && (
              <p className="text-sm text-bad" role="alert">
                {errorText(error)}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Onboard student'}
            </Button>
          </form>
        </Card>

        <Card title="All students" hint="Including graduated students, whose records are kept in the archive.">
          <DataTable columns={columns} rows={data?.students || []} rowKey="id" />
          {data && data.students.length === 0 && (
            <p className="mt-3 text-sm text-muted">No students yet. Onboard the first one.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
