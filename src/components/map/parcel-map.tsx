import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Satellite, Map as MapIcon } from "lucide-react";

type ParcelGeometry = { type: "Polygon"; coordinates: number[][][] };

export function ParcelMap({
  parcels,
  onPolygonCreated,
  editGeometry,
  onDeleteParcel,
}: {
  parcels: { id: string; name: string; geometry?: ParcelGeometry | null; latitude?: number; longitude?: number; area_m2: number }[];
  onPolygonCreated?: (geo: ParcelGeometry, area: number) => void;
  editGeometry?: ParcelGeometry | null;
  onDeleteParcel?: (parcel: { id: string; name: string }) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const drawnRef = useRef<L.FeatureGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const onPolygonRef = useRef(onPolygonCreated);
  onPolygonRef.current = onPolygonCreated;

  function buildPopup(parcel: { id: string; name: string; area_m2: number }) {
    const container = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = parcel.name;
    const area = document.createElement("div");
    area.textContent = `${(parcel.area_m2 / 10000).toFixed(2)} ha`;
    container.append(title, area);
    if (onDeleteParcel) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Eliminar parcela";
      remove.className = "mt-2 text-xs text-red-600 underline";
      remove.onclick = () => onDeleteParcel({ id: parcel.id, name: parcel.name });
      container.append(remove);
    }
    return container;
  }

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map("parcel-map", { center: [-16.5, -68.15], zoom: 7, zoomControl: true });
    const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    tileRef.current = tile;
    mapRef.current = map;

    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);
    drawnRef.current = drawn;

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawn },
      draw: { polygon: { allowIntersection: false, showArea: true }, circle: false, circlemarker: false, rectangle: false, marker: false, polyline: false },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawn.clearLayers();
      drawn.addLayer(e.layer);
      const geo = e.layer.toGeoJSON() as ParcelGeometry;
      const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
      onPolygonRef.current?.(geo, Math.round(area * 100) / 100);
    });

    map.on(L.Draw.Event.EDITED, () => {
      drawn.eachLayer((layer: any) => {
        const geo = layer.toGeoJSON() as ParcelGeometry;
        const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
        onPolygonRef.current?.(geo, Math.round(area * 100) / 100);
      });
    });

    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const bounds = L.latLngBounds([]);
    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);

    parcels.forEach((p) => {
      if (p.geometry?.coordinates) {
        const coords = p.geometry.coordinates[0].map((c) => [c[1], c[0]] as [number, number]);
        const poly = L.polygon(coords, { color: "#22c55e", fillOpacity: 0.2, weight: 2 });
        poly.bindPopup(buildPopup(p));
        drawn.addLayer(poly);
        coords.forEach((c) => bounds.extend(c));
      } else if (p.latitude && p.longitude) {
        const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html: `<div class="size-4 bg-primary rounded-full border-2 border-white shadow" />`, className: "" }) });
        m.bindPopup(buildPopup(p));
        drawn.addLayer(m);
        bounds.extend([p.latitude, p.longitude]);
      }
    });

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
    return () => { map.removeLayer(drawn); };
  }, [parcels, mapReady, onDeleteParcel]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !editGeometry) return;
    if (!editGeometry.coordinates?.[0]?.length) return;
    const map = mapRef.current;
    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);
    const coords = editGeometry.coordinates[0].map((c) => [c[1], c[0]] as [number, number]);
    const poly = L.polygon(coords, { color: "#3b82f6", fillOpacity: 0.3, weight: 2 });
    drawn.addLayer(poly);
    map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    return () => { map.removeLayer(drawn); };
  }, [editGeometry, mapReady]);

  const toggleSatellite = useCallback(() => {
    if (!mapRef.current || !tileRef.current) return;
    mapRef.current.removeLayer(tileRef.current);
    const url = isSatellite
      ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const attr = isSatellite ? "&copy; OpenStreetMap contributors" : "&copy; Esri";
    tileRef.current = L.tileLayer(url, { attribution: attr, maxZoom: 19 }).addTo(mapRef.current);
    setIsSatellite(!isSatellite);
  }, [isSatellite]);

  const handleDeletePolygon = () => {
    if (drawnRef.current) drawnRef.current.clearLayers();
    onPolygonRef.current?.({ type: "Polygon", coordinates: [] }, 0);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-primary" />
          Mapa de parcelas
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{parcels.length} parcelas</Badge>
          <Button variant="ghost" size="icon" className="size-7" title={isSatellite ? "Vista calle" : "Vista satélite"} onClick={toggleSatellite}>
            {isSatellite ? <MapIcon className="size-4" /> : <Satellite className="size-4" />}
          </Button>
          {onPolygonCreated && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleDeletePolygon}>Clear</Button>
          )}
        </div>
      </div>
      <div id="parcel-map" className="h-[400px] w-full" />
    </Card>
  );
}

export function polygonToText(geo: ParcelGeometry | null | undefined): string {
  if (!geo?.coordinates?.[0]?.length) return "";
  return geo.coordinates[0].map((c) => `${c[1].toFixed(5)},${c[0].toFixed(5)}`).join("; ");
}
