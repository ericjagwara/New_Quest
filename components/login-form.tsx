"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    partner_type: string;
    status: string;
    is_admin: boolean;
  };
}

interface ApiError extends Error {
  name: string;
  message: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://chris.fastapicloud.dev";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState("insurer"); // ← fixed default
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Login failed" }));
        const detail = errorData.detail;
        if (Array.isArray(detail)) {
          throw new Error(detail.map((d: any) => d.msg).join(", "));
        }
        throw new Error(detail || `Login failed: ${response.status}`);
      }

      const data: LoginResponse = await response.json();

      const sessionData = {
        id: data.user.id,
        email: data.user.email,
        phone: data.user.phone_number,
        name: data.user.full_name,
        username: data.user.full_name,
        role: loginRole,
        partner_type: data.user.partner_type,
        is_admin: data.user.is_admin,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        loginTime: Date.now(),
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      localStorage.setItem("authUser", JSON.stringify(sessionData));

      // ← fixed routing
      if (loginRole === "schooladmin") {
        router.push("/dashboard/school");
      } else if (loginRole === "insurer") {
        router.push("/dashboard/insurer");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const error = err as ApiError;
      if (error.name === "AbortError") {
        setError(
          "Request timed out. Please check your connection and try again.",
        ); // ← removed stray 's'
      } else {
        setError(error.message || "Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-3">
          <div className="relative">
            <Image
              src="/hygiene-quest-logo.jpg"
              alt="Hygiene Quest Logo"
              width={70}
              height={70}
              className="rounded-full shadow-lg ring-4 ring-white ring-opacity-50"
            />
            <div className="absolute inset-0 rounded-full bg-teal-400 opacity-20 blur-xl -z-10"></div>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-teal-700 tracking-tight">
            Agro Signal Project
          </h1>
          <h2 className="text-lg font-semibold text-gray-800 leading-tight">
            Welcome To The Best Insurance Service For Agriculture Industry In
            Uganda
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed max-w-lg mx-auto">
            Track progress, access resources, and support agriculture Anywhere
            On The Continent of Africa
          </p>
        </div>
      </div>

      <Card className="shadow-2xl border-0 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 to-blue-50/30"></div>
        <div className="relative">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold text-center text-white bg-gradient-to-r from-teal-600 to-teal-500 py-2 px-4 rounded-t-lg -mx-6 -mt-6 mb-3 shadow-md">
              Sign In
            </CardTitle>
            <CardDescription className="text-center text-teal-600 font-medium text-sm">
              Enter your credentials to access the platform. If you don't have
              an account, please contact your administrator.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-6">
              {/* Email */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-gray-800 font-semibold text-sm"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg transition-all duration-200 text-sm"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-gray-800 font-semibold text-sm"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg transition-all duration-200 text-sm pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role dropdown */}
              <div className="space-y-2">
                <Label
                  htmlFor="loginRole"
                  className="text-gray-800 font-semibold text-sm"
                >
                  Login As
                </Label>
                <select
                  id="loginRole"
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value)}
                  className="w-full h-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-lg px-3 text-sm bg-white transition-all duration-200"
                  required
                >
                  <option value="insurer">Insurer</option>
                  {/* ← fixed value */}
                  <option value="manager">Field Agent</option>
                  <option value="superadmin">Farmer</option>
                  <option value="schooladmin">Platform Admin</option>
                </select>
                {loginRole === "schooladmin" && (
                  <p className="text-xs text-teal-600 font-medium">
                    You will be directed to your school's dashboard after login.
                  </p>
                )}
              </div>

              {error && (
                <Alert
                  variant="destructive"
                  className="border-l-4 border-red-500 bg-red-50 shadow-sm"
                >
                  <AlertDescription className="text-red-800 font-medium text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 px-6 pb-6">
              <Button
                type="submit"
                className="w-full h-10 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <a
                href="/forgot-password"
                className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-medium transition-colors duration-200 text-center"
              >
                Forgot your password?
              </a>

              <div className="w-full border-t border-gray-200 pt-3">
                <a
                  href="/dashboard/fieldagent"
                  className="w-full flex items-center justify-center h-10 border-2 border-teal-500 text-teal-600 hover:bg-teal-50 font-semibold text-sm rounded-lg transition-all duration-200"
                >
                  Continue as Field Agent
                </a>
              </div>
            </CardFooter>
          </form>
        </div>
      </Card>

      <div className="text-center text-xs text-gray-500 font-medium">
        © Agro Signal 2026. All rights reserved. Developed by Hygiene Quest
        Team.
      </div>
    </div>
  );
}
