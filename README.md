# Cognitive Fatigue Detector

A lightweight Chrome Extension research prototype that explores whether mouse efficiency can serve as a non-intrusive indicator of cognitive fatigue during computer-based work.

## Research Motivation

Many productivity tools only track time, app focus, or active vs. idle behavior. This project focuses on interaction quality—specifically, how efficiently a user moves the mouse between intentional actions—because prior HCI research suggests that under higher cognitive load, cursor paths become less direct.

**Core question:** Can mouse efficiency serve as a non-intrusive indicator of cognitive fatigue during computer-based work?

## What This Prototype Does

### 1. Mouse Efficiency Metric (Passive, Continuous)

Between two consecutive clicks, the extension computes:

```
Mouse Efficiency = (straight-line distance) / (total path length)
```

- **~1.0**: Direct movement
- **Lower values**: More wandering/indirect movement

The content script listens to `mousemove` and `click` events and sends per-segment efficiency data to the background worker.

### 2. Rolling 5-Minute Efficiency Tracking

The extension continuously computes mouse efficiency using only the most recent interaction data from the last 5 minutes.

Tracked values:
- Last 5-minute efficiency
- Session elapsed time
- Total raw mouse segments collected

### 3. Reaction Test as a Verification Step

The popup includes a built-in reaction-time test:

- 8 trials with random delays
- Click when the box turns green
- Mean reaction time calculated
- All individual trial times saved

### 4. Export Full Dataset

Export all results as JSON, including:
- Session metadata
- Raw mouse movement segments
- Saved reaction-time checkpoints
- Efficiency values linked to reaction tests

## Installation (Unpacked Extension)

1. Clone or download this repository
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** and select this project folder
5. Pin the extension (optional)

## How To Use

1. Click the extension icon to open the popup
2. Click **Start Session**
3. Browse normally and perform real work inside Chrome
4. Click **Take Reaction Test** whenever desired
5. Complete 8 trials (result saves automatically)
6. Click **Export Results JSON** when finished

## Implementation Summary

### Efficiency Capture (content.js)
- Accumulates mouse path length on `mousemove`
- Resets on each `click`
- Computes: `efficiency = directDistance / accumulatedPath`
- Sends segment data to background script

### State & Storage (bg.js)
- Stores session state in `chrome.storage.local`
- Stores all raw mouse segments
- Computes rolling 5-minute efficiency
- Stores reaction-time checkpoints
- Builds exportable JSON dataset

### UI (popup.html + popup.js)

**Dashboard displays:**
- Session status
- Elapsed time
- 5-minute efficiency
- Last reaction-time mean
- Saved checkpoint count
- Raw segment count

**Reaction Test:**
- Randomized delay
- Click-on-green measurement
- 8 trials
- Mean result saved automatically

## Evaluation Plan

This prototype supports experiments such as:
- Controlled workload blocks (easy vs. hard tasks)
- Time-on-task trends over long sessions
- Correlation between efficiency and reaction time
- Repeated within-subject testing
- Statistical analysis in Python or R

## Ethics, Privacy, and Safety

- Only measures mouse movement and click geometry
- No keystrokes captured
- No cloud upload required
- Data stored locally via `chrome.storage.local`

## Known Limitations

- Efficiency computed only between clicks (sparse data for low-click tasks)
- Different sites and workflows have different normal efficiency ranges
- Mouse efficiency alone may not always indicate fatigue
- Popup-based reaction tests may be influenced by context or focus

## Roadmap (Future Work Ideas)

- Adaptive personal baselines
- Keyboard behavior metrics (pause time, speed, curvature, click cadence)
- Better UI feedback and charts
- Machine learning models
- Desktop-wide tracking beyond Chrome
