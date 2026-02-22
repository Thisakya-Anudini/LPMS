import { createContext } from 'react';
import { User } from '../types';

export type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<User>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<User>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
