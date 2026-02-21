import React, { useEffect, useState, createContext, useContext } from 'react';
import { User, Role } from '../types';
import { MOCK_USERS } from '../utils/mockData';
interface AuthContextType {
  user: User | null;
  login: (role: Role) => void;
  logout: () => void;
  isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  // Simulate session persistence
  useEffect(() => {
    const storedUserId = localStorage.getItem('lpms_user_id');
    if (storedUserId) {
      const foundUser = MOCK_USERS.find((u) => u.id === storedUserId);
      if (foundUser) setUser(foundUser);
    }
  }, []);
  const login = (role: Role) => {
    // For demo purposes, we just pick the first user with that role
    const mockUser = MOCK_USERS.find((u) => u.role === role);
    if (mockUser) {
      setUser(mockUser);
      localStorage.setItem('lpms_user_id', mockUser.id);
    }
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('lpms_user_id');
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user
      }}>

      {children}
    </AuthContext.Provider>);

}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}