import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Vite bundling)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  color?: "primary" | "danger" | "success" | "muted";
  icon?: L.Icon | L.DivIcon;
};

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polyline?: [number, number][];
  height?: string;
  className?: string;
  onMarkerClick?: (id: string) => void;
  followLast?: boolean;
  scrollWheelZoom?: boolean;
};

const colorMap: Record<NonNullable<MapMarker["color"]>, string> = {
  primary: "#3b82f6",
  danger: "#ef4444",
  success: "#22c55e",
  muted: "#6b7280",
};

const makeColorIcon = (color: string) =>
  L.divIcon({
    className: "leaflet-color-marker",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const Recenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

export const LeafletMap = ({
  center,
  zoom = 14,
  markers = [],
  polyline,
  height = "300px",
  className = "",
  onMarkerClick,
  followLast = false,
  scrollWheelZoom = true,
}: Props) => {
  return (
    <div className={`overflow-hidden rounded-lg border border-hairline ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={scrollWheelZoom}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={m.icon ?? (m.color ? makeColorIcon(colorMap[m.color]) : undefined)}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
          >
            {(m.title || m.description) && (
              <Popup>
                {m.title && <div className="font-medium text-sm">{m.title}</div>}
                {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
              </Popup>
            )}
          </Marker>
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.8 }} />
        )}
        {followLast && <Recenter center={center} />}
      </MapContainer>
    </div>
  );
};
