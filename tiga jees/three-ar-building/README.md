# Three.js + WebXR AR (Bangunan Ruang)

Ini adalah website statis (bukan `localhost`) yang menampilkan AR menggunakan WebXR + Three.js. Objek yang ditaruh adalah “bangunan ruang” (kombinasi balok/limas).

## Cara pakai (online)

Karena WebXR AR umumnya **wajib HTTPS**, kamu perlu meng-host folder ini di layanan hosting statis:

- GitHub Pages
- Netlify
- Vercel (static)
- Cloudflare Pages

Upload semua file di folder ini apa adanya: `index.html`, `main.js`, `style.css`.

## Cara uji cepat (opsional, lokal)

Kalau mau test sebelum deploy, kamu bisa jalankan server lokal (bukan file://):

1. Install Node.js
2. Jalankan:
   - `npx serve`
3. Buka URL yang diberikan.

Catatan: AR kemungkinan tidak jalan di desktop. Gunakan Android Chrome / perangkat yang mendukung WebXR AR.

## Catatan kompatibilitas

- AR via WebXR biasanya jalan di **Chrome Android** (perangkat mendukung ARCore).
- iOS Safari tidak mendukung WebXR AR secara native (umumnya perlu solusi lain seperti WebAR berbasis marker).

