// ============================================
//  UBER CLONE — Enhanced Ride Booking Script
// ============================================

// --- Map Setup ---
const map = L.map('map', {
    zoomControl: false
}).setView([22.57, 88.36], 13);

// Add zoom control to top-right
L.control.zoom({ position: 'topright' }).addTo(map);

// Dark-styled tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
}).addTo(map);

// --- State ---
let routeLayer;
let userLat, userLon;
let driverMarker;
let driverInterval;
let selectedRideIndex = null;
let currentDistance = 0;
let pickupMarker, destMarker;

// --- Car Types (realistic Uber categories) ---
const carTypes = [
    {
        name: "Bike",
        icon: "🏍️",
        base: 20,
        rate: 5,
        desc: "Affordable bike rides",
        eta: () => randomETA(2, 5),
        capacity: "1 person"
    },
    {
        name: "UberGo",
        icon: "🚗",
        base: 50,
        rate: 9,
        desc: "Affordable compact rides",
        eta: () => randomETA(3, 8),
        capacity: "4 seats"
    },
    {
        name: "Sedan",
        icon: "🚘",
        base: 70,
        rate: 12,
        desc: "Comfortable sedans",
        eta: () => randomETA(4, 10),
        capacity: "4 seats"
    },
    {
        name: "UberXL",
        icon: "🚙",
        base: 110,
        rate: 18,
        desc: "Extra space for groups",
        eta: () => randomETA(6, 14),
        capacity: "6 seats"
    },
    {
        name: "Premier",
        icon: "✨",
        base: 160,
        rate: 25,
        desc: "Premium luxury rides",
        eta: () => randomETA(8, 16),
        capacity: "4 seats"
    }
];

// --- Driver names for realistic feel ---
const driverNames = [
    "Rajesh K.", "Amit S.", "Suresh M.", "Vikram P.", "Deepak R.",
    "Manoj T.", "Ravi G.", "Sanjay B.", "Arjun D.", "Prasad N."
];

const carModels = [
    "Maruti Swift", "Hyundai i20", "Honda City", "Toyota Innova",
    "Maruti Dzire", "Hyundai Verna", "Kia Seltos", "MG Hector"
];

// --- Utilities ---
function randomETA(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePlate() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const state = "WB";
    const num1 = String(Math.floor(Math.random() * 99)).padStart(2, '0');
    const letter = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)];
    const num2 = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `${state} ${num1} ${letter} ${num2}`;
}

// --- Greeting based on time ---
function setGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    if (hour < 12) {
        greetingEl.textContent = 'Good morning ☀️';
    } else if (hour < 17) {
        greetingEl.textContent = 'Good afternoon 🌤️';
    } else if (hour < 21) {
        greetingEl.textContent = 'Good evening 🌆';
    } else {
        greetingEl.textContent = 'Good night 🌙';
    }
}
setGreeting();

// --- Custom map markers ---
function createCustomIcon(emoji, size = 36) {
    return L.divIcon({
        html: `<div style="
            font-size: ${size}px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            line-height: 1;
        ">${emoji}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: 'custom-marker'
    });
}

// --- GPS ---
function useGPS() {
    const gpsBtn = document.getElementById('gps-btn');
    gpsBtn.classList.add('active');

    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;

        document.getElementById("pickup").value = `${userLat.toFixed(6)}, ${userLon.toFixed(6)}`;

        if (pickupMarker) map.removeLayer(pickupMarker);
        pickupMarker = L.marker([userLat, userLon], {
            icon: createCustomIcon('📍', 32)
        }).addTo(map).bindPopup("Your location").openPopup();

        map.setView([userLat, userLon], 15);

        setTimeout(() => gpsBtn.classList.remove('active'), 1500);
    }, err => {
        gpsBtn.classList.remove('active');
        alert("Unable to access your location. Please enable GPS.");
    });
}

// --- Geocode ---
async function geocode(place) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`);
    const data = await res.json();
    if (!data || data.length === 0) {
        throw new Error(`Could not find location: ${place}`);
    }
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

// --- Quick Fill ---
function quickFill(label) {
    document.getElementById("destination").value = label;
    document.getElementById("destination").focus();
}

// --- Find Route ---
async function findRoute() {
    const pickupInput = document.getElementById("pickup").value.trim();
    const destInput = document.getElementById("destination").value.trim();

    if (!pickupInput || !destInput) {
        shakeElement(document.querySelector('.search-card'));
        return;
    }

    // Show loading
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
        let pickup, dest;

        if (pickupInput.includes(",") && !isNaN(pickupInput.split(",")[0])) {
            pickup = pickupInput.split(",").map(Number);
        } else {
            pickup = await geocode(pickupInput);
        }

        if (destInput.includes(",") && !isNaN(destInput.split(",")[0])) {
            dest = destInput.split(",").map(Number);
        } else {
            dest = await geocode(destInput);
        }

        userLat = parseFloat(pickup[0]);
        userLon = parseFloat(pickup[1]);

        // Add markers
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (destMarker) map.removeLayer(destMarker);

        pickupMarker = L.marker([pickup[0], pickup[1]], {
            icon: createCustomIcon('🟢', 28)
        }).addTo(map).bindPopup("Pickup");

        destMarker = L.marker([dest[0], dest[1]], {
            icon: createCustomIcon('📍', 32)
        }).addTo(map).bindPopup("Destination");

        // Get route
        const url = `https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.routes || data.routes.length === 0) {
            throw new Error("No route found");
        }

        const route = data.routes[0];
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

        if (routeLayer) map.removeLayer(routeLayer);

        // Animated route line
        routeLayer = L.polyline(coords, {
            color: '#ffffff',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: null
        }).addTo(map);

        // Add route shadow
        L.polyline(coords, {
            color: '#276ef1',
            weight: 8,
            opacity: 0.4,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [80, 80] });

        currentDistance = (route.distance / 1000).toFixed(2);
        const duration = Math.round(route.duration / 60);

        // Hide loading, show ride options
        document.getElementById('loading-overlay').style.display = 'none';
        showRideOptions(currentDistance, duration);

    } catch (error) {
        document.getElementById('loading-overlay').style.display = 'none';
        alert("Error: " + error.message);
    }
}

// --- Shake animation for validation ---
function shakeElement(el) {
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'shake 0.5s ease';
    setTimeout(() => el.style.animation = '', 500);
}

// Add shake keyframes dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
    }
`;
document.head.appendChild(shakeStyle);

// --- Show Ride Options ---
function showRideOptions(distance, duration) {
    selectedRideIndex = null;
    document.getElementById('confirm-ride-btn').disabled = true;

    // Update route summary
    document.getElementById('route-summary').innerHTML = `
        <span class="route-badge">📏 ${distance} km</span>
        <span class="route-badge">⏱️ ~${duration} min</span>
    `;

    // Generate ride cards
    const ridesList = document.getElementById('rides-list');
    ridesList.innerHTML = '';

    carTypes.forEach((car, index) => {
        const fare = Math.round(car.base + distance * car.rate);
        const surgeMultiplier = Math.random() > 0.7 ? (1 + Math.random() * 0.5).toFixed(1) : null;
        const finalFare = surgeMultiplier ? Math.round(fare * surgeMultiplier) : fare;
        const eta = car.eta();

        const card = document.createElement('div');
        card.className = 'ride-card';
        card.id = `ride-card-${index}`;
        card.onclick = () => selectRide(index);

        card.innerHTML = `
            <div class="ride-icon">${car.icon}</div>
            <div class="ride-details">
                <div class="ride-name">${car.name}</div>
                <div class="ride-eta">
                    <span class="eta-badge">${eta} min</span>
                    <span>· ${car.capacity}</span>
                </div>
                <div class="ride-desc">${car.desc}</div>
            </div>
            <div>
                <div class="ride-fare">₹${finalFare}</div>
                ${surgeMultiplier ? `<div class="ride-fare-original">₹${fare}</div>` : ''}
            </div>
        `;

        card.dataset.fare = finalFare;
        card.dataset.eta = eta;
        ridesList.appendChild(card);
    });

    // Switch view
    document.getElementById('search-section').style.display = 'none';
    document.getElementById('ride-options').style.display = 'block';
    document.getElementById('booking-confirmed').style.display = 'none';
}

// --- Select Ride ---
function selectRide(index) {
    selectedRideIndex = index;

    // Update visual
    document.querySelectorAll('.ride-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });

    document.getElementById('confirm-ride-btn').disabled = false;
    document.getElementById('confirm-ride-btn').textContent =
        `Confirm ${carTypes[index].name} · ₹${document.getElementById(`ride-card-${index}`).dataset.fare}`;
}

// --- Confirm Selected Ride ---
function confirmSelectedRide() {
    if (selectedRideIndex === null) return;

    const car = carTypes[selectedRideIndex];
    const card = document.getElementById(`ride-card-${selectedRideIndex}`);
    const fare = card.dataset.fare;
    const eta = card.dataset.eta;

    bookRide(selectedRideIndex, fare, eta);
}

// --- Book Ride ---
function bookRide(index, fare, eta) {
    const car = carTypes[index];
    const driverName = driverNames[Math.floor(Math.random() * driverNames.length)];
    const carModel = carModels[Math.floor(Math.random() * carModels.length)];
    const plate = generatePlate();
    const rating = (4.5 + Math.random() * 0.5).toFixed(1);
    const trips = Math.floor(500 + Math.random() * 4500);

    // Driver card
    document.getElementById('driver-card').innerHTML = `
        <div class="driver-info-row">
            <div class="driver-photo">👤</div>
            <div class="driver-meta">
                <div class="driver-name">${driverName}</div>
                <div class="driver-rating">
                    <span class="star">★</span> ${rating} · ${trips} trips
                </div>
            </div>
            <div class="driver-car">
                <div class="car-model">${carModel}</div>
                <div class="car-plate">${plate}</div>
            </div>
        </div>
        <div class="trip-divider"></div>
        <div class="trip-detail-row">
            <span class="label">Ride type</span>
            <span class="value">${car.icon} ${car.name}</span>
        </div>
        <div class="trip-detail-row">
            <span class="label">Fare</span>
            <span class="value">₹${fare}</span>
        </div>
        <div class="trip-detail-row">
            <span class="label">Distance</span>
            <span class="value">${currentDistance} km</span>
        </div>
        <div class="trip-detail-row">
            <span class="label">Payment</span>
            <span class="value">•••• 4242</span>
        </div>
    `;

    // Trip progress
    document.getElementById('trip-progress').innerHTML = `
        <div class="progress-status">
            <span class="status-dot"></span>
            Driver is on the way
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill" id="progress-bar" style="width: 0%"></div>
        </div>
        <div class="progress-eta" id="progress-eta">Arriving in ~${eta} min</div>
    `;

    // Switch view
    document.getElementById('ride-options').style.display = 'none';
    document.getElementById('booking-confirmed').style.display = 'block';

    // Start driver tracking
    startDriverTracking(parseInt(eta));
}

// --- Go Back ---
function goBack() {
    document.getElementById('search-section').style.display = 'block';
    document.getElementById('ride-options').style.display = 'none';
    document.getElementById('booking-confirmed').style.display = 'none';
}

// --- Driver Tracking ---
function startDriverTracking(etaMinutes) {
    if (driverInterval) clearInterval(driverInterval);
    if (driverMarker) map.removeLayer(driverMarker);

    let driverLat = userLat + (Math.random() * 0.02 - 0.01 + 0.015);
    let driverLon = userLon + (Math.random() * 0.02 - 0.01 + 0.015);

    const totalSteps = etaMinutes * 3; // 2 seconds per step
    const latStep = (driverLat - userLat) / totalSteps;
    const lonStep = (driverLon - userLon) / totalSteps;
    let step = 0;

    driverMarker = L.marker([driverLat, driverLon], {
        icon: createCustomIcon('🚗', 36)
    }).addTo(map).bindPopup("Your driver");

    driverInterval = setInterval(() => {
        step++;
        driverLat -= latStep + (Math.random() * 0.0003 - 0.00015);
        driverLon -= lonStep + (Math.random() * 0.0003 - 0.00015);

        driverMarker.setLatLng([driverLat, driverLon]);

        const dist = getDistance(driverLat, driverLon, userLat, userLon);
        const progress = Math.min((step / totalSteps) * 100, 100);
        const remainingMin = Math.max(1, Math.round(etaMinutes * (1 - step / totalSteps)));

        // Update progress bar
        const progressBar = document.getElementById('progress-bar');
        const progressEta = document.getElementById('progress-eta');

        if (progressBar) progressBar.style.width = `${progress}%`;

        if (dist < 0.15 || step >= totalSteps) {
            clearInterval(driverInterval);
            driverMarker.setLatLng([userLat, userLon]);

            if (progressBar) progressBar.style.width = '100%';

            document.getElementById('trip-progress').innerHTML = `
                <div class="progress-status" style="color: var(--uber-green);">
                    <span class="status-dot"></span>
                    Driver has arrived!
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: 100%"></div>
                </div>
                <div class="progress-eta">Meet your driver at the pickup point 🎉</div>
            `;

            document.getElementById('cancel-btn').textContent = 'End Ride';
        } else {
            if (progressEta) {
                progressEta.textContent = `${dist.toFixed(1)} km away · ~${remainingMin} min`;
            }
        }
    }, 2000);
}

// --- Cancel Ride ---
function cancelRide() {
    if (driverInterval) clearInterval(driverInterval);
    if (driverMarker) map.removeLayer(driverMarker);

    document.getElementById('booking-confirmed').style.display = 'none';
    document.getElementById('search-section').style.display = 'block';
    document.getElementById('ride-options').style.display = 'none';

    // Reset fields
    selectedRideIndex = null;
}

// --- Distance Calculator (Haversine) ---
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// --- Suppress default Leaflet marker icon issue ---
const defaultMarkerStyle = document.createElement('style');
defaultMarkerStyle.textContent = `
    .custom-marker {
        background: none !important;
        border: none !important;
    }
`;
document.head.appendChild(defaultMarkerStyle);
function startVoiceAssistant() {
    let recognition = new (
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
    )();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
        let speech = event.results[0][0].transcript.toLowerCase();

        document.getElementById(
            "info"
        ).innerHTML = `
            <div class="ride">
            <div class="ride-content">
            YOU SAID:
            <br><br>
            ${speech}
            </div>
            </div>
            `;
        let reply = new SpeechSynthesisUtterance(
            "RIDE BOOKED SUCCESSFULLY"
        );
        speechSynthesis.speak(reply);
    };
}