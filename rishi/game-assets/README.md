# EIPR RPG — Entrepreneurship Valley

A full educational RPG game teaching Entrepreneurship, Innovation, and Problem Recognition (EIPR).

## ▶ Run the Game

```powershell
cd game-assets
python -m http.server 8001
```

Then open **http://localhost:8001** in your browser.

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `W A S D` or `Arrow Keys` | Move player |
| `E` | Talk to nearby NPC |
| `Escape` | Close dialogue |
| `J` | Open Quest Journal |
| `B` | Open Badges |
| `I` | Open Inventory |

---

## 🗺 World Map

```
Vision Peak        (y ~80)    – Final Boss: Myth Keeper
Myth Forest        (y ~350)   – 4 Spirits + Ancient Shrine  [Session 3]
Startup Hills      (y ~950)   – Team Leader, Investor, Engineer [Session 4]
Entrepreneur Guild (y ~1550)  – Prof. Spark, Asha, Ravi, Mr. Kumar, Priya [Session 2]
Dreamer's Village  (y ~2050)  – Elder, Farmer, Teacher, Merchant, Student [Session 1]
```

---

## 📚 Sessions

| Session | Zone | Quest |
|---------|------|-------|
| 1 | Dreamer's Village | Talk to 4 villagers → Report to Elder |
| 2 | Entrepreneur Guild | Meet 4 entrepreneur types → Prof. Spark |
| 3 | Myth Forest | Defeat 4 Spirits → Myth Keeper boss |
| 4 | Startup Hills | Train with Leader, Investor, Engineer |
| 5 | Vision Peak | Final challenge |

---

## 🏅 Badges

- 💬 First Words — Talk to first NPC  
- 🏘 Village Hero — Complete Session 1  
- ⚒ Guild Member — Complete Session 2  
- 🐉 Myth Slayer — Defeat the Myth Keeper  
- 🚀 Startup Star — Complete Session 4  
- 🏆 Valley Champion — Complete all 5 Sessions  
- ⚡ Speed Talker — Talk to 10 NPCs  
- 🎒 Collector — Collect 5 items  
- 📚 Scholar — Reach Level 5  
- 🎓 Master — Reach Level 10  

---

## 💾 Save System

Progress is **auto-saved** to browser `localStorage` after every NPC interaction, quest completion, XP gain, and item pickup.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Game shell — all HUD panels |
| `style.css` | RPG UI styling (Cinzel font, glassmorphism) |
| `quest.js` | XP, level, badges, journal, inventory, save/load, day/night |
| `assets.js` | Draw helpers + roundRect polyfill |
| `npc.js` | All 20 NPCs, wander AI, interaction detection |
| `dialogue.js` | All 5 sessions of dialogues, choice engine, typewriter |
| `world.js` | Canvas engine, 5 zones, collision, minimap, game loop |
