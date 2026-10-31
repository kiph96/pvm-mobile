/**
 * Where tapping a notification (in the list, or a push) goes: the screen that deals with it, or the shift it is
 * about. `data` is the stored payload, or a push's data: `shift_id` comes from the server, `screen`/`date` from the
 * evening digest. `owner` = owner or admin; a store manager gets the same alerts but works from the Quản lý tab.
 * null = nothing to open; the list shows the notification in full instead.
 */
export function notificationRoute(eventType: string, data: Record<string, unknown> | undefined, owner: boolean): string | null {
  const shiftId = typeof data?.shift_id === 'string' ? data.shift_id : null;
  const date = typeof data?.date === 'string' ? data.date : null;
  const approvals = owner ? '/owner' : '/staff/manage'; // "Cần bạn duyệt" / the manager's to-do

  if (data?.screen === 'schedule' || eventType.startsWith('digest.')) return date ? `/owner/schedule?date=${date}` : '/owner/schedule';
  switch (eventType) {
    case 'alert.enrollment.pending':
      return owner ? '/owner' : null;
    case 'alert.shift_swap.needs_approval':
      return approvals;
    case 'alert.shift_request.pending':
      return shiftId ? `/shift/${shiftId}` : approvals; // one shift, or a whole week asked for
    case 'alert.auto_staff.done':
      return '/owner/schedule';
    case 'alert.store.employee_limit_exceeded':
      return '/billing';
    case 'notify.shift.cancelled':
    case 'notify.shift.unassigned':
    case 'notify.auto_staff.assigned':
      return '/staff/shifts';
    case 'notify.shift_swap.proposed':
    case 'notify.shift_swap.approved':
    case 'notify.shift_swap.declined':
    case 'notify.shift_swap.rejected':
      return '/staff/swaps';
    case 'notify.violation.confirmed':
    case 'notify.violation.reversed':
    case 'notify.points.awarded':
    case 'notify.reward.granted':
    case 'notify.wage.changed':
      return '/staff/me';
    case 'notify.payroll.finalized':
      return owner ? '/payroll' : '/payslips';
    case 'notify.store_manager.granted':
      return '/staff/manage';
    case 'notify.enrollment.approved':
    case 'notify.employment.branch_added':
      return '/store-week';
  }
  return shiftId ? `/shift/${shiftId}` : null;
}
