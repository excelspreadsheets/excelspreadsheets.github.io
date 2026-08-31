<?php
/**
 * Plugin Name: LG Placenti Hover Previews
 * Description: Adds cursor-following image previews to the front-page nav links (Architecture, Photography, Rendering, Blog, Master's Thesis Documentary) and turns the name into the CV link. Injected natively so it survives Staatic re-exports.
 * Version:     1.0.0
 * Author:      Louis-Guilhem Placenti
 *
 * This is a must-use plugin: drop the file into wp-content/mu-plugins/ and it runs automatically.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Inject the CSS (front page only).
 */
add_action(
	'wp_head',
	function () {
		if ( ! is_front_page() ) {
			return;
		}
		?>
<style>
/* Shared hover-link styling (underline = visible link) */
.lg-hover-link {
	color: inherit;
	text-decoration: underline;
	text-underline-offset: 4px;
	cursor: pointer;
}
.lg-hover-link:hover,
.lg-hover-link:focus {
	color: inherit;
	text-decoration: underline;
}
/* The name/CV link stays plain, like a site title */
.lg-name-link {
	color: inherit;
	text-decoration: none;
	cursor: pointer;
}
.lg-name-link:hover,
.lg-name-link:focus {
	color: inherit;
	text-decoration: none;
}
/* Cursor-following preview */
#lg-hover-preview {
	position: fixed;
	top: 0;
	left: 0;
	width: 220px;
	max-width: 28vw;
	pointer-events: none;
	z-index: 9999;
	opacity: 0;
	visibility: hidden;
	transition: opacity 0.2s ease;
}
#lg-hover-preview.visible {
	opacity: 1;
	visibility: visible;
}
#lg-hover-preview img {
	display: block;
	width: 100%;
	height: auto;
	border-radius: 8px;
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

/* === MOBILE: the front-page card fills the whole screen === */
@media (max-width: 781px) {
	body.home .wp-block-post-content > .wp-block-group.alignfull {
		position: fixed !important;
		top: 0 !important;
		left: 0 !important;
		transform: none !important;
		width: 100vw !important;
		height: 100vh !important;
		min-width: 0 !important;
		max-width: 100vw !important;
		margin: 0 !important;
		border: none !important;
		border-radius: 0 !important;
		white-space: normal !important;
		overflow-y: auto !important;
		box-sizing: border-box !important;
		display: flex !important;
		flex-direction: column !important;
		align-items: center !important;
	}
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-columns {
		flex-wrap: wrap !important;
		flex-direction: column !important;
		align-items: center !important;
		width: 100% !important;
		max-width: 100% !important;
		margin: auto !important; /* vertical centering */
	}
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-column {
		flex-basis: auto !important;
		flex-grow: 0 !important;
		width: 100% !important;
		max-width: 100% !important;
		text-align: center !important;
		padding: 0 !important;
	}
	/* Readable text sizes (override the tiny vw sizes) */
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-column h2 {
		font-size: 4vw !important;
		text-align: center !important;
	}
	/* Name heading larger */
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-column:first-child h2:first-child {
		font-size: 7vw !important;
	}
	/* Nav links (right column) */
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-column:last-child h2 {
		font-size: 5vw !important;
	}
	/* Tighten the huge spacer heights on mobile */
	body.home .wp-block-post-content > .wp-block-group.alignfull .wp-block-spacer {
		height: 2vh !important;
	}
}
</style>
		<?php
	},
	99
);

/**
 * Inject the preview element + behaviour script (front page only).
 */
add_action(
	'wp_footer',
	function () {
		if ( ! is_front_page() ) {
			return;
		}
		?>
<div id="lg-hover-preview" aria-hidden="true"><img src="" alt=""></div>
<script>
(function () {
	if (window.__lgHoverPreviewsLoaded) { return; }
	window.__lgHoverPreviewsLoaded = true;

	/* Work on both the local WP install (localhost/wordpress) and the exported root site. */
	var ROOT = location.pathname.indexOf('/wordpress') === 0 ? '/wordpress' : '';

	var PREVIEWS = {
		'nos_mort_e_s':             ROOT + '/wp-content/uploads/2025/08/memoire-illustration.png',
		'architecture-landing-page': ROOT + '/wp-content/uploads/2025/02/HD-PLACENTI-PROJET-2025-02-05-DSC_4646-1024x683.jpg',
		'photography':              ROOT + '/wp-content/uploads/2024/07/export1-5953-500x333.jpg',
		'rendering':                ROOT + '/wp-content/uploads/2024/06/abri-1-800x533.png',
		'blog':                     ROOT + '/wp-content/uploads/2025/08/DSCF2877-DxO_DeepPRIME-XD3-X-Trans-beta-1024x683.png'
	};
	var CV_LINK    = ROOT + '/wp-content/uploads/2025/08/CV_Louis-Guilhem_Placenti.pdf';
	var CV_PREVIEW = ROOT + '/wp-content/uploads/2025/08/LGPlacenti.webp';

	var preview = document.getElementById('lg-hover-preview');
	if (!preview) { return; }
	var img = preview.querySelector('img');
	var gap = 26;
	var active = null; /* currently hovered link element, or null */

	function matches(href, key) {
		var h = String(href || '').replace(/\/+$/, '');
		return h === key || h.slice(-key.length) === key || h.indexOf('/' + key + '/') !== -1;
	}

	function position(e) {
		var w = preview.offsetWidth || 220;
		var x = e.clientX + gap;
		if (x + w > window.innerWidth - 16) { x = e.clientX - w - gap; } /* flip left near right edge */
		var y = e.clientY + gap;
		if (y + 140 > window.innerHeight - 16) { y = e.clientY - 140 - gap; } /* flip above near bottom edge */
		preview.style.transform = 'translate(' + x + 'px,' + y + 'px)';
	}

	function hide() {
		active = null;
		preview.classList.remove('visible');
	}

	function show(e, link, src) {
		if (active === link && img.getAttribute('src') === src) {
			position(e);
			preview.classList.add('visible');
			return;
		}
		/* Hide immediately so no stale image is ever shown, then reveal once the new one is ready. */
		active = link;
		preview.classList.remove('visible');
		var next = new Image();
		next.onload = function () {
			if (active !== link) { return; } /* hovered away while loading */
			img.src = src;
			img.alt = (link.textContent || '').trim();
			position(e);
			preview.classList.add('visible');
		};
		next.src = src;
	}

	function attach(link, src, isName) {
		link.className = (link.className ? link.className + ' ' : '') + (isName ? 'lg-name-link' : 'lg-hover-link');
		link.addEventListener('mouseenter', function (e) { show(e, link, src); });
		link.addEventListener('mouseleave', hide);
	}

	/* 1) Turn the "Louis-Guilhem Placenti" heading text into the CV link (only if not already a link). */
	var heads = document.querySelectorAll('.entry-content h2');
	for (var i = 0; i < heads.length; i++) {
		var h = heads[i];
		if (h.getElementsByTagName('a').length > 0) { continue; }
		var t = (h.textContent || '').trim();
		if (t.indexOf('Louis') !== -1 && t.indexOf('Placenti') !== -1) {
			var flicker = h.querySelector('.flicker-text2');
			h.innerHTML = '';
			if (flicker) {
				h.appendChild(flicker.cloneNode(true));
				/* Strip the blinking underscore from the link text so it isn't duplicated */
				var flText = (flicker.textContent || '').trim();
				if (flText && t.indexOf(flText) === 0) {
					t = t.slice(flText.length).trim();
				}
			}
			var a = document.createElement('a');
			a.href = CV_LINK;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			a.textContent = t;
			h.appendChild(a);
			attach(a, CV_PREVIEW, true);
			break;
		}
	}

	/* 2) Attach previews to the nav links, matched by their URL path (robust on dev + export). */
	var links = document.querySelectorAll('a');
	for (var j = 0; j < links.length; j++) {
		var href = links[j].getAttribute('href') || '';
		for (var key in PREVIEWS) {
			if (matches(href, key)) {
				(function (link, src) {
					attach(link, src, false);
				})(links[j], PREVIEWS[key]);
				break;
			}
		}
	}

	/* 3) Eagerly preload every preview image (no lazy loading, no stale flash). */
	var all = Object.keys(PREVIEWS).map(function (k) { return PREVIEWS[k]; });
	all.push(CV_PREVIEW);
	all.forEach(function (src) { var p = new Image(); p.src = src; });

	document.addEventListener('mousemove', function (e) { if (active) { position(e); } });
})();
</script>
		<?php
	},
	99
);