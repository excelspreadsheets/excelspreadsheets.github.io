// ── DOM refs ──
const videos = [0, 1, 2].map(i => document.getElementById('v' + i));
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const seek = document.getElementById('seek-slider');
const mixers = document.querySelectorAll('.mixer');

// ── State ──
let isPlaying = false;
let isSeeking = false;
let enlargedIndex = -1;   // which video is locked enlarged (-1 = none)
let hoveredIndex = -1;    // which video is hovered (-1 = none)

// ── Synchronized play / pause ──
async function syncPlay() {
  if (isPlaying) return;
  // Sync all to the same time (master = first video)
  const master = videos[0];
  for (let i = 1; i < videos.length; i++) {
    videos[i].currentTime = master.currentTime;
  }
  try {
    const promises = videos.map(v => v.play());
    await Promise.all(promises);
    isPlaying = true;
    updateUI();
  } catch (e) {
    // autoplay blocked or other error
  }
}

function syncPause() {
  if (!isPlaying) return;
  for (const v of videos) v.pause();
  isPlaying = false;
  updateUI();
}

function togglePlay() {
  isPlaying ? syncPause() : syncPlay();
}

// ── Seeking ──
function getDuration() {
  const durs = videos.map(v => v.duration || 0);
  return Math.max(...durs);
}

function getCurrentTime() {
  // Use first video as master, fallback to any
  for (const v of videos) {
    if (v.duration) return v.currentTime;
  }
  return 0;
}

function syncSeekTo(ratio) {
  const dur = getDuration();
  if (!dur) return;
  const t = ratio * dur;
  for (const v of videos) v.currentTime = t;
}

// ── UI updates ──
function updateUI() {
  // Play/pause icon
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

function updateSeek() {
  if (isSeeking) return;
  const dur = getDuration();
  const ct = getCurrentTime();
  if (dur) {
    const pct = (ct / dur) * 1000;
    seek.value = Math.min(pct, 1000);
    seek.style.setProperty('--seek', (pct / 10) + '%');
  }
}

// ── Mixers (volume) ──
mixers.forEach(m => {
  m.addEventListener('input', () => {
    const idx = parseInt(m.dataset.video);
    videos[idx].volume = parseFloat(m.value);
  });
});

// ── Play button ──
playBtn.addEventListener('click', togglePlay);

// ── Keyboard ──
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  }
});

// ── Seek bar ──
seek.addEventListener('input', () => {
  isSeeking = true;
  const ratio = parseFloat(seek.value) / 1000;
  seek.style.setProperty('--seek', (ratio * 100) + '%');
  syncSeekTo(ratio);
});

seek.addEventListener('change', () => {
  isSeeking = false;
});

// ── Video events ──
for (const v of videos) {
  v.addEventListener('timeupdate', updateSeek);
  v.addEventListener('loadedmetadata', () => {
    // Once we have duration, enable seek
    seek.max = 1000;
    updateSeek();
  });
  v.addEventListener('play', () => {
    if (!isPlaying) {
      isPlaying = true;
      updateUI();
    }
  });
  v.addEventListener('pause', () => {
    if (isPlaying && !v.ended) {
      // Only react if all are paused
      const allPaused = videos.every(vv => vv.paused);
      if (allPaused) {
        isPlaying = false;
        updateUI();
      }
    }
    if (v.ended) {
      // Check if all ended
      const allEnded = videos.every(vv => vv.ended);
      if (allEnded) {
        isPlaying = false;
        updateUI();
      }
    }
  });
  v.addEventListener('waiting', () => {
    // If buffering, optionally pause other videos too for sync
    // For simplicity, we leave them running
  });
}

// ── Hover enlarge (temporary) ──
for (const v of videos) {
  v.addEventListener('mouseenter', () => {
    const idx = parseInt(v.id[1]);
    // Don't hover if this one is already locked enlarged
    if (enlargedIndex === idx) return;
    // Remove hover from others
    for (const vv of videos) vv.classList.remove('hover');
    hoveredIndex = idx;
    v.classList.add('hover');
  });
  v.addEventListener('mouseleave', () => {
    // Don't remove if this video is locked enlarged
    if (enlargedIndex === parseInt(v.id[1])) return;
    v.classList.remove('hover');
    hoveredIndex = -1;
  });
}

// ── Click enlarge (locked toggle) ──
for (const v of videos) {
  v.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = parseInt(v.id[1]);

    // If clicking the already enlarged one, un-enlarge
    if (enlargedIndex === idx) {
      v.classList.remove('enlarged');
      enlargedIndex = -1;
      return;
    }

    // Remove any current enlarged
    for (const vv of videos) vv.classList.remove('enlarged');
    // Clear hover state too
    for (const vv of videos) vv.classList.remove('hover');

    enlargedIndex = idx;
    v.classList.add('enlarged');
  });
}

// ── Click outside video to un-enlarge ──
document.getElementById('video-container').addEventListener('click', (e) => {
  if (e.target === e.currentTarget && enlargedIndex !== -1) {
    for (const vv of videos) vv.classList.remove('enlarged');
    enlargedIndex = -1;
  }
});

// ── Init ──
updateSeek();
