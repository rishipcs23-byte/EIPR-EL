/* ==================================================
   world.js – Main Game Engine
   5 Zones, Collision, Minimap, Day/Night, Game Loop
   ================================================== */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ── Canvas Resize ──────────────────────────────── */
function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/* ── World Constants ────────────────────────────── */
const WORLD = { width: 3000, height: 3000 };

/* ── Camera ─────────────────────────────────────── */
const camera = { x: 0, y: 0 };

/* ── Player ─────────────────────────────────────── */
const player = {
    x: 1500, y: 2420,
    speed: 3.2,
    headRadius: 15,
    bodyWidth: 20,
    bodyHeight: 30,
    facing: "down",   // up/down/left/right
    walkFrame: 0,
    walkTimer: 0
};

/* ── Input ──────────────────────────────────────── */
const keys = {};
window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup",   e => { keys[e.key.toLowerCase()] = false; });

/* ── Collision Objects ──────────────────────────── */
// AABB boxes: { x, y, w, h }
const colliders = [];

function addCollider(x, y, w, h) {
    colliders.push({ x, y, w, h });
}

/* ── Zone Definitions ───────────────────────────── */
let zones = [
    { id: "village",  label: "Dreamer's Village",     x: 900,  y: 2050, w: 1200, h: 600,  groundColor: "#5d944c", borderColor: "#7ab34a" },
    { id: "guild",    label: "Entrepreneur's Guild",  x: 900,  y: 1550, w: 1200, h: 400,  groundColor: "#4a7c59", borderColor: "#5a9e6e" },
    { id: "hills",    label: "Startup Hills",         x: 900,  y: 950,  w: 1200, h: 500,  groundColor: "#6b8e5e", borderColor: "#8ab06e" },
    { id: "myth",     label: "Myth Forest",           x: 900,  y: 350,  w: 1200, h: 500,  groundColor: "#2d5a3d", borderColor: "#3a7a52" },
    { id: "vision",   label: "Vision Peak",           x: 1100, y: 80,   w: 800,  h: 230,  groundColor: "#4a5568", borderColor: "#718096" }
];

let roads = [
    { x1: 1500, y1: 2700, x2: 1500, y2: 150, w: 54, dash: true },
    { x1: 1000, y1: 2380, x2: 2000, y2: 2380, w: 40, dash: false },
    { x1: 1050, y1: 1720, x2: 1950, y2: 1720, w: 36, dash: false },
    { x1: 1050, y1: 1120, x2: 1950, y2: 1120, w: 36, dash: false }
];

/* ── Map Objects ────────────────────────────────── */
/* ── Map Objects ────────────────────────────────── */
let buildings = [
    // Village
    { x:1080, y:2200, w:90, h:70, label:"School",  wallColor:"#d7bc95", roofColor:"#8b3c2a", door:true },
    { x:1300, y:2200, w:90, h:70, label:"Bakery",  wallColor:"#e8c9a0", roofColor:"#7a3020", door:true },
    { x:1500, y:2200, w:90, h:70, label:"Market",  wallColor:"#d4b896", roofColor:"#6b4c2a", door:true },
    { x:1700, y:2200, w:90, h:70, label:"House",   wallColor:"#c9b08a", roofColor:"#5c3520", door:true },
    { x:1150, y:2500, w:90, h:70, label:"House 2", wallColor:"#dcc4a0", roofColor:"#804020", door:true },
    { x:1620, y:2500, w:90, h:70, label:"House 3", wallColor:"#cbb898", roofColor:"#703a18", door:true },
    // Guild Hall
    { x:1350, y:1600, w:300, h:120, label:"Guild Hall", wallColor:"#b8a0c8", roofColor:"#5c3a8c", door:true },
    { x:1100, y:1660, w:80, h:60,  label:"Lab",    wallColor:"#a0b8c8", roofColor:"#2c5c8c", door:false },
    { x:1780, y:1660, w:80, h:60,  label:"Office", wallColor:"#c8b0a0", roofColor:"#8c5c2c", door:false },
    // Startup Hills camps
    { x:1100, y:1000, w:120, h:80, label:"Camp A", wallColor:"#b8c8a0", roofColor:"#4c7c2c", door:true },
    { x:1400, y:980,  w:120, h:80, label:"Camp B", wallColor:"#c8b8a0", roofColor:"#7c5c2c", door:true },
    { x:1700, y:1000, w:120, h:80, label:"Camp C", wallColor:"#a0b0c8", roofColor:"#2c4c8c", door:true },
    // Vision Peak fortress
    { x:1350, y:100,  w:300, h:150, label:"Fortress", wallColor:"#8090a0", roofColor:"#3a4a5a", door:true }
];

let trees = [];
let scenery = [];
let pickups = [];    // ground-collectible items: { x, y, icon, name, hint, collected }
let atmosphere = { fogColor: null, ambientGlow: null };

function rebuildWorldColliders() {
    colliders.length = 0;
    // Add building colliders
    buildings.forEach(b => addCollider(b.x, b.y, b.w, b.h));
    // Add tree colliders
    trees.filter(t => t.r > 22).forEach(t => addCollider(t.x - t.r * 0.6, t.y - t.r * 0.6, t.r * 1.2, t.r * 1.2));
    // Add scenery colliders
    scenery.forEach(s => {
        if (s.type === "lake" || s.type === "pond") {
            const r = s.r || Math.min(s.w || 120, s.h || 120) / 2 || 50;
            addCollider(s.x - r, s.y - r, r * 2, r * 2);
        } else if (s.type === "ruins") {
            addCollider(s.x, s.y, s.w || 80, s.h || 60);
        } else if (s.type === "rocks") {
            const r = s.r || 30;
            addCollider(s.x - r, s.y - r, r * 2, r * 2);
        } else if (s.type === "shrine" || s.type === "statue") {
            addCollider(s.x - 25, s.y - 25, 50, 50);
        }
    });
}
window.rebuildWorldColliders = rebuildWorldColliders;

(function seedTrees() {
    const noGoZones = [
        { x:1400, y:0, w:200, h:3000 }, // main road
        ...buildings.map(b => ({ x:b.x-20, y:b.y-20, w:b.w+40, h:b.h+40 }))
    ];
    let attempts = 0;
    while (trees.length < 200 && attempts < 4000) {
        attempts++;
        const tx = 200 + Math.random() * 2600;
        const ty = 200 + Math.random() * 2600;
        const blocked = noGoZones.some(z =>
            tx > z.x && tx < z.x + z.w && ty > z.y && ty < z.y + z.h);
        if (!blocked) {
            const inMythForest = ty > 350 && ty < 850 && tx > 900 && tx < 2100;
            trees.push({ x: tx, y: ty, r: 16 + Math.random() * 10, dark: inMythForest });
        }
    }
    rebuildWorldColliders();
})();

/* ── Collision Helpers ──────────────────────────── */
function circleVsRect(cx, cy, cr, rx, ry, rw, rh) {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX, dy = cy - nearY;
    return dx * dx + dy * dy < cr * cr;
}

function resolveCollision(px, py) {
    let resolved = { x: px, y: py };
    for (const col of colliders) {
        if (circleVsRect(resolved.x, resolved.y, player.headRadius + 4, col.x, col.y, col.w, col.h)) {
            // Push out on shortest axis
            const overlapL = (resolved.x) - (col.x + col.w);
            const overlapR = (col.x) - (resolved.x);
            const overlapT = (resolved.y) - (col.y + col.h);
            const overlapB = (col.y) - (resolved.y);
            const minH = Math.abs(overlapL) < Math.abs(overlapR) ? overlapL : overlapR;
            const minV = Math.abs(overlapT) < Math.abs(overlapB) ? overlapT : overlapB;
            if (Math.abs(minH) < Math.abs(minV)) {
                resolved.x -= minH + (minH < 0 ? -1 : 1) * (player.headRadius + 4);
            } else {
                resolved.y -= minV + (minV < 0 ? -1 : 1) * (player.headRadius + 4);
            }
        }
    }
    return resolved;
}

/* ── Current Zone ───────────────────────────────── */
function getCurrentZone() {
    for (const z of zones) {
        if (player.x > z.x && player.x < z.x + z.w &&
            player.y > z.y && player.y < z.y + z.h) return z;
    }
    return null;
}

let lastZoneId = "village";

/* ── Player Update ──────────────────────────────── */
function updatePlayer() {
    if (isDialogueOpen()) return;

    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"])    { dy = -player.speed; player.facing = "up"; }
    if (keys["s"] || keys["arrowdown"])  { dy =  player.speed; player.facing = "down"; }
    if (keys["a"] || keys["arrowleft"])  { dx = -player.speed; player.facing = "left"; }
    if (keys["d"] || keys["arrowright"]) { dx =  player.speed; player.facing = "right"; }

    // Diagonal normalise
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const isMoving = dx !== 0 || dy !== 0;
    if (isMoving) {
        player.walkTimer++;
        if (player.walkTimer > 8) { player.walkFrame = (player.walkFrame + 1) % 4; player.walkTimer = 0; }
    } else {
        player.walkFrame = 0;
    }

    // Try horizontal, then vertical — allows wall sliding
    let nx = player.x + dx;
    let ny = player.y + dy;

    // Clamp world bounds
    nx = Math.max(player.headRadius, Math.min(WORLD.width  - player.headRadius, nx));
    ny = Math.max(player.headRadius, Math.min(WORLD.height - player.headRadius, ny));

    const resolved = resolveCollision(nx, ny);
    player.x = resolved.x;
    player.y = resolved.y;

    // Zone change notification
    const zone = getCurrentZone();
    if (zone && zone.id !== lastZoneId) {
        lastZoneId = zone.id;
        document.getElementById("zone-name").textContent = zone.label;
        QuestSystem.showToast("📍 " + zone.label);
    }
}

/* ── Camera Update ──────────────────────────────── */
function updateCamera() {
    // Smooth camera follow
    const targetX = player.x - canvas.width  / 2;
    const targetY = player.y - canvas.height / 2;
    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.1;
    camera.x = Math.max(0, Math.min(WORLD.width  - canvas.width,  camera.x));
    camera.y = Math.max(0, Math.min(WORLD.height - canvas.height, camera.y));
}

/* ══════════════════════════════════════════════════
   DRAW WORLD
   ══════════════════════════════════════════════════ */

function drawBackground() {
    // Base world ground
    ctx.fillStyle = "#4a7a3a";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawZones() {
    zones.forEach(z => {
        // Zone ground
        ctx.fillStyle = z.groundColor;
        ctx.fillRect(z.x, z.y, z.w, z.h);

        // Zone border
        ctx.strokeStyle = z.borderColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 6]);
        ctx.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);
        ctx.setLineDash([]);

        // Zone label
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.font = "bold 28px 'Segoe UI', Arial";
        ctx.textAlign = "center";
        ctx.fillText(z.label.toUpperCase(), z.x + z.w / 2, z.y + 36);
        ctx.textAlign = "left";
    });
}

function drawRoads() {
    ctx.lineCap = "round";
    roads.forEach(r => {
        ctx.strokeStyle = "#b8965a";
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.moveTo(r.x1, r.y1);
        ctx.lineTo(r.x2, r.y2);
        ctx.stroke();

        if (r.dash) {
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.lineWidth = 2;
            ctx.setLineDash([30, 20]);
            ctx.beginPath();
            ctx.moveTo(r.x1, r.y1);
            ctx.lineTo(r.x2, r.y2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
}

function drawBuildings() {
    buildings.forEach(b => {
        // Wall
        ctx.fillStyle = b.wallColor;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();

        // Roof (triangle)
        ctx.fillStyle = b.roofColor;
        ctx.beginPath();
        ctx.moveTo(b.x - 8, b.y);
        ctx.lineTo(b.x + b.w / 2, b.y - Math.min(40, b.h * 0.6));
        ctx.lineTo(b.x + b.w + 8, b.y);
        ctx.closePath();
        ctx.fill();

        // Door
        if (b.door) {
            ctx.fillStyle = "#5D4037";
            const dw = Math.min(22, b.w * 0.22);
            const dh = Math.min(30, b.h * 0.42);
            ctx.beginPath();
            ctx.roundRect(b.x + b.w / 2 - dw / 2, b.y + b.h - dh, dw, dh, [3, 3, 0, 0]);
            ctx.fill();
        }

        // Windows
        ctx.fillStyle = "rgba(180, 230, 255, 0.7)";
        if (b.w > 80) {
            ctx.fillRect(b.x + 12, b.y + 14, 18, 16);
            ctx.fillRect(b.x + b.w - 30, b.y + 14, 18, 16);
        }

        // Label
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(b.label, b.x + b.w / 2, b.y - 8);
        ctx.textAlign = "left";
    });
}

function drawTrees() {
    trees.forEach(t => {
        // Only draw on screen
        const sx = t.x - camera.x, sy = t.y - camera.y;
        if (sx < -40 || sx > canvas.width + 40 || sy < -40 || sy > canvas.height + 40) return;

        // Trunk
        ctx.fillStyle = t.dark ? "#3a2a18" : "#6b4f2a";
        ctx.fillRect(t.x - 4, t.y, 8, 16);

        // Leaf canopy (layered for depth)
        const leaf = t.dark ? "#1a3d22" : "#2e7d32";
        const leaf2 = t.dark ? "#143018" : "#245c24";
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = leaf2;
        ctx.beginPath();
        ctx.arc(t.x - t.r * 0.2, t.y - t.r * 0.2, t.r * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Myth forest mist glow
        if (t.dark) {
            ctx.fillStyle = "rgba(80,0,120,0.06)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r * 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawPlayer() {
    const { x, y, bodyWidth, bodyHeight, headRadius, walkFrame } = player;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(x, y + bodyHeight + 2, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leg walk animation
    const legSwing = Math.sin(walkFrame / 4 * Math.PI * 2) * 4;
    ctx.fillStyle = "#1D4ED8";
    ctx.fillRect(x - 7, y + bodyHeight * 0.55, 7, bodyHeight * 0.45 + legSwing);
    ctx.fillRect(x,     y + bodyHeight * 0.55, 7, bodyHeight * 0.45 - legSwing);

    // Torso
    ctx.fillStyle = "#3478F6";
    ctx.beginPath();
    ctx.roundRect(x - bodyWidth / 2, y, bodyWidth, bodyHeight * 0.6, 3);
    ctx.fill();

    // Head
    ctx.fillStyle = "#FFD8B0";
    ctx.beginPath();
    ctx.arc(x, y - headRadius + 4, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#333";
    const eyeOff = player.facing === "left" ? -4 : player.facing === "right" ? 4 : 0;
    if (player.facing !== "up") {
        ctx.beginPath(); ctx.arc(x + eyeOff - 3, y - headRadius + 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + eyeOff + 3, y - headRadius + 3, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Player name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("You", x, y - headRadius * 2 - 4);
    ctx.textAlign = "left";
}

function drawScenery() {
    scenery.forEach(s => {
        if (s.type === "lake" || s.type === "pond") {
            const r = s.r || Math.min(s.w || 120, s.h || 120) / 2 || 60;
            ctx.fillStyle = s.color || "#1e4e89";
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = "#4ea8de";
            ctx.lineWidth = 3;
            ctx.stroke();
            
            const pulse = Math.sin(Date.now() / 800) * 4;
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(s.x, s.y, Math.max(5, r - 15 + pulse), 0, Math.PI * 2);
            ctx.stroke();
            
            if (s.label) {
                ctx.fillStyle = "rgba(255,255,255,0.65)";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(s.label, s.x, s.y + 4);
                ctx.textAlign = "left";
            }
        } else if (s.type === "ruins") {
            const w = s.w || 80;
            const h = s.h || 60;
            ctx.fillStyle = s.color || "#777c85";
            ctx.fillRect(s.x, s.y, w, h);
            
            ctx.fillStyle = "#52575d";
            ctx.fillRect(s.x + 8, s.y + 8, 12, 12);
            ctx.fillRect(s.x + w - 20, s.y + 8, 12, 12);
            ctx.fillRect(s.x + 8, s.y + h - 20, 12, 12);
            ctx.fillRect(s.x + w - 20, s.y + h - 20, 12, 12);
            
            ctx.strokeStyle = "#3f4247";
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x, s.y, w, h);
            
            if (s.label) {
                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(s.label, s.x + w/2, s.y - 6);
                ctx.textAlign = "left";
            }
        } else if (s.type === "campfire") {
            ctx.fillStyle = "#5c3d24";
            ctx.fillRect(s.x - 16, s.y - 4, 32, 8);
            ctx.fillRect(s.x - 4, s.y - 16, 8, 32);
            
            const size = 8 + Math.random() * 6;
            const grad = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 22);
            grad.addColorStop(0, "#ff4500");
            grad.addColorStop(0.5, "#ff8c00");
            grad.addColorStop(1, "rgba(255,215,0,0)");
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(s.x, s.y - 4, size + 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = "rgba(255,140,0,0.06)";
            ctx.beginPath();
            ctx.arc(s.x, s.y, 75, 0, Math.PI * 2);
            ctx.fill();
        } else if (s.type === "shrine") {
            ctx.fillStyle = "#5c6b73";
            ctx.beginPath();
            ctx.roundRect(s.x - 30, s.y - 30, 60, 60, 6);
            ctx.fill();
            
            ctx.fillStyle = "#9db4c0";
            ctx.beginPath();
            ctx.roundRect(s.x - 20, s.y - 20, 40, 40, 4);
            ctx.fill();
            
            ctx.fillStyle = "#e0fbfc";
            ctx.fillRect(s.x - 10, s.y - 10, 20, 20);
            
            ctx.strokeStyle = s.color || "#00b4d8";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(s.x - 10, s.y - 10, 20, 20);
            
            if (s.label) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(s.label, s.x, s.y - 35);
                ctx.textAlign = "left";
            }
        } else if (s.type === "statue") {
            ctx.fillStyle = "#495057";
            ctx.fillRect(s.x - 20, s.y - 10, 40, 25);
            ctx.strokeStyle = "#343a40";
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x - 20, s.y - 10, 40, 25);
            
            ctx.fillStyle = s.color || "#adb5bd";
            ctx.beginPath();
            ctx.arc(s.x, s.y - 28, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(s.x - 12, s.y - 18, 24, 8);
            
            ctx.strokeStyle = "#e9ecef";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(s.x + 12, s.y - 38);
            ctx.lineTo(s.x + 12, s.y + 10);
            ctx.stroke();
            
            if (s.label) {
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.font = "bold 10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(s.label, s.x, s.y - 45);
                ctx.textAlign = "left";
            }
        } else if (s.type === "rocks") {
            const r = s.r || 30;
            ctx.fillStyle = s.color || "#6c757d";
            ctx.beginPath();
            ctx.arc(s.x - r*0.3, s.y - r*0.2, r*0.7, 0, Math.PI*2);
            ctx.arc(s.x + r*0.3, s.y + r*0.1, r*0.8, 0, Math.PI*2);
            ctx.arc(s.x, s.y - r*0.4, r*0.6, 0, Math.PI*2);
            ctx.fill();
            
            ctx.strokeStyle = "#495057";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(s.x - r*0.3, s.y - r*0.2, r*0.7, 0, Math.PI*2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s.x + r*0.3, s.y + r*0.1, r*0.8, 0, Math.PI*2);
            ctx.stroke();
        }
    });
}

function drawAtmosphere() {
    if (QuestSystem.getState().session === 99 && atmosphere && atmosphere.fogColor) {
        ctx.fillStyle = atmosphere.fogColor;
        ctx.fillRect(camera.x, camera.y, canvas.width, canvas.height);
    }
}

/* ── Pickups ─────────────────────────────────────── */
function drawPickups() {
    const now = Date.now();
    pickups.forEach(p => {
        if (p.collected) return;
        const bob = Math.sin(now / 600 + p.x) * 5;  // floating bob
        const pulse = 0.5 + 0.5 * Math.sin(now / 400 + p.y);

        // Glow halo
        const glow = ctx.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, 28);
        glow.addColorStop(0, `rgba(255, 220, 60, ${0.35 * pulse})`);
        glow.addColorStop(1, "rgba(255, 220, 60, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 28, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.font = "22px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.icon || "📜", p.x, p.y + bob);

        // Name label
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "bold 9px Arial";
        const labelW = ctx.measureText(p.name).width + 8;
        ctx.beginPath();
        ctx.roundRect(p.x - labelW / 2, p.y + bob + 8, labelW, 13, 3);
        ctx.fill();
        ctx.fillStyle = "#ffe566";
        ctx.fillText(p.name, p.x, p.y + bob + 18);
        ctx.textAlign = "left";
    });
}

let nearbyScenery = null;

function checkPickups() {
    pickups.forEach(p => {
        if (p.collected) return;
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < 38) {
            p.collected = true;
            QuestSystem.addItem({ icon: p.icon, name: p.name, hint: p.hint });
            QuestSystem.addXP(18);
            QuestSystem.showToast(`✨ Found: ${p.icon} ${p.name}!`);
            if (p.hint) {
                setTimeout(() => QuestSystem.showToast(`💡 ${p.hint}`), 1200);
            }
        }
    });

    // Check for nearby scenery to prompt E interaction
    nearbyScenery = null;
    for (const s of scenery) {
        const r = s.r || Math.max(s.w || 60, s.h || 60) / 2;
        const dx = player.x - s.x;
        const dy = player.y - s.y;
        if (Math.sqrt(dx * dx + dy * dy) < r + 55) {
            nearbyScenery = s;
            break;
        }
    }
}

window.getNearbyScenery = () => nearbyScenery;

function drawMinimap() {
    const mc = document.getElementById("minimap-canvas");
    const mctx = mc.getContext("2d");
    const mw = mc.width, mh = mc.height;
    const scaleX = mw / WORLD.width, scaleY = mh / WORLD.height;

    mctx.clearRect(0, 0, mw, mh);

    // Background
    mctx.fillStyle = "#0d1a10";
    mctx.fillRect(0, 0, mw, mh);

    // Zones
    zones.forEach(z => {
        mctx.fillStyle = z.groundColor + "cc";
        mctx.fillRect(z.x * scaleX, z.y * scaleY, z.w * scaleX, z.h * scaleY);
    });

    // Scenery on minimap
    scenery.forEach(s => {
        if (s.type === "lake" || s.type === "pond") {
            mctx.fillStyle = "#1e4e89aa";
            const r = s.r || Math.min(s.w || 120, s.h || 120) / 2 || 50;
            mctx.beginPath();
            mctx.arc(s.x * scaleX, s.y * scaleY, r * scaleX, 0, Math.PI * 2);
            mctx.fill();
        } else {
            mctx.fillStyle = "#777c85aa";
            const w = s.w || 60;
            const h = s.h || 60;
            mctx.fillRect((s.x - w/2) * scaleX, (s.y - h/2) * scaleY, w * scaleX, h * scaleY);
        }
    });

    // Roads
    mctx.strokeStyle = "#b8965a88";
    mctx.lineCap = "round";
    roads.forEach(r => {
        mctx.lineWidth = Math.max(2, r.w * scaleX);
        mctx.beginPath();
        mctx.moveTo(r.x1 * scaleX, r.y1 * scaleY);
        mctx.lineTo(r.x2 * scaleX, r.y2 * scaleY);
        mctx.stroke();
    });

    // NPCs (dots)
    npcs.forEach(npc => {
        const talked = QuestSystem.getState().sessionProgress[npc.id];
        mctx.fillStyle = talked ? "#56ff8f" : "#ffd700";
        mctx.beginPath();
        mctx.arc(npc.x * scaleX, npc.y * scaleY, 2.5, 0, Math.PI * 2);
        mctx.fill();
    });

    // Camera viewport rect
    mctx.strokeStyle = "rgba(255,255,255,0.3)";
    mctx.lineWidth = 1;
    mctx.strokeRect(camera.x * scaleX, camera.y * scaleY,
        canvas.width * scaleX, canvas.height * scaleY);

    // Player dot
    mctx.fillStyle = "#4cafef";
    mctx.beginPath();
    mctx.arc(player.x * scaleX, player.y * scaleY, 4, 0, Math.PI * 2);
    mctx.fill();
    mctx.strokeStyle = "#fff";
    mctx.lineWidth = 1;
    mctx.stroke();
}

/* ── Myth Forest Atmosphere ─────────────────────── */
function drawMythAtmosphere() {
    if (QuestSystem.getState().session === 99) return;
    // Purple mist over myth forest zone
    const mythZone = zones.find(z => z.id === "myth");
    if (!mythZone) return;
    const gradient = ctx.createLinearGradient(
        mythZone.x, mythZone.y,
        mythZone.x, mythZone.y + mythZone.h
    );
    gradient.addColorStop(0, "rgba(60, 0, 80, 0.18)");
    gradient.addColorStop(1, "rgba(30, 0, 50, 0.08)");
    ctx.fillStyle = gradient;
    ctx.fillRect(mythZone.x, mythZone.y, mythZone.w, mythZone.h);

    // Ancient shrine in myth forest
    ctx.fillStyle = "#4a3a6a";
    ctx.fillRect(1450, 570, 100, 80);
    ctx.fillStyle = "#2d1f4a";
    ctx.beginPath();
    ctx.moveTo(1440, 570);
    ctx.lineTo(1500, 520);
    ctx.lineTo(1560, 570);
    ctx.fill();
    ctx.fillStyle = "rgba(180,130,255,0.4)";
    ctx.beginPath();
    ctx.arc(1500, 600, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Ancient Shrine", 1500, 666);
    ctx.textAlign = "left";
}

/* ── Vision Peak Atmosphere ─────────────────────── */
function drawVisionAtmosphere() {
    if (QuestSystem.getState().session === 99) return;
    // Mountain silhouette behind Vision Peak
    ctx.fillStyle = "#3a4a5a";
    ctx.beginPath();
    ctx.moveTo(1100, 310);
    ctx.lineTo(1200, 120);
    ctx.lineTo(1500, 80);
    ctx.lineTo(1800, 120);
    ctx.lineTo(1900, 310);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    ctx.fillStyle = "#dde8f0";
    ctx.beginPath();
    ctx.moveTo(1380, 150);
    ctx.lineTo(1500, 80);
    ctx.lineTo(1620, 150);
    ctx.closePath();
    ctx.fill();
}

/* ── Zone Progress Banners ──────────────────────── */
function drawZoneBanners() {
    const state = QuestSystem.getState();
    if (state.session === 99) return;
    const banners = [
        { zone: zones[0], done: state.sessionProgress.elderComplete,   label: "✅ Village Completed" },
        { zone: zones[1], done: state.sessionProgress.guildComplete,   label: "✅ Guild Completed" },
        { zone: zones[2], done: state.sessionProgress.hillsComplete,   label: "✅ Hills Completed" },
        { zone: zones[3], done: state.sessionProgress.bossDefeated,    label: "✅ Forest Conquered" },
        { zone: zones[4], done: state.sessionProgress.finalBoss,       label: "✅ Peak Conquered" }
    ];
    banners.forEach(b => {
        if (b.done) {
            ctx.fillStyle = "rgba(86, 255, 143, 0.18)";
            ctx.fillRect(b.zone.x, b.zone.y, b.zone.w, b.zone.h);
            ctx.fillStyle = "rgba(86, 255, 143, 0.8)";
            ctx.font = "bold 16px Inter, Arial";
            ctx.textAlign = "center";
            ctx.fillText(b.label, b.zone.x + b.zone.w / 2, b.zone.y + b.zone.h - 12);
            ctx.textAlign = "left";
        }
    });
}

/* ── Main Loop ──────────────────────────────────── */
function update(timestamp) {
    updatePlayer();
    updateCamera();
    updateNPCs();
    checkNPCInteraction();
    checkPickups();
    QuestSystem.tick(timestamp);
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

    // Draw order: ground → roads → zones → scenery → trees → buildings → pickups → NPCs → player → fog
    drawBackground();
    drawZones();
    drawRoads();
    drawScenery();
    drawVisionAtmosphere();
    drawMythAtmosphere();
    drawTrees();
    drawBuildings();
    drawZoneBanners();
    drawPickups();
    drawNPCs();
    drawPlayer();
    drawAtmosphere();

    ctx.restore();

    // HUD — minimap (runs in screen space on separate canvas element)
    drawMinimap();
}

let gameRunning = true;

function gameLoop(timestamp) {
    if (!gameRunning) return;
    update(timestamp);
    render();
    requestAnimationFrame(gameLoop);
}

/* ── Init ─────────────────────────────────────────*/
QuestSystem.init();
requestAnimationFrame(gameLoop);