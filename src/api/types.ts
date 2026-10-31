// Mirrors com.pvm.dto.* records of pvm-backend. Dates are ISO-8601 strings,
// money is a decimal number (BigDecimal serialised as JSON number).

export type UUID = string;
export type ISODateTime = string;
export type ISODate = string; // yyyy-MM-dd
export type LocalTime = string; // HH:mm[:ss]

// ---------------------------------------------------------------- organization
export interface UserView { id: UUID; displayName: string; status: string }
export type OrgRole = 'owner' | 'admin' | 'payroll' | 'employee';
/** An account the user belongs to: their own (role owner) or an owner they work for. */
export interface MyOrganization {
  organizationId: UUID; role: OrgRole;
  /** who owns it (shown to staff who work for several owners) */
  ownerName: string | null;
  /** its active stores, to list them and open one directly */
  stores: { id: UUID; name: string; businessType: string; address?: string | null }[];
}
/** Open a store of a system business type; the owner's account is created with their first store. */
export interface OpenStore { businessType: string; name: string; timezone: string; currency: string; address?: string | null }
export interface StoreOpened { organizationId: UUID; store: StoreView; policy: PolicyView; accessKey: AccessKeyView }
export interface StoreView {
  id: UUID; name: string;
  /** system business type code; the app shows its translated name (see typeName) */
  businessType: string;
  timezone: string; currency: string; status: string; openedAt: ISODateTime;
  /** street address shown to staff (null when not set) */
  address: string | null;
}
export interface OrganizationView { id: UUID; status: string; billingTimezone: string; myRole: OrgRole; stores: StoreView[] }
export interface AccessKeyView { storeId: UUID; version: number; accessKey: string; expiresAt: ISODateTime }
export interface PolicyView {
  id: UUID; version: number; effectiveFrom: ISODateTime; employeeLimit: number;
  employeeLimitMode: 'advisory' | 'hard'; minStaff: number; optimalStaff: number; maxStaff: number;
  registrationMode: 'owner_approval' | 'automatic'; swapApprovalRequired: boolean; rules: PolicyRules | null;
}
export interface PolicyRules {
  /** Sign-up window: opens N days before; with cutoff_enabled (default on) closes N minutes (default 15) before the start. */
  registration?: { opens_days_before?: number; cutoff_enabled?: boolean; closes_minutes_before?: number };
  /** Shifts made automatically from templates for the next days_ahead days (server defaults: on, 14, published). */
  schedule?: { auto_generate?: boolean; days_ahead?: number; auto_publish?: boolean; auto_staff?: boolean };
  /** Clock in / clock out (default off). When on, the pay rules' hour options decide which hours are paid. */
  attendance?: { enabled?: boolean; late_grace_minutes?: number; early_leave_grace_minutes?: number };
  points?: { allow_negative_balance?: boolean };
  /** Bonus per shift for staff whose home store (first store they joined) is another store of the business. */
  branch_support?: { enabled?: boolean; amount?: number };
  /** Monthly bonus minus per_point for each penalty point and the cost of damaged property; paid with pay. */
  attendance_bonus?: { enabled?: boolean; amount?: number; per_point?: number };
  violations?: Record<string, { points: number }>;
  awards?: Record<string, { points: number }>;
  rewards?: Record<string, { min_points: number; points_cost: number; amount: number; window: string }>;
  /** How worked time becomes pay (see src/utils/pay.ts). Absent on stores created before pay rules. */
  pay?: import('@/utils/pay').PayRulesJson | null;
  /** Staff record their sales on shifts and earn commission_percent (2–10 %, default 2) of each sale. */
  sales?: { enabled?: boolean; commission_percent?: number };
  [key: string]: unknown;
}
export interface UpdateStore { name: string; address: string | null; businessType: string }
export interface UpdatePolicy {
  employeeLimit: number; employeeLimitMode: 'advisory' | 'hard'; minStaff: number; optimalStaff: number;
  maxStaff: number; registrationMode: 'owner_approval' | 'automatic'; swapApprovalRequired: boolean;
  rules?: PolicyRules | null;
}

// ------------------------------------------------------------------ employment
export interface MyEmploymentView {
  employmentId: UUID; storeId: UUID; storeName: string; storeTimeZone: string; role: string; status: string;
  startedAt: ISODateTime; currentWage: number | null; wageBasis: string | null; currency: string;
  storeAddress: string | null;
  /** Staff clock in and out at this store (its attendance setting). */
  attendance?: boolean;
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
  /** multi-day shift: the date it ends (up to 6 days after localDate); leave out for a normal shift */
  localEndDate?: ISODate | null;
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
  /** cost of store property damaged (deducted from the attendance bonus) */
  damageAmount?: number | null;
}
/** points: this case's penalty points (negative), omitted = the code's points in the store's rules. */
export interface CreateViolation {
  employmentId: UUID; assignmentId?: UUID | null; code: string; occurredAt?: ISODateTime | null; description: string;
  points?: number; damageAmount?: number;
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
  wages: number; bonuses: number; adjustments: number; commissions: number; gross: number; lines: PayslipLine[];
}
/** title is the server's English text; render code + params (i18n `notify.<code>`) when present. */
export interface NotificationView {
  id: UUID; eventType: string; title: string | null;
  code?: string | null; params?: Record<string, string | number | null>; payload: Record<string, unknown>;
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

// --------------------------------------------------------------- staffing plan
/** People needed for a shift template on an ISO weekday (1 = Monday). */
export interface PlanCell { templateId: UUID; weekday: number; min: number; ideal: number; max: number }
export interface TemplatePlan {
  templateId: UUID; name: string; localStart: LocalTime; localEnd: LocalTime; minutes: number; weekdays: number[];
  cells: PlanCell[];
  /** weekday -> people who list this shift and day among their preferred shifts */
  volunteers: Record<string, number>;
  /** the team's average pay for one such shift; absent = no wages yet */
  payPerShift?: number | null;
}
/** Slots per week: needed = sum of ideals; offered = what the team says it can work (5 for people who set nothing). */
export interface PlanCapacity {
  neededSlots: number; minimumSlots: number; offeredSlots: number; people: number; peopleWithoutPreferences: number;
  typicalShiftsPerPerson: number; shortfall: number; suggestedHires: number;
}
export interface PlanCost { weekly?: number | null; currency: string; peopleWithWage: number }
/** The owner's answers used to suggest the plan. */
export interface StaffingProfile { peakGuests: number; kitchen: boolean; busyDays: number[]; busyTemplateIds: UUID[] }
export interface StaffingPlan {
  storeId: UUID; businessType: string; templates: TemplatePlan[]; capacity: PlanCapacity; cost: PlanCost;
  profile?: StaffingProfile | null;
}
export interface StaffingSuggestion { cells: PlanCell[]; capacity: PlanCapacity; cost: PlanCost }

// --------------------------------------------------------------- period report (email)
/**
 * Owner's detailed email report after each payroll period (com.pvm.report); calendar months when the business has no
 * payroll periods. email null = the account email. mailConfigured false = the server only logs reports for now.
 */
export interface ReportSettings {
  enabled: boolean; email?: string | null; accountEmail?: string | null; language: 'vi' | 'en'; timezone: string;
  mailConfigured: boolean; followsPayrollPeriods: boolean;
  next?: { periodLabel: string; periodStart: ISODateTime; periodEnd: ISODateTime; sendAt: ISODateTime } | null;
  last?: { periodLabel: string; sentAt: ISODateTime; recipient: string; status: 'sent' | 'logged' | 'failed' } | null;
}
/** The latest completed period's report email (nothing sent). */
export interface ReportPreview {
  subject: string; html: string; periodLabel: string; periodStart: ISODateTime; periodEnd: ISODateTime; payrollFinal: boolean;
}
export interface ReportSendResult { recipient: string; status: 'sent' | 'logged'; periodLabel: string }

// ---------------------------------------------------------------- app plan (in-app purchase)
/** Pro for up to storeQuota stores; productId is the App Store / Play product. */
export interface PlanTier { storeQuota: number; monthlyPrice: number; productId: string }
export interface PlanSubscription {
  productId: string; storeQuota: number; expiresAt: ISODateTime; willRenew: boolean; store: string | null;
  provider: 'revenuecat' | 'dev'; environment: 'production' | 'sandbox'; active: boolean;
}
export interface PlanView {
  currency: string; stores: number; employees: number; freeMaxStores: number; freeMaxEmployees: number;
  basePrice: number; includedStores: number; extraStorePrice: number;
  /** what the owner has now */
  plan: 'free' | 'pro'; storeLimit: number; employeeLimit: number | null; subscription: PlanSubscription | null;
  /** cheapest plan covering today's usage */
  needed: 'free' | 'pro' | 'contact'; neededTier: PlanTier | null; overLimit: boolean; tiers: PlanTier[];
  entitlement: string; appUserId: UUID; devPurchase: boolean;
  /** only the owner buys or changes the plan */
  canPurchase: boolean;
  /** the owner's promo code grant, running or ended (null = never used one) */
  promo?: PlanPromo | null;
  /** the viewer is the owner, never used a promo code and is not paying */
  canRedeemPromo: boolean;
}
/** Pro for storeQuota stores from a promo code, free until expiresAt. */
export interface PlanPromo { code: string; redeemedAt: ISODateTime; expiresAt: ISODateTime; storeQuota: number; active: boolean }

// ---------------------------------------------------------------- shift preferences + automatic staffing
/** One preferred slot: this shift template on this ISO weekday (1 = Monday). */
export interface PrefSlot { weekday: number; templateId: UUID }
export interface ShiftPreferences {
  storeId: UUID; employmentId: UUID;
  /** null / absent = no weekly limit */
  maxShiftsPerWeek?: number | null;
  slots: PrefSlot[];
  /** the store's active shift templates, to choose from (weekdays = days the shift exists) */
  templates: { id: UUID; name: string; localStart: LocalTime; localEnd: LocalTime; weekdays: number[] }[];
}
export interface UpdatePreferences { storeId: UUID; maxShiftsPerWeek: number | null; slots: PrefSlot[] }
/** Asking for next week's matching shifts in one tap. */
export interface WeekRequestResult { weekStart: ISODate; matched: number; booked: number; requested: number; waitlisted: number; skipped: number }
/** One automatic staffing run for a store's next week. */
export interface AutoStaffResult {
  storeId: UUID; weekStart: ISODate; shifts: number; assigned: number; atIdeal: number; belowMinimum: number; people: number;
}

// ---------------------------------------------------------------- sales on a shift
export interface SaleView {
  id: UUID; shiftId: UUID; storeId: UUID; employmentId: UUID; displayName: string; currency: string;
  amount: number; commissionPercent: number; commissionAmount: number; note: string | null; soldAt: ISODateTime;
  status: 'recorded' | 'voided'; voidedAt: ISODateTime | null; voidReason: string | null;
  /** already on a payslip (can no longer be voided) */
  paid: boolean; mine: boolean; canVoid: boolean;
}
/** Staff see their own sales on the shift; owners/admins everyone's. Totals leave voided sales out. */
export interface ShiftSales {
  shiftId: UUID; enabled: boolean; commissionPercent: number; currency: string; canRecord: boolean;
  totalSales: number; totalCommission: number; sales: SaleView[];
}
export interface RecordSale { amount: number; note?: string | null; employmentId?: UUID | null }

// ---------------------------------------------------------------- personal data consent (Viet Nam)
export type DataRequestKind = 'export' | 'delete' | 'withdraw';
/** The consent in force (latest record); absent = never asked. */
export interface PrivacyConsent {
  policyVersion: string; action: 'accept' | 'update' | 'withdraw';
  service: boolean; crossBorder: boolean; marketing: boolean; ageConfirmed: boolean; at: ISODateTime;
}
export interface DataRequest {
  id: UUID; kind: DataRequestKind; status: 'open' | 'done' | 'rejected';
  createdAt: ISODateTime; handledAt?: ISODateTime | null; handledNote?: string | null;
}
/** accepted = the required consents are given for the current policy version; the app asks again when false. */
export interface PrivacyState {
  policyVersion: string; controller: string; contactEmail: string; accepted: boolean;
  /** absent = never asked */
  consent?: PrivacyConsent | null; requests: DataRequest[];
}
export interface GiveConsent {
  policyVersion: string; service: boolean; crossBorder: boolean; marketing: boolean; ageConfirmed: boolean; client?: string | null;
}

// ---------------------------------------------------------------- the store's week, for its staff
/** Every shift of a store over 7 days and who works it (names only, never wages). mine = the viewer. */
export interface StoreWeek {
  storeId: UUID; from: ISODate; to: ISODate;
  shifts: { shift: ShiftView; people: { displayName: string; mine: boolean }[] }[];
}

// ---------------------------------------------------------------- owner's staff summary (like the monthly sheet)
/**
 * Per person over a range: shifts worked or booked (no-shows apart), evening shifts (start 17:00 or later), shifts at
 * each store, bonus (incl. branch support not yet granted by payroll) and pay (timesheets, or the scheduled time).
 */
export interface StaffSummary {
  from: ISODate; to: ISODate; currency: string; stores: { id: UUID; name: string }[];
  people: {
    membershipId: UUID; displayName: string; homeStoreId: UUID | null; shifts: number; eveningShifts: number; noShows: number;
    byStore: { storeId: UUID; shifts: number }[]; wages: number; bonus: number; branchSupport: number; total: number;
  }[];
  totals: { shifts: number; eveningShifts: number; wages: number; bonus: number; total: number };
}

// ---------------------------------------------------------------- moving people between the owner's stores
/** One store of the business for a person: employmentId null = not working there yet (can be added). */
export interface BranchView {
  storeId: UUID; storeName: string; employmentId?: UUID | null; currentWage?: number | null; wageBasis?: string | null;
  currency: string; home: boolean;
}
/** homeChosen = the owner picked the home store (otherwise the first store they joined). */
export interface BranchesView { membershipId: UUID; displayName: string; homeStoreId: UUID | null; homeChosen: boolean; stores: BranchView[] }
/** Someone from another store who could fill a shift; busy = already working then. */
export interface Borrowable {
  fromEmploymentId: UUID; membershipId: UUID; displayName: string; fromStoreId: UUID; fromStoreName: string; busy: boolean;
}

// ---------------------------------------------------------------- the attendance bonus board ("bảng điểm chuyên cần")
/** Per person at stores with an attendance bonus: the bonus, penalty points and damages of the range, what is left. */
export interface AttendanceBonusBoard {
  from: ISODate; to: ISODate;
  rows: {
    employmentId: UUID; displayName: string; storeId: UUID; storeName: string; currency: string; base: number; perPoint: number;
    points: number; damages: number; remaining: number; pending: number;
    items: { violationId: UUID; occurredAt: ISODateTime; code: string; description: string; points?: number | null;
      damageAmount?: number | null; status: 'reported' | 'confirmed' }[];
  }[];
}

// ---------------------------------------------------------------- store managers ("Quản lý")
/** The stores a staff member manages; empty = not a manager. */
export interface ManagerStores { membershipId: UUID; displayName: string; storeIds: UUID[] }
export interface ManagedStore { storeId: UUID; storeName: string }
