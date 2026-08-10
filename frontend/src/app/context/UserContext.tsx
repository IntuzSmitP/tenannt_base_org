"use client";
import React, { createContext, useContext, ReactNode } from 'react';

type UserContextType = {
  user: Record<string, unknown> | null;
  isAdminOrOwner: boolean;
};

const UserContext = createContext<UserContextType>({ user: null, isAdminOrOwner: false });

export const UserProvider = ({ user, children }: { user: Record<string, unknown> | null; children: ReactNode }) => {
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';
  
  return (
    <UserContext.Provider value={{ user, isAdminOrOwner }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
