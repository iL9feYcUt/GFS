const map = L.map("map").setView([35, 135], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const bounds = [[-90, -180], [90, 180]];

const levelSel = document.getElementById("level");
const timeSlider = document.getElementById("time");
const label = document.getElementById("label");

let imgLayer = null;
let windLayer = null;

// ===== 風場（格子）=====
let windField = [];
let particles = [];

// ===== Canvas Layer =====
const WindLayer = L.Layer.extend({
  onAdd(map) {
    this.map = map;
    this.canvas = L.DomUtil.create("canvas");
    this.ctx = this.canvas.getContext("2d");
    map.getPanes().overlayPane.appendChild(this.canvas);

    this.resize();
    map.on("move zoom resize", this.resize, this);

    this.running = true;
    this.animate();
  },

  onRemove(map) {
    this.running = false;
    L.DomUtil.remove(this.canvas);
    map.off("move zoom resize", this.resize, this);
  },

  resize() {
    const size = this.map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
  },

  animate() {
    if (!this.running) return;

    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;

    particles.forEach(p => {
      const w = sampleWind(p.lat, p.lon);
      if (!w) {
        reseed(p);
        return;
      }

      const start = this.map.latLngToContainerPoint([p.lat, p.lon]);

      p.lat += w.v * 0.04;
      p.lon += w.u * 0.04;
      p.age++;

      if (p.age > 80 ||
          p.lat < -90 || p.lat > 90 ||
          p.lon < -180 || p.lon > 180) {
        reseed(p);
        return;
      }

      const end = this.map.latLngToContainerPoint([p.lat, p.lon]);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    requestAnimationFrame(() => this.animate());
  }
});

// ===== 風サンプリング（最近傍）=====
function sampleWind(lat, lon) {
  let min = Infinity;
  let best = null;

  for (const w of windField) {
    const d =
      (w.lat - lat) ** 2 +
      (w.lon - lon) ** 2;
    if (d < min) {
      min = d;
      best = w;
    }
  }
  return best;
}

// ===== 粒子再配置 =====
function reseed(p) {
  const w = windField[Math.floor(Math.random() * windField.length)];
  p.lat = w.lat;
  p.lon = w.lon;
  p.age = 0;
}

// ===== 更新処理 =====
async function update() {
  const lev = levelSel.value;
  const t = timeSlider.value;
  label.textContent = `t=${t}`;

  if (imgLayer) map.removeLayer(imgLayer);
  if (windLayer) map.removeLayer(windLayer);

  imgLayer = L.imageOverlay(
    `data/${lev}/temp_${t}.png?v=${Date.now()}`,
    bounds,
    { opacity: 0.6 }
  ).addTo(map);

  const res = await fetch(`data/${lev}/wind_${t}.json?v=${Date.now()}`);
  windField = await res.json();

  // 粒子初期化
  particles = windField.slice(0, 800).map(w => ({
    lat: w.lat,
    lon: w.lon,
    age: Math.random() * 80
  }));

  windLayer = new WindLayer();
  windLayer.addTo(map);
}

levelSel.addEventListener("change", update);
timeSlider.addEventListener("input", update);

update();
