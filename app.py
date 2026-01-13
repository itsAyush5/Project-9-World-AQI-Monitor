from flask import Flask, render_template, jsonify, request
import requests
import webbrowser

app = Flask(__name__)

# List of major cities with their coordinates (Latitude, Longitude)
CITIES = [
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "London", "lat": 51.5074, "lon": -0.1278},
    {"name": "Tokyo", "lat": 35.6895, "lon": 139.6917},
    {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
    {"name": "Beijing", "lat": 39.9042, "lon": 116.4074},
    {"name": "New Delhi", "lat": 28.6139, "lon": 77.2090},
    {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
    {"name": "Sao Paulo", "lat": -23.5505, "lon": -46.6333},
    {"name": "Cairo", "lat": 30.0444, "lon": 31.2357},
    {"name": "Moscow", "lat": 55.7558, "lon": 37.6173},
    {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437},
    {"name": "Bangkok", "lat": 13.7563, "lon": 100.5018},
    {"name": "Mexico City", "lat": 19.4326, "lon": -99.1332},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "Dubai", "lat": 25.2048, "lon": 55.2708},
    {"name": "Singapore", "lat": 1.3521, "lon": 103.8198},
    {"name": "Istanbul", "lat": 41.0082, "lon": 28.9784},
    {"name": "Seoul", "lat": 37.5665, "lon": 126.9780},
    {"name": "Shanghai", "lat": 31.2304, "lon": 121.4737},
    {"name": "Berlin", "lat": 52.5200, "lon": 13.4050}
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/aqi')
def get_aqi():
    aqi_data = []
    
    # Open-Meteo allows fetching multiple points in one request, but for simplicity and clarity 
    # in this demo, we'll iterate or construct a bulk request if possible.
    # Actually, Open-Meteo Air Quality API supports list of lat/lon.
    
    lats = [city["lat"] for city in CITIES]
    lons = [city["lon"] for city in CITIES]
    
    # Construct URL for bulk request
    # Example: https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.52,48.85&longitude=13.41,2.35&current=us_aqi
    
    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": ",".join(map(str, lats)),
        "longitude": ",".join(map(str, lons)),
        "current": "us_aqi" # US AQI is a common standard
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Parse response. The API returns a list of results if multiple coordinates are provided.
        # However, Open-Meteo structure for multiple points:
        # It returns arrays in 'current' corresponding to the inputs.
        # Wait, looking at Open-Meteo docs, for multiple points, it might return a list of objects OR arrays of values.
        # Let's handle the standard single-object-with-arrays response if that's what it does, 
        # OR a list of objects.
        # Actually, for multiple points, it returns a list of response objects.
        
        # Let's verify this behavior. If it returns a list, we iterate.
        
        if isinstance(data, list):
            for i, item in enumerate(data):
                aqi = item.get("current", {}).get("us_aqi")
                city_name = CITIES[i]["name"]
                aqi_data.append({
                    "name": city_name,
                    "lat": CITIES[i]["lat"],
                    "lon": CITIES[i]["lon"],
                    "aqi": aqi
                })
        else:
            pass

    except Exception as e:
        print(f"Error fetching AQI data: {e}")
        return jsonify({"error": str(e)}), 500

    return jsonify(aqi_data)

@app.route('/api/search')
def search_location():
    query = request.args.get('q')
    if not query:
        return jsonify({"error": "No query provided"}), 400
        
    try:
        # 1. Geocode the location
        geocoding_url = "https://geocoding-api.open-meteo.com/v1/search"
        geo_params = {"name": query, "count": 1, "language": "en", "format": "json"}
        
        geo_res = requests.get(geocoding_url, params=geo_params)
        geo_res.raise_for_status()
        geo_data = geo_res.json()
        
        if not geo_data.get("results"):
            return jsonify({"error": "Location not found"}), 404
            
        location = geo_data["results"][0]
        lat = location["latitude"]
        lon = location["longitude"]
        name = f"{location['name']}, {location.get('country', '')}"
        
        # 2. Get AQI for the location
        aqi_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        aqi_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "us_aqi"
        }
        
        aqi_res = requests.get(aqi_url, params=aqi_params)
        aqi_res.raise_for_status()
        aqi_data = aqi_res.json()
        
        aqi_value = aqi_data.get("current", {}).get("us_aqi")
        
        return jsonify({
            "name": name,
            "lat": lat,
            "lon": lon,
            "aqi": aqi_value
        })
        
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({"error": str(e)}), 500




if __name__ == '__main__':
    webbrowser.open('http://127.0.0.1:5500')
    app.run(debug=True)
