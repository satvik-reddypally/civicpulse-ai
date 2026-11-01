'use client';

import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GrievanceRecord } from '@/types/grievance';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LiveMapProps {
  grievances: GrievanceRecord[];
  selectedLat: number;
  selectedLon: number;
  onSelectLocation: (lat: number, lon: number) => void;
}

function LocationPicker({
  onSelectLocation,
}: {
  onSelectLocation: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onSelectLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);
  return null;
}

export default function LiveMap({
  grievances,
  selectedLat,
  selectedLon,
  onSelectLocation,
}: LiveMapProps) {
  const getMarkerColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return '#dc2626';
      case 'HIGH':
        return '#f97316';
      case 'MEDIUM':
        return '#eab308';
      default:
        return '#0d9488';
    }
  };

  return (
    <MapContainer
      center={[selectedLat, selectedLon]}
      zoom={13}
      scrollWheelZoom={true}
      className="w-full h-full min-h-[560px] z-10"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationPicker onSelectLocation={onSelectLocation} />
      <MapRecenter lat={selectedLat} lon={selectedLon} />

      <Marker position={[selectedLat, selectedLon]} icon={defaultIcon}>
        <Popup>
          <div className="text-xs font-bold text-slate-900">Selected Hazard Pin</div>
          <div className="text-[11px] text-slate-600 font-mono">
            {selectedLat.toFixed(5)}, {selectedLon.toFixed(5)}
          </div>
        </Popup>
      </Marker>

      {grievances.map((g) => (
        <CircleMarker
          key={g.id}
          center={[g.latitude, g.longitude]}
          radius={10}
          pathOptions={{
            color: getMarkerColor(g.priority_level),
            fillColor: getMarkerColor(g.priority_level),
            fillOpacity: 0.75,
            weight: 2,
          }}
        >
          <Popup>
            <div className="space-y-1 max-w-[200px]">
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">
                {g.priority_level} • {g.urgency_score}/100
              </span>
              <p className="text-xs font-bold text-slate-900 mt-1">{g.title}</p>
              <p className="text-[11px] text-slate-600">{g.responsible_department}</p>
              <p className="text-[10px] text-teal-700 font-bold">
                Statutory SLA: {g.statutory_sla_hours}h
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}