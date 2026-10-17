import { useQuery } from '@tanstack/react-query';

import { addDays, today } from '@/utils/format';
import { useOrgKey } from './queries';
import { useApi } from './session';

/** The signed-in employee's stores (employments) in the current business. */
export function useMyEmployments() {
  const api = useApi();
  const org = useOrgKey();
  return useQuery({ queryKey: ['my-employments', org], queryFn: api.myEmployments });
}

/** My booked shifts from `back` days ago to `ahead` days ahead. */
export function useMySchedule(back = 0, ahead = 21) {
  const api = useApi();
  const org = useOrgKey();
  const from = addDays(today(), -back);
  const to = addDays(today(), ahead);
  return useQuery({ queryKey: ['my-schedule', org, from, to], queryFn: () => api.mySchedule(from, to) });
}

export function useMyRequests() {
  const api = useApi();
  const org = useOrgKey();
  return useQuery({ queryKey: ['my-requests', org], queryFn: api.myRequests });
}
