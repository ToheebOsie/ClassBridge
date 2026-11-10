/**
 * What each role's sign-in page says and asks for, and the sidebar of its home page.
 * Keep in step with packages/shared/src/permissions.js and docs/decisions/0005-parent-sign-in.md.
 */
export const ROLE_PAGES = {
  parent: {
    title: 'Parent sign in',
    blurb: 'See how your child is doing and download approved report sheets. You see only your own children.',
    can: [
      'Fortnightly scores and teacher notes',
      'Invoices, payments and fee receipts',
      "Your child's report sheet when the school allows it",
    ],
    fields: [
      { name: 'phone', label: 'Phone number the school has on file', type: 'tel', autoComplete: 'username' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
    ],
    note: 'The first time, use the link the school sent you on WhatsApp and email to choose your own password.',
    forgot: true,
  },
  teacher: {
    title: 'Teacher sign in',
    blurb: 'Score assessments, run CBT exams and download exam papers for your classes.',
    can: ['Enter fortnightly scores', 'Run and monitor CBT exams', 'Download exam papers as PDF or Word'],
    fields: [
      { name: 'email', label: 'School email', type: 'email', autoComplete: 'username' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
    ],
    note: 'Staff accounts are made by the school head. Forgot your password? Ask the head to reset it.',
  },
  student: {
    title: 'Student sign in',
    blurb: 'Check your progress and take exams your teacher has opened.',
    can: ['See your scores and your goal', 'Sit exams your teacher has started', 'Share short feedback about lessons'],
    fields: [
      { name: 'studentId', label: 'Student ID', type: 'text', autoComplete: 'username' },
      { name: 'pin', label: 'PIN', type: 'password', autoComplete: 'current-password', inputMode: 'numeric' },
    ],
    note: 'Your Student ID and PIN are given to you by your school.',
  },
  head: {
    title: 'School head sign in',
    blurb: 'Approve report sheets, decide promotions, manage teachers, invoices and payments.',
    can: ['Approve report sheets and promotions', 'Add and remove teachers', 'Prepare invoices and confirm payments'],
    fields: [
      { name: 'email', label: 'Email', type: 'email', autoComplete: 'username' },
      { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
      { name: 'securityCode', label: 'Security code', type: 'password', autoComplete: 'one-time-code' },
    ],
    note: 'The head signs in with an extra security code for safety.',
  },
};

/** Sidebar of each role's home page. Items are added as the features are built. */
export const ROLE_NAV = {
  parent: [
    { id: 'progress', label: 'Progress', icon: 'chart' },
    { id: 'invoices', label: 'Invoices', icon: 'invoice' },
    { id: 'receipts', label: 'Fee receipts', icon: 'card' },
  ],
  teacher: [
    { id: 'assessments', label: 'Assessments', icon: 'chart' },
    { id: 'cbt', label: 'CBT exams', icon: 'doc' },
    { id: 'papers', label: 'Exam papers', icon: 'doc' },
  ],
  student: [
    { id: 'progress', label: 'My progress', icon: 'chart' },
    { id: 'exams', label: 'Exams', icon: 'doc' },
  ],
  head: [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'students', label: 'Students and IDs', icon: 'people' },
    { id: 'parents', label: 'Parents', icon: 'people' },
    { id: 'teachers', label: 'Teachers', icon: 'people' },
    { id: 'invoices', label: 'Invoices', icon: 'invoice' },
    { id: 'fees', label: 'Fee schedules', icon: 'doc' },
    { id: 'payments', label: 'Payments', icon: 'card' },
  ],
};
