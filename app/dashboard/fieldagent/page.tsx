// app/dashboard/fieldagent/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Play,
  Plus,
  CheckCircle,
  Search,
  AlertTriangle,
  Ruler,
  Navigation,
  RefreshCw,
  ChevronRight,
  CloudRain,
  X,
  Send,
  FileText,
  Loader2,
} from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_AGROSIGNAL_URL || "https://chris.fastapicloud.dev";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: string;
  access_token?: string;
}

interface Farmer {
  id: string;
  msisdn: string;
  name: string;
  country: string;
  district: string;
  gps_lat: string;
  gps_lng: string;
  primary_crop: string;
  status: string;
}

interface BoundaryPoint {
  id: string;
  geofence_id: string;
  sequence: number;
  returned_lat: number;
  returned_lng: number;
  returned_accuracy_m: number;
  captured_at: string;
  status: string;
  rejection_reason: string;
  proximity_distance_m: number;
  proximity_flagged: boolean;
}

interface Geofence {
  id: string;
  farmer_id: string;
  status: string;
  area_m2: number | null;
  perimeter_m: number | null;
  avg_network_accuracy_m: number | null;
  created_at: string;
  closed_at: string | null;
  points?: BoundaryPoint[];
}

// ─── Weather Event Types ───────────────────────────────────────────────────────
interface WeatherEventPayload {
  policy_id: string;
  event_type: string;
  country: string;
  district: string;
  severity: "low" | "medium" | "high" | "extreme";
  description: string;
}

interface WeatherEventResponse {
  id: string;
  policy_id: string;
  event_type: string;
  detection_method: string;
  country: string;
  district: string;
  gps_lat: string;
  gps_lng: string;
  detected_at: string;
  severity: string;
  status: string;
  submitting_agent_id: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "{}").access_token;
  } catch {
    return undefined;
  }
}

function authHeaders(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function m2ToAcres(m2: number) {
  return (m2 / 10000 / 100).toFixed(3);
}

function mToKm(m: number) {
  return (m / 1000 / 100).toFixed(2);
}

const STATUS_COLOR: Record<string, string> = {
  accepted: "#16a34a",
  rejected: "#dc2626",
  flagged: "#d97706",
};

const EVENT_TYPES = [
  "drought",
  "flood",
  "hail",
  "frost",
  "excessive_rain",
  "wind_damage",
  "pest_outbreak",
  "disease_outbreak",
  "other",
];

const SEVERITY_OPTIONS: {
  value: WeatherEventPayload["severity"];
  label: string;
  color: string;
}[] = [
  {
    value: "low",
    label: "Low",
    color: "bg-green-100 text-green-800 border-green-300",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  {
    value: "high",
    label: "High",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  {
    value: "extreme",
    label: "Extreme",
    color: "bg-red-100 text-red-800 border-red-300",
  },
];

// Guest fallback — used when no authUser is in localStorage
const GUEST_USER: SessionUser = {
  id: "guest",
  name: "Field Agent",
  username: "Field Agent",
  role: "fieldworker",
};

// ─── Weather Event Modal ──────────────────────────────────────────────────────
function WeatherEventModal({
  onClose,
  onSuccess,
  prefillDistrict,
  prefillCountry,
}: {
  onClose: () => void;
  onSuccess: (event: WeatherEventResponse) => void;
  prefillDistrict?: string;
  prefillCountry?: string;
}) {
  const [form, setForm] = useState<WeatherEventPayload>({
    policy_id: "",
    event_type: "",
    country: prefillCountry || "",
    district: prefillDistrict || "",
    severity: "medium",
    description: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<WeatherEventResponse | null>(null);

  const set = (k: keyof WeatherEventPayload, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.policy_id.trim()) {
      setError("Policy ID is required.");
      return;
    }
    if (!form.event_type) {
      setError("Event type is required.");
      return;
    }
    if (!form.country.trim()) {
      setError("Country is required.");
      return;
    }
    if (!form.district.trim()) {
      setError("District is required.");
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API}/events`, {
        method: "POST",
        headers: authHeaders(getToken()),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(
          e.detail
            ? Array.isArray(e.detail)
              ? e.detail.map((d: any) => d.msg).join(", ")
              : e.detail
            : `Submission failed (${res.status})`,
        );
      }
      const data: WeatherEventResponse = await res.json();
      setSubmitted(data);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <CloudRain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                Submit Weather Event
              </h2>
              <p className="text-emerald-100 text-xs">
                Manually observed field report
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

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {submitted ? (
            /* Success state */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">
                  Event Submitted!
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  The event is now <strong>under_verification</strong>. An
                  insurer or platform admin will review it before any claim is
                  created.
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left text-sm space-y-1.5">
                <InfoRow
                  label="Event ID"
                  value={submitted.id.slice(0, 18) + "…"}
                  mono
                />
                <InfoRow label="Type" value={submitted.event_type} />
                <InfoRow label="Severity" value={submitted.severity} />
                <InfoRow label="District" value={submitted.district} />
                <InfoRow label="Status" value={submitted.status} />
                <InfoRow
                  label="Detected at"
                  value={new Date(submitted.detected_at).toLocaleString()}
                />
                {submitted.gps_lat && (
                  <InfoRow
                    label="Agent GPS"
                    value={`${parseFloat(submitted.gps_lat).toFixed(5)}, ${parseFloat(submitted.gps_lng).toFixed(5)}`}
                    mono
                  />
                )}
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* Info note */}
              <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5 text-xs text-sky-800 flex gap-2 items-start">
                <span className="mt-0.5 text-sky-500 flex-shrink-0">ℹ</span>
                <span>
                  Your GPS is captured automatically from your registered device
                  — no location entry needed. This event will be placed under{" "}
                  <strong>under_verification</strong> status until an insurer
                  reviews it.
                </span>
              </div>

              {/* Policy ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Policy ID <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.policy_id}
                  onChange={(e) => set("policy_id", e.target.value)}
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-…"
                  className="h-9 text-sm font-mono border-gray-200 focus:border-emerald-400"
                />
              </div>

              {/* Event Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("event_type", t)}
                      className={`text-xs px-2 py-2 rounded-lg border capitalize transition-colors font-medium ${
                        form.event_type === t
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                      }`}
                    >
                      {t.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Severity <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => set("severity", s.value)}
                      className={`text-xs px-2 py-2 rounded-lg border font-semibold transition-all ${
                        form.severity === s.value
                          ? s.color +
                            " border-2 ring-2 ring-offset-1 ring-current"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country + District */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    placeholder="e.g. UG"
                    maxLength={2}
                    className="h-9 text-sm uppercase border-gray-200 focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    District <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.district}
                    onChange={(e) => set("district", e.target.value)}
                    placeholder="e.g. Kampala"
                    className="h-9 text-sm border-gray-200 focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe what you observed in the field — crop damage visible, water levels, affected area estimate…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-colors"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={busy}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Event
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`font-medium text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FieldAgentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(GUEST_USER);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [query, setQuery] = useState("");
  const [selectedFarmer, setSF] = useState<Farmer | null>(null);
  const [geofence, setGeofence] = useState<Geofence | null>(null);
  const [points, setPoints] = useState<BoundaryPoint[]>([]);
  const [walking, setWalking] = useState(false);
  const [closed, setClosed] = useState(false);
  const [history, setHistory] = useState<Geofence[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [lastProximity, setLP] = useState<any>(null);
  // ── Weather event state ────────────────────────────────────────────────────
  const [showEventModal, setShowEventModal] = useState(false);
  const [recentEvents, setRecentEvents] = useState<WeatherEventResponse[]>([]);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("authUser");
    if (!raw) return;
    try {
      const u = JSON.parse(raw);
      if (u.expiresAt && Date.now() > u.expiresAt) {
        localStorage.removeItem("authUser");
        return;
      }
      setUser(u);
    } catch {
      // stay as guest
    }
  }, [router]);

  // ── Load farmers ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/farmers`, {
          headers: authHeaders(getToken()),
        });
        if (!res.ok) return;
        const d = await res.json();
        setFarmers(Array.isArray(d) ? d : (d.items ?? []));
      } catch (_) {}
    })();
  }, []);

  // ── Leaflet — callback ref ─────────────────────────────────────────────────
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
        maxZoom: 19,
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

  // ── Redraw map whenever points or farmer changes ───────────────────────────
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    if (selectedFarmer?.gps_lat && selectedFarmer?.gps_lng) {
      const lat = parseFloat(selectedFarmer.gps_lat);
      const lng = parseFloat(selectedFarmer.gps_lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const homeIcon = L.divIcon({
          html: `<div style="background:#0ea5e9;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏠</div>`,
          className: "",
          iconAnchor: [15, 15],
        });
        markersRef.current.push(
          L.marker([lat, lng], { icon: homeIcon })
            .addTo(map)
            .bindPopup(
              `<strong>${selectedFarmer.name}</strong><br/><span style="color:#6b7280;font-size:12px">Registered farm GPS</span>`,
            ),
        );
        map.setView([lat, lng], 15);
      }
    }

    const acceptedLatLngs: [number, number][] = [];
    points.forEach((pt, i) => {
      if (!pt.returned_lat && !pt.returned_lng) return;
      const color = STATUS_COLOR[pt.status] ?? "#6b7280";
      const icon = L.divIcon({
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
        className: "",
        iconAnchor: [14, 14],
      });
      markersRef.current.push(
        L.marker([pt.returned_lat, pt.returned_lng], { icon }).addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;line-height:1.8;min-width:160px">
              <strong>Point ${pt.sequence}</strong><br/>
              Status: <span style="color:${color};font-weight:600">${pt.status}</span><br/>
              Accuracy: ${pt.returned_accuracy_m?.toFixed(1) ?? "—"} m<br/>
              Distance to farm: ${pt.proximity_distance_m?.toFixed(0) ?? "—"} m
              ${pt.rejection_reason ? `<br/>Reason: ${pt.rejection_reason}` : ""}
              ${pt.proximity_flagged ? `<br/><span style="color:#d97706">⚠ Flagged for review</span>` : ""}
            </div>
          `),
      );
      if (pt.status === "accepted")
        acceptedLatLngs.push([pt.returned_lat, pt.returned_lng]);
    });

    if (acceptedLatLngs.length >= 3) {
      polygonRef.current = L.polygon(acceptedLatLngs, {
        color: "#16a34a",
        fillColor: "#bbf7d0",
        fillOpacity: 0.4,
        weight: 3,
        dashArray: "",
      }).addTo(map);

      if (geofence?.area_m2 != null) {
        const bounds = polygonRef.current.getBounds();
        const centre = bounds.getCenter();
        L.marker(centre, {
          icon: L.divIcon({
            html: `<div style="background:rgba(22,163,74,0.9);color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.2)">${m2ToAcres(geofence.area_m2)} acres</div>`,
            className: "",
            iconAnchor: [40, 14],
          }),
        }).addTo(map);
      }
      map.fitBounds(polygonRef.current.getBounds().pad(0.2));
    } else if (markersRef.current.length > 0) {
      try {
        const grp = L.featureGroup(markersRef.current);
        map.fitBounds(grp.getBounds().pad(0.3));
      } catch (_) {}
    }
  }, [points, selectedFarmer, geofence]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 5000);
  };

  const loadPoints = useCallback(async (geofenceId: string) => {
    try {
      const res = await fetch(`${API}/geofences/${geofenceId}`, {
        headers: authHeaders(getToken()),
      });
      if (!res.ok) return;
      const d = await res.json();
      setPoints(d.points ?? []);
    } catch (_) {}
  }, []);

  const loadHistory = useCallback(
    async (farmerId: string) => {
      try {
        const res = await fetch(`${API}/geofences?farmer_id=${farmerId}`, {
          headers: authHeaders(getToken()),
        });
        if (!res.ok) return;
        const d = await res.json();
        const list: Geofence[] = Array.isArray(d) ? d : (d.items ?? []);
        setHistory(list);
        const active = list.find((g) => g.status === "collecting");
        if (active) {
          setGeofence(active);
          setWalking(true);
          setClosed(false);
          loadPoints(active.id);
        } else {
          const complete = list.find((g) => g.status === "complete");
          if (complete) {
            setGeofence(complete);
            setClosed(true);
            setWalking(false);
            loadPoints(complete.id);
          }
        }
      } catch (_) {}
    },
    [loadPoints],
  );

  const selectFarmer = (f: Farmer) => {
    setSF(f);
    setGeofence(null);
    setPoints([]);
    setWalking(false);
    setClosed(false);
    setHistory([]);
    setLP(null);
    loadHistory(f.id);
  };

  // ── API actions ────────────────────────────────────────────────────────────
  const startWalk = async () => {
    if (!selectedFarmer) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/geofences`, {
        method: "POST",
        headers: authHeaders(getToken()),
        body: JSON.stringify({ farmer_id: selectedFarmer.id }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Failed (${res.status})`);
      }
      const g: Geofence = await res.json();
      setGeofence(g);
      setPoints([]);
      setWalking(true);
      setClosed(false);
      flash(
        "Walk session started — walk to each farm corner and tap Capture Point.",
      );
    } catch (err: any) {
      flash(err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const capturePoint = async () => {
    if (!geofence) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/geofences/${geofence.id}/points`, {
        method: "POST",
        headers: authHeaders(getToken()),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Failed (${res.status})`);
      }
      const d = await res.json();
      const pt: BoundaryPoint = d.point;
      setPoints((prev) => [...prev, pt]);
      setLP(d.proximity);
      if (pt.status === "rejected") {
        flash(
          `Point ${pt.sequence} rejected — ${pt.rejection_reason || "accuracy too low"}`,
          false,
        );
      } else if (pt.proximity_flagged) {
        flash(
          `Point ${pt.sequence} captured with proximity flag (${d.proximity?.distance_m?.toFixed(0)} m from farm GPS) — flagged for review.`,
        );
      } else {
        flash(
          `Point ${pt.sequence} captured ✓ accuracy: ${pt.returned_accuracy_m?.toFixed(1)} m`,
        );
      }
    } catch (err: any) {
      flash(err.message, false);
    } finally {
      setBusy(false);
    }
  };

  const closeWalk = async () => {
    if (!geofence) return;
    const accepted = points.filter((p) => p.status === "accepted").length;
    if (accepted < 3) {
      flash("Need at least 3 accepted points to close the walk.", false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/geofences/${geofence.id}/close`, {
        method: "POST",
        headers: authHeaders(getToken()),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Failed (${res.status})`);
      }
      const g: Geofence = await res.json();
      setGeofence(g);
      setWalking(false);
      setClosed(true);
      flash(
        `Walk closed! Area: ${m2ToAcres(g.area_m2 ?? 0)} acres · Perimeter: ${mToKm(g.perimeter_m ?? 0)} km`,
      );
    } catch (err: any) {
      flash(err.message, false);
    } finally {
      setBusy(false);
    }
  };

  // ── Weather event callback ─────────────────────────────────────────────────
  const handleEventSuccess = (event: WeatherEventResponse) => {
    setRecentEvents((prev) => [event, ...prev]);
    flash(`Weather event submitted — status: ${event.status}`);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = farmers.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.district.toLowerCase().includes(query.toLowerCase()) ||
      f.msisdn.includes(query),
  );
  const acceptedPts = points.filter((p) => p.status === "accepted");
  const rejectedPts = points.filter((p) => p.status === "rejected");
  const flaggedPts = points.filter(
    (p) => p.proximity_flagged && p.status !== "rejected",
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <DashboardSidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <span>🏠</span>
              <span>/</span>
              <span>Dashboard</span>
              <span>/</span>
              <span className="font-medium">Farm Boundary Walk</span>
            </div>

            {/* Title row — now includes Submit Event button */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-emerald-800">
                  Farm Boundary Walk
                </h1>
                <p className="text-emerald-600 text-sm mt-1">
                  Select a farmer, walk the boundary, and capture GPS points to
                  build a geofence polygon.
                </p>
              </div>
              <Button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 bg-white border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm font-semibold"
              >
                <CloudRain className="w-4 h-4" />
                Submit Weather Event
              </Button>
            </div>

            {/* Flash */}
            {msg && (
              <div
                className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 shadow-sm ${
                  msg.ok
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                {msg.ok ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                {msg.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* ─── LEFT PANEL ─── */}
              <div className="space-y-4">
                <Card className="shadow-md border-emerald-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-emerald-800 text-base flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Select Farmer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name, district or phone…"
                        className="pl-9 border-gray-200 focus:border-emerald-400 text-sm h-9"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                      {filtered.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-6">
                          No farmers found
                        </p>
                      ) : (
                        filtered.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => selectFarmer(f)}
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-emerald-50 transition-colors text-sm ${
                              selectedFarmer?.id === f.id
                                ? "bg-emerald-100 border-l-4 border-emerald-500"
                                : ""
                            }`}
                          >
                            <div>
                              <p className="font-medium text-gray-800">
                                {f.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {f.district} · {f.primary_crop}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {selectedFarmer && (
                  <Card className="shadow-md border-emerald-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-emerald-800 text-base flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        Walk Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-emerald-50 rounded-lg p-3 text-sm space-y-0.5">
                        <p className="font-semibold text-emerald-800">
                          {selectedFarmer.name}
                        </p>
                        <p className="text-emerald-600 text-xs">
                          {selectedFarmer.msisdn}
                        </p>
                        <p className="text-emerald-600 text-xs">
                          {selectedFarmer.district}, {selectedFarmer.country}
                        </p>
                        <Badge className="mt-1 bg-emerald-100 text-emerald-700 capitalize text-xs">
                          {selectedFarmer.primary_crop}
                        </Badge>
                      </div>

                      {/* Quick Submit Event for this farmer's district */}
                      <button
                        onClick={() => setShowEventModal(true)}
                        className="w-full flex items-center gap-2 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg px-3 py-2 transition-colors font-medium"
                      >
                        <CloudRain className="w-3.5 h-3.5 flex-shrink-0" />
                        Report a weather event in {selectedFarmer.district}
                      </button>

                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            walking
                              ? "bg-green-500 animate-pulse"
                              : closed
                                ? "bg-blue-500"
                                : "bg-gray-300"
                          }`}
                        />
                        <span className="font-medium text-gray-700">
                          {walking
                            ? "Walk in progress"
                            : closed
                              ? "Walk completed"
                              : "No active walk"}
                        </span>
                      </div>

                      {!walking && !closed && (
                        <Button
                          onClick={startWalk}
                          disabled={busy}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {busy ? "Starting…" : "Start Boundary Walk"}
                        </Button>
                      )}

                      {walking && (
                        <div className="space-y-2">
                          <Button
                            onClick={capturePoint}
                            disabled={busy}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
                          >
                            <Plus className="w-5 h-5 mr-2" />
                            {busy ? "Capturing…" : "Capture Boundary Point"}
                          </Button>
                          <p className="text-xs text-gray-400 text-center leading-snug">
                            Stand at each farm corner and tap above to log your
                            GPS position
                          </p>
                          <Button
                            onClick={closeWalk}
                            disabled={busy || acceptedPts.length < 3}
                            variant="outline"
                            className="w-full border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Close Walk ({acceptedPts.length} / 3+ accepted)
                          </Button>
                        </div>
                      )}

                      {closed && (
                        <div className="space-y-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-0.5">
                            <p className="font-semibold text-blue-800">
                              Walk Complete ✓
                            </p>
                            {geofence?.area_m2 != null && (
                              <p className="text-blue-700">
                                Area:{" "}
                                <strong>
                                  {m2ToAcres(geofence.area_m2)} acres
                                </strong>
                              </p>
                            )}
                            {geofence?.perimeter_m != null && (
                              <p className="text-blue-700">
                                Perimeter:{" "}
                                <strong>
                                  {mToKm(geofence.perimeter_m)} km
                                </strong>
                              </p>
                            )}
                            {geofence?.avg_network_accuracy_m != null && (
                              <p className="text-blue-500 text-xs">
                                Avg accuracy:{" "}
                                {(
                                  geofence.avg_network_accuracy_m / 100
                                ).toFixed(1)}{" "}
                                m
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={startWalk}
                            disabled={busy}
                            variant="outline"
                            className="w-full border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-sm"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Start New Walk
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {points.length > 0 && (
                  <Card className="shadow-md border-emerald-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-emerald-800 text-base flex items-center gap-2">
                        <Ruler className="w-4 h-4" />
                        Point Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-green-700">
                            {acceptedPts.length}
                          </p>
                          <p className="text-xs text-green-600">Accepted</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-amber-700">
                            {flaggedPts.length}
                          </p>
                          <p className="text-xs text-amber-600">Flagged</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2">
                          <p className="text-2xl font-bold text-red-700">
                            {rejectedPts.length}
                          </p>
                          <p className="text-xs text-red-600">Rejected</p>
                        </div>
                      </div>
                      {lastProximity && (
                        <div
                          className={`rounded-lg p-3 text-xs space-y-0.5 ${
                            lastProximity.within_threshold
                              ? "bg-green-50 text-green-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          <p className="font-semibold">Last proximity check</p>
                          <p>
                            Distance to farm:{" "}
                            {lastProximity.distance_m?.toFixed(0)} m
                          </p>
                          <p>
                            GPS accuracy:{" "}
                            {lastProximity.location_accuracy_m?.toFixed(1)} m
                          </p>
                          <p>
                            {lastProximity.within_threshold
                              ? "✓ Within threshold"
                              : "⚠ Outside threshold"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {history.length > 0 && (
                  <Card className="shadow-md border-emerald-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-emerald-800 text-base">
                        Past Walks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {history.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            setGeofence(g);
                            loadPoints(g.id);
                            setClosed(g.status === "complete");
                            setWalking(g.status === "collecting");
                          }}
                          className="w-full text-left bg-gray-50 hover:bg-emerald-50 border border-gray-200 rounded-lg p-3 text-xs transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge
                              className={`text-xs ${
                                g.status === "complete"
                                  ? "bg-blue-100 text-blue-800"
                                  : g.status === "collecting"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {g.status}
                            </Badge>
                            <span className="text-gray-400">
                              {new Date(g.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {g.area_m2 != null && (
                            <p className="text-gray-600">
                              Area: {m2ToAcres(g.area_m2)} acres
                            </p>
                          )}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ── Recent submitted events (session) ──────────────────── */}
                {recentEvents.length > 0 && (
                  <Card className="shadow-md border-sky-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sky-800 text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Submitted Events
                        <Badge className="ml-auto bg-sky-100 text-sky-700 text-xs">
                          {recentEvents.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {recentEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sky-800 capitalize">
                              {ev.event_type.replace(/_/g, " ")}
                            </span>
                            <Badge
                              className={`text-xs ${
                                ev.severity === "extreme"
                                  ? "bg-red-100 text-red-800"
                                  : ev.severity === "high"
                                    ? "bg-orange-100 text-orange-800"
                                    : ev.severity === "medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                              }`}
                            >
                              {ev.severity}
                            </Badge>
                          </div>
                          <p className="text-sky-700">
                            {ev.district} · {ev.country}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              {ev.status}
                            </Badge>
                            <span className="text-gray-400">
                              {new Date(ev.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* ─── RIGHT: MAP + TABLE ─── */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="shadow-md border-emerald-100 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-emerald-800 text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Boundary Map
                      {points.length > 0 && (
                        <span className="ml-auto text-xs text-gray-400 font-normal">
                          {acceptedPts.length} accepted · {points.length} total
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div
                      ref={mapCallbackRef}
                      style={{ height: 480, width: "100%" }}
                    />
                  </CardContent>
                </Card>

                {!selectedFarmer && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <MapPin className="w-14 h-14 mb-4 opacity-20" />
                    <p className="text-lg font-medium">
                      Select a farmer to begin
                    </p>
                    <p className="text-sm mt-1">
                      Choose from the list on the left to start a boundary walk
                    </p>
                    <button
                      onClick={() => setShowEventModal(true)}
                      className="mt-6 flex items-center gap-2 text-sm text-emerald-600 border border-emerald-300 hover:bg-emerald-50 rounded-lg px-4 py-2 transition-colors font-medium"
                    >
                      <CloudRain className="w-4 h-4" />
                      Or submit a weather event observation
                    </button>
                  </div>
                )}

                {points.length > 0 && (
                  <Card className="shadow-md border-emerald-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-emerald-800 text-base">
                        Captured Points Log
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-emerald-50">
                            <tr>
                              {[
                                "#",
                                "Status",
                                "Latitude",
                                "Longitude",
                                "Accuracy (m)",
                                "Farm dist (m)",
                                "Flag",
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-3 py-2 text-left text-emerald-800 font-semibold whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {points.map((pt, i) => (
                              <tr
                                key={pt.id}
                                className={`border-t border-gray-100 ${i % 2 ? "bg-gray-50/60" : ""}`}
                              >
                                <td className="px-3 py-2 font-mono text-gray-500">
                                  {pt.sequence}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge
                                    className={`text-xs ${
                                      pt.status === "accepted"
                                        ? "bg-green-100 text-green-800"
                                        : pt.status === "rejected"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {pt.status}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">
                                  {pt.returned_lat?.toFixed(5)}
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">
                                  {pt.returned_lng?.toFixed(5)}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {pt.returned_accuracy_m?.toFixed(1)}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {pt.proximity_distance_m?.toFixed(0)}
                                </td>
                                <td className="px-3 py-2">
                                  {pt.proximity_flagged ? (
                                    <span className="text-amber-600 font-semibold">
                                      ⚠ Yes
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Weather Event Modal ─────────────────────────────────────────────── */}
      {showEventModal && (
        <WeatherEventModal
          onClose={() => setShowEventModal(false)}
          onSuccess={(ev) => {
            handleEventSuccess(ev);
            setShowEventModal(false);
          }}
          prefillDistrict={selectedFarmer?.district}
          prefillCountry={selectedFarmer?.country}
        />
      )}
    </div>
  );
}
