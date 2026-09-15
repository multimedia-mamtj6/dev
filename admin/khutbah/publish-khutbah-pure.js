// Pure scraper logic for the khutbah module — ported verbatim from
// khutbah/google_app_script/KhutbahLinkGenerator.gs + gettajukkhutbah.gs.
//
// Same convention as admin/news/publish-news-pure.js and
// admin/alert-send-pure.js: ZERO Node/Vercel-only APIs in this file, so it
// doubles as a plain <script src> in the browser AND via require() from
// api/publish-khutbah.js. Network I/O (waktusolat fetch, mufti fetch) lives
// in the api route, not here — everything here is deterministic string/date
// math plus regex extraction, unit-testable without a live deploy.
//
// Source fidelity notes (don't "improve" without reading DEV_NOTES.md):
// - getNextFriday(): today if Friday, else next Friday — matches GAS exactly.
// - SIRI month/year come from the FRIDAY's date, not today's (deliberate —
//   matters at month boundaries: a Monday run computing a September Friday
//   says SIRI 9, not SIRI 8).
// - Gregorian slug: dd-{malay-month}-yyyy, zero-padded day (formatGregorianDate).
// - Hijri slug: dd-{malay-hijri-month}-yyyy via parseHijriSlug("1447-04-04").
// - Link: https://mufti.pahang.gov.my/khutbah/{year}/{greg}m-{hijri}h
// - extractDateTitle() keeps BOTH primary and alt regexes: the primary
//   dateRegex is already stale on the live site (falls through to alt — see
//   khutbah/DEV_NOTES.md). The dateMatched/titleMatched flags make the next
//   markup drift visible in admin instead of silent.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.PublishKhutbahPure = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MALAY_MONTHS = [
        'januari', 'februari', 'mac', 'april', 'mei', 'jun',
        'julai', 'ogos', 'september', 'oktober', 'november', 'desember'
    ];

    var HIJRI_MONTHS = [
        'muharram', 'safar', 'rabiulawal', 'rabiulakhir', 'jamadilawal', 'jamadilakhir',
        'rejab', 'syaaban', 'ramadan', 'syawal', 'zulkaedah', 'zulhijjah'
    ];

    // --- Date math (MYT-safe: callers pass a Date already resolved to MYT) ---

    // Next Friday: today if Friday (getDay()===5), else upcoming Friday.
    function getNextFriday(fromDate) {
        var base = fromDate ? new Date(fromDate.getTime()) : new Date();
        var dayOfWeek = base.getDay();
        if (dayOfWeek === 5) return base;
        var daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        base.setDate(base.getDate() + daysUntilFriday);
        return base;
    }

    function toISODate(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function formatGregorianDate(date) {
        var day = String(date.getDate()).padStart(2, '0');
        var month = MALAY_MONTHS[date.getMonth()];
        var year = date.getFullYear();
        return day + '-' + month + '-' + year;
    }

    // "1447-04-04" → "04-rabiulakhir-1447". Returns null on malformed input.
    function parseHijriSlug(hijriDateString) {
        if (!hijriDateString || typeof hijriDateString !== 'string') return null;
        var parts = hijriDateString.trim().split('-');
        if (parts.length !== 3) return null;
        var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 30) return null;
        return String(d).padStart(2, '0') + '-' + HIJRI_MONTHS[m - 1] + '-' + y;
    }

    function buildMuftiLink(fridayDate, hijriSlug) {
        var year = fridayDate.getFullYear();
        var greg = formatGregorianDate(fridayDate);
        return 'https://mufti.pahang.gov.my/khutbah/' + year + '/' + greg + 'm-' + hijriSlug + 'h';
    }

    function buildSiriText(fridayDate) {
        return 'MIMBAR JUMAAT SIRI ' + (fridayDate.getMonth() + 1) + ' | ' + fridayDate.getFullYear();
    }

    // --- Title cleaning (gettajukkhutbah.gs:cleanTitleHtml verbatim) ---
    // h1 inner HTML may contain <br /> line breaks:
    // "Puasa Sunat Bulan Muharam<br />(Tasua' dan Asyura)" → "... Muharam (Tasua' ...)"
    function cleanTitleHtml(innerHtml) {
        return innerHtml
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function looksLikeErrorText(s) {
        return /^ERROR/i.test(s || '') || /status:\s*\d{3}/i.test(s || '');
    }

    // --- Extraction (regexes verbatim from gettajukkhutbah.gs) ---
    var DATE_REGEX = /<span class="el-image" uk-icon="icon:\s*calendar[^"]*"><\/span>\s*<span class="uk-text-middle uk-margin-remove-last-child">([^<]+)<\/span>/;
    var ALT_DATE_REGEX = /uk-icon="icon:\s*calendar[^"]*"[^>]*>\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/;
    var TITLE_REGEX = /<h1 class="uk-h2 uk-heading-divider uk-margin-small"[^>]*>([\s\S]*?)<\/h1>/;
    var ALT_TITLE_REGEX = /<h1[^>]*uk-h2[^>]*>([\s\S]*?)<\/h1>/;

    function extractDateTitle(html) {
        var dateMatch = html.match(DATE_REGEX);
        var titleMatch = html.match(TITLE_REGEX);
        var dateMatched = 'primary', titleMatched = 'primary';
        var dateText = null, titleText = null;

        if (dateMatch) {
            dateText = dateMatch[1].trim();
        } else {
            var altDateMatch = html.match(ALT_DATE_REGEX);
            if (altDateMatch) {
                dateText = altDateMatch[1].trim();
                dateMatched = 'fallback';
            } else {
                dateMatched = 'miss';
            }
        }

        if (titleMatch) {
            titleText = cleanTitleHtml(titleMatch[1]);
        } else {
            var altTitleMatch = html.match(ALT_TITLE_REGEX);
            if (altTitleMatch) {
                titleText = cleanTitleHtml(altTitleMatch[1]);
                titleMatched = 'fallback';
            } else {
                titleMatched = 'miss';
            }
        }

        if ((dateText && looksLikeErrorText(dateText)) || (titleText && looksLikeErrorText(titleText))) {
            return { dateText: null, titleText: null, dateMatched: 'miss', titleMatched: 'miss' };
        }
        return { dateText: dateText, titleText: titleText, dateMatched: dateMatched, titleMatched: titleMatched };
    }

    // --- Published JSON shape (read by khutbah/paparan-tajuk.html) ---
    function buildKhutbahJson(rows) {
        // rows: khutbah_weeks rows, Friday-desc. current = latest ok row.
        var sorted = (rows || []).slice().sort(function (a, b) {
            return String(b.friday_date).localeCompare(String(a.friday_date));
        });
        var current = sorted.find(function (r) { return r.scrape_status === 'ok' || r.title; }) || sorted[0] || null;
        function toEntry(r) {
            if (!r) return null;
            return {
                friday_date: r.friday_date, source_url: r.source_url, siri_text: r.siri_text,
                title: r.title, date_text: r.date_text, main_text: r.main_text,
                manual_override: !!r.manual_override,
            };
        }
        return {
            current: toEntry(current),
            history: sorted.map(toEntry),
            updated_at: new Date().toISOString(),
        };
    }

    return {
        MALAY_MONTHS: MALAY_MONTHS,
        HIJRI_MONTHS: HIJRI_MONTHS,
        getNextFriday: getNextFriday,
        toISODate: toISODate,
        formatGregorianDate: formatGregorianDate,
        parseHijriSlug: parseHijriSlug,
        buildMuftiLink: buildMuftiLink,
        buildSiriText: buildSiriText,
        cleanTitleHtml: cleanTitleHtml,
        looksLikeErrorText: looksLikeErrorText,
        extractDateTitle: extractDateTitle,
        buildKhutbahJson: buildKhutbahJson,
    };
}));
