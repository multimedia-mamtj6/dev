# Jadual Waktu Solat

Aplikasi web untuk memaparkan jadual waktu solat (Imsak, Subuh, Syuruk,
Zohor, Asar, Maghrib, Isyak) bagi semua 61 zon di Malaysia, sepanjang tahun
— bukan terhad kepada bulan Ramadan.

## Ciri-ciri

- Jadual waktu solat bulanan untuk semua zon
- Pilihan 61 zon seluruh Malaysia, dikumpul mengikut negeri
- Pemilihan zon disimpan secara automatik (localStorage)
- **Pengesanan lokasi GPS** automatik pada kunjungan pertama, atau secara
  manual melalui butang 📍 GPS
- **Pautan boleh dikongsi** — URL dikemaskini mengikut zon (`?location=`)
- **Butang kongsi** untuk berkongsi pautan dengan maklumat zon (Negeri,
  Zon, Daerah)
- **Widget "Info Hari Ini"** — countdown masa solat secara visual (arka
  SVG), menunjukkan waktu semasa & seterusnya, termasuk "Waktu Duha"
- **Amaran 10 minit** sebelum waktu solat seterusnya (denyutan pada
  countdown dan penanda waktu)
- Jadual bulanan penuh (desktop: jadual, mobile: kad), sorotan pada hari
  semasa, kemaskini data automatik pada tengah malam
- **Bahagian Infaq & Wakaf** — sokong masjid melalui DuitNow QR / pautan
- **Halaman maklumat** dengan dokumentasi projek dan pautan boleh dikongsi
- Disokong sebagai **PWA** (boleh dipasang, app shell luar talian)
- Data dari JAKIM melalui [Waktu Solat API](https://api.waktusolat.app/)

## Halaman

| Fail | Keterangan |
|------|------------|
| `index.html` | Halaman utama — jadual waktu solat, zon, dan Infaq & Wakaf |
| `info.html` | Halaman maklumat dan dokumentasi (bahagian boleh dikongsi) |
| `widget.html` | Widget countdown waktu solat (boleh disertakan/embed secara berasingan) |

## Penggunaan

Buka `index.html` dalam pelayar web. Tiada pemasangan diperlukan (atau
pasang sebagai PWA — lihat `info.html#pwa`).

### Pilih Zon

1. Klik dropdown zon
2. Pilih zon anda dari senarai (dikumpul mengikut negeri)
3. Pilihan akan disimpan untuk lawatan seterusnya
4. URL akan dikemaskini secara automatik untuk memudahkan perkongsian

### Kesan Lokasi (GPS)

Pada lawatan pertama (tiada zon tersimpan), lokasi zon akan dikesan secara
automatik melalui GPS. Anda juga boleh klik butang 📍 GPS pada bila-bila
masa untuk mengesan semula.

### Kongsi Pautan

1. Pilih zon anda
2. Klik butang kongsi di sebelah dropdown
3. Pautan akan disalin ke clipboard (desktop) atau buka menu kongsi (mobile)

### Widget "Info Hari Ini"

Bahagian ini memaparkan arka SVG yang menunjukkan kedudukan waktu solat
hari ini (Subuh → Syuruk → Zohor → Asar → Maghrib → Isyak), dengan
countdown ke waktu seterusnya. 10 minit sebelum waktu solat seterusnya,
countdown akan berdenyut sebagai peringatan.

### URL Parameter

| Parameter | Contoh | Keterangan |
|-----------|--------|------------|
| `location` | `?location=JHR01` | Muatkan zon tertentu secara automatik |
| `testDate` | `?testDate=2026-02-20` | Simulasi tarikh tertentu untuk ujian |
| `testTime` | `?testTime=18:30` | Simulasi masa tertentu untuk ujian (jam bergerak ke hadapan) |

Gabungkan parameter: `?location=JHR01&testDate=2026-02-20&testTime=12:00`

## Widget — `widget.html`

`widget.html` ialah widget countdown waktu solat yang berdiri sendiri.
Selain disertakan (embed) secara automatik dalam `index.html` melalui
iframe, ia juga boleh disertakan secara berasingan di laman lain (contoh:
Google Sites).

### Parameter URL untuk embed

| Parameter | Contoh | Keterangan |
|-----------|--------|------------|
| `zone` | `?zone=JHR01` | Zon yang dipaparkan |
| `embed` | `?embed=1` | Latar belakang lutsinar + skala automatik mengikut saiz iframe |
| `selector` | `?selector=hide` | Sembunyikan dropdown pilihan zon |
| `date` | `?date=hide` | Sembunyikan paparan tarikh |
| `mode` | `?mode=dark` | Paksa tema gelap |
| `testDate` / `testTime` | `?testTime=18:30` | Simulasi tarikh/masa untuk ujian |

Contoh embed penuh: `widget.html?embed=1&selector=hide&date=hide&zone=JHR01`

Untuk panduan terperinci menyertakan widget ini dalam Google Sites
(termasuk algoritma skala automatik dan isu-isu biasa), lihat
`gsites_embeded_guide.md`.

## Sumber Data

Data waktu solat diperolehi dari [JAKIM](https://www.e-solat.gov.my/)
melalui [Waktu Solat API](https://api.waktusolat.app/).

## Teknologi

- HTML5 / CSS3 / JavaScript (Vanilla) — tiada kerangka, tiada langkah build
- `index.html` & `info.html`: Google Fonts (Google Sans)
- `widget.html`: Google Fonts (Inter) + Material Symbols Rounded (ikon)
- Waktu Solat API (JAKIM)
- MST SIRIM Widget (halaman maklumat, pengesahan masa)
- PWA — service worker cache-first untuk akses luar talian

## Pembangunan

Tiada langkah build diperlukan. Jalankan secara setempat:

```bash
python -m http.server
```

Pengambilan data JSON memerlukan pelayan HTTP (CORS) — `file://` tidak
akan berfungsi.

Untuk dokumentasi pembangun lanjut (fungsi, struktur CSS, format API), lihat
`developer.md`. Untuk sejarah pembangunan `widget.html` secara terperinci,
lihat `DEV_NOTES.md` dan git history.

## Lesen

Hak cipta 2026 [MAMTJ6](https://mamtj6.com)
