// app/dashboard/school/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
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

interface RegistrationResponse {
  farmer: Farmer;
  user_id: string;
  gps_latitude: number;
  gps_longitude: number;
  gps_accuracy_m: number;
  registration_path: string;
  proximity: null;
  flag_for_review: boolean;
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

export default function AgroSignalDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
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

  // Auth check
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

  // Load farmers
  const fetchFarmers = async () => {
    try {
      setLoading(true);
      setError(null);
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).access_token : null;

      const res = await fetch(`${API_BASE_URL}/farmers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(`Failed to fetch farmers: ${res.status}`);
      const data = await res.json();
      // Handle paginated or plain array response
      const list: Farmer[] = Array.isArray(data)
        ? data
        : (data.items ?? data.farmers ?? []);
      setFarmers(list);
    } catch (err: any) {
      setError(err.message || "Failed to load farmers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchFarmers();
  }, [user]);

  // Init Leaflet map after farmers load
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix default marker icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView(
          [1.3733, 32.2903],
          6,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(mapInstanceRef.current);
      }

      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapRef.current]);

  // Update markers when farmers change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const validFarmers = farmers.filter(
        (f) =>
          f.gps_lat &&
          f.gps_lng &&
          !isNaN(parseFloat(f.gps_lat)) &&
          !isNaN(parseFloat(f.gps_lng)),
      );

      validFarmers.forEach((farmer) => {
        const lat = parseFloat(farmer.gps_lat);
        const lng = parseFloat(farmer.gps_lng);

        const marker = L.marker([lat, lng]).addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: sans-serif; min-width: 160px;">
              <strong style="font-size: 14px; color: #166534;">${farmer.name}</strong><br/>
              <span style="color: #6b7280; font-size: 12px;">📍 ${farmer.district}, ${farmer.country}</span><br/>
              <span style="color: #6b7280; font-size: 12px;">🌾 ${farmer.primary_crop}</span><br/>
              <span style="color: #6b7280; font-size: 12px;">📱 ${farmer.msisdn}</span>
            </div>
          `);

        markersRef.current.push(marker);
      });

      if (validFarmers.length > 1) {
        const group = L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    };

    updateMarkers();
  }, [farmers, mapReady]);

  // Register farmer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const authUser = localStorage.getItem("authUser");
      const token = authUser ? JSON.parse(authUser).access_token : null;

      const payload: any = {
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
            : detail || `Registration failed: ${res.status}`,
        );
      }

      const data: RegistrationResponse = await res.json();
      setFarmers((prev) => [data.farmer, ...prev]);
      setSuccessMsg(`✓ ${data.farmer.name} registered successfully!`);
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
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const cropCounts = farmers.reduce((acc: Record<string, number>, f) => {
    const c = f.primary_crop || "Unknown";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const topCrop = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0];
  const districts = new Set(farmers.map((f) => f.district)).size;
  const activeCount = farmers.filter((f) => f.status === "active").length;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-emerald-700">
        Authenticating...
      </div>
    );
  }

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

            {/* Header row */}
            <div className="flex items-center justify-between">
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

                      {error && (
                        <div className="bg-red-50 border-l-4 border-red-400 rounded p-3 text-sm text-red-800">
                          {error}
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
                        {submitting ? "Registering..." : "Register Farmer"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Error banner */}
            {error && !dialogOpen && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg border-0">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-xs font-medium uppercase tracking-wide">
                        Total Farmers
                      </p>
                      <p className="text-4xl font-bold mt-1">
                        {farmers.length}
                      </p>
                    </div>
                    <Users className="w-10 h-10 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg border-0">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase tracking-wide">
                        Active
                      </p>
                      <p className="text-4xl font-bold mt-1">{activeCount}</p>
                    </div>
                    <Globe className="w-10 h-10 text-teal-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg border-0">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-xs font-medium uppercase tracking-wide">
                        Districts
                      </p>
                      <p className="text-4xl font-bold mt-1">{districts}</p>
                    </div>
                    <MapPin className="w-10 h-10 text-cyan-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-0">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-xs font-medium uppercase tracking-wide">
                        Top Crop
                      </p>
                      <p className="text-xl font-bold mt-1 truncate">
                        {topCrop ? topCrop[0] : "—"}
                      </p>
                      {topCrop && (
                        <p className="text-green-200 text-xs">
                          {topCrop[1]} farmers
                        </p>
                      )}
                    </div>
                    <Wheat className="w-10 h-10 text-green-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Map + Table row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Leaflet Map */}
              <Card className="shadow-lg border-emerald-100 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-emerald-800 flex items-center gap-2 text-base">
                    <MapPin className="w-5 h-5" />
                    Farmer Locations
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-emerald-100 text-emerald-700"
                    >
                      {farmers.filter((f) => f.gps_lat && f.gps_lng).length}{" "}
                      mapped
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={mapRef}
                    style={{ height: "420px", width: "100%", zIndex: 0 }}
                  />
                </CardContent>
              </Card>

              {/* Crop breakdown */}
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
                                <span className="font-medium text-gray-700">
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
                    Loading farmers...
                  </div>
                ) : farmers.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No farmers registered yet.</p>
                    <p className="text-sm mt-1">
                      Use the button above to register the first farmer.
                    </p>
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
                            Location
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {farmers.map((farmer) => (
                          <TableRow
                            key={farmer.id}
                            className="hover:bg-emerald-50/50 cursor-pointer"
                            onClick={() => {
                              setSelectedFarmer(farmer);
                              if (
                                mapInstanceRef.current &&
                                farmer.gps_lat &&
                                farmer.gps_lng
                              ) {
                                mapInstanceRef.current.setView(
                                  [
                                    parseFloat(farmer.gps_lat),
                                    parseFloat(farmer.gps_lng),
                                  ],
                                  12,
                                );
                                // Scroll to map
                                mapRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                              }
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
                            <TableCell className="text-xs text-gray-500">
                              {farmer.gps_lat && farmer.gps_lng ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <MapPin className="w-3 h-3" />
                                  {parseFloat(farmer.gps_lat).toFixed(4)},{" "}
                                  {parseFloat(farmer.gps_lng).toFixed(4)}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
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
