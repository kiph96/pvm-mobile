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

/** Businesses I belong to (owner, admin or employee). */
export function useMyBusinesses() {
  const api = useApi();
  const { session } = useSession();
  return useQuery({ queryKey: ['my-orgs', session?.userId], queryFn: api.myOrganizations, enabled: !!session });
}

export interface BusinessStores { business: MyOrganization; stores: StoreView[]; current: boolean; loading: boolean }

/**
 * Stores of every business I manage, current business first: lets the owner see all stores in one
 * place even though each business's data is kept separately.
 */
export function useAllStores() {
  const api = useApi();
  const { session } = useSession();
  const businesses = useMyBusinesses();
  const managed = (businesses.data ?? []).filter((b) => b.role === 'owner' || b.role === 'admin');
  const lists = useQueries({
    queries: managed.map((b) => ({ queryKey: ['stores-of', b.organizationId], queryFn: () => api.storesOf(b.organizationId) })),
  });
  const current = session?.workspace?.id;
  const groups: BusinessStores[] = managed
    .map((b, i) => ({ business: b, stores: lists[i]?.data ?? [], current: b.organizationId === current, loading: !!lists[i]?.isLoading }))
    .sort((a, b) => Number(b.current) - Number(a.current));
  return {
    groups,
    total: groups.reduce((n, g) => n + g.stores.filter((s) => s.status === 'active').length, 0),
    loading: businesses.isLoading || lists.some((l) => l.isLoading),
    refetch: () => Promise.all([businesses.refetch(), ...lists.map((l) => l.refetch())]),
  };
}
