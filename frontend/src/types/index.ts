export type UserRole = 'member' | 'admin';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}
