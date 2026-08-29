// ══════════════════════════════════════════════
//  ANTI-DOWNLOAD / RIGHT-CLICK
// ══════════════════════════════════════════════
for (const v of document.querySelectorAll('.video-player')) {
  v.addEventListener('contextmenu', e => e.preventDefault());
}

// ══════════════════════════════════════════════
//  FULLSCREEN (hides address bar on mobile)
// ══════════════════════════════════════════════
function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen
    || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) return;
  try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); } catch (_) {}
}

// ══════════════════════════════════════════════
//  FORCE LANDSCAPE (mobile)
// ══════════════════════════════════════════════
(function lockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
  screen.orientation && screen.orientation.addEventListener('change', () => {
    screen.orientation.lock('landscape').catch(() => {});
  });
})();

// ══════════════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════════════
const videos = [0, 1, 2].map(i => document.getElementById('v' + i));
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const seek = document.getElementById('seek-slider');
const mixers = document.querySelectorAll('.mixer');

// ══════════════════════════════════════════════
//  SYNC ENGINE — programmatic timekeeper
//  No master/slave. JS owns the clock.
//  All videos are corrected to the same logical time.
// ══════════════════════════════════════════════

let logicalTime = 0;          // the "true" time according to our clock
let playStartWall = 0;        // performance.now() at last play()
let playStartLogical = 0;     // logicalTime at last play()
let isPlaying = false;

// ── Get the max duration across loaded videos ──
function getDuration() {
  let max = 0;
  for (const v of videos) {
    if (v.duration && v.duration > max) max = v.duration;
  }
  return max;
}

// ── Current logical time (real-time computed from clock) ──
function nowPlaying() {
  if (!isPlaying || !playStartWall) return logicalTime;
  return playStartLogical + (performance.now() - playStartWall) / 1000;
}

// ── How far a given video lags behind logicalTime ──
function drift(v) {
  const target = nowPlaying();
  if (!v.duration) return 0;
  return target - v.currentTime;
}

// ── Write logicalTime to ALL videos ──
function setAllCurrentTime(t) {
  for (const v of videos) {
    if (!v.duration) continue;  // not loaded yet
    v.currentTime = t;
  }
}

// ══════════════════════════════════════════════
//  SYNC LOOP
//  Runs at ~4 Hz during playback.
//  Corrects every video whose drift exceeds 0.3s.
// ══════════════════════════════════════════════

const SYNC_INTERVAL = 250;  // ms between corrections
const DRIFT_TOL = 0.3;       // seconds — drift must exceed this to trigger a snap
let lastSync = 0;

function syncLoop(ts) {
  if (isPlaying && ts - lastSync >= SYNC_INTERVAL) {
    lastSync = ts;
    const target = nowPlaying();
    for (const v of videos) {
      if (!v.duration || v.seeking) continue;
      const d = Math.abs(target - v.currentTime);
      if (d > DRIFT_TOL) {
        v.currentTime = target;
      }
    }
  }
  // Always update slider at ~60 fps for smoothness
  updateSeekDisplay();
  requestAnimationFrame(syncLoop);
}
requestAnimationFrame(syncLoop);

// ══════════════════════════════════════════════
//  PLAY / PAUSE
// ══════════════════════════════════════════════

async function syncPlay() {
  if (isPlaying) return;

  // If everything ended, restart from zero
  if (videos.every(v => v.ended)) {
    logicalTime = 0;
    for (const v of videos) v.currentTime = 0;
  }

  // Sync all videos to the logical clock before starting
  const t = nowPlaying();
  for (const v of videos) {
    if (v.duration) v.currentTime = t;
  }

  // Start the clock
  playStartWall = performance.now();
  playStartLogical = nowPlaying();

  startupGuard = Date.now() + 800;

  try {
    const promises = videos.map(v => v.play());
    await Promise.all(promises);
    isPlaying = true;
    updatePlayIcon();
  } catch (_) {}
}

function syncPause() {
  if (!isPlaying) return;
  clearTimeout(waitTimer);
  // Freeze logical time to current clock value
  logicalTime = nowPlaying();
  for (const v of videos) v.pause();
  isPlaying = false;
  updatePlayIcon();
}

function togglePlay() {
  isPlaying ? syncPause() : syncPlay();
}

// ══════════════════════════════════════════════
//  SEEK
//  Resets the logical clock to the target time.
// ══════════════════════════════════════════════

seek.addEventListener('input', () => {
  const ratio = parseFloat(seek.value) / 1000;
  seek.style.setProperty('--seek', (ratio * 100) + '%');
});

seek.addEventListener('change', commitSeek);
seek.addEventListener('pointerup', commitSeek);

function commitSeek() {
  const dur = getDuration();
  if (!dur) return;
  const ratio = parseFloat(seek.value) / 1000;
  const target = ratio * dur;

  // Reset the logical clock
  logicalTime = target;
  // If currently playing, restart the wall clock from here
  if (isPlaying) {
    playStartWall = performance.now();
    playStartLogical = target;
  } else {
    playStartWall = 0;  // will be set on next play()
  }

  // Seek all videos (even if paused, so user sees the new frame)
  setAllCurrentTime(target);

  // Suppress UI thrash during seek
  seekGrace = Date.now() + 500;

  // Re-enable once all seeked
  let seekedCount = 0;
  function onSeeked() {
    seekedCount++;
    if (seekedCount >= videos.length) {
      seekGrace = Date.now() + 100;
      for (const v of videos) v.removeEventListener('seeked', onSeeked);
      updateSeekDisplay();
    }
  }
  for (const v of videos) v.addEventListener('seeked', onSeeked, { once: true });
}

// ══════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════

let seekGrace = 0;    // slider UI suppressed until this timestamp

function updatePlayIcon() {
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

function updateSeekDisplay() {
  if (Date.now() < seekGrace) return;
  const dur = getDuration();
  const ct = nowPlaying();
  if (dur) {
    const pct = Math.min(ct / dur, 1);
    seek.value = pct * 1000;
    seek.style.setProperty('--seek', (pct * 100) + '%');
  }
}

// ══════════════════════════════════════════════
//  BUFFERING
//  Pause all on sustained waiting. Resume on canplay.
// ══════════════════════════════════════════════

let buffering = false;
let waitTimer = null;
let startupGuard = 0;
let resumeGuard = 0;

for (const v of videos) {
  v.addEventListener('waiting', () => {
    if (!isPlaying) return;
    if (Date.now() < startupGuard) return;
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {
      if (!isPlaying) return;
      buffering = true;
      logicalTime = nowPlaying();   // freeze clock
      for (const vv of videos) vv.pause();
      isPlaying = false;
      updatePlayIcon();
    }, 350);
  });

  v.addEventListener('canplay', () => {
    if (!buffering) return;
    clearTimeout(waitTimer);
    buffering = false;
    if (Date.now() < resumeGuard) return;
    resumeGuard = Date.now() + 1200;
    syncPlay();
  });
}

// ══════════════════════════════════════════════
//  PAUSE / ENDED detection (not buffer-related)
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('pause', () => {
    if (buffering) return;
    if (!isPlaying) return;
    if (videos.every(vv => vv.paused || vv.ended)) {
      logicalTime = nowPlaying();  // freeze clock
      isPlaying = false;
      updatePlayIcon();
    }
  });

  v.addEventListener('ended', () => {
    if (videos.every(vv => vv.ended)) {
      logicalTime = nowPlaying();
      isPlaying = false;
      updatePlayIcon();
    }
  });
}

// ══════════════════════════════════════════════
//  LOADED METADATA
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('loadedmetadata', () => { seek.max = 1000; });
}

// ══════════════════════════════════════════════
//  VOLUME MIXERS
// ══════════════════════════════════════════════

mixers.forEach(m => {
  m.addEventListener('input', () => {
    const idx = parseInt(m.dataset.video);
    videos[idx].volume = parseFloat(m.value);
  });
});

// ══════════════════════════════════════════════
//  PLAY BUTTON & KEYBOARD
// ══════════════════════════════════════════════

playBtn.addEventListener('click', () => {
  enterFullscreen();
  togglePlay();
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  }
});

// ══════════════════════════════════════════════
//  HOVER ENLARGE (temporary)
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('mouseenter', () => {
    const idx = parseInt(v.id[1]);
    if (enlargedIndex === idx) return;
    for (const vv of videos) vv.classList.remove('hover');
    v.classList.add('hover');
  });
  v.addEventListener('mouseleave', () => {
    if (enlargedIndex === parseInt(v.id[1])) return;
    v.classList.remove('hover');
  });
}

// ══════════════════════════════════════════════
//  CLICK ENLARGE (locked toggle)
// ══════════════════════════════════════════════

let enlargedIndex = -1;

for (const v of videos) {
  v.addEventListener('click', (e) => {
    e.stopPropagation();
    enterFullscreen();
    const idx = parseInt(v.id[1]);

    if (enlargedIndex === idx) {
      v.classList.remove('enlarged');
      enlargedIndex = -1;
      return;
    }

    for (const vv of videos) vv.classList.remove('enlarged', 'hover');
    enlargedIndex = idx;
    v.classList.add('enlarged');
  });
}

document.getElementById('video-container').addEventListener('click', (e) => {
  if (e.target === e.currentTarget && enlargedIndex !== -1) {
    for (const vv of videos) vv.classList.remove('enlarged');
    enlargedIndex = -1;
  }
});

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════

updateSeekDisplay();
