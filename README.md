# Oasis 💧

Oasis is a web application designed to help runners, cyclists, hikers, and travelers find nearby water fountains and natural springs. Whether you're exploring a new city or out on a long trail, Oasis ensures you stay hydrated by locating the closest drinking water points around you.

## Features

- **Interactive Map & List Views**: Explore water sources on a dynamic map or view them in a sorted list based on distance.
- **Real-Time Geolocation**: Automatically tracks your current location to find the nearest fountains.
- **Custom Search**: Tap anywhere on the map to search for water points around a specific location.
- **Potability Indicators**: Clear badges indicating if a water source is safe to drink (Drinking Water, Not Drinkable, Unknown Potability, or Natural Spring).
- **Hydration Status**: A dynamic indicator that tells you if you are in a safe zone (close to water) or if you should exercise caution.
- **Smart Compass**: A built-in compass widget that points directly to the nearest fountain from your location.
- **Navigation Integration**: One-click routing to any fountain using Google Maps.
- **Customizable Experience**:
  - **Map Styles**: Choose between Standard, Satellite, Terrain, Light, and Dark modes.
  - **Search Radius**: Adjust the search area from 100 meters up to 20 kilometers.
  - **Units**: Toggle between Metric (km/m) and Imperial (mi/ft) systems.
  - **Multi-Language**: Available in English, Spanish, and Catalan.

## How It Works

Oasis uses the **Overpass API** to query real-time data from **OpenStreetMap (OSM)**. It searches for amenities tagged as `drinking_water` or natural features tagged as `spring`, and retrieves their coordinates and potability metadata.

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet & React-Leaflet
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Data Source**: OpenStreetMap (Overpass API)

## Live Demo

You can try out Oasis directly in your browser without installing anything!

👉 **[oasis-search.vercel.app](https://oasis-search.vercel.app)**

## Contributing

Data accuracy relies on the OpenStreetMap community. If you find a missing fountain or incorrect potability information, consider contributing directly to [OpenStreetMap](https://www.openstreetmap.org/) to help improve the map for everyone!

## License

This project is open-source and available under the MIT License.
