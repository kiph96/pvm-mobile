// Mirrors com.pvm.dto.* records of pvm-backend. Dates are ISO-8601 strings,
// money is a decimal number (BigDecimal serialised as JSON number).

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string; // yyyy-MM-dd
export type LocalTime = string; // HH:mm[:ss]

// ---------------------------------------------------------------- organization
export interface UserView { id: UUID; displayName: string; status: string }
export type OrgRole = 'owner' | 'admin' | 'payroll' | 'employee';
export interface MyOrganization { organizationId: UUID; name: string; role: OrgRole }
export interface StoreView {
  id: UUID; name: string; timezone: string; currency: string; status: string; openedAt: ISODateTime;
}
export interface OrganizationView {
  id: UUID; name: string; status: string; billingTimezone: string; myRole: OrgRole; stores: StoreView[];
}
export interface AccessKeyView { storeId: UUID; version: number; accessKey: string; expiresAt: ISODateTime }
export interface PolicyView {
  id: UUID; version: number; effectiveFrom: ISODateTime; employeeLimit: number;
  employeeLimitMode: 'advisory' | 'hard'; minStaff: number; optimalStaff: number; maxStaff: number;
  registrationMode: 'owner_approval' | 'automatic'; swapApprovalRequired: boolean; rules: PolicyRules | null;
}
export interface PolicyRules {
  registration?: { opens_days_before?: number; closes_hours_before?: number };
  /** Shifts made automatically from templates for the next days_ahead days (server defaults: on, 14, published). */
  schedule?: { auto_generate?: boolean; days_ahead?: number; auto_publish?: boolean };
  attendance?: { late_grace_minutes?: number; early_leave_grace_minutes?: number };
  points?: { allow_negative_balance?: boolean };
  violations?: Record<string, { points: number }>;
  awards?: Record<string, { points: number }>;
  rewards?: Record<string, { min_points: number; points_cost: number; amount: number; window: string }>;
  /** How worked time becomes pay (see src/utils/pay.ts). Absent on stores created before pay rules. */
  pay?: import('@/utils/pay').PayRulesJson | null;
  [key: string]: unknown;
}
export interface StoreCreated { store: StoreView; policy: PolicyView; accessKey: AccessKeyView }
export interface CreateStore { name: string; timezone: string; currency: string }
export interface UpdatePolicy {
  employeeLimit: number; employeeLimitMode: 'advisory' | 'hard'; minStaff: number; optimalStaff: number;
  maxStaff: number; registrationMode: 'owner_approval' | 'automatic'; swapApprovalRequired: boolean;
  rules?: PolicyRules | null;
}

// ------------------------------------------------------------------ employment
export interface MyEmploymentView {
  employmentId: UUID; storeId: UUID; storeName: string; storeTimeZone: string; role: string; status: string;
  startedAt: ISODateTime; currentWage: number | null; wageBasis: string | null; currency: string;
}
/** My own join request (employee side), named so it reads well before approval. */
export interface MyEnrollmentView {
  id: UUID; organizationId: UUID; organizationName: string; storeId: UUID; storeName: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; requestedAt: ISODateTime; decidedAt: ISODateTime | null;
}

export interface EnrollmentView {
  id: UUID; organizationId: UUID; storeId: UUID; userId: UUID; displayName: string; status: string;
  requestedAt: ISODateTime; decidedAt: ISODateTime | null; employmentId: UUID | null; warning: string | null;
}
export interface EmployeeView {
  employmentId: UUID; organizationId: UUID; storeId: UUID; userId: UUID; displayName: string; role: string;
  status: string; startedAt: ISODateTime; endedAt: ISODateTime | null; currentWage: number | null;
  wageBasis: string | null; currency: string;
}
export interface RateView {
  id: UUID; employmentId: UUID; basis: string; amount: number; currency: string;
  validFrom: ISODateTime; validTo: ISODateTime | null;
}

// -------------------------------------------------------------------- schedule
export interface TemplateView {
  id: UUID; storeId: UUID; name: string; localStart: LocalTime; localEnd: LocalTime; overnight: boolean;
  weekdays: number[]; minStaff: number | null; optimalStaff: number | null; maxStaff: number | null; status: string;
}
export interface CreateTemplate {
  storeId: UUID; name: string; localStart: LocalTime; localEnd: LocalTime; weekdays: number[];
  minStaff?: number | null; optimalStaff?: number | null; maxStaff?: number | null;
}
export type ShiftStatus = 'draft' | 'published' | 'cancelled' | 'closed';
export interface ShiftView {
  id: UUID; storeId: UUID; templateId: UUID | null; localDate: ISODate; timezone: string;
  startsAt: ISODateTime; endsAt: ISODateTime; minStaff: number; optimalStaff: number; maxStaff: number;
  status: ShiftStatus; assignedCount: number; belowMinimum: boolean; openSlots: number;
  /** Employees can sign up between these two instants (store policy: days before / hours before the start). */
  registrationOpensAt: ISODateTime; registrationClosesAt: ISODateTime;
}
export interface AssignmentView {
  id: UUID; shiftId: UUID; storeId: UUID; employmentId: UUID; userId: UUID | null; displayName: string;
  state: 'assigned' | 'completed' | 'no_show' | 'cancelled'; wageAmount: number | null; currency: string;
  startsAt: ISODateTime; endsAt: ISODateTime; replacesAssignmentId: UUID | null;
  /** 'hourly' | 'per_shift' (null when the wage is hidden from the viewer) */
  wageBasis?: string | null;
}
export interface RequestView {
  id: UUID; shiftId: UUID; storeId: UUID; employmentId: UUID; userId: UUID; displayName: string;
  status: 'pending' | 'waitlisted' | 'approved' | 'rejected' | 'cancelled'; requestedAt: ISODateTime;
  decidedAt: ISODateTime | null; assignmentId: UUID | null;
}
export interface ShiftDetail { shift: ShiftView; assignments: AssignmentView[]; requests: RequestView[] }
export interface GenerateResult { created: ShiftView[]; alreadyExisting: number; skippedPast: number; warnings: string[] }
export interface CreateShift {
  storeId: UUID; localDate: ISODate; localStart: LocalTime; localEnd: LocalTime;
  minStaff?: number | null; optimalStaff?: number | null; maxStaff?: number | null; publish: boolean;
}
export interface SwapView {
  id: UUID; status: 'requested' | 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  from: AssignmentView; to: AssignmentView; requestedByUserId: UUID; acceptedByUserId: UUID | null;
  approvedByUserId: UUID | null; expiresAt: ISODateTime; acceptedAt: ISODateTime | null;
  decidedAt: ISODateTime | null; newFromAssignmentId: UUID | null; newToAssignmentId: UUID | null;
}

// ----------------------------------------------------------------- performance
export type ClockType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
export interface AttendanceView {
  id: UUID; assignmentId: UUID; type: ClockType; occurredAt: ISODateTime; receivedAt: ISODateTime; source: string;
}
export interface ViolationView {
  id: UUID; employmentId: UUID; storeId: UUID; assignmentId: UUID | null; code: string; occurredAt: ISODateTime;
  status: 'reported' | 'confirmed' | 'dismissed' | 'reversed'; description: string; points: number | null;
  decidedAt: ISODateTime | null;
}
export interface CreateViolation {
  employmentId: UUID; assignmentId?: UUID | null; code: string; occurredAt?: ISODateTime | null; description: string;
}
export interface PointEntryView { id: UUID; delta: number; kind: string; reason: string; effectiveAt: ISODateTime }
export interface PointsView { employmentId: UUID; balance: number; entries: PointEntryView[] }
export interface AwardPoints { code?: string | null; points?: number | null; reason: string }

// --------------------------------------------------------------------- finance
export interface PeriodView {
  id: UUID; currency: string; startsAt: ISODateTime; endsAt: ISODateTime; label: string; status: string;
  closedAt: ISODateTime | null;
}
export interface RunView {
  id: UUID; periodId: UUID; runNumber: number; kind: string; status: string; finalizedAt: ISODateTime | null;
  lineCount: number; totalGross: number; currency: string; unresolvedTimesheets: number;
}
export interface PayslipLine {
  lineId: UUID; runId: UUID; kind: string; assignmentId: UUID | null; amount: number; details: Record<string, unknown>;
}
export interface Payslip {
  employmentId: UUID; userId: UUID; displayName: string; storeId: UUID; storeName: string; currency: string;
  wages: number; bonuses: number; adjustments: number; gross: number; lines: PayslipLine[];
}
export interface Estimate {
  planCode: string; currency: string; activeStores: number; activeEmployees: number; baseFee: number;
  storeFees: number; employeeFees: number; total: number;
}
export interface InvoiceLineView { code: string; quantity: number; unitAmount: number; amount: number; description: string }
export interface InvoiceView {
  id: UUID; invoiceNumber: string; kind: string; currency: string; periodStart: ISODateTime; periodEnd: ISODateTime;
  peakStores: number; peakEmployees: number; total: number; issuedAt: ISODateTime; dueAt: ISODateTime;
  lines: InvoiceLineView[];
}
export interface NotificationView {
  id: UUID; eventType: string; title: string | null; payload: Record<string, unknown>;
  availableAt: ISODateTime; deliveredAt: ISODateTime | null;
}

// --------------------------------------------------------------- daily digest
/** Owner's evening "tomorrow's shifts" notification (com.pvm.digest). sendAt is HH:mm in `timezone`. */
export interface DigestSettings {
  enabled: boolean; sendAt: string; language: 'vi' | 'en'; timezone: string;
  lastSentFor?: ISODate | null; nextSendAt?: ISODateTime | null;
}
export interface DigestShiftLine {
  shiftId: UUID; storeId: UUID; storeName: string; name: string | null; startsAt: ISODateTime; endsAt: ISODateTime;
  timezone: string; status: string; assigned: number; minStaff: number; optimalStaff: number; maxStaff: number; pendingRequests: number;
}
export interface StaffingDigest {
  date: ISODate; language: string; title: string; body: string;
  totals: { shifts: number; understaffedShifts: number; peopleMissing: number; belowIdealShifts: number; drafts: number; pendingRequests: number };
  stores: { storeId: UUID; storeName: string; shifts: number; peopleMissing: number; problems: DigestShiftLine[] }[];
}
