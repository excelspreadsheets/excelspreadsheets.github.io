// ── Prevent download via right-click on videos ──
for (const v of document.querySelectorAll('.video-player')) {
  v.addEventListener('contextmenu', e => e.preventDefault());
}

// ── Force landscape orientation on mobile ──
(function lockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
  screen.orientation && screen.orientation.addEventListener('change', () => {
    screen.orientation.lock('landscape').catch(() => {});
  });
})();

// ── DOM refs ──
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
let seekGrace = 0;        // timestamp — timeupdate ignored until this
let bufferPause = false;  // true when we paused due to buffering
let enlargedIndex = -1;

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

// Snap all slaves to master's currentTime if they drift > 150ms
function syncSlaves() {
  const t = master.currentTime;
  for (let i = 0; i < videos.length; i++) {
    if (i === MASTER_IDX) continue;
    if (Math.abs(videos[i].currentTime - t) > 0.15) {
      videos[i].currentTime = t;
    }
  }
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
  syncSlaves();
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
  for (const v of videos) v.pause();
  isPlaying = false;
  updatePlayIcon();
}

function togglePlay() {
  isPlaying ? syncPause() : syncPlay();
}

// ══════════════════════════════════════════════
//  SYNC LOOP — master timeupdate drives all
// ══════════════════════════════════════════════

master.addEventListener('timeupdate', () => {
  if (Date.now() < seekGrace) return;
  syncSlaves();
  updateSeekDisplay();
});

// ══════════════════════════════════════════════
//  BUFFERING — pause all on waiting, resume on canplay
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('waiting', () => {
    if (!isPlaying) return;
    bufferPause = true;
    for (const vv of videos) vv.pause();
    isPlaying = false;
    updatePlayIcon();
  });

  v.addEventListener('canplay', () => {
    if (!bufferPause) return;
    bufferPause = false;
    syncPlay();
  });
}

// ══════════════════════════════════════════════
//  PAUSE / ENDED detection (not triggered by buffer)
// ══════════════════════════════════════════════

for (const v of videos) {
  v.addEventListener('pause', () => {
    if (bufferPause) return;
    if (!isPlaying) return;
    const allPaused = videos.every(vv => vv.paused || vv.ended);
    if (allPaused) {
      isPlaying = false;
      updatePlayIcon();
    }
  });

  v.addEventListener('ended', () => {
    const allEnded = videos.every(vv => vv.ended);
    if (allEnded) {
      isPlaying = false;
      updatePlayIcon();
    }
  });
}

// ══════════════════════════════════════════════
//  SEEK — visual on drag, commit on release
// ══════════════════════════════════════════════

seek.addEventListener('input', () => {
  // Visual only — update fill, don't touch videos
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

  // Suppress timeupdate-driven slider updates for 500ms
  seekGrace = Date.now() + 500;

  // Seek all videos
  for (const v of videos) v.currentTime = target;

  // Re-enable updates early once all have actually seeked
  let seekedCount = 0;
  function onSeeked() {
    seekedCount++;
    if (seekedCount >= videos.length) {
      seekGrace = Date.now() + 100; // tiny extra grace to avoid immediate timeupdate
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

playBtn.addEventListener('click', togglePlay);

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
