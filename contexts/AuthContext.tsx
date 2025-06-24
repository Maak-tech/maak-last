import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state with enhanced error handling
    const initializeAuth = async () => {
      try {
        // Add delay to ensure proper initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (Platform.OS === 'web') {
          // For web, check localStorage for demo purposes
          try {
            const savedUser = localStorage.getItem('demoUser');
            if (savedUser) {
              const parsedUser = JSON.parse(savedUser);
              // Ensure createdAt is a Date object
              if (parsedUser.createdAt) {
                parsedUser.createdAt = new Date(parsedUser.createdAt);
              }
              setUser(parsedUser);
            }
          } catch (storageError) {
            console.warn('Failed to parse saved user data:', storageError);
            localStorage.removeItem('demoUser');
          }
        } else {
          // For native platforms, implement secure storage or Firebase auth
          // This is a demo implementation
          console.log('Native auth initialization');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear any corrupted data
        if (Platform.OS === 'web') {
          try {
            localStorage.removeItem('demoUser');
          } catch (clearError) {
            console.error('Failed to clear corrupted storage:', clearError);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Add artificial delay to simulate network request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Demo implementation - replace with actual Firebase auth
      const demoUser: User = {
        id: '1',
        email,
        name: 'Demo User',
        role: 'admin',
        createdAt: new Date(),
        onboardingCompleted: true,
        preferences: {
          language: 'en',
          notifications: true,
          emergencyContacts: [],
        },
      };
      
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem('demoUser', JSON.stringify(demoUser));
        } catch (storageError) {
          console.warn('Failed to save user to storage:', storageError);
        }
      }
      
      setUser(demoUser);
    } catch (error) {
      console.error('Sign in error:', error);
      throw new Error('Failed to sign in. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      // Add artificial delay to simulate network request
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Demo implementation - replace with actual Firebase auth
      const demoUser: User = {
        id: Date.now().toString(),
        email,
        name,
        role: 'admin',
        createdAt: new Date(),
        onboardingCompleted: false,
        preferences: {
          language: 'en',
          notifications: true,
          emergencyContacts: [],
        },
      };
      
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem('demoUser', JSON.stringify(demoUser));
        } catch (storageError) {
          console.warn('Failed to save user to storage:', storageError);
        }
      }
      
      setUser(demoUser);
    } catch (error) {
      console.error('Sign up error:', error);
      throw new Error('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem('demoUser');
        } catch (storageError) {
          console.warn('Failed to clear user from storage:', storageError);
        }
      }
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if storage operations fail
      setUser(null);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = { ...user, ...userData };
      
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem('demoUser', JSON.stringify(updatedUser));
        } catch (storageError) {
          console.warn('Failed to update user in storage:', storageError);
        }
      }
      
      setUser(updatedUser);
    } catch (error) {
      console.error('Update user error:', error);
      throw new Error('Failed to update user. Please try again.');
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};