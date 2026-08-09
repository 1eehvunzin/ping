import type { PagerMessage } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.status = status;
  }
}

interface ApiAccount {
  id: string;
  known_senders: string[];
}

interface ApiMessage {
  id: number;
  from_id: string;
  to_id: string;
  code: string;
  meaning: string;
  time: string;
  read: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0);
  }
  if (!res.ok) {
    let code = res.statusText || 'REQUEST_FAILED';
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') code = body.detail;
    } catch {
      // no JSON body; keep statusText
    }
    throw new ApiError(code, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function toPagerMessage(m: ApiMessage): PagerMessage {
  return { id: m.id, from: m.from_id, time: m.time, text: m.code, read: m.read };
}

export function getAccount(id: string) {
  return request<ApiAccount>(`/accounts/${id}`);
}

// known_senders doubles as the friends list — anyone whose request you've
// approved can message you directly, which is exactly "being friends" here.
export async function getFriends(id: string): Promise<string[]> {
  const account = await getAccount(id);
  return account.known_senders;
}

export function register(id: string, password: string) {
  return request<ApiAccount>('/accounts/register', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
}

export function login(id: string, password: string) {
  return request<ApiAccount>('/accounts/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
}

export function sendMessage(fromId: string, toId: string, code: string) {
  return request<ApiMessage>('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ from_id: fromId, to_id: toId, code }),
  });
}

export async function getInbox(id: string): Promise<PagerMessage[]> {
  const msgs = await request<ApiMessage[]>(`/messages/${id}/inbox`);
  return msgs.map(toPagerMessage);
}

export async function getRequests(id: string): Promise<PagerMessage[]> {
  const reqs = await request<ApiMessage[]>(`/messages/${id}/requests`);
  return reqs.map(toPagerMessage);
}

export function approveRequest(id: string, messageId: number) {
  return request<ApiMessage>(`/messages/${id}/requests/${messageId}/approve`, { method: 'POST' });
}

export function declineRequest(id: string, messageId: number) {
  return request<void>(`/messages/${id}/requests/${messageId}/decline`, { method: 'POST' });
}

export function markRead(id: string, messageId: number) {
  return request<void>(`/messages/${id}/inbox/${messageId}/read`, { method: 'POST' });
}
