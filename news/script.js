// =================================================================
// SCRIPT.JS UNTUK PAPARAN PENGUMUMAN (Xibo digital display)
// Reads /news/data/announcements.json and shows whichever announcements
// are active right now; falls back to the default slide otherwise.
//
// Time model: start_at/end_at are compared against the display device's
// own local clock (screens are in Malaysia). Date-only values are
// expanded to the full day: start 00:00:00, end 23:59:59.
// Expiry needs no republish — the page re-evaluates every minute, and
// the <meta refresh> reload (10 min) picks up JSON changes.
//
// Transitions: two stacked .slide-layer divs alternate; each new slide
// is built in the hidden layer, then the layers crossfade (style.css).
// Images only fade in after they finish loading, so a slow poster never
// crossfades into a half-loaded frame.
// =================================================================

const JSON_URL = '/news/data/announcements.json';
const FALLBACK_DEFAULT_IMAGE = '/news/default.svg';
const ROTATE_MS = 15000;   // slideshow interval when >1 announcement is active
const REEVAL_MS = 60000;   // how often the active window is re-checked

let newsData = null;
let pinnedAnnIndex = null; // ?ann=N (1-based) pins one announcement; null = slideshow
let activeList = [];
let rotationIndex = 0;
let rotationTimer = null;
let currentKey = null;
let visibleLayerIdx = 0;

function parseLocalDate(value, isEnd) {
    if (!value) return null;
    let str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        str += isEnd ? 'T23:59:59' : 'T00:00:00';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function isActive(item, now) {
    if (!item || item.enabled === false) return false;
    if (!item.image_url && !item.text) return false;
    const start = parseLocalDate(item.start_at, false);
    const end = parseLocalDate(item.end_at, true);
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
}

function getActiveAnnouncements(data, now) {
    const list = Array.isArray(data?.announcements) ? data.announcements : [];
    return list.filter(item => isActive(item, now));
}

// URL modes: no query / ?slideshow → all active announcements rotate;
// ?ann=N → only the Nth entry (1-based, JSON array order). A pinned entry
// still honors start/end/enabled — expired or missing means default slide.
function computeActiveList(now) {
    if (pinnedAnnIndex !== null) {
        const list = Array.isArray(newsData?.announcements) ? newsData.announcements : [];
        const item = list[pinnedAnnIndex - 1];
        return item && isActive(item, now) ? [item] : [];
    }
    return getActiveAnnouncements(newsData, now);
}

function defaultImageUrl() {
    return newsData?.default_image || FALLBACK_DEFAULT_IMAGE;
}

// Three slide kinds: image-only, text-only, or image + caption bar
// (an image with text and/or heading gets the caption bar overlay)
function hasCaption(item) {
    return Boolean(item.image_url && (item.text || item.heading));
}

function itemKey(item) {
    if (hasCaption(item)) {
        return `combo:${item.image_url}|${item.heading || ''}|${item.text || ''}`;
    }
    return item.text
        ? `text:${item.heading || ''}|${item.text}`
        : `img:${item.image_url}`;
}

function showMessageFallback() {
    document.getElementById('layer-a').classList.remove('visible');
    document.getElementById('layer-b').classList.remove('visible');
    document.getElementById('message').style.display = 'block';
}

// Crossfade WITHOUT a white dip: the new slide fades in ON TOP of the old
// one, which stays fully opaque underneath (z-index swap) and is only
// hidden after the fade finishes. Fading both layers at once would leave
// both semi-transparent mid-fade, letting the white container background
// bleed through — that's the "white flash" this ordering exists to avoid.
const FADE_MS = 700; // keep in sync with .slide-layer transition in style.css

function swapTo(el) {
    const layers = [document.getElementById('layer-a'), document.getElementById('layer-b')];
    const prev = layers[visibleLayerIdx];
    const next = layers[1 - visibleLayerIdx];
    visibleLayerIdx = 1 - visibleLayerIdx;

    document.getElementById('message').style.display = 'none';

    // Reset the incoming layer instantly (no animating back to 0 if a
    // previous fade-out was interrupted), then load the new content.
    clearTimeout(swapTo._hidePrevTimer);
    next.style.transition = 'none';
    next.classList.remove('visible');
    next.replaceChildren(el);
    void next.offsetHeight; // flush the no-transition reset before re-enabling
    next.style.transition = '';

    next.style.zIndex = '2';
    prev.style.zIndex = '1';

    if (!swapTo._firstDone) {
        // First slide after page load: appear immediately, no fade from white
        swapTo._firstDone = true;
        next.style.transition = 'none';
        next.classList.add('visible');
        void next.offsetHeight;
        next.style.transition = '';
        return;
    }

    // Double rAF ensures the browser paints the new layer at opacity 0
    // before the transition to 1 starts.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            next.classList.add('visible');
        });
    });
    // Hide the old slide only once it's fully covered by the new one.
    // Its own fade-out happens invisibly beneath the opaque top layer.
    swapTo._hidePrevTimer = setTimeout(() => {
        prev.classList.remove('visible');
    }, FADE_MS + 100);
}

function buildTextEl(item) {
    const slide = document.createElement('div');
    slide.className = 'text-slide';
    if (item.heading) {
        const heading = document.createElement('div');
        heading.className = 'text-heading';
        // textContent (never innerHTML) — JSON text must not inject markup.
        heading.textContent = item.heading;
        slide.appendChild(heading);
    }
    if (item.text) {
        const body = document.createElement('div');
        body.className = 'text-body';
        // Multi-line via \n in the JSON string; CSS white-space: pre-line renders it.
        body.textContent = item.text;
        slide.appendChild(body);
    }
    return slide;
}

function showTextSlide(item) {
    const key = itemKey(item);
    if (key === currentKey) return;
    currentKey = key;
    swapTo(buildTextEl(item));
}

// Image + text together: fullscreen image with a translucent caption bar
// over the bottom edge. Waits for the image to load before crossfading;
// if the image fails, degrades to the text-only slide so the message
// still gets shown.
function showComboSlide(item) {
    const key = itemKey(item);
    if (key === currentKey) return;
    currentKey = key;

    const wrap = document.createElement('div');
    wrap.className = 'combo-slide';

    const img = document.createElement('img');
    img.alt = 'Pengumuman';
    img.onload = () => { if (currentKey === key) swapTo(wrap); };
    img.onerror = () => {
        console.error('Gagal memuatkan imej:', item.image_url);
        if (currentKey !== key) return;
        swapTo(buildTextEl(item));
    };
    wrap.appendChild(img);

    const caption = document.createElement('div');
    caption.className = 'caption-bar';
    if (item.heading) {
        const heading = document.createElement('div');
        heading.className = 'caption-heading';
        heading.textContent = item.heading;
        caption.appendChild(heading);
    }
    if (item.text) {
        const body = document.createElement('div');
        body.className = 'caption-body';
        body.textContent = item.text;
        caption.appendChild(body);
    }
    wrap.appendChild(caption);

    img.src = item.image_url;
}

function setImage(src) {
    if (!src) { showMessageFallback(); return; }
    const key = `img:${src}`;
    if (key === currentKey) return;
    currentKey = key;

    const img = document.createElement('img');
    img.alt = 'Pengumuman';
    // Only crossfade once loaded — and only if rotation hasn't moved on since
    img.onload = () => { if (currentKey === key) swapTo(img); };
    img.onerror = () => {
        console.error('Gagal memuatkan imej:', src);
        if (currentKey !== key) return;
        currentKey = null;
        if (src !== FALLBACK_DEFAULT_IMAGE) {
            setImage(FALLBACK_DEFAULT_IMAGE);
        } else {
            showMessageFallback();
        }
    };
    img.src = src;
}

function render() {
    if (activeList.length === 0) {
        setImage(defaultImageUrl());
        return;
    }
    const item = activeList[rotationIndex % activeList.length];
    if (hasCaption(item)) {
        showComboSlide(item);
    } else if (item.text) {
        showTextSlide(item);
    } else {
        setImage(item.image_url);
    }
}

function reevaluate() {
    const newActive = computeActiveList(new Date());
    const changed =
        newActive.length !== activeList.length ||
        newActive.some((item, i) => itemKey(item) !== itemKey(activeList[i]));
    if (!changed) return;

    activeList = newActive;
    rotationIndex = 0;

    clearInterval(rotationTimer);
    rotationTimer = null;
    if (activeList.length > 1) {
        rotationTimer = setInterval(() => {
            rotationIndex = (rotationIndex + 1) % activeList.length;
            render();
        }, ROTATE_MS);
    }
    render();
}

async function fetchAnnouncementsData() {
    const response = await fetch(`${JSON_URL}?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    return response.json();
}

// Silently re-fetches announcements.json in the background — this is what
// lets a newly-published admin edit show up with no republish/manual step
// AND no visible reload, replacing the old `<meta http-equiv="refresh">`
// full-page-reload mechanism (removed from index.html, 2026-07-28) that
// used to blink the physical screen every 10 minutes just to pick up
// content changes. A failed fetch deliberately leaves `newsData` untouched
// — a transient network hiccup must never blank an otherwise-working
// display; the next REEVAL_MS tick just tries again.
async function refreshData() {
    try {
        newsData = await fetchAnnouncementsData();
    } catch (error) {
        console.error('Gagal memuatkan semula data pengumuman:', error);
    }
}

async function initNewsDisplay() {
    const annParam = parseInt(new URLSearchParams(window.location.search).get('ann'), 10);
    pinnedAnnIndex = Number.isInteger(annParam) && annParam >= 1 ? annParam : null;

    try {
        newsData = await fetchAnnouncementsData();
    } catch (error) {
        console.error('Gagal memuatkan data pengumuman:', error);
        newsData = null;
    }

    // Force the first evaluation to always run render()
    activeList = [];
    rotationIndex = 0;
    const firstActive = computeActiveList(new Date());
    if (firstActive.length === 0) {
        render();
    } else {
        reevaluate();
    }

    // One timer now does both jobs the old two-tier design split across
    // reevaluate() (60s) and the <meta refresh> (10min): refresh the data,
    // THEN re-evaluate the active window against whatever it got. When the
    // fetch returns unchanged content, reevaluate()'s own itemKey() diff
    // already no-ops (see its `changed` check) — so an unchanged publish
    // causes zero re-render, not just zero visible reload.
    setInterval(async () => {
        await refreshData();
        reevaluate();
    }, REEVAL_MS);
}
