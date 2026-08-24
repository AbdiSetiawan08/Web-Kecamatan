# Database MySQL

Database aktif: `kecamatan_db`

Tabel inti yang dipakai website:
- `users`: akun admin untuk login.
- `news`: berita, kegiatan, dan pengumuman.
- `public_documents`: dokumen transparansi atau dokumen publik.
- `tourism_potentials` dan `tourism_points`: potensi pariwisata per item slide.
- `officials`: struktur organisasi kecamatan.
- `profile_contents`: kata sambutan dan pengantar profil.
- `services`: daftar layanan publik.
- `hero_slides`: gambar latar/slider hero.
- `contacts` dan `social_links`: data kontak/footer.
- `site_settings`: pengaturan umum seperti nama kecamatan, email, alamat, dan teks kecil lainnya.

Backend sudah menggunakan tabel berikut secara langsung:

- `users`: autentikasi admin.
- `news`: berita, kegiatan, dan pengumuman.
- `public_documents`: dokumen publik.
- `survey_responses`: hasil survei masyarakat.

Konfigurasi koneksi berada di `backend/.env`. Untuk database lama yang belum
memiliki tabel survei, jalankan migrasi aman berikut melalui phpMyAdmin atau MySQL:

```sql
SOURCE backend/database/migrate-kecamatan-db.sql;
```

Data aplikasi sepenuhnya menggunakan MySQL. Penyimpanan lokal `backend/data/db.json`
sudah dihapus dan tidak digunakan sebagai fallback.
