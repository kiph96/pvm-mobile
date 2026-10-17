// Shared queries used by several screens (cached by react-query under these keys).
import { useQuery } from '@tanstack/react-query';

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
