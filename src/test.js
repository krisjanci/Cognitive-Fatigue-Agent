const TRIALS = 5;
const MIN_WAIT_MS = 2000;
const MAX_WAIT_MS = 5000;

const stageEl = document.getElementById("stage");
const btnStart = document.getElementById("btnStart");
const resultEl = document.getElementById("result");
const recEl = document.getElementById("rec");

let trial = 0;
let waiting = false;
let goTime = null;
let timeoutId = null;
let times = [];
let armed = false;

function randInt(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function setStage(text, cls) {
  stageEl.className = `stage ${cls}`;
  stageEl.textContent = text;
}

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 1) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

function clearTimer() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
}

function startTrial() {
  clearTimer();
  armed = true;
  waiting = true;
  goTime = null;

  setStage(`Trial ${trial + 1}/${TRIALS}: Wait for green...`, "wait");
  const waitMs = randInt(MIN_WAIT_MS, MAX_WAIT_MS);

  timeoutId = setTimeout(() => {
    waiting = false;
    goTime = performance.now();
    setStage("CLICK NOW!", "go");
  }, waitMs);
}

async function submitResult(rtMs) {
  const res = await chrome.runtime.sendMessage({ type: "REACTION_RESULT", rtMs });

  if (!res.ok) {
    recEl.textContent = `Error: ${res.error}`;
    return;
  }

  if (res.baselineSet) {
    recEl.textContent = `Baseline set for this session: ${Math.round(res.baselineRT)}ms. Recommendation: CONTINUE`;
  } else {
    const pct = (res.deltaPct * 100).toFixed(0);
    const rec = res.recommendation === "break" ? "TAKE A BREAK" : "CONTINUE";
    recEl.textContent = `Baseline: ${Math.round(res.baselineRT)}ms | Δ: ${pct}% | Recommendation: ${rec}`;
  }
}

function finish() {
  const med = median(times);
  resultEl.textContent = `Times: ${times.map(t => Math.round(t)).join("ms, ")}ms.  Median = ${Math.round(med)}ms.`;

  // Send median as the session reaction time result
  submitResult(med).catch(() => {});
  setStage("Done. You can close this tab.", "ready");
  btnStart.disabled = false;
  btnStart.textContent = "Run Again";
  armed = false;
}

function resetRun() {
  trial = 0;
  times = [];
  resultEl.textContent = "";
  recEl.textContent = "";
}

btnStart.addEventListener("click", () => {
  btnStart.disabled = true;
  btnStart.textContent = "Running...";
  resetRun();
  startTrial();
});

stageEl.addEventListener("click", () => {
  if (!armed) return;

  // clicked too early
  if (waiting) {
    clearTimer();
    setStage("Too early — wait for green. Click Start to try again.", "ready");
    btnStart.disabled = false;
    btnStart.textContent = "Start";
    armed = false;
    return;
  }

  if (goTime === null) return;

  const rt = performance.now() - goTime;
  times.push(rt);
  trial += 1;

  if (trial >= TRIALS) {
    finish();
  } else {
    setStage(`Recorded: ${Math.round(rt)}ms. Next trial starting...`, "ready");
    setTimeout(startTrial, 600);
  }
});
