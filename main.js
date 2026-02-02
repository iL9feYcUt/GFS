const map = L.map("map").setView([35, 135], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const bounds = [[-90,-180],[90,180]];
let overlay = null;
let windLayer = null;

const times = ["f000", "f006", "f012"];

function loadFrame(i) {
  const t = times[i];
  document.getElementById("label").textContent = t;

  if (overlay) map.removeLayer(overlay);
  if (windLayer) map.removeLayer(windLayer);

  overlay = L.imageOverlay(
    `data/temp_850_${t}.png?v=${Date.now()}`,
    bounds,
    { opacity: 0.6 }
  ).addTo(map);

  fetch(`data/wind_850_${t}.json?v=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      windLayer = L.layerGroup();
      data.forEach(p => {
        const len = Math.sqrt(p.u*p.u + p.v*p.v);
        if (len < 5) return;

        const lat2 = p.lat + p.v * 0.1;
        const lon2 = p.lon + p.u * 0.1;

        L.polyline(
          [[p.lat, p.lon], [lat2, lon2]],
          { color: "white", weight: 1 }
        ).addTo(windLayer);
      });
      windLayer.addTo(map);
    });
}

document.getElementById("time").addEventListener("input", e => {
  loadFrame(Number(e.target.value));
});

loadFrame(0);
