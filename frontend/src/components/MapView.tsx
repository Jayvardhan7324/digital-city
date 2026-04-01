"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

export interface HeatPoint { lat: number; lng: number; intensity: number; }

export interface FloodFeature {
  type: string;
  properties: { name: string; risk: "HIGH" | "MEDIUM" | "LOW"; score: number; elevation_m: number; drainage_score: number; };
  geometry: { type: string; coordinates: [number, number]; };
}

export interface Facility {
  type: string;
  properties: { id: string; name: string; facility_type: string; amenity?: string; phone?: string; operator?: string; };
  geometry: { type: string; coordinates: [number, number]; };
}

export interface SimulationResponder {
  type: "fire" | "hospital" | "police";
  name: string;
  facility_lat: number;
  facility_lng: number;
  distance_km: number;
  eta_minutes: number;
  status: string;
  delay_warning: string;
}

export interface SimulationResult {
  mode: "rain" | "crime";
  incident: { lat: number; lng: number };
  radius_km: number;
  responders: SimulationResponder[];
  summary: string;
}

export interface GeoFeature {
  geometry: { type: string; coordinates: any };
  properties: Record<string, any>;
}

interface MapViewProps {
  activeLayers: string[];
  layerData: Record<string, HeatPoint[]>;
  floodFeatures: FloodFeature[];
  facilities: Facility[];
  showFacilities: boolean;
  onMapClick: (lat: number, lng: number) => void;
  simulationMode: "none" | "rain" | "crime";
  simulationRadiusKm: number;
  simulationResult: SimulationResult | null;
  onSimulate: (lat: number, lng: number) => void;
  geoJsonLayer?: { id: string; features: GeoFeature[] } | null;
}

const RISK_COLORS: Record<string, { fill: string; border: string }> = {
  HIGH:   { fill: "rgba(255,50,50,0.35)",   border: "#ff3232" },
  MEDIUM: { fill: "rgba(255,165,0,0.30)",   border: "#ffa500" },
  LOW:    { fill: "rgba(60,220,100,0.25)",  border: "#3cdc64" },
};
const RISK_RADIUS: Record<string, number> = { HIGH: 1200, MEDIUM: 900, LOW: 700 };

const FACILITY_EMOJI: Record<string, string> = {
  fire_station: "🔥", hospital: "🏥", clinic: "🩺", police: "👮",
  ambulance_station: "🚑", pharmacy: "💊", school: "🏫", college: "🎓",
};

const RESPONDER_COLOR: Record<string, string> = {
  fire: "#ff4444", hospital: "#44aaff", police: "#aa44ff",
};
const RESPONDER_EMOJI: Record<string, string> = {
  fire: "🔥", hospital: "🚑", police: "👮",
};

const HEATMAP_GRADIENT: Record<string, Record<number, string>> = {
  crime:       { 0.0: "#000023", 0.4: "#3b00c5", 0.7: "#c5003b", 1.0: "#ff0000" },
  crime_ncrb:  { 0.0: "#0a0015", 0.3: "#6600aa", 0.65: "#dd0044", 1.0: "#ff2222" },
  traffic:     { 0.0: "#201500", 0.4: "#aa6600", 0.7: "#ffaa00", 1.0: "#ffff00" },
  pothole:     { 0.0: "#150a00", 0.4: "#883300", 0.7: "#cc6600", 1.0: "#ff9900" },
  drainage:    { 0.0: "#000a20", 0.4: "#003388", 0.7: "#0077ff", 1.0: "#00ccff" },
  street_dogs: { 0.0: "#150800", 0.4: "#884400", 0.7: "#dd7700", 1.0: "#ffaa00" },
};
const HEATMAP_LAYERS = ["crime_ncrb", "traffic", "street_dogs"];
const DOT_LAYERS = ["pothole", "garbage_dump", "crime", "drainage", "stp", "crashes"];
const DOT_COLORS: Record<string, { fill: string; stroke: string }> = {
  pothole:     { fill: "#ff7700", stroke: "#cc4400" },
  garbage_dump:{ fill: "#44dd44", stroke: "#229922" },
  crime:       { fill: "#ff0033", stroke: "#aa0022" },
  drainage:    { fill: "#0088ff", stroke: "#005599" },
  stp:         { fill: "#00ccaa", stroke: "#009977" },
  crashes:     { fill: "#ff2200", stroke: "#cc1100" },
};

function loadLeafletHeat(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).leafletHeatLoaded && (window as any).L?.heatLayer) {
      resolve(); return;
    }
    (window as any).leafletHeatLoaded = false;
    const old = document.querySelector('script[src="/leaflet-heat.js"]');
    if (old) old.remove();
    const script = document.createElement("script");
    script.src = "/leaflet-heat.js";
    script.onload = () => { (window as any).leafletHeatLoaded = true; resolve(); };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function loadMarkerCluster(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).L?.markerClusterGroup) { resolve(); return; }
    if (!document.querySelector('link[href*="MarkerCluster.css"]')) {
      ["https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
      ].forEach((href) => {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = href;
        document.head.appendChild(link);
      });
    }
    const existing = document.querySelector('script[src*="markercluster"]');
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).L?.markerClusterGroup) { clearInterval(poll); resolve(); }
      }, 50);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function MapViewInner({
  activeLayers, layerData, floodFeatures, facilities, showFacilities,
  onMapClick, simulationMode, simulationRadiusKm, simulationResult, onSimulate,
  geoJsonLayer,
}: MapViewProps) {
  const [mapInitialized, setMapInitialized] = useState(false);
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heatLayersRef = useRef<any[]>([]);
  const dotLayersRef = useRef<any[]>([]);
  const floodLayersRef = useRef<any[]>([]);
  const facilityLayersRef = useRef<any[]>([]);
  const simLayersRef = useRef<any[]>([]);
  const geoJsonLayersRef = useRef<any[]>([]);
  const simModeRef = useRef(simulationMode);
  const simRadiusRef = useRef(simulationRadiusKm);
  const onSimulateRef = useRef(onSimulate);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => { simModeRef.current = simulationMode; }, [simulationMode]);
  useEffect(() => { simRadiusRef.current = simulationRadiusKm; }, [simulationRadiusKm]);
  useEffect(() => { onSimulateRef.current = onSimulate; }, [onSimulate]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // ── Initialize Map ──
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current as any;
    if (container._leaflet_id) delete container._leaflet_id;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;

      // ES module namespaces are frozen; create a mutable copy so CDN plugins can extend it
      (window as any).L = Object.assign({}, L);
      await loadLeafletHeat();
      if (cancelled) return;

      if (!document.querySelector('link[href*="leaflet@1.9.4"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [12.9716, 77.5946], zoom: 12,
        zoomControl: false, attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        if (simModeRef.current !== "none") {
          onSimulateRef.current(lat, lng);
        } else {
          onMapClickRef.current(lat, lng);
        }
      });

      mapRef.current = map;
      setMapInitialized(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── Update Heatmap Layers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      heatLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      heatLayersRef.current = [];

      const activeHeatLayers = HEATMAP_LAYERS.filter((l) => activeLayers.includes(l));
      if (activeHeatLayers.length === 0) return;

      await loadLeafletHeat();
      if (cancelled) return;

      const L = (window as any).L;
      if (!L?.heatLayer) return;

      for (const layerId of activeHeatLayers) {
        const points = layerData[layerId] || [];
        if (points.length === 0) continue;
        const gradient = HEATMAP_GRADIENT[layerId] || HEATMAP_GRADIENT.crime;
        const latlngs = points.map((p) => [p.lat, p.lng, p.intensity]);
        const heat = L.heatLayer(latlngs, { radius: 30, blur: 22, maxZoom: 15, max: 1.0, gradient, minOpacity: 0.4 });
        heat.addTo(map);
        heatLayersRef.current.push(heat);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerData, activeLayers, mapInitialized]);

  // ── Update Dot Markers with Clustering ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      dotLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      dotLayersRef.current = [];

      const activeDotLayers = DOT_LAYERS.filter((l) => activeLayers.includes(l));
      if (activeDotLayers.length === 0) return;

      const L = await import("leaflet");
      await loadMarkerCluster();
      if (cancelled) return;

      const WL = (window as any).L;
      if (!WL?.markerClusterGroup) return;

      for (const activeDotLayer of activeDotLayers) {
        const points = layerData[activeDotLayer] || [];
        if (points.length === 0) continue;

        const colors = DOT_COLORS[activeDotLayer];

        const clusterGroup = WL.markerClusterGroup({
          maxClusterRadius: 60,
          showCoverageOnHover: false,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            const size = count >= 100 ? 46 : count >= 20 ? 38 : 30;
            return WL.divIcon({
              className: "",
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
                background:${colors.fill};border:2px solid ${colors.stroke};
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-size:${size >= 38 ? 13 : 11}px;font-weight:700;
                box-shadow:0 2px 10px rgba(0,0,0,0.55)">${count}</div>`,
              iconSize: [size, size], iconAnchor: [size / 2, size / 2],
            });
          },
        });

        for (const p of points) {
          let marker: any;
          if (activeDotLayer === "stp") {
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:18px;height:18px;border-radius:3px;
                background:${colors.fill};border:2px solid ${colors.stroke};
                display:flex;align-items:center;justify-content:center;
                font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,0.5)">🏭</div>`,
              iconSize: [18, 18], iconAnchor: [9, 9],
            });
            marker = L.marker([p.lat, p.lng], { icon });
          } else {
            const size = 8 + Math.round(p.intensity * 6);
            const icon = L.divIcon({
              className: "",
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
                background:${colors.fill};border:1.5px solid ${colors.stroke};
                box-shadow:0 1px 4px rgba(0,0,0,0.5);opacity:0.9"></div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
            marker = L.marker([p.lat, p.lng], { icon });
          }
          clusterGroup.addLayer(marker);
        }

        clusterGroup.addTo(map);
        dotLayersRef.current.push(clusterGroup);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerData, activeLayers, mapInitialized]);

  // ── Update Flood Circles ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      floodLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      floodLayersRef.current = [];
      if (!activeLayers.includes("flood") || floodFeatures.length === 0) return;

      const L = await import("leaflet");
      if (cancelled) return;

      for (const feature of floodFeatures) {
        const { name, risk } = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const colors = RISK_COLORS[risk] || RISK_COLORS.LOW;
        const circle = L.circle([lat, lng], {
          radius: RISK_RADIUS[risk] || 700, color: colors.border,
          fillColor: colors.fill, fillOpacity: 0.55, weight: 1.5, opacity: 0.9,
        }).bindTooltip(
          `<div style="font-family:sans-serif;font-size:12px;font-weight:600">
            ${name}<br/><span style="color:${colors.border}">${risk} FLOOD RISK</span><br/>
            <small>Elevation: ${feature.properties.elevation_m}m | Drainage: ${feature.properties.drainage_score}/10</small>
           </div>`,
          { sticky: true, direction: "top", offset: [0, -10] }
        );
        circle.addTo(map);
        floodLayersRef.current.push(circle);
      }
    })();
    return () => { cancelled = true; };
  }, [floodFeatures, activeLayers]);

  // ── Update Facility Markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      facilityLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      facilityLayersRef.current = [];
      if (!showFacilities || facilities.length === 0) return;

      const L = await import("leaflet");
      if (cancelled) return;

      for (const f of facilities) {
        const [lng, lat] = f.geometry.coordinates;
        const emoji = FACILITY_EMOJI[f.properties.facility_type] || "📍";
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:rgba(10,18,40,0.88);border:1px solid rgba(100,160,255,0.5);
            border-radius:50%;width:14px;height:14px;display:flex;align-items:center;
            justify-content:center;font-size:8px;box-shadow:0 1px 4px rgba(0,0,0,0.5)">${emoji}</div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const phone = f.properties.phone ? `<br/>📞 ${f.properties.phone}` : "";
        const op = f.properties.operator ? `<br/>🏢 ${f.properties.operator}` : "";
        const marker = L.marker([lat, lng], { icon }).bindTooltip(
          `<div style="font-family:sans-serif;font-size:11px;min-width:140px">
            <strong>${f.properties.name}</strong><br/>
            <span style="text-transform:capitalize;color:#88aaff">${f.properties.facility_type.replace(/_/g, " ")}</span>
            ${phone}${op}
           </div>`,
          { direction: "top", offset: [0, -7] }
        );
        marker.addTo(map);
        facilityLayersRef.current.push(marker);
      }
    })();
    return () => { cancelled = true; };
  }, [facilities, showFacilities]);

  // ── Simulation Overlay ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      simLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      simLayersRef.current = [];
      if (!simulationResult) return;

      const L = await import("leaflet");
      if (cancelled) return;

      const { incident, radius_km, responders, mode } = simulationResult;

      const incidentIcon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${mode === "rain" ? "#4488ff" : "#ff4444"};
          border:3px solid white;box-shadow:0 0 12px ${mode === "rain" ? "#4488ff" : "#ff4444"},0 0 4px rgba(0,0,0,0.8)"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      const incidentMarker = L.marker([incident.lat, incident.lng], { icon: incidentIcon })
        .bindTooltip(`<strong>${mode === "rain" ? "Rain Simulation Centre" : "Crime Incident"}</strong>`,
          { permanent: false, direction: "top" });
      incidentMarker.addTo(map);
      simLayersRef.current.push(incidentMarker);

      if (mode === "rain" && radius_km) {
        const circle = L.circle([incident.lat, incident.lng], {
          radius: radius_km * 1000,
          color: "#4488ff", fillColor: "#4488ff", fillOpacity: 0.10,
          weight: 2, dashArray: "6 4",
        });
        circle.addTo(map);
        simLayersRef.current.push(circle);
      }

      for (const r of responders) {
        const color = RESPONDER_COLOR[r.type] || "#ffffff";
        const emoji = RESPONDER_EMOJI[r.type] || "📍";
        const isDelayed = r.status === "UNDER-SERVED";

        const line = L.polyline(
          [[r.facility_lat, r.facility_lng], [incident.lat, incident.lng]],
          { color, weight: 2.5, opacity: 0.85, dashArray: isDelayed ? "4 6" : "8 4" }
        );
        line.addTo(map);
        simLayersRef.current.push(line);

        const respIcon = L.divIcon({
          className: "",
          html: `<div style="background:${color}22;border:2px solid ${color};border-radius:6px;
            width:30px;height:30px;display:flex;align-items:center;justify-content:center;
            font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.6)">${emoji}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        const respMarker = L.marker([r.facility_lat, r.facility_lng], { icon: respIcon })
          .bindTooltip(
            `<div style="font-family:sans-serif;font-size:11px;min-width:160px">
              <strong>${emoji} ${r.name}</strong><br/>
              <span style="color:${color};text-transform:capitalize">${r.type}</span><br/>
              📏 ${r.distance_km} km &nbsp; ⏱ <strong>${r.eta_minutes} min</strong><br/>
              <span style="color:${isDelayed ? "#ff8888" : "#88ff88"}">${r.delay_warning}</span>
             </div>`,
            { direction: "top", offset: [0, -15] }
          );
        respMarker.addTo(map);
        simLayersRef.current.push(respMarker);
      }

      map.setView([incident.lat, incident.lng], Math.max(map.getZoom(), 13), { animate: true });
    })();
    return () => { cancelled = true; };
  }, [simulationResult]);

  // ── GeoJSON / KML Layer — red solid, all geometry types ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      geoJsonLayersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      geoJsonLayersRef.current = [];
      if (!geoJsonLayer || geoJsonLayer.features.length === 0) return;

      const L = await import("leaflet");
      if (cancelled) return;

      const dotIcon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;border-radius:50%;background:#ff2222;border:2px solid #cc0000;box-shadow:0 0 6px rgba(255,34,34,0.8)"></div>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      });

      const geoLayer = (L as any).geoJSON(
        { type: "FeatureCollection", features: geoJsonLayer.features },
        {
          style: () => ({
            color: "#ff2222", weight: 2, opacity: 0.9,
            fillColor: "#ff2222", fillOpacity: 0.35,
          }),
          pointToLayer: (_feat: any, latlng: any) => L.marker(latlng, { icon: dotIcon }),
          onEachFeature: (_feat: any, layer: any) => {
            const props = _feat.properties || {};
            const tooltipHtml = Object.entries(props).slice(0, 4)
              .map(([k, v]: [string, any]) => `<strong>${k}:</strong> ${v}`).join("<br/>") || "KML Feature";
            layer.bindTooltip(`<div style="font-size:11px">${tooltipHtml}</div>`, { sticky: true, direction: "top" });
          },
        }
      );
      geoLayer.addTo(map);
      geoJsonLayersRef.current.push(geoLayer);

      try {
        map.fitBounds(geoLayer.getBounds(), { padding: [30, 30], maxZoom: 14 });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [geoJsonLayer, mapInitialized]);

  const cursor =
    simulationMode === "rain" ? "crosshair" :
    simulationMode === "crime" ? "cell" :
    "crosshair";

  return (
    <div ref={containerRef} className="w-full h-full" style={{ cursor, background: "#0d1117" }} />
  );
}

export default dynamic(() => Promise.resolve(MapViewInner), { ssr: false });
