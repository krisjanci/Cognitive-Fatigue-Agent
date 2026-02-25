# Cognitive Fatigue Detector

A lightweight Chrome Extension research prototype that explores whether mouse efficiency can serve as a non-intrusive indicator of cognitive fatigue during computer-based work.



## Research Motivation

Many productivity tools only track time, app focus, or active vs. idle behavior. This project focuses on interaction quality—specifically, how efficiently a user moves the mouse between intentional actions—because prior HCI research suggests that under higher cognitive load, cursor paths become less direct.



## Core question:

Can mouse efficiency serve as a non-intrusive indicator of cognitive fatigue during computer-based work?

## What This Prototype Does



### 1. Mouse Efficiency Metric (passive, continuous)

Between two consecutive clicks, the extension computes:

Mouse Efficiency = (straight-line distance between clicks) / (total mouse path length traveled between clicks)

A value closer to 1.0 means movement was direct.

Lower values indicate more wandering / indirect movement.

The content script listens to mousemove and click events and sends per-segment efficiency to the background worker.



### 2. Baseline → Sliding Window Comparison

A session begins by collecting a baseline from the first N click-to-click segments:

BASELINE_N = 8 segments (demo-friendly)

Then it computes a moving average efficiency over a recent window:

WINDOW_MS = 20,000 (20 seconds, demo-friendly)

A fatigue flag triggers when the window average drops enough relative to baseline:

RED_DROP = 0.50 → red if efficiency drops by ≥ 50% vs baseline



### 3. Reaction Test as a “Verification Step”

If fatigue is flagged, the popup prompts a 3-trial reaction test (median result). The first time you run it in a session, it sets an RT baseline. Later tests compare against it:

RT_DROP = 0.20 → recommend a break if RT is ≥ 20% slower than baseline

This is intentionally simple: it’s a second measure to reduce false alarms and support experimental evaluation.



## Install (Unpacked Extension)

Clone or download this repository.

Open Chrome and go to: chrome://extensions

Enable Developer mode (top-right).

Click Load unpacked and select this project folder.

Pin the extension (optional) for easier access.



## How To Use

Click the extension icon to open the popup.

Click Start Session.

Browse normally and generate a few click-to-click segments until baseline forms.

Watch Baseline eff and Window eff update.

If a large drop is detected, the status becomes red and the popup shows Fatigue detected.

Click Take Reaction Test:

3 trials

result is median

first run sets RT baseline

later runs recommend CONTINUE or BREAK

How It Works (Implementation Summary)
Efficiency capture (content.js)

Accumulates mouse path length (mousemove)

Resets on each click

On each click after the first, computes:

direct = distance(currentClick, lastClick)

actual = accumulatedPath

eff = direct / actual

Sends { type: "EFF", eff } to background.

State + detection (bg.js)

Stores session state in chrome.storage.local

Computes baseline average from first BASELINE_N segments

Computes sliding window average from the last WINDOW_MS

Flags fatigue when window avg drops by RED_DROP vs baseline

Stores reaction-time baseline + last result and computes recommendation.

UI (popup.html + popup.js)

Dashboard: session status, elapsed time, baseline/window efficiency, reason string

Reaction Test: randomized delay, click-on-green measurement, median of 3, sends RT back

Evaluation Plan (for the report / experiments)

This prototype is meant to support experiments such as:

Controlled workload blocks (e.g., easy vs. hard tasks you personally perform)

Time-on-task trends (efficiency drift over long work sessions)

Correlation between efficiency drops and RT slowdowns

Threshold sensitivity (how different RED_DROP, WINDOW_MS, BASELINE_N affect false positives)



## Ethics, Privacy, and Safety

This prototype only measures mouse movement and click geometry (distances), not page content.

No keystrokes are captured.

Data is stored locally via chrome.storage.local for the session state.



## Known Limitations

Efficiency is computed only between clicks; tasks with few clicks may produce sparse data.

Different sites and workflows cause different “normal” efficiency ranges.

Single baseline per session may be sensitive to early-session behavior.

Popup-based reaction test is minimal and may be affected by popup focus/context.



## Roadmap (Future Work Ideas)

Calibrate baseline continuously (e.g., rolling baseline or adaptive baseline)

More robust features (pause time, speed, curvature, jerk, click cadence)

Per-site baselines

Better UI feedback (trend charts, confidence, false-positive reduction)

Export anonymized summary metrics for analysis scripts