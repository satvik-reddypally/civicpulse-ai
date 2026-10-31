'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GrievanceRecord } from '@/types/grievance';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LiveMapProps {
  grievances: GrievanceRecord[];
  selectedCoords: { lat: number; lon: number };
  onSelectCoords: (lat: number, lon: number) => void;
  onInspectTicket: (ticket: GrievanceRecord) => void;
}

function LocationSelector({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LiveMap({
  grievances,
  selectedCoords,
  onSelectCoords,
  onInspectTicket,
}: LiveMapProps) {
  const getPriorityColor = (priority: GrievanceRecord['priority_level']) => {
    switch (priority) {
      case 'CRITICAL':
        return '#ef4444';
      case 'HIGH':
        return '#f97316';
      case 'MEDIUM':
        return '#eab308';
      default:
        return '#22c55e';
    }
  };

  return (
    <div className="h-[440px] w-full rounded-xl overflow-hidden border border-slate-800 relative z-0">
      <MapContainer
        center={[selectedCoords.lat, selectedCoords.lon]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationSelector onSelect={onSelectCoords} />
        <MapUpdater center={[selectedCoords.lat, selectedCoords.lon]} />

        {/* Current Pin Selected by User for New Report */}
        <Marker position={[selectedCoords.lat, selectedCoords.lon]} icon={defaultIcon}>
          <Popup>
            <div className="text-xs font-semibold">
              Selected GPS Target
              <br />
              {selectedCoords.lat.toFixed(5)}, {selectedCoords.lon.toFixed(5)}
              <br />
              <span className="text-slate-500">(Click anywhere on map to move pin)</span>
            </div>
          </Popup>
        </Marker>

        {/* Live Grievances from Supabase */}
        {grievances.map((g) => (
          <CircleMarker
            key={g.id}
            center={[g.latitude, g.longitude]}
            radius={11}
            pathOptions={{
              color: getPriorityColor(g.priority_level),
              fillColor: getPriorityColor(g.priority_level),
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-1.5 max-w-[220px]">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-slate-900 text-white">
                  {g.priority_level} • {g.urgency_score}/100
                </span>
                <p className="font-bold text-sm text-slate-900 leading-tight">{g.title}</p>
                <p className="text-xs text-slate-600">{g.department}</p>
                <p className="text-[11px] text-slate-500">SLA: {g.sla_hours} Hours</p>
                <button
                  onClick={() => onInspectTicket(g)}
                  className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1 px-2 rounded"
                >
                  Inspect Live API Trace
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}