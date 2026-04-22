// content.js
// Tracks click-to-click mouse efficiency and sends timestamped segments to background.

let lastMove = null;
let lastClick = null;
let path = 0;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

addEventListener("mousemove", (e) => {
  const p = { x: e.clientX, y: e.clientY };

  if (lastMove) {
    const d = dist(p, lastMove);
    if (Number.isFinite(d) && d >= 0 && d < 2000) {
      path += d;
    }
  }

  lastMove = p;
}, { passive: true });

addEventListener("click", (e) => {
  const c = { x: e.clientX, y: e.clientY };
  const now = Date.now();

  if (lastClick) {
    const direct = dist(c, lastClick);
    const actual = path;

    if (Number.isFinite(direct) && Number.isFinite(actual) && actual > 0.5) {
      const eff = direct / actual;

      chrome.runtime.sendMessage({
        type: "EFF_SEGMENT",
        segment: {
          t: now,
          eff,
          direct,
          actual
        }
      }).catch(() => {});
    }
  }

  lastClick = c;
  lastMove = c;
  path = 0;
}, { passive: true });