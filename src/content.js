// content.js — tracks cursor movement and clicks to build efficiency segments.
// Efficiency segment is computed per pair of consecutive clicks:
//   direct = distance(click_i, click_{i-1})
//   actual = total cursor path length between those clicks
//   eff = direct / actual

let lastMove = null;
let lastClick = null;
let pathSinceLastClick = 0;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function safeSendSegment(segment) {
  chrome.runtime.sendMessage({ type: "MOUSE_SEGMENT", segment }).catch(() => {
    // ignore if extension context is temporarily unavailable
  });
}

window.addEventListener(
  "mousemove",
  (e) => {
    const p = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (lastMove) {
      const d = dist(p, lastMove);
      // ignore insane jumps (multi-monitor / teleports)
      if (Number.isFinite(d) && d < 2000) pathSinceLastClick += d;
    }
    lastMove = p;
  },
  { passive: true }
);

window.addEventListener(
  "click",
  (e) => {
    const click = { x: e.clientX, y: e.clientY, t: Date.now() };

    if (lastClick) {
      const direct = dist(click, lastClick);
      const actual = pathSinceLastClick;

      // Avoid divide-by-zero or meaningless segments
      if (actual > 5 && direct >= 0) {
        const eff = direct / actual;

        safeSendSegment({
          t: click.t,
          direct,
          actual,
          eff
        });
      }
    }

    // Reset for next segment
    lastClick = click;
    pathSinceLastClick = 0;
    lastMove = click;
  },
  { passive: true }
);
