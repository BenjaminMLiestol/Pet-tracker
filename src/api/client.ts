import { getToken } from './tokenStorage';

// Set EXPO_PUBLIC_API_URL in .env.local (see .env.example).
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: HttpMethod; headers?: Record<string, string>; body?: any } = {}
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    // Token invalid/expired — bounce to login
    if (onUnauthorized) onUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  // Try to parse JSON, allow empty bodies
  const ct = res.headers.get('content-type');
  // biome-ignore lint/complexity/useOptionalChain: <d>
  if (ct && ct.includes('application/json')) return (await res.json()) as T;
  return undefined as T;
}
