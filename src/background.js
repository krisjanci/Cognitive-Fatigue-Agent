// background.js (service worker) — session state, rolling window, baseline, badge dot, reaction test storage.

const STORAGE_KEY = "fatigue_mvp_v1";

// 5-minute window
const WINDOW_MS = 5 * 60 * 1000;

// Thresholds (drop relative to baseline)
const YELLOW_DROP = 0.25;
const RED_DROP = 0.50;

// Baseline requirements (in-session)
const BASELINE_MIN_SEGMENTS = 30;

const BADGE = {
  GREEN: { text: "●", color: "#22c55e" },
  YELLOW: { text: "●", color: "#eab308" },
  RED: { text: "●", color: "#ef4444" },
  OFF: { text: "", color: "#000000" }
};

let state = {
  sessionOn: false,
  sessionStart: null,
  // mouse efficiency baseline (avg of early segments)
  baselineEff: null,
  baselineBuffer: [], // efficiencies until baseline is set
  // segments: { t, direct, actual, eff }
  segments: [],
  status: "off", // off|green|yellow|red
  reason: "",
  // reaction time
  baselineRT: null, // ms (set by first test in session)
  lastRT: null,
  lastRTDeltaPct: null,
  lastRecommendation: null, // "break"|"continue"|null
  lastRTTime: null
};

function now() {
  return Date.now();
}

function avg(arr) {
  if (!arr.length) return null;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

function clampSegmentsToRecent() {
  const cutoff = now() - WINDOW_MS;
  // keep all segments for history if you want; for MVP we keep all
  // but compute window using cutoff.
  return cutoff;
}

function windowEffAvg() {
  const cutoff = clampSegmentsToRecent();
  const win = state.segments.filter(s => s.t >= cutoff).map(s => s.eff).filter(Number.isFinite);
  return avg(win);
}

function computeStatusAndReason() {
  if (!state.sessionOn) {
    state.status = "off";
    state.reason = "";
    return;
  }
  if (state.baselineEff === null) {
    state.status = "green";
    state.reason = "Establishing baseline...";
    return;
  }
  const wAvg = windowEffAvg();
  if (wAvg === null) {
    state.status = "green";
    state.reason = "Not enough recent data.";
    return;
  }
  const drop = (state.baselineEff - wAvg) / state.baselineEff; // e.g. 0.25 means 25% drop
  if (drop >= RED_DROP) {
    state.status = "red";
    state.reason = `Mouse efficiency down ${(drop * 100).toFixed(0)}% vs baseline.`;
  } else if (drop >= YELLOW_DROP) {
    state.status = "yellow";
    state.reason = `Mouse efficiency down ${(drop * 100).toFixed(0)}% vs baseline.`;
  } else {
    state.status = "green";
    state.reason = "Normal mouse efficiency.";
  }
}

async function setBadge(status) {
  if (status === "green") {
    await chrome.action.setBadgeText({ text: BADGE.GREEN.text });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE.GREEN.color });
    return;
  }
  if (status === "yellow") {
    await chrome.action.setBadgeText({ text: BADGE.YELLOW.text });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE.YELLOW.color });
    return;
  }
  if (status === "red") {
    await chrome.action.setBadgeText({ text: BADGE.RED.text });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE.RED.color });
    return;
  }
  await chrome.action.setBadgeText({ text: BADGE.OFF.text });
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadState() {
  const obj = await chrome.storage.local.get([STORAGE_KEY]);
  if (obj && obj[STORAGE_KEY]) state = obj[STORAGE_KEY];
}

function resetSession() {
  state.sessionOn = true;
  state.sessionStart = now();
  state.baselineEff = null;
  state.baselineBuffer = [];
  state.segments = [];
  state.status = "green";
  state.reason = "Establishing baseline...";

  // Reaction time per-session baseline
  state.baselineRT = null;
  state.lastRT = null;
  state.lastRTDeltaPct = null;
  state.lastRecommendation = null;
  state.lastRTTime = null;
}

function stopSession() {
  state.sessionOn = false;
  state.status = "off";
  state.reason = "";
}

function maybeSetBaseline() {
  if (state.baselineEff !== null) return;
  if (state.baselineBuffer.length >= BASELINE_MIN_SEGMENTS) {
    state.baselineEff = avg(state.baselineBuffer);
    state.baselineBuffer = [];
  }
}

async function ingestSegment(seg) {
  if (!state.sessionOn) return;

  // Guard against weird values
  if (!Number.isFinite(seg.eff)) return;
  if (seg.eff <= 0 || seg.eff > 1.2) return; // efficiency should be ~0..1 (allow tiny headroom)

  state.segments.push(seg);

  if (state.baselineEff === null) {
    state.baselineBuffer.push(seg.eff);
    maybeSetBaseline();
  }

  computeStatusAndReason();
  await setBadge(state.status);
  await saveState();
}

function elapsedMs() {
  if (!state.sessionOn || !state.sessionStart) return 0;
  return now() - state.sessionStart;
}

function getPopupModel() {
  const model = {
    sessionOn: state.sessionOn,
    elapsedMs: elapsedMs(),
    status: state.status,
    reason: state.reason,
    baselineEff: state.baselineEff,
    windowEff: windowEffAvg(),
    baselineRT: state.baselineRT,
    lastRT: state.lastRT,
    lastRTDeltaPct: state.lastRTDeltaPct,
    lastRecommendation: state.lastRecommendation,
    lastRTTime: state.lastRTTime
  };
  return model;
}

async function handleReactionResult(rtMs) {
  if (!state.sessionOn) return { ok: false, error: "Session is off." };
  if (!Number.isFinite(rtMs) || rtMs <= 50 || rtMs > 3000) {
    return { ok: false, error: "Invalid reaction time." };
  }

  state.lastRT = rtMs;
  state.lastRTTime = now();

  // First test in a session becomes baseline
  if (state.baselineRT === null) {
    state.baselineRT = rtMs;
    state.lastRTDeltaPct = 0;
    state.lastRecommendation = "continue";
    await saveState();
    return { ok: true, baselineSet: true, baselineRT: rtMs, recommendation: "continue", deltaPct: 0 };
  }

  const deltaPct = (rtMs - state.baselineRT) / state.baselineRT; // +0.2 means 20% slower
  state.lastRTDeltaPct = deltaPct;

  if (deltaPct >= 0.20) {
    state.lastRecommendation = "break";
  } else {
    state.lastRecommendation = "continue";
  }

  await saveState();
  return {
    ok: true,
    baselineSet: false,
    baselineRT: state.baselineRT,
    recommendation: state.lastRecommendation,
    deltaPct
  };
}

// --- Boot ---
chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  await setBadge(state.status);
});

chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  await setBadge(state.status);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "START_SESSION") {
        resetSession();
        computeStatusAndReason();
        await setBadge(state.status);
        await saveState();
        sendResponse({ ok: true, model: getPopupModel() });
        return;
      }

      if (msg?.type === "STOP_SESSION") {
        stopSession();
        await setBadge(state.status);
        await saveState();
        sendResponse({ ok: true, model: getPopupModel() });
        return;
      }

      if (msg?.type === "GET_STATE") {
        await loadState();
        sendResponse({ ok: true, model: getPopupModel() });
        return;
      }

      if (msg?.type === "MOUSE_SEGMENT") {
        await ingestSegment(msg.segment);
        sendResponse({ ok: true });
        return;
      }

      if (msg?.type === "REACTION_RESULT") {
        const res = await handleReactionResult(msg.rtMs);
        sendResponse(res);
        return;
      }

      if (msg?.type === "OPEN_TEST_PAGE") {
        const url = chrome.runtime.getURL("test.html");
        await chrome.tabs.create({ url });
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type." });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true; // keep channel open for async
});
