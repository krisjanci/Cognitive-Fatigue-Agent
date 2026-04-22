function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function fmtNum(x, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}

async function sendMessage(msg) {
  return await chrome.runtime.sendMessage(msg);
}

function showDash() {
  document.getElementById("screenDash").classList.remove("hidden");
  document.getElementById("screenTest").classList.add("hidden");
}

function showTest() {
  document.getElementById("screenDash").classList.add("hidden");
  document.getElementById("screenTest").classList.remove("hidden");
}

function render(m) {
  document.getElementById("status").textContent = m.on ? "ON" : "OFF";
  document.getElementById("on").textContent = m.on ? "ON" : "OFF";
  document.getElementById("elapsed").textContent = fmtMs(m.elapsedMs);
  document.getElementById("eff5").textContent = fmtNum(m.last5MinEfficiency);
  document.getElementById("rtLast").textContent =
    Number.isFinite(m.lastReactionTimeMean) ? `${Math.round(m.lastReactionTimeMean)} ms` : "—";
  document.getElementById("resultCount").textContent = String(m.resultCount ?? 0);
  document.getElementById("rawCount").textContent = String(m.rawSegmentCount ?? 0);
  document.getElementById("note").textContent =
    "Exports raw mouse segments, 5-minute efficiency values, reaction-test means, and every individual reaction-time trial.";

  const btn = document.getElementById("btnToggle");
  btn.textContent = m.on ? "Stop Session" : "Start Session";
  btn.className = m.on ? "stop" : "start";
}

async function refresh() {
  const res = await sendMessage({ type: "STATE" });
  if (res?.ok) render(res.model);
}

document.getElementById("btnToggle").addEventListener("click", async () => {
  const state = await sendMessage({ type: "STATE" });
  if (!state?.ok) return;

  const res = state.model.on
    ? await sendMessage({ type: "STOP" })
    : await sendMessage({ type: "START" });

  if (res?.ok) render(res.model);
});

document.getElementById("btnGoTest").addEventListener("click", () => {
  resetTestUI();
  showTest();
});

document.getElementById("btnBack").addEventListener("click", () => {
  showDash();
});

document.getElementById("btnExport").addEventListener("click", async () => {
  const res = await sendMessage({ type: "EXPORT_RESULTS" });
  if (!res?.ok) return;

  const blob = new Blob([JSON.stringify(res.exportData, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: `fatigue_results_${Date.now()}.json`,
    saveAs: true
  });
});

/* ---------------- Reaction test ---------------- */

const TRIALS = 8;
const MIN_WAIT = 1000;
const MAX_WAIT = 2500;

const stage = document.getElementById("stage");
const btnStartTest = document.getElementById("btnStartTest");
const timesOut = document.getElementById("timesOut");
const saveOut = document.getElementById("saveOut");

let trial = 0;
let times = [];
let waiting = false;
let goTime = null;
let timer = null;

function rand(a, b) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function mean(arr) {
  if (!arr.length) return null;
  const sum = arr.reduce((acc, x) => acc + x, 0);
  return sum / arr.length;
}

function setStage(text, cls) {
  stage.className = `stage ${cls}`;
  stage.textContent = text;
}

function resetTestUI() {
  trial = 0;
  times = [];
  waiting = false;
  goTime = null;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  timesOut.textContent = "";
  saveOut.textContent = "";
  btnStartTest.disabled = false;
  btnStartTest.textContent = "Start";
  setStage("Press Start.", "ready");
}

function startTrial() {
  waiting = true;
  goTime = null;
  setStage(`Trial ${trial + 1}/${TRIALS}: wait for green...`, "wait");

  timer = setTimeout(() => {
    waiting = false;
    goTime = performance.now();
    setStage("CLICK NOW!", "go");
  }, rand(MIN_WAIT, MAX_WAIT));
}

btnStartTest.addEventListener("click", () => {
  resetTestUI();
  btnStartTest.disabled = true;
  btnStartTest.textContent = "Running...";
  setStage("Get ready...", "ready");
  setTimeout(startTrial, 400);
});

stage.addEventListener("click", async () => {
  if (waiting) {
    if (timer) clearTimeout(timer);
    btnStartTest.disabled = false;
    btnStartTest.textContent = "Start";
    setStage("Too early. Press Start again.", "ready");
    return;
  }

  if (goTime === null) return;

  const rt = performance.now() - goTime;
  times.push(rt);
  trial++;

  if (trial >= TRIALS) {
    const rtMean = mean(times);

    timesOut.textContent =
      `Times: ${times.map(x => Math.round(x)).join(" ms, ")} ms | Mean: ${Math.round(rtMean)} ms`;

    const res = await sendMessage({
      type: "SAVE_RT",
      rtMeanMs: rtMean,
      rtTrialsMs: times.map(x => Math.round(x))
    });

    if (res?.ok) {
      const effText = Number.isFinite(res.entry.efficiency5m)
        ? res.entry.efficiency5m.toFixed(3)
        : "—";

      saveOut.textContent =
        `Saved → RT mean: ${Math.round(res.entry.reactionTimeMeanMs)} ms | Efficiency(5m): ${effText}`;
    } else {
      saveOut.textContent = `Error: ${res?.error || "Could not save result"}`;
    }

    btnStartTest.disabled = false;
    btnStartTest.textContent = "Run Again";
    setStage("Done. Click Back to return.", "ready");
    refresh();
    return;
  }

  setStage(`Recorded ${Math.round(rt)} ms. Next...`, "ready");
  setTimeout(startTrial, 600);
});

/* ---------------- Start ---------------- */

showDash();
refresh();
setInterval(refresh, 1000);