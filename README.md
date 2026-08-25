# Web Kecamatan Tanete Riaja

Project ini memiliki struktur fullstack:

- `frontend/` berisi React + Vite untuk website publik dan halaman admin.
- `backend/` berisi Node.js + Express untuk API berita, dokumen, login admin, dan upload file.

## Menjalankan Project

Install dependency:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Jalankan frontend dan backend sekaligus:

```bash
npm run dev
```

Atau jalankan terpisah:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

