// Shared email sender for ALL admin modules (khutbah first consumer).
//
// One provider (Resend), one credential (RESEND_API_KEY env var), one helper.
// Every module stores only its own recipients in its own *_settings table
// (khutbah_settings.alert_emails, ...) and calls sendAlert() — no per-module
// vendor, keys, or domain re-verification.
//
// Same convention as admin/news/publish-news-pure.js and
// admin/staff/staff-pin-pure.js: this file has ZERO Node/Vercel-only APIs so
// it doubles as a plain <script src> in the browser AND via require() from
// any api/*.js. Never move shared pure logic under api/ — any file there is
// a live serverless route, not servable source.
//
// Contract:
//   sendAlert({ to, subject, text }) → { sent, reason }
//     - to: string[] (already split/trimmed by parseRecipients())
//     - never throws: mail failure returns { sent:false } so a mail failure
//       can never fail the publish/scrape it rode along with.
//   shouldAlert(lastAlertAtIso, { throttleHours }) → bool (transition+throttle
//     guard lives in the caller; this is the throttle half).
//   parseRecipients(raw) → string[] (comma-separated settings value → array).
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.AlertSendPure = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var RESEND_ENDPOINT = 'https://api.resend.com/emails';
    // Resend free tier: 100/day, 3k/mo. This repo sends ~1-5 alert mails/week
    // total — the throttle below is structural (prevents a stuck URL from
    // spamming), not quota protection.
    var DEFAULT_THROTTLE_HOURS = 24;
    var MAX_RECIPIENTS_PER_CALL = 50; // Resend limit

    function parseRecipients(raw) {
        if (!raw || typeof raw !== 'string') return [];
        return raw.split(',')
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length > 0; })
            .slice(0, MAX_RECIPIENTS_PER_CALL);
    }

    function shouldAlert(lastAlertAtIso, opts) {
        var hours = (opts && opts.throttleHours) || DEFAULT_THROTTLE_HOURS;
        if (!lastAlertAtIso) return true;
        var last = Date.parse(lastAlertAtIso);
        if (isNaN(last)) return true; // corrupt value fails open (alert once, then cache repairs itself)
        return (Date.now() - last) > hours * 60 * 60 * 1000;
    }

    // env: { apiKey, from } — passed in by the api/ caller (process.env),
    // never read here so this file stays browser-loadable.
    async function sendAlert(args, env) {
        var to = args.to || [];
        var subject = args.subject || '(no subject)';
        var text = args.text || '';
        var apiKey = env && env.apiKey;
        var from = env && env.from;

        if (!apiKey) return { sent: false, reason: 'alert_skipped_no_key' };
        if (!from) return { sent: false, reason: 'alert_skipped_no_from' };
        if (!to.length) return { sent: false, reason: 'alert_skipped_no_recipients' };

        try {
            var res = await fetch(RESEND_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ from: from, to: to, subject: subject, text: text }),
            });
            if (!res.ok) {
                var errText = await res.text().catch(function () { return ''; });
                return { sent: false, reason: 'alert_send_failed_' + res.status, detail: errText.slice(0, 300) };
            }
            return { sent: true, reason: 'alert_sent' };
        } catch (e) {
            return { sent: false, reason: 'alert_send_error', detail: String(e && e.message || e).slice(0, 300) };
        }
    }

    return {
        RESEND_ENDPOINT: RESEND_ENDPOINT,
        DEFAULT_THROTTLE_HOURS: DEFAULT_THROTTLE_HOURS,
        MAX_RECIPIENTS_PER_CALL: MAX_RECIPIENTS_PER_CALL,
        parseRecipients: parseRecipients,
        shouldAlert: shouldAlert,
        sendAlert: sendAlert,
    };
}));
