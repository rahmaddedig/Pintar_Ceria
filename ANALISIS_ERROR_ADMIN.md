# Analisis Error Pembuatan Soal pada Mode Admin

## Ringkasan Temuan
Dari source yang diberikan, error saat klik **"Proses Referensi & Buat Soal Sekarang"** paling mungkin berasal dari kombinasi tiga titik rawan berikut:

1. **Nama model Gemini di endpoint tidak valid / sudah tidak tersedia** (`gemini-2.5-flash-preview-09-2025`).
2. **Asumsi struktur respons API terlalu kaku** (`response.candidates[0].content.parts[0].text` selalu ada).
3. **Parser JSON rapuh** saat AI mengembalikan teks non-JSON, JSON terbungkus markdown, atau format sedikit meleset.

## Lokasi Kode yang Rawan

### 1) Endpoint model hard-coded ke versi preview
Pada fungsi `fetchWithRetryPayload`, URL API dibentuk dengan model berikut:

```js
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent
```

Risiko:
- Model preview sering berubah/di-deprecate.
- Jika model tidak tersedia untuk API key/proyek, request gagal (biasanya 404/400/403).

Dampak:
- Proses pembuatan soal di admin gagal sebelum parsing jawaban.

### 2) Akses respons tanpa guard
Pada proses generate soal:

```js
let textRes = response.candidates[0].content.parts[0].text;
```

Risiko:
- Jika API mengembalikan blokir safety, error struktur, atau kandidat kosong, akses ini memicu runtime error `Cannot read properties of undefined`.

Dampak:
- Muncul pesan gagal memproses data walaupun request API sebenarnya sudah dibalas.

### 3) Parsing JSON tanpa fallback
Saat ini alur langsung:

```js
textRes = textRes.replace(/```json/gi, '').replace(/```/g, '').trim();
let questions = JSON.parse(textRes);
```

Risiko:
- Model kadang mengembalikan teks tambahan sebelum/akhir JSON.
- Bisa keluar dalam format object berisi properti `questions` alih-alih array langsung.

Dampak:
- `JSON.parse` gagal meski isi sebenarnya hampir benar.

### 4) Validasi hasil soal belum ketat
Setelah parse, tidak ada sanitasi struktur per soal (`type`, `question`, `answer`, dsb).

Risiko:
- Data tidak konsisten tersimpan ke localforage.
- UI kuis bisa error saat render jika `options` tidak ada pada soal `pg`.

## Rekomendasi Perbaikan (Prioritas)

1. **Gunakan model stabil (fallback-aware)**
   - Ganti model hard-coded preview ke model stabil (mis. `gemini-1.5-flash`) atau simpan di konstanta yang mudah diganti.

2. **Tambahkan guard saat membaca respons**
   - Ambil text via optional chaining.
   - Jika kosong, lempar error yang jelas (mis. "API tidak mengembalikan kandidat teks").

3. **Buat parser JSON yang lebih tahan banting**
   - Bersihkan markdown fence.
   - Jika parse gagal, ekstrak blok array `[...]` terbesar lalu parse lagi.
   - Terima format array langsung maupun `{ questions: [...] }`.

4. **Sanitasi output soal sebelum simpan**
   - Filter item yang tidak punya `question` dan `answer`.
   - Untuk `type: "pg"`, pastikan `options` array minimal 2.
   - Batasi panjang sesuai `jumlahSoal` setelah validasi.

5. **Perbaiki handling status HTTP umum**
   - Tidak hanya 401/403; beri pesan spesifik untuk 404 (model tidak ditemukan), 429 (rate limit), 5xx (server).

## Gejala yang Cocok dengan Bug Ini
Jika saat admin generate soal muncul:
- "Gagal Menyiapkan Soal" + error mentah dari API,
- atau error parsing JSON,
- atau proses berputar lalu gagal tanpa data soal tersimpan,

maka sangat selaras dengan 3 akar masalah di atas (endpoint model + asumsi response + parser).

## Contoh Strategi Patch Ringkas

- Tambah konstanta model:

```js
const GEMINI_MODEL = "gemini-1.5-flash";
```

- Akses respons aman:

```js
const textRes = response?.candidates?.[0]?.content?.parts?.[0]?.text;
if (!textRes) throw new Error("Respons AI kosong / kandidat tidak tersedia");
```

- Parser robust (pseudo):

```js
function parseQuestionsJson(raw) {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return normalize(JSON.parse(cleaned)); } catch {}
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) return normalize(JSON.parse(m[0]));
  throw new Error("Format JSON soal tidak valid");
}
```

## Kesimpulan
Error pada mode admin paling besar kemungkinan **bukan** pada localforage/upload file, melainkan pada **integrasi API generatif** (model endpoint dan parsing respons). Memperkuat 4 area di atas biasanya langsung menstabilkan fitur pembuatan soal.
