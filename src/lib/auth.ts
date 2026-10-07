import { create } from 'zustand';
import {
  apiGet,
  apiPatch,
  apiPost,
  onUnauthenticated,
  setAccessToken,
} from './api';
import type { LoginResponse, PermissionKey, Session, SessionUser } from '@/types/api';
import { useTheme } from './theme';

interface AuthState {
  user: SessionUser | null;
  permissions: Set<PermissionKey>;
  /** Null until the first refresh attempt resolves, so routes do not flash. */
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<SessionUser>;
  acceptInvite: (token: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** Restores the session from the refresh cookie on page load. */
  bootstrap: () => Promise<void>;
  reload: () => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string; theme?: 'LIGHT' | 'DARK' | 'SYSTEM' }) => Promise<void>;
  can: (...permissions: PermissionKey[]) => boolean;
  canAll: (...permissions: PermissionKey[]) => boolean;
  isStaff: () => boolean;
  isClient: () => boolean;
}

const applySession = (session: Session) => ({
  user: session.user,
  permissions: new Set(session.permissions),
  status: 'authenticated' as const,
});

/** The server stores the theme per user, so a new device matches their choice. */
function syncThemeFromUser(user: SessionUser) {
  const mode = user.theme.toLowerCase() as 'light' | 'dark' | 'system';
  const current = useTheme.getState().mode;
  if (current !== mode) useTheme.getState().setMode(mode);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  permissions: new Set<PermissionKey>(),
  status: 'loading',

  login: async (email, password) => {
    const result = await apiPost<LoginResponse>('/auth/login', { email, password });
    setAccessToken(result.accessToken);
    set(applySession(result));
    syncThemeFromUser(result.user);
    return result.user;
  },

  acceptInvite: async (token, password) => {
    const result = await apiPost<LoginResponse>('/auth/accept-invite', { token, password });
    setAccessToken(result.accessToken);
    set(applySession(result));
    return result.user;
  },

  logout: async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // Even if the call fails, the local session must end.
    }
    setAccessToken(null);
    set({ user: null, permissions: new Set(), status: 'anonymous' });
  },

  bootstrap: async () => {
    try {
      const result = await apiPost<LoginResponse>('/auth/refresh');
      setAccessToken(result.accessToken);
      set(applySession(result));
      syncThemeFromUser(result.user);
    } catch {
      setAccessToken(null);
      set({ user: null, permissions: new Set(), status: 'anonymous' });
    }
  },

  reload: async () => {
    const session = await apiGet<Session>('/auth/me');
    set(applySession(session));
  },

  updateProfile: async (input) => {
    const session = await apiPatch<Session>('/auth/preferences', input);
    set(applySession(session));
  },

  // Any of the listed permissions is enough, matching how the API guards read.
  can: (...permissions) => {
    if (!permissions.length) return true;
    const held = get().permissions;
    return permissions.some((permission) => held.has(permission));
  },

  canAll: (...permissions) => {
    const held = get().permissions;
    return permissions.every((permission) => held.has(permission));
  },

  isStaff: () => get().user?.kind === 'STAFF',
  isClient: () => get().user?.kind === 'CLIENT',
}));

// A refresh that fails mid-session drops straight back to the sign-in screen.
onUnauthenticated(() => {
  setAccessToken(null);
  useAuth.setState({ user: null, permissions: new Set(), status: 'anonymous' });
});

/** Hook form of the permission check, for use inside components. */
export const useCan = () => useAuth((state) => state.can);
