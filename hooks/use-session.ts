"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidSession, clearSession, type SessionData } from "@/lib/session";

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validSession = getValidSession();

    if (!validSession) {
      router.push("/login");
      return;
    }

    setSession(validSession);
    setIsLoading(false);
  }, []);

  const logout = () => {
    clearSession();
    setSession(null);
    router.push("/login");
  };

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    logout,
  };
}
