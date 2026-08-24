import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs/promises';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseName, initializeDatabase, pool } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');

const app = express();
const port = process.env.PORT || 4000;
const authSecret = process.env.AUTH_SECRET || 'ganti-kunci-rahasia-ini-di-file-env';
const megabyte = 1024 * 1024;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopment) {
      return callback(null, true);
    }
    return callback(new Error('Origin tidak diizinkan oleh CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir));

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Terlalu banyak percobaan login. Silakan coba kembali dalam 15 menit.' }
});

const surveyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Batas pengiriman survei telah tercapai. Silakan coba kembali nanti.' }
});

function uploadType(req) {
  return req.path.startsWith('/api/documents') ? 'documents' : 'news';
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const target = path.join(uploadsDir, uploadType(req));
      await fs.mkdir(target, { recursive: true });
      cb(null, target);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx']);
const documentMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function allowedFileFilter(extensions, mimeTypes, message) {
  return (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extensions.has(extension) || !mimeTypes.has(file.mimetype)) {
      const error = new Error(message);
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  };
}

const newsUpload = multer({
  storage,
  limits: { fileSize: 5 * megabyte, files: 1 },
  fileFilter: allowedFileFilter(
    imageExtensions,
    imageMimeTypes,
    'Gambar harus berformat JPG, JPEG, PNG, atau WebP.'
  )
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 10 * megabyte, files: 1 },
  fileFilter: allowedFileFilter(
    documentExtensions,
    documentMimeTypes,
    'Dokumen harus berformat PDF, DOC, DOCX, XLS, atau XLSX.'
  )
});

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(user.id),
    username: user.username,
    role: user.role,
    exp: Date.now() + (8 * 60 * 60 * 1000)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = crypto.createHmac('sha256', authSecret).update(payload).digest('base64url');
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ message: 'Sesi admin tidak valid atau telah berakhir.' });
  req.user = user;
  next();
}

function fileUrl(req, file) {
  return file ? `/uploads/${uploadType(req)}/${file.filename}` : '';
}

function createSlug(title) {
  const base = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || 'berita';
  return `${base}-${Date.now()}`;
}

function mapNews(row) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary,
    content: row.content,
    imageUrl: row.image_url || '',
    date: row.published_date,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapDocument(row) {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    year: String(row.year),
    description: row.description,
    fileUrl: row.file_url,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapSurvey(row) {
  return {
    id: String(row.id),
    respondentName: row.respondent_name || 'Anonim',
    serviceType: row.service_type,
    overallRating: row.overall_rating,
    easeRating: row.ease_rating,
    speedRating: row.speed_rating,
    staffRating: row.staff_rating,
    feedback: row.feedback || '',
    createdAt: row.created_at
  };
}

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'web-kecamatan-backend', database: databaseName, storage: 'mysql' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const [rows] = await pool.execute(
      'SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Username atau password salah' });

    const usesBcrypt = /^\$2[aby]\$/.test(user.password_hash);
    const passwordMatches = usesBcrypt
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;
    if (!passwordMatches) return res.status(401).json({ message: 'Username atau password salah' });

    if (!usesBcrypt) {
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    }

    const publicUser = { id: user.id, username: user.username, fullName: user.full_name, role: user.role };
    res.json({ token: signToken(user), user: publicUser });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, full_name, role FROM users WHERE id = ? LIMIT 1',
      [req.user.sub]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Akun admin tidak ditemukan.' });
    res.json({ id: user.id, username: user.username, fullName: user.full_name, role: user.role });
  } catch (error) {
    next(error);
  }
});

app.get('/api/news', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM news WHERE status = 'published' ORDER BY published_date DESC, created_at DESC"
    );
    res.json(rows.map(mapNews));
  } catch (error) {
    next(error);
  }
});

app.get('/api/news/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM news WHERE id = ? AND status = 'published' LIMIT 1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    res.json(mapNews(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post('/api/news', requireAuth, newsUpload.single('image'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const date = String(req.body.date || '').trim();
    const summary = String(req.body.summary || '').trim();
    const content = String(req.body.content || '').trim();
    if (!title || !date || !summary || !content) return res.status(400).json({ message: 'Data berita belum lengkap.' });

    const [result] = await pool.execute(
      `INSERT INTO news
        (title, slug, category, summary, content, image_url, published_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
      [title, createSlug(title), req.body.category || 'Berita', summary, content, fileUrl(req, req.file) || null, date, req.user.sub]
    );
    const [rows] = await pool.execute('SELECT * FROM news WHERE id = ?', [result.insertId]);
    res.status(201).json(mapNews(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.put('/api/news/:id', requireAuth, newsUpload.single('image'), async (req, res, next) => {
  try {
    const [existingRows] = await pool.execute('SELECT * FROM news WHERE id = ? LIMIT 1', [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    const imageUrl = req.file ? fileUrl(req, req.file) : existing.image_url;
    await pool.execute(
      'UPDATE news SET title = ?, category = ?, summary = ?, content = ?, image_url = ?, published_date = ? WHERE id = ?',
      [req.body.title || existing.title, req.body.category || existing.category, req.body.summary || existing.summary,
        req.body.content || existing.content, imageUrl, req.body.date || existing.published_date, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM news WHERE id = ?', [req.params.id]);
    res.json(mapNews(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/news/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM news WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM public_documents WHERE status = 'published' ORDER BY year DESC, created_at DESC"
    );
    res.json(rows.map(mapDocument));
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents', requireAuth, documentUpload.single('file'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const category = String(req.body.category || 'Transparansi').trim();
    const year = String(req.body.year || '').trim();
    const description = String(req.body.description || '').trim();
    const uploadedFileUrl = fileUrl(req, req.file);
    if (!title || !year || !description || !uploadedFileUrl) return res.status(400).json({ message: 'Data dan file dokumen wajib dilengkapi.' });

    const [result] = await pool.execute(
      `INSERT INTO public_documents
        (title, category, year, description, file_url, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'published', ?)`,
      [title, category, year, description, uploadedFileUrl, req.user.sub]
    );
    const [rows] = await pool.execute('SELECT * FROM public_documents WHERE id = ?', [result.insertId]);
    res.status(201).json(mapDocument(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.put('/api/documents/:id', requireAuth, documentUpload.single('file'), async (req, res, next) => {
  try {
    const [existingRows] = await pool.execute('SELECT * FROM public_documents WHERE id = ? LIMIT 1', [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
    const uploadedFileUrl = req.file ? fileUrl(req, req.file) : existing.file_url;
    await pool.execute(
      'UPDATE public_documents SET title = ?, category = ?, year = ?, description = ?, file_url = ? WHERE id = ?',
      [req.body.title || existing.title, req.body.category || existing.category, req.body.year || existing.year,
        req.body.description || existing.description, uploadedFileUrl, req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM public_documents WHERE id = ?', [req.params.id]);
    res.json(mapDocument(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM public_documents WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/surveys', surveyLimiter, async (req, res, next) => {
  try {
    const ratingFields = ['overallRating', 'easeRating', 'speedRating', 'staffRating'];
    const ratings = Object.fromEntries(ratingFields.map((field) => [field, Number(req.body[field])]));
    const invalidRating = Object.values(ratings).some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5);
    const serviceType = String(req.body.serviceType || '').trim();
    const feedback = String(req.body.feedback || '').trim();
    const respondentName = String(req.body.respondentName || '').trim();
    if (!serviceType || invalidRating) return res.status(400).json({ message: 'Jenis layanan dan seluruh penilaian wajib diisi.' });
    if (serviceType.length > 180 || respondentName.length > 160 || feedback.length > 3000) {
      return res.status(400).json({ message: 'Isi survei melebihi batas karakter yang diizinkan.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO survey_responses
        (respondent_name, service_type, overall_rating, ease_rating, speed_rating, staff_rating, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [respondentName || null, serviceType, ratings.overallRating, ratings.easeRating,
        ratings.speedRating, ratings.staffRating, feedback || null]
    );
    res.status(201).json({ id: String(result.insertId), message: 'Terima kasih. Survei Anda telah tersimpan.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/surveys', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM survey_responses ORDER BY created_at DESC');
    res.json(rows.map(mapSurvey));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/surveys/:id', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM survey_responses WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Data survei tidak ditemukan' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? (uploadType(req) === 'documents' ? 'Ukuran dokumen maksimal 10 MB.' : 'Ukuran gambar maksimal 5 MB.')
      : 'File tidak dapat diunggah. Pastikan hanya memilih satu file yang sesuai.';
    return res.status(400).json({ message });
  }
  if (error.status === 400) return res.status(400).json({ message: error.message });
  res.status(500).json({
    message: 'Terjadi kesalahan pada server.',
    detail: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend berjalan di http://localhost:${port} menggunakan MySQL ${databaseName}`);
    });
  })
  .catch((error) => {
    console.error('Backend gagal terhubung ke MySQL:', error.message);
    process.exit(1);
  });
