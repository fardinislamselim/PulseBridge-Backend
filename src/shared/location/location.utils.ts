/**
 * Geographic and location utility functions for Haversine distance and bounding box calculations.
 */

export const EARTH_RADIUS_KM = 6371;

/**
 * Validates whether latitude and longitude are valid decimal degrees.
 */
export const isValidCoordinate = (lat?: number | null, lon?: number | null): boolean => {
  if (lat == null || lon == null || typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }
  if (isNaN(lat) || isNaN(lon)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

/**
 * Calculates great-circle distance between two geographic coordinates using the standard Haversine formula.
 * Returns distance in kilometers (rounded to 2 decimal places).
 * Handles same coordinates (0 km), different hemispheres, zero coordinates, and invalid values.
 */
export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return NaN;
  }

  // Exact same coordinates
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
};

/**
 * Calculates a bounding box (minLat, maxLat, minLng, maxLng) around a center point for a given radius.
 * Enables high-performance database-side pre-filtering before exact Haversine calculation.
 */
export const getBoundingBox = (
  latitude: number,
  longitude: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } => {
  const kmPerLatDegree = 111.045;
  const latDelta = radiusKm / kmPerLatDegree;

  const minLat = Math.max(-90, latitude - latDelta);
  const maxLat = Math.min(90, latitude + latDelta);

  // Avoid division by zero at poles
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  const kmPerLngDegree = Math.abs(cosLat) > 0.000001 ? kmPerLatDegree * Math.abs(cosLat) : kmPerLatDegree;
  const lngDelta = radiusKm / kmPerLngDegree;

  const minLng = Math.max(-180, longitude - lngDelta);
  const maxLng = Math.min(180, longitude + lngDelta);

  return { minLat, maxLat, minLng, maxLng };
};
