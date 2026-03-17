/**
 * Frontend geocoding service using Nominatim
 * Converts lat/lng to human-readable address
 */
const cache = new Map();

export async function reverseGeocode(lat, lng) {
  const key = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`, {
      headers: { "User-Agent": "HealthcarePlatform/4.0" }
    });
    const data = await res.json();
    const a = data.address || {};
    const road = a.road || a.pedestrian || a.highway || "";
    const area = a.neighbourhood || a.suburb || a.village || "";
    const city = a.city || a.town || a.municipality || "";
    const state = a.state || "";
    const short = [road, area, city].filter(Boolean).slice(0,2).join(", ") || city || `${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
    const full  = [road, area, city, state].filter(Boolean).join(", ");
    const result = { short, full, city, state, road, area, postcode: a.postcode||"" };
    cache.set(key, result);
    return result;
  } catch(e) {
    return { short:`${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`, full:"", city:"", state:"" };
  }
}

export async function forwardGeocode(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&accept-language=en`, {
      headers: { "User-Agent": "HealthcarePlatform/4.0" }
    });
    const data = await res.json();
    return data.map(d => ({ lat:parseFloat(d.lat), lng:parseFloat(d.lon), display_name:d.display_name, short:d.display_name.split(",").slice(0,2).join(",") }));
  } catch(e) { return []; }
}
