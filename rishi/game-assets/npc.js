/* ==================================================
   npc.js – All 18 NPCs across 5 zones
   Wandering AI, interaction detection, quest markers
   ================================================== */

const npcs = [

    /* ─── ZONE 1: DREAMER'S VILLAGE (y ~2200–2550) ─── */
    {
        id: "elder", name: "Village Elder",
        x: 1500, y: 2350, homeX: 1500, homeY: 2350,
        wanderRadius: 55, speed: 0.4, color: "#ffcc66",
        quest: true, zone: "village",
        waitTimer: 0, maxWait: 120
    },
    {
        id: "farmer", name: "Farmer",
        x: 1180, y: 2460, homeX: 1180, homeY: 2460,
        wanderRadius: 90, speed: 0.45, color: "#7dd87d",
        quest: true, zone: "village",
        waitTimer: 0, maxWait: 90
    },
    {
        id: "teacher", name: "Teacher",
        x: 1680, y: 2280, homeX: 1680, homeY: 2280,
        wanderRadius: 60, speed: 0.38, color: "#90caf9",
        quest: true, zone: "village",
        waitTimer: 0, maxWait: 150
    },
    {
        id: "merchant", name: "Merchant",
        x: 1390, y: 2200, homeX: 1390, homeY: 2200,
        wanderRadius: 100, speed: 0.55, color: "#ff8a65",
        quest: true, zone: "village",
        waitTimer: 0, maxWait: 60
    },
    {
        id: "student", name: "Student",
        x: 1760, y: 2470, homeX: 1760, homeY: 2470,
        wanderRadius: 130, speed: 0.7, color: "#ce93d8",
        quest: true, zone: "village",
        waitTimer: 0, maxWait: 40
    },
    {
        id: "bakery", name: "Bakery Owner",
        x: 1300, y: 2540, homeX: 1300, homeY: 2540,
        wanderRadius: 40, speed: 0.3, color: "#ffab76",
        quest: false, zone: "village",
        waitTimer: 0, maxWait: 200
    },

    /* ─── ZONE 2: ENTREPRENEUR GUILD (y ~1650–1800) ─── */
    {
        id: "prof_spark", name: "Prof. Spark",
        x: 1500, y: 1700, homeX: 1500, homeY: 1700,
        wanderRadius: 50, speed: 0.35, color: "#64b5f6",
        quest: true, zone: "guild",
        waitTimer: 0, maxWait: 180
    },
    {
        id: "asha", name: "Asha",
        x: 1250, y: 1720, homeX: 1250, homeY: 1720,
        wanderRadius: 70, speed: 0.4, color: "#a5d6a7",
        quest: true, zone: "guild",
        waitTimer: 0, maxWait: 100
    },
    {
        id: "ravi", name: "Ravi",
        x: 1750, y: 1720, homeX: 1750, homeY: 1720,
        wanderRadius: 60, speed: 0.42, color: "#ef9a9a",
        quest: true, zone: "guild",
        waitTimer: 0, maxWait: 120
    },
    {
        id: "mr_kumar", name: "Mr. Kumar",
        x: 1350, y: 1780, homeX: 1350, homeY: 1780,
        wanderRadius: 55, speed: 0.3, color: "#ffe082",
        quest: true, zone: "guild",
        waitTimer: 0, maxWait: 160
    },
    {
        id: "online_ent", name: "Priya",
        x: 1650, y: 1780, homeX: 1650, homeY: 1780,
        wanderRadius: 80, speed: 0.5, color: "#ce93d8",
        quest: true, zone: "guild",
        waitTimer: 0, maxWait: 80
    },

    /* ─── ZONE 3: MYTH FOREST (y ~450–600) ─── */
    {
        id: "spirit1", name: "Spirit of Risk",
        x: 1200, y: 520, homeX: 1200, homeY: 520,
        wanderRadius: 80, speed: 0.6, color: "#80cbc4",
        quest: true, zone: "myth",
        waitTimer: 0, maxWait: 50
    },
    {
        id: "spirit2", name: "Spirit of Failure",
        x: 1500, y: 490, homeX: 1500, homeY: 490,
        wanderRadius: 70, speed: 0.65, color: "#b39ddb",
        quest: true, zone: "myth",
        waitTimer: 0, maxWait: 55
    },
    {
        id: "spirit3", name: "Spirit of Competition",
        x: 1800, y: 520, homeX: 1800, homeY: 520,
        wanderRadius: 75, speed: 0.6, color: "#f48fb1",
        quest: true, zone: "myth",
        waitTimer: 0, maxWait: 50
    },
    {
        id: "spirit4", name: "Spirit of Doubt",
        x: 1500, y: 560, homeX: 1500, homeY: 560,
        wanderRadius: 60, speed: 0.7, color: "#90a4ae",
        quest: true, zone: "myth",
        waitTimer: 0, maxWait: 45
    },
    {
        id: "myth_keeper", name: "Myth Keeper",
        x: 1500, y: 200, homeX: 1500, homeY: 200,
        wanderRadius: 20, speed: 0.2, color: "#ff5252",
        quest: true, zone: "vision",
        waitTimer: 0, maxWait: 300
    },

    /* ─── ZONE 4: STARTUP HILLS (y ~1050–1200) ─── */
    {
        id: "team_leader", name: "Team Leader",
        x: 1300, y: 1100, homeX: 1300, homeY: 1100,
        wanderRadius: 80, speed: 0.45, color: "#ffd54f",
        quest: true, zone: "hills",
        waitTimer: 0, maxWait: 90
    },
    {
        id: "investor", name: "Investor",
        x: 1600, y: 1130, homeX: 1600, homeY: 1130,
        wanderRadius: 60, speed: 0.35, color: "#a5d6a7",
        quest: true, zone: "hills",
        waitTimer: 0, maxWait: 140
    },
    {
        id: "engineer", name: "Engineer",
        x: 1450, y: 1180, homeX: 1450, homeY: 1180,
        wanderRadius: 70, speed: 0.4, color: "#80deea",
        quest: true, zone: "hills",
        waitTimer: 0, maxWait: 110
    },
    {
        id: "startup_mentor", name: "Startup Mentor",
        x: 1500, y: 1060, homeX: 1500, homeY: 1060,
        wanderRadius: 30, speed: 0.25, color: "#ff8a65",
        quest: true, zone: "hills",
        waitTimer: 0, maxWait: 250
    }
];

/* ── NPC Update (Wander AI) ─────────────────────── */
function updateNPCs() {
    npcs.forEach(npc => {

        // Stop and wait behaviour
        if (npc.waitTimer > 0) {
            npc.waitTimer--;
            return;
        }

        // Pick new wander target if none
        if (!npc.targetX) {
            npc.targetX = npc.homeX + (Math.random() - 0.5) * npc.wanderRadius * 2;
            npc.targetY = npc.homeY + (Math.random() - 0.5) * npc.wanderRadius * 2;
        }

        const dx = npc.targetX - npc.x;
        const dy = npc.targetY - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
            npc.x += (dx / dist) * npc.speed;
            npc.y += (dy / dist) * npc.speed;
        } else {
            npc.targetX = null;
            npc.targetY = null;
            // Random wait before moving again
            npc.waitTimer = npc.maxWait + Math.floor(Math.random() * npc.maxWait);
        }
    });
}

/* ── NPC Draw ───────────────────────────────────── */
function drawNPCs() {
    npcs.forEach(npc => {

        // Only draw if in viewport (with margin)
        const sx = npc.x - camera.x;
        const sy = npc.y - camera.y;
        if (sx < -60 || sx > canvas.width + 60 || sy < -80 || sy > canvas.height + 40) return;

        const talked = QuestSystem.getState().sessionProgress[npc.id];

        /* Shadow */
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(npc.x, npc.y + 32, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        /* Body */
        ctx.fillStyle = npc.color;
        ctx.beginPath();
        ctx.roundRect(npc.x - 10, npc.y, 20, 30, 5);
        ctx.fill();

        /* Head */
        ctx.fillStyle = "#ffe0bd";
        ctx.beginPath();
        ctx.arc(npc.x, npc.y - 14, 13, 0, Math.PI * 2);
        ctx.fill();

        /* Name plate */
        ctx.fillStyle = talked ? "rgba(86,255,143,0.85)" : "rgba(0,0,0,0.65)";
        const nameW = ctx.measureText(npc.name).width + 12;
        ctx.beginPath();
        ctx.roundRect(npc.x - nameW / 2, npc.y - 46, nameW, 17, 4);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 10px Inter, Arial";
        ctx.textAlign = "center";
        ctx.fillText(npc.name, npc.x, npc.y - 34);
        ctx.textAlign = "left";

        /* Quest marker */
        if (npc.quest && !talked) {
            ctx.fillStyle = "#FFD700";
            ctx.beginPath();
            ctx.arc(npc.x, npc.y - 62, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = "#111";
            ctx.font = "bold 11px Arial";
            ctx.textAlign = "center";
            ctx.fillText("!", npc.x, npc.y - 58);
            ctx.textAlign = "left";
        } else if (talked) {
            // Checkmark
            ctx.fillStyle = "#56ff8f";
            ctx.beginPath();
            ctx.arc(npc.x, npc.y - 62, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0a2010";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText("✓", npc.x, npc.y - 58);
            ctx.textAlign = "left";
        }
    });
}

/* ── Interaction ────────────────────────────────── */
let nearbyNPC = null;
const interactHint = document.getElementById("interact-hint");

function checkNPCInteraction() {
    nearbyNPC = null;

    for (const npc of npcs) {
        const dx = player.x - npc.x;
        const dy = player.y - npc.y;
        if (Math.sqrt(dx * dx + dy * dy) < 65) {
            nearbyNPC = npc;
            break;
        }
    }

    if (nearbyNPC && !isDialogueOpen()) {
        interactHint.style.display = "block";
        interactHint.textContent = `Press E to talk to ${nearbyNPC.name}`;
    } else {
        interactHint.style.display = "none";
    }
}

window.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "e" && nearbyNPC && !isDialogueOpen()) {
        startDialogue(nearbyNPC.id);
    }
});
