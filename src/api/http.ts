import type * as T from './types';

export interface Actor {
  userId: string | null;
  organizationId: string | null;
  /** Bearer token from /api/auth; when present it replaces the dev X-User-Id header. */
  accessToken?: string | null;
}

/** Called once when the API answers 401 to a token request; returns a fresh access token or null. */
export type RefreshHandler = () => Promise<string | null>;

export interface UserView { id: string; displayName: string; status: string }
export interface AuthTokens {
  tokenType: 'Bearer'; accessToken: string; expiresIn: number; refreshToken: string; user: UserView; newUser: boolean;
  /** first name from Google/Facebook on a provider sign-in */
  givenName?: string | null;
}
export interface AuthProviders { google: boolean; facebook: boolean; dev: boolean }

/** Sign-in endpoints (no actor needed). */
export function createAuthApi(baseUrl: string) {
  const root = baseUrl.replace(/\/+$/, '');
  const post = async <R,>(path: string, body: unknown): Promise<R> => {
    let res: Response;
    try {
      res = await fetch(`${root}/api/auth${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network', `Cannot reach the server at ${root}.`);
    }
    const text = await res.text();
    const json = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const p = (json ?? {}) as { detail?: string; code?: string };
      throw new ApiError(res.status, p.code, p.detail || `Sign-in failed (${res.status})`);
    }
    return json as R;
  };
  return {
    providers: async (): Promise<AuthProviders> => {
      try {
        const res = await fetch(`${root}/api/auth/providers`);
        return res.ok ? await res.json() : { google: false, facebook: false, dev: false };
      } catch {
        return { google: false, facebook: false, dev: false };
      }
    },
    google: (idToken: string) => post<AuthTokens>('/google', { idToken }),
    facebook: (accessToken: string) => post<AuthTokens>('/facebook', { accessToken }),
    dev: (userId: string) => post<AuthTokens>('/dev', { userId }),
    refresh: (refreshToken: string) => post<AuthTokens>('/refresh', { refreshToken }),
    logout: (refreshToken: string) => post<void>('/logout', { refreshToken }).catch(() => undefined),
  };
}

/** Error raised for non-2xx responses; mirrors the backend ProblemDetail (detail + code). */
export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export function createHttpApi(baseUrl: string, actor: () => Actor, onUnauthorized?: RefreshHandler) {
  const root = baseUrl.replace(/\/+$/, '');

  async function send(method: Method, path: string, body: unknown, headers: Record<string, string>, token?: string | null) {
    const a = actor();
    const h: Record<string, string> = { Accept: 'application/json', ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const bearer = token ?? a.accessToken;
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    else if (a.userId) h['X-User-Id'] = a.userId;
    // a call may name another account explicitly
    if (a.organizationId && !h['X-Organization-Id']) h['X-Organization-Id'] = a.organizationId;
    try {
      return await fetch(root + '/api' + path, {
        method,
        headers: h,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network', `Cannot reach the server at ${root}. Check the server address and your connection.`);
    }
  }

  async function call<R>(method: Method, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<R> {
    let res = await send(method, path, body, headers);
    // Access tokens are short-lived: refresh once and retry.
    if (res.status === 401 && actor().accessToken && onUnauthorized) {
      const fresh = await onUnauthorized();
      if (fresh) res = await send(method, path, body, headers, fresh);
    }
    const text = await res.text();
    const json = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const p = (json ?? {}) as { detail?: string; title?: string; code?: string };
      const fallback = res.status === 401 ? 'You are not signed in to the server.' : `Request failed (${res.status})`;
      throw new ApiError(res.status, p.code, p.detail || p.title || fallback);
    }
    return json as R;
  }

  const q = (params: Record<string, string | undefined | null>) => {
    const s = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join('&');
    return s ? `?${s}` : '';
  };

  return {
    // organization
    createUser: (displayName: string, contactEmail?: string) =>
      call<T.UserView>('POST', '/users', { displayName, contactEmail: contactEmail || null }),
    me: () => call<T.UserView>('GET', '/me'),
    myOrganizations: () => call<T.MyOrganization[]>('GET', '/me/organizations'),
    organization: () => call<T.OrganizationView>('GET', '/organization'),
    stores: () => call<T.StoreView[]>('GET', '/stores'),
    /** Owner opens a store of a business type (their account is created with the first one). */
    openStore: (req: T.OpenStore) => call<T.StoreOpened>('POST', '/me/stores', req),
    updateStore: (storeId: string, req: T.UpdateStore) => call<T.StoreView>('PUT', `/stores/${storeId}`, req),
    closeStore: (storeId: string) => call<T.StoreView>('POST', `/stores/${storeId}/close`),
    rotateAccessKey: (storeId: string) => call<T.AccessKeyView>('POST', `/stores/${storeId}/access-key/rotate`),
    policy: (storeId: string) => call<T.PolicyView>('GET', `/stores/${storeId}/policy`),
    updatePolicy: (storeId: string, req: T.UpdatePolicy) => call<T.PolicyView>('PUT', `/stores/${storeId}/policy`, req),

    // employment
    joinStore: (accessKey: string) => call<T.EnrollmentView>('POST', '/enrollments', { accessKey }),
    myEnrollments: () => call<T.MyEnrollmentView[]>('GET', '/me/enrollments'),
    enrollments: (storeId?: string, status?: string) =>
      call<T.EnrollmentView[]>('GET', '/enrollments' + q({ storeId, status })),
    approveEnrollment: (id: string) => call<T.EnrollmentView>('POST', `/enrollments/${id}/approve`),
    rejectEnrollment: (id: string) => call<T.EnrollmentView>('POST', `/enrollments/${id}/reject`),
    employees: (storeId: string) => call<T.EmployeeView[]>('GET', `/stores/${storeId}/employees`),
    myEmployments: () => call<T.MyEmploymentView[]>('GET', '/me/employments'),
    setRate: (employmentId: string, amount: number, basis?: 'hourly' | 'per_shift') =>
      call<T.RateView>('PUT', `/employments/${employmentId}/rate`, { amount, basis }),
    rates: (employmentId: string) => call<T.RateView[]>('GET', `/employments/${employmentId}/rates`),
    endEmployment: (employmentId: string) => call<T.EmployeeView>('POST', `/employments/${employmentId}/end`),

    // schedule
    templates: (storeId: string) => call<T.TemplateView[]>('GET', `/stores/${storeId}/shift-templates`),
    createTemplate: (req: T.CreateTemplate) => call<T.TemplateView>('POST', '/shift-templates', req),
    archiveTemplate: (id: string) => call<T.TemplateView>('POST', `/shift-templates/${id}/archive`),
    generateShifts: (storeId: string, from: string, to: string, publish: boolean) =>
      call<T.GenerateResult>('POST', `/stores/${storeId}/shifts/generate`, { from, to, publish }),
    createShift: (req: T.CreateShift) => call<T.ShiftView>('POST', '/shifts', req),
    shifts: (storeId: string, from: string, to: string) =>
      call<T.ShiftView[]>('GET', `/stores/${storeId}/shifts` + q({ from, to })),
    shift: (id: string) => call<T.ShiftDetail>('GET', `/shifts/${id}`),
    publishShift: (id: string) => call<T.ShiftView>('POST', `/shifts/${id}/publish`),
    cancelShift: (id: string) => call<T.ShiftView>('POST', `/shifts/${id}/cancel`),
    updateStaffing: (id: string, minStaff: number, optimalStaff: number, maxStaff: number) =>
      call<T.ShiftView>('PUT', `/shifts/${id}/staffing`, { minStaff, optimalStaff, maxStaff }),
    registerForShift: (shiftId: string) => call<T.RequestView>('POST', `/shifts/${shiftId}/requests`),
    openRequests: (storeId?: string) => call<T.RequestView[]>('GET', '/shift-requests' + q({ storeId })),
    approveRequest: (id: string) => call<T.RequestView>('POST', `/shift-requests/${id}/approve`),
    rejectRequest: (id: string) => call<T.RequestView>('POST', `/shift-requests/${id}/reject`),
    cancelRequest: (id: string) => call<T.RequestView>('POST', `/shift-requests/${id}/cancel`),
    assign: (shiftId: string, employmentId: string) =>
      call<T.AssignmentView>('POST', `/shifts/${shiftId}/assignments`, { employmentId }),
    cancelAssignment: (id: string) => call<T.AssignmentView>('POST', `/assignments/${id}/cancel`),
    mySchedule: (from: string, to: string) => call<T.AssignmentView[]>('GET', '/me/schedule' + q({ from, to })),
    myRequests: () => call<T.RequestView[]>('GET', '/me/shift-requests'),
    proposeSwap: (fromAssignmentId: string, toAssignmentId: string) =>
      call<T.SwapView>('POST', '/swaps', { fromAssignmentId, toAssignmentId }),
    swaps: (status?: string) => call<T.SwapView[]>('GET', '/swaps' + q({ status })),
    swapAction: (id: string, action: 'accept' | 'decline' | 'cancel' | 'approve' | 'reject') =>
      call<T.SwapView>('POST', `/swaps/${id}/${action}`),

    // performance
    clock: (assignmentId: string, type: T.ClockType, idempotencyKey: string) =>
      call<T.AttendanceView>('POST', `/assignments/${assignmentId}/clock`, { type, idempotencyKey }),
    attendance: (assignmentId: string) => call<T.AttendanceView[]>('GET', `/assignments/${assignmentId}/attendance`),
    approveTimesheet: (assignmentId: string) =>
      call<unknown>('POST', `/assignments/${assignmentId}/timesheet`, {}),
    /** Owner: someone did not come (not paid), or did after all (paid the scheduled shift). */
    markAttendance: (assignmentId: string, outcome: 'worked' | 'no_show', reason: string) =>
      call<unknown>('POST', `/assignments/${assignmentId}/timesheet`, { outcome, reason }),
    reportViolation: (req: T.CreateViolation) => call<T.ViolationView>('POST', '/violations', req),
    violations: (params: { storeId?: string; status?: string; employmentId?: string } = {}) =>
      call<T.ViolationView[]>('GET', '/violations' + q(params)),
    violationAction: (id: string, action: 'confirm' | 'dismiss' | 'reverse') =>
      call<T.ViolationView>('POST', `/violations/${id}/${action}`, action === 'reverse' ? {} : undefined),
    points: (employmentId: string) => call<T.PointsView>('GET', `/employments/${employmentId}/points`),
    awardPoints: (employmentId: string, req: T.AwardPoints) =>
      call<T.PointsView>('POST', `/employments/${employmentId}/points`, req),

    // finance
    payrollPeriods: () => call<T.PeriodView[]>('GET', '/payroll/periods'),
    createPeriod: (currency: string, from: string, to: string, label?: string) =>
      call<T.PeriodView>('POST', '/payroll/periods', { currency, from, to, label }),
    payrollRuns: (periodId: string) => call<T.RunView[]>('GET', `/payroll/periods/${periodId}/runs`),
    runPayroll: (periodId: string) =>
      call<T.RunView>('POST', `/payroll/periods/${periodId}/runs`, undefined, { 'Idempotency-Key': `run-${periodId}-${Date.now()}` }),
    payslips: (runId: string) => call<T.Payslip[]>('GET', `/payroll/runs/${runId}/payslips`),
    myPayslips: () => call<T.Payslip[]>('GET', '/me/payslips'),
    plan: () => call<T.PlanView>('GET', '/billing/plan'),
    // sales during a shift
    shiftSales: (shiftId: string) => call<T.ShiftSales>('GET', `/shifts/${shiftId}/sales`),
    recordSale: (shiftId: string, req: T.RecordSale) => call<T.ShiftSales>('POST', `/shifts/${shiftId}/sales`, req),
    voidSale: (saleId: string, reason?: string) => call<T.ShiftSales>('POST', `/sales/${saleId}/void`, { reason: reason ?? null }),
    syncPlan: () => call<T.PlanView>('POST', '/billing/plan/sync'),
    devPurchase: (storeQuota: number) => call<T.PlanView>('POST', '/billing/plan/dev-purchase', { storeQuota }),
    notifications: () => call<T.NotificationView[]>('GET', '/notifications'),

    // owner's evening digest + push devices
    digestSettings: () => call<T.DigestSettings>('GET', '/me/daily-digest'),
    updateDigestSettings: (enabled: boolean, sendAt: string, language: 'vi' | 'en') =>
      call<T.DigestSettings>('PUT', '/me/daily-digest', { enabled, sendAt, language }),
    previewDigest: () => call<T.StaffingDigest>('POST', '/me/daily-digest/preview'),
    sendDigestNow: () => call<T.StaffingDigest>('POST', '/me/daily-digest/send-now'),
    registerDevice: (expoPushToken: string, platform: 'ios' | 'android') =>
      call<{ active: number }>('POST', '/me/devices', { expoPushToken, platform }),
    unregisterDevice: (expoPushToken: string) => call<void>('POST', '/me/devices/unregister', { expoPushToken }),
    devices: () => call<{ active: number }>('GET', '/me/devices'),
  };
}

export type Api = ReturnType<typeof createHttpApi>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}
