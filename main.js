const map = L.map("map").setView([35, 135], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ==== キャッシュ回避（最重要）====
const cacheBust = Date.now();

const bounds = [
  [-90, -180],
  [90, 180]
];

L.imageOverlay(
  `data/gfs_temp_850.png?v=${cacheBust}`,
  bounds,
  { opacity: 0.6 }
).addTo(map);
