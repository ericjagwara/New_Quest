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

// Guest fallback — used when no authUser is in localStorage
const GUEST_USER: SessionUser = {
  id: "guest",
  name: "Field Agent",
  username: "Field Agent",
  role: "fieldworker",
};

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
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // ── Auth — no redirect; guests are welcome, logged-in users load their session ──
  useEffect(() => {
    const raw = localStorage.getItem("authUser");
    if (!raw) return; // stay as GUEST_USER, no redirect
    try {
      const u = JSON.parse(raw);
      // Skip expiry redirect — field agent page is public
      if (u.expiresAt && Date.now() > u.expiresAt) {
        localStorage.removeItem("authUser");
        return; // stay as guest, don't redirect
      }
      setUser(u); // use logged-in session if available
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
  }, []); // ← no longer depends on user; loads immediately on mount

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
            <div>
              <h1 className="text-3xl font-bold text-emerald-800">
                Farm Boundary Walk
              </h1>
              <p className="text-emerald-600 text-sm mt-1">
                Select a farmer, walk the boundary, and capture GPS points to
                build a geofence polygon.
              </p>
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
    </div>
  );
}
