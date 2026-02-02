const map = L.map("map").setView([35, 135], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const bounds = [[-90, -180], [90, 180]];

const levelSel = document.getElementById("level");
const timeSlider = document.getElementById("time");
const label = document.getElementById("label");

let imgLayer = null;
let canvasLayer = null;
let particles = [];

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function latlonToXY(lat, lon) {
  return map.latLngToContainerPoint([lat, lon]);
}

// ===== 粒子生成 =====
function initParticles(wind) {
  particles = wind.map(p => ({
    lat: p.lat,
    lon: p.lon,
    u: p.u,
    v: p.v
  }));
}

// ===== 粒子描画 =====
function drawParticles() {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1;

  particles.forEach(p => {
    const start = latlonToXY(p.lat, p.lon);
    p.lat += p.v * 0.05;
    p.lon += p.u * 0.05;

    if (p.lat > 90 || p.lat < -90 || p.lon > 180 || p.lon < -180) return;

    const end = latlonToXY(p.lat, p.lon);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });

  requestAnimationFrame(drawParticles);
}

// ===== 更新処理 =====
async function update() {
  const lev = levelSel.value;
  const t = timeSlider.value;
  label.textContent = `t=${t}`;

  if (imgLayer) map.removeLayer(imgLayer);
  if (canvasLayer) map.removeLayer(canvasLayer);

  imgLayer = L.imageOverlay(
    `data/${lev}/temp_${t}.png?v=${Date.now()}`,
    bounds,
    { opacity: 0.6 }
  ).addTo(map);

  const res = await fetch(`data/${lev}/wind_${t}.json?v=${Date.now()}`);
  const wind = await res.json();

  initParticles(wind);

  canvasLayer = L.canvasOverlay(() => {});
  canvasLayer.onAdd = () => {
    const pane = map.getPane("overlayPane");
    pane.appendChild(canvas);
  };
  canvasLayer.addTo(map);

  drawParticles();
}

levelSel.addEventListener("change", update);
timeSlider.addEventListener("input", update);

update();
