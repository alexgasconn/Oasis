/**
 * Defines the environment or context where the fountain is located.
 * - 'urban': Standard city street fountain
 * - 'park': Located within a park or green space
 * - 'natural': A natural spring or source
 * - 'sport': Located near sports facilities
 */
export type FountainType = 'urban' | 'park' | 'natural' | 'sport';

/**
 * Indicates whether the water is safe for human consumption.
 * - 'yes': Explicitly marked as safe to drink
 * - 'no': Explicitly marked as not safe to drink
 * - 'unknown': Potability is not explicitly known/tagged
 */
export type PotableStatus = 'yes' | 'no' | 'unknown';

/**
 * Represents the current operational state of the fountain.
 * - 'working': Currently operational and providing water
 * - 'closed': Temporarily or permanently closed
 * - 'dry': No water flowing
 * - 'maintenance': Currently under repair
 */
export type FountainStatus = 'working' | 'closed' | 'dry' | 'maintenance';

/**
 * Core interface representing a water fountain entity in the application.
 */
export interface Fountain {
  /** Unique identifier for the fountain (usually the OSM node ID) */
  id: string;
  
  /** Latitude coordinate */
  lat: number;
  
  /** Longitude coordinate */
  lng: number;
  
  /** The type/environment of the fountain */
  type: FountainType;
  
  /** Whether the water is safe to drink */
  potable: PotableStatus;
  
  /** The operational status of the fountain */
  status: FountainStatus;
}
