# Patch Fix: Error Generate Soal Admin ("Koneksi server AI sibuk")

Berdasarkan source terbaru yang Anda kirim, akar error **utama** bukan semata server sibuk, tetapi ada beberapa bug struktural yang membuat request hampir pasti gagal atau hasilnya dianggap gagal.

## 1) Penyebab Paling Kritis

### A. API key kosong
Di source ada:

```js
const apiKey = "";
```

Jika kosong, request Gemini akan gagal (401/403). Lalu sistem Anda menampilkan pesan generik seolah server sibuk.

### B. Nama model tidak valid
Di source ada:

```js
const geminiModel = "gemini-3.0-flash";
```

Model ini umumnya **tidak tersedia** pada endpoint Generative Language API public yang Anda panggil (`v1beta/models/...:generateContent`). Akibatnya sering 404/400.

### C. Error HTTP disilent-kan jadi `null`
Pada `fetchWithRetryPayload`, ketika `response.ok === false`, fungsi tidak melempar detail error, hanya `return null` setelah retry. Ini menutupi akar masalah dan selalu terlihat seperti “AI sibuk”.

### D. Parsing response terlalu asumtif
Kode langsung mengakses:

```js
response.candidates[0].content.parts[0].text
```

Kalau `candidates` kosong / diblok safety / format lain, akan error parsing lanjutan.

---

## 2) Perbaikan Inti (siap tempel)

> Ganti fungsi `fetchWithRetryPayload` Anda dengan versi berikut.

```js
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"]; // fallback model

function getErrorMessageByStatus(status, detail = "") {
  if (status === 400) return "Permintaan tidak valid (400). Cek format payload.";
  if (status === 401) return "API Key tidak valid / kosong (401).";
  if (status === 403) return "Akses ditolak (403). Cek izin API key / project.";
  if (status === 404) return "Model tidak ditemukan (404). Ganti ke model yang tersedia.";
  if (status === 429) return "Kuota/rate limit habis (429). Coba beberapa saat lagi.";
  if (status >= 500) return "Server AI sedang gangguan (5xx).";
  return `HTTP ${status}. ${detail}`;
}

async function fetchWithRetryPayload(contents, systemInstructionText, isJson = false) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API Key kosong. Isi variabel apiKey terlebih dahulu.");
  }

  const maxRetries = 3;
  const delays = [1200, 2500, 5000];

  const payload = { contents };
  if (systemInstructionText) payload.systemInstruction = { parts: [{ text: systemInstructionText }] };
  if (isJson) payload.generationConfig = { responseMimeType: "application/json" };

  let lastError = "";

  for (const model of GEMINI_MODELS) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const detail = await response.text();
          const msg = getErrorMessageByStatus(response.status, detail);

          // status yang tidak perlu di-retry
          if ([400, 401, 403, 404].includes(response.status)) {
            throw new Error(`${msg} | model=${model}`);
          }

          lastError = `${msg} | model=${model}`;
          if (i < maxRetries - 1) {
            await new Promise(r => setTimeout(r, delays[i]));
            continue;
          }
          break;
        }

        const json = await response.json();
        return json;
      } catch (err) {
        lastError = err.message || String(err);
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delays[i]));
          continue;
        }
      }
    }
  }

  throw new Error(`Gagal menghubungi AI setelah retry. Detail: ${lastError}`);
}
```

---

## 3) Perbaikan Parser JSON Soal (wajib)

> Tambahkan helper berikut:

```js
function extractAiText(response) {
  const text = response?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
  if (!text) throw new Error("Respons AI kosong / candidates tidak tersedia.");
  return text;
}

function parseQuestionsJson(rawText) {
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 1) parse langsung
  try {
    const direct = JSON.parse(cleaned);
    return Array.isArray(direct) ? direct : (Array.isArray(direct?.questions) ? direct.questions : []);
  } catch (_) {}

  // 2) fallback ambil blok array
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : [];
  }

  throw new Error("Format JSON soal tidak valid.");
}

function sanitizeQuestions(questions, jumlahSoal) {
  return (questions || [])
    .filter(q => q && q.question && q.answer)
    .map(q => ({
      materi: q.materi || "Materi Umum",
      type: q.type === "pg" ? "pg" : "isian",
      question: String(q.question).trim(),
      options: Array.isArray(q.options) ? q.options.slice(0, 5) : undefined,
      answer: String(q.answer).trim(),
      explanation: q.explanation ? String(q.explanation).trim() : "Tetap semangat belajar ya!"
    }))
    .filter(q => q.type !== "pg" || (Array.isArray(q.options) && q.options.length >= 2))
    .slice(0, jumlahSoal);
}
```

Lalu di `saveAdminDataAndGenerateQuestions()` ganti blok parse menjadi:

```js
const response = await fetchWithRetryPayload(contents, sysInstruction, true);
const aiText = extractAiText(response);
const rawQuestions = parseQuestionsJson(aiText);
const questions = sanitizeQuestions(rawQuestions, jumlahSoal);

if (!questions.length) {
  throw new Error("AI tidak mengembalikan soal valid. Coba kurangi jumlah soal / sederhanakan materi.");
}
```

---

## 4) Perbaikan UX Error Message (biar tidak misleading)

Di catch `saveAdminDataAndGenerateQuestions()` gunakan detail error asli:

```js
} catch (e) {
  const msg = e?.message || String(e);
  showModal("Gagal Menyiapkan Soal", msg, "❌");
}
```

Dengan ini, kalau penyebabnya API key kosong / model salah, user langsung lihat pesan sebenarnya, bukan selalu “server sibuk”.

---

## 5) Checklist Validasi Cepat Setelah Patch

1. Isi `apiKey` valid.
2. Test generate tanpa upload file (jumlah 3 soal).
3. Test generate dengan 1 file TXT pendek.
4. Cek `localforage` berisi `questions.length > 0`.
5. Jalankan kuis untuk mapel tersebut.

Jika masih gagal, copy **pesan modal detail terbaru** (setelah patch ini) — dari sana akar masalah bisa diidentifikasi 1 langkah.
