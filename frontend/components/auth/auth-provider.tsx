"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, loginUser, logoutUser } from "@/lib/api";
import type { LoginPayload, User } from "@/lib/types";
import { useToast } from "@/components/toast/toast-provider";
import {
  ApiRequestError,
  AUTH_EXPIRED_EVENT,
  AUTH_TOKEN_REFRESHED_EVENT,
  AUTH_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@/lib/api";


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
  const authOperation = useRef(0);

  useEffect(() => {
    function handleExpiredSession(event: Event) {
      authOperation.current += 1;
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
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
    function handleTokenRefreshed(event: Event) {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        setToken(event.detail);
      }
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== AUTH_TOKEN_STORAGE_KEY) return;

      const operation = ++authOperation.current;
      if (!event.newValue) {
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setToken(event.newValue);
      setUser(null);
      setIsLoading(true);
      void getCurrentUser(event.newValue)
        .then((currentUser) => {
          if (
            operation === authOperation.current
            && window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) === event.newValue
          ) {
            setUser(currentUser);
          }
        })
        .catch((cause: unknown) => {
          if (!(cause instanceof ApiRequestError && cause.status === 401)) {
            showToast({
              kind: "error",
              title: "Could not verify the updated session",
              description: "The API is temporarily unavailable. Reconnect and sign in again if needed.",
            });
          }
        })
        .finally(() => {
          if (operation === authOperation.current) setIsLoading(false);
        });
    }

    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [showToast]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!savedToken) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    let isActive = true;
    const operation = ++authOperation.current;
    void getCurrentUser(savedToken)
      .then((currentUser) => {
        if (isActive && operation === authOperation.current) {
          setToken(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? savedToken);
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
        if (isActive && operation === authOperation.current) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (user || isLoading) return;

    async function retrySavedSession() {
      const savedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!savedToken) return;
      const operation = ++authOperation.current;
      setIsLoading(true);
      try {
        const currentUser = await getCurrentUser(savedToken);
        if (operation !== authOperation.current) return;
        setToken(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? savedToken);
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
        if (operation === authOperation.current) setIsLoading(false);
      }
    }

    window.addEventListener("online", retrySavedSession);
    return () => {
      window.removeEventListener("online", retrySavedSession);
    };
  }, [isLoading, showToast, user]);

  const login = useCallback(async (credentials: LoginPayload) => {
    const operation = ++authOperation.current;
    setIsLoading(true);
    try {
      const result = await loginUser(credentials);
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.access_token);
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, result.refresh_token);
      const currentUser = await getCurrentUser(result.access_token);
      if (operation !== authOperation.current) return currentUser;
      const currentToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? result.access_token;
      setToken(currentToken);
      setUser(currentUser);
      showToast({
        kind: "success",
        title: "Signed in successfully",
        description: `Welcome back${currentUser.full_name ? `, ${currentUser.full_name}` : ""}.`,
      });
      return currentUser;
    } finally {
      if (operation === authOperation.current) setIsLoading(false);
    }
  }, [showToast]);

  const logout = useCallback(() => {
    authOperation.current += 1;
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    if (refreshToken) {
      void logoutUser(refreshToken).catch(() => {
        showToast({
          kind: "info",
          title: "Signed out on this device",
          description: "The server could not be reached to revoke this session. Its refresh token will expire automatically.",
        });
      });
    }
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
