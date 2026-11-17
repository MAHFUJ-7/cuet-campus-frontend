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

// Real CUET position from the official share link:
// https://maps.app.goo.gl/g62P1nrpznrhocxj6 → 22.462766, 91.971021 (Raozan, Chattogram).
const CUET_CENTER = [22.462766, 91.971021];

const CUET_GMAPS_URL = `https://www.google.com/maps/search/?api=1&query=${CUET_CENTER[0]},${CUET_CENTER[1]}`;

// Landmark coordinates sourced from OpenStreetMap's mapped CUET campus
// (Overpass API query around the center above) — real buildings, not
// placeholders. Keep names/positions in sync with OSM when re-checking.
const LOCATIONS = [
  // --- Academic buildings ---
  { name: 'Admin Building', position: [22.46208, 91.972886], category: 'academic', icon: 'account_balance', description: 'CUET administrative building' },
  { name: 'CSE Department', position: [22.463827, 91.974026], category: 'academic', icon: 'computer', description: 'Computer Science & Engineering' },
  { name: 'Civil Department', position: [22.46247, 91.973714], category: 'academic', icon: 'construction', description: 'Civil Engineering department' },
  { name: 'EME Building', position: [22.46384, 91.973573], category: 'academic', icon: 'electrical_services', description: 'Electrical & Mechanical Engineering building' },
  { name: 'ME Workshop', position: [22.463707, 91.972882], category: 'academic', icon: 'settings', description: 'Mechanical engineering workshop' },
  { name: 'Pre-Engg. Building', position: [22.462477, 91.97248], category: 'academic', icon: 'domain', description: 'Pre-engineering academic building' },
  { name: 'East-West Gallery', position: [22.462194, 91.972462], category: 'academic', icon: 'meeting_room', description: 'Gallery connecting the academic buildings' },
  { name: 'IT Business Incubator', position: [22.460822, 91.972675], category: 'academic', icon: 'lightbulb', description: 'Sheikh Kamal IT Business Incubator' },
  { name: 'CUET Auditorium', position: [22.462015, 91.974151], category: 'academic', icon: 'slideshow', description: 'Central auditorium for events and seminars' },

  // --- Facilities ---
  { name: 'Central Library', position: [22.462347, 91.973181], category: 'facility', icon: 'local_library', description: 'CUET Central Library' },
  { name: 'Central Mosque', position: [22.462764, 91.970593], category: 'facility', icon: 'mosque', description: 'Campus central mosque' },
  { name: 'Medical Centre', position: [22.460819, 91.970792], category: 'facility', icon: 'local_hospital', description: 'CUET Medical Centre' },
  { name: 'TSC', position: [22.462423, 91.970527], category: 'facility', icon: 'group', description: 'Teachers–Students Centre' },
  { name: 'Canteen 3', position: [22.462782, 91.97456], category: 'facility', icon: 'restaurant', description: 'Main student canteen' },
  { name: 'Gymnasium', position: [22.464092, 91.969798], category: 'facility', icon: 'place', description: 'Indoor gymnasium near the central field' },
  { name: 'Central Field', position: [22.464924, 91.970241], category: 'facility', icon: 'place', description: 'Large open field of the campus' },
  { name: 'School & College', position: [22.464897, 91.969111], category: 'facility', icon: 'school', description: 'CUET School & College' },

  // --- Other landmarks ---
  { name: 'Main Gate & Bus Stop', position: [22.459848, 91.971047], category: 'other', icon: 'door_front', description: 'Main entrance on CUET Main Road' },
  { name: 'Goal Chattar', position: [22.461972, 91.97107], category: 'other', icon: 'hub', description: 'Central roundabout of the campus' },
  { name: 'Post Office', position: [22.46028, 91.971685], category: 'other', icon: 'mail', description: 'Campus post office' },
  { name: 'Shaheed Minar', position: [22.460185, 91.970702], category: 'other', icon: 'history_edu', description: 'Shaheed Minar memorial' },
  { name: 'CUET Lake', position: [22.461331, 91.971731], category: 'other', icon: 'map', description: 'Campus lake' },
  { name: 'Bangabandhu Mural', position: [22.462112, 91.970764], category: 'other', icon: 'image', description: 'Mural beside the central mosque' },
  { name: 'QK Hall', position: [22.462756, 91.969355], category: 'other', icon: 'home', description: 'Q.K. Hall student dormitory' },
  { name: 'Shahid Muhammad Shah Hall', position: [22.461576, 91.969472], category: 'other', icon: 'home', description: 'Student hall of residence' },
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
    // Fit the whole campus on screen; the landmark set spans ~1 km.
    map.fitBounds(L.latLngBounds(LOCATIONS.map((l) => l.position)), { padding: [40, 40], maxZoom: 16 });
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
        <a
          href={CUET_GMAPS_URL}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-label-md font-semibold text-primary shadow-md backdrop-blur transition-colors hover:bg-surface dark:text-primary-light"
        >
          <Icon name="open_in_new" size={16} />
          Directions
        </a>
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
