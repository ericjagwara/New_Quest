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
} from "lucide-react";

const API = "https://chris.fastapicloud.dev";

// ─── Real thresholds (values are 0–1 scale) ───────────────────────────────────
const DROUGHT_THRESHOLD = 0.3; // drought_index_display ≥ 0.3 → alert
const FLOOD_THRESHOLD = 0.1; // flood_risk_score_display ≥ 0.1 → alert

// ─── Types ────────────────────────────────────────────────────────────────────
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
  manual_review_window_hours: number;
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
  description: string;
  status: string;
  coverage_amount_per_event: number;
  premium_amount: number;
  currency: string;
  qod_drop_threshold_pct: number;
  consecutive_readings_required: number;
  payout_pct: number;
  per_event_cap_amt: number;
  per_season_cap_amt: number;
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
  policy_id?: string;
  farmer_name?: string;
}

interface WeatherRecord {
  id: string;
  district: string;
  country: string;
  recorded_at: string;
  data_source: string;
  rainfall_mm_display: number; // mm
  drought_index_display: number; // 0–1 scale
  flood_risk_score_display: number; // 0–1 scale
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// Format 0–1 as percentage with colour class
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
  coverage_amount_per_event: 50000,
  premium_amount: 5000,
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
  insurer_id: "", // editable in form, pre-filled from session
};

type Tab = "overview" | "policies" | "signals" | "weather";

// ─── Component ────────────────────────────────────────────────────────────────
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

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertItem, setAlertItem] = useState<
    SignalReading | WeatherRecord | null
  >(null);
  const [alertType, setAlertType] = useState<"signal" | "weather">("signal");
  const [payoutDone, setPayoutDone] = useState(false);

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

  // ── Auth ────────────────────────────────────────────────────────────────────
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
      // Pre-fill insurer_id in form from session
      setForm((f) => ({ ...f, insurer_id: u.partner_id ?? "" }));
    } catch {
      router.push("/");
    }
  }, [router]);

  // ── Fetch insurer profile ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.partner_id) return;
    (async () => {
      try {
        const res = await fetch(`${API}/partners/insurers/${user.partner_id}`, {
          headers: authH(getToken()),
        });
        if (res.ok) setInsurer(await res.json());
      } catch (_) {}
    })();
  }, [user]);

  // ── Fetch policies ───────────────────────────────────────────────────────────
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch(`${API}/policies?page=1&per_page=50`, {
        headers: authH(getToken()),
      });
      if (!res.ok) return;
      const d = await res.json();
      setPolicies(Array.isArray(d) ? d : (d.items ?? []));
    } catch (_) {}
  }, []);

  // ── Fetch signal readings ────────────────────────────────────────────────────
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

  // ── Fetch weather (Open-Meteo) ───────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", per_page: "50" });
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

  // ── Leaflet map ──────────────────────────────────────────────────────────────
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

  // ── Draw weather markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
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

    // Group by district — show latest reading per district
    const byDistrict: Record<string, WeatherRecord> = {};
    weather.forEach((w) => {
      if (
        !byDistrict[w.district] ||
        w.recorded_at > byDistrict[w.district].recorded_at
      ) {
        byDistrict[w.district] = w;
      }
    });

    Object.values(byDistrict).forEach((w) => {
      const coords = knownDistricts[w.district];
      if (!coords) return;
      const isDrought = w.drought_index_display >= DROUGHT_THRESHOLD;
      const isFlood = w.flood_risk_score_display >= FLOOD_THRESHOLD;
      const isAlert = isDrought || isFlood;
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
            <strong style="font-size:13px">${w.district}, ${w.country}</strong><br/>
            🌧 Rainfall: <strong>${w.rainfall_mm_display} mm</strong><br/>
            🌵 Drought: <strong>${(w.drought_index_display * 100).toFixed(1)}%</strong>
              ${isDrought ? '<span style="color:#dc2626"> ⚠ High</span>' : ""}<br/>
            🌊 Flood risk: <strong>${(w.flood_risk_score_display * 100).toFixed(1)}%</strong>
              ${isFlood ? '<span style="color:#0891b2"> ⚠ Elevated</span>' : ""}<br/>
            <span style="color:#9ca3af;font-size:11px">${new Date(w.recorded_at).toLocaleString()}</span>
          </div>`),
      );
    });

    if (markersRef.current.length > 0) {
      try {
        const grp = L.featureGroup(markersRef.current);
        map.fitBounds(grp.getBounds().pad(0.3));
      } catch (_) {}
    }
  }, [weather]);

  // ── Create policy ────────────────────────────────────────────────────────────
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
        coverage_amount_per_event: Number(form.coverage_amount_per_event),
        premium_amount: Number(form.premium_amount),
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

  const openAlert = (
    item: SignalReading | WeatherRecord,
    type: "signal" | "weather",
  ) => {
    setAlertItem(item);
    setAlertType(type);
    setPayoutDone(false);
    setAlertOpen(true);
  };

  // ── Stats (corrected thresholds) ─────────────────────────────────────────────
  const anomalousCount = signals.filter((s) => s.is_anomalous).length;
  const droughtCount = weather.filter(
    (w) => w.drought_index_display >= DROUGHT_THRESHOLD,
  ).length;
  const floodCount = weather.filter(
    (w) => w.flood_risk_score_display >= FLOOD_THRESHOLD,
  ).length;
  const activePolicies = policies.filter((p) => p.status === "active").length;

  // Latest weather reading for quick summary
  const latestWeather = weather[0];
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
      <div className="flex items-center justify-center h-screen text-slate-600 font-medium">
        Authenticating…
      </div>
    );

  return (
    <div className="flex h-screen bg-slate-50">
      <DashboardSidebar user={user} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Hero banner */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white px-8 py-6 border-b border-slate-600">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <span>Dashboard</span>
                  <span>/</span>
                  <span>Insurer</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
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
                {(anomalousCount > 0 || droughtCount > 0 || floodCount > 0) && (
                  <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 text-red-300 text-sm font-medium animate-pulse">
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
                  label: "Drought Alerts",
                  value: droughtCount,
                  sub: `index ≥ ${DROUGHT_THRESHOLD * 100}%`,
                  color: "from-amber-500 to-orange-600",
                  icon: TrendingDown,
                  alert: droughtCount > 0,
                },
                {
                  label: "Flood Alerts",
                  value: floodCount,
                  sub: `risk ≥ ${FLOOD_THRESHOLD * 100}%`,
                  color: "from-cyan-500 to-cyan-600",
                  icon: CloudRain,
                  alert: floodCount > 0,
                },
              ].map(({ label, value, sub, color, icon: Icon, alert }) => (
                <Card
                  key={label}
                  className={`border-0 shadow-md bg-gradient-to-br ${color} text-white overflow-hidden relative`}
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

            {/* ── OVERVIEW TAB ── */}
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
                            <p className="font-medium text-slate-700 capitalize">
                              {v}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">
                        Profile not loaded — ensure{" "}
                        <code className="text-xs bg-slate-100 px-1 rounded">
                          partner_id
                        </code>{" "}
                        is stored in the session.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Weather summary card */}
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
                          <p className="text-xs text-blue-500 font-medium mb-1">
                            Rainfall
                          </p>
                          <p className="text-2xl font-bold text-blue-700">
                            {latestWeather.rainfall_mm_display}
                          </p>
                          <p className="text-xs text-blue-400">mm</p>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${latestWeather.drought_index_display >= DROUGHT_THRESHOLD ? "bg-red-50" : "bg-amber-50"}`}
                        >
                          <p className="text-xs text-amber-600 font-medium mb-1">
                            Drought
                          </p>
                          <p
                            className={`text-2xl font-bold ${latestWeather.drought_index_display >= DROUGHT_THRESHOLD ? "text-red-700" : "text-amber-700"}`}
                          >
                            {(
                              latestWeather.drought_index_display * 100
                            ).toFixed(1)}
                            %
                          </p>
                          {latestWeather.drought_index_display >=
                            DROUGHT_THRESHOLD && (
                            <p className="text-xs text-red-500">⚠ Alert</p>
                          )}
                        </div>
                        <div
                          className={`rounded-lg p-3 ${latestWeather.flood_risk_score_display >= FLOOD_THRESHOLD ? "bg-cyan-50" : "bg-slate-50"}`}
                        >
                          <p className="text-xs text-cyan-600 font-medium mb-1">
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
                          {latestWeather.flood_risk_score_display >=
                            FLOOD_THRESHOLD && (
                            <p className="text-xs text-cyan-500">⚠ Elevated</p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Source: {latestWeather.data_source}</span>
                        <span>
                          {new Date(latestWeather.recorded_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            Avg drought index ({weather.length} readings)
                          </span>
                          <span
                            className={pctColor(avgDrought, DROUGHT_THRESHOLD)}
                          >
                            {(avgDrought * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${avgDrought >= DROUGHT_THRESHOLD ? "bg-red-500" : "bg-amber-400"}`}
                            style={{
                              width: `${Math.min(avgDrought * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Peak rainfall today</span>
                          <span className="text-blue-600 font-medium">
                            {maxRainfall} mm
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Map */}
                <Card className="shadow-md border-slate-100 overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      Coverage Map
                      <span className="ml-auto text-xs text-slate-400 font-normal">
                        Latest reading per district
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

                {/* Recent alerts */}
                <Card className="shadow-md border-slate-100">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Recent Alerts
                      <Badge className="ml-auto bg-red-100 text-red-700">
                        {anomalousCount + droughtCount + floodCount} total
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
                            onOpen={() => openAlert(s, "signal")}
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
                            onOpen={() => openAlert(w, "weather")}
                          />
                        ))}
                      {anomalousCount + droughtCount + floodCount === 0 && (
                        <p className="text-slate-400 text-sm text-center py-4">
                          No active alerts
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── POLICIES TAB ── */}
            {tab === "policies" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-sm">
                    {policies.length} policies found
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
                        {/* Insurer ID — pre-filled, editable override */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                          <Label className="text-sm font-semibold text-blue-800">
                            Insurer ID *
                            <span className="ml-2 text-blue-500 font-normal text-xs">
                              (pre-filled from your session)
                            </span>
                          </Label>
                          <Input
                            value={form.insurer_id}
                            onChange={(e) =>
                              setForm({ ...form, insurer_id: e.target.value })
                            }
                            placeholder="e58b3142-f466-41b4-8278-4236dcf92a94"
                            required
                            className="border-blue-200 focus:border-blue-400 font-mono text-xs"
                          />
                          <p className="text-xs text-blue-600">
                            Policy will be created under:{" "}
                            <code className="bg-blue-100 px-1 rounded">
                              /policies/insurers/{"{insurer_id}"}
                            </code>
                          </p>
                        </div>

                        <fieldset className="space-y-3">
                          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Basic Info
                          </legend>
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-slate-700">
                              Policy Name *
                            </Label>
                            <Input
                              value={form.name}
                              onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                              }
                              placeholder="e.g. Maize Drought Protection Plan"
                              required
                              className="border-slate-200 focus:border-blue-400"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-slate-700">
                              Description
                            </Label>
                            <textarea
                              value={form.description}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  description: e.target.value,
                                })
                              }
                              placeholder="Describe the policy coverage…"
                              rows={2}
                              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Coverage / Event
                              </Label>
                              <Input
                                type="number"
                                value={form.coverage_amount_per_event}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    coverage_amount_per_event: Number(
                                      e.target.value,
                                    ),
                                  })
                                }
                                className="border-slate-200 focus:border-blue-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Premium
                              </Label>
                              <Input
                                type="number"
                                value={form.premium_amount}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    premium_amount: Number(e.target.value),
                                  })
                                }
                                className="border-slate-200 focus:border-blue-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Currency
                              </Label>
                              <select
                                value={form.currency}
                                onChange={(e) =>
                                  setForm({ ...form, currency: e.target.value })
                                }
                                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                              {
                                label: "QoD Drop Threshold (%)",
                                key: "qod_drop_threshold_pct",
                              },
                              {
                                label: "Consecutive Readings",
                                key: "consecutive_readings_required",
                              },
                              { label: "Payout %", key: "payout_pct" },
                              {
                                label: "Neighbour Min Count",
                                key: "neighbour_min_count",
                              },
                              {
                                label: "Per-event Cap",
                                key: "per_event_cap_amt",
                              },
                              {
                                label: "Per-season Cap",
                                key: "per_season_cap_amt",
                              },
                            ].map(({ label, key }) => (
                              <div key={key} className="space-y-1">
                                <Label className="text-sm font-medium text-slate-700">
                                  {label}
                                </Label>
                                <Input
                                  type="number"
                                  value={(form as any)[key]}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      [key]: Number(e.target.value),
                                    })
                                  }
                                  className="border-slate-200 focus:border-blue-400"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4 text-sm">
                            {[
                              [
                                "weather_corroboration_required",
                                "Require weather corroboration",
                              ],
                              [
                                "neighbour_check_required",
                                "Require neighbour check",
                              ],
                            ].map(([key, label]) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={(form as any)[key]}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      [key]: e.target.checked,
                                    })
                                  }
                                  className="rounded border-slate-300 text-blue-500"
                                />
                                <span className="text-slate-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <fieldset className="space-y-3">
                          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Coverage Scope
                          </legend>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Crop Type
                              </Label>
                              <Input
                                value={form.crop_type}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    crop_type: e.target.value,
                                  })
                                }
                                placeholder="e.g. Maize"
                                className="border-slate-200 focus:border-blue-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Country
                              </Label>
                              <select
                                value={form.country}
                                onChange={(e) =>
                                  setForm({ ...form, country: e.target.value })
                                }
                                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                              >
                                {["UG", "KE", "TZ", "RW"].map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Region Name
                              </Label>
                              <Input
                                value={form.region_name}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    region_name: e.target.value,
                                  })
                                }
                                placeholder="e.g. Central"
                                className="border-slate-200 focus:border-blue-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-sm font-medium text-slate-700">
                                Districts (comma-separated)
                              </Label>
                              <Input
                                value={form.districts}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    districts: e.target.value,
                                  })
                                }
                                placeholder="Mukono, Wakiso"
                                className="border-slate-200 focus:border-blue-400"
                              />
                            </div>
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
                    <p>No policies yet — create your first one above.</p>
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
                                  className={`text-xs flex-shrink-0 ${
                                    p.status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : p.status === "draft"
                                        ? "bg-slate-100 text-slate-600"
                                        : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {p.status}
                                </Badge>
                              </div>
                              <p className="text-slate-500 text-xs mb-2 line-clamp-1">
                                {p.description}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                <span>
                                  Coverage:{" "}
                                  <strong>
                                    {fmt(
                                      p.coverage_amount_per_event,
                                      p.currency,
                                    )}
                                  </strong>
                                </span>
                                <span>
                                  Premium:{" "}
                                  <strong>
                                    {fmt(p.premium_amount, p.currency)}
                                  </strong>
                                </span>
                                <span>
                                  QoD:{" "}
                                  <strong>{p.qod_drop_threshold_pct}%</strong>
                                </span>
                                <span>
                                  Payout: <strong>{p.payout_pct}%</strong>
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setExp(expandedPolicy === p.id ? null : p.id)
                              }
                              className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5"
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
                              <div>
                                <p className="text-slate-400 font-semibold uppercase tracking-wide mb-2">
                                  Crops
                                </p>
                                {(p.crops ?? []).map((c, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="mr-1 border-green-300 text-green-700"
                                  >
                                    {c.crop_type}
                                  </Badge>
                                ))}
                              </div>
                              <div>
                                <p className="text-slate-400 font-semibold uppercase tracking-wide mb-2">
                                  Regions
                                </p>
                                {(p.regions ?? []).map((r, i) => (
                                  <div key={i} className="mb-1">
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
                              <div>
                                <p className="text-slate-400 font-semibold uppercase tracking-wide mb-2">
                                  Caps
                                </p>
                                <p>
                                  Per event:{" "}
                                  {fmt(p.per_event_cap_amt, p.currency)}
                                </p>
                                <p>
                                  Per season:{" "}
                                  {fmt(p.per_season_cap_amt, p.currency)}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 font-semibold uppercase tracking-wide mb-2">
                                  Trigger
                                </p>
                                <p>
                                  {p.consecutive_readings_required} consecutive
                                  readings
                                </p>
                                <p>Drop ≥ {p.qod_drop_threshold_pct}%</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SIGNALS TAB ── */}
            {tab === "signals" && (
              <div className="space-y-4">
                <Card className="shadow-sm border-slate-100">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-end">
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
                            setSigFilter({
                              ...sigFilter,
                              msisdn: e.target.value,
                            })
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
                    </div>
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
                                      onClick={() => openAlert(s, "signal")}
                                      className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2"
                                    >
                                      Review
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

            {/* ── WEATHER TAB ── */}
            {tab === "weather" && (
              <div className="space-y-4">
                {/* Filters — now includes data_source and date range */}
                <Card className="shadow-sm border-slate-100">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">
                          District
                        </Label>
                        <Input
                          value={wxFilter.district}
                          onChange={(e) =>
                            setWxFilter({
                              ...wxFilter,
                              district: e.target.value,
                            })
                          }
                          placeholder="e.g. Masaka"
                          className="h-8 text-sm w-36 border-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">
                          Country
                        </Label>
                        <select
                          value={wxFilter.country}
                          onChange={(e) =>
                            setWxFilter({
                              ...wxFilter,
                              country: e.target.value,
                            })
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
                        <Label className="text-xs text-slate-500">
                          Data Source
                        </Label>
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
                          <option value="open-meteo">open-meteo (live)</option>
                          <option value="open-meteo-archive">
                            open-meteo-archive
                          </option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">From</Label>
                        <Input
                          type="datetime-local"
                          value={wxFilter.from_dt}
                          onChange={(e) =>
                            setWxFilter({
                              ...wxFilter,
                              from_dt: e.target.value,
                            })
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
                          className="h-8 text-xs border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Weather summary mini-cards */}
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
                        label: "Avg Drought Index",
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
                                    <span className="flex items-center gap-1 text-blue-600 font-semibold">
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
                                    {isAlert && (
                                      <Button
                                        size="sm"
                                        onClick={() => openAlert(w, "weather")}
                                        className={`text-white text-xs h-7 px-2 ${isDrought ? "bg-amber-600 hover:bg-amber-700" : "bg-cyan-600 hover:bg-cyan-700"}`}
                                      >
                                        {isDrought ? "🌵 Drought" : "🌊 Flood"}
                                      </Button>
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

      {/* Alert / Payout dialog */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {alertType === "signal" ? "QoD Anomaly Alert" : "Weather Alert"}
            </DialogTitle>
          </DialogHeader>
          {alertItem && (
            <div className="space-y-4 mt-2">
              {alertType === "signal" ? (
                <div className="bg-red-50 rounded-lg p-4 text-sm space-y-1.5 border border-red-100">
                  <p>
                    <span className="text-slate-500">Farmer:</span>{" "}
                    <strong>
                      {(alertItem as SignalReading).farmer_name ??
                        (alertItem as SignalReading).farmer_id}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">MSISDN:</span>{" "}
                    <strong>{(alertItem as SignalReading).msisdn}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">QoD Value:</span>{" "}
                    <strong>
                      {(alertItem as SignalReading).qod_value?.toFixed(2)}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Drop:</span>{" "}
                    <strong className="text-red-600">
                      {(alertItem as SignalReading).drop_pct?.toFixed(1)}%
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Recorded:</span>{" "}
                    {new Date(
                      (alertItem as SignalReading).recorded_at,
                    ).toLocaleString()}
                  </p>
                  <p className="text-red-700 font-medium pt-1">
                    ⚠ Signal quality breached policy threshold — possible crop
                    stress detected.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-4 text-sm space-y-2 border border-amber-100">
                  <p>
                    <span className="text-slate-500">District:</span>{" "}
                    <strong>
                      {(alertItem as WeatherRecord).district},{" "}
                      {(alertItem as WeatherRecord).country}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Rainfall:</span>{" "}
                    <strong>
                      {(alertItem as WeatherRecord).rainfall_mm_display} mm
                    </strong>
                  </p>
                  <div>
                    <span className="text-slate-500">Drought Index: </span>
                    {pctBar(
                      (alertItem as WeatherRecord).drought_index_display,
                      DROUGHT_THRESHOLD,
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Flood Risk: </span>
                    {pctBar(
                      (alertItem as WeatherRecord).flood_risk_score_display,
                      FLOOD_THRESHOLD,
                    )}
                  </div>
                  <p>
                    <span className="text-slate-500">Source:</span>{" "}
                    {(alertItem as WeatherRecord).data_source}
                  </p>
                  <p className="text-amber-700 font-medium pt-1">
                    ⚠ Weather conditions indicate elevated{" "}
                    {(alertItem as WeatherRecord).drought_index_display >=
                    DROUGHT_THRESHOLD
                      ? "drought"
                      : "flood"}{" "}
                    risk for enrolled farmers in this district.
                  </p>
                </div>
              )}
              {!payoutDone ? (
                <div className="space-y-3">
                  <p className="text-slate-600 text-sm">
                    If conditions meet policy criteria, confirm to queue a
                    payout to eligible farmers.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setPayoutDone(true)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Payout
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAlertOpen(false)}
                      className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50 bg-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-2">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                  <p className="font-semibold text-green-800">
                    Payout Confirmed
                  </p>
                  <p className="text-green-600 text-sm">
                    Payment queued for eligible farmers. The engine will
                    disburse funds per active policy terms.
                  </p>
                  <Button
                    onClick={() => setAlertOpen(false)}
                    variant="outline"
                    className="mt-2 border-green-300 text-green-700 hover:bg-green-100 bg-white"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Alert row sub-component ───────────────────────────────────────────────────
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
          className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-3"
        >
          Review
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
        className={`text-white text-xs h-7 px-3 ${isDrought ? "bg-amber-600 hover:bg-amber-700" : "bg-cyan-600 hover:bg-cyan-700"}`}
      >
        Review
      </Button>
    </div>
  );
}
