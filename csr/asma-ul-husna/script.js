const ASMA_EPOCH_DATE = '2026-08-16';
const ASMA_SVG_BASE = '/csr/asma-ul-husna/data/SVG/gold/';

function asmaGetMalaysiaToday() {
    const iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    return new Date(iso + 'T00:00:00');
}

function asmaDayIndexForDate(date) {
    const epoch = new Date(ASMA_EPOCH_DATE + 'T00:00:00');
    const daysSince = Math.floor((date - epoch) / 86400000);
    return ((daysSince % 99) + 99) % 99;
}

function asmaIndexFromURL(todayIndex0) {
    const params = new URLSearchParams(window.location.search);
    const dayParam = params.get('day') !== null ? params.get('day') : params.get('name');
    const dateParam = params.get('date');

    if (dayParam !== null && dayParam !== '' && !isNaN(dayParam)) {
        return (((parseInt(dayParam, 10) - 1) % 99) + 99) % 99;
    }
    if (dateParam) {
        const d = new Date(dateParam + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return asmaDayIndexForDate(d);
        }
    }
    return todayIndex0;
}

function asmaLoadNames() {
    return fetch('/csr/asma-ul-husna/data/names.json?v=' + Date.now())
        .then(function (r) { if (!r.ok) throw new Error('Gagal memuatkan data.'); return r.json(); })
        .then(function (data) {
            const names = data.names.slice().sort(function (a, b) { return a.index - b.index; });
            const todayIndex0 = asmaDayIndexForDate(asmaGetMalaysiaToday());
            return { names: names, todayIndex0: todayIndex0 };
        });
}
