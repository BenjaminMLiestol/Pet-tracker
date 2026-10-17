import { getToken } from './tokenStorage';

// Set EXPO_PUBLIC_API_URL in .env.local (see .env.example).
const API_ROOT = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/+$/, '');
// The backend versions its routes; bump this when the app moves to a new API version.
const API_VERSION = 'v1';
const BASE_URL = `${API_ROOT}/${API_VERSION}`;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Give up on a request after this long so a flaky connection can't hang the UI.
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 600;

export type ApiErrorKind = 'network' | 'timeout' | 'http';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// Credential endpoints return 401 for a wrong password; that is not an expired session.
const PUBLIC_PATHS = ['/auth/login', '/auth/register'];

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    const firstValidationError = body?.errors && Object.values(body.errors).flat()[0];
    return (firstValidationError as string) || body?.message || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ApiError('Request timed out', 'timeout');
    throw new ApiError(e?.message ?? 'Network request failed', 'network');
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: HttpMethod; headers?: Record<string, string>; body?: any } = {}
): Promise<T> {
  const token = await getToken();
  const method = options.method || 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  // Reads are safe to repeat: retry once on connection trouble or a 5xx.
  // Writes are never retried, so a slow save can't create duplicates.
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE_URL}${path}`, init);
    if (method === 'GET' && res.status >= 500) throw new ApiError(`HTTP ${res.status}`, 'http', res.status);
  } catch (e) {
    const retryable =
      method === 'GET' && e instanceof ApiError && (e.kind !== 'http' || (e.status ?? 0) >= 500);
    if (!retryable) throw e;
    await sleep(RETRY_DELAY_MS);
    res = await fetchWithTimeout(`${BASE_URL}${path}`, init);
  }

  if (res.status === 401 && !PUBLIC_PATHS.includes(path)) {
    // Token invalid/expired — bounce to login
    if (onUnauthorized) onUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), 'http', res.status);
  }

  // Try to parse JSON, allow empty bodies
  const ct = res.headers.get('content-type');
  // biome-ignore lint/complexity/useOptionalChain: <d>
  if (ct && ct.includes('application/json')) return (await res.json()) as T;
  return undefined as T;
}
