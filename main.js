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
let particles = [];

/* ===== Canvas Wind Layer ===== */
const WindLayer = L.Layer.extend({
  onAdd(map) {
    this.map = map;
    this.canvas = L.DomUtil.create("canvas");
    this.canvas.style.position = "absolute";
    this.resize();

    map.getPanes().overlayPane.appendChild(this.canvas);
    map.on("move zoom resize", this.resize, this);

    this.ctx = this.canvas.getContext("2d");
    this._anim = true;
    this.draw();
  },

  onRemove(map) {
    this._anim = false;
    L.DomUtil.remove(this.canvas);
    map.off("move zoom resize", this.resize, this);
  },

  resize() {
    const size = this.map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
  },

  draw() {
    if (!this._anim) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;

    particles.forEach(p => {
      const start = this.map.latLngToContainerPoint([p.lat, p.lon]);

      p.lat += p.v * 0.05;
      p.lon += p.u * 0.05;

      if (p.lat > 90 || p.lat < -90 || p.lon > 180 || p.lon < -180) {
        p.lat = p.lat0;
        p.lon = p.lon0;
        return;
      }

      const end = this.map.latLngToContainerPoint([p.lat, p.lon]);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    requestAnimationFrame(() => this.draw());
  }
});

/* ===== 更新処理 ===== */
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
  const wind = await res.json();

  particles = wind.map(p => ({
    lat: p.lat,
    lon: p.lon,
    lat0: p.lat,
    lon0: p.lon,
    u: p.u,
    v: p.v
  }));

  windLayer = new WindLayer();
  windLayer.addTo(map);
}

levelSel.addEventListener("change", update);
timeSlider.addEventListener("input", update);

update();
