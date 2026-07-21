-- ─────────────────────────────────────────────────────────────────────────────
-- One-time bulk import of legacy infaq data, transcribed from the Google
-- Sheet behind infaq.mamtj6.com (pasted into chat 2026-07-21). Run this
-- AFTER admin/setup.sql §8 has been run against this database — it depends
-- on infaq_kutipan_mingguan / infaq_projek_kutipan / infaq_perbelanjaan_bulanan
-- already existing.
--
-- Sections A and B are safe to re-run (ON CONFLICT DO NOTHING against their
-- UNIQUE constraints). Section C (the project + its donations) is NOT fully
-- idempotent — infaq_projek_kutipan has no unique constraint (legitimate
-- same-day duplicate donations exist in the real data), so re-running it
-- will create duplicate rows. Run Section C once, then don't run it again.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── A. General weekly infaq (infaq_kutipan_mingguan) ──────────────────────────
-- Transcribed from the Sheet's Tahun/Bulan/Minggu1-5/JumlahBulanan columns.
-- "-" cells (no collection that week) are simply omitted — matches the
-- sparse-by-design schema (absence of a row = 0, never a stored zero).

INSERT INTO infaq_kutipan_mingguan (tahun, bulan, minggu, jumlah) VALUES
    (2024,1,1,2765),(2024,1,2,2681),(2024,1,3,3162),(2024,1,4,3068),
    (2024,2,1,2636),(2024,2,2,1267),(2024,2,3,5981),(2024,2,4,3375),(2024,2,5,1272),
    (2024,3,1,868),(2024,3,2,3527),(2024,3,3,5130),(2024,3,4,4792),(2024,3,5,3481),
    (2024,4,1,4576),(2024,4,2,2271),(2024,4,3,1866),(2024,4,4,1691),
    (2024,5,1,1767),(2024,5,2,1691),(2024,5,3,3121),(2024,5,4,2041),(2024,5,5,1912),
    (2024,6,1,2139),(2024,6,2,2200),(2024,6,3,2813),(2024,6,4,1831),
    (2024,7,1,2881),(2024,7,2,1232),(2024,7,3,1968),(2024,7,4,2147),
    (2024,8,1,2073),(2024,8,2,2118),(2024,8,3,2209),(2024,8,4,1865),(2024,8,5,1927),
    (2024,9,1,2133),(2024,9,2,1875),(2024,9,3,1684),(2024,9,4,2008),
    (2024,10,1,1860),(2024,10,2,2155),(2024,10,3,2195),(2024,10,4,2129),
    (2024,11,1,1807),(2024,11,2,1750),(2024,11,3,1955),(2024,11,4,1883),(2024,11,5,2247),
    (2024,12,1,1515),(2024,12,2,1737),(2024,12,3,1917),(2024,12,4,1898),

    (2025,1,1,2025),(2025,1,2,1948),(2025,1,3,1857),(2025,1,4,1996),(2025,1,5,1797),
    (2025,2,1,1967),(2025,2,2,2045),(2025,2,3,1812),(2025,2,4,1548),
    (2025,3,1,3390),(2025,3,2,3255),(2025,3,3,3327),(2025,3,4,4024),(2025,3,5,838),
    (2025,4,1,2076),(2025,4,2,2044),(2025,4,3,1988),(2025,4,4,1857),
    (2025,5,1,2019),(2025,5,2,1977),(2025,5,3,2061),(2025,5,4,1973),(2025,5,5,2043),
    (2025,6,1,2076),(2025,6,2,2601),(2025,6,3,1722),(2025,6,4,2300),
    (2025,7,1,1968),(2025,7,2,1714),(2025,7,3,1767),(2025,7,4,1712),
    (2025,8,1,2026),(2025,8,2,1777),(2025,8,3,1813),(2025,8,4,1890),(2025,8,5,1831),
    (2025,9,1,1630),(2025,9,2,1752),(2025,9,3,1577),(2025,9,4,1802),
    (2025,10,1,1900),(2025,10,2,1718),(2025,10,3,1913),(2025,10,4,1946),(2025,10,5,1866),
    (2025,11,1,1707),(2025,11,2,1879),(2025,11,3,1932),(2025,11,4,1897),
    (2025,12,1,1955),(2025,12,2,1669),(2025,12,3,1647),(2025,12,4,1679),

    (2026,1,1,1658.8),(2026,1,2,1845),(2026,1,3,1321),(2026,1,4,1655),(2026,1,5,1533),
    (2026,2,1,2120),(2026,2,2,2077),(2026,2,3,3605),(2026,2,4,4945),
    (2026,3,1,4550),(2026,3,2,4796),(2026,3,3,6537),(2026,3,4,2000),
    (2026,4,1,1765),(2026,4,2,1793),(2026,4,3,1951),(2026,4,4,1806),
    (2026,5,1,1552),(2026,5,2,1536),(2026,5,3,1866),(2026,5,4,2038),(2026,5,5,2860),
    (2026,6,1,1294),(2026,6,2,2148),(2026,6,3,1872),(2026,6,4,2138),
    (2026,7,1,1642),(2026,7,2,1689),(2026,7,3,1816)
ON CONFLICT (tahun, bulan, minggu) DO NOTHING;


-- ── B. Expenses (infaq_perbelanjaan_bulanan) ──────────────────────────────────
-- Only 2025 has non-zero months in the Sheet; 2023/2024/2026 are all "0",
-- omitted entirely — same sparse-by-design principle.

INSERT INTO infaq_perbelanjaan_bulanan (tahun, bulan, jumlah) VALUES
    (2025,1,7611.05),(2025,2,6201.57),(2025,3,8375.25),(2025,4,2499.95),
    (2025,5,2713.45),(2025,6,3341.90),(2025,7,2754.25),(2025,8,6940.35),
    (2025,9,3116.15),(2025,10,8953.66),(2025,11,9799.25),(2025,12,15845.60)
ON CONFLICT (tahun, bulan) DO NOTHING;


-- ── C. Project + its individual donations ──────────────────────────────────────
-- Idempotent by name (safe to re-run this INSERT specifically — it no-ops
-- if a project with this exact name already exists, e.g. because you
-- created it via admin/infaq/projek.html already).
INSERT INTO infaq_projects (name, target_amount, is_active)
SELECT 'Infaq Tabung Bangunan Tambahan MAMTJ6', 250000, true
WHERE NOT EXISTS (
    SELECT 1 FROM infaq_projects WHERE name = 'Infaq Tabung Bangunan Tambahan MAMTJ6'
);

-- Excluded from the list below: the Sheet's "Pelancaran Tabung (Fizikal)"
-- row (2024-03-28, RM0) — a launch announcement, not a real donation; the
-- schema requires jumlah > 0 and has no "informational entry" concept.
--
-- Corrected: the Sheet's "2022-12-20" row is almost certainly a typo for
-- 2024-12-20 — its own keterangan says "13/12/2024" and it sits
-- chronologically between the 2024-12-06 and 2024-12-23 entries. Imported
-- below with the corrected date (flagged in its own keterangan) — fix
-- further or revert via admin/infaq/projek-kutipan.html if the committee
-- says otherwise.
--
-- NOT idempotent — no unique constraint on this table (legitimate same-day
-- duplicate donations exist below, e.g. 2024-04-08 and 2026-07-12). Run
-- this INSERT once only.
INSERT INTO infaq_projek_kutipan (project_id, tarikh, jumlah, keterangan)
SELECT (SELECT id FROM infaq_projects WHERE name = 'Infaq Tabung Bangunan Tambahan MAMTJ6' LIMIT 1),
       tarikh, jumlah, keterangan
FROM (VALUES
    ('2024-03-29'::date, 3053.00::numeric, 'Kutipan Tabung (Fizikal)'),
    ('2024-04-03', 3037.00, 'Kutipan Tabung (Fizikal, 2/4/2024)'),
    ('2024-04-08', 3849.00, 'Kutipan Tabung (Fizikal, 5/4/2024)'),
    ('2024-04-08', 4689.00, 'Kutipan Tabung (Fizikal, 8/4/2024)'),
    ('2024-04-15', 2737.00, 'Kutipan Tabung (Fizikal, 10/4/2024)'),
    ('2024-04-15', 4.00, 'Kutipan Tabung (Fizikal, 13/4/2024)'),
    ('2024-04-15', 776.00, 'Kutipan Tabung (Fizikal, 13/4/2024)'),
    ('2024-04-30', 2477.00, 'Kutipan Tabung (Fizikal, 19/4/2024)'),
    ('2024-04-30', 1932.00, 'Kutipan Tabung (Fizikal, 26/4/2024)'),
    ('2024-05-07', 1521.00, 'Kutipan Tabung (Fizikal, 3/5/2024)'),
    ('2024-05-14', 1502.00, 'Kutipan Tabung (Fizikal, 12/5/2024)'),
    ('2024-05-23', 1134.00, 'Kutipan Tabung (Fizikal, 17/5/2024)'),
    ('2024-05-27', 2097.00, 'Kutipan Tabung (Fizikal, 24/5/2024)'),
    ('2024-06-04', 1429.00, 'Kutipan Tabung (Fizikal, 31/5/2024)'),
    ('2024-06-10', 1563.00, 'Kutipan Tabung (Fizikal, 7/6/2024)'),
    ('2024-06-18', 1303.00, 'Kutipan Tabung (Fizikal, 14/6/2024)'),
    ('2024-06-30', 2331.00, 'Kutipan Tabung (Fizikal, 21/6/2024)'),
    ('2024-07-01', 1231.00, 'Kutipan Tabung (Fizikal, 28/6/2024)'),
    ('2024-07-15', 2535.00, 'Kutipan Tabung (Fizikal, 12/7/2024)'),
    ('2024-07-22', 345.00, 'Kutipan Tabung (Fizikal, 17/7/2024)'),
    ('2024-07-22', 1233.00, 'Kutipan Tabung (Fizikal, 19/7/2024)'),
    ('2024-08-01', 277.80, 'Kutipan Tabung (Fizikal, syiling 17/7/2024)'),
    ('2024-08-01', 1542.00, 'Kutipan Tabung (Fizikal, 26/7/2024)'),
    ('2024-08-06', 1253.00, 'Kutipan Tabung (Fizikal, 2/8/2024)'),
    ('2024-08-09', 1574.00, 'Kutipan Tabung (Fizikal, 9/8/2024)'),
    ('2024-08-20', 1462.00, 'Kutipan Tabung (Fizikal, 16/8/2024)'),
    ('2024-08-26', 1750.00, 'Kutipan Tabung (Fizikal, 23/8/2024)'),
    ('2024-09-02', 1400.00, 'Kutipan Tabung (Fizikal, 30/8/2024)'),
    ('2024-09-10', 1199.00, 'Kutipan Tabung (Fizikal, 6/9/2024)'),
    ('2024-09-19', 1223.00, 'Kutipan Tabung (Fizikal, 13/9/2024)'),
    ('2024-09-24', 2088.00, 'Kutipan Tabung (Fizikal, 20/9/2024)'),
    ('2024-09-30', 1565.20, 'Kutipan Tabung (Fizikal, 27/9/2024)'),
    ('2024-10-09', 1294.00, 'Kutipan Tabung (Fizikal, 4/10/2024)'),
    ('2024-10-14', 1300.00, 'Kutipan Tabung (Fizikal, 11/10/2024)'),
    ('2024-10-21', 1275.00, 'Kutipan Tabung (Fizikal, 18/10/2024)'),
    ('2024-10-28', 1113.00, 'Kutipan Tabung (Fizikal, 25/10/2024)'),
    ('2024-11-04', 1297.00, 'Kutipan Tabung (Fizikal, 1/11/2024)'),
    ('2024-11-14', 1222.00, 'Kutipan Tabung (Fizikal, 8/11/2024)'),
    ('2024-11-18', 1176.00, 'Kutipan Tabung (Fizikal, 15/11/2024)'),
    ('2024-11-22', 1681.00, 'Kutipan Tabung (Fizikal, 22/11/2024)'),
    ('2024-12-02', 1679.00, 'Kutipan Tabung (Fizikal, 1/12/2024)'),
    ('2024-12-06', 757.00, 'Kutipan Tabung (Fizikal, 6/12/2024)'),
    ('2024-12-20', 1128.00, 'Kutipan Tabung (Fizikal, 13/12/2024) [tarikh dibetulkan drpd 2022-12-20]'),
    ('2024-12-23', 1315.00, 'Kutipan Tabung (Fizikal, 20/12/2024)'),
    ('2024-12-31', 1071.00, 'Kutipan Tabung (Fizikal, 27/12/2024)'),
    ('2025-01-06', 1528.00, 'Kutipan Tabung (Fizikal, 3/01/2025)'),
    ('2025-01-14', 1409.00, 'Tabung (Fizikal, 10/01/2025 & Syilling 31/12/2024)'),
    ('2025-01-21', 1432.00, 'Tabung (Fizikal, 17/01/2025 & Jualan barang terpakai 20/01/2025)'),
    ('2025-01-27', 1232.00, 'Tabung (Fizikal, 24/01/2025)'),
    ('2025-02-05', 1099.00, 'Tabung (Fizikal, 31/01/2025)'),
    ('2025-02-10', 1410.00, 'Tabung (Fizikal, 07/02/2025)'),
    ('2025-02-14', 1292.00, 'Tabung (Fizikal, 14/02/2025)'),
    ('2025-02-24', 1261.00, 'Tabung (Fizikal, 21/02/2025)'),
    ('2025-03-03', 1234.00, 'Tabung (Fizikal, 28/02/2025)'),
    ('2025-03-03', 1300.00, 'Infaq seorang jemaah (2/03/2025)'),
    ('2025-03-07', 2068.00, 'Tabung (Fizikal, 7/03/2025)'),
    ('2025-03-17', 1463.00, 'Tabung (Fizikal, 14/03/2025)'),
    ('2025-03-24', 2046.00, 'Tabung (Fizikal, 21/03/2025)'),
    ('2025-03-26', 200.00, 'Infaq muslimah PPGPT (25/03/2025)'),
    ('2025-03-30', 500.00, 'Infaq jemaah (30/03/2025)'),
    ('2025-04-05', 200.00, 'Infaq jemaah (5/04/2025)'),
    ('2025-04-07', 3067.00, 'Tabung (Fizikal, 28/03/2025)'),
    ('2025-04-08', 1992.00, 'Tabung (Fizikal, 4/04/2025)'),
    ('2025-04-11', 1112.00, 'Tabung (Fizikal, 11/04/2025)'),
    ('2025-04-18', 1152.00, 'Tabung (Fizikal, 18/04/2025)'),
    ('2025-04-28', 1249.00, 'Tabung (Fizikal, 25/04/2025)'),
    ('2025-05-05', 1333.00, 'Tabung (Fizikal, 2/05/2025)'),
    ('2025-05-09', 1065.00, 'Tabung (Fizikal, 9/05/2025)'),
    ('2025-05-19', 896.00, 'Tabung (Fizikal, 16/05/2025)'),
    ('2025-05-28', 1160.00, 'Tabung (Fizikal, 23/05/2025)'),
    ('2025-06-03', 966.00, 'Tabung (Fizikal, 30/05/2025)'),
    ('2025-06-09', 2187.00, 'Tabung (Fizikal, 6/06/2025)'),
    ('2025-06-18', 1725.00, 'Tabung (Fizikal, 13/06/2025)'),
    ('2025-06-24', 1195.00, 'Tabung (Fizikal, 20/06/2025)'),
    ('2025-07-02', 1427.00, 'Tabung (Fizikal, 27/06/2025)'),
    ('2025-07-06', 2100.00, 'Infaq jemaah (serahan cek, 1/7/2025)'),
    ('2025-07-07', 1205.00, 'Tabung (Fizikal, 4/07/2025)'),
    ('2025-07-14', 1186.00, 'Tabung (Fizikal, 11/07/2025)'),
    ('2025-07-22', 1477.00, 'Tabung (Fizikal, 18/07/2025)'),
    ('2025-07-29', 739.00, 'Tabung (Fizikal, 25/07/2025)'),
    ('2025-08-04', 1199.00, 'Tabung (Fizikal, 01/08/2025)'),
    ('2025-08-11', 839.00, 'Tabung (Fizikal, 08/08/2025)'),
    ('2025-08-19', 1410.00, 'Tabung (Fizikal, 15/08/2025)'),
    ('2025-08-27', 1067.00, 'Tabung (Fizikal, 22/08/2025)'),
    ('2025-09-02', 2482.00, 'Tabung (Fizikal, 29/08/2025)'),
    ('2025-09-09', 1003.00, 'Tabung (Fizikal, 5/09/2025)'),
    ('2025-09-18', 1282.00, 'Tabung (Fizikal, 12/09/2025)'),
    ('2025-09-23', 924.00, 'Tabung (Fizikal, 19/09/2025)'),
    ('2025-09-30', 1147.00, 'Tabung (Fizikal, 26/09/2025)'),
    ('2025-10-06', 1055.00, 'Tabung (Fizikal, 3/10/2025)'),
    ('2025-10-14', 964.00, 'Tabung (Fizikal, 10/10/2025)'),
    ('2025-10-14', 381.00, 'Tabung (Fizikal, Syiling 3/10/2025)'),
    ('2025-10-21', 1001.00, 'Tabung (Fizikal, 17/10/2025)'),
    ('2025-10-27', 1030.00, 'Tabung (Fizikal, 24/10/2025)'),
    ('2025-11-04', 1429.00, 'Tabung (Fizikal, 31/10/2025)'),
    ('2025-11-10', 1240.00, 'Tabung (Fizikal, 7/11/2025)'),
    ('2025-11-20', 1013.00, 'Tabung (Fizikal, 14/11/2025)'),
    ('2025-11-24', 1139.00, 'Tabung (Fizikal, 21/11/2025)'),
    ('2025-12-01', 1171.00, 'Tabung (Fizikal, 28/11/2025)'),
    ('2025-12-08', 1108.00, 'Tabung (Fizikal, 5/12/2025)'),
    ('2025-12-19', 1241.00, 'Tabung (Fizikal, 12/12/2025)'),
    ('2025-12-19', 1040.00, 'Tabung (Fizikal, 19/12/2025)'),
    ('2025-12-31', 844.00, 'Tabung (Fizikal, 26/12/2025)'),
    ('2026-01-05', 2391.00, 'Tabung (Fizikal & tunai, 2/1/2026)'),
    ('2026-01-12', 855.00, 'Tabung (Fizikal, 9/1/2026)'),
    ('2026-01-16', 869.00, 'Tabung (Fizikal, 16/1/2026)'),
    ('2026-01-28', 1003.00, 'Tabung (Fizikal, 23/1/2026)'),
    ('2026-02-02', 1006.00, 'Tabung (Fizikal, 30/1/2026)'),
    ('2026-02-09', 1123.00, 'Tabung (Fizikal, 6/02/2026)'),
    ('2026-02-16', 1160.00, 'Tabung (Fizikal, 6/02/2026)'),
    ('2026-03-19', 500.00, 'Infaq Jemaah (Fizikal, 19/03/2026)'),
    ('2026-03-25', 670.00, 'Tabung (Fizikal, 21/03/2026), 1 syawal'),
    ('2026-03-30', 1411.00, 'Tabung (Fizikal, 27/03/2026)'),
    ('2026-04-03', 911.00, 'Tabung (Fizikal, 3/04/2026)'),
    ('2026-04-10', 1065.00, 'Tabung (Fizikal, 10/04/2026)'),
    ('2026-04-20', 1002.00, 'Tabung (Fizikal, 17/04/2026)'),
    ('2026-04-24', 1159.00, 'Tabung (Fizikal, 20/04/2026)'),
    ('2026-05-05', 1208.00, 'Tabung (Fizikal, 1/05/2026)'),
    ('2026-05-08', 1172.00, 'Tabung (Fizikal, 8/05/2026)'),
    ('2026-05-15', 1131.00, 'Tabung (Fizikal, 15/05/2026)'),
    ('2026-05-25', 1586.00, 'Tabung (Fizikal, 22/05/2026)'),
    ('2026-06-03', 1216.00, 'Tabung (Fizikal, 29/05/2026)'),
    ('2026-06-08', 1030.00, 'Tabung (Fizikal, 5/06/2026)'),
    ('2026-06-15', 1198.00, 'Tabung (Fizikal, 12/06/2026)'),
    ('2026-06-22', 1107.00, 'Tabung (Fizikal, 19/06/2026)'),
    ('2026-07-01', 1047.00, 'Tabung (Fizikal, 26/06/2026)'),
    ('2026-07-07', 1099.00, 'Tabung (Fizikal, 3/07/2026)'),
    ('2026-07-12', 1000.00, 'Infaq Jemaah (Tunai, 12/07/2026)'),
    ('2026-07-12', 600.00, 'Infaq Jemaah (Tunai, 12/07/2026)'),
    ('2026-07-20', 2209.00, 'Tabung (Fizikal, 17/7/2026)'),
    ('2026-07-20', 250.00, 'Infaq Jemaah (Tunai, 20/07/2026)')
) AS v(tarikh, jumlah, keterangan);


-- ── D. Sanity checks — run after the inserts above.
--   kutipan 2026 tahun-ini total  → should be exactly 68,408.80 (Jan-Jul 2026,
--     verified by independent script against the Sheet's own JumlahBulanan
--     column before this file was written)
--   perbelanjaan 2025 tahun total → should be exactly 78,152.43 (same method)
--   project JumlahTerkumpul       → will be ~176,314.00, summed from the 131
--     individual donation rows above — this does NOT match the RM196,741.00
--     shown on infaq.mamtj6.com's daily.json/Sheet. That figure is a
--     separately hand-maintained cell in the old Sheet, not itself computed
--     from the daily log — the RM20,427 gap is exactly the kind of drift
--     this system is designed to prevent by always computing totals from
--     raw rows instead of storing one. Investigate with the committee
--     whether there are missing daily entries (a Sheet row not captured in
--     what was pasted here) or whether the old 196,741 figure was simply
--     wrong — don't "fix" this by typing in an adjustment row without
--     knowing which it is.

SELECT SUM(jumlah) AS kutipan_2026_total FROM infaq_kutipan_mingguan WHERE tahun = 2026;

SELECT SUM(jumlah) AS perbelanjaan_2025_total FROM infaq_perbelanjaan_bulanan WHERE tahun = 2025;

SELECT p.name, p.target_amount, SUM(pk.jumlah) AS terkumpul
FROM infaq_projects p
JOIN infaq_projek_kutipan pk ON pk.project_id = p.id
WHERE p.name = 'Infaq Tabung Bangunan Tambahan MAMTJ6'
GROUP BY p.name, p.target_amount;
