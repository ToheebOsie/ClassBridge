import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { useLogoutMutation, useMeQuery } from '../store/api.js';
import { FeeSchedulesPage } from './FeeSchedulesPage.jsx';
import { InvoicesPage } from './InvoicesPage.jsx';
import { ParentInvoicesPage, ParentReceiptsPage } from './ParentInvoices.jsx';
import { ParentsPage } from './ParentsPage.jsx';
import { PaymentsPage } from './PaymentsPage.jsx';
import { StudentsPage } from './StudentsPage.jsx';
import { TeachersPage } from './TeachersPage.jsx';
import { ROLE_NAV } from './roles.js';

const SCHOOL = { name: 'Unity Heritage College', initials: 'UH' };

/** The signed-in home of a role: its own sidebar. Features are added to each sidebar as they are built. */
export function RoleHome() {
  const { role } = useParams();
  const { data, isLoading, isError } = useMeQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const [page, setPage] = useState(ROLE_NAV[role]?.[0]?.id);

  if (!ROLE_NAV[role]) return <Navigate to="/" replace />;
  if (isLoading) return <p className="p-10 text-muted">Loading…</p>;
  // Not signed in, or signed in as a different role: go to this role's own sign-in page.
  if (isError || !data || data.user.role !== role) return <Navigate to={`/${role}/sign-in`} replace />;

  const nav = ROLE_NAV[role];
  return (
    <AppShell school={SCHOOL} role={role} user={data.user.name} nav={nav} current={page} onNavigate={setPage}>
      {role === 'head' && page === 'students' ? (
        <StudentsPage />
      ) : role === 'head' && page === 'parents' ? (
        <ParentsPage />
      ) : role === 'head' && page === 'teachers' ? (
        <TeachersPage />
      ) : role === 'head' && page === 'fees' ? (
        <FeeSchedulesPage />
      ) : role === 'head' && page === 'invoices' ? (
        <InvoicesPage />
      ) : role === 'head' && page === 'payments' ? (
        <PaymentsPage />
      ) : role === 'parent' && page === 'invoices' ? (
        <ParentInvoicesPage />
      ) : role === 'parent' && page === 'receipts' ? (
        <ParentReceiptsPage />
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Welcome, {data.user.name}</h1>
          <p className="mt-1 text-sm text-muted">
            You are signed in as {role}. The pages in your sidebar are added as each feature is built.
          </p>
          <Card title="What you can do" className="mt-6">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.can.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={async () => {
                await logout();
                navigate(`/${role}/sign-in`, { replace: true });
              }}
            >
              Sign out
            </Button>
          </Card>
        </>
      )}
    </AppShell>
  );
}
