// made by larabi
'use client';

import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

type MapDoctor = {
  id: string;
  full_name: string | null;
  specialty: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Leaflet default icon configuration fix for React/Webpack
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Custom div icon for user location (stable and good looking)
const userIcon = L.divIcon({
  className: 'custom-user-location-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
      <div class="animate-ping" style="position: absolute; width: 100%; height: 100%; background-color: #ef4444; border-radius: 50%; opacity: 0.5;"></div>
      <div style="position: relative; width: 16px; height: 16px; background-color: #ef4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 10;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

function FlyToLocation({ location, zoom }: { location: { lat: number, lng: number } | null, zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], zoom, {
        animate: true,
        duration: 1.5
      });
    }
  }, [location, map, zoom]);

  return null;
}

export default function MapComponent({ 
  doctors, 
  userLocation,
  onDoctorClick,
  zoomControlPosition = 'topleft'
}: { 
  doctors: MapDoctor[], 
  userLocation: { lat: number, lng: number } | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDoctorClick?: (doctor: any) => void,
  zoomControlPosition?: 'topleft' | 'topright'
}) {
  const center = userLocation || { lat: 36.752887, lng: 3.042048 }; // Default Alger

  return (
    <MapContainer 
      center={[center.lat, center.lng] as [number, number]} 
      zoom={userLocation ? 13 : 6} 
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      scrollWheelZoom={true}
      zoomControl={false}
    >
      <ZoomControl position={zoomControlPosition} />
      <FlyToLocation location={userLocation} zoom={13} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Position de l'utilisateur (Rouge) */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng] as [number, number]} icon={userIcon}>
          <Popup>
            <strong className="text-red-600">Votre position actuelle</strong> 📍
          </Popup>
        </Marker>
      )}

      {/* Marqueurs des docteurs */}
      {doctors.map((doc) => doc.latitude && doc.longitude ? (
        <Marker 
          key={doc.id} 
          position={[doc.latitude, doc.longitude] as [number, number]} 
          icon={defaultIcon}
          eventHandlers={{
            click: () => {
              if (onDoctorClick) {
                onDoctorClick(doc);
              }
            }
          }}
        >
          {/* Ne pas afficher le popup si on redirige directement via onDoctorClick */}
          {!onDoctorClick && (
            <Popup>
              <div className="flex flex-col gap-1">
                 <strong className="text-sm">Dr. {doc.full_name}</strong>
                 <span className="text-xs text-slate-500">{doc.specialty}</span>
              </div>
            </Popup>
          )}
        </Marker>
      ) : null)}
    </MapContainer>
  );
}
// made by larabi
