// bg.js
// Session manager + raw mouse segments + 5-minute mouse efficiency + reaction-time storage
// No badge logic.

const KEY = "fatigue_ch4_data_v4";
const FIVE_MIN_MS = 5 * 60 * 1000;

let S = {
  on: false,
  start: 0,

  // Rolling recent segments used for current 5-minute efficiency
  segments: [],

  // Full raw mouse data for export
  rawSegments: [],

  // Saved reaction checkpoints
  // Each result stores:
  // - timestamp
  // - mean RT
  // - all 8 individual RT trials
  // - 5-minute efficiency
  results: [],

  lastReactionTimeMean: null
};

function now() {
  return Date.now();
}

function pruneOldSegments() {
  const cutoff = now() - FIVE_MIN_MS;
  S.segments = S.segments.filter(s => s.t >= cutoff);
}

function efficiencyFromSegments(segments) {
  if (!segments.length) return null;

  let totalDirect = 0;
  let totalActual = 0;

  for (const s of segments) {
    totalDirect += s.direct;
    totalActual += s.actual;
  }

  if (!Number.isFinite(totalActual) || totalActual <= 0) return null;
  return totalDirect / totalActual;
}

function efficiencyLast5Min() {
  pruneOldSegments();
  return efficiencyFromSegments(S.segments);
}

function rawSegmentsLast5Min() {
  const cutoff = now() - FIVE_MIN_MS;
  return S.rawSegments.filter(s => s.t >= cutoff);
}

function model() {
  pruneOldSegments();

  return {
    on: S.on,
    elapsedMs: S.on ? (now() - S.start) : 0,
    last5MinEfficiency: efficiencyLast5Min(),
    lastReactionTimeMean: S.lastReactionTimeMean,
    resultCount: S.results.length,
    rawSegmentCount: S.rawSegments.length
  };
}

async function load() {
  const o = await chrome.storage.local.get(KEY);
  if (o[KEY]) {
    S = o[KEY];
  }
}

async function save() {
  await chrome.storage.local.set({ [KEY]: S });
}

async function startSession() {
  S.on = true;
  S.start = now();
  S.segments = [];
  S.rawSegments = [];
  S.results = [];
  S.lastReactionTimeMean = null;
  await save();
}

async function stopSession() {
  S.on = false;
  await save();
}

async function ingestSegment(segment) {
  if (!S.on) return;

  if (
    !segment ||
    !Number.isFinite(segment.eff) ||
    !Number.isFinite(segment.direct) ||
    !Number.isFinite(segment.actual) ||
    segment.actual <= 0 ||
    segment.eff <= 0 ||
    segment.eff > 1.2
  ) {
    return;
  }

  const cleanSegment = {
    t: Number.isFinite(segment.t) ? segment.t : now(),
    eff: segment.eff,
    direct: segment.direct,
    actual: segment.actual
  };

  // Rolling 5-minute window
  S.segments.push(cleanSegment);

  // Full session raw history
  S.rawSegments.push(cleanSegment);

  pruneOldSegments();
  await save();
}

async function saveReactionTime(rtMeanMs, rtTrialsMs) {
  if (!S.on) {
    return { ok: false, error: "Session is off" };
  }

  if (!Number.isFinite(rtMeanMs) || rtMeanMs < 80 || rtMeanMs > 3000) {
    return { ok: false, error: "Invalid mean reaction time" };
  }

  if (!Array.isArray(rtTrialsMs) || rtTrialsMs.length !== 8) {
    return { ok: false, error: "Expected exactly 8 reaction-time trials" };
  }

  for (const x of rtTrialsMs) {
    if (!Number.isFinite(x) || x < 80 || x > 3000) {
      return { ok: false, error: "Invalid individual reaction-time trial" };
    }
  }

  const last5Raw = rawSegmentsLast5Min();
  const eff5 = efficiencyFromSegments(last5Raw);

  const entry = {
    t: now(),
    reactionTimeMeanMs: rtMeanMs,
    reactionTimeTrialsMs: rtTrialsMs,
    efficiency5m: eff5,
    rawSegmentCount5m: last5Raw.length
  };

  S.lastReactionTimeMean = rtMeanMs;
  S.results.push(entry);

  await save();

  return { ok: true, entry };
}

function buildExportObject() {
  return {
    metadata: {
      exportedAt: now(),
      sessionStartedAt: S.start,
      sessionEndedAt: now(),
      totalRawSegments: S.rawSegments.length,
      totalReactionResults: S.results.length,
      windowSizeMs: FIVE_MIN_MS,
      reactionTrialsPerTest: 8,
      reactionSummaryStatistic: "mean"
    },
    rawSegments: S.rawSegments,
    reactionResults: S.results
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  await load();
});

chrome.runtime.onStartup.addListener(async () => {
  await load();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    await load();

    if (msg?.type === "START") {
      await startSession();
      return sendResponse({ ok: true, model: model() });
    }

    if (msg?.type === "STOP") {
      await stopSession();
      return sendResponse({ ok: true, model: model() });
    }

    if (msg?.type === "STATE") {
      return sendResponse({ ok: true, model: model() });
    }

    if (msg?.type === "EFF_SEGMENT") {
      await ingestSegment(msg.segment);
      return sendResponse({ ok: true });
    }

    if (msg?.type === "SAVE_RT") {
      const res = await saveReactionTime(msg.rtMeanMs, msg.rtTrialsMs);
      return sendResponse(res);
    }

    if (msg?.type === "EXPORT_RESULTS") {
      return sendResponse({
        ok: true,
        exportData: buildExportObject()
      });
    }

    return sendResponse({ ok: false, error: "Unknown message type" });
  })();

  return true;
});