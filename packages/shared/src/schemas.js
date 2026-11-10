/**
 * Zod schemas: the single description of valid data. The API checks every
 * request against them and the forms in the web and mobile apps reuse them.
 */
import { z } from 'zod';
import { LEVELS } from './ids.js';

export const TERMS = ['First term', 'Second term', 'Third term'];

export const invoiceItemSchema = z.object({
  name: z.string().trim().min(1, 'Give the fee item a name'),
  amount: z.number().int('Use whole naira').positive('Amount must be more than zero'),
});

export const invoiceInputSchema = z.object({
  title: z.string().trim().min(1).default('School fees'),
  term: z.enum(TERMS),
  session: z.string().regex(/^\d{4}\/\d{4}$/, 'Use a session like 2026/2027'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date to pay by'),
  note: z.string().max(500).default(''),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one fee item'),
});

export const paymentSubmissionSchema = z.object({
  amount: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(['Bank transfer', 'Cash deposit', 'POS', 'Online']),
  reference: z.string().max(80).default(''),
  note: z.string().max(300).default(''),
  screenshot: z.string().min(1, 'Attach the screenshot of your payment receipt'),
});

/* Sign-in. One schema per role, because each role has its own sign-in page. */
export const parentLoginSchema = z.object({ phone: z.string().trim().min(6), password: z.string().min(1) });
export const teacherLoginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export const headLoginSchema = teacherLoginSchema.extend({ securityCode: z.string().trim().min(1) });
export const studentLoginSchema = z.object({ studentId: z.string().trim().min(1), pin: z.string().trim().min(1) });
export const resetRequestSchema = z.object({ phone: z.string().trim().min(6) });
export const resetCompleteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8, 'Use at least 8 characters'),
});

/** Classes in the school, e.g. "JSS 1A", "SS 3B". */
export const classNameSchema = z
  .string()
  .trim()
  .regex(/^(JSS|SS) [1-3][A-Z]$/, 'Use a class like JSS 1A or SS 3B');

/** Onboarding a student, together with the parent or guardian who will see their records. */
export const studentOnboardSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Enter the full name')
    .refine((n) => n.split(/\s+/).length >= 2, 'Enter first name and last name'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth')
    .refine((d) => new Date(d) < new Date(), 'Date of birth must be in the past'),
  admissionNo: z.string().trim().min(1, 'Enter the admission number'),
  enrolYear: z.number().int().min(2000).max(2100),
  enrolClass: classNameSchema,
  guardian: z.object({
    fullName: z.string().trim().min(2, 'Enter the parent or guardian name'),
    phone: z.string().trim().min(6, 'Enter the parent or guardian phone number'),
    email: z.string().trim().email('That email does not look right').optional().or(z.literal('')),
  }),
});

/** Creating invoices: for one student, or for every student in one or more classes. */
export const invoiceCreateSchema = invoiceInputSchema
  .extend({
    mode: z.enum(['student', 'class']),
    studentId: z.string().optional(),
    classes: z.array(classNameSchema).default([]),
    skipStudentIds: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'student' && !v.studentId)
      ctx.addIssue({ code: 'custom', path: ['studentId'], message: 'Choose a student' });
    if (v.mode === 'class' && v.classes.length === 0)
      ctx.addIssue({ code: 'custom', path: ['classes'], message: 'Choose at least one class' });
  });

/** Editing an invoice that was already sent. `applyToBatch` = every invoice sent together with it. */
export const invoiceEditSchema = invoiceInputSchema.extend({ applyToBatch: z.boolean().default(false) });

export const paymentConfirmSchema = z.object({ amount: z.number().int().positive('Enter the amount you received') });
export const paymentRejectSchema = z.object({ reason: z.string().trim().min(3, 'Tell the parent why').max(300) });

/** Adding a teacher. The teacher chooses their own password from an emailed link, so none is set here. */
export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(3, 'Enter the teacher’s full name'),
  email: z.string().trim().toLowerCase().email('That email does not look right'),
  formClass: classNameSchema.nullable().optional().or(z.literal('')),
  subjects: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});
export const staffUpdateSchema = staffCreateSchema.omit({ email: true });

/** The usual fees of one class level for one term. Copied into an invoice when used, never linked. */
export const feeScheduleSchema = z.object({
  level: z.enum(LEVELS),
  term: z.enum(TERMS),
  title: z.string().trim().min(1).max(60).default('School fees'),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one fee item').max(30),
});
