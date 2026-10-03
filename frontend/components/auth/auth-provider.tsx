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
import { ApiRequestError, AUTH_EXPIRED_EVENT, AUTH_TOKEN_STORAGE_KEY } from "@/lib/api";


type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function handleExpiredSession(event: Event) {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      const message = event instanceof CustomEvent && typeof event.detail === "string"
        ? event.detail
        : "Your sign-in token was rejected or expired. Please sign in again.";
      showToast({
        kind: "error",
        title: "Session is no longer valid",
        description: message,
      });
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, [showToast]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
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
      .catch((cause: unknown) => {
        if (!(cause instanceof ApiRequestError && cause.status === 401)) {
          showToast({
            kind: "error",
            title: "Could not verify your session",
            description: "The API is temporarily unavailable. Your saved sign-in was kept; reload after reconnecting.",
          });
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (user) return;

    async function retrySavedSession() {
      const savedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!savedToken) return;
      setIsLoading(true);
      try {
        const currentUser = await getCurrentUser(savedToken);
        setToken(savedToken);
        setUser(currentUser);
      } catch (cause: unknown) {
        if (!(cause instanceof ApiRequestError && cause.status === 401)) {
          showToast({
            kind: "error",
            title: "Could not reconnect",
            description: "Your saved sign-in is still available. Retry when the API is reachable.",
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    window.addEventListener("online", retrySavedSession);
    window.addEventListener("focus", retrySavedSession);
    return () => {
      window.removeEventListener("online", retrySavedSession);
      window.removeEventListener("focus", retrySavedSession);
    };
  }, [showToast, user]);

  const login = useCallback(async (credentials: LoginPayload) => {
    const result = await loginUser(credentials);
    const currentUser = await getCurrentUser(result.access_token);
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.access_token);
    setToken(result.access_token);
    setUser(currentUser);
    showToast({
      kind: "success",
      title: "Signed in successfully",
      description: `Welcome back${currentUser.full_name ? `, ${currentUser.full_name}` : ""}.`,
    });
    return currentUser;
  }, [showToast]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
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
