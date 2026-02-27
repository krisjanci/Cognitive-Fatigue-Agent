function fmtMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  
  function fmtNum(x) {
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(3);
  }
  
  function statusLabel(s) {
    if (!s) return "OFF";
    return s.toUpperCase();
  }
  
  async function getState() {
    return await chrome.runtime.sendMessage({ type: "GET_STATE" });
  }
  
  async function startSession() {
    return await chrome.runtime.sendMessage({ type: "START_SESSION" });
  }
  
  async function stopSession() {
    return await chrome.runtime.sendMessage({ type: "STOP_SESSION" });
  }
  
  async function openTest() {
    return await chrome.runtime.sendMessage({ type: "OPEN_TEST_PAGE" });
  }
  
  function render(model) {
    document.getElementById("status").textContent = statusLabel(model.status);
    document.getElementById("sessionOn").textContent = model.sessionOn ? "ON" : "OFF";
    document.getElementById("elapsed").textContent = fmtMs(model.elapsedMs || 0);
    document.getElementById("baselineEff").textContent = fmtNum(model.baselineEff);
    document.getElementById("windowEff").textContent = fmtNum(model.windowEff);
    document.getElementById("reason").textContent = model.reason || "";
  
    const btn = document.getElementById("btnToggle");
    btn.textContent = model.sessionOn ? "Stop Session" : "Start Session";
    btn.className = model.sessionOn ? "btn-stop" : "btn-start";
  
    // Show fatigue card when yellow/red
    const fatigueCard = document.getElementById("fatigueCard");
    const showFatigue = model.sessionOn && (model.status === "yellow" || model.status === "red");
    fatigueCard.style.display = showFatigue ? "block" : "none";
  
    // Reaction test summary
    const rtCard = document.getElementById("rtCard");
    const rtInfo = document.getElementById("rtInfo");
    if (model.sessionOn && (model.baselineRT !== null || model.lastRT !== null)) {
      rtCard.style.display = "block";
      const baseline = model.baselineRT !== null ? `${Math.round(model.baselineRT)}ms` : "—";
      const last = model.lastRT !== null ? `${Math.round(model.lastRT)}ms` : "—";
      const delta = Number.isFinite(model.lastRTDeltaPct) ? `${(model.lastRTDeltaPct * 100).toFixed(0)}%` : "—";
      const rec =
        model.lastRecommendation === "break"
          ? "Recommendation: TAKE A BREAK"
          : model.lastRecommendation === "continue"
          ? "Recommendation: CONTINUE"
          : "Recommendation: —";
      rtInfo.textContent = `Baseline: ${baseline} | Last: ${last} | Δ: ${delta} | ${rec}`;
    } else {
      rtCard.style.display = "none";
      rtInfo.textContent = "";
    }
  }
  
  async function refresh() {
    const res = await getState();
    if (!res.ok) return;
    render(res.model);
  }
  
  document.getElementById("btnToggle").addEventListener("click", async () => {
    const res = await getState();
    if (!res.ok) return;
  
    if (!res.model.sessionOn) {
      const started = await startSession();
      if (started.ok) render(started.model);
    } else {
      const stopped = await stopSession();
      if (stopped.ok) render(stopped.model);
    }
  });
  
  document.getElementById("btnTest").addEventListener("click", async () => {
    await openTest();
  });
  
  // Refresh on open and every second (nice UX)
  refresh();
  setInterval(refresh, 1000);
  