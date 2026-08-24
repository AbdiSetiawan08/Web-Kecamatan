import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const heroImages = [
  '/assets/wisata-air-terjun-waesae.jpeg',
  '/assets/wisata-lappa-laona.jpeg',
  '/assets/wisata-celebes-canyon.jpeg',
  '/assets/wisata-batu-mallopie.jpeg'
];

const emptyNews = {
  title: '',
  category: 'Kegiatan',
  date: new Date().toISOString().slice(0, 10),
  summary: '',
  content: '',
  image: null
};

const emptyDocument = {
  title: '',
  category: 'Transparansi',
  year: new Date().getFullYear().toString(),
  description: '',
  file: null
};

const surveyServiceOptions = [
  'Surat Dispensasi Nikah',
  'Legalisasi Surat Keterangan Ahli Waris',
  'Surat Rekomendasi Kegiatan',
  'Legalisasi Surat Keterangan Susunan Keluarga',
  'Legalisasi Surat Penguasaan Tanah (Sporadik)',
  'Legalisasi Surat Pengantar Pendaftaran Anggota TNI/POLRI',
  'Pembuatan Akta Tanah oleh PPATS',
  'Informasi melalui website',
  'Lainnya'
];

const emptySurvey = {
  respondentName: '',
  serviceType: '',
  overallRating: 0,
  easeRating: 0,
  speedRating: 0,
  staffRating: 0,
  feedback: ''
};

function apiAsset(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

function App() {
  const getViewFromPath = () => {
    if (window.location.pathname.startsWith('/admin')) return 'admin';
    if (window.location.pathname.startsWith('/survey')) return 'survey';
    return 'public';
  };
  const [view, setView] = useState(getViewFromPath);
  const [news, setNews] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [adminUser, setAdminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user')) || null;
    } catch {
      return null;
    }
  });
  const [heroIndex, setHeroIndex] = useState(0);
  const [status, setStatus] = useState({ loading: true, error: '' });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!token) {
      setAdminUser(null);
      localStorage.removeItem('admin_user');
      return;
    }

    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Sesi admin tidak valid.');
        return response.json();
      })
      .then((user) => {
        setAdminUser(user);
        localStorage.setItem('admin_user', JSON.stringify(user));
      })
      .catch(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setToken('');
        setAdminUser(null);
      });
  }, [token]);

  useEffect(() => {
    const handlePopState = () => setView(getViewFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroImages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  async function fetchData() {
    try {
      setStatus({ loading: true, error: '' });
      const [newsRes, docsRes] = await Promise.all([
        fetch(`${API_URL}/api/news`),
        fetch(`${API_URL}/api/documents`)
      ]);
      setNews(await newsRes.json());
      setDocuments(await docsRes.json());
      setStatus({ loading: false, error: '' });
    } catch {
      setStatus({ loading: false, error: 'Data website belum dapat dimuat. Pastikan backend sedang berjalan.' });
    }
  }

  function navigate(nextView) {
    const paths = { admin: '/admin', survey: '/survey', public: '/' };
    window.history.pushState({}, '', paths[nextView] || '/');
    setView(nextView);
  }

  if (view === 'admin') {
    return <AdminApp token={token} setToken={setToken} adminUser={adminUser} setAdminUser={setAdminUser} news={news} documents={documents} onRefresh={fetchData} onPublic={() => navigate('public')} />;
  }

  if (view === 'survey') {
    return <SurveyPage onPublic={() => navigate('public')} />;
  }

  return <PublicSite news={news} documents={documents} heroIndex={heroIndex} status={status} onAdmin={() => navigate('admin')} onSurvey={() => navigate('survey')} />;
}

function PublicSite({ news, documents, heroIndex, status, onAdmin, onSurvey }) {
  const [profileTab, setProfileTab] = useState('welcome');
  const [tourismIndex, setTourismIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newsQuery, setNewsQuery] = useState('');
  const [newsCategory, setNewsCategory] = useState('Semua');
  const [servicePage, setServicePage] = useState(0);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  const [selectedNews, setSelectedNews] = useState(null);
  const publicNews = news.filter((item) => item.category !== 'Pengumuman');
  const filteredNews = publicNews.filter((item) => {
    const matchesCategory = newsCategory === 'Semua' || item.category === newsCategory;
    const text = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
    return matchesCategory && text.includes(newsQuery.toLowerCase());
  });
  const featured = filteredNews[0];
  const secondaryNews = filteredNews.slice(1, 3);
  const announcements = news.filter((item) => item.category === 'Pengumuman').slice(0, 3);
  const newsCategories = ['Semua', 'Berita Utama', 'Berita', 'Kegiatan'];

  useEffect(() => {
    if (!selectedNews) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedNews(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedNews]);

  const administrationServices = [
    {
      number: '01',
      category: 'Perkawinan',
      title: 'Surat Dispensasi Nikah',
      description: 'Pelayanan penerbitan dispensasi nikah berdasarkan berkas pengantar dan formulir perkawinan dari desa atau kelurahan.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: [
        'Surat pengantar nikah dari desa/kelurahan',
        'Formulir permohonan kehendak nikah',
        'Formulir persetujuan calon pengantin',
        'Formulir surat izin orang tua',
        'Fotokopi akta kelahiran, KK, KTP, dan ijazah',
        'Surat keterangan kematian untuk cerai mati atau akta cerai untuk cerai hidup',
        'Surat permohonan dispensasi nikah'
      ],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses draf surat dispensasi nikah',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki terhadap draf surat',
        'Camat melakukan penelaahan dan penandatanganan',
        'Surat dispensasi nikah diserahkan kepada penerima layanan'
      ],
      product: 'Surat Dispensasi Nikah'
    },
    {
      number: '02',
      category: 'Kewarisan',
      title: 'Legalisasi Surat Keterangan Ahli Waris',
      description: 'Pelayanan legalisasi surat keterangan ahli waris yang telah ditandatangani kepala desa atau lurah.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: [
        'Surat keterangan ahli waris yang telah ditandatangani kepala desa/lurah',
        'Fotokopi SPPT PBB terakhir',
        'Fotokopi KTP para ahli waris',
        'Foto para ahli waris saat menandatangani surat keterangan ahli waris'
      ],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses legalisasi surat keterangan ahli waris',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki',
        'Camat melakukan penelaahan dan penandatanganan',
        'Legalisasi surat keterangan ahli waris diserahkan kepada penerima layanan'
      ],
      product: 'Legalisasi Surat Keterangan Ahli Waris'
    },
    {
      number: '03',
      category: 'Kegiatan',
      title: 'Surat Rekomendasi Kegiatan',
      description: 'Penerbitan rekomendasi untuk kegiatan atau keramaian berdasarkan pengantar dari desa atau kelurahan.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: ['Surat pengantar dari desa/kelurahan'],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses draf surat rekomendasi kegiatan',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki terhadap draf surat',
        'Camat melakukan penelaahan dan penandatanganan',
        'Surat rekomendasi kegiatan diserahkan kepada penerima layanan'
      ],
      product: 'Surat Rekomendasi Kegiatan'
    },
    {
      number: '04',
      category: 'Kependudukan',
      title: 'Legalisasi Surat Keterangan Susunan Keluarga',
      description: 'Pelayanan legalisasi susunan keluarga yang telah ditandatangani kepala keluarga atau pihak yang bersangkutan.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: [
        'Fotokopi Kartu Keluarga (KK)',
        'Surat susunan keluarga yang ditandatangani kepala keluarga atau pihak yang bersangkutan'
      ],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses draf legalisasi surat keterangan susunan keluarga',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki terhadap draf surat',
        'Camat melakukan penelaahan dan penandatanganan',
        'Legalisasi surat keterangan susunan keluarga diserahkan kepada penerima layanan'
      ],
      product: 'Legalisasi Surat Keterangan Susunan Keluarga'
    },
    {
      number: '05',
      category: 'Pertanahan',
      title: 'Legalisasi Surat Penguasaan Tanah (Sporadik)',
      description: 'Pelayanan legalisasi surat penguasaan tanah atau sporadik yang diajukan melalui desa atau kelurahan.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: [
        'Surat pengantar atau surat penguasaan tanah (sporadik) dari desa/kelurahan',
        'Fotokopi SPPT PBB terakhir',
        'Fotokopi KTP pemohon',
        'Dokumen pendukung surat pengantar atau penguasaan tanah (sporadik)'
      ],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses draf legalisasi surat penguasaan tanah (sporadik)',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki terhadap draf legalisasi',
        'Camat melakukan penelaahan dan penandatanganan',
        'Legalisasi surat penguasaan tanah (sporadik) diserahkan kepada penerima layanan'
      ],
      product: 'Legalisasi Surat Penguasaan Tanah (Sporadik)'
    },
    {
      number: '06',
      category: 'Rekrutmen',
      title: 'Legalisasi Surat Pengantar Pendaftaran Anggota TNI/POLRI',
      description: 'Pelayanan legalisasi surat pengantar untuk pendaftaran calon anggota TNI atau POLRI.',
      duration: 'Sekitar 20 menit',
      cost: 'Tidak ada biaya/tarif',
      requirements: [
        'Surat pengantar pendaftaran TNI/POLRI yang telah ditandatangani kepala desa/lurah',
        'Dokumen pendukung surat keterangan, seperti ijazah',
        'Fotokopi KTP pemohon'
      ],
      procedures: [
        'Penerima layanan mengajukan berkas ke loket pelayanan',
        'Petugas pemberi layanan melakukan verifikasi berkas',
        'Jika berkas lengkap, penerima layanan melakukan registrasi dan petugas memproses draf legalisasi surat pengantar',
        'Kepala seksi dan sekretaris melakukan verifikasi serta paraf hierarki terhadap draf legalisasi',
        'Camat melakukan penelaahan dan penandatanganan',
        'Legalisasi surat pengantar pendaftaran TNI/POLRI diserahkan kepada penerima layanan'
      ],
      product: 'Legalisasi Surat Pengantar Pendaftaran Anggota TNI/POLRI'
    },
    {
      number: '07',
      category: 'Pertanahan',
      title: 'Pembuatan Akta Tanah oleh PPATS',
      description: 'Pelayanan pembuatan akta tanah oleh Pejabat Pembuat Akta Tanah Sementara (PPATS) Kecamatan Tanete Riaja.',
      duration: 'Sekitar 3-5 hari kerja',
      cost: 'Konfirmasi ke loket',
      requirements: [
        'Fotokopi KTP para pihak',
        'Fotokopi Kartu Keluarga para pihak',
        'Sertipikat tanah asli',
        'SPPT PBB tahun berjalan',
        'Bukti pembayaran PBB',
        'Dokumen pendukung mengenai objek tanah',
        'Surat pernyataan atau keterangan mengenai status tanah apabila diperlukan',
        'Dokumen yang menunjukkan hubungan hukum para pihak dengan tanah',
        'Kehadiran para pihak yang berkepentingan untuk penandatanganan akta',
        'Dua orang saksi yang memenuhi ketentuan'
      ],
      procedures: [
        'Penerimaan dan pemeriksaan kelengkapan berkas',
        'Verifikasi dokumen dan data tanah',
        'Pemeriksaan atau klarifikasi para pihak',
        'Penyusunan konsep akta',
        'Penandatanganan akta oleh para pihak dan saksi',
        'Penandatanganan oleh PPATS',
        'Penyerahan salinan atau produk layanan'
      ],
      product: 'Akta Tanah oleh PPATS'
    }
  ];
  const servicePages = Math.ceil(administrationServices.length / 6);
  const visibleServices = administrationServices.slice(servicePage * 6, servicePage * 6 + 6);
  const selectedService = administrationServices[selectedServiceIndex];
  const tourismItems = [
    {
      number: '01',
      image: '/assets/wisata-lappa-laona.jpeg',
      icon: 'fa-solid fa-mountain-sun',
      title: 'Lappa Laona',
      category: 'Wisata Alam / Perbukitan / Padang Sabana',
      location: 'Dusun Waruwue, Desa Harapan, Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan',
      description: 'Kawasan perbukitan dan padang rumput hijau (sabana) di ketinggian sekitar 1.000 mdpl. Menyajikan udara sejuk, pemandangan lembah, spot foto gazebo segitiga khas, fasilitas camping ground, hingga wahana flying fox.'
    },
    {
      number: '02',
      image: '/assets/wisata-celebes-canyon.jpeg',
      icon: 'fa-solid fa-water',
      title: 'Celebes Canyon',
      category: 'Wisata Alam / Sungai & Ngarai Karst',
      location: 'Desa Libureng, Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan',
      description: 'Destinasi alam berupa ngarai dengan susunan bebatuan cadas putih alami yang dialiri sungai jernih ber-air terjun mini. Sering dijuluki sebagai Grand Canyon-nya Sulawesi Selatan.'
    },
    {
      number: '03',
      image: '/assets/wisata-air-terjun-waesae.jpeg',
      icon: 'fa-solid fa-water',
      title: 'Air Terjun Waesae',
      category: 'Wisata Alam / Air Terjun',
      location: 'Desa Lompo Riaja, Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan',
      description: 'Air terjun setinggi sekitar 25 meter yang dikelilingi tebing batu raksasa dan persawahan. Sering dijuluki "Air Terjun Pelangi Abadi" karena saat cuaca cerah terbiaskan cahaya matahari yang membentuk pelangi kecil di sekitar percikan airnya.'
    },
    {
      number: '04',
      image: '/assets/wisata-batu-mallopie.jpeg',
      icon: 'fa-solid fa-mountain',
      title: 'Batu Mallopie',
      category: 'Wisata Alam / Sungai & Ngarai',
      location: 'Kelurahan Lompo Riaja, Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan',
      description: 'Objek wisata sungai ber-air jernih yang diapit oleh tebing batu eksotis. Memiliki daya tarik utama berupa bebatuan besar yang bentuknya menyerupai perahu (mallopie dalam bahasa daerah berarti berbentuk perahu).'
    },
    {
      number: '05',
      image: '/assets/wisata-pekkae-eco-lodge.jpeg',
      icon: 'fa-solid fa-house-chimney',
      title: 'Pekkae Eco Lodge and Ecoriver Cafe',
      category: 'Penginapan & Kafe Alam / Wisata Edukasi Lingkungan',
      location: 'Desa Lompo Tengah, Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan',
      description: 'Destinasi penginapan dan kafe tepi sungai berkonsep ramah lingkungan. Tempat ini menawarkan suasana tenang khas pedesaan, pemandangan aliran sungai yang asri, serta tempat bersantai dan berkumpul di alam terbuka yang cocok untuk wisata keluarga maupun relaksasi.'
    }
  ];

  function showTourism(direction) {
    setTourismIndex((current) => (current + direction + tourismItems.length) % tourismItems.length);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function showServicePage(direction) {
    setServicePage((current) => {
      const next = (current + direction + servicePages) % servicePages;
      setSelectedServiceIndex(next * 6);
      return next;
    });
  }

  const profileTitles = {
    welcome: 'Kata Sambutan',
    history: 'Sejarah Kecamatan Tanete Riaja',
    tourism: 'Potensi Pariwisata'
  };

  return (
    <div>
      <header className="site-header">
        <nav className="container-wide navbar">
          <a className="brand" href="#beranda">
            <div className="brand-mark">
              <img src="/assets/pngwing.com.png" alt="Logo Kabupaten Barru" />
            </div>
            <div>
              <strong>Kecamatan Tanete Riaja</strong>
              <span>Kabupaten Barru</span>
            </div>
          </a>

          <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="main-navigation">
            <i className={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
            <span>Menu</span>
          </button>

          <ul className={`desktop-menu ${menuOpen ? 'is-open' : ''}`} id="main-navigation">
            <li><a href="#beranda" onClick={closeMenu}>Beranda</a></li>
            <li><a href="#profil" onClick={closeMenu}>Profil</a></li>
            <li><a href="#visi-misi" onClick={closeMenu}>Visi Misi</a></li>
            <li><a href="#struktur" onClick={closeMenu}>Struktur</a></li>
            <li><a href="#layanan" onClick={closeMenu}>Pelayanan</a></li>
            <li><a href="#informasi" onClick={closeMenu}>Informasi</a></li>
            <li><a href="#kontak" onClick={closeMenu}>Kontak</a></li>
          </ul>
        </nav>
      </header>

      <main id="beranda">
        {status.error ? (
          <div className="site-alert" role="status">
            <div className="container-wide"><i className="fa-solid fa-circle-info"></i> {status.error}</div>
          </div>
        ) : null}

        <section className="hero">
          {heroImages.map((image, index) => (
            <div
              className={`hero-slide ${index === heroIndex ? 'is-active' : ''}`}
              key={image}
              style={{ backgroundImage: `url("${image}")` }}
            />
          ))}

          <div className="container-wide hero-content">
            <p className="eyebrow">Website Resmi Pemerintah Kecamatan</p>
            <h1>Kecamatan Tanete Riaja</h1>
            <p className="hero-subtitle">Kabupaten Barru</p>
            <p className="hero-text">Pusat informasi pelayanan publik, kegiatan pemerintahan, pengumuman, dan kanal aspirasi masyarakat.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#layanan">Layanan Kami</a>
              <a className="secondary-button" href="#informasi">Informasi Terbaru</a>
            </div>
            <div className="hero-summary" aria-label="Ringkasan layanan website">
              <span><strong>{administrationServices.length}</strong> Layanan Publik</span>
              <span><strong>{news.length}</strong> Informasi</span>
              <span><strong>{documents.length}</strong> Dokumen</span>
            </div>
          </div>
        </section>

        <section className="section profile-section" id="profil">
          <div className="container-wide">
            <div className="section-heading">
              <p>Profile</p>
              <h2>{profileTitles[profileTab]}</h2>
              <div className="profile-tabs" aria-label="Pilih konten profil">
                <button
                  className={profileTab === 'welcome' ? 'active' : ''}
                  type="button"
                  onClick={() => setProfileTab('welcome')}
                >
                  Kata Sambutan
                </button>
                <button
                  className={profileTab === 'history' ? 'active' : ''}
                  type="button"
                  onClick={() => setProfileTab('history')}
                >
                  Sejarah
                </button>
                <button
                  className={profileTab === 'tourism' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setProfileTab('tourism');
                    setTourismIndex(0);
                  }}
                >
                  Potensi Pariwisata
                </button>
              </div>
            </div>

            <div className={`profile-grid ${profileTab !== 'welcome' ? 'tourism-mode' : ''}`}>
              {profileTab === 'welcome' ? (
                <article className="leader-panel">
                  <div className="leader-photo">
                    <img src="/assets/camat-tanete-riaja.png" alt="Aristo Shiddiq, Camat Tanete Riaja" loading="lazy" decoding="async" />
                  </div>
                  <h3>Camat Tanete Riaja</h3>
                  <p>Aristo Shiddiq, S.H., M.H.</p>
                </article>
              ) : null}

              <article className="welcome-panel profile-content-panel" key={profileTab}>
                {profileTab === 'welcome' ? (
                  <>
                    <div className="quote-icon"><i className="fa-solid fa-quote-left"></i></div>
                    <p><strong>Assalamu'alaikum Warahmatullahi Wabarakatuh.</strong></p>
                    <p>
                      Selamat datang di Website Resmi Kantor Kecamatan Tanete Riaja Kabupaten Barru.
                    </p>
                    <p>
                      Puji syukur kita panjatkan ke hadirat Allah SWT atas rahmat dan karunia-Nya, sehingga Website Resmi Kantor
                      Kecamatan Tanete Riaja Kabupaten Barru dapat hadir sebagai media informasi dan komunikasi bagi pemerintah
                      dan masyarakat.
                    </p>
                    <p>
                      Kehadiran website ini merupakan salah satu bentuk komitmen kami dalam meningkatkan keterbukaan informasi
                      dan kualitas pelayanan publik. Melalui website ini, masyarakat dapat memperoleh berbagai informasi mengenai
                      penyelenggaraan pemerintahan, pelayanan publik, pembangunan, pemberdayaan masyarakat, dan berbagai kegiatan
                      di wilayah Kecamatan Tanete Riaja.
                    </p>
                    <p>
                      Kami berharap website ini dapat menjadi sarana yang mudah diakses, informatif, dan bermanfaat bagi seluruh
                      masyarakat. Kami juga mengajak masyarakat untuk bersama-sama memberikan saran, masukan, dan partisipasi dalam
                      mendukung penyelenggaraan pemerintahan dan pembangunan di Kecamatan Tanete Riaja.
                    </p>
                    <p>
                      Semoga dengan semangat kebersamaan dan pelayanan yang semakin baik, kita dapat mewujudkan Kecamatan Tanete
                      Riaja yang maju, pelayanan publik yang berkualitas, serta pemerintahan yang responsif dan dekat dengan masyarakat.
                    </p>
                    <p><strong>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</strong></p>
                  </>
                ) : null}

                {profileTab === 'history' ? (
                  <div className="history-content">
                    <div className="history-icon"><i className="fa-solid fa-landmark"></i></div>
                    <p>
                      Kecamatan Tanete Riaja memiliki akar sejarah yang kuat dari sistem pemerintahan adat Kerajaan Tanete,
                      sebuah kerajaan berdaulat di pesisir barat Sulawesi Selatan. Pada masa kolonial Hindia Belanda, wilayah
                      ini berstatus sebagai tanah swapraja (Selfbestuur) yang berada di bawah naungan Afdeling Parepare. Sistem
                      pemerintahan swapraja ini terus bertahan hingga masa awal kemerdekaan Republik Indonesia, sebelum akhirnya
                      dilebur ke dalam sistem pemerintahan modern nasional.
                    </p>
                    <p>
                      Fase transisi penting terjadi pascakemerdekaan melalui penerbitan Undang-Undang Nomor 29 Tahun 1959 tentang
                      Pembentukan Daerah-Daerah Tingkat II di Sulawesi. Sebagai tindak lanjut undang-undang tersebut, pada tanggal
                      20 Februari 1960, Kabupaten Barru resmi dibentuk. Untuk menata birokrasi, wilayah eks-Swapraja Tanete kemudian
                      dibagi menjadi wilayah administratif yang lebih kecil. Wilayah bagian dataran tinggi, pegunungan, dan pedalaman
                      di sebelah timur kemudian dinamakan Tanete Riaja. Dalam bahasa Bugis, "Riaja" berarti arah darat, timur, atau
                      bagian atas, sedangkan wilayah pesisirnya menjadi Kecamatan Tanete Rilau.
                    </p>
                    <p>
                      Seiring perkembangan waktu dan pertumbuhan penduduk, wilayah geografis Tanete Riaja yang awalnya sangat luas
                      dinilai kurang efektif untuk pelayanan publik. Oleh karena itu, berdasarkan Peraturan Daerah Kabupaten Barru
                      Nomor 01 Tahun 2001, wilayah Tanete Riaja resmi dimekarkan. Bagian timur wilayah ini dipisahkan menjadi kecamatan
                      baru bernama Kecamatan Pujananting. Pascapemekaran tersebut, Kecamatan Tanete Riaja menetapkan batas-batas
                      wilayah barunya seperti yang dikenal saat ini.
                    </p>
                    <div className="history-points">
                      <article>
                        <strong>Akar Kerajaan Tanete</strong>
                        <span>Berasal dari wilayah pemerintahan adat Kerajaan Tanete yang kemudian berstatus swapraja.</span>
                      </article>
                      <article>
                        <strong>Pembentukan Tahun 1960</strong>
                        <span>Terbentuk dalam penataan wilayah eks-Swapraja Tanete setelah Kabupaten Barru resmi dibentuk.</span>
                      </article>
                      <article>
                        <strong>Pemekaran Tahun 2001</strong>
                        <span>Bagian timur Tanete Riaja dimekarkan menjadi Kecamatan Pujananting.</span>
                      </article>
                    </div>
                  </div>
                ) : null}

                {profileTab === 'tourism' ? (
                  <>
                    <div className="tourism-slider">
                      <button className="tourism-nav" type="button" onClick={() => showTourism(-1)} aria-label="Wisata sebelumnya">
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>

                      <div className="tourism-card" key={tourismItems[tourismIndex].title}>
                        <div className="tourism-photo" style={{ backgroundImage: `url("${tourismItems[tourismIndex].image}")` }} />
                        <div className="tourism-card-body">
                          <div className="tourism-card-icon"><i className={tourismItems[tourismIndex].icon}></i></div>
                          <span>{tourismItems[tourismIndex].number}</span>
                          <h3>{tourismItems[tourismIndex].title}</h3>
                          <p className="tourism-category">{tourismItems[tourismIndex].category}</p>
                          <p className="tourism-location"><i className="fa-solid fa-location-dot"></i> {tourismItems[tourismIndex].location}</p>
                          <p>{tourismItems[tourismIndex].description}</p>
                        </div>
                      </div>

                      <button className="tourism-nav" type="button" onClick={() => showTourism(1)} aria-label="Wisata berikutnya">
                        <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>

                    <div className="tourism-dots" aria-label="Navigasi potensi wisata">
                      {tourismItems.map((item, index) => (
                        <button
                          className={index === tourismIndex ? 'active' : ''}
                          type="button"
                          key={item.title}
                          onClick={() => setTourismIndex(index)}
                        >
                          {item.number}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </article>
            </div>
          </div>
        </section>

        <section className="section vision-section" id="visi-misi">
          <div className="container-wide">
            <div className="section-heading centered">
              <p>Arah Pembangunan</p>
              <h2>Visi dan Misi Pemerintah Kabupaten Barru</h2>
              <span>Arah pembangunan Kabupaten Barru periode 2025-2029 yang menjadi pedoman penyelenggaraan pemerintahan Kecamatan Tanete Riaja.</span>
            </div>

            <div className="vision-layout">
              <article className="vision-card vision-primary">
                <span><i className="fa-solid fa-eye"></i></span>
                <p>Visi</p>
                <h3>Barru Berkeadilan, Barru Maju Berkelanjutan, Barru Sejahtera Lebih Cepat.</h3>
              </article>

              <article className="mission-card">
                <span><i className="fa-solid fa-bullseye"></i></span>
                <p>Misi</p>
                <ol>
                  <li>Mempercepat pengentasan kemiskinan dan pengangguran terbuka.</li>
                  <li>Membangun manusia yang unggul dan inklusif.</li>
                  <li>Membangun dan mengembangkan infrastruktur wilayah yang berketahanan iklim.</li>
                  <li>Meningkatkan good governance yang bernafaskan keagamaan.</li>
                  <li>Meningkatkan produktivitas perekonomian yang berdaya saing.</li>
                </ol>
              </article>
            </div>
          </div>
        </section>

        <section className="section organization-section" id="struktur">
          <div className="container-wide">
            <div className="section-heading centered">
              <p>Organisasi</p>
              <h2>Struktur Organisasi Kantor Kecamatan Tanete Riaja</h2>
              <span>Susunan perangkat Kecamatan Tanete Riaja dalam mendukung pelayanan pemerintahan, pembangunan, dan kemasyarakatan.</span>
            </div>

            <div className="org-chart org-chart-detailed" aria-label="Struktur organisasi Kecamatan Tanete Riaja">
              <div className="org-leader">
                <article className="org-card org-card-primary org-card-leader">
                  <i className="fa-solid fa-user-tie"></i>
                  <span>Camat</span>
                </article>
              </div>

              <div className="org-main-connector"></div>

              <section className="org-secretariat-group" aria-label="Sekretariat Kecamatan">
                <article className="org-card org-card-secretary">
                  <i className="fa-solid fa-user-gear"></i>
                  <span>Sekretaris</span>
                </article>

                <div className="org-support-grid">
                  {[
                    ['fa-solid fa-list-check', 'Subbagian Program'],
                    ['fa-solid fa-coins', 'Subbagian Keuangan'],
                    ['fa-solid fa-users-gear', 'Subbagian Umum dan SDM'],
                    ['fa-solid fa-user-group', 'Fungsional Pelaksana']
                  ].map(([icon, title]) => (
                    <article className="org-card org-card-support" key={title}>
                      <i className={icon}></i>
                      <span>{title}</span>
                    </article>
                  ))}
                </div>
              </section>

              <div className="org-main-connector org-main-connector-sections"></div>

              <div className="org-sections-grid">
                {[
                  ['fa-solid fa-building-columns', 'Seksi Tata Pemerintahan'],
                  ['fa-solid fa-people-roof', 'Seksi Pemberdayaan Masyarakat Desa'],
                  ['fa-solid fa-shield-halved', 'Seksi Ketentraman dan Ketertiban Umum'],
                  ['fa-solid fa-chart-line', 'Seksi Perekonomian dan Pembangunan']
                ].map(([icon, title]) => (
                  <div className="org-section-column" key={title}>
                    <article className="org-card org-card-section">
                      <i className={icon}></i>
                      <span>{title}</span>
                    </article>
                    <div className="org-section-connector"></div>
                    <article className="org-card org-card-functional">
                      <i className="fa-solid fa-user-group"></i>
                      <span>Fungsional Pelaksana</span>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section services-section" id="layanan">
          <div className="container-wide">
            <div className="section-heading service-heading">
              <p>Layanan Administrasi</p>
              <h2>Surat dan dokumen yang bisa diurus di kecamatan</h2>
              <span>Kecamatan Tanete Riaja menyediakan layanan administrasi untuk masyarakat. Datang langsung ke kantor pada jam layanan, atau cek dulu jenis layanan yang tersedia.</span>
            </div>

            <div className="service-carousel-controls" aria-label="Navigasi layanan administrasi">
              <button type="button" onClick={() => showServicePage(-1)}><i className="fa-solid fa-arrow-left"></i> Sebelumnya</button>
              <span>Halaman {servicePage + 1} dari {servicePages}</span>
              <button type="button" onClick={() => showServicePage(1)}>Selanjutnya <i className="fa-solid fa-arrow-right"></i></button>
            </div>

            <div className="administration-grid">
              {visibleServices.map((service, index) => (
                <button
                  className={`administration-card ${selectedServiceIndex === servicePage * 6 + index ? 'active' : ''}`}
                  type="button"
                  key={service.title}
                  onClick={() => setSelectedServiceIndex(servicePage * 6 + index)}
                >
                  <span>{service.number} / {service.category}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <div className="service-meta">
                    <small><i className="fa-regular fa-clock"></i> {service.duration}</small>
                    <small>{service.cost}</small>
                  </div>
                </button>
              ))}
            </div>

            <article className="service-detail-card">
              <div className="service-detail-head">
                <div>
                  <span>{selectedService.number}</span>
                  <h3>Standar Pelayanan {selectedService.title}</h3>
                </div>
                <div className="service-meta">
                  <small><i className="fa-regular fa-clock"></i> {selectedService.duration}</small>
                  <small><i className="fa-solid fa-tag"></i> {selectedService.cost}</small>
                </div>
              </div>

              <div className="service-detail-grid">
                <div>
                  <h4>Persyaratan</h4>
                  <ol>
                    {selectedService.requirements.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </div>
                <div>
                  <h4>Prosedur</h4>
                  <ol>
                    {selectedService.procedures.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </div>
              </div>

              <p className="service-product"><strong>Produk Layanan:</strong> {selectedService.product}</p>
            </article>
          </div>
        </section>

        <section className="section news-section" id="informasi">
          <div className="container-wide news-layout">
            <div>
              <div className="section-heading">
                <p>Informasi Terbaru</p>
                <h2>Kegiatan dan Berita</h2>
              </div>

              <div className="news-tools" aria-label="Pencarian dan filter berita">
                <label className="search-field">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} placeholder="Cari berita atau kegiatan..." />
                </label>
                <div className="filter-chips">
                  {newsCategories.map((category) => (
                    <button className={newsCategory === category ? 'active' : ''} type="button" key={category} onClick={() => setNewsCategory(category)}>
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {status.loading ? (
                <div className="skeleton-card" aria-label="Memuat berita"></div>
              ) : featured ? (
                <button className="featured-news news-card-button" type="button" onClick={() => setSelectedNews(featured)} aria-label={`Baca berita ${featured.title}`}>
                  <div className="news-image" style={{ backgroundImage: `url("${apiAsset(featured.imageUrl) || heroImages[0]}")` }} />
                  <div className="news-content">
                    <span className="category">{featured.category}</span>
                    <h3>{featured.title}</h3>
                    <p>{featured.summary}</p>
                    <div className="meta"><i className="fa-regular fa-calendar"></i> {featured.date} <span>·</span> Tanete Riaja</div>
                    <span className="news-read-more">Baca selengkapnya <i className="fa-solid fa-arrow-right"></i></span>
                  </div>
                </button>
              ) : (
                <p className="empty-text">Belum ada berita.</p>
              )}

              <div className="news-list">
                {secondaryNews.map((item) => (
                  <article key={item.id}>
                    <button className="news-card-trigger" type="button" onClick={() => setSelectedNews(item)} aria-label={`Baca berita ${item.title}`}>
                      <h3>{item.title}</h3>
                      <p>{item.summary}</p>
                      <span>{item.date} · {item.category}</span>
                      <span className="news-read-more">Baca selengkapnya <i className="fa-solid fa-arrow-right"></i></span>
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <aside className="announcement-panel">
              <div className="section-heading">
                <p>Pengumuman</p>
                <h2>Info Penting</h2>
              </div>
              <ol>
                {status.loading ? <li className="announcement-loading">Memuat pengumuman...</li> : null}
                {!status.loading && announcements.map((item) => (
                  <li key={item.id}>
                    <button className="announcement-link" type="button" onClick={() => setSelectedNews(item)}>{item.title}</button>
                    <span>{item.date} · {item.category}</span>
                  </li>
                ))}
              </ol>
              {!status.loading && !announcements.length ? <p className="empty-text">Belum ada pengumuman.</p> : null}
              <a href="#dokumen" className="text-link">Lihat dokumen</a>
            </aside>
          </div>
        </section>

        <section className="survey-section" id="dokumen">
          <div className="container-wide survey-inner">
            <div className="survey-icon"><i className="fa-solid fa-clipboard-check"></i></div>
            <div>
              <h2>Bagaimana Pengalaman Anda?</h2>
              <p>Pendapat Anda sangat berarti untuk membantu meningkatkan kualitas pelayanan website pemerintah kecamatan.</p>
            </div>
            <button type="button" className="primary-button" onClick={onSurvey}>Isi Survei</button>
          </div>
        </section>

        <section className="section documents-section" id="daftar-dokumen">
          <div className="container-wide">
            <div className="section-heading">
              <p>Transparansi</p>
              <h2>Dokumen Publik</h2>
            </div>

            <div className="document-list">
              {documents.map((doc) => (
                <article key={doc.id}>
                  <div>
                    <span>{doc.category} · {doc.year}</span>
                    <h3>{doc.title}</h3>
                    <p>{doc.description}</p>
                  </div>
                  {doc.fileUrl ? <a className="primary-button document-button" href={apiAsset(doc.fileUrl)} target="_blank" rel="noreferrer">Buka</a> : null}
                </article>
              ))}
              {!documents.length ? <p className="empty-text">Belum ada dokumen publik.</p> : null}
            </div>
          </div>
        </section>

        <section className="contact-section" id="kontak">
          <div className="container-wide">
            <div className="contact-heading">
              <p>Kontak</p>
              <h2>Kunjungi atau hubungi kantor kecamatan</h2>
            </div>

            <div className="contact-layout">
              <div className="contact-card">
                {[
                  ['fa-solid fa-location-dot', 'Alamat Kantor', 'Kecamatan Tanete Riaja, Kabupaten Barru, Sulawesi Selatan'],
                  ['fa-solid fa-envelope', 'Email', 'ktrcamattaneteriaja@gmail.com'],
                  ['fa-regular fa-clock', 'Jam Layanan', 'Senin-Jumat, 07.30-16.00 WITA']
                ].map(([icon, title, text]) => (
                  <article className="contact-item" key={title}>
                    <span><i className={icon}></i></span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="map-card">
                <iframe
                  title="Peta Kantor Kecamatan Tanete Riaja"
                  src="https://www.google.com/maps?q=Kantor%20Camat%20Tanete%20Riaja%20Kabupaten%20Barru%20Sulawesi%20Selatan&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>
          </div>
        </section>
      </main>

      {selectedNews ? (
        <div className="news-modal-backdrop" role="presentation" onMouseDown={() => setSelectedNews(null)}>
          <article
            className="news-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="news-modal-close" type="button" onClick={() => setSelectedNews(null)} aria-label="Tutup detail berita">
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div
              className="news-modal-image"
              style={{ backgroundImage: `url("${apiAsset(selectedNews.imageUrl) || heroImages[0]}")` }}
              role="img"
              aria-label={`Gambar ${selectedNews.title}`}
            />
            <div className="news-modal-body">
              <span className="category">{selectedNews.category}</span>
              <h2 id="news-detail-title">{selectedNews.title}</h2>
              <div className="meta"><i className="fa-regular fa-calendar"></i> {selectedNews.date} <span>·</span> Tanete Riaja</div>
              {selectedNews.summary ? <p className="news-modal-summary">{selectedNews.summary}</p> : null}
              <div className="news-modal-content">{selectedNews.content || selectedNews.summary}</div>
            </div>
          </article>
        </div>
      ) : null}

      <footer className="footer-custom">
        <div className="container-wide footer-grid">
          <div className="footer-brand-block">
            <div className="footer-brand">
              <img src="/assets/pngwing.com.png" alt="Logo Kabupaten Barru" />
              <h3>Kecamatan Tanete Riaja</h3>
            </div>
            <p>Portal resmi Pemerintah Kecamatan Tanete Riaja, Kabupaten Barru.</p>
          </div>

          <div>
            <h3>Navigasi</h3>
            <ul className="footer-links">
              <li><a href="#profil">Profil</a></li>
              <li><a href="#struktur">Struktur Organisasi</a></li>
              <li><a href="#layanan">Pelayanan</a></li>
              <li><a href="#informasi">Berita</a></li>
              <li><a href="#profil">Destinasi & Potensi Wisata</a></li>
            </ul>
          </div>

          <div>
            <h3>Layanan Darurat</h3>
            <ul className="footer-links">
              <li>Layanan Darurat Nasional - 112</li>
              <li>Pemadam Kebakaran - 113</li>
              <li>Kepolisian - 110</li>
              <li>Ambulans / Kesehatan - 119</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Pemerintah Kecamatan Tanete Riaja. Seluruh hak dilindungi.</p>
          <p>Dikembangkan sebagai Program Kerja Mahasiswa KKN 03 Institut Teknologi Bacharuddin Jusuf Habibie.</p>
        </div>
      </footer>

      <a className="back-to-top" href="#beranda" aria-label="Kembali ke atas"><i className="fa-solid fa-arrow-up"></i></a>
    </div>
  );
}

function RatingField({ name, label, value, onChange }) {
  return (
    <fieldset className="survey-rating-field">
      <legend>{label} <span>*</span></legend>
      <div className="survey-rating-scale">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label className={Number(value) === rating ? 'selected' : ''} key={rating}>
            <input
              type="radio"
              name={name}
              value={rating}
              checked={Number(value) === rating}
              onChange={() => onChange(rating)}
              aria-label={`${rating} - ${['Sangat buruk', 'Buruk', 'Cukup', 'Baik', 'Sangat baik'][rating - 1]}`}
              required
            />
            <strong>{rating}</strong>
            <span>{['Sangat buruk', 'Buruk', 'Cukup', 'Baik', 'Sangat baik'][rating - 1]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SurveyPage({ onPublic }) {
  const [form, setForm] = useState(emptySurvey);
  const [consent, setConsent] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ loading: false, error: '', success: false });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitSurvey(event) {
    event.preventDefault();
    setSubmitStatus({ loading: true, error: '', success: false });

    try {
      const response = await fetch(`${API_URL}/api/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Survei belum dapat disimpan.');
      setSubmitStatus({ loading: false, error: '', success: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitStatus({ loading: false, error: error.message || 'Backend belum dapat diakses.', success: false });
    }
  }

  function resetSurvey() {
    setForm(emptySurvey);
    setConsent(false);
    setSubmitStatus({ loading: false, error: '', success: false });
  }

  return (
    <div className="survey-page">
      <header className="survey-page-header">
        <div className="container-wide survey-header-inner">
          <button className="survey-brand" type="button" onClick={onPublic}>
            <img src="/assets/pngwing.com.png" alt="Logo Kabupaten Barru" />
            <span><strong>Kecamatan Tanete Riaja</strong><small>Kabupaten Barru</small></span>
          </button>
          <button className="survey-back-button" type="button" onClick={onPublic}>
            <i className="fa-solid fa-arrow-left"></i> Kembali ke Website
          </button>
        </div>
      </header>

      <main className="survey-page-main">
        {submitStatus.success ? (
          <section className="survey-success" aria-live="polite">
            <span><i className="fa-solid fa-circle-check"></i></span>
            <p>Survei Berhasil Dikirim</p>
            <h1>Terima kasih atas penilaian Anda</h1>
            <div className="survey-success-actions">
              <button className="primary-button" type="button" onClick={onPublic}>Kembali ke Website</button>
              <button className="secondary-button survey-secondary-button" type="button" onClick={resetSurvey}>Isi Survei Lagi</button>
            </div>
          </section>
        ) : (
          <>
            <div className="survey-page-heading">
              <p>Survei Kepuasan Masyarakat</p>
              <h1>Bantu kami meningkatkan kualitas pelayanan</h1>
              <span>Berikan penilaian berdasarkan pengalaman Anda menggunakan layanan Kecamatan Tanete Riaja.</span>
            </div>

            <form className="survey-form-card" onSubmit={submitSurvey}>
              {submitStatus.error ? <div className="survey-form-error" role="alert">{submitStatus.error}</div> : null}

              <div className="survey-form-grid">
                <label className="survey-field">
                  <span>Nama Responden <small>(opsional)</small></span>
                  <input
                    value={form.respondentName}
                    onChange={(event) => updateField('respondentName', event.target.value)}
                    maxLength="160"
                    placeholder="Kosongkan untuk mengirim secara anonim"
                  />
                </label>

                <label className="survey-field">
                  <span>Jenis Layanan <strong>*</strong></span>
                  <select value={form.serviceType} onChange={(event) => updateField('serviceType', event.target.value)} required>
                    <option value="">Pilih layanan yang dinilai</option>
                    {surveyServiceOptions.map((service) => <option key={service}>{service}</option>)}
                  </select>
                </label>
              </div>

              <RatingField name="overallRating" label="Kepuasan secara keseluruhan" value={form.overallRating} onChange={(value) => updateField('overallRating', value)} />
              <RatingField name="easeRating" label="Kemudahan persyaratan dan informasi" value={form.easeRating} onChange={(value) => updateField('easeRating', value)} />
              <RatingField name="speedRating" label="Kecepatan pelayanan" value={form.speedRating} onChange={(value) => updateField('speedRating', value)} />
              <RatingField name="staffRating" label="Sikap dan keramahan petugas" value={form.staffRating} onChange={(value) => updateField('staffRating', value)} />

              <label className="survey-field">
                <span>Saran atau Masukan</span>
                <textarea
                  rows="6"
                  value={form.feedback}
                  onChange={(event) => updateField('feedback', event.target.value)}
                  maxLength="3000"
                  placeholder="Tuliskan hal yang sudah baik atau yang perlu kami tingkatkan..."
                />
              </label>

              <label className="survey-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                <span>Saya menyatakan bahwa penilaian ini diberikan sesuai pengalaman pelayanan yang saya terima.</span>
              </label>

              <div className="survey-submit-row">
                <p><i className="fa-solid fa-shield-halved"></i> Data hanya digunakan untuk evaluasi pelayanan.</p>
                <button className="primary-button" type="submit" disabled={submitStatus.loading}>
                  <i className="fa-solid fa-paper-plane"></i> {submitStatus.loading ? 'Mengirim...' : 'Kirim Survei'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function AdminApp({ token, setToken, adminUser, setAdminUser, news, documents, onRefresh, onPublic }) {
  if (!token) {
    return <Login setToken={setToken} setAdminUser={setAdminUser} onPublic={onPublic} />;
  }

  return (
    <AdminDashboard
      token={token}
      setToken={setToken}
      adminUser={adminUser}
      setAdminUser={setAdminUser}
      news={news}
      documents={documents}
      onRefresh={onRefresh}
      onPublic={onPublic}
    />
  );
}

function Login({ setToken, setAdminUser, onPublic }) {
  const [form, setForm] = useState({ username: 'admin', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Username atau Password yang Anda masukkan salah.');
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      setAdminUser(data.user);
      setToken(data.token);
    } catch {
      setError('Backend belum bisa diakses dari halaman ini. Restart server atau buka frontend lewat http://localhost:5173/admin.');
    }
  }

  return (
    <main className="admin-login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <img src="/assets/pngwing.com.png" alt="Logo Kabupaten Barru" />
          <h1>Login Administrator</h1>
          <p>Kecamatan Tanete Riaja</p>
        </div>

        {error ? (
          <div className="admin-alert" role="alert">
            <strong>Login Gagal!</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <label>
          Username
          <span className="admin-input-icon">
            <i className="fa-solid fa-user"></i>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Masukkan username"
              required
            />
          </span>
        </label>
        <label>
          Password
          <span className="admin-input-icon password-input">
            <i className="fa-solid fa-lock"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Masukkan password"
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </span>
        </label>
        <button className="admin-blue-button" type="submit">
          <i className="fa-solid fa-right-to-bracket"></i> Masuk
        </button>
        <button className="admin-back-link" type="button" onClick={onPublic}>
          <i className="fa-solid fa-arrow-left"></i> Kembali ke Beranda
        </button>
      </form>
    </main>
  );
}

function AdminDashboard({ token, setToken, adminUser, setAdminUser, news, documents, onRefresh, onPublic }) {
  const [newsForm, setNewsForm] = useState(emptyNews);
  const [documentForm, setDocumentForm] = useState(emptyDocument);
  const [adminSection, setAdminSection] = useState('write-news');
  const [surveys, setSurveys] = useState([]);
  const [surveyStatus, setSurveyStatus] = useState({ loading: true, error: '' });
  const [actionError, setActionError] = useState('');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    loadSurveys();
  }, [token]);

  async function loadSurveys() {
    try {
      setSurveyStatus({ loading: true, error: '' });
      const response = await fetch(`${API_URL}/api/surveys`, { headers: authHeaders });
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) throw new Error('Data survei belum dapat dimuat.');
      setSurveys(await response.json());
      setSurveyStatus({ loading: false, error: '' });
    } catch (error) {
      setSurveyStatus({ loading: false, error: error.message });
    }
  }

  function averageRating(field) {
    if (!surveys.length) return '0.0';
    const total = surveys.reduce((sum, survey) => sum + Number(survey[field] || 0), 0);
    return (total / surveys.length).toFixed(1);
  }

  async function submitNews(event) {
    event.preventDefault();
    setActionError('');
    const body = new FormData();
    Object.entries(newsForm).forEach(([key, value]) => value && body.append(key, value));
    const response = await fetch(`${API_URL}/api/news`, { method: 'POST', headers: authHeaders, body });
    const data = await response.json();
    if (response.status === 401) return logout();
    if (!response.ok) return setActionError(data.message || 'Berita belum dapat disimpan.');
    setNewsForm(emptyNews);
    onRefresh();
  }

  async function submitDocument(event) {
    event.preventDefault();
    setActionError('');
    const body = new FormData();
    Object.entries(documentForm).forEach(([key, value]) => value && body.append(key, value));
    const response = await fetch(`${API_URL}/api/documents`, { method: 'POST', headers: authHeaders, body });
    const data = await response.json();
    if (response.status === 401) return logout();
    if (!response.ok) return setActionError(data.message || 'Dokumen belum dapat diunggah.');
    setDocumentForm(emptyDocument);
    onRefresh();
  }

  async function remove(type, id) {
    await fetch(`${API_URL}/api/${type}/${id}`, { method: 'DELETE', headers: authHeaders });
    if (type === 'surveys') {
      loadSurveys();
    } else {
      onRefresh();
    }
  }

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken('');
    setAdminUser(null);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src="/assets/pngwing.com.png" alt="Logo Kabupaten Barru" />
          <div>
            <strong>Kecamatan</strong>
            <span>Tanete Riaja</span>
          </div>
        </div>

        <nav className="admin-menu" aria-label="Menu admin">
          {[
            ['write-news', 'fa-solid fa-file-pen', 'Tulis Berita'],
            ['news-list', 'fa-solid fa-table-list', 'Daftar Berita'],
            ['documents', 'fa-solid fa-folder-open', 'Dokumen Publik'],
            ['surveys', 'fa-solid fa-square-poll-vertical', 'Hasil Survei']
          ].map(([id, icon, label]) => (
            <button
              className={adminSection === id ? 'active' : ''}
              type="button"
              key={id}
              onClick={() => setAdminSection(id)}
            >
              <i className={icon}></i>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-actions">
          <button type="button" onClick={onPublic}>
            <i className="fa-solid fa-globe"></i> Lihat Website
          </button>
          <button className="logout" type="button" onClick={logout}>
            <i className="fa-solid fa-right-from-bracket"></i> Keluar (Logout)
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <h1>Panel Administrator</h1>
          <div className="admin-user">
            <div>
              <strong>{adminUser?.username || 'Administrator'}</strong>
              <span>{adminUser?.role === 'admin' ? 'Administrator' : (adminUser?.role || 'Administrator')}</span>
            </div>
            <span className="admin-avatar" aria-hidden="true"><i className="fa-solid fa-user"></i></span>
          </div>
        </header>

        <main className="admin-main">
          {actionError ? (
            <div className="admin-alert admin-action-alert" role="alert">
              <strong>Proses belum berhasil</strong>
              <span>{actionError}</span>
            </div>
          ) : null}
          {adminSection === 'write-news' ? (
            <section className="admin-card">
              <div className="admin-card-header">
                <h2><i className="fa-solid fa-plus-circle"></i> Tambah Berita / Informasi Baru</h2>
              </div>
              <form className="admin-form" onSubmit={submitNews}>
                <label>
                  <span className="field-label">Judul Berita <span>*</span></span>
                  <input placeholder="Masukkan judul..." value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} required />
                </label>
                <div className="form-row">
                  <label>
                    <span className="field-label">Kategori <span>*</span></span>
                    <select value={newsForm.category} onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}>
                      <option>Berita Utama</option>
                      <option>Pengumuman</option>
                      <option>Kegiatan</option>
                      <option>Berita</option>
                    </select>
                  </label>
                  <label>
                    Tanggal Publikasi
                    <input type="date" value={newsForm.date} onChange={(e) => setNewsForm({ ...newsForm, date: e.target.value })} required />
                  </label>
                </div>
                <label>
                  <span className="field-label">Ringkasan Berita <span>*</span></span>
                  <textarea placeholder="Tulis ringkasan singkat..." value={newsForm.summary} onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })} required />
                </label>
                <label>
                  Gambar / Thumbnail
                  <span className="admin-file-box">
                    <i className="fa-regular fa-image"></i>
                    <strong>{newsForm.image ? newsForm.image.name : 'Pilih file gambar'}</strong>
                    <small>JPG, JPEG, PNG, WEBP - maksimal 5 MB</small>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setNewsForm({ ...newsForm, image: e.target.files[0] })} />
                  </span>
                </label>
                <label>
                  <span className="field-label">Isi Konten <span>*</span></span>
                  <textarea rows="8" placeholder="Tulis deskripsi..." value={newsForm.content} onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })} required />
                </label>
                <div className="admin-form-actions">
                  <button type="button" onClick={() => setNewsForm(emptyNews)}>Batal</button>
                  <button className="admin-blue-button" type="submit"><i className="fa-solid fa-paper-plane"></i> Publikasikan</button>
                </div>
              </form>
            </section>
          ) : null}

          {adminSection === 'news-list' ? (
            <section className="admin-card">
              <div className="admin-card-header split">
                <h2><i className="fa-solid fa-list"></i> Daftar Berita</h2>
                <button className="admin-blue-button compact" type="button" onClick={() => setAdminSection('write-news')}>Tambah Baru</button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Judul Berita</th>
                      <th>Kategori</th>
                      <th>Tanggal</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {news.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td><strong>{item.title}</strong></td>
                        <td><span className="admin-badge">{item.category}</span></td>
                        <td>{item.date}</td>
                        <td>
                          <button className="icon-danger" type="button" onClick={() => remove('news', item.id)} aria-label={`Hapus ${item.title}`}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!news.length ? <p className="admin-empty">Belum ada berita tersimpan.</p> : null}
              </div>
            </section>
          ) : null}

          {adminSection === 'documents' ? (
            <section className="admin-card">
              <div className="admin-card-header">
                <h2><i className="fa-solid fa-file-arrow-up"></i> Upload Dokumen Publik</h2>
                <p>Unggah dokumen resmi seperti laporan, peraturan, formulir, atau transparansi anggaran.</p>
              </div>
              <form className="admin-form" onSubmit={submitDocument}>
                <label>
                  <span className="field-label">Nama / Judul Dokumen <span>*</span></span>
                  <input placeholder="Masukkan nama dokumen..." value={documentForm.title} onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })} required />
                </label>
                <div className="form-row">
                  <label>
                    <span className="field-label">Kategori Dokumen <span>*</span></span>
                    <select value={documentForm.category} onChange={(e) => setDocumentForm({ ...documentForm, category: e.target.value })}>
                      <option>Laporan Kinerja Camat</option>
                      <option>Peraturan Kecamatan</option>
                      <option>Formulir Layanan Warga</option>
                      <option>Transparansi Anggaran</option>
                      <option>Lainnya</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Tahun <span>*</span></span>
                    <input value={documentForm.year} onChange={(e) => setDocumentForm({ ...documentForm, year: e.target.value })} required />
                  </label>
                </div>
                <label>
                  <span className="field-label">Deskripsi <span>*</span></span>
                  <textarea placeholder="Tulis deskripsi dokumen..." value={documentForm.description} onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })} required />
                </label>
                <label>
                  <span className="field-label">File Dokumen <span>*</span></span>
                  <span className="admin-file-box">
                    <i className="fa-solid fa-file-pdf"></i>
                    <strong>{documentForm.file ? documentForm.file.name : 'Pilih file dokumen'}</strong>
                    <small>PDF, DOC, DOCX, XLS, XLSX - maksimal 10 MB</small>
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setDocumentForm({ ...documentForm, file: e.target.files[0] })} required />
                  </span>
                </label>
                <div className="admin-form-actions">
                  <button type="button" onClick={() => setDocumentForm(emptyDocument)}>Batal</button>
                  <button className="admin-blue-button" type="submit"><i className="fa-solid fa-upload"></i> Upload Dokumen</button>
                </div>
              </form>

              <div className="admin-document-list">
                <h3>Dokumen Tersimpan</h3>
                {documents.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.category} · {item.year}</span>
                    </div>
                    <button className="icon-danger" type="button" onClick={() => remove('documents', item.id)} aria-label={`Hapus ${item.title}`}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </article>
                ))}
                {!documents.length ? <p className="admin-empty">Belum ada dokumen tersimpan.</p> : null}
              </div>
            </section>
          ) : null}

          {adminSection === 'surveys' ? (
            <section className="admin-card admin-survey-section">
              <div className="admin-card-header split">
                <div>
                  <h2><i className="fa-solid fa-square-poll-vertical"></i> Hasil Survei Masyarakat</h2>
                  <p>Rekap penilaian pelayanan yang dikirim melalui website.</p>
                </div>
                <button className="admin-blue-button compact" type="button" onClick={loadSurveys} disabled={surveyStatus.loading}>
                  <i className="fa-solid fa-rotate"></i> Perbarui
                </button>
              </div>

              <div className="admin-survey-stats">
                {[
                  ['fa-solid fa-users', 'Total Respons', surveys.length.toString()],
                  ['fa-solid fa-star', 'Kepuasan', averageRating('overallRating')],
                  ['fa-solid fa-list-check', 'Kemudahan', averageRating('easeRating')],
                  ['fa-solid fa-stopwatch', 'Kecepatan', averageRating('speedRating')],
                  ['fa-solid fa-handshake-angle', 'Sikap Petugas', averageRating('staffRating')]
                ].map(([icon, label, value]) => (
                  <article key={label}>
                    <i className={icon}></i>
                    <div><span>{label}</span><strong>{value}{label === 'Total Respons' ? '' : ' / 5'}</strong></div>
                  </article>
                ))}
              </div>

              {surveyStatus.error ? <p className="admin-survey-error">{surveyStatus.error}</p> : null}

              <div className="admin-table-wrap">
                <table className="admin-data-table admin-survey-table">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Responden</th>
                      <th>Jenis Layanan</th>
                      <th>Penilaian</th>
                      <th>Saran / Masukan</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveys.map((survey) => (
                      <tr key={survey.id}>
                        <td>{new Date(survey.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td><strong>{survey.respondentName || 'Anonim'}</strong></td>
                        <td>{survey.serviceType}</td>
                        <td>
                          <div className="admin-rating-list">
                            <span>Kepuasan <strong>{survey.overallRating}/5</strong></span>
                            <span>Kemudahan <strong>{survey.easeRating}/5</strong></span>
                            <span>Kecepatan <strong>{survey.speedRating}/5</strong></span>
                            <span>Petugas <strong>{survey.staffRating}/5</strong></span>
                          </div>
                        </td>
                        <td className="admin-survey-feedback">{survey.feedback || '-'}</td>
                        <td>
                          <button className="icon-danger" type="button" onClick={() => remove('surveys', survey.id)} aria-label={`Hapus survei ${survey.respondentName || 'Anonim'}`}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!surveyStatus.loading && !surveys.length ? <p className="admin-empty">Belum ada survei yang masuk.</p> : null}
                {surveyStatus.loading ? <p className="admin-empty">Memuat hasil survei...</p> : null}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;

