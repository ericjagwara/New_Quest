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
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_AGROSIGNAL_URL ||
  "https://agrosignal-dugg.onrender.com";

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
}

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

export default function AgroSignalDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  // Keep farmersRef in sync so the callback ref can access latest farmers
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
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).access_token : null;
      const res = await fetch(`${API_BASE_URL}/farmers`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  // Draw markers — called after map is ready and after farmers update
  const drawMarkers = useCallback((L: any, map: any, farmerList: Farmer[]) => {
    // Clear old
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
    } catch (_) {
      // fitBounds can throw if bounds are invalid
    }
  }, []);

  // Callback ref — fires the moment the div enters the DOM
  const mapCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return; // unmounting
      if (mapInstanceRef.current) return; // already initialised

      mapContainerRef.current = node;

      // Async init inside the callback ref
      (async () => {
        const L = (await import("leaflet")).default;

        // Inject Leaflet CSS once
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
          // Small wait for CSS to load so tiles render correctly
          await new Promise((r) => setTimeout(r, 100));
        }

        // Fix broken webpack icon paths
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

        // Draw any farmers that already loaded before the map was ready
        if (farmersRef.current.length > 0) {
          drawMarkers(L, map, farmersRef.current);
        }

        // Subscribe to future farmer updates via a custom event
        node.addEventListener("farmers-updated", ((e: CustomEvent) => {
          drawMarkers(L, map, e.detail as Farmer[]);
        }) as EventListener);
      })();
    },
    [drawMarkers],
  );

  // Fire custom event whenever farmers state changes
  useEffect(() => {
    const node = mapContainerRef.current;
    if (!node || !mapInstanceRef.current) return;
    node.dispatchEvent(new CustomEvent("farmers-updated", { detail: farmers }));
  }, [farmers]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Register farmer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).access_token : null;
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
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
  const topCrop = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0];
  const districts = new Set(farmers.map((f) => f.district)).size;
  const activeCount = farmers.filter((f) => f.status === "active").length;
  const mappedCount = farmers.filter(
    (f) =>
      f.gps_lat &&
      f.gps_lng &&
      !isNaN(parseFloat(f.gps_lat)) &&
      !isNaN(parseFloat(f.gps_lng)),
  ).length;

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
              <div className="flex gap-3">
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
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
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

            {/* Map + Crop breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* MAP — callback ref guarantees init after DOM mount */}
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

              {/* Crop chart */}
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
    </div>
  );
}
