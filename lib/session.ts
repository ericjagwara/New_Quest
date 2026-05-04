import type { User } from "./types";

export const SESSION_DURATION = 24 * 60 * 60 * 1000; // 15 minutes in milliseconds

export function ensureDevSession(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;

  const existing = localStorage.getItem("authUser");
  if (existing) {
    try {
      const parsed: User = JSON.parse(existing);
      if (Date.now() < parsed.expiresAt) return; // still valid, do nothing
    } catch {}
  }

  // Inject a fresh dev session
  const devSession: User = {
    id: 1,
    phone: "0700000000",
    name: "Dev School Admin",
    username: "Dev School Admin",
    role: "schooladmin",
    school: "Test School Uganda",
    loginTime: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };
  localStorage.setItem("authUser", JSON.stringify(devSession));
}
export function isSessionValid(sessionData?: User): boolean {
  if (sessionData) {
    return Date.now() < sessionData.expiresAt;
  } else {
    const sessionData = getValidSession();
    return sessionData !== null;
  }
}

export function getValidSession(): User | null {
  try {
    if (typeof window === "undefined") return null;

    const authUser = localStorage.getItem("authUser");
    if (!authUser) return null;

    const sessionData: User = JSON.parse(authUser);

    // Check if session has required fields and is not expired
    if (!sessionData.expiresAt || !isSessionValid(sessionData)) {
      localStorage.removeItem("authUser");
      return null;
    }

    return sessionData;
  } catch (error) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("authUser");
    }
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("authUser");
    localStorage.removeItem("export_token");
    localStorage.removeItem("export_token_timestamp");
  }
}
export function refreshSession(sessionData: User): void {
  if (typeof window === "undefined") return;

  const refreshedSession = {
    ...sessionData,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  localStorage.setItem("authUser", JSON.stringify(refreshedSession));
}

export function getSessionExpiry(): number | null {
  const sessionData = getValidSession();
  return sessionData ? sessionData.expiresAt : null;
}
