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
let windIndex = null; // spatial hash: Map<"latBucket_lonBucket", Array<w>>
const BUCKET_SIZE = 0.5; // degrees
// particle density tuning (particles per screen pixel)
let particlesPerPixel = 0.001;

// ===== Canvas Layer =====
const WindLayer = L.Layer.extend({
  onAdd(map) {
    this.map = map;
    this.canvas = L.DomUtil.create("canvas");

    // style canvas so it sits over the map but doesn't block interaction
    this.canvas.style.position = "absolute";
    this.canvas.style.pointerEvents = "none";
    this.ctx = this.canvas.getContext("2d");
    map.getPanes().overlayPane.appendChild(this.canvas);

    this.resize();

    // only resize after move/zoom finished to preserve trails during interaction
    map.on("moveend resize", this.resize, this);
    map.on("zoomstart", this._onZoomStart, this);
    map.on("zoomend", this._onZoomEnd, this);

    this.running = true;
    console.log("WindLayer added, starting animate");
    this.animate();
  },

  _onZoomStart() {
    console.log("zoomstart: pausing wind animation");
    this._wasRunning = this.running;
    this.running = false;
  },

  _onZoomEnd() {
    // resize canvas to new size and resume
    this.resize();
    console.log("zoomend: resized canvas and resuming", this.canvas.width, this.canvas.height);
    // rebalance particles to maintain density on zoom
    try { rebalanceParticles(); } catch (e) { console.warn(e); }
    if (this._wasRunning) {
      this.running = true;
      this.animate();
    }
  },

  onRemove(map) {
    this.running = false;
    L.DomUtil.remove(this.canvas);
    map.off("moveend resize", this.resize, this);
    map.off("zoomstart", this._onZoomStart, this);
    map.off("zoomend", this._onZoomEnd, this);
  },

  resize() {
    const size = this.map.getSize();
    const ratio = window.devicePixelRatio || 1;

    // set internal pixel size for crisp drawing on HiDPI
    this.canvas.width = Math.round(size.x * ratio);
    this.canvas.height = Math.round(size.y * ratio);
    // keep CSS size unchanged so container coordinates map correctly
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    // ensure canvas aligns with map container
    this.canvas.style.left = "0px";
    this.canvas.style.top = "0px";

    // reset transform and scale drawing to CSS pixels
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    // store CSS pixel size for viewport checks
    this.cssWidth = size.x;
    this.cssHeight = size.y;
  },

  animate() {
    if (!this.running) return;

    const ctx = this.ctx;
    // apply a slight fade to existing trails (destination-out erases a bit)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.04)"; // lower = longer trails
    const cssW = this.cssWidth || this.map.getSize().x;
    const cssH = this.cssHeight || this.map.getSize().y;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = "rgba(0,150,255,0.95)";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // scale factor to convert m/s to degrees per frame (heuristic)
    // increased so motion is visible; use small substeps for stability
    const velocityScale = 0.01;
    const subSteps = 3;
    const margin = 50; // px, margin around viewport to still draw

    // debug: ensure particles exist
    if (!particles || particles.length === 0) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    particles.forEach(p => {
      const w = sampleWind(p.lat, p.lon);
      if (!w) {
        reseed(p);
        return;
      }
      const start = this.map.latLngToContainerPoint([p.lat, p.lon]);

      // integrate motion with substeps for smoother, larger visible movement
      let latCur = p.lat;
      let lonCur = p.lon;
      for (let s = 0; s < subSteps; s++) {
        const wt = sampleWind(latCur, lonCur);
        if (!wt) break;
        const cosLat2 = Math.cos((latCur * Math.PI) / 180) || 1;
        latCur += (wt.v * (velocityScale / subSteps));
        lonCur += (wt.u * (velocityScale / subSteps)) / Math.max(0.0001, cosLat2);
      }
      p.lat = latCur;
      p.lon = lonCur;
      p.age++;

      // wrap longitude to keep positions contiguous
      if (p.lon > 180) p.lon -= 360;
      if (p.lon < -180) p.lon += 360;

      if (p.age > 120 || p.lat < -90 || p.lat > 90) {
        reseed(p);
        return;
      }

      const end = this.map.latLngToContainerPoint([p.lat, p.lon]);

      // skip drawing if points invalid
      if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) return;

        // draw only if within viewport + margin (use CSS sizes)
        const cssW = this.cssWidth || this.map.getSize().x;
        const cssH = this.cssHeight || this.map.getSize().y;
        if (
          end.x < -margin || end.x > cssW + margin ||
          end.y < -margin || end.y > cssH + margin
        ) {
          // not visible — skip drawing (but position updated)
          return;
        }

        // skip very long jumps (wrap/antimeridian or projection artifact)
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist2 = dx * dx + dy * dy;
        const maxDist2 = (Math.max(cssW, cssH) * 0.5) ** 2;
        if (dist2 > maxDist2) return;

        // draw a short stroked segment for motion and a small filled dot for visibility
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(0,150,255,0.95)";
        ctx.beginPath();
        ctx.arc(end.x, end.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
    });

    requestAnimationFrame(() => this.animate());
  }
});

// ===== 風サンプリング（最近傍）=====
function sampleWind(lat, lon) {
  if (windIndex) {
    const latB = Math.round(lat / BUCKET_SIZE);
    const lonB = Math.round(lon / BUCKET_SIZE);
    let min = Infinity;
    let best = null;

    // search neighboring buckets first
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${latB + i}_${lonB + j}`;
        const arr = windIndex.get(key);
        if (!arr) continue;
        for (const w of arr) {
          const d = (w.lat - lat) ** 2 + (w.lon - lon) ** 2;
          if (d < min) {
            min = d;
            best = w;
          }
        }
      }
    }

    if (best) return best;
    // fallback: if no nearby bucket found, fall through to linear search
  }

  // fallback linear search
  let min = Infinity;
  let best = null;
  for (const w of windField) {
    const d = (w.lat - lat) ** 2 + (w.lon - lon) ** 2;
    if (d < min) {
      min = d;
      best = w;
    }
  }
  return best;
}

function buildWindIndex() {
  windIndex = new Map();
  for (const w of windField) {
    const latB = Math.round(w.lat / BUCKET_SIZE);
    const lonB = Math.round(w.lon / BUCKET_SIZE);
    const key = `${latB}_${lonB}`;
    if (!windIndex.has(key)) windIndex.set(key, []);
    windIndex.get(key).push(w);
  }
}

function rebalanceParticles() {
  if (!windField || windField.length === 0) return;
  const size = map.getSize();
  const area = size.x * size.y;
  const desired = Math.max(200, Math.min(3000, Math.floor(area * particlesPerPixel)));

  if (particles.length === desired) return;

  // compute in-bounds winds for seeding
  const viewBounds = map.getBounds();
  const south = viewBounds.getSouth();
  const north = viewBounds.getNorth();
  const west = viewBounds.getWest();
  const east = viewBounds.getEast();
  const inBoundsWind = windField.filter(w => {
    const latOk = w.lat >= south - 1 && w.lat <= north + 1;
    let lonOk = false;
    if (west <= east) lonOk = w.lon >= west - 1 && w.lon <= east + 1;
    else lonOk = w.lon >= west - 1 || w.lon <= east + 1;
    return latOk && lonOk;
  });

  if (particles.length < desired) {
    // add more
    const add = desired - particles.length;
    for (let i = 0; i < add; i++) {
      const pool = inBoundsWind.length ? inBoundsWind : windField;
      const w = pool[Math.floor(Math.random() * pool.length)];
      particles.push({
        lat: w.lat + (Math.random() - 0.5) * 0.6,
        lon: w.lon + (Math.random() - 0.5) * 0.6,
        age: Math.random() * 80
      });
    }
  } else {
    // drop extras (randomly) to reduce count
    particles = particles.slice(0, desired);
  }
  console.log('rebalanceParticles ->', particles.length);
}

// ===== 粒子再配置 =====
function reseed(p) {
  const w = windField[Math.floor(Math.random() * windField.length)];
  // place particle near a grid point with small random jitter to avoid
  // visible regular lat/lon lines
  const jitter = 0.6; // degrees
  p.lat = w.lat + (Math.random() - 0.5) * jitter;
  p.lon = w.lon + (Math.random() - 0.5) * jitter;
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
  console.log("windField loaded", windField.length);
  // build spatial index for fast sampling
  buildWindIndex();

  // 粒子初期化: まず表示範囲内の風点のみを使ってシード（負荷低減）
  const viewBounds = map.getBounds();
  const south = viewBounds.getSouth();
  const north = viewBounds.getNorth();
  const west = viewBounds.getWest();
  const east = viewBounds.getEast();

  const inBoundsWind = windField.filter(w => {
    const latOk = w.lat >= south - 1 && w.lat <= north + 1;
    // handle antimeridian
    let lonOk = false;
    if (west <= east) lonOk = w.lon >= west - 1 && w.lon <= east + 1;
    else lonOk = w.lon >= west - 1 || w.lon <= east + 1;
    return latOk && lonOk;
  });

  // keep particle density roughly constant in screen space
  const size = map.getSize();
  const area = size.x * size.y;
  let particleCount = Math.max(200, Math.min(3000, Math.floor(area * particlesPerPixel)));

  if (inBoundsWind.length >= 1) {
    particles = new Array(particleCount).fill(null).map(() => {
      const w = inBoundsWind[Math.floor(Math.random() * inBoundsWind.length)];
      return {
        lat: w.lat + (Math.random() - 0.5) * 0.6,
        lon: w.lon + (Math.random() - 0.5) * 0.6,
        age: Math.random() * 80
      };
    });
  } else {
    particles = new Array(particleCount).fill(null).map(() => {
      const w = windField[Math.floor(Math.random() * windField.length)];
      return {
        lat: w.lat + (Math.random() - 0.5) * 0.6,
        lon: w.lon + (Math.random() - 0.5) * 0.6,
        age: Math.random() * 80
      };
    });
  }
  console.log("particles initialized", particles.length);

  windLayer = new WindLayer();
  windLayer.addTo(map);
}

levelSel.addEventListener("change", update);
timeSlider.addEventListener("input", update);

update();
