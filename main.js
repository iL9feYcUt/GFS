const map = L.map("map").setView([35, 135], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const bounds = [
  [-90, -180],
  [90, 180]
];

let imageLayer = null;
let windLayer = null;

const slider = document.getElementById("timeSlider");
const label = document.getElementById("timeLabel");
const windToggle = document.getElementById("windToggle");

// ===== 等温線PNG切替 =====
function updateImage(t) {
  if (imageLayer) map.removeLayer(imageLayer);

  imageLayer = L.imageOverlay(
    `data/temp_${t}.png?v=${Date.now()}`,
    bounds,
    { opacity: 0.6 }
  ).addTo(map);
}

// ===== 風粒子描画 =====
async function updateWind(t) {
  if (windLayer) map.removeLayer(windLayer);
  if (!windToggle.checked) return;

  const res = await fetch(`data/wind_${t}.json?v=${Date.now()}`);
  const data = await res.json();

  const canvas = L.canvas({ padding: 0.5 });
  windLayer = L.layerGroup();

  data.forEach(p => {
    const len = Math.sqrt(p.u * p.u + p.v * p.v) * 0.8;
    const endLat = p.lat + p.v * 0.3;
    const endLon = p.lon + p.u * 0.3;

    const line = L.polyline(
      [[p.lat, p.lon], [endLat, endLon]],
      { color: "black", weight: 1 }
    );

    windLayer.addLayer(line);
  });

  windLayer.addTo(map);
}

// ===== 初期表示 =====
function updateAll() {
  const t = slider.value;
  label.textContent = `t=${t}`;
  updateImage(t);
  updateWind(t);
}

slider.addEventListener("input", updateAll);
windToggle.addEventListener("change", updateAll);

updateAll();
