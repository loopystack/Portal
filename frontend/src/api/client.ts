const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('pyce_token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail ? `${data?.error || 'Request failed'}: ${data.detail}` : (data?.error || res.statusText || 'Request failed');
    throw new Error(msg);
  }
  return (res.status === 204 ? undefined : data) as T;
}

export const authApi = {
  signin: (email: string, password: string) =>
    api<{ user: import('../types').User; token: string }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signup: (email: string, password: string, displayName?: string) =>
    api<{ user: import('../types').User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  me: () => api<import('../types').User>('/auth/me'),
};

export interface TimeBlockResponse {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Editable content is stored in summary as "Title\n\nContent". */
const SUMMARY_DELIMITER = '\n\n';
export function parseSummary(summary: string | null): { title: string; content: string } {
  if (!summary) return { title: 'Work', content: '' };
  const i = summary.indexOf(SUMMARY_DELIMITER);
  if (i < 0) return { title: summary.trim() || 'Work', content: '' };
  return {
    title: summary.slice(0, i).trim() || 'Work',
    content: summary.slice(i + SUMMARY_DELIMITER.length).trim(),
  };
}
export function combineSummary(title: string, content: string): string {
  const c = content.trim();
  return c ? `${title}${SUMMARY_DELIMITER}${c}` : title;
}

export const timeBlocksApi = {
  list: (from: string, to: string, userId?: string) =>
    api<TimeBlockResponse[]>(
      `/time-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${userId ? '&userId=' + encodeURIComponent(userId) : ''}`
    ),
  create: (startAt: string, endAt: string, summary?: string) =>
    api<TimeBlockResponse>('/time-blocks', {
      method: 'POST',
      body: JSON.stringify({ startAt, endAt, summary }),
    }),
  update: (id: string, data: { startAt?: string; endAt?: string; summary?: string }) =>
    api<TimeBlockResponse>(`/time-blocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    api<void>(`/time-blocks/${id}`, { method: 'DELETE' }),
};

export interface RevenueEntryResponse {
  id: string;
  userId: string;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpectedRevenueResponse {
  year: number;
  month: number;
  amount: number | null;
}

export const revenueApi = {
  listEntries: (from: string, to: string, userId?: string) =>
    api<RevenueEntryResponse[]>(
      `/revenue/entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`
    ),
  createEntry: (date: string, amount: number, note?: string) =>
    api<RevenueEntryResponse>('/revenue/entries', {
      method: 'POST',
      body: JSON.stringify({ date: date.slice(0, 10), amount, note }),
    }),
  updateEntry: (id: string, data: { date?: string; amount?: number; note?: string }) =>
    api<RevenueEntryResponse>(`/revenue/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(
        data.date ? { ...data, date: data.date.slice(0, 10) } : data
      ),
    }),
  deleteEntry: (id: string) =>
    api<void>(`/revenue/entries/${id}`, { method: 'DELETE' }),
  getExpected: (year: number, month: number) =>
    api<ExpectedRevenueResponse>(`/revenue/expected?year=${year}&month=${month}`),
  setExpected: (year: number, month: number, amount: number) =>
    api<{ id: string; userId: string; month: number; year: number; amount: number }>('/revenue/expected', {
      method: 'PUT',
      body: JSON.stringify({ year, month, amount }),
    }),
};

export interface WorkHoursRankItem {
  userId: string;
  displayName: string;
  email: string;
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  totalHours: number;
}

export interface RevenueRankItem {
  userId: string;
  displayName: string;
  email: string;
  monthlyRevenue: number;
  totalRevenue: number;
  expectedRevenue: number | null;
}

export const rankingsApi = {
  workHours: () => api<WorkHoursRankItem[]>('/rankings/work-hours'),
  revenue: (year?: number, month?: number) =>
    api<RevenueRankItem[]>(
      year != null && month != null
        ? `/rankings/revenue?year=${year}&month=${month}`
        : '/rankings/revenue'
    ),
};

export interface AdminMember {
  id: string;
  displayName: string;
  email: string;
}

export const adminApi = {
  listMembers: () => api<AdminMember[]>('/admin/members'),
};

export const teamApi = {
  listMembers: () => api<AdminMember[]>('/team/members'),
};
