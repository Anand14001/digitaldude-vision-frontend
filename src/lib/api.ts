import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorBody, Envelope, LoginResponse, Paginated } from '@/types/api';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4001';

/**
 * The access token lives in memory only. A refresh token sits in an httpOnly
 * cookie the JavaScript cannot read, so a successful XSS cannot walk off with a
 * long-lived credential - it would have to keep using the page.
 */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const onUnauthenticated = (handler: () => void) => {
  onSessionLost = handler;
};

export const http: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  // Needed for the refresh cookie on a cross-origin SPA.
  withCredentials: true,
  timeout: 30_000,
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/**
 * Single-flight refresh: several requests failing at once share one refresh
 * call rather than each firing their own and invalidating the others through
 * token rotation.
 */
let refreshing: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const { data } = await axios.post<Envelope<LoginResponse>>(
        `${BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      accessToken = data.data.accessToken;
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      // Cleared on the next tick so concurrent callers all see this result.
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();

  return refreshing;
}

const AUTH_FREE_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/accept-invite',
];

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    const isAuthFree = AUTH_FREE_PATHS.some((path) => url.includes(path));

    if (status === 401 && config && !config._retried && !isAuthFree) {
      config._retried = true;
      const token = await refreshSession();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return http.request(config);
      }
      onSessionLost?.();
    }

    return Promise.reject(error);
  },
);

/** Pulls the API's error message out, with a readable fallback. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (body?.error?.details?.length) {
      return body.error.details.map((d) => `${d.field}: ${d.message}`).join(', ');
    }
    if (body?.error?.message) return body.error.message;
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const errorCode = (error: unknown): string | null =>
  axios.isAxiosError<ApiErrorBody>(error) ? (error.response?.data?.error?.code ?? null) : null;

// ---------------------------------------------------------------- shorthands
/** Unwraps `{ data }` so callers work with the payload directly. */
export async function apiGet<T>(url: string, params?: unknown): Promise<T> {
  const { data } = await http.get<Envelope<T>>(url, { params });
  return data.data;
}

/** For endpoints that return `{ data, meta }`. */
export async function apiList<T>(url: string, params?: unknown): Promise<Paginated<T>> {
  const { data } = await http.get<Paginated<T>>(url, { params });
  return data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.post<Envelope<T>>(url, body);
  return data?.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.patch<Envelope<T>>(url, body);
  return data?.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.put<Envelope<T>>(url, body);
  return data?.data;
}

export async function apiDelete(url: string): Promise<void> {
  await http.delete(url);
}

/** Streams a CSV export straight to the browser's downloads. */
export async function apiDownload(url: string, params?: unknown): Promise<Blob> {
  const response = await http.get<Blob>(url, { params, responseType: 'blob' });
  return response.data;
}

export async function apiUpload<T>(
  url: string,
  files: File[],
  params?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const { data } = await http.post<Envelope<T>>(url, form, {
    params,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export { refreshSession, BASE_URL };
