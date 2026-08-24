# Database MongoDB Atlas

Backend sekarang memakai MongoDB Atlas melalui package `mongodb`.

Collection inti yang dipakai langsung oleh backend:

- `users`: akun admin untuk login.
- `news`: berita, kegiatan, dan pengumuman.
- `public_documents`: dokumen transparansi atau dokumen publik.
- `survey_responses`: hasil survei masyarakat.

Konfigurasi koneksi berada di `backend/.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster-name.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=kecamatan_db
AUTH_SECRET=ganti-dengan-kunci-acak-yang-panjang
FRONTEND_ORIGIN=http://localhost:5173
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
```

Untuk membuat admin pertama pada database kosong, isi sementara:

```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=ganti-password-admin-ini
DEFAULT_ADMIN_FULL_NAME=Admin Utama
```

Jalankan backend sekali sampai berhasil terhubung, lalu hapus `DEFAULT_ADMIN_PASSWORD`
dari environment production agar password awal tidak terus tersimpan di konfigurasi.

## Upload File

Upload gambar berita dan dokumen publik akan masuk ke Vercel Blob jika environment
`BLOB_READ_WRITE_TOKEN` tersedia. Saat development lokal tanpa token tersebut, file
akan disimpan sementara di folder `backend/uploads`.

Struktur dokumen utama:

```js
// users
{
  username: 'admin',
  passwordHash: '$2b$...',
  fullName: 'Admin Utama',
  role: 'admin',
  createdAt: Date,
  updatedAt: Date
}

// news
{
  title: 'Judul berita',
  slug: 'judul-berita-123',
  category: 'Berita',
  summary: 'Ringkasan',
  content: 'Isi lengkap',
  imageUrl: '/uploads/news/file.jpg',
  publishedDate: '2026-08-25',
  status: 'published',
  createdBy: 'userId',
  createdAt: Date,
  updatedAt: Date
}

// public_documents
{
  title: 'Judul dokumen',
  category: 'Transparansi',
  year: '2026',
  description: 'Deskripsi',
  fileUrl: '/uploads/documents/file.pdf',
  status: 'published',
  createdBy: 'userId',
  createdAt: Date,
  updatedAt: Date
}

// survey_responses
{
  respondentName: 'Anonim',
  serviceType: 'Surat Keterangan',
  overallRating: 5,
  easeRating: 5,
  speedRating: 4,
  staffRating: 5,
  feedback: 'Masukan warga',
  createdAt: Date
}
```
