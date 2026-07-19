// =====================================================================
// weather-core.js — shared logic for the csr/weather pages
//
// Loaded (classic script, no modules — repo has no build tools) by:
//   /csr/weather/index.html    (interactive map page)
//   /csr/weather/paparan/      (digital-signage display)
// via <script src="/csr/weather/weather-core.js"> — ABSOLUTE path, the
// Vercel cleanUrls lesson: relative paths resolve one level too high on
// slash-less directory URLs.
//
// Everything here is DOM-free and Leaflet-free on purpose: it's the
// fetch/parse/severity layer that both pages must agree on. MET wording
// changes get fixed HERE, once. Page-specific rendering (Leaflet styles
// wiring, banners, cards) stays in each page's own inline script.
//
// Verified by scratchpad harness test-rain-tiers.js (Node vm, loads this
// file directly).
// =====================================================================

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
const GEOJSON_URL = 'https://raw.githubusercontent.com/mptwaktusolat/jakim.geojson/refs/heads/master/malaysia.district.geojson';
const WARNING_API_URL = 'https://api.data.gov.my/weather/warning?contains=Pahang@text_en&limit=20';
// Vercel proxy for MET's continuous-rain dataset (see api/weather-warning.js
// — the METToken must stay server-side). 404s under Live Server /
// python -m http.server (no /api routes locally, documented repo-wide
// limitation) — pages just show no rain data locally; use
// ?testWarning=rain to exercise the rain path without the proxy.
const RAIN_PROXY_URL = '/api/weather-warning';
const REFRESH_MS = 3 * 60 * 1000; // warning-poll interval: 3 minutes

const KNOWN_DISTRICTS = [
  'Bentong', 'Bera', 'Cameron Highlands', 'Jerantut', 'Kuantan',
  'Lipis', 'Maran', 'Pekan', 'Raub', 'Rompin', 'Temerloh'
];

// MET wording vs GeoJSON `name` will not always agree — extend as new
// mismatches are observed. Keys are lowercased/trimmed.
const DISTRICT_ALIASES = {
  'kuala lipis': 'Lipis',
  'cameron highland': 'Cameron Highlands',
  'tanah tinggi cameron': 'Cameron Highlands', // BM bulletins (text_bm fallback path)
};

// ---------------------------------------------------------------------
// Severity tiers. MET's hujan berterusan ladder is Waspada (yellow) <
// Buruk (orange) < Bahaya (red). 'amaran' is the untiered thunderstorm
// amber from data.gov.my bulletins (their headings use different wording,
// not this three-step ladder), ranked between Waspada and Buruk so a
// rain-Buruk district keeps its orange even if a thunderstorm warning
// also covers it — highest rank wins per district.
// ---------------------------------------------------------------------
const TIER_RANK = { waspada: 1, amaran: 2, buruk: 3, bahaya: 4 };
const TIER_COLORS = {
  waspada: { fill: '#facc15', border: '#a16207' },
  amaran: { fill: '#f59e0b', border: '#b45309' },
  buruk: { fill: '#f97316', border: '#c2410c' },
  bahaya: { fill: '#dc2626', border: '#991b1b' },
};
const TIER_LABEL = { waspada: 'Waspada', amaran: 'Amaran', buruk: 'Buruk', bahaya: 'Bahaya' };

// Leaflet style objects for district polygons — pure data, safe here.
const defaultStyle = {
  fillColor: "#3498db",
  weight: 2,
  opacity: 1,
  color: 'white',
  fillOpacity: 0.6
};

function districtWarningStyle(tier) {
  const c = TIER_COLORS[tier] || TIER_COLORS.amaran;
  return { fillColor: c.fill, weight: 3, opacity: 1, color: c.border, fillOpacity: 0.85 };
}

// Whole-state advisory: same tier hue, washed out — MET was vague about
// which districts, so don't paint it as loudly as a confirmed district hit.
function stateWarningStyle(tier) {
  const c = TIER_COLORS[tier] || TIER_COLORS.amaran;
  return { fillColor: c.fill, weight: 2, opacity: 1, color: c.border, fillOpacity: 0.35 };
}

// ---------------------------------------------------------------------
// Fetch helper — never let a hung API block rendering
// (same pattern as kuliah/jadual/script.js)
// ---------------------------------------------------------------------
function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------
// Warning parsing — thunderstorm (data.gov.my free text)
// ---------------------------------------------------------------------

// Splits "Kuantan, Pekan dan Rompin" / "Kuantan, Pekan and Rompin"
// into ["Kuantan", "Pekan", "Rompin"].
function splitDistrictList(capture) {
  return capture
    .split(/,|\bdan\b|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Normalizes one raw district token from warning text against the
// known Pahang district list, via the alias table. Returns null (and
// warns) for anything unrecognized, rather than silently dropping it.
function resolveDistrictName(raw) {
  const norm = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (DISTRICT_ALIASES[norm]) return DISTRICT_ALIASES[norm];
  const match = KNOWN_DISTRICTS.find(d => d.toLowerCase() === norm);
  if (match) return match;
  console.warn('[weather] Unrecognized district name in warning text:', raw);
  return null;
}

// Marine/offshore bulletins ("... expected over the waters of Perlis &
// Kedah, Penang, ..., Pahang, ...") mention Pahang by name but describe
// sea conditions, not land districts — MET's phrasing consistently uses
// "waters of" / "perairan" right before that state list. Without this
// check, a marine-only bulletin would fall through to the state-wide
// fallback below and incorrectly paint every land district amber.
function isMarineBulletin(warning) {
  return /\bwaters?\s+of\b/i.test(warning.text_en || '') ||
    /\bperairan\b/i.test(warning.text_bm || '');
}

// Parses one warning object (already known to mention "Pahang" in
// text_en, per the API's contains= filter) into a district-level hit
// list, a state-wide land scope, or a marine-only scope (no land
// districts highlighted, but still worth showing in the banner).
// All parsers return the same shape: { scope, districts, tiers, tier }
// where `tiers` maps district → severity tier and `tier` is the
// whole-state tier (scope 'state' only). Thunderstorm bulletins are
// always the untiered 'amaran'.
function extractPahangDistricts(warning) {
  const text = warning.text_en || warning.text_bm || '';
  const match = text.match(/Pahang\s*\(([^)]+)\)/i);
  if (match) {
    const resolved = splitDistrictList(match[1])
      .map(resolveDistrictName)
      .filter(Boolean);
    const tiers = {};
    resolved.forEach(d => { tiers[d] = 'amaran'; });
    return { scope: 'district', districts: resolved, tiers, tier: null };
  }
  if (isMarineBulletin(warning)) {
    return { scope: 'marine', districts: [], tiers: {}, tier: null };
  }
  // "Pahang" mentioned with no parenthetical detail and no marine
  // phrasing — MET was vague about which district, so treat as a
  // whole-state land advisory.
  return { scope: 'state', districts: KNOWN_DISTRICTS.slice(), tiers: {}, tier: 'amaran' };
}

function isWarningActive(w) {
  if (w.warning_issue && w.warning_issue.title_en === 'No Advisory') return false;
  // "Termination of ... / Penamatan ..." bulletins ANNOUNCE that a warning
  // has ended — rendering one as active would highlight the very districts
  // whose warning was just lifted. (Their valid_to usually expires within
  // minutes anyway, but don't rely on that race.) Rain bulletins are
  // exempt: their heading covers a MULTI-section document where
  // terminations are per-section (SEKSYEN C), handled in
  // parseRainPahang() instead.
  if (w.source !== 'rain' &&
    (/termination/i.test(w.heading_en || '') || /penamatan/i.test(w.heading_bm || ''))) return false;
  if (w.valid_to) {
    const validTo = new Date(w.valid_to);
    if (!isNaN(validTo.getTime()) && validTo.getTime() < Date.now()) return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// MET continuous-rain warnings (via /api/weather-warning proxy)
//
// A rain bulletin is ONE multi-section prose string:
//   SECTION A: CONTINUOUS RAIN WARNING (SEVERE) ...
//   SECTION B: CONTINUOUS RAIN WARNING (ALERT) ...
//   SECTION C: TERMINATION OF CONTINUOUS RAIN WARNING ...
// Termination sections list areas whose warning just ENDED — they must
// be excluded before looking for Pahang, or a lifted warning would
// re-highlight its districts (same principle as the isWarningActive
// termination guard for thunderstorm bulletins).
// ---------------------------------------------------------------------

// Severity of ONE rain section, read from its heading line only — e.g.
// "SECTION A: CONTINUOUS RAIN WARNING (SEVERE)" / "SEKSYEN A: AMARAN
// HUJAN BERTERUSAN (BURUK)". Body text is excluded so a sentence that
// merely mentions "danger" can't inflate the tier.
function rainSectionTier(section) {
  const headMatch = section.match(/^(?:SECTION|SEKSYEN)\s+[A-Z]\s*:[^\n]*/i);
  const head = headMatch ? headMatch[0] : section.split('\n')[0];
  if (/\b(DANGER|BAHAYA)\b/i.test(head)) return 'bahaya';
  if (/\b(SEVERE|BURUK)\b/i.test(head)) return 'buruk';
  return 'waspada'; // ALERT/WASPADA, or an unlabeled heading — lowest tier
}

function parseRainPahang(textEn) {
  const sections = String(textEn || '')
    .split(/(?=SECTION\s+[A-Z]\s*:|SEKSYEN\s+[A-Z]\s*:)/i)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !/^(SECTION|SEKSYEN)\s+[A-Z]\s*:\s*(TERMINATION|PENAMATAN)/i.test(s));

  // Each section carries its own tier — do NOT join sections before
  // scanning, or "SECTION A (SEVERE): Maran / SECTION B (ALERT):
  // Temerloh" would collapse into one tierless district list.
  const tiers = {};        // district → highest tier across sections
  let stateTier = null;    // tier of any section naming Pahang without districts

  sections.forEach(section => {
    const tier = rainSectionTier(section);
    const m = section.match(/Pahang\s*\(([^)]+)\)/i);
    if (m) {
      splitDistrictList(m[1]).map(resolveDistrictName).filter(Boolean).forEach(d => {
        if (!tiers[d] || TIER_RANK[tier] > TIER_RANK[tiers[d]]) tiers[d] = tier;
      });
    } else if (/\bPahang\b/i.test(section)) {
      if (!stateTier || TIER_RANK[tier] > TIER_RANK[stateTier]) stateTier = tier;
    }
  });

  const districts = Object.keys(tiers);
  if (stateTier) {
    // Some section covered Pahang with no district detail — whole state
    // gets that tier's wash; explicit district tiers still paint on top.
    return { scope: 'state', districts: districts.length ? districts : KNOWN_DISTRICTS.slice(), tiers, tier: stateTier };
  }
  if (districts.length) {
    return { scope: 'district', districts, tiers, tier: null };
  }
  return { scope: null, districts: [], tiers: {}, tier: null }; // Pahang not affected — don't show
}

// Normalizes metapi2's RAIN payload rows into the same shape the
// banner/state code already consumes (heading_bm, text_bm, valid_to...),
// plus `source: 'rain'` and a precomputed `pahang` scope. Rows whose
// active sections never mention Pahang are dropped — these pages are
// Pahang-scoped, a KL/Sabah-only rain warning is noise here.
function normalizeRainWarnings(metJson) {
  const rows = (metJson && Array.isArray(metJson.results)) ? metJson.results : [];
  return rows
    .map(row => {
      const v = row.value || {};
      const attrs = row.attributes || {};
      const textEn = v.text?.en?.warning || '';
      const textBm = v.text?.ms?.warning || '';
      return {
        source: 'rain',
        warning_issue: {
          issued: attrs.timestamp || row.date,
          title_en: attrs.title?.en || v.heading?.en || 'Continuous Rain Warning',
          title_bm: attrs.title?.ms || v.heading?.ms || 'Amaran Hujan Berterusan',
        },
        heading_en: attrs.title?.en || v.heading?.en || '',
        heading_bm: attrs.title?.ms || v.heading?.ms || '',
        text_en: textEn,
        text_bm: textBm,
        instruction_bm: null,
        valid_from: attrs.valid_from || null,
        valid_to: attrs.valid_to || null,
        pahang: parseRainPahang(textEn || textBm),
      };
    })
    .filter(w => w.pahang.scope !== null);
}

async function fetchRainWarnings() {
  const resp = await fetchWithTimeout(RAIN_PROXY_URL, 8000);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return normalizeRainWarnings(data).filter(isWarningActive);
}

async function fetchActiveWarnings() {
  const resp = await fetchWithTimeout(WARNING_API_URL);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  const rows = Array.isArray(data) ? data : [];
  return rows.filter(isWarningActive);
}

// Rain warnings carry a precomputed `pahang` scope (SEKSYEN-aware);
// thunderstorm/other data.gov.my warnings are parsed on the fly.
function pahangScopeOf(w) {
  return w.source === 'rain' ? w.pahang : extractPahangDistricts(w);
}

function computeWarningState(warnings) {
  const districts = new Map(); // district → highest tier across all warnings
  let scope = null;            // null | 'district' | 'state'
  let stateTier = null;

  warnings.forEach(w => {
    const parsed = pahangScopeOf(w);
    if (parsed.scope === 'marine' || parsed.scope === null) return; // no land district affected
    if (parsed.scope === 'state') {
      scope = 'state'; // state wash for the vague warning — district tiers still paint on top
      const t = parsed.tier || 'amaran';
      if (!stateTier || TIER_RANK[t] > TIER_RANK[stateTier]) stateTier = t;
    } else if (scope !== 'state') {
      scope = 'district';
    }
    Object.entries(parsed.tiers || {}).forEach(([d, t]) => {
      const cur = districts.get(d);
      if (!cur || TIER_RANK[t] > TIER_RANK[cur]) districts.set(d, t);
    });
  });

  return { scope, districts, stateTier };
}

// ---------------------------------------------------------------------
// Small shared formatters
// ---------------------------------------------------------------------
function formatValidTo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------
// ?testWarning= fixtures — same convention as waktu-solat/index.html's
// ?testDate=/?testTime=. Supported values:
//   none                    — no active warnings
//   state                   — whole-state land advisory (no district detail)
//   marine                  — offshore-only bulletin (must NOT highlight any district)
//   district:Temerloh       — one district
//   district:Kuantan,Pekan  — multiple districts
//   rain                    — continuous-rain bulletin, whole-state Pahang (Waspada)
//   rain:Temerloh,Maran     — continuous-rain, specific districts (Waspada)
//   rain:buruk              — whole-state at a tier (waspada|buruk|bahaya)
//   rain:bahaya:Maran       — specific districts at a tier
//   rain:buruk:Maran;waspada:Temerloh,Bera
//                           — multi-SECTION bulletin, one section per
//                             ;-group (tests per-section tier colouring
//                             and highest-tier-wins)
//
// Builds a fixture `activeWarnings` array from the given param value, or
// returns undefined when the param is absent/unrecognized so callers
// fall back to the live API. Fixtures run through the exact same
// extractPahangDistricts()/computeWarningState() code path as real
// API data — this only replaces the network fetch, never the logic
// being tested.
// ---------------------------------------------------------------------
function getTestWarningFixture(param) {
  if (!param) return undefined;

  const now = new Date();
  const base = {
    warning_issue: { issued: now.toISOString(), title_en: 'Thunderstorms Warning', title_bm: 'Amaran Ribut Petir' },
    valid_from: now.toISOString(),
    valid_to: new Date(now.getTime() + 3600000).toISOString(), // +1 hour
    heading_bm: 'Amaran Ribut Petir (UJIAN)',
    heading_en: 'Thunderstorms Warning (TEST)',
    instruction_bm: 'Ini adalah data ujian dari ?testWarning=, bukan amaran sebenar.',
  };

  if (param === 'none') return [];

  if (param === 'state') {
    return [{ ...base, text_en: 'Test warning affecting Pahang generally.', text_bm: 'Amaran ujian yang menjejaskan Pahang secara umum.' }];
  }

  if (param === 'marine') {
    return [{ ...base, text_en: 'Thunderstorms expected over the waters of Pahang, Terengganu.', text_bm: 'Ribut petir dijangka di kawasan perairan Pahang, Terengganu.' }];
  }

  if (param.startsWith('district:')) {
    const list = param.slice('district:'.length).split(',').map(s => s.trim()).filter(Boolean).join(', ');
    return [{ ...base, text_en: `Thunderstorms Warning for Pahang (${list})`, text_bm: `Amaran Ribut Petir untuk Pahang (${list})` }];
  }

  // rain fixtures — built as a real metapi2-shaped payload and run
  // through the SAME normalizeRainWarnings()/parseRainPahang() path as
  // proxy data, always including a trailing TERMINATION section that
  // the parser must ignore. Syntax (see the block comment above):
  //   rain | rain:<districts> | rain:<tier> | rain:<tier>:<districts>
  //   multiple ;-separated groups become SECTION A, B, ... each with
  //   its own tier heading.
  if (param === 'rain' || param.startsWith('rain:')) {
    const TIER_WORDS = {
      waspada: { en: 'ALERT', bm: 'WASPADA', headEn: 'Alert', headBm: 'Waspada' },
      buruk: { en: 'SEVERE', bm: 'BURUK', headEn: 'Severe', headBm: 'Buruk' },
      bahaya: { en: 'DANGER', bm: 'BAHAYA', headEn: 'Danger', headBm: 'Bahaya' },
    };
    const spec = param === 'rain' ? '' : param.slice('rain:'.length);
    const groups = spec.split(';').map(g => g.trim());

    const sectionsEn = [];
    const sectionsBm = [];
    let maxTier = 'waspada';
    groups.forEach((group, idx) => {
      const parts = group.split(':').map(s => s.trim());
      let tier = 'waspada';
      let list = parts[0] || null;
      if (parts[0] && TIER_WORDS[parts[0].toLowerCase()]) {
        tier = parts[0].toLowerCase();
        list = parts[1] || null;
      }
      if (list) list = list.split(',').map(s => s.trim()).filter(Boolean).join(', ');
      if (TIER_RANK[tier] > TIER_RANK[maxTier]) maxTier = tier;

      const letter = String.fromCharCode(65 + idx); // A, B, C ...
      const w = TIER_WORDS[tier];
      const areaEn = list ? `Pahang (${list})` : 'the state of Pahang';
      const areaBm = list ? `Pahang (${list})` : 'negeri Pahang';
      // ". (TEST DATA)" — the period matters: "Pahang (TEST DATA)" would
      // match the district-list regex and swallow the state-wide case.
      sectionsEn.push(`SECTION ${letter}: CONTINUOUS RAIN WARNING (${w.en})\nContinuous rain is expected to occur over ${areaEn}. (TEST DATA)`);
      sectionsBm.push(`SEKSYEN ${letter}: AMARAN HUJAN BERTERUSAN (${w.bm})\nHujan berterusan dijangka berlaku di ${areaBm}. (DATA UJIAN)`);
    });

    const termLetter = String.fromCharCode(65 + groups.length);
    sectionsEn.push(`SECTION ${termLetter}: TERMINATION OF CONTINUOUS RAIN WARNING\nContinuous Rain Warning (Alert) for Pahang (Rompin) is now terminated.`);
    sectionsBm.push(`SEKSYEN ${termLetter}: PENAMATAN AMARAN HUJAN BERTERUSAN\nAmaran Hujan Berterusan (Waspada) untuk Pahang (Rompin) kini ditamatkan.`);

    const headEn = `Continuous Rain Warning (${TIER_WORDS[maxTier].headEn}) (TEST)`;
    const headBm = `Amaran Hujan Berterusan (${TIER_WORDS[maxTier].headBm}) (UJIAN)`;
    const metShaped = {
      results: [{
        date: base.warning_issue.issued,
        datatype: 'RAIN',
        value: {
          heading: { en: headEn, ms: headBm },
          text: {
            en: { warning: sectionsEn.join('\n') },
            ms: { warning: sectionsBm.join('\n') },
          },
        },
        attributes: {
          title: { en: headEn, ms: headBm },
          timestamp: base.warning_issue.issued,
          valid_from: base.valid_from,
          valid_to: base.valid_to,
        },
      }],
    };
    return normalizeRainWarnings(metShaped);
  }

  console.warn('[weather] Unknown ?testWarning= value, falling back to live API:', param);
  return undefined;
}
