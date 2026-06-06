/* ==================================================
   assets.js – Shared sprite draw helpers
   Called by world.js after ctx/canvas are set up
   ================================================== */

/* These functions are optional helpers.
   The main drawing is done inline in world.js/npc.js.
   Kept here for any future sprite extensions. */

// Draw a rounded rect (polyfill for older browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === "number") r = [r, r, r, r];
        else if (!Array.isArray(r)) r = [0, 0, 0, 0];
        const [tl = 0, tr = 0, br = 0, bl = 0] = r;
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// Sprite definitions (for future spritesheet support)
const Assets = {
    player: {
        headRadius: 15,
        bodyWidth: 20,
        bodyHeight: 30,
        headColor: "#FFD8B0",
        shirtColor: "#3478F6",
        pantColor: "#1D4ED8"
    },
    npc: {
        headRadius: 13,
        bodyWidth: 20,
        bodyHeight: 28,
        headColor: "#FFD8B0"
    },
    tree: {
        trunkWidth: 8,
        trunkHeight: 16,
        trunkColor: "#6B4F2A",
        leafColor: "#2E7D32"
    },
    questMarker: {
        radius: 9,
        color: "#FFD700"
    }
};