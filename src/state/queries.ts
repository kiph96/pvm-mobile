// Shared queries used by several screens (cached by react-query under these keys).
import { useQueries, useQuery } from '@tanstack/react-query';

import type { MyOrganization, StoreView } from '@/api/types';

import { useApi, useSession } from './session';

export function useOrgKey() {
  return useSession().session?.workspace?.id ?? 'none';
}

export function useApprovals() {
  const api = useApi();
  const org = useOrgKey();
  const { isManager } = useSession();
  const enrollments = useQuery({ queryKey: ['enrollments', org, 'pending'], queryFn: () => api.enrollments(undefined, 'pending'), enabled: isManager });
  const requests = useQuery({ queryKey: ['requests', org], queryFn: () => api.openRequests(), enabled: isManager });
  const swaps = useQuery({ queryKey: ['swaps', org, 'accepted'], queryFn: () => api.swaps('accepted'), enabled: isManager });
  const violations = useQuery({ queryKey: ['violations', org, 'reported'], queryFn: () => api.violations({ status: 'reported' }), enabled: isManager });
  const count = (enrollments.data?.length ?? 0) + (requests.data?.filter((r) => r.status === 'pending').length ?? 0)
    + (swaps.data?.length ?? 0) + (violations.data?.length ?? 0);
  const refetch = () => Promise.all([enrollments.refetch(), requests.refetch(), swaps.refetch(), violations.refetch()]);
  const loading = enrollments.isLoading || requests.isLoading || swaps.isLoading || violations.isLoading;
  return { enrollments, requests, swaps, violations, count, refetch, loading };
}

export function useNotifications() {
  const api = useApi();
  const org = useOrgKey();
  return useQuery({ queryKey: ['notifications', org], queryFn: api.notifications });
}

export function useTemplateNames(storeId: string | null) {
  const api = useApi();
  const org = useOrgKey();
  const q = useQuery({ queryKey: ['templates', org, storeId], queryFn: () => api.templates(storeId!), enabled: !!storeId });
  return Object.fromEntries((q.data ?? []).map((t) => [t.id, t.name])) as Record<string, string>;
}

/** Accounts I belong to: my own (as owner) and the owners I work for. */
export function useMyAccounts() {
  const api = useApi();
  const { session } = useSession();
  return useQuery({ queryKey: ['my-orgs', session?.userId], queryFn: api.myOrganizations, enabled: !!session });
}


/** The signed-in person's personal data consent (per person, so not keyed by business). */
export function usePrivacy() {
  const api = useApi();
  const { session } = useSession();
  return useQuery({ queryKey: ['privacy', session?.userId], queryFn: api.privacy, enabled: !!session, staleTime: 5 * 60_000 });
}

/** Stores the signed-in staff member manages ("Quản lý"); owners and admins manage every store and get none here. */
export function useManagedStores() {
  const api = useApi();
  const org = useOrgKey();
  const { session, isManager } = useSession();
  return useQuery({ queryKey: ['managedStores', org], queryFn: api.myManagedStores, enabled: !!session?.workspace && !isManager });
}

/** Owner / admin, or manager of this store: may approve its shifts, swaps and violations and move its staff. */
export function useCanManage(storeId: string | null | undefined) {
  const { isManager } = useSession();
  const managed = useManagedStores();
  return isManager || (!!storeId && !!managed.data?.some((s) => s.storeId === storeId));
}

/** What waits for a store manager across their stores: shift requests, swaps to approve, violations to confirm. */
export function useManagerTodo() {
  const api = useApi();
  const org = useOrgKey();
  const managed = useManagedStores();
  const ids = (managed.data ?? []).map((s) => s.storeId);
  const on = ids.length > 0;
  const requests = useQuery({ queryKey: ['requests', org, 'managed'], queryFn: () => api.openRequests(), enabled: on });
  const swaps = useQuery({ queryKey: ['swaps', org, 'accepted'], queryFn: () => api.swaps('accepted'), enabled: on });
  const violations = useQueries({
    queries: ids.map((id) => ({ queryKey: ['violations', org, 'store', id, 'reported'],
      queryFn: () => api.violations({ storeId: id, status: 'reported' }) })),
  });
  return (requests.data ?? []).filter((r) => r.status === 'pending' || r.status === 'waitlisted').length
    + (swaps.data ?? []).filter((s) => ids.includes(s.from.storeId)).length
    + violations.reduce((n, v) => n + (v.data?.length ?? 0), 0);
}
