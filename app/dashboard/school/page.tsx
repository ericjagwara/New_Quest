// app/dashboard/school/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  MapPin,
  Sprout,
  UserPlus,
  RefreshCw,
  Globe,
  Wheat,
  ShieldCheck,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Calendar,
  FileText,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_AGROSIGNAL_URL || "https://chris.fastapicloud.dev";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Farmer {
  id: string;
  msisdn: string;
  name: string;
  country: string;
  district: string;
  gps_lat: string;
  gps_lng: string;
  gps_captured_at: string;
  primary_crop: string;
  language: string;
  status: string;
  registered_by_agent_id: string | null;
}

interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  email?: string;
  access_token?: string;
  farmer_id?: string;
}

interface Policy {
  id: string;
  name: string;
  description?: string;
  status: string;
  currency?: string;
}

interface Season {
  id: string;
  name: string;
  policy_id: string;
  status: string;
  premium_collection_date?: string;
  start_date?: string;
  end_date?: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  msisdn?: string;
  label?: string;
  status: string;
  is_default?: boolean;
}

interface EnrollmentResult {
  id: string;
  farmer_id: string;
  policy_id: string;
  season_id: string;
  payin_method_id: string;
  payout_method_id: string;
  payment_type: string;
  premium_amount: number;
  currency: string;
  status: string;
  enrolled_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CROPS = [
  "Coffee",
  "Maize",
  "Beans",
  "Banana",
  "Cassava",
  "Rice",
  "Sorghum",
  "Millet",
  "Sunflower",
  "Tea",
  "Cotton",
  "Sugarcane",
  "Groundnuts",
  "Sweet Potato",
  "Other",
];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sw", label: "Swahili" },
  { value: "lg", label: "Luganda" },
  { value: "fr", label: "French" },
];
const COUNTRIES = [
  { value: "UG", label: "Uganda" },
  { value: "KE", label: "Kenya" },
  { value: "TZ", label: "Tanzania" },
  { value: "RW", label: "Rwanda" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken(): string | null {
  try {
    return (
      JSON.parse(localStorage.getItem("authUser") || "{}").access_token ?? null
    );
  } catch {
    return null;
  }
}

function authHeaders(token?: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function jitterDuplicates(
  farmers: Farmer[],
): Array<Farmer & { _lat: number; _lng: number }> {
  const seen: Record<string, number> = {};
  return farmers.map((f) => {
    const lat = parseFloat(f.gps_lat);
    const lng = parseFloat(f.gps_lng);
    if (isNaN(lat) || isNaN(lng)) return { ...f, _lat: lat, _lng: lng };
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const count = seen[key] ?? 0;
    seen[key] = count + 1;
    const angle = count * 137.5 * (Math.PI / 180);
    const radius = count === 0 ? 0 : 0.002 * Math.sqrt(count);
    return {
      ...f,
      _lat: lat + radius * Math.sin(angle),
      _lng: lng + radius * Math.cos(angle),
    };
  });
}

// ─── Self-Enrollment Modal ────────────────────────────────────────────────────
type EnrollStep = "policy" | "season" | "payment" | "confirm" | "done";

function SelfEnrollModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (result: EnrollmentResult) => void;
}) {
  const [step, setStep] = useState<EnrollStep>("policy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);

  // Selections
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [selectedPayin, setSelectedPayin] = useState<PaymentMethod | null>(
    null,
  );
  const [selectedPayout, setSelectedPayout] = useState<PaymentMethod | null>(
    null,
  );
  const [paymentType] = useState("self_pay");
  const [result, setResult] = useState<EnrollmentResult | null>(null);

  // Load policies on mount
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE_URL}/policies`, {
          headers: authHeaders(getToken()),
        });
        if (!res.ok) throw new Error(`Failed to load policies (${res.status})`);
        const d = await res.json();
        setPolicies(Array.isArray(d) ? d : (d.items ?? []));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // Load seasons when policy selected
  useEffect(() => {
    if (!selectedPolicy) return;
    setSeasons([]);
    setSelectedSeason(null);
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/policies/${selectedPolicy.id}/seasons`,
          { headers: authHeaders(getToken()) },
        );
        if (!res.ok) throw new Error(`Failed to load seasons (${res.status})`);
        const d = await res.json();
        const list: Season[] = Array.isArray(d) ? d : (d.items ?? []);
        setSeasons(
          list.filter((s) => s.status === "upcoming" || s.status === "active"),
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, [selectedPolicy]);

  // Load payment methods when reaching payment step
  useEffect(() => {
    if (step !== "payment") return;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE_URL}/farmers/me/payment-methods`, {
          headers: authHeaders(getToken()),
        });
        if (!res.ok)
          throw new Error(`Could not load payment methods (${res.status})`);
        const d = await res.json();
        const list: PaymentMethod[] = Array.isArray(d) ? d : (d.items ?? []);
        setPayMethods(list.filter((m) => m.status === "active"));
        // Auto-select defaults
        const defIn = list.find((m) => m.is_default && m.status === "active");
        const defOut = list.find((m) => m.is_default && m.status === "active");
        if (defIn) setSelectedPayin(defIn);
        if (defOut) setSelectedPayout(defOut);
      } catch (e: any) {
        // Non-fatal: farmer may not have methods on file; show manual UUIDs
        setPayMethods([]);
      } finally {
        setBusy(false);
      }
    })();
  }, [step]);

  const goTo = (s: EnrollStep) => {
    setError(null);
    setStep(s);
  };

  const submit = async () => {
    if (!selectedPolicy || !selectedSeason) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        policy_id: selectedPolicy.id,
        season_id: selectedSeason.id,
        payment_type: paymentType,
      };
      if (selectedPayin) body.payin_method_id = selectedPayin.id;
      if (selectedPayout) body.payout_method_id = selectedPayout.id;

      const res = await fetch(`${API_BASE_URL}/enrollments/farmers`, {
        method: "POST",
        headers: authHeaders(getToken()),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const detail = e.detail;
        throw new Error(
          Array.isArray(detail)
            ? detail.map((d: any) => d.msg).join(", ")
            : detail || `Failed (${res.status})`,
        );
      }
      const data: EnrollmentResult = await res.json();
      setResult(data);
      setStep("done");
      onSuccess(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Step progress bar
  const STEPS: EnrollStep[] = ["policy", "season", "payment", "confirm"];
  const stepIdx = STEPS.indexOf(step === "done" ? "confirm" : step);

  const stepLabel: Record<EnrollStep, string> = {
    policy: "Choose Policy",
    season: "Choose Season",
    payment: "Payment Methods",
    confirm: "Confirm",
    done: "Done",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.48)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                Enroll in a Policy
              </h2>
              <p className="text-emerald-100 text-xs">
                Self-enrollment · {stepLabel[step]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Progress bar */}
        {step !== "done" && (
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1.5 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0 ${
                      i < stepIdx
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : i === stepIdx
                          ? "bg-white border-emerald-600 text-emerald-700"
                          : "bg-white border-gray-200 text-gray-300"
                    }`}
                  >
                    {i < stepIdx ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${
                      i <= stepIdx ? "text-emerald-700" : "text-gray-300"
                    }`}
                  >
                    {stepLabel[s]}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 rounded-full mx-1 ${i < stepIdx ? "bg-emerald-500" : "bg-gray-200"}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ── STEP: Policy ── */}
          {step === "policy" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Select the insurance policy you want to enroll in.
              </p>
              {busy ? (
                <div className="flex items-center justify-center py-12 text-emerald-600 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading policies…</span>
                </div>
              ) : policies.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No active policies available
                </div>
              ) : (
                <div className="space-y-2">
                  {policies
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPolicy(p)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                          selectedPolicy?.id === p.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">
                              {p.name}
                            </p>
                            {p.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                {p.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                {p.status}
                              </Badge>
                              {p.currency && (
                                <span className="text-xs text-gray-400">
                                  {p.currency}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                              selectedPolicy?.id === p.id
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedPolicy?.id === p.id && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Season ── */}
          {step === "season" && (
            <div className="space-y-3">
              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-sm text-emerald-800 font-medium">
                Policy: {selectedPolicy?.name}
              </div>
              <p className="text-sm text-gray-500">
                Select an upcoming or active season to enroll in.
              </p>
              {busy ? (
                <div className="flex items-center justify-center py-12 text-emerald-600 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading seasons…</span>
                </div>
              ) : seasons.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  No eligible seasons available for this policy
                </div>
              ) : (
                <div className="space-y-2">
                  {seasons.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeason(s)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        selectedSeason?.id === s.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {s.name}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            <Badge
                              className={`text-xs ${s.status === "active" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
                            >
                              {s.status}
                            </Badge>
                            {s.premium_collection_date && (
                              <span className="text-xs text-gray-500">
                                Premium due:{" "}
                                {new Date(
                                  s.premium_collection_date,
                                ).toLocaleDateString()}
                              </span>
                            )}
                            {s.start_date && s.end_date && (
                              <span className="text-xs text-gray-400">
                                {new Date(s.start_date).toLocaleDateString()} –{" "}
                                {new Date(s.end_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                            selectedSeason?.id === s.id
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedSeason?.id === s.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Payment Methods ── */}
          {step === "payment" && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5 text-xs text-sky-800 flex gap-2 items-start">
                <span className="flex-shrink-0 mt-0.5">ℹ</span>
                <span>
                  Your active, OTP-verified payment methods are shown below. If
                  none appear, please set up a payment method first. Enrollment
                  starts as <strong>pending_payment</strong> and activates on
                  the premium collection date.
                </span>
              </div>

              {busy ? (
                <div className="flex items-center justify-center py-8 text-emerald-600 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading payment methods…</span>
                </div>
              ) : (
                <>
                  {/* Pay-in */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Premium Pay-in Method
                    </label>
                    {payMethods.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">
                        No active pay-in methods — default from your profile
                        will be used.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {payMethods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedPayin(m)}
                            className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-all ${
                              selectedPayin?.id === m.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-800 capitalize">
                                  {m.type.replace(/_/g, " ")}
                                </span>
                                {m.msisdn && (
                                  <span className="text-gray-500 ml-2 text-xs font-mono">
                                    {m.msisdn}
                                  </span>
                                )}
                                {m.label && (
                                  <span className="text-gray-500 ml-2 text-xs">
                                    {m.label}
                                  </span>
                                )}
                                {m.is_default && (
                                  <Badge className="ml-2 bg-gray-100 text-gray-600 text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                  selectedPayin?.id === m.id
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedPayin?.id === m.id && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pay-out */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 rotate-180" />
                      Claim Pay-out Method
                    </label>
                    {payMethods.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">
                        No active pay-out methods — default from your profile
                        will be used.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {payMethods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedPayout(m)}
                            className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-all ${
                              selectedPayout?.id === m.id
                                ? "border-teal-500 bg-teal-50"
                                : "border-gray-200 hover:border-teal-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-800 capitalize">
                                  {m.type.replace(/_/g, " ")}
                                </span>
                                {m.msisdn && (
                                  <span className="text-gray-500 ml-2 text-xs font-mono">
                                    {m.msisdn}
                                  </span>
                                )}
                                {m.label && (
                                  <span className="text-gray-500 ml-2 text-xs">
                                    {m.label}
                                  </span>
                                )}
                                {m.is_default && (
                                  <Badge className="ml-2 bg-gray-100 text-gray-600 text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                  selectedPayout?.id === m.id
                                    ? "border-teal-500 bg-teal-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedPayout?.id === m.id && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP: Confirm ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please review your enrollment details before submitting.
              </p>
              <div className="rounded-xl border border-emerald-200 overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Enrollment Summary
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: "Policy", value: selectedPolicy?.name },
                    { label: "Season", value: selectedSeason?.name },
                    { label: "Payment Type", value: "Self Pay" },
                    {
                      label: "Pay-in Method",
                      value: selectedPayin
                        ? `${selectedPayin.type.replace(/_/g, " ")}${selectedPayin.msisdn ? " · " + selectedPayin.msisdn : ""}`
                        : "Profile default",
                    },
                    {
                      label: "Pay-out Method",
                      value: selectedPayout
                        ? `${selectedPayout.type.replace(/_/g, " ")}${selectedPayout.msisdn ? " · " + selectedPayout.msisdn : ""}`
                        : "Profile default",
                    },
                    { label: "Initial Status", value: "Pending Payment" },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="px-4 py-3 flex justify-between gap-4 text-sm"
                    >
                      <span className="text-gray-500 flex-shrink-0">
                        {label}
                      </span>
                      <span className="font-medium text-gray-800 text-right">
                        {value ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Coverage becomes active when the premium is collected on the
                season's premium collection date.
              </div>
            </div>
          )}

          {/* ── STEP: Done ── */}
          {step === "done" && result && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">
                  Enrollment Submitted!
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your enrollment is <strong>pending payment</strong>. Coverage
                  activates when your premium is collected.
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left text-sm space-y-2">
                {[
                  {
                    label: "Enrollment ID",
                    value: result.id.slice(0, 18) + "…",
                    mono: true,
                  },
                  { label: "Policy", value: selectedPolicy?.name ?? "—" },
                  { label: "Season", value: selectedSeason?.name ?? "—" },
                  {
                    label: "Premium",
                    value: `${result.currency} ${result.premium_amount?.toLocaleString()}`,
                  },
                  { label: "Status", value: result.status },
                  {
                    label: "Enrolled at",
                    value: new Date(result.enrolled_at).toLocaleString(),
                  },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-gray-500">{label}</span>
                    <span
                      className={`font-medium text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step !== "done" && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
            {step !== "policy" ? (
              <Button
                variant="outline"
                onClick={() => {
                  const prev: Record<EnrollStep, EnrollStep> = {
                    policy: "policy",
                    season: "policy",
                    payment: "season",
                    confirm: "payment",
                    done: "confirm",
                  };
                  goTo(prev[step]);
                }}
                className="flex-1 border-gray-200 text-gray-600"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-200 text-gray-600"
              >
                Cancel
              </Button>
            )}

            {step === "policy" && (
              <Button
                disabled={!selectedPolicy}
                onClick={() => goTo("season")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === "season" && (
              <Button
                disabled={!selectedSeason}
                onClick={() => goTo("payment")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === "payment" && (
              <Button
                onClick={() => goTo("confirm")}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === "confirm" && (
              <Button
                onClick={submit}
                disabled={busy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" /> Confirm Enrollment
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AgroSignalDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // ── Enrollment ─────────────────────────────────────────────────────────────
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentResult[]>([]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const farmersRef = useRef<Farmer[]>([]);
  const router = useRouter();

  const [form, setForm] = useState({
    msisdn: "",
    name: "",
    country: "UG",
    district: "",
    primary_crop: "Coffee",
    language: "en",
    email: "",
  });

  useEffect(() => {
    farmersRef.current = farmers;
  }, [farmers]);

  // Auth
  useEffect(() => {
    const authUser = localStorage.getItem("authUser");
    if (!authUser) {
      router.push("/");
      return;
    }
    try {
      const parsed = JSON.parse(authUser);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem("authUser");
        router.push("/");
        return;
      }
      setUser(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  // Fetch farmers
  const fetchFarmers = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/farmers`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error(`Failed to fetch farmers (${res.status})`);
      const data = await res.json();
      const list: Farmer[] = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : (data.farmers ?? []);
      setFarmers(list);
    } catch (err: any) {
      setFetchError(err.message || "Failed to load farmers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchFarmers();
  }, [user, fetchFarmers]);

  // Markers
  const drawMarkers = useCallback((L: any, map: any, farmerList: Farmer[]) => {
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    const valid = farmerList.filter(
      (f) =>
        f.gps_lat &&
        f.gps_lng &&
        !isNaN(parseFloat(f.gps_lat)) &&
        !isNaN(parseFloat(f.gps_lng)),
    );
    if (valid.length === 0) return;
    const jittered = jitterDuplicates(valid);
    jittered.forEach((farmer) => {
      const popup = L.popup().setContent(`
        <div style="font-family:sans-serif;min-width:180px;line-height:1.7">
          <strong style="font-size:13px;color:#166534">${farmer.name}</strong><br/>
          <span style="color:#6b7280;font-size:12px">📍 ${farmer.district}, ${farmer.country}</span><br/>
          <span style="color:#6b7280;font-size:12px">🌾 ${farmer.primary_crop}</span><br/>
          <span style="color:#6b7280;font-size:12px">📱 ${farmer.msisdn}</span><br/>
          <span style="color:#9ca3af;font-size:11px">${parseFloat(farmer.gps_lat).toFixed(5)}, ${parseFloat(farmer.gps_lng).toFixed(5)}</span>
        </div>`);
      const marker = L.marker([farmer._lat, farmer._lng])
        .bindPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });
    try {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.3));
    } catch (_) {}
  }, []);

  const mapCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      if (mapInstanceRef.current) return;
      mapContainerRef.current = node;
      (async () => {
        const L = (await import("leaflet")).default;
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
          await new Promise((r) => setTimeout(r, 100));
        }
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
        const map = L.map(node, { zoomControl: true }).setView(
          [1.3733, 32.2903],
          6,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);
        mapInstanceRef.current = map;
        if (farmersRef.current.length > 0)
          drawMarkers(L, map, farmersRef.current);
        node.addEventListener("farmers-updated", ((e: CustomEvent) => {
          drawMarkers(L, map, e.detail as Farmer[]);
        }) as EventListener);
      })();
    },
    [drawMarkers],
  );

  useEffect(() => {
    const node = mapContainerRef.current;
    if (!node || !mapInstanceRef.current) return;
    node.dispatchEvent(new CustomEvent("farmers-updated", { detail: farmers }));
  }, [farmers]);

  useEffect(
    () => () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    },
    [],
  );

  // Register farmer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      const token = getToken();
      const payload: Record<string, string> = {
        msisdn: form.msisdn,
        name: form.name,
        country: form.country,
        district: form.district,
        primary_crop: form.primary_crop,
        language: form.language,
      };
      if (form.email) payload.email = form.email;
      const res = await fetch(`${API_BASE_URL}/farmers`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.detail;
        throw new Error(
          Array.isArray(detail)
            ? detail.map((d: any) => d.msg).join(", ")
            : detail || `Failed (${res.status})`,
        );
      }
      const data = await res.json();
      const newFarmer: Farmer = data.farmer ?? data;
      setFarmers((prev) => [newFarmer, ...prev]);
      setSuccessMsg(`✓ ${newFarmer.name} registered successfully!`);
      setForm({
        msisdn: "",
        name: "",
        country: "UG",
        district: "",
        primary_crop: "Coffee",
        language: "en",
        email: "",
      });
      setTimeout(() => {
        setDialogOpen(false);
        setSuccessMsg(null);
      }, 1600);
    } catch (err: any) {
      setFormError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const cropCounts = farmers.reduce<Record<string, number>>((acc, f) => {
    const c = (f.primary_crop || "Unknown").toLowerCase();
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const districts = new Set(farmers.map((f) => f.district)).size;
  const activeCount = farmers.filter((f) => f.status === "active").length;
  const mappedCount = farmers.filter(
    (f) =>
      f.gps_lat &&
      f.gps_lng &&
      !isNaN(parseFloat(f.gps_lat)) &&
      !isNaN(parseFloat(f.gps_lng)),
  ).length;

  // Is the logged-in user a farmer? Show Enroll button for them.
  const isFarmer = user?.role === "farmer" || !!user?.farmer_id;

  if (!user)
    return (
      <div className="flex items-center justify-center h-screen text-emerald-700">
        Authenticating…
      </div>
    );

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="font-medium">Farmer Management</span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-3xl font-bold text-emerald-800">
                  Farmer Management
                </h1>
                <p className="text-emerald-600 text-sm mt-1">
                  Register and track farmers across all regions
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={fetchFarmers}
                  disabled={loading}
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>

                {/* ── Self-Enroll button — shown for farmer accounts ─────── */}
                {isFarmer && (
                  <Button
                    onClick={() => setShowEnroll(true)}
                    className="bg-white border-2 border-teal-500 text-teal-700 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all shadow-sm font-semibold"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Enroll in Policy
                  </Button>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Register Farmer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-emerald-800 flex items-center gap-2">
                        <Sprout className="w-5 h-5" />
                        Register New Farmer
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRegister} className="space-y-4 mt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Full Name *
                          </Label>
                          <Input
                            value={form.name}
                            onChange={(e) =>
                              setForm({ ...form, name: e.target.value })
                            }
                            placeholder="e.g. Brian Katende"
                            required
                            className="border-gray-200 focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Phone (MSISDN) *
                          </Label>
                          <Input
                            value={form.msisdn}
                            onChange={(e) =>
                              setForm({ ...form, msisdn: e.target.value })
                            }
                            placeholder="+256700000000"
                            required
                            className="border-gray-200 focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold text-gray-700">
                            Country *
                          </Label>
                          <select
                            value={form.country}
                            onChange={(e) =>
                              setForm({ ...form, country: e.target.value })
                            }
                            required
                            className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold text-gray-700">
                            District *
                          </Label>
                          <Input
                            value={form.district}
                            onChange={(e) =>
                              setForm({ ...form, district: e.target.value })
                            }
                            placeholder="e.g. Kampala"
                            required
                            className="border-gray-200 focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold text-gray-700">
                            Primary Crop *
                          </Label>
                          <select
                            value={form.primary_crop}
                            onChange={(e) =>
                              setForm({ ...form, primary_crop: e.target.value })
                            }
                            required
                            className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          >
                            {CROPS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold text-gray-700">
                            Language *
                          </Label>
                          <select
                            value={form.language}
                            onChange={(e) =>
                              setForm({ ...form, language: e.target.value })
                            }
                            required
                            className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          >
                            {LANGUAGES.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Email{" "}
                            <span className="text-gray-400 font-normal">
                              (optional)
                            </span>
                          </Label>
                          <Input
                            type="email"
                            value={form.email}
                            onChange={(e) =>
                              setForm({ ...form, email: e.target.value })
                            }
                            placeholder="farmer@example.com"
                            className="border-gray-200 focus:border-emerald-400"
                          />
                        </div>
                      </div>
                      {formError && (
                        <div className="bg-red-50 border-l-4 border-red-400 rounded p-3 text-sm text-red-800">
                          {formError}
                        </div>
                      )}
                      {successMsg && (
                        <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded p-3 text-sm text-emerald-800">
                          {successMsg}
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {submitting ? "Registering…" : "Register Farmer"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {fetchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm flex items-center justify-between">
                <span>{fetchError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchFarmers}
                  className="text-red-700 border-red-300 hover:bg-red-100 bg-transparent ml-4"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* ── Enrollment banner (farmer accounts) ──────────────────── */}
            {isFarmer && (
              <div className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 p-4 flex items-center justify-between gap-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      Protect your harvest
                    </p>
                    <p className="text-teal-100 text-xs">
                      Enroll in an insurance policy for this season to get
                      coverage against weather events.
                      {enrollments.length > 0 &&
                        ` You have ${enrollments.length} active enrollment${enrollments.length > 1 ? "s" : ""}.`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowEnroll(true)}
                  className="bg-white text-teal-700 hover:bg-teal-50 font-semibold flex-shrink-0 shadow-sm text-sm"
                >
                  Enroll Now
                </Button>
              </div>
            )}

            {/* ── Recent enrollments (session) ─────────────────────────── */}
            {enrollments.length > 0 && (
              <Card className="shadow-md border-teal-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-teal-800 text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    My Enrollments
                    <Badge className="ml-auto bg-teal-100 text-teal-700 text-xs">
                      {enrollments.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {enrollments.map((en) => (
                    <div
                      key={en.id}
                      className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-teal-800 font-mono">
                          {en.id.slice(0, 16)}…
                        </span>
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          {en.status}
                        </Badge>
                      </div>
                      <p className="text-teal-700">
                        {en.currency} {en.premium_amount?.toLocaleString()}{" "}
                        premium
                      </p>
                      <p className="text-gray-400">
                        {new Date(en.enrolled_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Farmers",
                  value: farmers.length,
                  icon: Users,
                  colors: "from-emerald-500 to-emerald-600",
                  text: "text-emerald-100",
                  icon_c: "text-emerald-200",
                },
                {
                  label: "Active",
                  value: activeCount,
                  icon: Globe,
                  colors: "from-teal-500 to-teal-600",
                  text: "text-teal-100",
                  icon_c: "text-teal-200",
                },
                {
                  label: "Districts",
                  value: districts,
                  icon: MapPin,
                  colors: "from-cyan-500 to-cyan-600",
                  text: "text-cyan-100",
                  icon_c: "text-cyan-200",
                },
                {
                  label: "Mapped",
                  value: mappedCount,
                  icon: Wheat,
                  colors: "from-green-500 to-green-600",
                  text: "text-green-100",
                  icon_c: "text-green-200",
                },
              ].map(({ label, value, icon: Icon, colors, text, icon_c }) => (
                <Card
                  key={label}
                  className={`bg-gradient-to-br ${colors} text-white shadow-lg border-0`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={`${text} text-xs font-medium uppercase tracking-wide`}
                        >
                          {label}
                        </p>
                        <p className="text-4xl font-bold mt-1">{value}</p>
                      </div>
                      <Icon className={`w-10 h-10 ${icon_c}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Map + Crop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-lg border-emerald-100 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-emerald-800 flex items-center gap-2 text-base">
                    <MapPin className="w-5 h-5" />
                    Farmer Locations
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-emerald-100 text-emerald-700"
                    >
                      {mappedCount} mapped
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={mapCallbackRef}
                    style={{ height: 420, width: "100%" }}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-lg border-emerald-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-emerald-800 flex items-center gap-2 text-base">
                    <Sprout className="w-5 h-5" />
                    Crop Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(cropCounts).length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">
                      No data yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(cropCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([crop, count]) => {
                          const pct = Math.round(
                            (count / farmers.length) * 100,
                          );
                          return (
                            <div key={crop}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700 capitalize">
                                  {crop}
                                </span>
                                <span className="text-gray-500">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Farmers table */}
            <Card className="shadow-lg border-emerald-100">
              <CardHeader>
                <CardTitle className="text-emerald-800 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Registered Farmers
                  <Badge className="ml-auto bg-emerald-600 text-white">
                    {farmers.length} total
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12 text-emerald-600">
                    Loading farmers…
                  </div>
                ) : farmers.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No farmers registered yet.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-100 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-emerald-50">
                        <TableRow>
                          <TableHead className="text-emerald-800 font-semibold">
                            Name
                          </TableHead>
                          <TableHead className="text-emerald-800 font-semibold">
                            Phone
                          </TableHead>
                          <TableHead className="text-emerald-800 font-semibold">
                            District
                          </TableHead>
                          <TableHead className="text-emerald-800 font-semibold">
                            Crop
                          </TableHead>
                          <TableHead className="text-emerald-800 font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="text-emerald-800 font-semibold">
                            Coordinates
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {farmers.map((farmer) => (
                          <TableRow
                            key={farmer.id}
                            className="hover:bg-emerald-50/50 cursor-pointer"
                            onClick={() => {
                              if (
                                !mapInstanceRef.current ||
                                !farmer.gps_lat ||
                                !farmer.gps_lng
                              )
                                return;
                              const lat = parseFloat(farmer.gps_lat);
                              const lng = parseFloat(farmer.gps_lng);
                              if (isNaN(lat) || isNaN(lng)) return;
                              mapInstanceRef.current.setView([lat, lng], 13);
                              markersRef.current.forEach((m) => {
                                const pos = m.getLatLng();
                                if (
                                  Math.abs(pos.lat - lat) < 0.005 &&
                                  Math.abs(pos.lng - lng) < 0.005
                                )
                                  m.openPopup();
                              });
                              mapContainerRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }}
                          >
                            <TableCell className="font-medium text-gray-900">
                              {farmer.name}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {farmer.msisdn}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {farmer.district}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-emerald-300 text-emerald-700 capitalize"
                              >
                                {farmer.primary_crop}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  farmer.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                                }
                              >
                                {farmer.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {farmer.gps_lat && farmer.gps_lng ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-mono">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {parseFloat(farmer.gps_lat).toFixed(4)},{" "}
                                  {parseFloat(farmer.gps_lng).toFixed(4)}
                                </span>
                              ) : (
                                <span className="text-gray-300">No GPS</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* ── Self-Enrollment Modal ──────────────────────────────────────────── */}
      {showEnroll && (
        <SelfEnrollModal
          onClose={() => setShowEnroll(false)}
          onSuccess={(result) => {
            setEnrollments((prev) => [result, ...prev]);
            setShowEnroll(false);
          }}
        />
      )}
    </div>
  );
}
