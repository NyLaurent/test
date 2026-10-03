"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, loginUser } from "@/lib/api";
import type { LoginPayload, User } from "@/lib/types";
import { useToast } from "@/components/toast/toast-provider";

const TOKEN_STORAGE_KEY = "dataset-request-desk-token";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!savedToken) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    let isActive = true;
    void getCurrentUser(savedToken)
      .then((currentUser) => {
        if (isActive) {
          setToken(savedToken);
          setUser(currentUser);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginPayload) => {
    const result = await loginUser(credentials);
    const currentUser = await getCurrentUser(result.access_token);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
    setToken(result.access_token);
    setUser(currentUser);
    showToast({
      kind: "success",
      title: "Signed in successfully",
      description: `Welcome back${currentUser.full_name ? `, ${currentUser.full_name}` : ""}.`,
    });
  }, [showToast]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    showToast({
      kind: "success",
      title: "Signed out",
      description: "You have safely ended your session.",
    });
  }, [showToast]);

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
