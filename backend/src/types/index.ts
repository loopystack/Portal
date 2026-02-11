export type UserRole = 'member' | 'admin';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
