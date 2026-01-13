document.addEventListener('DOMContentLoaded', () => {
    // List of major cities
    const CITIES = [
        { "name": "New York", "lat": 40.7128, "lon": -74.0060 },
        { "name": "London", "lat": 51.5074, "lon": -0.1278 },
        { "name": "Tokyo", "lat": 35.6895, "lon": 139.6917 },
        { "name": "Paris", "lat": 48.8566, "lon": 2.3522 },
        { "name": "Beijing", "lat": 39.9042, "lon": 116.4074 },
        { "name": "New Delhi", "lat": 28.6139, "lon": 77.2090 },
        { "name": "Sydney", "lat": -33.8688, "lon": 151.2093 },
        { "name": "Sao Paulo", "lat": -23.5505, "lon": -46.6333 },
        { "name": "Cairo", "lat": 30.0444, "lon": 31.2357 },
        { "name": "Moscow", "lat": 55.7558, "lon": 37.6173 },
        { "name": "Los Angeles", "lat": 34.0522, "lon": -118.2437 },
        { "name": "Bangkok", "lat": 13.7563, "lon": 100.5018 },
        { "name": "Mexico City", "lat": 19.4326, "lon": -99.1332 },
        { "name": "Mumbai", "lat": 19.0760, "lon": 72.8777 },
        { "name": "Dubai", "lat": 25.2048, "lon": 55.2708 },
        { "name": "Singapore", "lat": 1.3521, "lon": 103.8198 },
        { "name": "Istanbul", "lat": 41.0082, "lon": 28.9784 },
        { "name": "Seoul", "lat": 37.5665, "lon": 126.9780 },
        { "name": "Shanghai", "lat": 31.2304, "lon": 121.4737 },
        { "name": "Berlin", "lat": 52.5200, "lon": 13.4050 }
    ];

    // Initialize Map
    const map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([20, 0], 2);

    // Add Dark Mode Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Fetch AQI Data
    fetchAQIData();

    // Search Functionality
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        const loadingElement = document.getElementById('loading');
        loadingElement.classList.remove('hidden');
        loadingElement.querySelector('p').textContent = `Searching for "${query}"...`;

        try {
            // 1. Geocode
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error('Location not found');
            }

            const location = geoData.results[0];
            const lat = location.latitude;
            const lon = location.longitude;
            const name = `${location.name}, ${location.country || ''}`;

            // 2. Get AQI
            const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;
            const aqiRes = await fetch(aqiUrl);
            const aqiData = await aqiRes.json();

            const aqi = aqiData.current.us_aqi;

            // Fly to location
            map.flyTo([lat, lon], 10, {
                animate: true,
                duration: 1.5
            });

            // Add marker
            renderMarkers([{
                name: name,
                lat: lat,
                lon: lon,
                aqi: aqi
            }]);

            // Clear input
            searchInput.value = '';

        } catch (error) {
            console.error('Search error:', error);
            alert(error.message);
        } finally {
            loadingElement.classList.add('hidden');
            loadingElement.querySelector('p').textContent = 'Fetching live data...';
        }
    }

    async function fetchAQIData() {
        const loadingElement = document.getElementById('loading');

        try {
            const lats = CITIES.map(c => c.lat).join(',');
            const lons = CITIES.map(c => c.lon).join(',');

            const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            // Parse Open-Meteo response (list of objects for multiple points)
            let results = [];
            if (Array.isArray(data)) {
                results = data.map((item, index) => ({
                    name: CITIES[index].name,
                    lat: CITIES[index].lat,
                    lon: CITIES[index].lon,
                    aqi: item.current.us_aqi
                }));
            } else {
                // Fallback if API behavior changes or single point (unlikely here)
                results = [{
                    name: CITIES[0].name,
                    lat: CITIES[0].lat,
                    lon: CITIES[0].lon,
                    aqi: data.current.us_aqi
                }];
            }

            renderMarkers(results);

            // Hide loading screen
            loadingElement.classList.add('hidden');

        } catch (error) {
            console.error('Error fetching AQI data:', error);
            loadingElement.innerHTML = '<p style="color: #ef4444;">Failed to load data. Please try again.</p>';
        }
    }

    function renderMarkers(cities) {
        cities.forEach(city => {
            if (city.aqi !== null && city.aqi !== undefined) {
                const color = getAQIColor(city.aqi);
                const status = getAQIStatus(city.aqi);

                // Create custom marker icon
                const customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px ${color}; border: 2px solid #fff;"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                // Add marker to map
                const marker = L.marker([city.lat, city.lon], { icon: customIcon }).addTo(map);

                // Bind popup
                const popupContent = `
                    <div class="popup-content">
                        <h3>${city.name}</h3>
                        <div class="aqi-value" style="color: ${color}">${city.aqi}</div>
                        <div class="aqi-status">${status}</div>
                    </div>
                `;

                marker.bindPopup(popupContent);
            }
        });
    }

    function getAQIColor(aqi) {
        if (aqi <= 50) return '#00e400'; // Good
        if (aqi <= 100) return '#ffff00'; // Moderate
        if (aqi <= 150) return '#ff7e00'; // Unhealthy for Sensitive Groups
        if (aqi <= 200) return '#ff0000'; // Unhealthy
        if (aqi <= 300) return '#8f3f97'; // Very Unhealthy
        return '#7e0023'; // Hazardous
    }

    function getAQIStatus(aqi) {
        if (aqi <= 50) return 'Good';
        if (aqi <= 100) return 'Moderate';
        if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
        if (aqi <= 200) return 'Unhealthy';
        if (aqi <= 300) return 'Very Unhealthy';
        return 'Hazardous';
    }
});
