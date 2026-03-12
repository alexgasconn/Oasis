import { Fountain } from '../types';

/**
 * Fetches drinking water fountains from the OpenStreetMap Overpass API.
 * 
 * @param lat - Latitude of the center point
 * @param lng - Longitude of the center point
 * @param radius - Search radius in meters (default: 5000m / 5km)
 * @returns A promise that resolves to an array of Fountain objects
 */
export async function fetchFountainsAround(lat: number, lng: number, radius: number = 5000): Promise<Fountain[]> {
  // Overpass QL query to find nodes tagged with 'amenity=drinking_water' within the specified radius
  // [out:json] specifies the response format
  // [timeout:25] sets a 25-second timeout to prevent hanging requests
  const query = `
    [out:json][timeout:25];
    node["amenity"="drinking_water"](around:${radius},${lat},${lng});
    out body;
  `;
  
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map the raw OSM elements to our internal Fountain interface
    return data.elements.map((el: any) => {
      // Determine potability based on explicit OSM tags
      let potable: 'yes' | 'no' | 'unknown' = 'unknown';
      if (el.tags?.drinking_water === 'yes') potable = 'yes';
      if (el.tags?.drinking_water === 'no') potable = 'no';
      
      // Heuristic: If it's explicitly tagged as amenity=drinking_water, 
      // it's generally safe to assume it's potable unless stated otherwise.
      if (potable === 'unknown' && el.tags?.amenity === 'drinking_water') {
        potable = 'yes';
      }

      return {
        id: el.id.toString(),
        lat: el.lat,
        lng: el.lon,
        // Check if it's a natural spring vs an urban fountain
        type: el.tags?.natural === 'spring' ? 'natural' : 'urban',
        potable: potable,
        // Default assumption for OSM data unless tagged as broken
        status: 'working', 
      };
    });
  } catch (error) {
    console.error("Error fetching from Overpass API:", error);
    // Return empty array on failure so the app doesn't crash, 
    // it will just show "No fountains found"
    return [];
  }
}
