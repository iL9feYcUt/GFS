/* =========================
   前提
   =========================
   - Leaflet map は既に生成済み（変数名 map）
   - index.html に <canvas id="wind-canvas"></canvas>
   - assets/wind_850.json 等を fetch
*/

// =========================
// 設定
// =========================
const PARTICLE_COUNT = 1200;
const SPEED_SCALE = 0.015;
const FADE_ALPHA = 0.08;
const MAX_AGE = 120;

let currentLevel = '850';
let firstFrame = true;

// =========================
// Canvas
// =========================
const canvas = document.getElementById('wind-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const s = map.getSize();
  canvas.width = s.x;
  canvas.height = s.y;
}
resizeCanvas();

// =========================
// 風データ
// windData[level] = { lats, lons, u, v }
// =========================
const windData = {};

async function loadWind(level) {
  const res = await fetch(`assets/wind_${level}.json`);
  windData[level] = await res.json();
}

// =========================
// 粒子
// =========================
let particles = [];

function createParticle() {
  const b = map.getBounds();
  const lat = b.getSouth() + Math.random() * (b.getNorth() - b.getSouth());
  const lng = b.getWest()  + Math.random() * (b.getEast()  - b.getWest());
  const p = map.latLngToContainerPoint([lat, lng]);
  return { x: p.x, y: p.y, age: Math.random() * MAX_AGE };
}

function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle());
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  firstFrame = true;
}

// =========================
// 風取得（双線形補間）
// =========================
function getWind(x, y) {
  const d = windData[currentLevel];
  if (!d) return null;

  const ll = map.containerPointToLatLng([x, y]);
  const { lats, lons, u, v } = d;

  let i = lats.findIndex(t => t < ll.lat);
  let j = lons.findIndex(t => t > ll.lng);
  if (i < 0 || j < 0 || i >= lats.length - 1 || j >= lons.length - 1) return null;

  const lat0 = lats[i], lat1 = lats[i + 1];
  const lon0 = lons[j], lon1 = lons[j + 1];
  const a = (ll.lat - lat0) / (lat1 - lat0);
  const b = (ll.lng - lon0) / (lon1 - lon0);

  const u00 = u[i][j],     u10 = u[i + 1][j];
  const u01 = u[i][j + 1], u11 = u[i + 1][j + 1];
  const v00 = v[i][j],     v10 = v[i + 1][j];
  const v01 = v[i][j + 1], v11 = v[i + 1][j + 1];

  return [
    u00*(1-a)*(1-b) + u10*a*(1-b) + u01*(1-a)*b + u11*a*b,
    v00*(1-a)*(1-b) + v10*a*(1-b) + v01*(1-a)*b + v11*a*b
  ];
}

// =========================
// 描画（Windy方式）
// =========================
function draw() {
  if (!windData[currentLevel]) {
    requestAnimationFrame(draw);
    return;
  }

  if (!firstFrame) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  firstFrame = false;

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(200,255,255,0.8)';
  ctx.lineWidth = 1.1;

  for (const p of particles) {
    const w = getWind(p.x, p.y);
    if (!w || p.age++ > MAX_AGE) {
      Object.assign(p, createParticle());
      continue;
    }

    const nx = p.x + w[0] * SPEED_SCALE;
    const ny = p.y - w[1] * SPEED_SCALE;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    p.x = nx;
    p.y = ny;

    if (nx < 0 || ny < 0 || nx > canvas.width || ny > canvas.height) {
      Object.assign(p, createParticle());
    }
  }

  requestAnimationFrame(draw);
}

// =========================
// hPa 切替
// =========================
document.querySelectorAll('[name="level"]').forEach(r => {
  r.addEventListener('change', e => {
    currentLevel = e.target.value;
    initParticles();
  });
});

// =========================
// 地図イベント
// =========================
map.on('moveend zoomend resize', () => {
  resizeCanvas();
  initParticles();
});

// =========================
// 起動
// =========================
Promise.all([
  loadWind('850'),
  loadWind('700'),
  loadWind('500')
]).then(() => {
  initParticles();
  draw();
});
