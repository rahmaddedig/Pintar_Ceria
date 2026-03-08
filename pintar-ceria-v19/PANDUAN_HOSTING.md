# Panduan Hosting Gratis Website "Pintar Ceria"

Berikut adalah langkah-langkah mudah untuk membuat website ini bisa diakses secara online menggunakan layanan hosting gratis **Vercel** atau **Netlify**.

## Persiapan (Wajib)

1.  Pastikan Anda memiliki akun **GitHub** (Daftar di [github.com](https://github.com)).
2.  Pastikan kode website ini sudah ada di komputer Anda.

---

## Cara 1: Menggunakan Vercel (Rekomendasi - Paling Mudah)

Vercel sangat cocok untuk aplikasi React/Vite seperti ini.

1.  **Upload Kode ke GitHub:**
    *   Buat repository baru di GitHub (beri nama misal: `pintar-ceria`).
    *   Upload semua file proyek ini ke repository tersebut.

2.  **Daftar/Login ke Vercel:**
    *   Buka [vercel.com](https://vercel.com).
    *   Login menggunakan akun GitHub Anda.

3.  **Import Project:**
    *   Klik tombol **"Add New..."** -> **"Project"**.
    *   Pilih repository `pintar-ceria` yang baru Anda buat.
    *   Klik **Import**.

4.  **Konfigurasi (Otomatis):**
    *   Vercel biasanya otomatis mendeteksi bahwa ini adalah proyek **Vite**.
    *   Pastikan `Framework Preset` terpilih **Vite**.
    *   Klik **Deploy**.

5.  **Selesai!**
    *   Tunggu beberapa detik/menit.
    *   Vercel akan memberikan link website Anda (contoh: `pintar-ceria.vercel.app`).
    *   Link ini bisa Anda bagikan ke siswa!

---

## Cara 2: Menggunakan Netlify (Alternatif)

1.  **Upload Kode ke GitHub** (sama seperti langkah di atas).

2.  **Daftar/Login ke Netlify:**
    *   Buka [netlify.com](https://netlify.com).
    *   Login dengan GitHub.

3.  **Buat Site Baru:**
    *   Klik **"Add new site"** -> **"Import from existing project"**.
    *   Pilih **GitHub**.
    *   Pilih repository `pintar-ceria`.

4.  **Deploy:**
    *   Biarkan pengaturan default (`Build command: npm run build`, `Publish directory: dist`).
    *   Klik **Deploy Site**.

5.  **Selesai!**
    *   Netlify akan memberikan link (contoh: `pintar-ceria.netlify.app`).

---

## Catatan Penting tentang API Key

Aplikasi ini menggunakan **Gemini API**. Agar fitur AI (Chatbot & Generator Soal) tetap jalan saat online:

1.  **Dapatkan API Key:**
    *   Buka [aistudio.google.com](https://aistudio.google.com).
    *   Buat API Key baru.

2.  **Masukkan API Key di Hosting (Vercel/Netlify):**
    *   **Di Vercel:** Masuk ke Settings -> Environment Variables. Tambahkan `VITE_GEMINI_API_KEY` dengan nilai API Key Anda.
    *   **Di Netlify:** Masuk ke Site settings -> Environment variables. Tambahkan `VITE_GEMINI_API_KEY`.
    *   **Catatan:** Kode aplikasi sudah diperbarui untuk mendeteksi `VITE_GEMINI_API_KEY` secara otomatis. Anda tidak perlu mengubah kode apa pun.

    *Saran:* Untuk keamanan terbaik, gunakan backend (server) untuk memanggil API. Namun untuk demo/proyek sekolah sederhana, cara di atas bisa digunakan dengan risiko API Key terlihat di browser (network tab).

Selamat mencoba! 🚀
