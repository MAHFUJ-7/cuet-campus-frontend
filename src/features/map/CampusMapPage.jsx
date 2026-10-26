// Campus Map — web adaptation of campus_map_screen.dart.
// Flutter used Google Maps; the web build uses Leaflet + OpenStreetMap
// (no API key required).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Card,
  Icon,
  PageHeader,
  PageShell,
} from '../../components/ui/index.jsx';

const CUET_CENTER = [22.3698, 91.7834];

const LOCATIONS = [
  { name: 'Admin Building', position: [22.3698, 91.7834], category: 'academic', icon: 'account_balance', description: 'Main administrative building' },
  { name: 'Library', position: [22.3705, 91.7828], category: 'facility', icon: 'local_library', description: 'Central library with study spaces' },
  { name: 'CSE Department', position: [22.3688, 91.7842], category: 'academic', icon: 'computer', description: 'Computer Science & Engineering' },
  { name: 'EEE Department', position: [22.3692, 91.7838], category: 'academic', icon: 'electrical_services', description: 'Electrical & Electronic Engineering' },
  { name: 'Civil Department', position: [22.3702, 91.7845], category: 'academic', icon: 'construction', description: 'Civil Engineering' },
  { name: 'Mechanical Department', position: [22.3708, 91.7832], category: 'academic', icon: 'settings', description: 'Mechanical Engineering' },
  { name: 'Central Canteen', position: [22.3695, 91.7830], category: 'facility', icon: 'restaurant', description: 'Main student canteen' },
  { name: 'Medical Center', position: [22.3710, 91.7825], category: 'facility', icon: 'local_hospital', description: 'Campus medical facility' },
  { name: 'Student Center', position: [22.3690, 91.7835], category: 'facility', icon: 'group', description: 'Student activities center' },
  { name: 'Mosque', position: [22.3698, 91.7840], category: 'facility', icon: 'mosque', description: 'Campus mosque' },
  { name: 'Main Gate', position: [22.3680, 91.7834], category: 'other', icon: 'door_front', description: 'Main entrance gate' },
  { name: 'Parking', position: [22.3685, 91.7828], category: 'other', icon: 'local_parking', description: 'Student parking area' },
];

const CATEGORY_COLORS = {
  academic: '#2563EB', // blue
  facility: '#16A34A', // green
  other: '#DC2626', // red
};

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Locations' },
  { value: 'academic', label: 'Academic' },
  { value: 'facility', label: 'Facilities' },
  { value: 'other', label: 'Other' },
];

export default function CampusMapPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const groupRef = useRef(null);
  const [category, setCategory] = useState('all');
  const [mapReady, setMapReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true });
    map.setView(CUET_CENTER, 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    setMapReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      groupRef.current = null;
    };
  }, []);

  // Rebuild the marker layer whenever the category filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (groupRef.current) groupRef.current.remove();
    const group = L.layerGroup();
    markersRef.current = {};

    const visible = category === 'all' ? LOCATIONS : LOCATIONS.filter((l) => l.category === category);
    for (const location of visible) {
      const marker = L.circleMarker(location.position, {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: CATEGORY_COLORS[location.category] ?? CATEGORY_COLORS.other,
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<strong>${location.name}</strong><br/><span style="font-size:12px">${location.description}</span>`
      );
      marker.addTo(group);
      markersRef.current[location.name] = marker;
    }
    group.addTo(map);
    groupRef.current = group;
  }, [category, mapReady]);

  const focusLocation = (location) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(location.position, 18, { duration: 0.6 });
    window.setTimeout(() => markersRef.current[location.name]?.openPopup(), 650);
  };

  const visible = category === 'all' ? LOCATIONS : LOCATIONS.filter((l) => l.category === category);

  return (
    <PageShell className="max-w-5xl">
      <PageHeader title="Campus Map" onBack={() => navigate(-1)} />

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[420px] w-full overflow-hidden rounded-2xl border border-outline lg:h-[520px]"
        />
        <Card className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[240px]">
          <p className="text-title-sm font-bold text-ink">CUET Campus</p>
          <p className="text-body-sm text-ink-muted">Tap markers for location details</p>
        </Card>
      </div>

      {/* Category filter */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((option) => {
          const selected = category === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(option.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-outline bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Location cards */}
      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-2">
        {visible.map((location) => (
          <button
            key={location.name}
            type="button"
            onClick={() => focusLocation(location)}
            className="w-[150px] shrink-0 rounded-2xl border border-outline bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-surface-variant"
          >
            <Icon
              name={location.icon}
              size={22}
              className="text-primary dark:text-primary-light"
            />
            <p className="mt-2 line-clamp-2 text-label-md font-semibold text-ink">{location.name}</p>
            <p className="mt-0.5 line-clamp-2 text-label-sm text-ink-muted">{location.description}</p>
          </button>
        ))}
      </div>
    </PageShell>
  );
}
