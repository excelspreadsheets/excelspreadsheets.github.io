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
  try {
    const p = req.call(el);
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
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
const MASTER_IDX = 0;
const videos = [0, 1, 2].map(i => document.getElementById('v' + i));
const master = videos[MASTER_IDX];
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const seek = document.getElementById('seek-slider');
const mixers = document.querySelectorAll('.mixer');

// ── State ──
let isPlaying = false;
let buffering = false;      // true while we paused because a video was waiting
let seekGrace = 0;          // timeupdate-driven UI suppressed until this
let enlargedIndex = -1;
let waitTimer = null;       // debounce for buffer-pause
let resumeGuard = 0;        // cooldown for auto-resume (prevents thrash loops)
let startupGuard = 0;       // ignore waiting right after play (initial load)

const SYNC_TOLERANCE = 0.5; // seconds — only correct when drift exceeds this

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════

function getDuration() {
  let max = 0;
  for (const v of videos) {
    if (v.duration && v.duration > max) max = v.duration;
  }
  return max;
}

function getCurrentTime() {
  if (master.duration) return master.currentTime;
  for (const v of videos) {
    if (v.duration) return v.currentTime;
  }
  return 0;
}

// Player can actually decode/paint right now?
function isReady(v) {
  return v.readyState >= 2 && !v.seeking;
}

function updatePlayIcon() {
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

function updateSeekDisplay() {
  const dur = getDuration();
  const ct = getCurrentTime();
  if (dur) {
    const pct = Math.min(ct / dur, 1);
    seek.value = pct * 1000;
    seek.style.setProperty('--seek', (pct * 100) + '%');
  }
}

// ══════════════════════════════════════════════
//  PLAY / PAUSE
// ══════════════════════════════════════════════

async function syncPlay() {
  if (isPlaying) return;

  // If everything ended, restart from zero
  if (videos.every(v => v.ended)) {
    for (const v of videos) v.currentTime = 0;
  }

  // Clamp slaves to master before starting
  const mt = master.currentTime;
  for (let i = 1; i < videos.length; i++) {
    if (videos[i].duration) videos[i].currentTime = mt;
  }

  startupGuard = Date.now() + 800;

  try {
    const promises = videos.map(v => v.play());
    await Promise.all(promises);
    isPlaying = true;
    updatePlayIcon();
  } catch (_) {
    // autoplay blocked — user must interact first
  }
}

function syncPause() {
  if (!isPlaying) return;
  clearTimeout(waitTimer);
  for (const v of videos) v.pause();
  isPlaying = false;
  updatePlayIcon();
}

function togglePlay() {
  isPlaying ? syncPause() : syncPlay();
}

// ══════════════════════════════════════════════
//  SUPERVISOR — drift correction at ~8 Hz via rAF
//  (independent of timeupdate, which Firefox throttles)
// ══════════════════════════════════════════════

let lastCheck = 0;

function checkSync() {
  if (buffering || !isPlaying) return;
  const mt = master.currentTime;
  for (let i = 1; i < videos.length; i++) {
    const v = videos[i];
    if (!isReady(v)) continue;              // don't fight its loading state
    if (Math.abs(v.currentTime - mt) > SYNC_TOLERANCE) {
      v.currentTime = mt;                  // hard snap
    }
  }
}

function supervisor(ts) {
  if (isPlaying && ts - lastCheck > 125) {
    lastCheck = ts;
    checkSync();
  }
  requestAnimationFrame(supervisor);
}
requestAnimationFrame(supervisor);

// ══════════════════════════════════════════════
//  UI HEARTBEAT — master timeupdate only drives the slider
// ══════════════════════════════════════════════

master.addEventListener('timeupdate', () => {
  if (Date.now() < seekGrace) return;
  updateSeekDisplay();
});

// ══════════════════════════════════════════════
//  BUFFERING — pause all (debounced), resume once ready (cooldowned)
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('waiting', () => {
    if (!isPlaying) return;
    if (Date.now() < startupGuard) return;      // let playback start-up
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {
      if (!isPlaying) return;
      buffering = true;
      for (const vv of videos) vv.pause();
      isPlaying = false;
      updatePlayIcon();
    }, 350);                                     // tolerate brief hitches
  });

  v.addEventListener('canplay', () => {
    if (!buffering) return;
    clearTimeout(waitTimer);
    buffering = false;
    // Cooldown so a burst of canplay events can't re-trigger play repeatedly
    if (Date.now() < resumeGuard) return;
    resumeGuard = Date.now() + 1200;
    syncPlay();
  });
}

// ══════════════════════════════════════════════
//  PAUSE / ENDED detection (not buffer-induced)
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('pause', () => {
    if (buffering) return;
    if (!isPlaying) return;
    if (videos.every(vv => vv.paused || vv.ended)) {
      isPlaying = false;
      updatePlayIcon();
    }
  });

  v.addEventListener('ended', () => {
    if (videos.every(vv => vv.ended)) {
      isPlaying = false;
      updatePlayIcon();
    }
  });
}

// ══════════════════════════════════════════════
//  SEEK — visual on drag, commit on release
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

  seekGrace = Date.now() + 500; // suppress UI thrash during seek

  for (const v of videos) v.currentTime = target;

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
//  LOADED METADATA
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('loadedmetadata', () => {
    seek.max = 1000;
    updateSeekDisplay();
  });
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