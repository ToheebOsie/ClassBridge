import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { schoolSlug } from '../lib/school.js';

/**
 * All server calls go through here (RTK Query: caching and loading states for free).
 * The browser sends the sign-in cookie automatically; the school is sent in `x-school`.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    // Absolute address (same origin): also lets the tests run outside a real browser.
    baseUrl: `${typeof window === 'undefined' ? 'http://localhost' : window.location.origin}/api`,
    credentials: 'same-origin',
    prepareHeaders: (headers) => {
      headers.set('x-school', schoolSlug());
      return headers;
    },
  }),
  tagTypes: [
    'Me',
    'Students',
    'Invoices',
    'Pending',
    'Receipts',
    'MyInvoices',
    'MyReceipts',
    'Staff',
    'Guardians',
    'Fees',
  ],
  endpoints: (build) => ({
    me: build.query({ query: () => '/me', providesTags: ['Me'] }),
    login: build.mutation({
      query: ({ role, ...body }) => ({ url: `/auth/${role}/login`, method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST', body: {} }),
      invalidatesTags: ['Me'],
    }),
    forgotPassword: build.mutation({ query: (body) => ({ url: '/auth/parent/forgot', method: 'POST', body }) }),
    students: build.query({ query: () => '/students', providesTags: ['Students'] }),
    onboardStudent: build.mutation({
      query: (body) => ({ url: '/students', method: 'POST', body }),
      invalidatesTags: ['Students', 'Guardians'],
    }),
    // head: invoices and payments
    invoices: build.query({ query: () => '/invoices', providesTags: ['Invoices'] }),
    recipients: build.mutation({ query: (body) => ({ url: '/invoices/preview', method: 'POST', body }) }),
    createInvoice: build.mutation({
      query: (body) => ({ url: '/invoices', method: 'POST', body }),
      invalidatesTags: ['Invoices', 'MyInvoices'],
    }),
    editInvoice: build.mutation({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Invoices', 'MyInvoices'],
    }),
    pending: build.query({ query: () => '/payments/pending', providesTags: ['Pending'] }),
    previewReceipt: build.mutation({
      query: ({ id, amount }) => ({ url: `/payments/${id}/preview`, method: 'POST', body: { amount } }),
    }),
    confirmPayment: build.mutation({
      query: ({ id, amount }) => ({ url: `/payments/${id}/confirm`, method: 'POST', body: { amount } }),
      invalidatesTags: ['Pending', 'Invoices', 'Receipts', 'MyInvoices', 'MyReceipts', 'Staff', 'Guardians', 'Fees'],
    }),
    rejectPayment: build.mutation({
      query: ({ id, reason }) => ({ url: `/payments/${id}/reject`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Pending', 'Invoices', 'MyInvoices'],
    }),
    allReceipts: build.query({ query: () => '/receipts/all', providesTags: ['Receipts'] }),
    // parent: invoices, payments and receipts
    myInvoices: build.query({ query: () => '/my/invoices', providesTags: ['MyInvoices'] }),
    markInvoicesSeen: build.mutation({
      query: () => ({ url: '/my/invoices/seen', method: 'POST', body: {} }),
      invalidatesTags: ['MyInvoices'],
    }),
    submitPayment: build.mutation({
      query: ({ invoiceId, ...body }) => ({ url: `/my/invoices/${invoiceId}/payments`, method: 'POST', body }),
      invalidatesTags: ['MyInvoices', 'Pending'],
    }),
    myReceipts: build.query({ query: () => '/my/receipts', providesTags: ['MyReceipts'] }),
    markReceiptsSeen: build.mutation({
      query: () => ({ url: '/my/receipts/seen', method: 'POST', body: {} }),
      invalidatesTags: ['MyReceipts'],
    }),
    // head: teachers, parents' invitations, saved fee schedules
    teachers: build.query({ query: () => '/staff', providesTags: ['Staff'] }),
    addTeacher: build.mutation({
      query: (body) => ({ url: '/staff', method: 'POST', body }),
      invalidatesTags: ['Staff'],
    }),
    editTeacher: build.mutation({
      query: ({ id, ...body }) => ({ url: `/staff/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Staff'],
    }),
    inviteTeacher: build.mutation({ query: (id) => ({ url: `/staff/${id}/invitation`, method: 'POST', body: {} }) }),
    removeTeacher: build.mutation({
      query: (id) => ({ url: `/staff/${id}/remove`, method: 'POST', body: {} }),
      invalidatesTags: ['Staff'],
    }),
    restoreTeacher: build.mutation({
      query: (id) => ({ url: `/staff/${id}/restore`, method: 'POST', body: {} }),
      invalidatesTags: ['Staff'],
    }),
    guardians: build.query({ query: () => '/guardians', providesTags: ['Guardians'] }),
    inviteGuardian: build.mutation({
      query: (id) => ({ url: `/guardians/${id}/invitation`, method: 'POST', body: {} }),
      invalidatesTags: ['Guardians'],
    }),
    feeSchedules: build.query({ query: () => '/fee-schedules', providesTags: ['Fees'] }),
    saveFeeSchedule: build.mutation({
      query: (body) => ({ url: '/fee-schedules', method: 'PUT', body }),
      invalidatesTags: ['Fees'],
    }),
    deleteFeeSchedule: build.mutation({
      query: (id) => ({ url: `/fee-schedules/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Fees'],
    }),
    setPassword: build.mutation({ query: (body) => ({ url: '/auth/parent/set-password', method: 'POST', body }) }),
  }),
});

export const {
  useMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useSetPasswordMutation,
  useStudentsQuery,
  useOnboardStudentMutation,
  useInvoicesQuery,
  useRecipientsMutation,
  useCreateInvoiceMutation,
  useEditInvoiceMutation,
  usePendingQuery,
  usePreviewReceiptMutation,
  useConfirmPaymentMutation,
  useRejectPaymentMutation,
  useAllReceiptsQuery,
  useMyInvoicesQuery,
  useMarkInvoicesSeenMutation,
  useSubmitPaymentMutation,
  useMyReceiptsQuery,
  useMarkReceiptsSeenMutation,
  useTeachersQuery,
  useAddTeacherMutation,
  useEditTeacherMutation,
  useInviteTeacherMutation,
  useRemoveTeacherMutation,
  useRestoreTeacherMutation,
  useGuardiansQuery,
  useInviteGuardianMutation,
  useFeeSchedulesQuery,
  useSaveFeeScheduleMutation,
  useDeleteFeeScheduleMutation,
} = api;

/** Turn an RTK Query error into a sentence for the screen. */
export const errorText = (err) => err?.data?.error || (err ? 'Something went wrong. Please try again.' : '');
