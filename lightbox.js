(function(){
  'use strict';

  // Build lightbox DOM
  var overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = '<span class="close-btn">&times;</span><img src="" alt="">';
  document.body.appendChild(overlay);

  var imgEl = overlay.querySelector('img');
  var closeBtn = overlay.querySelector('.close-btn');

  function open(src) {
    imgEl.src = src;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    imgEl.src = '';
  }

  // Close on click outside image, on close button, or on Escape
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay || e.target === closeBtn) close();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) close();
  });

  // Attach click handler to all images not wrapped in an <a> tag
  function init() {
    var imgs = document.querySelectorAll('img:not(a img):not(.float-cell img)');
    for (var i = 0; i < imgs.length; i++) {
      (function(img){
        // Skip if already has a clickable parent
        if (img.closest('a') || img.closest('.float-cell') || img.closest('.lightbox-overlay')) return;
        // Skip very small images (icons, decoratives)
        if (img.naturalWidth < 100 && img.naturalHeight < 100) return;
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', function(e) {
          e.preventDefault();
          // Try original src or current src
          var src = img.getAttribute('data-full') || img.src;
          // For _half images, try to load full version
          var full = src.replace('_half.webp', '.webp').replace('_half.webp', '.jpg').replace('_half.webp', '.png');
          open(full);
        });
      })(imgs[i]);
    }
  }

  // Run on load and after any DOM change
  init();
  // Re-init on dynamic content
  if (window.MutationObserver) {
    var observer = new MutationObserver(function(){ init(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();