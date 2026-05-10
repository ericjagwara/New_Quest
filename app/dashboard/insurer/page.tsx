// app/dashboard/insurer/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Plus,
  RefreshCw,
  AlertTriangle,
  CloudRain,
  Zap,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  TrendingDown,
  Loader2,
  Banknote,
  Users,
  ClipboardCheck,
  Wifi,
  ArrowRight,
} from "lucide-react";

const API = "https://chris.fastapicloud.dev";
const DROUGHT_THRESHOLD = 0.3;
const FLOOD_THRESHOLD = 0.1;

// Types
interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  access_token?: string;
  partner_id?: string;
  expiresAt?: number;
}
interface InsurerProfile {
  id: string;
  licence_number: string;
  regulator_name: string;
  review_mode: string;
  partner: {
    id: string;
    name: string;
    country: string;
    status: string;
    primary_contact_name: string;
    primary_contact_email: string;
  };
}
interface Policy {
  id: string;
  name: string;
  description?: string;
  status: string;
  coverage_amount_display: number;
  premium_amount_display: number;
  currency: string;
  qod_drop_threshold_pct?: number;
  consecutive_readings_required?: number;
  payout_pct?: number;
  per_event_cap_amt?: number;
  per_season_cap_amt?: number;
  crops?: { crop_type: string }[];
  regions?: {
    country: string;
    region_name: string;
    districts: { district_name: string }[];
  }[];
}
interface SignalReading {
  id: string;
  farmer_id: string;
  msisdn: string;
  recorded_at: string;
  is_anomalous: boolean;
  qod_value: number;
  drop_pct: number;
  farmer_name?: string;
}
interface WeatherRecord {
  id: string;
  district: string;
  country: string;
  recorded_at: string;
  data_source: string;
  rainfall_mm_display: number;
  drought_index_display: number;
  flood_risk_score_display: number;
}

// Payout simulation step
interface SimStep {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "done" | "failed";
  result?: string;
}

// Helpers
function getToken() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "{}").access_token;
  } catch {
    return undefined;
  }
}
function authH(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
function fmt(n: number, currency = "UGX") {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
function pctColor(v: number, threshold: number) {
  if (v >= threshold) return "text-red-600 font-bold";
  if (v >= threshold * 0.6) return "text-amber-600 font-semibold";
  return "text-slate-600";
}
function pctBar(v: number, threshold: number) {
  const pct = Math.min(v * 100, 100);
  const color =
    v >= threshold ? "#dc2626" : v >= threshold * 0.6 ? "#d97706" : "#16a34a";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          style={{ width: `${pct}%`, background: color }}
          className="h-full rounded-full transition-all"
        />
      </div>
      <span className={pctColor(v, threshold)}>{(v * 100).toFixed(1)}%</span>
    </div>
  );
}

const EMPTY_POLICY = {
  name: "",
  description: "",
  coverage_amount_display: 50000,
  premium_amount_display: 5000,
  currency: "UGX",
  qod_drop_threshold_pct: 40,
  consecutive_readings_required: 3,
  weather_corroboration_required: true,
  neighbour_check_required: true,
  neighbour_min_count: 3,
  payout_pct: 100,
  per_event_cap_amt: 50000,
  per_season_cap_amt: 150000,
  crop_type: "Maize",
  country: "UG",
  region_name: "Central",
  districts: "Mukono, Wakiso",
  insurer_id: "",
};

type Tab = "overview" | "policies" | "signals" | "weather";

// Payout Simulation Engine
function PayoutSimulator({
  item,
  type,
  policies,
  onClose,
}: {
  item: SignalReading | WeatherRecord;
  type: "signal" | "weather";
  policies: Policy[];
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<SimStep[]>([]);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [totalPayout, setTotalPayout] = useState(0);
  const [farmersCount, setFarmersCount] = useState(0);
  const [currency, setCurrency] = useState("UGX");
  const [txId, setTxId] = useState("");

  // Pick a matching policy for the simulation
  const matchedPolicy =
    policies.find((p) => p.status === "active") ?? policies[0] ?? null;

  const buildSteps = (): SimStep[] => {
    const isWeather = type === "weather";
    const w = item as WeatherRecord;
    const s = item as SignalReading;

    return [
      {
        id: "trigger",
        label: "Event Trigger Received",
        detail: isWeather
          ? `${w.drought_index_display >= DROUGHT_THRESHOLD ? "Drought" : "Flood"} threshold breached in ${w.district}, ${w.country}`
          : `QoD anomaly detected on ${s.msisdn} — drop of ${s.drop_pct?.toFixed(1)}%`,
        status: "pending",
      },
      {
        id: "policy",
        label: "Policy Lookup & Validation",
        detail: matchedPolicy
          ? `Checking policy "${matchedPolicy.name}" — payout ${matchedPolicy.payout_pct}% of coverage`
          : "Scanning active policies for matching coverage criteria",
        status: "pending",
      },
      {
        id: "eligibility",
        label: "Farmer Eligibility Check",
        detail:
          "Cross-referencing enrolled farmers against geofenced plot boundaries in affected district",
        status: "pending",
      },
      {
        id: "corroboration",
        label: "Data Corroboration",
        detail: isWeather
          ? "Cross-checking Open-Meteo readings with QoD signal data for independent confirmation"
          : "Verifying signal anomaly against Open-Meteo drought/flood data for the farmer's district",
        status: "pending",
      },
      {
        id: "calculation",
        label: "Payout Amount Calculation",
        detail: `Applying payout formula: coverage × payout% × eligible farmers — capped at per-event limit`,
        status: "pending",
      },
      {
        id: "compliance",
        label: "Compliance & Fraud Check",
        detail:
          "Running AML check, verifying no duplicate claim exists, confirming policy is not in dispute",
        status: "pending",
      },
      {
        id: "disbursement",
        label: "Mobile Money Disbursement",
        detail:
          "Pushing payment via MTN MoMo / Airtel Money rails to registered farmer MSISDNs",
        status: "pending",
      },
      {
        id: "audit",
        label: "Audit Trail Written",
        detail:
          "Immutable event log created — payout ID, timestamp, farmer IDs, amounts, and policy reference stored",
        status: "pending",
      },
    ];
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const updateStep = (id: string, patch: Partial<SimStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runSimulation = async () => {
    const initial = buildSteps();
    setSteps(initial);
    setRunning(true);
    setComplete(false);

    const durations = [600, 900, 1200, 1000, 800, 1100, 1500, 700];
    const farmers = Math.floor(Math.random() * 18) + 3;
    const pol = matchedPolicy;
    const cov = pol?.coverage_amount_display ?? 50000;
    const pct = pol?.payout_pct ?? 100;
    const cap = pol?.per_event_cap_amt ?? 50000;
    const curr = pol?.currency ?? "UGX";
    const perFarmer = Math.min((cov * pct) / 100, cap);
    const total = Math.min(
      perFarmer * farmers,
      pol?.per_season_cap_amt ?? 150000,
    );

    const results = [
      `Trigger logged at ${new Date().toLocaleTimeString()}`,
      pol
        ? `"${pol.name}" — active, QoD threshold ${pol.qod_drop_threshold_pct}%`
        : "No matching policy found",
      `${farmers} farmers enrolled in affected district`,
      "✓ Corroborated — independent data sources agree",
      `${fmt(perFarmer, curr)} per farmer × ${farmers} = ${fmt(total, curr)}`,
      "✓ No flags — payout approved for processing",
      `${farmers} payments queued — reference TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      "Audit entry committed to ledger",
    ];

    for (let i = 0; i < initial.length; i++) {
      updateStep(initial[i].id, { status: "running" });
      await sleep(durations[i]);
      // Simulate a compliance check that always passes for demo
      updateStep(initial[i].id, { status: "done", result: results[i] });
      if (i === 6) {
        setTxId(`TXN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
        setFarmersCount(farmers);
        setTotalPayout(total);
        setCurrency(curr);
      }
    }

    setRunning(false);
    setComplete(true);
  };

  const stepIcon = (status: SimStep["status"], id: string) => {
    if (status === "running")
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (status === "done")
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === "failed") return <X className="w-4 h-4 text-red-500" />;
    // pending — different icon per step
    const icons: Record<string, any> = {
      trigger: AlertTriangle,
      policy: FileText,
      eligibility: Users,
      corroboration: CloudRain,
      calculation: Banknote,
      compliance: ClipboardCheck,
      disbursement: Wifi,
      audit: Shield,
    };
    const Icon = icons[id] ?? ArrowRight;
    return <Icon className="w-4 h-4 text-slate-300" />;
  };

  return (
    <div className="space-y-4">
      {/* Alert summary */}
      <div
        className={`rounded-lg p-3 text-sm border ${type === "signal" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}
      >
        {type === "signal" ? (
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              QoD Anomaly — {(item as SignalReading).msisdn}
            </p>
            <p className="text-slate-600">
              Drop:{" "}
              <strong className="text-red-600">
                {(item as SignalReading).drop_pct?.toFixed(1)}%
              </strong>{" "}
              · Recorded:{" "}
              {new Date((item as SignalReading).recorded_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              {(item as WeatherRecord).district},{" "}
              {(item as WeatherRecord).country}
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>
                Drought:{" "}
                <strong>
                  {(
                    (item as WeatherRecord).drought_index_display * 100
                  ).toFixed(1)}
                  %
                </strong>
              </span>
              <span>
                Flood:{" "}
                <strong>
                  {(
                    (item as WeatherRecord).flood_risk_score_display * 100
                  ).toFixed(1)}
                  %
                </strong>
              </span>
              <span>
                Rain:{" "}
                <strong>
                  {(item as WeatherRecord).rainfall_mm_display} mm
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Matched policy chip */}
      {matchedPolicy && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
          <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-blue-700 font-medium">
            {matchedPolicy.name}
          </span>
          <span className="text-blue-400 ml-auto">
            {fmt(matchedPolicy.coverage_amount_display, matchedPolicy.currency)}{" "}
            coverage · {matchedPolicy.payout_pct}% payout
          </span>
        </div>
      )}

      {/* Run button */}
      {steps.length === 0 && (
        <Button
          onClick={runSimulation}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
        >
          <Zap className="w-4 h-4 mr-2" />
          Run Payout Simulation
        </Button>
      )}

      {/* Step-by-step progress */}
      {steps.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                step.status === "running"
                  ? "bg-blue-50 border border-blue-200"
                  : step.status === "done"
                    ? "bg-emerald-50 border border-emerald-100"
                    : step.status === "failed"
                      ? "bg-red-50 border border-red-100"
                      : "bg-slate-50 border border-slate-100 opacity-50"
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {stepIcon(step.status, step.id)}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.status === "done"
                      ? "text-emerald-800"
                      : step.status === "running"
                        ? "text-blue-800"
                        : step.status === "failed"
                          ? "text-red-800"
                          : "text-slate-500"
                  }`}
                >
                  {step.label}
                </p>
                {step.status !== "pending" && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {step.result ?? step.detail}
                  </p>
                )}
              </div>
              {step.status === "running" && (
                <span className="text-xs text-blue-500 flex-shrink-0 mt-0.5 animate-pulse">
                  processing…
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Running indicator */}
      {running && (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          Simulation running — do not close this window
        </div>
      )}

      {/* Success state */}
      {complete && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            <p className="font-bold text-emerald-800 text-base">
              Payout Simulation Complete
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
              <p className="text-xs text-slate-500 mb-0.5">Total Disbursed</p>
              <p className="text-lg font-bold text-emerald-700">
                {fmt(totalPayout, currency)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
              <p className="text-xs text-slate-500 mb-0.5">Farmers Paid</p>
              <p className="text-lg font-bold text-emerald-700">
                {farmersCount}
              </p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
              <p className="text-xs text-slate-500 mb-0.5">Payout Method</p>
              <p className="text-sm font-bold text-emerald-700">Mobile Money</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-100">
            <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Transaction Reference</p>
              <p className="text-sm font-mono font-bold text-slate-800">
                {txId}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-500">Timestamp</p>
              <p className="text-xs font-medium text-slate-700">
                {new Date().toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            This is a simulation. In production, real payments would be
            disbursed via MTN MoMo / Airtel Money.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={runSimulation}
              variant="outline"
              size="sm"
              className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Run Again
            </Button>
            <Button
              onClick={onClose}
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Dismiss if not started */}
      {steps.length === 0 && (
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
          className="w-full border-slate-200 text-slate-500 hover:bg-slate-50 bg-white text-xs"
        >
          <X className="w-3 h-3 mr-1.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}

// Main component
export default function InsurerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [insurer, setInsurer] = useState<InsurerProfile | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [signals, setSignals] = useState<SignalReading[]>([]);
  const [weather, setWeather] = useState<WeatherRecord[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_POLICY });
  const [expandedPolicy, setExp] = useState<string | null>(null);

  // Payout sim dialog
  const [simOpen, setSimOpen] = useState(false);
  const [simItem, setSimItem] = useState<SignalReading | WeatherRecord | null>(
    null,
  );
  const [simType, setSimType] = useState<"signal" | "weather">("signal");

  const [sigFilter, setSigFilter] = useState({
    farmer_id: "",
    msisdn: "",
    anomalous: "",
  });
  const [wxFilter, setWxFilter] = useState({
    district: "",
    country: "",
    data_source: "",
    from_dt: "",
    to_dt: "",
  });

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  //  Auth
  useEffect(() => {
    const raw = localStorage.getItem("authUser");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      const u: SessionUser = JSON.parse(raw);
      if (u.expiresAt && Date.now() > u.expiresAt) {
        localStorage.removeItem("authUser");
        router.push("/");
        return;
      }
      setUser(u);
      setForm((f) => ({ ...f, insurer_id: u.partner_id ?? "" }));
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (!user?.partner_id) return;
    fetch(`${API}/partners/insurers/${user.partner_id}`, {
      headers: authH(getToken()),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setInsurer(d);
      })
      .catch(() => {});
  }, [user]);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch(`${API}/policies?page=1&per_page=50`, {
        headers: authH(getToken()),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Handle both array response and paginated response
      const policiesList = Array.isArray(data) ? data : (data.items ?? []);
      setPolicies(policiesList);
    } catch (_) {}
  }, []);

  const fetchSignals = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", per_page: "50" });
    if (sigFilter.farmer_id) params.set("farmer_id", sigFilter.farmer_id);
    if (sigFilter.msisdn) params.set("msisdn", sigFilter.msisdn);
    if (sigFilter.anomalous) params.set("is_anomalous", sigFilter.anomalous);
    try {
      const res = await fetch(`${API}/signal-readings?${params}`, {
        headers: authH(getToken()),
      });
      if (!res.ok) return;
      const d = await res.json();
      setSignals(Array.isArray(d) ? d : (d.items ?? []));
    } catch (_) {}
  }, [sigFilter]);

  const fetchWeather = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", per_page: "100" });
    if (wxFilter.district) params.set("district", wxFilter.district);
    if (wxFilter.country) params.set("country", wxFilter.country);
    if (wxFilter.data_source) params.set("data_source", wxFilter.data_source);
    if (wxFilter.from_dt) params.set("from_dt", wxFilter.from_dt);
    if (wxFilter.to_dt) params.set("to_dt", wxFilter.to_dt);
    try {
      const res = await fetch(`${API}/weather?${params}`, {
        headers: authH(getToken()),
      });
      if (!res.ok) return;
      const d = await res.json();
      setWeather(Array.isArray(d) ? d : (d.items ?? []));
    } catch (_) {}
  }, [wxFilter]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchPolicies(), fetchSignals(), fetchWeather()]).finally(() =>
      setLoading(false),
    );
  }, [user, fetchPolicies, fetchSignals, fetchWeather]);

  // Leaflet
  const mapCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || mapRef.current) return;
    mapDivRef.current = node;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!document.getElementById("leaflet-css")) {
        const lnk = document.createElement("link");
        lnk.id = "leaflet-css";
        lnk.rel = "stylesheet";
        lnk.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(lnk);
        await new Promise((r) => setTimeout(r, 80));
      }
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      leafletRef.current = L;
      mapRef.current = L.map(node).setView([1.3733, 32.2903], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(mapRef.current);
    })();
  }, []);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || weather.length === 0) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    const knownDistricts: Record<string, [number, number]> = {
      Kampala: [0.3476, 32.5825],
      Wakiso: [0.4, 32.45],
      Mukono: [0.353, 32.755],
      Jinja: [0.445, 33.205],
      Gulu: [2.775, 32.299],
      Mbarara: [-0.607, 30.655],
      Kigali: [-1.9441, 30.0619],
      Masaka: [-0.3333, 31.7333],
      Entebbe: [0.0512, 32.4633],
      Lira: [2.2499, 32.8998],
    };
    const latest: Record<string, WeatherRecord> = {};
    weather.forEach((w) => {
      if (!latest[w.district] || w.recorded_at > latest[w.district].recorded_at)
        latest[w.district] = w;
    });
    Object.values(latest).forEach((w) => {
      const coords = knownDistricts[w.district];
      if (!coords) return;
      const isDrought = w.drought_index_display >= DROUGHT_THRESHOLD;
      const isFlood = w.flood_risk_score_display >= FLOOD_THRESHOLD;
      const color = isDrought ? "#dc2626" : isFlood ? "#0891b2" : "#16a34a";
      const emoji = isDrought ? "🌵" : isFlood ? "🌊" : "🌿";
      const icon = L.divIcon({
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">${emoji}</div>`,
        className: "",
        iconAnchor: [16, 16],
      });
      markersRef.current.push(
        L.marker(coords, { icon }).addTo(map).bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;line-height:1.9;min-width:170px">
            <strong>${w.district}, ${w.country}</strong><br/>
            🌧 Rainfall: <strong>${w.rainfall_mm_display} mm</strong><br/>
            🌵 Drought: <strong>${(w.drought_index_display * 100).toFixed(1)}%</strong>${isDrought ? '<span style="color:#dc2626"> ⚠</span>' : ""}<br/>
            🌊 Flood: <strong>${(w.flood_risk_score_display * 100).toFixed(1)}%</strong>${isFlood ? '<span style="color:#0891b2"> ⚠</span>' : ""}<br/>
            <span style="color:#9ca3af;font-size:11px">${new Date(w.recorded_at).toLocaleString()}</span>
          </div>`),
      );
    });
    if (markersRef.current.length > 0) {
      try {
        map.fitBounds(L.featureGroup(markersRef.current).getBounds().pad(0.3));
      } catch (_) {}
    }
  }, [weather]);

  // Create policy
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const insurerId = form.insurer_id || user?.partner_id;
    if (!insurerId) {
      setFormError("Insurer ID is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const districts = form.districts
        .split(",")
        .map((d) => ({ district_name: d.trim() }))
        .filter((d) => d.district_name);
      const body = {
        name: form.name,
        description: form.description,
        coverage_amount_display: Number(form.coverage_amount_display),
        premium_amount_display: Number(form.premium_amount_display),
        currency: form.currency,
        qod_drop_threshold_pct: Number(form.qod_drop_threshold_pct),
        consecutive_readings_required: Number(
          form.consecutive_readings_required,
        ),
        weather_corroboration_required: form.weather_corroboration_required,
        neighbour_check_required: form.neighbour_check_required,
        neighbour_min_count: Number(form.neighbour_min_count),
        payout_pct: Number(form.payout_pct),
        per_event_cap_amt: Number(form.per_event_cap_amt),
        per_season_cap_amt: Number(form.per_season_cap_amt),
        crops: [{ crop_type: form.crop_type }],
        regions: [
          { country: form.country, region_name: form.region_name, districts },
        ],
      };
      const res = await fetch(`${API}/policies/insurers/${insurerId}`, {
        method: "POST",
        headers: authH(getToken()),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Array.isArray(err.detail)
            ? err.detail.map((d: any) => d.msg).join(", ")
            : err.detail || `Failed (${res.status})`,
        );
      }
      const newPolicy: Policy = await res.json();
      setPolicies((prev) => [newPolicy, ...prev]);
      setForm((f) => ({ ...EMPTY_POLICY, insurer_id: f.insurer_id }));
      setPolicyOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openSim = (
    item: SignalReading | WeatherRecord,
    type: "signal" | "weather",
  ) => {
    setSimItem(item);
    setSimType(type);
    setSimOpen(true);
  };

  const anomalousCount = signals.filter((s) => s.is_anomalous).length;
  const droughtCount = weather.filter(
    (w) => w.drought_index_display >= DROUGHT_THRESHOLD,
  ).length;
  const floodCount = weather.filter(
    (w) => w.flood_risk_score_display >= FLOOD_THRESHOLD,
  ).length;
  const activePolicies = policies.filter((p) => p.status === "active").length;
  const latestWeather = weather[0] ?? null;
  const avgDrought = weather.length
    ? weather.reduce((s, w) => s + w.drought_index_display, 0) / weather.length
    : 0;
  const maxRainfall = weather.length
    ? Math.max(...weather.map((w) => w.rainfall_mm_display))
    : 0;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "policies", label: `Policies (${policies.length})`, icon: FileText },
    { id: "signals", label: `QoD Signals (${signals.length})`, icon: Zap },
    { id: "weather", label: `Weather (${weather.length})`, icon: CloudRain },
  ];

  if (!user)
    return (
      <div className="flex items-center justify-center h-screen text-slate-600">
        Authenticating…
      </div>
    );

  return (
    <div className="flex h-screen bg-slate-50">
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white px-8 py-6">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-slate-400 text-xs mb-1">
                  Dashboard / Insurer
                </p>
                <h1 className="text-2xl font-bold">
                  {insurer?.partner.name ?? "Insurer Dashboard"}
                </h1>
                {insurer && (
                  <p className="text-slate-400 text-sm mt-0.5">
                    {insurer.partner.country} · Licence:{" "}
                    {insurer.licence_number} · {insurer.regulator_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {anomalousCount + droughtCount + floodCount > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 text-red-300 text-sm animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                    {anomalousCount + droughtCount + floodCount} alert
                    {anomalousCount + droughtCount + floodCount !== 1
                      ? "s"
                      : ""}
                  </div>
                )}
                <Button
                  onClick={() =>
                    Promise.all([
                      fetchPolicies(),
                      fetchSignals(),
                      fetchWeather(),
                    ])
                  }
                  variant="outline"
                  size="sm"
                  className="border-slate-500 text-slate-300 hover:bg-slate-600 bg-transparent text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Policies",
                  value: policies.length,
                  sub: `${activePolicies} active`,
                  color: "from-blue-500 to-blue-600",
                  icon: FileText,
                  alert: false,
                },
                {
                  label: "QoD Anomalies",
                  value: anomalousCount,
                  sub: "breach threshold",
                  color: "from-red-500 to-red-600",
                  icon: Zap,
                  alert: anomalousCount > 0,
                },
                {
                  label: "Drought Watch",
                  value: droughtCount,
                  sub: `≥ ${DROUGHT_THRESHOLD * 100}% index`,
                  color: "from-amber-500 to-orange-600",
                  icon: TrendingDown,
                  alert: droughtCount > 0,
                },
                {
                  label: "Flood Watch",
                  value: floodCount,
                  sub: `≥ ${FLOOD_THRESHOLD * 100}% risk score`,
                  color: "from-cyan-500 to-cyan-600",
                  icon: CloudRain,
                  alert: floodCount > 0,
                },
              ].map(({ label, value, sub, color, icon: Icon, alert }) => (
                <Card
                  key={label}
                  className={`border-0 shadow-md bg-gradient-to-br ${color} text-white relative overflow-hidden`}
                >
                  {alert && value > 0 && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-ping" />
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
                          {label}
                        </p>
                        <p className="text-4xl font-bold mt-1">{value}</p>
                        <p className="text-white/60 text-xs mt-0.5">{sub}</p>
                      </div>
                      <Icon className="w-8 h-8 text-white/30 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                    tab === t.id
                      ? "bg-white border border-b-white border-slate-200 text-slate-800 -mb-px"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-md border-slate-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      Insurer Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insurer ? (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {[
                          ["Company", insurer.partner.name],
                          ["Country", insurer.partner.country],
                          ["Licence", insurer.licence_number],
                          ["Regulator", insurer.regulator_name],
                          ["Review mode", insurer.review_mode],
                          ["Contact", insurer.partner.primary_contact_name],
                          ["Email", insurer.partner.primary_contact_email],
                          ["Status", insurer.partner.status],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <p className="text-slate-400 text-xs">{k}</p>
                            <p className="font-medium text-slate-700 truncate">
                              {v}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        Profile not loaded —{" "}
                        <code className="bg-slate-100 px-1 rounded text-xs">
                          partner_id
                        </code>{" "}
                        must be in session.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {latestWeather && (
                  <Card className="shadow-md border-slate-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                        <CloudRain className="w-4 h-4 text-blue-500" />
                        Latest Weather
                        <span className="ml-auto text-xs text-slate-400 font-normal">
                          {latestWeather.district}, {latestWeather.country}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-500 mb-1">Rainfall</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {latestWeather.rainfall_mm_display}
                          </p>
                          <p className="text-xs text-blue-400">mm</p>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${latestWeather.drought_index_display >= DROUGHT_THRESHOLD ? "bg-red-50" : "bg-amber-50"}`}
                        >
                          <p className="text-xs text-amber-600 mb-1">Drought</p>
                          <p
                            className={`text-2xl font-bold ${latestWeather.drought_index_display >= DROUGHT_THRESHOLD ? "text-red-700" : "text-amber-700"}`}
                          >
                            {(
                              latestWeather.drought_index_display * 100
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${latestWeather.flood_risk_score_display >= FLOOD_THRESHOLD ? "bg-cyan-50" : "bg-slate-50"}`}
                        >
                          <p className="text-xs text-cyan-600 mb-1">
                            Flood Risk
                          </p>
                          <p
                            className={`text-2xl font-bold ${latestWeather.flood_risk_score_display >= FLOOD_THRESHOLD ? "text-cyan-700" : "text-slate-600"}`}
                          >
                            {(
                              latestWeather.flood_risk_score_display * 100
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span>Avg drought ({weather.length} readings)</span>
                          <span
                            className={pctColor(avgDrought, DROUGHT_THRESHOLD)}
                          >
                            {(avgDrought * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{
                              width: `${Math.min(avgDrought * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1">
                          <span>
                            Peak rainfall · Source: {latestWeather.data_source}
                          </span>
                          <span className="text-blue-600 font-medium">
                            {maxRainfall.toFixed(2)} mm
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="shadow-md border-slate-100 overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      Coverage Map
                      <span className="ml-auto text-xs text-slate-400 font-normal">
                        Latest per district
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div
                      ref={mapCallbackRef}
                      style={{ height: 300, width: "100%" }}
                    />
                  </CardContent>
                </Card>

                <Card className="shadow-md border-slate-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Recent Alerts
                      <Badge className="ml-auto bg-red-100 text-red-700">
                        {anomalousCount + droughtCount + floodCount}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {signals
                        .filter((s) => s.is_anomalous)
                        .slice(0, 2)
                        .map((s) => (
                          <AlertRow
                            key={s.id}
                            type="signal"
                            item={s}
                            onOpen={() => openSim(s, "signal")}
                          />
                        ))}
                      {weather
                        .filter(
                          (w) =>
                            w.drought_index_display >= DROUGHT_THRESHOLD ||
                            w.flood_risk_score_display >= FLOOD_THRESHOLD,
                        )
                        .slice(0, 2)
                        .map((w) => (
                          <AlertRow
                            key={w.id}
                            type="weather"
                            item={w}
                            onOpen={() => openSim(w, "weather")}
                          />
                        ))}
                      {anomalousCount + droughtCount + floodCount === 0 && (
                        <p className="text-slate-400 text-sm text-center py-4">
                          No active alerts — all readings within normal range
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── POLICIES ── */}
            {tab === "policies" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-sm">
                    {policies.length} policies
                  </p>
                  <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Policy
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-slate-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-500" />
                          Create Insurance Policy
                        </DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleCreatePolicy}
                        className="space-y-5 mt-2"
                      >
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <Label className="text-sm font-semibold text-blue-800">
                            Insurer ID *{" "}
                            <span className="text-blue-500 font-normal text-xs">
                              (pre-filled from session)
                            </span>
                          </Label>
                          <Input
                            value={form.insurer_id}
                            onChange={(e) =>
                              setForm({ ...form, insurer_id: e.target.value })
                            }
                            placeholder="UUID"
                            required
                            className="border-blue-200 focus:border-blue-400 font-mono text-xs"
                          />
                        </div>
                        <fieldset className="space-y-3">
                          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Basic Info
                          </legend>
                          <Input
                            value={form.name}
                            onChange={(e) =>
                              setForm({ ...form, name: e.target.value })
                            }
                            placeholder="Policy name *"
                            required
                            className="border-slate-200"
                          />
                          <textarea
                            value={form.description}
                            onChange={(e) =>
                              setForm({ ...form, description: e.target.value })
                            }
                            placeholder="Description"
                            rows={2}
                            className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              ["Coverage/Event", "coverage_amount_display"],
                              ["Premium", "premium_amount_display"],
                            ].map(([l, k]) => (
                              <div key={k} className="space-y-1">
                                <Label className="text-xs text-slate-600">
                                  {l}
                                </Label>
                                <Input
                                  type="number"
                                  value={(form as any)[k]}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      [k]: Number(e.target.value),
                                    })
                                  }
                                  className="border-slate-200"
                                />
                              </div>
                            ))}
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-600">
                                Currency
                              </Label>
                              <select
                                value={form.currency}
                                onChange={(e) =>
                                  setForm({ ...form, currency: e.target.value })
                                }
                                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm bg-white"
                              >
                                {["UGX", "KES", "TZS", "USD", "EUR"].map(
                                  (c) => (
                                    <option key={c}>{c}</option>
                                  ),
                                )}
                              </select>
                            </div>
                          </div>
                        </fieldset>
                        <fieldset className="space-y-3">
                          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Trigger Rules
                          </legend>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              [
                                "QoD Drop Threshold (%)",
                                "qod_drop_threshold_pct",
                              ],
                              [
                                "Consecutive Readings",
                                "consecutive_readings_required",
                              ],
                              ["Payout %", "payout_pct"],
                              ["Neighbour Min", "neighbour_min_count"],
                              ["Per-event Cap", "per_event_cap_amt"],
                              ["Per-season Cap", "per_season_cap_amt"],
                            ].map(([l, k]) => (
                              <div key={k} className="space-y-1">
                                <Label className="text-xs text-slate-600">
                                  {l}
                                </Label>
                                <Input
                                  type="number"
                                  value={(form as any)[k]}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      [k]: Number(e.target.value),
                                    })
                                  }
                                  className="border-slate-200"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4 text-sm">
                            {[
                              [
                                "weather_corroboration_required",
                                "Weather corroboration",
                              ],
                              ["neighbour_check_required", "Neighbour check"],
                            ].map(([k, l]) => (
                              <label
                                key={k}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={(form as any)[k]}
                                  onChange={(e) =>
                                    setForm({ ...form, [k]: e.target.checked })
                                  }
                                />
                                <span className="text-slate-700">{l}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset className="space-y-3">
                          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Scope
                          </legend>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              value={form.crop_type}
                              onChange={(e) =>
                                setForm({ ...form, crop_type: e.target.value })
                              }
                              placeholder="Crop type"
                              className="border-slate-200"
                            />
                            <select
                              value={form.country}
                              onChange={(e) =>
                                setForm({ ...form, country: e.target.value })
                              }
                              className="h-10 border border-slate-200 rounded-md px-3 text-sm bg-white"
                            >
                              {["UG", "KE", "TZ", "RW"].map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                            <Input
                              value={form.region_name}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  region_name: e.target.value,
                                })
                              }
                              placeholder="Region name"
                              className="border-slate-200"
                            />
                            <Input
                              value={form.districts}
                              onChange={(e) =>
                                setForm({ ...form, districts: e.target.value })
                              }
                              placeholder="Districts (comma-separated)"
                              className="border-slate-200"
                            />
                          </div>
                        </fieldset>
                        {formError && (
                          <div className="bg-red-50 border-l-4 border-red-400 rounded p-3 text-sm text-red-800">
                            {formError}
                          </div>
                        )}
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {submitting ? "Creating…" : "Create Policy"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {policies.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No policies yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {policies.map((p) => (
                      <Card
                        key={p.id}
                        className="shadow-sm border-slate-100 hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-slate-800 truncate">
                                  {p.name}
                                </h3>
                                <Badge
                                  className={`text-xs flex-shrink-0 ${p.status === "active" ? "bg-green-100 text-green-800" : p.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}
                                >
                                  {p.status}
                                </Badge>
                              </div>
                              <p className="text-slate-500 text-xs mb-2 line-clamp-1">
                                {p.description || "No description provided"}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                <span>
                                  Coverage:{" "}
                                  <strong>
                                    {fmt(p.coverage_amount_display, p.currency)}
                                  </strong>
                                </span>
                                <span>
                                  Premium:{" "}
                                  <strong>
                                    {fmt(p.premium_amount_display, p.currency)}
                                  </strong>
                                </span>
                                {p.qod_drop_threshold_pct && (
                                  <span>
                                    QoD:{" "}
                                    <strong>{p.qod_drop_threshold_pct}%</strong>
                                  </span>
                                )}
                                {p.payout_pct && (
                                  <span>
                                    Payout: <strong>{p.payout_pct}%</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setExp(expandedPolicy === p.id ? null : p.id)
                              }
                              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                            >
                              {expandedPolicy === p.id ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                          {expandedPolicy === p.id && (
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                              {p.crops && p.crops.length > 0 && (
                                <div>
                                  <p className="text-slate-400 font-semibold uppercase mb-2">
                                    Crops
                                  </p>
                                  {p.crops.map((c, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="mr-1 border-green-300 text-green-700"
                                    >
                                      {c.crop_type}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {p.regions && p.regions.length > 0 && (
                                <div>
                                  <p className="text-slate-400 font-semibold uppercase mb-2">
                                    Regions
                                  </p>
                                  {p.regions.map((r, i) => (
                                    <div key={i}>
                                      <span className="font-medium text-slate-700">
                                        {r.region_name}, {r.country}
                                      </span>
                                      <span className="text-slate-400 ml-1">
                                        —{" "}
                                        {r.districts
                                          .map((d) => d.district_name)
                                          .join(", ")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(p.per_event_cap_amt ||
                                p.per_season_cap_amt) && (
                                <div>
                                  <p className="text-slate-400 font-semibold uppercase mb-2">
                                    Caps
                                  </p>
                                  {p.per_event_cap_amt && (
                                    <p>
                                      Per event:{" "}
                                      {fmt(p.per_event_cap_amt, p.currency)}
                                    </p>
                                  )}
                                  {p.per_season_cap_amt && (
                                    <p>
                                      Per season:{" "}
                                      {fmt(p.per_season_cap_amt, p.currency)}
                                    </p>
                                  )}
                                </div>
                              )}
                              {p.consecutive_readings_required && (
                                <div>
                                  <p className="text-slate-400 font-semibold uppercase mb-2">
                                    Trigger
                                  </p>
                                  <p>
                                    {p.consecutive_readings_required} readings
                                    required
                                  </p>
                                  {p.qod_drop_threshold_pct && (
                                    <p>Drop ≥ {p.qod_drop_threshold_pct}%</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SIGNALS ── */}
            {tab === "signals" && (
              <div className="space-y-4">
                <Card className="shadow-sm border-slate-100">
                  <CardContent className="p-4 flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">
                        Farmer ID
                      </Label>
                      <Input
                        value={sigFilter.farmer_id}
                        onChange={(e) =>
                          setSigFilter({
                            ...sigFilter,
                            farmer_id: e.target.value,
                          })
                        }
                        placeholder="UUID…"
                        className="h-8 text-sm w-52 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">MSISDN</Label>
                      <Input
                        value={sigFilter.msisdn}
                        onChange={(e) =>
                          setSigFilter({ ...sigFilter, msisdn: e.target.value })
                        }
                        placeholder="+256…"
                        className="h-8 text-sm w-40 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">
                        Anomalous
                      </Label>
                      <select
                        value={sigFilter.anomalous}
                        onChange={(e) =>
                          setSigFilter({
                            ...sigFilter,
                            anomalous: e.target.value,
                          })
                        }
                        className="h-8 border border-slate-200 rounded-md px-2 text-sm bg-white"
                      >
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <Button
                      onClick={fetchSignals}
                      size="sm"
                      className="bg-slate-700 hover:bg-slate-800 text-white h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Apply
                    </Button>
                  </CardContent>
                </Card>
                <Card className="shadow-md border-slate-100">
                  <CardContent className="p-0">
                    {signals.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>No signal readings found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              {[
                                "Farmer",
                                "MSISDN",
                                "QoD Value",
                                "Drop %",
                                "Recorded",
                                "Status",
                                "",
                              ].map((h) => (
                                <TableHead
                                  key={h}
                                  className="text-slate-600 font-semibold"
                                >
                                  {h}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {signals.map((s) => (
                              <TableRow
                                key={s.id}
                                className={s.is_anomalous ? "bg-red-50/60" : ""}
                              >
                                <TableCell className="text-slate-700 text-sm font-medium">
                                  {s.farmer_name ??
                                    s.farmer_id.slice(0, 8) + "…"}
                                </TableCell>
                                <TableCell className="text-slate-600 text-sm font-mono">
                                  {s.msisdn}
                                </TableCell>
                                <TableCell className="text-slate-700 font-semibold">
                                  {s.qod_value?.toFixed(2) ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={`font-semibold ${s.drop_pct > 30 ? "text-red-600" : "text-slate-600"}`}
                                >
                                  {s.drop_pct != null
                                    ? `${s.drop_pct.toFixed(1)}%`
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                  {new Date(s.recorded_at).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      s.is_anomalous
                                        ? "bg-red-100 text-red-700 animate-pulse"
                                        : "bg-green-100 text-green-700"
                                    }
                                  >
                                    {s.is_anomalous ? "⚠ Anomalous" : "Normal"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {s.is_anomalous && (
                                    <Button
                                      size="sm"
                                      onClick={() => openSim(s, "signal")}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                                    >
                                      <Banknote className="w-3 h-3 mr-1" />
                                      Simulate Payout
                                    </Button>
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
            )}

            {/* ── WEATHER ── */}
            {tab === "weather" && (
              <div className="space-y-4">
                <Card className="shadow-sm border-slate-100">
                  <CardContent className="p-4 flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">District</Label>
                      <Input
                        value={wxFilter.district}
                        onChange={(e) =>
                          setWxFilter({ ...wxFilter, district: e.target.value })
                        }
                        placeholder="e.g. Masaka"
                        className="h-8 text-sm w-36 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Country</Label>
                      <select
                        value={wxFilter.country}
                        onChange={(e) =>
                          setWxFilter({ ...wxFilter, country: e.target.value })
                        }
                        className="h-8 border border-slate-200 rounded-md px-2 text-sm bg-white"
                      >
                        <option value="">All</option>
                        {["UG", "KE", "TZ", "RW"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Source</Label>
                      <select
                        value={wxFilter.data_source}
                        onChange={(e) =>
                          setWxFilter({
                            ...wxFilter,
                            data_source: e.target.value,
                          })
                        }
                        className="h-8 border border-slate-200 rounded-md px-2 text-sm bg-white"
                      >
                        <option value="">All</option>
                        <option value="open-meteo">open-meteo</option>
                        <option value="open-meteo-archive">archive</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">From</Label>
                      <Input
                        type="datetime-local"
                        value={wxFilter.from_dt}
                        onChange={(e) =>
                          setWxFilter({ ...wxFilter, from_dt: e.target.value })
                        }
                        className="h-8 text-xs border-slate-200 w-44"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">To</Label>
                      <Input
                        type="datetime-local"
                        value={wxFilter.to_dt}
                        onChange={(e) =>
                          setWxFilter({ ...wxFilter, to_dt: e.target.value })
                        }
                        className="h-8 text-xs border-slate-200 w-44"
                      />
                    </div>
                    <Button
                      onClick={fetchWeather}
                      size="sm"
                      className="bg-slate-700 hover:bg-slate-800 text-white h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Apply
                    </Button>
                    {(wxFilter.district ||
                      wxFilter.country ||
                      wxFilter.data_source ||
                      wxFilter.from_dt ||
                      wxFilter.to_dt) && (
                      <Button
                        onClick={() =>
                          setWxFilter({
                            district: "",
                            country: "",
                            data_source: "",
                            from_dt: "",
                            to_dt: "",
                          })
                        }
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-slate-200 text-slate-500 bg-white"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {weather.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      {
                        label: "Avg Rainfall",
                        value: `${(weather.reduce((s, w) => s + w.rainfall_mm_display, 0) / weather.length).toFixed(2)} mm`,
                        color: "text-blue-700",
                        bg: "bg-blue-50",
                      },
                      {
                        label: "Avg Drought",
                        value: `${((weather.reduce((s, w) => s + w.drought_index_display, 0) / weather.length) * 100).toFixed(1)}%`,
                        color: "text-amber-700",
                        bg: "bg-amber-50",
                      },
                      {
                        label: "Avg Flood Risk",
                        value: `${((weather.reduce((s, w) => s + w.flood_risk_score_display, 0) / weather.length) * 100).toFixed(1)}%`,
                        color: "text-cyan-700",
                        bg: "bg-cyan-50",
                      },
                    ].map(({ label, value, color, bg }) => (
                      <div
                        key={label}
                        className={`${bg} rounded-lg p-3 text-center`}
                      >
                        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-slate-400">
                          {weather.length} readings
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <Card className="shadow-md border-slate-100">
                  <CardContent className="p-0">
                    {weather.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CloudRain className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>No weather records found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-slate-600 font-semibold">
                                District
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Country
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Rainfall (mm)
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Drought Index
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Flood Risk
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Recorded
                              </TableHead>
                              <TableHead className="text-slate-600 font-semibold">
                                Source
                              </TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {weather.map((w) => {
                              const isDrought =
                                w.drought_index_display >= DROUGHT_THRESHOLD;
                              const isFlood =
                                w.flood_risk_score_display >= FLOOD_THRESHOLD;
                              const isAlert = isDrought || isFlood;
                              return (
                                <TableRow
                                  key={w.id}
                                  className={isAlert ? "bg-amber-50/40" : ""}
                                >
                                  <TableCell className="font-medium text-slate-700">
                                    {w.district}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {w.country}
                                  </TableCell>
                                  <TableCell>
                                    <span className="flex items-center gap-1 text-blue-600 font-semibold text-sm">
                                      <CloudRain className="w-3 h-3" />
                                      {w.rainfall_mm_display.toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {pctBar(
                                      w.drought_index_display,
                                      DROUGHT_THRESHOLD,
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {pctBar(
                                      w.flood_risk_score_display,
                                      FLOOD_THRESHOLD,
                                    )}
                                  </TableCell>
                                  <TableCell className="text-slate-500 text-xs whitespace-nowrap">
                                    {new Date(w.recorded_at).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-slate-200 text-slate-500"
                                    >
                                      {w.data_source}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {isAlert ? (
                                      <Button
                                        size="sm"
                                        onClick={() => openSim(w, "weather")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                                      >
                                        <Banknote className="w-3 h-3 mr-1" />
                                        Simulate Payout
                                      </Button>
                                    ) : (
                                      <span className="text-slate-300 text-xs">
                                        Normal
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog
        open={simOpen}
        onOpenChange={(open) => {
          if (!open) setSimOpen(false);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Banknote className="w-5 h-5 text-emerald-500" />
              Payout Simulation Engine
              <Badge className="ml-2 bg-amber-100 text-amber-700 text-xs font-normal">
                Demo Mode
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {simItem && (
            <PayoutSimulator
              item={simItem}
              type={simType}
              policies={policies}
              onClose={() => setSimOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

//  Alert row
function AlertRow({
  type,
  item,
  onOpen,
}: {
  type: "signal" | "weather";
  item: SignalReading | WeatherRecord;
  onOpen: () => void;
}) {
  if (type === "signal") {
    const s = item as SignalReading;
    return (
      <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              QoD Anomaly — {s.msisdn}
            </p>
            <p className="text-xs text-slate-500">
              Drop: {s.drop_pct?.toFixed(1)}% ·{" "}
              {new Date(s.recorded_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onOpen}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
        >
          <Banknote className="w-3 h-3 mr-1" />
          Simulate
        </Button>
      </div>
    );
  }
  const w = item as WeatherRecord;
  const isDrought = w.drought_index_display >= DROUGHT_THRESHOLD;
  return (
    <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          {isDrought ? (
            <TrendingDown className="w-4 h-4 text-amber-600" />
          ) : (
            <CloudRain className="w-4 h-4 text-cyan-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">
            {isDrought ? "Drought" : "Flood"} Alert — {w.district}, {w.country}
          </p>
          <p className="text-xs text-slate-500">
            {isDrought ? "Drought" : "Flood"}:{" "}
            {(
              (isDrought
                ? w.drought_index_display
                : w.flood_risk_score_display) * 100
            ).toFixed(1)}
            % · {new Date(w.recorded_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={onOpen}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
      >
        <Banknote className="w-3 h-3 mr-1" />
        Simulate
      </Button>
    </div>
  );
}
