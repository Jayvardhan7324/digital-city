"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import InsightCard from "@/components/InsightCard";
import ReportModal from "@/components/ReportModal";
import DatasetSelector from "@/components/DatasetSelector";
import GroqInsightButton from "@/components/GroqInsightButton";
import type { SimulationResult, GeoFeature } from "@/components/MapView";
import {
  Layers, Cloud, Car, Activity, Trash2, AlertTriangle, Siren,
  ChevronRight, RefreshCw, MapPin, BarChart3, Building2, Droplets,
  ShieldAlert, MapPinned, Crosshair, X, Dog, Zap, Waves,
  Map, MessageSquare, Send, Loader2, Upload,
} from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
          <div className="absolute inset-1 rounded-full border border-white/20 animate-spin" style={{ animationDuration: "1.5s" }} />
          <Building2 className="absolute inset-0 m-auto w-5 h-5 text-white/40" />
        </div>
        <p className="text-white/30 text-xs tracking-widest uppercase">Loading Map</p>
      </div>
    </div>
  ),
});

interface HeatPoint { lat: number; lng: number; intensity: number; }
interface FloodFeature {
  type: string;
  properties: { name: string; risk: "HIGH" | "MEDIUM" | "LOW"; score: number; elevation_m: number; drainage_score: number; };
  geometry: { type: string; coordinates: [number, number]; };
}
interface Facility {
  type: string;
  properties: { id: string; name: string; facility_type: string; amenity?: string; phone?: string; operator?: string; };
  geometry: { type: string; coordinates: [number, number]; };
}
interface Weakness { zone: string; issue: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; recommendation: string; }

const LAYERS = [
  { id: "flood",            label: "Flood Risk",         icon: Droplets,      kml: false },
  { id: "traffic",          label: "Traffic",             icon: Car,           kml: false },
  { id: "crime",            label: "Crime",               icon: Activity,      kml: false },
  { id: "garbage_dump",     label: "Garbage Dumps",       icon: Trash2,        kml: false },
  { id: "pothole",          label: "Potholes",            icon: AlertTriangle, kml: false },
  { id: "drainage",         label: "Drainage",            icon: Waves,         kml: false },
  { id: "stp",              label: "STP Plants",          icon: Zap,           kml: false },
  { id: "street_dogs",      label: "Street Dogs",         icon: Dog,           kml: false },
  { id: "crashes",          label: "Road Crashes",        icon: Siren,         kml: false },
  { id: "ground_potential", label: "Ground Potential",    icon: Map,           kml: true  },
  { id: "road_width",       label: "Road Width",          icon: Map,           kml: true  },
  { id: "wards",            label: "Ward Boundaries",     icon: Map,           kml: true  },
];

const CRIME_SOURCES = [
  { id: "crime",      label: "Synthetic",  desc: "Zone-based" },
  { id: "crime_ncrb", label: "NCRB 2023",  desc: "Official"   },
];

const API = "http://localhost:8000";

export default function HomePage() {
  const [activeLayers, setActiveLayers] = useState<string[]>(["flood"]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [floodFeatures, setFloodFeatures] = useState<FloodFeature[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showFacilities, setShowFacilities] = useState(false);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [insights, setInsights] = useState<Weakness[]>([]);
  const [insightsTitle, setInsightsTitle] = useState("CITY WEAKNESS REPORT");
  const [rightTab, setRightTab] = useState<"insights" | "ask">("insights");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [reportCoords, setReportCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [reportCount, setReportCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [crimeSource, setCrimeSource] = useState<"crime" | "crime_ncrb">("crime");
  const [simulationMode, setSimulationMode] = useState<"none" | "rain" | "crime">("none");
  const [simulationRadiusKm, setSimulationRadiusKm] = useState(1.0);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [geoJsonLayer, setGeoJsonLayer] = useState<{ id: string; features: GeoFeature[] } | null>(null);
  const [kmlFileName, setKmlFileName] = useState<string | null>(null);
  const kmlFileRef = useRef<HTMLInputElement>(null);

  // ── data fetching ──
  const fetchFlood = useCallback(async () => {
    try {
      const r = await fetch(`${API}/flood/risk?rainfall=80`);
      const d = await r.json();
      setFloodFeatures(d.features || []);
      // No status message for flood — it loads silently
    } catch {}
  }, []);

  const fetchHeatLayer = useCallback(async (layer: string, source?: string) => {
    if (layer === "flood") return;
    const endpoint = layer === "crime" ? (source ?? crimeSource) : layer;
    try {
      const r = await fetch(`${API}/heatmap/${endpoint}`);
      const d = await r.json();
      setHeatPoints(Array.isArray(d) ? d : (d.points || []));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crimeSource]);

  const fetchKmlLayer = useCallback(async (layerId: string) => {
    try {
      const r = await fetch(`${API}/kml/${layerId}`);
      const d = await r.json();
      setGeoJsonLayer({ id: layerId, features: d.features || [] });
      setStatusMsg(`${d.label} — ${d.count} features`);
    } catch { setStatusMsg("Could not load KML layer"); }
  }, []);

  const handleKmlUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (kmlFileRef.current) kmlFileRef.current.value = "";
    try {
      let kmlText: string;
      if (file.name.toLowerCase().endsWith(".kmz")) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const entry = Object.values(zip.files).find((f: any) => f.name.toLowerCase().endsWith(".kml") && !f.dir) as any;
        if (!entry) throw new Error("No KML inside KMZ");
        kmlText = await entry.async("text");
      } else {
        kmlText = await file.text();
      }
      const { kml } = await import("@tmcw/togeojson");
      const doc = new DOMParser().parseFromString(kmlText, "text/xml");
      const geojson = kml(doc);
      const features = (geojson.features || []).filter((f: any) => f.geometry) as GeoFeature[];
      setGeoJsonLayer({ id: file.name, features });
      setKmlFileName(file.name);
      setActiveLayers([]);
      setHeatPoints([]);
      setStatusMsg(`${file.name} — ${features.length} features`);
    } catch {
      setStatusMsg("Could not parse KML/KMZ file");
    }
  }, []);

  const clearKml = useCallback(() => {
    setGeoJsonLayer(null);
    setKmlFileName(null);
    setStatusMsg(null);
  }, []);

  const fetchInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const r = await fetch(`${API}/insights/`);
      const d = await r.json();
      setInsights(d.top_weaknesses || []);
      setInsightsTitle(d.title || "CITY WEAKNESS REPORT");
    } catch {} finally { setLoadingInsights(false); }
  }, []);

  const fetchDataset = useCallback(async (id: string) => {
    setSelectedDataset(id || null);
    if (!id) { setHeatPoints([]); return; }
    try {
      const r = await fetch(`${API}/datasets/${id}`);
      const d = await r.json();
      setHeatPoints((d.points || []).map((p: any) => ({ lat: p.lat, lng: p.lng, intensity: p.intensity ?? 0.7 })));
      setStatusMsg(`${d.label} — ${d.count} points`);
    } catch { setStatusMsg("Could not load dataset"); }
  }, []);

  const fetchFacilities = useCallback(async () => {
    setLoadingFacilities(true);
    try {
      const r = await fetch(`${API}/emergency/facilities-osm?city=Bangalore&amenity=all`);
      const d = await r.json();
      setFacilities(d.features || []);
      setStatusMsg(`${d.features?.length || 0} facilities loaded`);
    } catch { setStatusMsg("Could not load OSM facilities"); }
    finally { setLoadingFacilities(false); }
  }, []);

  const fetchSimulation = useCallback(async (lat: number, lng: number) => {
    setLoadingSimulation(true);
    try {
      const mode = simulationMode === "none" ? "crime" : simulationMode;
      const r = await fetch(`${API}/emergency/simulate?lat=${lat}&lng=${lng}&radius_km=${simulationRadiusKm}&mode=${mode}`);
      const d = await r.json();
      setSimulationResult(d);
      setStatusMsg(d.summary);
    } catch { setStatusMsg("Simulation failed — is backend running?"); }
    finally { setLoadingSimulation(false); }
  }, [simulationMode, simulationRadiusKm]);

  const clearSimulation = () => { setSimulationResult(null); setSimulationMode("none"); setStatusMsg(null); };

  useEffect(() => { fetchFlood(); fetchInsights(); }, []);

  const toggleLayer = (id: string) => {
    const layer = LAYERS.find((l) => l.id === id);
    if (activeLayers.includes(id)) {
      setActiveLayers([]);
      setHeatPoints([]);
      setGeoJsonLayer(null);
    } else {
      setActiveLayers([id]);
      setHeatPoints([]);
      setGeoJsonLayer(null);
      if (id === "flood") fetchFlood();
      else if (layer?.kml) fetchKmlLayer(id);
      else fetchHeatLayer(id);
    }
  };

  const toggleFacilities = () => {
    if (!showFacilities && facilities.length === 0) fetchFacilities();
    setShowFacilities((v) => !v);
  };

  const handleCrimeSourceChange = (src: "crime" | "crime_ncrb") => {
    setCrimeSource(src);
    if (activeLayers.includes("crime")) fetchHeatLayer("crime", src);
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setReportCoords({ lat, lng });
  }, []);

  const handleReportSubmit = (r: { lat: number; lng: number; category: string; description: string }) => {
    setReportCount((c) => c + 1);
    setStatusMsg(`Report filed at ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`);
    if (activeLayers.includes(r.category)) fetchHeatLayer(r.category);
    setReportCoords(null);
    fetchInsights();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-black relative">

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className={`relative flex flex-col glass-panel m-2 z-20 flex-shrink-0
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${sidebarOpen ? "w-64" : "w-11"}`}>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-[#111] border border-white/10
                     flex items-center justify-center hover:bg-white/10 transition-all duration-200 z-10
                     hover:scale-110 active:scale-95">
          <ChevronRight className={`w-3 h-3 text-white/50 transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`} />
        </button>

        {sidebarOpen && (
          <div className="animate-slide-in-left flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-black" />
                </div>
                <div>
                  <h1 className="text-white font-semibold text-sm leading-tight tracking-tight">Bengaluru</h1>
                  <p className="text-white/30 text-[10px] tracking-widest uppercase">Smart City</p>
                </div>
              </div>
              {reportCount > 0 && (
                <div className="mt-2.5 text-[10px] border border-white/10 rounded-md px-2 py-1.5 text-white/50">
                  {reportCount} report{reportCount > 1 ? "s" : ""} this session
                </div>
              )}
            </div>

            {/* Layers */}
            <div className="px-3 py-3 border-b border-white/5 overflow-y-auto" style={{ maxHeight: "380px" }}>
              <p className="text-white/25 text-[9px] font-medium uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
                <Layers className="w-2.5 h-2.5" /> Layers
              </p>
              <div className="space-y-0.5">
                {LAYERS.map((layer, i) => {
                  const isActive = activeLayers.includes(layer.id);
                  return (
                    <button key={layer.id} onClick={() => toggleLayer(layer.id)}
                      style={{ animationDelay: `${i * 25}ms` }}
                      className={`animate-fade-in w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs
                        transition-all duration-150 hover:bg-white/5 active:scale-[0.98]
                        ${isActive ? "bg-white/[0.06] text-white border border-white/[0.09]" : "text-white/40 border border-transparent"}`}>
                      <layer.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-white" : "text-white/25"}`} />
                      <span className="flex-1 text-left">{layer.label}</span>
                      {layer.kml && <span className="text-[8px] text-white/20 uppercase tracking-wider">KML</span>}
                      {isActive && <div className="w-1 h-1 rounded-full bg-white pulse-dot flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KML / KMZ Upload */}
            <div className="px-3 py-3 border-b border-white/5">
              <p className="text-white/25 text-[9px] font-medium uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
                <Upload className="w-2.5 h-2.5" /> KML / KMZ File
              </p>
              <input ref={kmlFileRef} type="file" accept=".kml,.kmz" className="hidden" onChange={handleKmlUpload} />
              <div className="flex gap-1.5">
                <button onClick={() => kmlFileRef.current?.click()}
                  className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs
                    border border-white/[0.09] text-white/50 hover:bg-white/5 hover:text-white/80
                    transition-all duration-150 active:scale-[0.98] min-w-0">
                  <Upload className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{kmlFileName ?? "Open file…"}</span>
                </button>
                {kmlFileName && (
                  <button onClick={clearKml}
                    className="px-2 rounded-md border border-white/[0.06] text-white/25
                      hover:text-white/60 hover:border-white/20 transition-all duration-150">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Facilities */}
            <div className="px-3 py-3 border-b border-white/5">
              <p className="text-white/25 text-[9px] font-medium uppercase tracking-[0.15em] mb-2 px-1 flex items-center gap-1.5">
                <MapPinned className="w-2.5 h-2.5" /> Facilities
              </p>
              <button onClick={toggleFacilities} disabled={loadingFacilities}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150
                  hover:bg-white/5 active:scale-[0.98]
                  ${showFacilities ? "bg-white/[0.06] text-white border border-white/[0.09]" : "text-white/40 border border-transparent"}`}>
                <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${showFacilities ? "text-white" : "text-white/25"}`} />
                <span className="flex-1 text-left">
                  {loadingFacilities ? "Loading…" : `OSM Facilities${facilities.length > 0 ? ` (${facilities.length})` : ""}`}
                </span>
                {showFacilities && <div className="w-1 h-1 rounded-full bg-white pulse-dot" />}
              </button>
            </div>

            {/* Emergency Simulation */}
            <div className="px-3 py-3 border-b border-white/5">
              <p className="text-white/25 text-[9px] font-medium uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
                <Siren className="w-2.5 h-2.5" /> Simulation
              </p>
              <div className="flex gap-1 mb-2">
                {[
                  { id: "crime", label: "Crime", icon: Crosshair, activeClass: "bg-green-600 text-white border-transparent", hoverClass: "hover:bg-green-600/20 hover:text-green-400 hover:border-green-600/30" },
                  { id: "rain",  label: "Rain",  icon: Cloud,     activeClass: "bg-blue-600 text-white border-transparent",  hoverClass: "hover:bg-blue-600/20 hover:text-blue-400 hover:border-blue-600/30" },
                ].map(({ id, label, icon: Icon, activeClass, hoverClass }) => (
                  <button key={id}
                    onClick={() => setSimulationMode(simulationMode === id ? "none" : id as any)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px]
                      font-medium transition-all duration-150 border active:scale-95
                      ${simulationMode === id
                        ? activeClass
                        : `bg-transparent text-white/40 border-white/10 ${hoverClass}`}`}>
                    <Icon className="w-2.5 h-2.5" />{label}
                  </button>
                ))}
                {simulationMode !== "none" && (
                  <button onClick={clearSimulation}
                    className="px-2 py-1.5 rounded-md border border-white/10 text-white/30
                               hover:text-white/60 hover:border-white/20 transition-all duration-150">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {simulationMode === "rain" && (
                <div className="mb-2">
                  <div className="flex justify-between text-[9px] text-white/30 mb-1.5 px-0.5">
                    <span>Radius</span>
                    <span className="font-mono text-white/50">{simulationRadiusKm} km</span>
                  </div>
                  <input type="range" min={0.5} max={5} step={0.5} value={simulationRadiusKm}
                    onChange={(e) => setSimulationRadiusKm(Number(e.target.value))}
                    className="w-full" style={{ accentColor: "white" }} />
                </div>
              )}
              {simulationMode !== "none" && loadingSimulation && (
                <div className="text-[9px] text-white/30 border border-white/[0.06] rounded-md px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-white/40 animate-ping" />Calculating…
                </div>
              )}
            </div>

            {/* Status */}
            {statusMsg && (
              <div className="mx-3 mt-2 animate-fade-in-up text-[10px] text-white/35 border border-white/[0.06]
                              rounded-md px-2.5 py-2 leading-relaxed">
                {statusMsg}
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto px-4 py-3 text-[9px] text-white/15 space-y-0.5">
              <div>Map · OpenStreetMap / Leaflet</div>
              <div>Crime · NCRB 2023 · Karnataka</div>
              <div>Crashes · BTP 2025 · Bengaluru</div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MAIN MAP ═══ */}
      <div className="flex-1 relative m-2 ml-0 rounded-xl overflow-hidden">
        <MapView
          activeLayers={activeLayers}
          heatPoints={heatPoints}
          floodFeatures={floodFeatures}
          facilities={facilities}
          showFacilities={showFacilities}
          onMapClick={handleMapClick}
          simulationMode={simulationMode}
          simulationRadiusKm={simulationRadiusKm}
          simulationResult={simulationResult}
          onSimulate={fetchSimulation}
          geoJsonLayer={geoJsonLayer}
        />

        {activeLayers.includes("crime") && (
          <CrimeSourceSelector source={crimeSource} onChange={handleCrimeSourceChange} />
        )}

        <div className={activeLayers.includes("crime") ? "absolute top-24 left-3 z-20" : "absolute top-3 left-3 z-20"}>
          <DatasetSelector onSelect={fetchDataset} selected={selectedDataset} />
        </div>

        {/* Simulation result overlay */}
        {simulationResult && (
          <div className="absolute bottom-3 left-3 z-20 w-72 animate-fade-in-up">
            <div className="glass-panel px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-[11px] font-semibold">
                  {simulationResult.mode === "rain" ? "Flood Response" : "Crime Response"}
                </span>
                <button onClick={clearSimulation}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-3 h-3 text-white/40" />
                </button>
              </div>
              <p className="text-white/35 text-[9px] mb-2 leading-relaxed">{simulationResult.summary}</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {simulationResult.responders.map((r, i) => {
                  const isDelayed = r.status === "UNDER-SERVED";
                  const labels: Record<string,string> = { fire:"Fire", hospital:"Hospital", police:"Police" };
                  return (
                    <div key={i} className={`flex items-center justify-between px-2 py-1 rounded-md text-[9px]
                      ${isDelayed ? "bg-white/[0.04] border border-white/10" : "bg-white/[0.02] border border-white/[0.05]"}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.type === "fire" ? "bg-orange-400" : r.type === "hospital" ? "bg-blue-400" : "bg-purple-400"}`} />
                        <span className="text-white/70 truncate">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2 font-mono text-white/40">
                        <span>{r.eta_minutes}m</span>
                        {(r as any).manpower && <span className="text-white/25">{(r as any).manpower}p</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-wrap gap-1 pointer-events-none z-10 justify-end">
          {activeLayers.map((id) => {
            const layer = LAYERS.find((l) => l.id === id);
            if (!layer) return null;
            return (
              <div key={id} className="animate-fade-in flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-[10px] font-medium text-white border border-white/15 bg-black/70 backdrop-blur-md">
                <layer.icon className="w-2.5 h-2.5 text-white/60" />
                {layer.label}
              </div>
            );
          })}
          {showFacilities && (
            <div className="animate-fade-in flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[10px] font-medium text-white border border-white/15 bg-black/70 backdrop-blur-md">
              <MapPin className="w-2.5 h-2.5 text-white/60" /> OSM Facilities
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="w-72 flex flex-col gap-2 m-2 ml-0 flex-shrink-0">
        {/* Tabs */}
        <div className="glass-panel p-1 flex gap-0.5">
          {[
            { id: "insights", label: "Insights", icon: BarChart3     },
            { id: "ask",      label: "Ask AI",   icon: MessageSquare },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setRightTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px]
                font-medium transition-all duration-200
                ${rightTab === id ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50 hover:bg-white/5"}`}>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Insights ── */}
        {rightTab === "insights" && (
          <div className="flex-1 glass-panel px-4 py-3 flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-white font-semibold text-[11px] tracking-tight">{insightsTitle}</h2>
                <p className="text-white/25 text-[9px] uppercase tracking-widest mt-0.5">Infrastructure gaps</p>
              </div>
              <button onClick={fetchInsights} disabled={loadingInsights}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center
                           transition-all duration-150 hover:scale-110 active:scale-95">
                <RefreshCw className={`w-3 h-3 text-white/40 ${loadingInsights ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="mb-2">
              <GroqInsightButton onInsightsLoaded={(ws, title) => { setInsights(ws); setInsightsTitle(title); }} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/15">
                  <BarChart3 className="w-7 h-7 mb-2" />
                  <p className="text-[10px]">Loading insights…</p>
                </div>
              ) : (
                insights.map((w, i) => <InsightCard key={i} weakness={w} index={i} />)
              )}
            </div>
          </div>
        )}

        {/* ── Ask AI ── */}
        {rightTab === "ask" && (
          <div className="flex-1 glass-panel px-4 py-3 flex flex-col overflow-hidden animate-fade-in">
            <h2 className="text-white font-semibold text-[11px] tracking-tight mb-0.5">Ask About Bengaluru</h2>
            <p className="text-white/25 text-[9px] uppercase tracking-widest mb-3">Powered by Groq AI</p>
            <AskGroqPanel />
          </div>
        )}
      </div>

      {reportCoords && (
        <ReportModal
          lat={reportCoords.lat}
          lng={reportCoords.lng}
          onClose={() => setReportCoords(null)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}

/* ── Crime Source Selector ── */
function CrimeSourceSelector({ source, onChange }: { source: "crime" | "crime_ncrb"; onChange: (src: "crime" | "crime_ncrb") => void }) {
  return (
    <div className="absolute top-3 left-3 z-20 animate-fade-in">
      <div className="border border-white/10 rounded-xl overflow-hidden bg-black/80 backdrop-blur-xl shadow-2xl">
        <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5">
          <ShieldAlert className="w-2.5 h-2.5 text-white/30" />
          <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-medium">Crime Source</p>
        </div>
        <div className="flex">
          {CRIME_SOURCES.map((cs) => (
            <button key={cs.id} onClick={() => onChange(cs.id as "crime" | "crime_ncrb")}
              className={`flex-1 flex flex-col items-start px-3 py-2 text-left transition-all duration-150
                ${source === cs.id ? "bg-white/[0.06] text-white" : "text-white/30 hover:bg-white/[0.03] hover:text-white/50"}`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${source === cs.id ? "bg-white" : "bg-white/20"}`} />
                <span className="text-[10px] font-medium">{cs.label}</span>
                {source === cs.id && <span className="text-[8px] text-white/40 ml-1">ACTIVE</span>}
              </div>
              <span className="text-[9px] text-white/20 ml-3 mt-0.5">{cs.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Ask Groq Panel ── */
function AskGroqPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const submit = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setLoading(true);
    try {
      const r = await fetch(`http://localhost:8000/insights/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      setHistory((h) => [...h, { q, a: d.answer || "No response." }]);
    } catch {
      setHistory((h) => [...h, { q, a: "Error — is the backend running?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden gap-2">
      {/* History */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {history.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-10 text-white/15">
            <MessageSquare className="w-7 h-7 mb-2" />
            <p className="text-[10px] text-center">Ask anything about Bengaluru — traffic, crime, infrastructure, zones…</p>
          </div>
        )}
        {history.map((item, i) => (
          <div key={i} className="space-y-1.5 animate-fade-in-up">
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-white text-black text-[10px] px-3 py-2 rounded-xl rounded-tr-sm leading-relaxed font-medium">
                {item.q}
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[95%] bg-white/[0.04] border border-white/[0.06] text-white/70 text-[10px]
                              px-3 py-2 rounded-xl rounded-tl-sm leading-relaxed">
                {item.a}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white/[0.04] border border-white/[0.06] px-3 py-2 rounded-xl rounded-tl-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1.5 items-end">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Ask about Bengaluru…"
          rows={2}
          className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[10px]
                     text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20
                     transition-colors leading-relaxed"
        />
        <button onClick={submit} disabled={loading || !question.trim()}
          className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center flex-shrink-0
                     hover:bg-white/90 transition-all duration-150 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

