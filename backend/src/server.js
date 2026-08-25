import 'dotenv/config';
import { put } from '@vercel/blob';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs/promises';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collection, databaseName, initializeDatabase, toObjectId } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');

const app = express();
const port = process.env.PORT || 4000;
const authSecret = process.env.AUTH_SECRET || 'ganti-kunci-rahasia-ini-di-file-env';
const megabyte = 1024 * 1024;
const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const imageFileLimit = useBlobStorage ? 4 * megabyte : 5 * megabyte;
const documentFileLimit = useBlobStorage ? 4 * megabyte : 10 * megabyte;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalized = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(normalized)) return true;

  try {
    const hostname = new URL(normalized).hostname;
    if (/^(localhost|127\.0\.0\.1)$/.test(hostname)) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'vercel.app') return true;
  } catch {
    return false;
  }

  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin tidak diizinkan oleh CORS'));
  },
  credentials: true
}));

app.options('*', cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin tidak diizinkan oleh CORS'));
  },
  credentials: true
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

const storage = multer.memoryStorage();

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
  limits: { fileSize: imageFileLimit, files: 1 },
  fileFilter: allowedFileFilter(
    imageExtensions,
    imageMimeTypes,
    'Gambar harus berformat JPG, JPEG, PNG, atau WebP.'
  )
});

const documentUpload = multer({
  storage,
  limits: { fileSize: documentFileLimit, files: 1 },
  fileFilter: allowedFileFilter(
    documentExtensions,
    documentMimeTypes,
    'Dokumen harus berformat PDF, DOC, DOCX, XLS, atau XLSX.'
  )
});

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: asId(user),
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

async function fileUrl(req, file) {
  if (!file) return '';

  const type = uploadType(req);
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '-');
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const pathname = `${type}/${filename}`;

  if (useBlobStorage) {
    const blob = await put(pathname, file.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.mimetype
    });
    return blob.url;
  }

  const target = path.join(uploadsDir, type);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, filename), file.buffer);
  return `/uploads/${type}/${filename}`;
}

function asId(document) {
  return document?._id ? String(document._id) : String(document?.id || '');
}

function asDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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
    id: asId(row),
    title: row.title,
    slug: row.slug,
    category: row.category,
    summary: row.summary,
    content: row.content,
    imageUrl: row.imageUrl || row.image_url || '',
    date: asDate(row.publishedDate || row.published_date),
    status: row.status,
    createdAt: row.createdAt || row.created_at
  };
}

function mapDocument(row) {
  return {
    id: asId(row),
    title: row.title,
    category: row.category,
    year: String(row.year),
    description: row.description,
    fileUrl: row.fileUrl || row.file_url,
    status: row.status,
    createdAt: row.createdAt || row.created_at
  };
}

function mapSurvey(row) {
  return {
    id: asId(row),
    respondentName: row.respondentName || row.respondent_name || 'Anonim',
    serviceType: row.serviceType || row.service_type,
    overallRating: row.overallRating ?? row.overall_rating,
    easeRating: row.easeRating ?? row.ease_rating,
    speedRating: row.speedRating ?? row.speed_rating,
    staffRating: row.staffRating ?? row.staff_rating,
    feedback: row.feedback || '',
    createdAt: row.createdAt || row.created_at
  };
}

app.get('/api/health', async (req, res, next) => {
  try {
    await collection('users').findOne({}, { projection: { _id: 1 } });
    res.json({
      ok: true,
      service: 'web-kecamatan-backend',
      database: databaseName,
      storage: 'mongodb',
      uploads: useBlobStorage ? 'vercel-blob' : 'local'
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = await collection('users').findOne({ username });
    if (!user) return res.status(401).json({ message: 'Username atau password salah' });

    const passwordHash = user.passwordHash || user.password_hash;
    const usesBcrypt = /^\$2[aby]\$/.test(passwordHash);
    const passwordMatches = usesBcrypt
      ? await bcrypt.compare(password, passwordHash)
      : password === passwordHash;
    if (!passwordMatches) return res.status(401).json({ message: 'Username atau password salah' });

    if (!usesBcrypt) {
      await collection('users').updateOne(
        { _id: user._id },
        { $set: { passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() }, $unset: { password_hash: '' } }
      );
    }

    const publicUser = { id: asId(user), username: user.username, fullName: user.fullName || user.full_name, role: user.role };
    res.json({ token: signToken(user), user: publicUser });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const userId = toObjectId(req.user.sub);
    const user = userId ? await collection('users').findOne({ _id: userId }) : null;
    if (!user) return res.status(401).json({ message: 'Akun admin tidak ditemukan.' });
    res.json({ id: asId(user), username: user.username, fullName: user.fullName || user.full_name, role: user.role });
  } catch (error) {
    next(error);
  }
});

app.get('/api/news', async (req, res, next) => {
  try {
    const rows = await collection('news')
      .find({ status: 'published' })
      .sort({ publishedDate: -1, createdAt: -1 })
      .toArray();
    res.json(rows.map(mapNews));
  } catch (error) {
    next(error);
  }
});

app.get('/api/news/:id', async (req, res, next) => {
  try {
    const newsId = toObjectId(req.params.id);
    const news = newsId ? await collection('news').findOne({ _id: newsId, status: 'published' }) : null;
    if (!news) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    res.json(mapNews(news));
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

    const now = new Date();
    const document = {
      title,
      slug: createSlug(title),
      category: req.body.category || 'Berita',
      summary,
      content,
      imageUrl: await fileUrl(req, req.file),
      publishedDate: date,
      status: 'published',
      createdBy: req.user.sub,
      createdAt: now,
      updatedAt: now
    };
    const result = await collection('news').insertOne(document);
    res.status(201).json(mapNews({ ...document, _id: result.insertedId }));
  } catch (error) {
    next(error);
  }
});

app.put('/api/news/:id', requireAuth, newsUpload.single('image'), async (req, res, next) => {
  try {
    const newsId = toObjectId(req.params.id);
    const existing = newsId ? await collection('news').findOne({ _id: newsId }) : null;
    if (!existing) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    const imageUrl = req.file ? await fileUrl(req, req.file) : existing.imageUrl;
    await collection('news').updateOne(
      { _id: newsId },
      {
        $set: {
          title: req.body.title || existing.title,
          category: req.body.category || existing.category,
          summary: req.body.summary || existing.summary,
          content: req.body.content || existing.content,
          imageUrl,
          publishedDate: req.body.date || existing.publishedDate,
          updatedAt: new Date()
        }
      }
    );
    const updated = await collection('news').findOne({ _id: newsId });
    res.json(mapNews(updated));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/news/:id', requireAuth, async (req, res, next) => {
  try {
    const newsId = toObjectId(req.params.id);
    const result = newsId ? await collection('news').deleteOne({ _id: newsId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ message: 'Berita tidak ditemukan' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents', async (req, res, next) => {
  try {
    const rows = await collection('public_documents')
      .find({ status: 'published' })
      .sort({ year: -1, createdAt: -1 })
      .toArray();
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
    const uploadedFileUrl = await fileUrl(req, req.file);
    if (!title || !year || !description || !uploadedFileUrl) return res.status(400).json({ message: 'Data dan file dokumen wajib dilengkapi.' });

    const now = new Date();
    const document = {
      title,
      category,
      year,
      description,
      fileUrl: uploadedFileUrl,
      status: 'published',
      createdBy: req.user.sub,
      createdAt: now,
      updatedAt: now
    };
    const result = await collection('public_documents').insertOne(document);
    res.status(201).json(mapDocument({ ...document, _id: result.insertedId }));
  } catch (error) {
    next(error);
  }
});

app.put('/api/documents/:id', requireAuth, documentUpload.single('file'), async (req, res, next) => {
  try {
    const documentId = toObjectId(req.params.id);
    const existing = documentId ? await collection('public_documents').findOne({ _id: documentId }) : null;
    if (!existing) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
    const uploadedFileUrl = req.file ? await fileUrl(req, req.file) : existing.fileUrl;
    await collection('public_documents').updateOne(
      { _id: documentId },
      {
        $set: {
          title: req.body.title || existing.title,
          category: req.body.category || existing.category,
          year: req.body.year || existing.year,
          description: req.body.description || existing.description,
          fileUrl: uploadedFileUrl,
          updatedAt: new Date()
        }
      }
    );
    const updated = await collection('public_documents').findOne({ _id: documentId });
    res.json(mapDocument(updated));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const documentId = toObjectId(req.params.id);
    const result = documentId ? await collection('public_documents').deleteOne({ _id: documentId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ message: 'Dokumen tidak ditemukan' });
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

    const result = await collection('survey_responses').insertOne({
      respondentName: respondentName || null,
      serviceType,
      overallRating: ratings.overallRating,
      easeRating: ratings.easeRating,
      speedRating: ratings.speedRating,
      staffRating: ratings.staffRating,
      feedback: feedback || null,
      createdAt: new Date()
    });
    res.status(201).json({ id: String(result.insertedId), message: 'Terima kasih. Survei Anda telah tersimpan.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/surveys', requireAuth, async (req, res, next) => {
  try {
    const rows = await collection('survey_responses').find({}).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(mapSurvey));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/surveys/:id', requireAuth, async (req, res, next) => {
  try {
    const surveyId = toObjectId(req.params.id);
    const result = surveyId ? await collection('survey_responses').deleteOne({ _id: surveyId }) : { deletedCount: 0 };
    if (!result.deletedCount) return res.status(404).json({ message: 'Data survei tidak ditemukan' });
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
      ? (uploadType(req) === 'documents'
        ? `Ukuran dokumen maksimal ${documentFileLimit / megabyte} MB.`
        : `Ukuran gambar maksimal ${imageFileLimit / megabyte} MB.`)
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
      console.log(`Backend berjalan di http://localhost:${port} menggunakan MongoDB ${databaseName}`);
    });
  })
  .catch((error) => {
    console.error('Backend gagal terhubung ke MongoDB:', error.message);
    process.exit(1);
  });
