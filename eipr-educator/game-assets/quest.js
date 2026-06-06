/* ==================================================
   quest.js – XP, Level, Badge, Journal, Inventory,
              Save/Load, Day/Night, "What You Learnt"
   ================================================== */

const QuestSystem = (() => {

    /* ── State ─────────────────────────────────── */
    let state = {
        xp: 0,
        level: 1,
        day: 1,
        session: 1,
        timeOfDay: 0,          // 0-24 hour cycle (sped up)
        inventory: [],
        badges: {},
        quests: {},
        sessionProgress: {
            // Session 1
            farmer: false, teacher: false,
            merchant: false, student: false,
            elderComplete: false,
            // Session 2
            inventor: false, social: false,
            online: false, smallbiz: false,
            guildComplete: false,
            // Session 3
            spirit1: false, spirit2: false,
            spirit3: false, spirit4: false,
            bossDefeated: false,
            // Session 4
            teamLeader: false, investor: false,
            engineer: false, hillsComplete: false,
            // Session 5
            finalBoss: false
        }
    };

    /* ── XP Table ──────────────────────────────── */
    const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
    const XP_REWARDS = {
        talk_npc: 15,
        quest_npc: 25,
        complete_quest: 80,
        complete_session: 150,
        boss_fight: 200,
        pick_item: 10
    };

    /* ── Badges Definition ─────────────────────── */
    const BADGES_DEF = [
        { id: "first_talk",   name: "First Words",      icon: "💬", desc: "Talk to your first NPC" },
        { id: "village_hero", name: "Village Hero",     icon: "🏘", desc: "Complete Session 1" },
        { id: "guild_member", name: "Guild Member",     icon: "⚒",  desc: "Complete Session 2" },
        { id: "myth_slayer",  name: "Myth Slayer",      icon: "🐉", desc: "Defeat the Myth Keeper" },
        { id: "startup_star", name: "Startup Star",     icon: "🚀", desc: "Complete Session 4" },
        { id: "valley_champ", name: "Valley Champion",  icon: "🏆", desc: "Complete all 5 Sessions" },
        { id: "speed_talker", name: "Speed Talker",     icon: "⚡", desc: "Talk to 10 NPCs in one session" },
        { id: "collector",    name: "Collector",        icon: "🎒", desc: "Collect 5 items" },
        { id: "level5",       name: "Scholar",          icon: "📚", desc: "Reach Level 5" },
        { id: "level10",      name: "Master",           icon: "🎓", desc: "Reach Level 10" }
    ];

    /* ── Quest Definitions ─────────────────────── */
    const QUESTS_DEF = [
        {
            id: "s1_main",
            session: 1,
            title: "Voices of the Village",
            desc: "Speak with the Farmer, Teacher, Merchant and Student to learn why Dreamer's Village is struggling.",
            objectives: [
                { id: "farmer",   label: "Talk to Farmer" },
                { id: "teacher",  label: "Talk to Teacher" },
                { id: "merchant", label: "Talk to Merchant" },
                { id: "student",  label: "Talk to Student" }
            ],
            reward: { xp: 80, item: { icon: "📄", name: "Problem Report" } },
            completeWith: "elder"
        },
        {
            id: "s2_guild",
            session: 2,
            title: "The Entrepreneur's Guild",
            desc: "Visit the Guild and learn about the four types of entrepreneurs from Professor Spark's team.",
            objectives: [
                { id: "inventor",  label: "Meet the Inventor" },
                { id: "social",    label: "Meet the Social Entrepreneur" },
                { id: "online",    label: "Meet the Online Entrepreneur" },
                { id: "smallbiz",  label: "Meet the Small Business Owner" }
            ],
            reward: { xp: 120, item: { icon: "📖", name: "Entrepreneur's Handbook" } },
            completeWith: "prof_spark"
        },
        {
            id: "s3_myth",
            session: 3,
            title: "The Myth Forest Trials",
            desc: "Confront the Myth Spirits who test whether you truly understand entrepreneurship.",
            objectives: [
                { id: "spirit1", label: "Face Spirit of Risk" },
                { id: "spirit2", label: "Face Spirit of Failure" },
                { id: "spirit3", label: "Face Spirit of Competition" },
                { id: "spirit4", label: "Face Spirit of Doubt" }
            ],
            reward: { xp: 150, item: { icon: "🔮", name: "Crystal of Clarity" } },
            completeWith: "myth_keeper"
        },
        {
            id: "s4_hills",
            session: 4,
            title: "Startup Hills Leadership",
            desc: "Join the startup camps and prove your entrepreneurial qualities.",
            objectives: [
                { id: "teamLeader", label: "Train with Team Leader" },
                { id: "investor",   label: "Pitch to the Investor" },
                { id: "engineer",   label: "Build with the Engineer" }
            ],
            reward: { xp: 180, item: { icon: "🏗", name: "Blueprint of Innovation" } },
            completeWith: "startup_mentor"
        },
        {
            id: "s5_peak",
            session: 5,
            title: "Vision Peak – Final Challenge",
            desc: "Ascend to Vision Peak and prove you have mastered entrepreneurship.",
            objectives: [
                { id: "finalBoss", label: "Defeat the Myth Keeper" }
            ],
            reward: { xp: 300, item: { icon: "👑", name: "Crown of the Valley" } },
            completeWith: null
        }
    ];

    /* ── "What You Learnt" Content ─────────────── */
    const LEARNT = {
        s1_main: [
            "Entrepreneurship means identifying problems in your community",
            "Entrepreneurs create value by solving real needs, not just making money",
            "Problems are opportunities in disguise — every villager's struggle is a chance to innovate"
        ],
        s2_guild: [
            "There are four main types of entrepreneurs: Inventor, Social, Online & Small Business",
            "Each type creates value differently — through tech, society, digital platforms, or local trade",
            "Choosing the right entrepreneurship path depends on your skills, passion, and resources"
        ],
        s3_myth: [
            "Entrepreneurship involves calculated risk — not recklessness",
            "Failure is a teacher, not a dead end. Most successful entrepreneurs failed many times first",
            "Competition drives innovation — use it as motivation, not a reason to quit"
        ],
        s4_hills: [
            "Leadership, teamwork, creativity and resilience are core entrepreneurial qualities",
            "Investors look for passion, market understanding and a solid plan",
            "Building a startup requires multiple skills — collaboration is key"
        ],
        s5_peak: [
            "You have mastered the fundamentals of Entrepreneurship and Innovation from EIPR",
            "The valley's transformation mirrors real-world entrepreneurial impact",
            "Your journey is just beginning — apply these lessons in the real world!"
        ]
    };

    /* ── Helpers ───────────────────────────────── */
    function saveGame() {
        try {
            localStorage.setItem("eipr_save", JSON.stringify(state));
        } catch(e) {}
    }

    function loadGame() {
        try {
            const raw = localStorage.getItem("eipr_save");
            if (raw) {
                const loaded = JSON.parse(raw);
                Object.assign(state, loaded);
            }
        } catch(e) {}
    }

    function updateHUD() {
        const nextXp = XP_PER_LEVEL[Math.min(state.level, XP_PER_LEVEL.length - 1)];
        const prevXp = XP_PER_LEVEL[Math.min(state.level - 1, XP_PER_LEVEL.length - 1)] || 0;
        const pct = Math.min(100, ((state.xp - prevXp) / (nextXp - prevXp)) * 100);
        document.getElementById("xp-fill").style.width = pct + "%";
        document.getElementById("xp-text").textContent = `${state.xp} / ${nextXp} XP`;
        document.getElementById("level-label").textContent = `Level ${state.level}`;
        document.getElementById("session-label").textContent = `📖 Session ${state.session}`;
        document.getElementById("day-label").textContent = `${getDayIcon()} Day ${state.day}`;
    }

    function getDayIcon() {
        const h = state.timeOfDay;
        if (h < 6 || h >= 20) return "🌙";
        if (h < 10) return "🌅";
        if (h < 17) return "🌤";
        return "🌇";
    }

    function addXP(amount, reason) {
        state.xp += amount;
        const nextLevel = state.level + 1;
        const needed = XP_PER_LEVEL[Math.min(nextLevel, XP_PER_LEVEL.length - 1)];
        if (state.xp >= needed && state.level < 10) {
            state.level++;
            showLevelUp();
            if (state.level >= 5) awardBadge("level5");
            if (state.level >= 10) awardBadge("level10");
        }
        updateHUD();
        saveGame();
    }

    function showLevelUp() {
        const popup = document.getElementById("levelup-popup");
        document.getElementById("levelup-sub").textContent = `You reached Level ${state.level}!`;
        popup.classList.remove("hidden");
        setTimeout(() => popup.classList.add("hidden"), 2600);
    }

    function awardBadge(id) {
        if (state.badges[id]) return;
        state.badges[id] = true;
        saveGame();
        // Small toast
        showToast("🏅 Badge Unlocked: " + (BADGES_DEF.find(b => b.id === id)?.name || id));
    }

    function showToast(msg) {
        const t = document.createElement("div");
        t.style.cssText = `
            position:fixed; bottom:200px; left:50%; transform:translateX(-50%);
            background:rgba(14,10,30,0.92); border:1.5px solid rgba(255,220,80,0.4);
            color:#ffe566; padding:9px 20px; border-radius:12px; font-size:13px;
            z-index:999; pointer-events:none; font-weight:600;
            animation: toastFade 2.4s ease forwards;
        `;
        t.textContent = msg;
        const style = document.createElement("style");
        style.textContent = `@keyframes toastFade { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 15%{opacity:1;transform:translateX(-50%) translateY(0)} 80%{opacity:1} 100%{opacity:0} }`;
        document.head.appendChild(style);
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }

    function markNPCTalked(npcId) {
        if (state.sessionProgress.hasOwnProperty(npcId)) {
            if (!state.sessionProgress[npcId]) {
                state.sessionProgress[npcId] = true;
                addXP(XP_REWARDS.quest_npc);
                // first-talk badge
                if (Object.values(state.sessionProgress).filter(Boolean).length === 1) {
                    awardBadge("first_talk");
                }
                updateQuestPanel();
                saveGame();
            }
        }
    }

    function updateQuestPanel() {
        const p = state.sessionProgress;
        const doneMap = {
            "obj-farmer":   p.farmer,
            "obj-teacher":  p.teacher,
            "obj-merchant": p.merchant,
            "obj-student":  p.student,
            "obj-inventor": p.inventor,
            "obj-social":   p.social,
            "obj-online":   p.online,
            "obj-smallbiz": p.smallbiz
        };
        for (const [id, done] of Object.entries(doneMap)) {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("done", done);
        }
    }

    function checkQuestComplete(completingNpcId) {
        const quest = QUESTS_DEF.find(q => q.completeWith === completingNpcId && !state.quests[q.id]);
        if (!quest) return false;
        const allDone = quest.objectives.every(obj => state.sessionProgress[obj.id]);
        return allDone ? quest : false;
    }

    function completeQuest(quest) {
        state.quests[quest.id] = "complete";
        addXP(quest.reward.xp);
        if (quest.reward.item) addItem(quest.reward.item);
        state.session = Math.min(5, state.session + 1);
        showLearntPopup(quest.id);

        // Badge unlocks
        if (quest.id === "s1_main") { awardBadge("village_hero"); state.sessionProgress.elderComplete = true; }
        if (quest.id === "s2_guild") { awardBadge("guild_member"); state.sessionProgress.guildComplete = true; }
        if (quest.id === "s3_myth")  { awardBadge("myth_slayer"); state.sessionProgress.bossDefeated = true; }
        if (quest.id === "s4_hills") { awardBadge("startup_star"); state.sessionProgress.hillsComplete = true; }
        if (quest.id === "s5_peak")  { awardBadge("valley_champ"); state.sessionProgress.finalBoss = true; }

        saveGame();
    }

    function showLearntPopup(questId) {
        const items = LEARNT[questId] || [];
        const content = document.getElementById("learnt-content");
        content.innerHTML = "";
        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "learnt-item";
            div.textContent = "📌 " + item;
            content.appendChild(div);
        });
        document.getElementById("learnt-popup").classList.remove("hidden");
    }

    function addItem(item) {
        state.inventory.push(item);
        if (state.inventory.length >= 5) awardBadge("collector");
        saveGame();
    }

    /* ── Day/Night Cycle ────────────────────────── */
    let lastDayTick = 0;
    function updateDayNight(timestamp) {
        if (timestamp - lastDayTick > 1800) { // every ~1.8s = 1 in-game hour
            lastDayTick = timestamp;
            state.timeOfDay = (state.timeOfDay + 1) % 24;
            if (state.timeOfDay === 0) state.day++;
            updateHUD();
            applyDayNightVisual();
        }
    }

    function applyDayNightVisual() {
        const h = state.timeOfDay;
        const overlay = document.getElementById("daynight-overlay");
        let color = "rgba(0,0,0,0)";
        if (h >= 20 || h < 5) color = "rgba(5, 0, 30, 0.55)";      // night
        else if (h < 7) color = "rgba(30, 15, 60, 0.30)";            // dawn
        else if (h >= 17) color = "rgba(80, 30, 0, 0.20)";           // dusk
        overlay.style.background = color;
    }

    /* ── Render Badge Grid ─────────────────────── */
    function renderBadges() {
        const grid = document.getElementById("badge-grid");
        grid.innerHTML = "";
        BADGES_DEF.forEach(b => {
            const div = document.createElement("div");
            div.className = "badge-item" + (state.badges[b.id] ? "" : " locked");
            div.title = b.desc;
            div.innerHTML = `<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div>`;
            grid.appendChild(div);
        });
    }

    /* ── Render Inventory ──────────────────────── */
    function renderInventory() {
        const grid = document.getElementById("inventory-grid");
        grid.innerHTML = "";
        const SLOTS = 16;
        for (let i = 0; i < SLOTS; i++) {
            const slot = document.createElement("div");
            const item = state.inventory[i];
            slot.className = "inv-slot" + (item ? " filled" : "");
            if (item) {
                slot.innerHTML = `<div class="inv-icon">${item.icon}</div><div class="inv-label">${item.name}</div>`;
            }
            grid.appendChild(slot);
        }
    }

    /* ── Render Quest Journal ──────────────────── */
    function renderJournal() {
        const content = document.getElementById("journal-content");
        content.innerHTML = "";
        QUESTS_DEF.forEach(q => {
            const status = state.quests[q.id];
            const div = document.createElement("div");
            div.className = "journal-quest " + (status === "complete" ? "complete" : "active");
            const allDone = q.objectives.every(obj => state.sessionProgress[obj.id]);
            div.innerHTML = `
                <div class="jq-title">${q.title}</div>
                <div class="jq-desc">${q.desc}</div>
                <div class="jq-status">${status === "complete" ? "✅ Completed" : allDone ? "⏳ Return to complete" : "🔲 In Progress"}</div>
            `;
            content.appendChild(div);
        });
    }

    /* ── Public API ────────────────────────────── */
    return {
        init() {
            loadGame();
            updateHUD();
            updateQuestPanel();

            // Overlay buttons
            document.getElementById("btn-journal").addEventListener("click", () => {
                renderJournal();
                document.getElementById("journal-overlay").classList.toggle("hidden");
            });
            document.getElementById("btn-badges").addEventListener("click", () => {
                renderBadges();
                document.getElementById("badge-overlay").classList.toggle("hidden");
            });
            document.getElementById("btn-inventory").addEventListener("click", () => {
                renderInventory();
                document.getElementById("inventory-overlay").classList.toggle("hidden");
            });
            document.querySelectorAll(".close-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const target = btn.dataset.target;
                    document.getElementById(target)?.classList.add("hidden");
                });
            });
            document.getElementById("learnt-close-btn").addEventListener("click", () => {
                document.getElementById("learnt-popup").classList.add("hidden");
            });

            // Press J / B / I shortcuts
            window.addEventListener("keydown", e => {
                if (e.key.toLowerCase() === "j") document.getElementById("btn-journal").click();
                if (e.key.toLowerCase() === "b") document.getElementById("btn-badges").click();
                if (e.key.toLowerCase() === "i") document.getElementById("btn-inventory").click();
            });
        },

        tick(ts) { updateDayNight(ts); },
        markNPCTalked,
        checkQuestComplete,
        completeQuest,
        addXP,
        addItem,
        awardBadge,
        showToast,
        getState: () => state
    };
})();
