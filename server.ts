import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createInitialState } from './src/server/seedData.ts';
import {
  Anggota,
  AuditLog,
  CooperativeState,
  PengaturanSistem,
  Pengguna,
  Role,
} from './src/types/lumbung.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'lumbung-db.json');
const AUTH_FILE = path.resolve(DATA_DIR, 'lumbung-auth.json');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 jam

interface CredentialRecord {
  userId: string;
  salt: string;
  hash: string;
  updatedAt: string;
}

interface AuthStore {
  credentials: Record<string, CredentialRecord>; // keyed by userId
}

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const normalizeDb = (state: CooperativeState): CooperativeState => {
  if (!Array.isArray(state.pengguna)) state.pengguna = [];
  for (const u of state.pengguna) {
    if (!u.username) {
      if (u.id === 'usr-petugas') {
        u.username = 'operator';
        u.peran = 'Operator';
        u.jabatanDetail = 'Operator Loket (Transaksi Cepat & Input Anggota)';
      } else if (u.id === 'usr-anggota-1') {
        u.username = 'sitiaminah';
      } else {
        u.username = u.peran.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    }
  }
  return state;
};

const loadDb = (): CooperativeState => {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return normalizeDb(JSON.parse(raw) as CooperativeState);
  } catch {
    const initial = createInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
};

const loadAuth = (): AuthStore => {
  ensureDataDir();
  if (!fs.existsSync(AUTH_FILE)) {
    const empty: AuthStore = { credentials: {} };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AuthStore;
    return parsed && typeof parsed.credentials === 'object' ? parsed : { credentials: {} };
  } catch {
    return { credentials: {} };
  }
};

let db: CooperativeState = loadDb();
let authStore: AuthStore = loadAuth();

const saveDb = () => {
  ensureDataDir();
  const tempFile = path.resolve(DATA_DIR, `lumbung-db.${process.pid}.tmp`);
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
};

const saveAuth = () => {
  ensureDataDir();
  const tempFile = path.resolve(DATA_DIR, `lumbung-auth.${process.pid}.tmp`);
  fs.writeFileSync(tempFile, JSON.stringify(authStore, null, 2), 'utf-8');
  fs.renameSync(tempFile, AUTH_FILE);
};

// Password Hashing (scrypt + timingSafeEqual)
const hashPassword = (password: string): { salt: string; hash: string } => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
};

const verifyPassword = (password: string, salt: string, expectedHash: string): boolean => {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
};

const verifyConstantTimeString = (input: string, expected: string): boolean => {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

// Signed Bearer Token
const signSessionToken = (user: Pengguna): string => {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      peran: user.peran,
      exp: Date.now() + TOKEN_TTL_MS,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};

const verifySessionToken = (token: string): { sub: string; peran: Role; exp: number } | null => {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub: string;
      peran: Role;
      exp: number;
    };
    if (!parsed.sub || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getEnvAdminPasscode = () => (process.env.ADMIN_PASSCODE || '').trim();

const hasClaimedAdminCredential = (): boolean => {
  const adminUsers = db.pengguna.filter((u) => u.peran === 'Admin' && u.status === 'Aktif');
  return adminUsers.some((u) => Boolean(authStore.credentials[u.id]));
};

const nowIso = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const addAudit = (
  user: Pengguna,
  aksi: string,
  objek: string,
  nilaiLama: string,
  nilaiBaru: string
) => {
  const entry: AuditLog = {
    id: uid('aud'),
    waktu: nowIso(),
    penggunaNama: user.nama,
    penggunaPeran: user.peran,
    aksi,
    objek,
    nilaiLama,
    nilaiBaru,
  };
  db.auditLog.unshift(entry);
};

const syncKomoditasTotals = () => {
  for (const kom of db.komoditas) {
    const total = db.stokBatches
      .filter((b) => b.komoditasId === kom.id)
      .reduce((sum, b) => sum + b.jumlahSisa, 0);
    kom.stokTotal = Math.round(total * 100) / 100;
  }
};

const deductStockFefo = (
  komoditasId: string,
  qtyNeeded: number,
  refCode: string,
  petugasNama: string,
  tipe: 'Keluar' | 'Darurat' | 'Penyusutan' = 'Keluar',
  catatan?: string
) => {
  const batches = db.stokBatches
    .filter((b) => b.komoditasId === komoditasId && b.jumlahSisa > 0)
    .sort((a, b) => a.tanggalKedaluwarsa.localeCompare(b.tanggalKedaluwarsa));

  const totalAvail = batches.reduce((s, b) => s + b.jumlahSisa, 0);
  if (totalAvail < qtyNeeded) {
    throw new Error(`Stok gudang tidak mencukupi (tersedia ${totalAvail}, diminta ${qtyNeeded}).`);
  }

  let remaining = qtyNeeded;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.jumlahSisa, remaining);
    batch.jumlahSisa = Math.round((batch.jumlahSisa - take) * 100) / 100;
    remaining = Math.round((remaining - take) * 100) / 100;

    db.stokMutasi.unshift({
      id: uid('mut'),
      komoditasId,
      komoditasNama: batch.komoditasNama,
      satuan: batch.satuan,
      tipe,
      jumlah: take,
      kodeBatch: batch.kodeBatch,
      tanggalKedaluwarsa: batch.tanggalKedaluwarsa,
      referensiTransaksi: refCode,
      tanggal: todayStr(),
      petugasNama,
      catatan,
    });
  }
  syncKomoditasTotals();
};

const recalculateAnggotaScore = (anggota: Anggota) => {
  const joinYear = new Date(anggota.tanggalBergabung).getFullYear();
  const tenureMonths = Math.max(
    1,
    (2026 - joinYear) * 12 + (11 - new Date(anggota.tanggalBergabung).getMonth())
  );
  const tenureScore = Math.min(30, tenureMonths * 2);
  const simpananScore = Math.min(35, Math.floor((anggota.saldoSimpananRp / 500000) * 35));
  const payScore = Math.round((anggota.ketepatanBayarPersen / 100) * 35);
  const score = Math.min(100, Math.max(20, tenureScore + simpananScore + payScore));
  anggota.skorKelayakan = score;

  const minPlafon = db.pengaturan.plafonAwalRp;
  const maxPlafon = db.pengaturan.plafonMaksimalRp;
  const step =
    Math.round((minPlafon + ((score - 40) / 60) * (maxPlafon - minPlafon)) / 50000) * 50000;
  anggota.plafonAktifRp = Math.min(maxPlafon, Math.max(minPlafon, step));
};

interface AuthRequest extends Request {
  activeUser?: Pengguna;
}

const requireUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = String(req.header('authorization') || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Sesi login tidak ditemukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const verified = verifySessionToken(match[1]);
  if (!verified) {
    res.status(401).json({ error: 'Sesi login telah berakhir atau tidak valid. Silakan login ulang.' });
    return;
  }
  const user = db.pengguna.find((u) => u.id === verified.sub && u.status === 'Aktif');
  if (!user) {
    res.status(401).json({ error: 'Akun pengguna tidak ditemukan atau sedang nonaktif.' });
    return;
  }
  req.activeUser = user;
  next();
};

const requireRoles = (allowed: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.activeUser;
    if (!user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (user.peran === 'Pengawas') {
      res.status(403).json({
        error:
          'Akses ditolak: Peran Pengawas bersifat hanya-lihat (read-only) untuk menjaga independensi audit.',
      });
      return;
    }
    if (user.peran === 'Admin') {
      next();
      return;
    }
    if (!allowed.includes(user.peran)) {
      res.status(403).json({
        error: `Akses ditolak untuk peran ${user.peran}. Tindakan ini hanya diizinkan untuk: ${allowed.join(', ')}.`,
      });
      return;
    }
    next();
  };
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Auth Status (public, safe metadata only)
  app.get('/api/auth/status', (_req, res) => {
    const envPasscodeActive = getEnvAdminPasscode().length > 0;
    const needsAdminSetup = !envPasscodeActive && !hasClaimedAdminCredential();
    const operatorConfigured = db.pengguna.some(
      (u) => u.peran === 'Operator' && u.status === 'Aktif' && Boolean(authStore.credentials[u.id])
    );
    const activeAccounts = db.pengguna
      .filter((u) => u.status === 'Aktif' && (Boolean(authStore.credentials[u.id]) || (u.peran === 'Admin' && envPasscodeActive)))
      .map((u) => ({ username: u.username, peran: u.peran, nama: u.nama }));

    res.json({
      needsAdminSetup,
      envPasscodeActive,
      operatorConfigured,
      activeAccounts,
    });
  });

  // One-time First-Run Admin Setup / Claim
  app.post('/api/auth/bootstrap-admin', (req, res) => {
    if (getEnvAdminPasscode().length > 0 || hasClaimedAdminCredential()) {
      res.status(403).json({
        error: 'Aktivasi awal Admin sudah dikunci. Silakan masuk menggunakan halaman login.',
      });
      return;
    }

    const {
      adminUsername,
      adminNama,
      adminPassword,
      operatorUsername,
      operatorNama,
      operatorPassword,
    } = req.body as {
      adminUsername?: string;
      adminNama?: string;
      adminPassword?: string;
      operatorUsername?: string;
      operatorNama?: string;
      operatorPassword?: string;
    };

    const cleanAdminUser = String(adminUsername || 'admin').trim().toLowerCase();
    const cleanAdminPass = String(adminPassword || '');
    if (!cleanAdminUser || cleanAdminPass.length < 6) {
      res.status(400).json({ error: 'Username Admin wajib diisi dan kata sandi minimal 6 karakter.' });
      return;
    }

    let adminAccount = db.pengguna.find((u) => u.peran === 'Admin');
    if (!adminAccount) {
      adminAccount = {
        id: 'usr-admin',
        username: cleanAdminUser,
        nama: String(adminNama || 'Admin Koperasi').trim(),
        peran: 'Admin',
        status: 'Aktif',
        loginTerakhir: nowIso(),
        jabatanDetail: 'Admin Sistem & Akses Penuh Koperasi',
      };
      db.pengguna.unshift(adminAccount);
    } else {
      adminAccount.username = cleanAdminUser;
      if (adminNama && String(adminNama).trim()) {
        adminAccount.nama = String(adminNama).trim();
      }
      adminAccount.status = 'Aktif';
      adminAccount.loginTerakhir = nowIso();
    }

    const adminHashed = hashPassword(cleanAdminPass);
    authStore.credentials[adminAccount.id] = {
      userId: adminAccount.id,
      salt: adminHashed.salt,
      hash: adminHashed.hash,
      updatedAt: nowIso(),
    };

    // Optional simultaneous Operator setup
    if (operatorPassword && String(operatorPassword).length > 0) {
      const cleanOpPass = String(operatorPassword);
      if (cleanOpPass.length < 6) {
        res.status(400).json({ error: 'Kata sandi Operator minimal 6 karakter.' });
        return;
      }
      const cleanOpUser = String(operatorUsername || 'operator').trim().toLowerCase();
      let opAccount = db.pengguna.find((u) => u.peran === 'Operator');
      if (!opAccount) {
        opAccount = {
          id: 'usr-operator',
          username: cleanOpUser,
          nama: String(operatorNama || 'Operator Loket').trim(),
          peran: 'Operator',
          status: 'Aktif',
          loginTerakhir: nowIso(),
          jabatanDetail: 'Operator Loket (Transaksi Cepat & Input Anggota)',
        };
        db.pengguna.push(opAccount);
      } else {
        opAccount.username = cleanOpUser;
        if (operatorNama && String(operatorNama).trim()) {
          opAccount.nama = String(operatorNama).trim();
        }
        opAccount.status = 'Aktif';
      }
      const opHashed = hashPassword(cleanOpPass);
      authStore.credentials[opAccount.id] = {
        userId: opAccount.id,
        salt: opHashed.salt,
        hash: opHashed.hash,
        updatedAt: nowIso(),
      };
    }

    addAudit(
      adminAccount,
      'Aktivasi Awal Sistem',
      `Admin (${adminAccount.username})`,
      '-',
      'Kredensial Admin berhasil diaktifkan'
    );
    saveAuth();
    saveDb();

    const token = signSessionToken(adminAccount);
    syncKomoditasTotals();
    res.json({ token, user: adminAccount, state: db });
  });

  // Login (username + password verified on server)
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = String(username || '').trim().toLowerCase();
    const pass = String(password || '');

    if (!cleanUser || !pass) {
      res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
      return;
    }

    const user = db.pengguna.find(
      (u) => u.username.toLowerCase() === cleanUser && u.status === 'Aktif'
    );
    if (!user) {
      res.status(401).json({ error: 'Username tidak ditemukan atau akun sedang nonaktif.' });
      return;
    }

    const envAdminCode = getEnvAdminPasscode();
    let valid = false;
    if (user.peran === 'Admin' && envAdminCode.length > 0) {
      valid = verifyConstantTimeString(pass, envAdminCode);
    } else {
      const cred = authStore.credentials[user.id];
      if (!cred) {
        res.status(401).json({
          error: 'Akun ini belum memiliki kata sandi. Hubungi Admin untuk mengatur kata sandi.',
        });
        return;
      }
      valid = verifyPassword(pass, cred.salt, cred.hash);
    }

    if (!valid) {
      res.status(401).json({ error: 'Username atau kata sandi salah.' });
      return;
    }

    user.loginTerakhir = nowIso();
    addAudit(user, 'Login Sistem', `${user.nama} (${user.peran})`, '-', 'Berhasil masuk');
    saveDb();

    const token = signSessionToken(user);
    syncKomoditasTotals();
    res.json({ token, user, state: db });
  });

  app.get('/api/auth/me', requireUser, (req: AuthRequest, res) => {
    res.json({ user: req.activeUser });
  });

  app.post('/api/auth/logout', requireUser, (req: AuthRequest, res) => {
    addAudit(req.activeUser!, 'Logout Sistem', `${req.activeUser!.nama} (${req.activeUser!.peran})`, '-', 'Keluar');
    saveDb();
    res.json({ ok: true });
  });

  // Protected State
  app.get('/api/state', requireUser, (req: AuthRequest, res) => {
    syncKomoditasTotals();
    const stateOut: CooperativeState = {
      ...db,
      pengguna: db.pengguna.map((u) => ({ ...u })),
    };
    res.json(stateOut);
  });

  // 1. Anggota (Admin & Operator can input anggota)
  app.post(
    '/api/anggota',
    requireUser,
    requireRoles(['Admin', 'Operator', 'Petugas', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const {
        nama,
        alamat,
        rtRw,
        hp,
        noIdentitas,
        kategori,
        penjaminNama,
        penjaminHp,
        simpananPokokRp,
        simpananWajibRp,
      } = req.body;
      if (!nama || !alamat || !rtRw || !hp) {
        res.status(400).json({ error: 'Nama, alamat, RT/RW, dan nomor HP wajib diisi.' });
        return;
      }
      const cleanId = String(noIdentitas || '').replace(/\s+/g, '');
      const masked =
        cleanId.length >= 8
          ? `${cleanId.slice(0, 4)}••••••••${cleanId.slice(-4)}`
          : '3510••••••••0000';

      const nextNum = db.anggota.length + 1;
      const nomorAnggota = `KKMP-SGT-2026-${String(nextNum).padStart(3, '0')}`;
      const newMember: Anggota = {
        id: uid('ang'),
        nomorAnggota,
        nama: String(nama).trim(),
        alamat: String(alamat).trim(),
        rtRw: String(rtRw).trim(),
        hp: String(hp).trim(),
        noIdentitasMask: masked,
        kategori: kategori === 'Petani' ? 'Petani' : 'Umum',
        status: 'Aktif',
        tanggalBergabung: todayStr(),
        penjaminNama: String(penjaminNama || 'Ketua RT setempat').trim(),
        penjaminHp: String(penjaminHp || '-').trim(),
        simpananPokokRp: Number(simpananPokokRp) || 100000,
        simpananWajibRp: Number(simpananWajibRp) || 20000,
        saldoSimpananKg: 0,
        saldoSimpananRp: 0,
        ketepatanBayarPersen: 100,
        skorKelayakan: 65,
        plafonAktifRp: db.pengaturan.plafonAwalRp,
      };
      db.anggota.unshift(newMember);
      const slug =
        newMember.nama
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 12) + nextNum;
      db.pengguna.push({
        id: uid('usr-ang'),
        username: slug,
        nama: newMember.nama,
        peran: 'Anggota',
        status: 'Aktif',
        loginTerakhir: nowIso(),
        jabatanDetail: `Anggota Koperasi · ${newMember.rtRw}`,
        linkedAnggotaId: newMember.id,
      });
      if (newMember.simpananPokokRp + newMember.simpananWajibRp > 0) {
        db.kasTransaksi.unshift({
          id: uid('kas'),
          tanggal: todayStr(),
          tipe: 'Masuk',
          kategori: 'Simpanan Pangan',
          jumlahRp: newMember.simpananPokokRp + newMember.simpananWajibRp,
          akun: 'Kas Loket Koperasi',
          referensi: nomorAnggota,
          statusPersetujuan: 'Disetujui',
          dibuatOleh: req.activeUser!.nama,
          disetujuiOleh: req.activeUser!.nama,
          catatan: `Simpanan pokok & wajib pendaftaran ${newMember.nama}`,
        });
      }
      addAudit(
        req.activeUser!,
        'Daftar Anggota Baru',
        `${nomorAnggota} (${newMember.nama})`,
        '-',
        'Aktif'
      );
      saveDb();
      res.json({ member: newMember, state: db });
    }
  );

  app.patch(
    '/api/anggota/:id/status',
    requireUser,
    requireRoles(['Admin', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const member = db.anggota.find((a) => a.id === req.params.id);
      if (!member) {
        res.status(404).json({ error: 'Anggota tidak ditemukan.' });
        return;
      }
      const oldStatus = member.status;
      member.status = req.body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
      addAudit(req.activeUser!, 'Ubah Status Anggota', member.nomorAnggota, oldStatus, member.status);
      saveDb();
      res.json({ member, state: db });
    }
  );

  // 2. Simpanan Pangan (Operator can use via Transaksi Cepat, Admin can use everywhere)
  app.post(
    '/api/simpanan',
    requireUser,
    requireRoles(['Admin', 'Operator', 'Petugas', 'Manajer', 'Bendahara', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { anggotaId, tipe, bentuk, jumlahInput, catatan } = req.body;
      const member = db.anggota.find((a) => a.id === anggotaId);
      if (!member) {
        res.status(404).json({ error: 'Anggota tidak ditemukan.' });
        return;
      }
      const berasAcuan =
        db.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000;
      const val = Number(jumlahInput);
      if (!Number.isFinite(val) || val <= 0) {
        res.status(400).json({ error: 'Jumlah setoran/pengambilan harus lebih besar dari 0.' });
        return;
      }
      const jumlahKg =
        bentuk === 'Beras'
          ? Math.round(val * 100) / 100
          : Math.round((val / berasAcuan) * 100) / 100;
      const nilaiRp = bentuk === 'Beras' ? Math.round(val * berasAcuan) : Math.round(val);

      if (tipe === 'Ambil') {
        if (member.saldoSimpananRp < nilaiRp || member.saldoSimpananKg < jumlahKg) {
          res
            .status(400)
            .json({ error: 'Saldo Simpanan Pangan anggota tidak mencukupi untuk pengambilan.' });
          return;
        }
        if (bentuk === 'Beras') {
          try {
            deductStockFefo(
              'kom-beras-med',
              jumlahKg,
              `AMB-${member.nomorAnggota}`,
              req.activeUser!.nama,
              'Keluar',
              `Pengambilan simpanan beras ${member.nama}`
            );
          } catch (err) {
            res.status(400).json({ error: (err as Error).message });
            return;
          }
        }
        member.saldoSimpananKg = Math.max(
          0,
          Math.round((member.saldoSimpananKg - jumlahKg) * 100) / 100
        );
        member.saldoSimpananRp = Math.max(0, member.saldoSimpananRp - nilaiRp);
      } else {
        if (bentuk === 'Beras') {
          const batchKode = `SMP-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Math.floor(10 + Math.random() * 89)}`;
          db.stokBatches.push({
            id: uid('btc'),
            kodeBatch: batchKode,
            komoditasId: 'kom-beras-med',
            komoditasNama: 'Beras Medium',
            satuan: 'kg',
            jumlahAwal: jumlahKg,
            jumlahSisa: jumlahKg,
            tanggalMasuk: todayStr(),
            tanggalKedaluwarsa: '2027-06-30',
            hargaPokok: berasAcuan,
          });
          db.stokMutasi.unshift({
            id: uid('mut'),
            komoditasId: 'kom-beras-med',
            komoditasNama: 'Beras Medium',
            satuan: 'kg',
            tipe: 'Masuk',
            jumlah: jumlahKg,
            kodeBatch: batchKode,
            referensiTransaksi: `SMP-${member.nomorAnggota}`,
            tanggal: todayStr(),
            petugasNama: req.activeUser!.nama,
            catatan: `Setoran simpanan beras oleh ${member.nama}`,
          });
          syncKomoditasTotals();
        } else {
          db.kasTransaksi.unshift({
            id: uid('kas'),
            tanggal: todayStr(),
            tipe: 'Masuk',
            kategori: 'Simpanan Pangan',
            jumlahRp: nilaiRp,
            akun: 'Kas Loket Koperasi',
            referensi: member.nomorAnggota,
            statusPersetujuan: 'Disetujui',
            dibuatOleh: req.activeUser!.nama,
            disetujuiOleh: req.activeUser!.nama,
            catatan: `Setoran tunai Simpanan Pangan ${member.nama}`,
          });
        }
        member.saldoSimpananKg = Math.round((member.saldoSimpananKg + jumlahKg) * 100) / 100;
        member.saldoSimpananRp += nilaiRp;
      }

      recalculateAnggotaScore(member);
      const entry = {
        id: uid('smp'),
        anggotaId: member.id,
        anggotaNama: member.nama,
        tipe: tipe === 'Ambil' ? ('Ambil' as const) : ('Setor' as const),
        bentuk: bentuk === 'Beras' ? ('Beras' as const) : ('Uang' as const),
        jumlahKg,
        nilaiRp,
        hargaBerasAcuan: berasAcuan,
        tanggal: todayStr(),
        petugasNama: req.activeUser!.nama,
        catatan: catatan || `${tipe} ${bentuk} Simpanan Pangan`,
      };
      db.simpananPangan.unshift(entry);
      addAudit(
        req.activeUser!,
        `Simpanan Pangan (${entry.tipe})`,
        member.nama,
        '-',
        `${entry.jumlahKg} kg / Rp${entry.nilaiRp.toLocaleString('id-ID')}`
      );
      saveDb();
      res.json({ entry, state: db });
    }
  );

  app.post(
    '/api/simpanan/bagi-imbalan',
    requireUser,
    requireRoles(['Admin', 'Bendahara', 'Pengurus']),
    (req: AuthRequest, res) => {
      const rate = db.pengaturan.imbalanSimpananPerBulanPersen / 100;
      const berasAcuan =
        db.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000;
      let totalImbalan = 0;
      let count = 0;
      for (const m of db.anggota) {
        if (m.status === 'Aktif' && m.saldoSimpananRp > 0) {
          const imbalanRp = Math.round(m.saldoSimpananRp * rate);
          const imbalanKg = Math.round((imbalanRp / berasAcuan) * 100) / 100;
          m.saldoSimpananRp += imbalanRp;
          m.saldoSimpananKg = Math.round((m.saldoSimpananKg + imbalanKg) * 100) / 100;
          totalImbalan += imbalanRp;
          count++;
          db.simpananPangan.unshift({
            id: uid('smp'),
            anggotaId: m.id,
            anggotaNama: m.nama,
            tipe: 'Imbalan',
            bentuk: 'Uang',
            jumlahKg: imbalanKg,
            nilaiRp: imbalanRp,
            hargaBerasAcuan: berasAcuan,
            tanggal: todayStr(),
            petugasNama: req.activeUser!.nama,
            catatan: `Imbalan Simpanan Pangan ${db.pengaturan.imbalanSimpananPerBulanPersen}%/bulan`,
          });
        }
      }
      addAudit(
        req.activeUser!,
        'Pembukuan Imbalan Simpanan',
        `${count} Anggota`,
        '-',
        `Total Rp${totalImbalan.toLocaleString('id-ID')}`
      );
      saveDb();
      res.json({ count, totalImbalan, state: db });
    }
  );

  // 3. Pinjaman Pangan (Operator excluded)
  app.post(
    '/api/pinjaman',
    requireUser,
    requireRoles(['Admin', 'Anggota', 'Petugas', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { anggotaId, items, tenorBulan, catatan } = req.body as {
        anggotaId: string;
        items: { komoditasId: string; jumlah: number }[];
        tenorBulan: number;
        catatan?: string;
      };

      const user = req.activeUser!;
      if (user.peran === 'Anggota' && user.linkedAnggotaId !== anggotaId) {
        res.status(403).json({ error: 'Anggota hanya dapat mengajukan pinjaman atas nama diri sendiri.' });
        return;
      }

      const member = db.anggota.find((a) => a.id === anggotaId);
      if (!member) {
        res.status(404).json({ error: 'Anggota tidak ditemukan.' });
        return;
      }
      if (member.status !== 'Aktif') {
        res.status(400).json({ error: 'Status anggota nonaktif. Tidak dapat mengajukan pinjaman.' });
        return;
      }

      const hasOverdue = db.pinjaman.some(
        (p) =>
          p.anggotaId === member.id && (p.status === 'Terlambat' || p.status === 'Bermasalah')
      );
      if (hasOverdue) {
        res.status(400).json({
          error: 'Anggota masih memiliki pinjaman terlambat/bermasalah. Selesaikan tunggakan terlebih dahulu.',
        });
        return;
      }

      const maxTenor =
        member.kategori === 'Petani'
          ? db.pengaturan.tenorMaksPetaniBulan
          : db.pengaturan.tenorMaksUmumBulan;
      const tenor = Number(tenorBulan);
      if (!Number.isInteger(tenor) || tenor < 1 || tenor > maxTenor) {
        res.status(400).json({
          error: `Tenor harus antara 1 sampai ${maxTenor} bulan untuk kategori ${member.kategori}.`,
        });
        return;
      }

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Pilih minimal satu bahan pokok untuk dipinjam.' });
        return;
      }

      const lockedItems = [];
      let nilaiPinjamanRp = 0;

      for (const reqItem of items) {
        const qty = Number(reqItem.jumlah);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const kom = db.komoditas.find((k) => k.id === reqItem.komoditasId);
        const harga = db.hargaAcuan.find((h) => h.komoditasId === reqItem.komoditasId);
        if (!kom || !harga) {
          res.status(400).json({ error: 'Komoditas atau harga acuan tidak ditemukan.' });
          return;
        }
        if (kom.stokTotal < qty) {
          res.status(400).json({ error: `Stok ${kom.nama} hanya tersisa ${kom.stokTotal} ${kom.satuan}.` });
          return;
        }
        const subtotal = Math.round(qty * harga.harga);
        nilaiPinjamanRp += subtotal;
        lockedItems.push({
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          jumlah: qty,
          hargaSaatTransaksi: harga.harga,
          subtotalRp: subtotal,
        });
      }

      if (lockedItems.length === 0) {
        res.status(400).json({ error: 'Jumlah barang pinjaman tidak valid.' });
        return;
      }

      const activeExposure = db.pinjaman
        .filter(
          (p) =>
            p.anggotaId === member.id &&
            ['Diajukan', 'Disetujui', 'Berjalan', 'Terlambat', 'Dijadwalkan Ulang'].includes(
              p.status
            )
        )
        .reduce((s, p) => s + p.nilaiPinjamanRp, 0);

      if (activeExposure + nilaiPinjamanRp > member.plafonAktifRp) {
        res.status(400).json({
          error: `Melebihi plafon anggota (Plafon: Rp${member.plafonAktifRp.toLocaleString('id-ID')}, pinjaman aktif: Rp${activeExposure.toLocaleString('id-ID')}).`,
        });
        return;
      }

      const tarif = db.pengaturan.tarifJasaPerBulanPersen;
      const jasaRp = Math.round(nilaiPinjamanRp * (tarif / 100) * tenor);
      const totalKembaliRp = nilaiPinjamanRp + jasaRp;

      const due = new Date();
      due.setMonth(due.getMonth() + tenor);
      const kodePinjaman = `PJM-2026-${String(db.pinjaman.length + 11).padStart(3, '0')}`;
      const wajibPenjamin = nilaiPinjamanRp > db.pengaturan.batasPersetujuanManajerRp;

      const newLoan = {
        id: uid('pjm'),
        kodePinjaman,
        anggotaId: member.id,
        anggotaNama: member.nama,
        tanggalPengajuan: todayStr(),
        tanggalJatuhTempo: due.toISOString().slice(0, 10),
        items: lockedItems,
        nilaiPinjamanRp,
        tarifJasaPersen: tarif,
        tenorBulan: tenor,
        jasaRp,
        totalKembaliRp,
        sudahDibayarRp: 0,
        sisaTagihanRp: totalKembaliRp,
        status: 'Diajukan' as const,
        wajibPenjamin,
        penjaminNama: member.penjaminNama,
        penjaminKonfirmasi: !wajibPenjamin,
        catatan: catatan || '',
      };

      db.pinjaman.unshift(newLoan);
      addAudit(
        user,
        'Pengajuan Pinjaman Pangan',
        `${kodePinjaman} (${member.nama})`,
        '-',
        `Rp${nilaiPinjamanRp.toLocaleString('id-ID')} (${tenor} bln)`
      );
      saveDb();
      res.json({ loan: newLoan, state: db });
    }
  );

  app.post(
    '/api/pinjaman/:id/konfirmasi-penjamin',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer', 'Pengurus', 'Anggota']),
    (req: AuthRequest, res) => {
      const loan = db.pinjaman.find((p) => p.id === req.params.id);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      loan.penjaminKonfirmasi = true;
      addAudit(
        req.activeUser!,
        'Konfirmasi Penjamin',
        loan.kodePinjaman,
        'Menunggu Penjamin',
        `Terkonfirmasi (${loan.penjaminNama})`
      );
      saveDb();
      res.json({ loan, state: db });
    }
  );

  app.post(
    '/api/pinjaman/:id/keputusan',
    requireUser,
    requireRoles(['Admin', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const loan = db.pinjaman.find((p) => p.id === req.params.id);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      if (loan.status !== 'Diajukan') {
        res.status(400).json({ error: 'Hanya pinjaman berstatus Diajukan yang dapat diproses persetujuannya.' });
        return;
      }
      const { keputusan, catatan } = req.body as {
        keputusan: 'Disetujui' | 'Ditolak';
        catatan?: string;
      };
      const user = req.activeUser!;
      const batas = db.pengaturan.batasPersetujuanManajerRp;

      if (keputusan === 'Disetujui' && user.peran !== 'Admin') {
        if (loan.nilaiPinjamanRp <= batas && user.peran !== 'Manajer' && user.peran !== 'Pengurus') {
          res.status(403).json({
            error: 'Persetujuan pinjaman sampai batas wewenang dilakukan oleh Manajer Unit.',
          });
          return;
        }
        if (loan.nilaiPinjamanRp > batas && user.peran !== 'Pengurus') {
          res.status(403).json({
            error: `Nilai pinjaman Rp${loan.nilaiPinjamanRp.toLocaleString('id-ID')} melebihi batas Manajer (Rp${batas.toLocaleString('id-ID')}). Wajib disetujui oleh Pengurus.`,
          });
          return;
        }
        if (loan.wajibPenjamin && !loan.penjaminKonfirmasi) {
          res.status(400).json({ error: 'Penjamin belum mengonfirmasi jaminan pinjaman ini.' });
          return;
        }
      }

      const oldStatus = loan.status;
      loan.status = keputusan;
      loan.tanggalDisetujui = todayStr();
      loan.penyetujuNama = user.nama;
      loan.penyetujuPeran = user.peran;
      if (catatan) loan.catatan = catatan;

      if (keputusan === 'Disetujui') {
        const member = db.anggota.find((a) => a.id === loan.anggotaId);
        db.notifikasi.unshift({
          id: uid('ntf'),
          tanggal: nowIso(),
          judul: `Pinjaman Disetujui (${loan.kodePinjaman})`,
          isi: `Halo ${loan.anggotaNama}, pengajuan pinjaman pangan Anda sebesar Rp${loan.nilaiPinjamanRp.toLocaleString('id-ID')} telah disetujui. Silakan ambil barang di kantor koperasi pada ${db.pengaturan.jamLayanan}.`,
          kanal: 'WhatsApp',
          tujuan: `${loan.anggotaNama} (${member?.hp || '-'})`,
          statusKirim: 'Terkirim',
          dibuatOleh: user.nama,
        });
      }

      addAudit(
        user,
        `Keputusan Pinjaman (${keputusan})`,
        loan.kodePinjaman,
        oldStatus,
        `${keputusan} oleh ${user.nama}`
      );
      saveDb();
      res.json({ loan, state: db });
    }
  );

  // Serah Terima Barang (Transaksi Cepat -> Operator & Admin allowed)
  app.post(
    '/api/pinjaman/:id/serah-terima',
    requireUser,
    requireRoles(['Admin', 'Operator', 'Petugas']),
    (req: AuthRequest, res) => {
      const loan = db.pinjaman.find((p) => p.id === req.params.id);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      if (loan.status !== 'Disetujui') {
        res.status(400).json({ error: 'Pinjaman harus berstatus Disetujui sebelum barang diserahkan.' });
        return;
      }
      const user = req.activeUser!;
      if (user.peran !== 'Admin' && loan.penyetujuNama === user.nama) {
        res.status(403).json({
          error: 'Pemisahan tugas: Yang menyetujui pinjaman tidak dapat sekaligus menyerahkan barang.',
        });
        return;
      }

      try {
        for (const item of loan.items) {
          deductStockFefo(
            item.komoditasId,
            item.jumlah,
            loan.kodePinjaman,
            user.nama,
            'Keluar',
            `Serah terima pinjaman pangan ${loan.anggotaNama}`
          );
        }
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      loan.status = 'Berjalan';
      loan.tanggalSerahTerima = todayStr();
      loan.petugasSerahNama = user.nama;

      addAudit(
        user,
        'Serah Terima Barang Pinjaman',
        loan.kodePinjaman,
        'Disetujui',
        `Berjalan (Diserahkan oleh ${user.nama})`
      );
      saveDb();
      res.json({ loan, state: db });
    }
  );

  // Angsuran (Transaksi Cepat -> Operator & Admin allowed)
  app.post(
    '/api/pinjaman/:id/angsuran',
    requireUser,
    requireRoles(['Admin', 'Operator', 'Petugas', 'Bendahara']),
    (req: AuthRequest, res) => {
      const loan = db.pinjaman.find((p) => p.id === req.params.id);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      if (!['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(loan.status)) {
        res.status(400).json({ error: 'Pinjaman belum berjalan atau sudah lunas.' });
        return;
      }

      const { metode, jumlahRp, barangKomoditasId, barangJumlah, catatan } = req.body;
      const user = req.activeUser!;
      let nilaiBayar = Number(jumlahRp) || 0;
      let barangDetail:
        | {
            komoditasId: string;
            komoditasNama: string;
            satuan: string;
            jumlah: number;
            hargaKonversi: number;
          }
        | undefined;

      if (metode === 'Barang Setara') {
        const kom = db.komoditas.find((k) => k.id === barangKomoditasId);
        const harga = db.hargaAcuan.find((h) => h.komoditasId === barangKomoditasId);
        const qty = Number(barangJumlah);
        if (!kom || !harga || !Number.isFinite(qty) || qty <= 0) {
          res.status(400).json({ error: 'Pilih komoditas dan jumlah barang pengembalian yang valid.' });
          return;
        }
        nilaiBayar = Math.round(qty * harga.harga);
        barangDetail = {
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          jumlah: qty,
          hargaKonversi: harga.harga,
        };
        const batchKode = `ANG-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Math.floor(10 + Math.random() * 89)}`;
        db.stokBatches.push({
          id: uid('btc'),
          kodeBatch: batchKode,
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          jumlahAwal: qty,
          jumlahSisa: qty,
          tanggalMasuk: todayStr(),
          tanggalKedaluwarsa: '2027-06-30',
          hargaPokok: harga.harga,
        });
        db.stokMutasi.unshift({
          id: uid('mut'),
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          tipe: 'Masuk',
          jumlah: qty,
          kodeBatch: batchKode,
          referensiTransaksi: loan.kodePinjaman,
          tanggal: todayStr(),
          petugasNama: user.nama,
          catatan: `Angsuran barang setara oleh ${loan.anggotaNama}`,
        });
        syncKomoditasTotals();
      } else {
        if (!Number.isFinite(nilaiBayar) || nilaiBayar <= 0) {
          res.status(400).json({ error: 'Nominal pembayaran harus lebih dari Rp0.' });
          return;
        }
        db.kasTransaksi.unshift({
          id: uid('kas'),
          tanggal: todayStr(),
          tipe: 'Masuk',
          kategori: 'Angsuran Pinjaman',
          jumlahRp: Math.min(nilaiBayar, loan.sisaTagihanRp),
          akun: metode === 'Transfer' ? 'Rekening Bank Jatim KKMP' : 'Kas Loket Koperasi',
          referensi: loan.kodePinjaman,
          statusPersetujuan: 'Disetujui',
          dibuatOleh: user.nama,
          disetujuiOleh: user.nama,
          catatan: `Angsuran ${metode} pinjaman ${loan.kodePinjaman} (${loan.anggotaNama})`,
        });
      }

      const applied = Math.min(nilaiBayar, loan.sisaTagihanRp);
      const oldSisa = loan.sisaTagihanRp;
      loan.sudahDibayarRp += applied;
      loan.sisaTagihanRp = Math.max(0, loan.totalKembaliRp - loan.sudahDibayarRp);
      if (loan.sisaTagihanRp === 0) {
        loan.status = 'Lunas';
      }

      const nomorKuitansi = `KWT-2026-${String(db.angsuran.length + 89).padStart(3, '0')}`;
      const payment = {
        id: uid('angsr'),
        nomorKuitansi,
        pinjamanId: loan.id,
        kodePinjaman: loan.kodePinjaman,
        anggotaId: loan.anggotaId,
        anggotaNama: loan.anggotaNama,
        tanggal: todayStr(),
        metode: metode as 'Tunai' | 'Transfer' | 'Barang Setara',
        jumlahRp: applied,
        barangDetail,
        petugasNama: user.nama,
        catatan: catatan || '',
      };
      db.angsuran.unshift(payment);

      const member = db.anggota.find((a) => a.id === loan.anggotaId);
      if (member) {
        if (loan.status === 'Lunas') {
          member.ketepatanBayarPersen = Math.min(100, member.ketepatanBayarPersen + 2);
        }
        recalculateAnggotaScore(member);
      }

      addAudit(
        user,
        `Pembayaran Angsuran (${metode})`,
        `${loan.kodePinjaman} · ${nomorKuitansi}`,
        `Sisa Rp${oldSisa.toLocaleString('id-ID')}`,
        `Sisa Rp${loan.sisaTagihanRp.toLocaleString('id-ID')} (${loan.status})`
      );
      saveDb();
      res.json({ payment, loan, state: db });
    }
  );

  // 4. Paket Sembako Cicil (Operator excluded)
  app.post(
    '/api/paket-sembako',
    requireUser,
    requireRoles(['Admin', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { nama, deskripsi, isi, marginPersen } = req.body;
      const margin = Number(marginPersen);
      if (!nama || !Array.isArray(isi) || isi.length === 0) {
        res.status(400).json({ error: 'Nama dan rincian isi paket sembako wajib diisi.' });
        return;
      }
      if (!Number.isFinite(margin) || margin < 0 || margin > db.pengaturan.marginMaksPaketPersen) {
        res.status(400).json({
          error: `Margin paket tidak boleh melebihi batas maksimal ${db.pengaturan.marginMaksPaketPersen}%.`,
        });
        return;
      }
      let hargaPokokRp = 0;
      const items = [];
      for (const row of isi) {
        const kom = db.komoditas.find((k) => k.id === row.komoditasId);
        const hrg = db.hargaAcuan.find((h) => h.komoditasId === row.komoditasId);
        if (!kom || !hrg) continue;
        const qty = Number(row.jumlah) || 1;
        hargaPokokRp += Math.round(qty * hrg.harga * 0.94);
        items.push({ komoditasId: kom.id, komoditasNama: kom.nama, jumlah: qty, satuan: kom.satuan });
      }
      const hargaJualRp = Math.round((hargaPokokRp * (1 + margin / 100)) / 500) * 500;
      const newPaket = {
        id: uid('pkt'),
        nama: String(nama).trim(),
        deskripsi: String(deskripsi || 'Paket bahan pokok hemat KKMP Singotrunan').trim(),
        isi: items,
        hargaPokokRp,
        marginPersen: margin,
        hargaJualRp,
        gambarUrl: '/src/assets/images/paket_sembako_hemat_1795507216815.jpg',
        aktif: true,
      };
      db.paketSembako.push(newPaket);
      addAudit(
        req.activeUser!,
        'Tambah Katalog Paket Sembako',
        newPaket.nama,
        '-',
        `Rp${hargaJualRp.toLocaleString('id-ID')} (Margin ${margin}%)`
      );
      saveDb();
      res.json({ paket: newPaket, state: db });
    }
  );

  app.post(
    '/api/pesanan-paket',
    requireUser,
    requireRoles(['Admin', 'Anggota', 'Petugas', 'Manajer']),
    (req: AuthRequest, res) => {
      const { anggotaId, paketId, tenorMingguan } = req.body;
      const user = req.activeUser!;
      if (user.peran === 'Anggota' && user.linkedAnggotaId !== anggotaId) {
        res.status(403).json({ error: 'Anggota hanya dapat memesan paket untuk akun sendiri.' });
        return;
      }
      const member = db.anggota.find((a) => a.id === anggotaId);
      const paket = db.paketSembako.find((p) => p.id === paketId);
      if (!member || !paket) {
        res.status(404).json({ error: 'Anggota atau paket sembako tidak ditemukan.' });
        return;
      }
      const activePaketCount = db.pesananPaket.filter(
        (o) => o.anggotaId === member.id && o.status === 'Aktif'
      ).length;
      if (activePaketCount >= db.pengaturan.maksPaketAktifPerAnggota) {
        res.status(400).json({
          error: `Batas tercapai: Maksimal ${db.pengaturan.maksPaketAktifPerAnggota} paket sembako cicil aktif per anggota.`,
        });
        return;
      }

      const weeks: 4 | 8 = tenorMingguan === 8 ? 8 : 4;
      const perMinggu = Math.ceil(paket.hargaJualRp / weeks);
      const kodePesanan = `PKT-2026-${String(db.pesananPaket.length + 42).padStart(3, '0')}`;

      try {
        for (const item of paket.isi) {
          deductStockFefo(
            item.komoditasId,
            item.jumlah,
            kodePesanan,
            user.nama,
            'Keluar',
            `Pengambilan ${paket.nama} (${member.nama})`
          );
        }
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const jadwal = [];
      for (let i = 1; i <= weeks; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i * 7);
        jadwal.push({
          ke: i,
          jatuhTempo: d.toISOString().slice(0, 10),
          jumlahRp: perMinggu,
          lunas: false,
        });
      }

      const order = {
        id: uid('ord'),
        kodePesanan,
        anggotaId: member.id,
        anggotaNama: member.nama,
        paketId: paket.id,
        paketNama: paket.nama,
        hargaJualRp: paket.hargaJualRp,
        tenorMingguan: weeks,
        cicilanPerMingguRp: perMinggu,
        sudahDibayarRp: 0,
        sisaTagihanRp: paket.hargaJualRp,
        jadwalCicilan: jadwal,
        status: 'Aktif' as const,
        tanggalPesan: todayStr(),
      };

      db.pesananPaket.unshift(order);
      addAudit(
        user,
        'Pesan Paket Sembako Cicil',
        `${kodePesanan} (${member.nama})`,
        '-',
        `${paket.nama} · ${weeks} minggu`
      );
      saveDb();
      res.json({ order, state: db });
    }
  );

  app.post(
    '/api/pesanan-paket/:id/bayar-cicilan',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Bendahara']),
    (req: AuthRequest, res) => {
      const order = db.pesananPaket.find((o) => o.id === req.params.id);
      if (!order || order.status === 'Lunas') {
        res.status(404).json({ error: 'Pesanan paket tidak ditemukan atau sudah lunas.' });
        return;
      }
      const nextSlot = order.jadwalCicilan.find((j) => !j.lunas);
      if (!nextSlot) {
        order.status = 'Lunas';
        order.sisaTagihanRp = 0;
        saveDb();
        res.json({ order, state: db });
        return;
      }
      nextSlot.lunas = true;
      nextSlot.tanggalBayar = todayStr();
      order.sudahDibayarRp += nextSlot.jumlahRp;
      order.sisaTagihanRp = Math.max(0, order.hargaJualRp - order.sudahDibayarRp);
      if (order.jadwalCicilan.every((j) => j.lunas) || order.sisaTagihanRp === 0) {
        order.status = 'Lunas';
        order.sisaTagihanRp = 0;
      }

      db.kasTransaksi.unshift({
        id: uid('kas'),
        tanggal: todayStr(),
        tipe: 'Masuk',
        kategori: 'Cicilan Paket Sembako',
        jumlahRp: nextSlot.jumlahRp,
        akun: 'Kas Loket Koperasi',
        referensi: order.kodePesanan,
        statusPersetujuan: 'Disetujui',
        dibuatOleh: req.activeUser!.nama,
        disetujuiOleh: req.activeUser!.nama,
        catatan: `Cicilan minggu ke-${nextSlot.ke} ${order.paketNama} (${order.anggotaNama})`,
      });

      addAudit(
        req.activeUser!,
        'Bayar Cicilan Paket Sembako',
        `${order.kodePesanan} (Minggu ${nextSlot.ke})`,
        `Sisa Rp${(order.sisaTagihanRp + nextSlot.jumlahRp).toLocaleString('id-ID')}`,
        `Sisa Rp${order.sisaTagihanRp.toLocaleString('id-ID')}`
      );
      saveDb();
      res.json({ order, state: db });
    }
  );

  // 5. Stok & Gudang (Operator excluded)
  app.post(
    '/api/stok/mutasi',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer']),
    (req: AuthRequest, res) => {
      const { komoditasId, tipe, jumlah, kodeBatch, tanggalKedaluwarsa, hargaPokok, catatan } =
        req.body;
      const kom = db.komoditas.find((k) => k.id === komoditasId);
      const qty = Number(jumlah);
      if (!kom || !Number.isFinite(qty) || qty <= 0) {
        res.status(400).json({ error: 'Komoditas dan jumlah stok harus valid.' });
        return;
      }

      const user = req.activeUser!;
      if (tipe === 'Masuk') {
        const batchCode =
          kodeBatch ||
          `GDG-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Math.floor(10 + Math.random() * 89)}`;
        const exp = tanggalKedaluwarsa || '2027-06-30';
        const cost =
          Number(hargaPokok) ||
          (db.hargaAcuan.find((h) => h.komoditasId === kom.id)?.harga || 10000) * 0.92;
        db.stokBatches.push({
          id: uid('btc'),
          kodeBatch: batchCode,
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          jumlahAwal: qty,
          jumlahSisa: qty,
          tanggalMasuk: todayStr(),
          tanggalKedaluwarsa: exp,
          hargaPokok: cost,
        });
        db.stokMutasi.unshift({
          id: uid('mut'),
          komoditasId: kom.id,
          komoditasNama: kom.nama,
          satuan: kom.satuan,
          tipe: 'Masuk',
          jumlah: qty,
          kodeBatch: batchCode,
          tanggalKedaluwarsa: exp,
          referensiTransaksi: `MSK-${todayStr()}`,
          tanggal: todayStr(),
          petugasNama: user.nama,
          catatan: catatan || 'Penerimaan barang gudang',
        });
        syncKomoditasTotals();
        addAudit(user, 'Stok Masuk Gudang', `${kom.nama} (${batchCode})`, '-', `+${qty} ${kom.satuan}`);
      } else {
        try {
          deductStockFefo(
            kom.id,
            qty,
            `MUT-${todayStr()}`,
            user.nama,
            tipe === 'Penyusutan' ? 'Penyusutan' : 'Keluar',
            catatan || `${tipe} stok gudang`
          );
        } catch (err) {
          res.status(400).json({ error: (err as Error).message });
          return;
        }
        addAudit(user, `Stok ${tipe}`, kom.nama, '-', `-${qty} ${kom.satuan}`);
      }

      saveDb();
      res.json({ state: db });
    }
  );

  app.post(
    '/api/stok/opname',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer']),
    (req: AuthRequest, res) => {
      const { komoditasId, stokFisik, catatan } = req.body;
      const kom = db.komoditas.find((k) => k.id === komoditasId);
      const fisik = Number(stokFisik);
      if (!kom || !Number.isFinite(fisik) || fisik < 0) {
        res.status(400).json({ error: 'Komoditas dan jumlah stok fisik wajib diisi.' });
        return;
      }

      syncKomoditasTotals();
      const sistem = kom.stokTotal;
      const selisih = Math.round((fisik - sistem) * 100) / 100;
      const selisihPersen =
        sistem > 0 ? Math.round((Math.abs(selisih) / sistem) * 10000) / 100 : 0;

      if (selisih < 0) {
        try {
          deductStockFefo(
            kom.id,
            Math.abs(selisih),
            `OPN-${todayStr()}`,
            req.activeUser!.nama,
            'Penyusutan',
            `Penyesuaian stok opname: ${catatan || '-'}`
          );
        } catch {
          // ignore rounding
        }
      } else if (selisih > 0) {
        const firstBatch = db.stokBatches.find((b) => b.komoditasId === kom.id);
        if (firstBatch) {
          firstBatch.jumlahSisa = Math.round((firstBatch.jumlahSisa + selisih) * 100) / 100;
          db.stokMutasi.unshift({
            id: uid('mut'),
            komoditasId: kom.id,
            komoditasNama: kom.nama,
            satuan: kom.satuan,
            tipe: 'Penyesuaian',
            jumlah: selisih,
            kodeBatch: firstBatch.kodeBatch,
            referensiTransaksi: `OPN-${todayStr()}`,
            tanggal: todayStr(),
            petugasNama: req.activeUser!.nama,
            catatan: `Penyesuaian lebih stok opname: ${catatan || '-'}`,
          });
        }
        syncKomoditasTotals();
      }

      const record = {
        id: uid('opn'),
        tanggal: todayStr(),
        komoditasId: kom.id,
        komoditasNama: kom.nama,
        satuan: kom.satuan,
        stokSistem: sistem,
        stokFisik: fisik,
        selisih,
        selisihPersen,
        petugasNama: req.activeUser!.nama,
        catatan: catatan || 'Stok opname berkala',
      };
      db.stokOpname.unshift(record);
      addAudit(
        req.activeUser!,
        'Stok Opname Gudang',
        kom.nama,
        `Sistem ${sistem} ${kom.satuan}`,
        `Fisik ${fisik} ${kom.satuan} (Selisih ${selisihPersen}%)`
      );
      saveDb();
      res.json({ record, state: db });
    }
  );

  // 6. Harga Acuan (Operator excluded)
  app.post(
    '/api/harga-acuan',
    requireUser,
    requireRoles(['Admin', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { komoditasId, hargaBaru, catatan } = req.body;
      const hrg = db.hargaAcuan.find((h) => h.komoditasId === komoditasId);
      const val = Number(hargaBaru);
      if (!hrg || !Number.isFinite(val) || val <= 0) {
        res.status(400).json({ error: 'Komoditas dan nominal harga baru harus valid.' });
        return;
      }
      const oldVal = hrg.harga;
      hrg.harga = Math.round(val);
      hrg.berlakuMulai = todayStr();
      hrg.ditetapkanOleh = `${req.activeUser!.nama} (${req.activeUser!.peran})`;

      db.riwayatHarga.unshift({
        id: uid('rhrg'),
        komoditasId: hrg.komoditasId,
        komoditasNama: hrg.komoditasNama,
        hargaLama: oldVal,
        hargaBaru: hrg.harga,
        tanggal: todayStr(),
        ditetapkanOleh: req.activeUser!.nama,
        catatan: catatan || 'Peninjauan harga acuan koperasi',
      });

      addAudit(
        req.activeUser!,
        'Ubah Harga Acuan',
        hrg.komoditasNama,
        `Rp${oldVal.toLocaleString('id-ID')}`,
        `Rp${hrg.harga.toLocaleString('id-ID')}`
      );
      saveDb();
      res.json({ harga: hrg, state: db });
    }
  );

  // 7. Penagihan (Operator excluded)
  app.post(
    '/api/penagihan',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { pinjamanId, tindakan, hasil, janjiBayarTanggal, tanggalJatuhTempoBaru } = req.body;
      const loan = db.pinjaman.find((p) => p.id === pinjamanId);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      const user = req.activeUser!;
      if (tindakan === 'Jadwal Ulang' && !['Admin', 'Manajer', 'Pengurus'].includes(user.peran)) {
        res.status(403).json({
          error: 'Penjadwalan ulang pinjaman hanya dapat dilakukan oleh Manajer, Pengurus, atau Admin.',
        });
        return;
      }
      if (
        tindakan === 'Potong Simpanan' &&
        !['Admin', 'Manajer', 'Pengurus', 'Bendahara'].includes(user.peran)
      ) {
        res.status(403).json({
          error: 'Pemotongan Simpanan Pangan hanya dapat diputuskan oleh Manajer, Bendahara, Pengurus, atau Admin.',
        });
        return;
      }

      if (tindakan === 'Jadwal Ulang' && tanggalJatuhTempoBaru) {
        const oldDue = loan.tanggalJatuhTempo;
        loan.tanggalJatuhTempo = tanggalJatuhTempoBaru;
        loan.status = 'Dijadwalkan Ulang';
        addAudit(user, 'Jadwal Ulang Pinjaman', loan.kodePinjaman, oldDue, tanggalJatuhTempoBaru);
      } else if (tindakan === 'Potong Simpanan') {
        const member = db.anggota.find((a) => a.id === loan.anggotaId);
        if (!member || member.saldoSimpananRp <= 0) {
          res.status(400).json({ error: 'Saldo Simpanan Pangan anggota Rp0, tidak dapat dipotong.' });
          return;
        }
        const potongRp = Math.min(member.saldoSimpananRp, loan.sisaTagihanRp);
        const berasAcuan =
          db.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000;
        const potongKg = Math.round((potongRp / berasAcuan) * 100) / 100;
        member.saldoSimpananRp -= potongRp;
        member.saldoSimpananKg = Math.max(0, Math.round((member.saldoSimpananKg - potongKg) * 100) / 100);
        loan.sudahDibayarRp += potongRp;
        loan.sisaTagihanRp = Math.max(0, loan.totalKembaliRp - loan.sudahDibayarRp);
        if (loan.sisaTagihanRp === 0) loan.status = 'Lunas';

        db.simpananPangan.unshift({
          id: uid('smp'),
          anggotaId: member.id,
          anggotaNama: member.nama,
          tipe: 'Potong Tunggakan',
          bentuk: 'Uang',
          jumlahKg: potongKg,
          nilaiRp: potongRp,
          hargaBerasAcuan: berasAcuan,
          tanggal: todayStr(),
          petugasNama: user.nama,
          catatan: `Potong saldo simpanan untuk tunggakan ${loan.kodePinjaman}`,
        });
        db.angsuran.unshift({
          id: uid('angsr'),
          nomorKuitansi: `KWT-2026-${String(db.angsuran.length + 89).padStart(3, '0')}`,
          pinjamanId: loan.id,
          kodePinjaman: loan.kodePinjaman,
          anggotaId: loan.anggotaId,
          anggotaNama: loan.anggotaNama,
          tanggal: todayStr(),
          metode: 'Potong Simpanan',
          jumlahRp: potongRp,
          petugasNama: user.nama,
          catatan: 'Penyelesaian tunggakan >30 hari melalui potong Simpanan Pangan',
        });
        addAudit(
          user,
          'Potong Simpanan Tunggakan',
          loan.kodePinjaman,
          `Rp${potongRp.toLocaleString('id-ID')}`,
          loan.status
        );
      } else if (tindakan === 'Pengingat WhatsApp') {
        const member = db.anggota.find((a) => a.id === loan.anggotaId);
        db.notifikasi.unshift({
          id: uid('ntf'),
          tanggal: nowIso(),
          judul: `Pengingat Penagihan (${loan.kodePinjaman})`,
          isi: `Halo ${loan.anggotaNama}, pinjaman pangan Anda sebesar Rp${loan.sisaTagihanRp.toLocaleString('id-ID')} jatuh tempo pada ${loan.tanggalJatuhTempo}. Silakan lakukan pembayaran di kantor Koperasi Merah Putih Singotrunan. Terima kasih.`,
          kanal: 'WhatsApp',
          tujuan: `${loan.anggotaNama} (${member?.hp || '-'})`,
          statusKirim: 'Terkirim',
          dibuatOleh: user.nama,
        });
      }

      const logEntry = {
        id: uid('tgh'),
        pinjamanId: loan.id,
        kodePinjaman: loan.kodePinjaman,
        anggotaId: loan.anggotaId,
        anggotaNama: loan.anggotaNama,
        tanggal: todayStr(),
        tindakan,
        hasil: hasil || `Tindakan ${tindakan} dicatat.`,
        janjiBayarTanggal: janjiBayarTanggal || undefined,
        petugasNama: user.nama,
      };
      db.penagihan.unshift(logEntry);
      addAudit(user, `Penagihan (${tindakan})`, loan.kodePinjaman, '-', logEntry.hasil);
      saveDb();
      res.json({ logEntry, state: db });
    }
  );

  app.post(
    '/api/pinjaman/:id/tandai-bermasalah',
    requireUser,
    requireRoles(['Admin', 'Pengurus', 'Manajer']),
    (req: AuthRequest, res) => {
      const loan = db.pinjaman.find((p) => p.id === req.params.id);
      if (!loan) {
        res.status(404).json({ error: 'Pinjaman tidak ditemukan.' });
        return;
      }
      const oldStatus = loan.status;
      loan.status = 'Bermasalah';
      addAudit(
        req.activeUser!,
        'Tandai Pinjaman Bermasalah',
        loan.kodePinjaman,
        oldStatus,
        'Bermasalah (Agenda Pengurus)'
      );
      saveDb();
      res.json({ loan, state: db });
    }
  );

  // 8. Kas & Pembukuan (Operator excluded)
  app.post(
    '/api/kas',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer', 'Bendahara', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { tipe, kategori, jumlahRp, akun, referensi, catatan } = req.body;
      const val = Number(jumlahRp);
      if (!Number.isFinite(val) || val <= 0) {
        res.status(400).json({ error: 'Jumlah transaksi kas harus lebih dari Rp0.' });
        return;
      }
      const user = req.activeUser!;
      const autoApproved =
        tipe === 'Masuk' || ['Admin', 'Bendahara', 'Pengurus'].includes(user.peran);
      const kas = {
        id: uid('kas'),
        tanggal: todayStr(),
        tipe: tipe === 'Keluar' ? ('Keluar' as const) : ('Masuk' as const),
        kategori: kategori || 'Operasional',
        jumlahRp: Math.round(val),
        akun: akun || 'Kas Loket Koperasi',
        referensi: referensi || `KAS-${todayStr()}`,
        statusPersetujuan: autoApproved ? ('Disetujui' as const) : ('Menunggu Bendahara' as const),
        dibuatOleh: user.nama,
        disetujuiOleh: autoApproved ? user.nama : undefined,
        catatan: catatan || '',
      };
      db.kasTransaksi.unshift(kas);
      addAudit(
        user,
        `Catat Kas ${kas.tipe}`,
        kas.referensi,
        '-',
        `Rp${kas.jumlahRp.toLocaleString('id-ID')} (${kas.statusPersetujuan})`
      );
      saveDb();
      res.json({ kas, state: db });
    }
  );

  app.post(
    '/api/kas/:id/persetujuan',
    requireUser,
    requireRoles(['Admin', 'Bendahara', 'Pengurus']),
    (req: AuthRequest, res) => {
      const kas = db.kasTransaksi.find((k) => k.id === req.params.id);
      if (!kas) {
        res.status(404).json({ error: 'Transaksi kas tidak ditemukan.' });
        return;
      }
      const oldStatus = kas.statusPersetujuan;
      kas.statusPersetujuan = req.body.keputusan === 'Ditolak' ? 'Ditolak' : 'Disetujui';
      kas.disetujuiOleh = req.activeUser!.nama;
      addAudit(
        req.activeUser!,
        'Persetujuan Pengeluaran Kas',
        kas.referensi,
        oldStatus,
        kas.statusPersetujuan
      );
      saveDb();
      res.json({ kas, state: db });
    }
  );

  // 9. Cadangan Pangan Darurat (Operator excluded)
  app.post(
    '/api/darurat',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { penerimaNama, rtRw, alasan, komoditasId, jumlahKg } = req.body;
      const kom = db.komoditas.find((k) => k.id === (komoditasId || 'kom-beras-med'));
      const hrg =
        db.hargaAcuan.find((h) => h.komoditasId === (komoditasId || 'kom-beras-med'))?.harga ||
        14000;
      const qty = Number(jumlahKg);
      if (!penerimaNama || !alasan || !kom || !Number.isFinite(qty) || qty <= 0) {
        res.status(400).json({ error: 'Nama penerima, alasan, dan jumlah bantuan wajib diisi.' });
        return;
      }

      const ref = `DRT-${todayStr()}`;
      try {
        deductStockFefo(
          kom.id,
          qty,
          ref,
          req.activeUser!.nama,
          'Darurat',
          `Penyaluran Cadangan Pangan Darurat untuk ${penerimaNama}`
        );
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const item = {
        id: uid('drt'),
        tanggal: todayStr(),
        penerimaNama: String(penerimaNama).trim(),
        rtRw: String(rtRw || 'Singotrunan').trim(),
        alasan: String(alasan).trim(),
        jenis: 'Beras Sosial' as const,
        komoditasId: kom.id,
        komoditasNama: kom.nama,
        jumlahKg: qty,
        nilaiRp: Math.round(qty * hrg),
        petugasNama: req.activeUser!.nama,
      };
      db.penyaluranDarurat.unshift(item);
      addAudit(
        req.activeUser!,
        'Penyaluran Pangan Darurat',
        item.penerimaNama,
        '-',
        `${qty} ${kom.satuan} ${kom.nama}`
      );
      saveDb();
      res.json({ item, state: db });
    }
  );

  // 12. Pengumuman & Notifikasi (Operator excluded)
  app.post(
    '/api/notifikasi',
    requireUser,
    requireRoles(['Admin', 'Petugas', 'Manajer', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { judul, isi, kanal, tujuan } = req.body;
      if (!judul || !isi) {
        res.status(400).json({ error: 'Judul dan isi pengumuman/pesan wajib diisi.' });
        return;
      }
      const ntf = {
        id: uid('ntf'),
        tanggal: nowIso(),
        judul: String(judul).trim(),
        isi: String(isi).trim(),
        kanal: kanal === 'WhatsApp' ? ('WhatsApp' as const) : ('Portal' as const),
        tujuan: String(tujuan || 'Seluruh Anggota KKMP Singotrunan').trim(),
        statusKirim: 'Terkirim' as const,
        dibuatOleh: req.activeUser!.nama,
      };
      db.notifikasi.unshift(ntf);
      addAudit(req.activeUser!, `Kirim ${ntf.kanal}`, ntf.judul, '-', ntf.tujuan);
      saveDb();
      res.json({ ntf, state: db });
    }
  );

  // 13. Pengaturan Bisnis & Manajemen Pengguna (Admin & Pengurus)
  app.put(
    '/api/pengaturan',
    requireUser,
    requireRoles(['Admin', 'Pengurus']),
    (req: AuthRequest, res) => {
      const body = req.body as Partial<PengaturanSistem>;
      const oldRate = db.pengaturan.tarifJasaPerBulanPersen;
      const oldMax = db.pengaturan.plafonMaksimalRp;
      db.pengaturan = { ...db.pengaturan, ...body };
      for (const m of db.anggota) {
        recalculateAnggotaScore(m);
      }
      addAudit(
        req.activeUser!,
        'Perbarui Pengaturan Sistem',
        'Aturan Bisnis Koperasi',
        `Jasa ${oldRate}% · Plafon Maks Rp${oldMax.toLocaleString('id-ID')}`,
        `Jasa ${db.pengaturan.tarifJasaPerBulanPersen}% · Plafon Maks Rp${db.pengaturan.plafonMaksimalRp.toLocaleString('id-ID')}`
      );
      saveDb();
      res.json({ pengaturan: db.pengaturan, state: db });
    }
  );

  app.post(
    '/api/pengguna',
    requireUser,
    requireRoles(['Admin', 'Pengurus']),
    (req: AuthRequest, res) => {
      const { username, nama, peran, jabatanDetail, password } = req.body;
      const cleanUsername = String(username || '').trim().toLowerCase();
      if (!cleanUsername || !nama || !peran) {
        res.status(400).json({ error: 'Username, nama, dan peran pengguna wajib diisi.' });
        return;
      }
      if (!password || String(password).length < 6) {
        res.status(400).json({ error: 'Kata sandi awal pengguna minimal 6 karakter.' });
        return;
      }
      if (db.pengguna.some((u) => u.username.toLowerCase() === cleanUsername)) {
        res.status(400).json({ error: `Username "${cleanUsername}" sudah digunakan.` });
        return;
      }
      const newUser: Pengguna = {
        id: uid('usr'),
        username: cleanUsername,
        nama: String(nama).trim(),
        peran: peran as Role,
        status: 'Aktif',
        loginTerakhir: nowIso(),
        jabatanDetail: String(jabatanDetail || peran).trim(),
      };
      const hashed = hashPassword(String(password));
      authStore.credentials[newUser.id] = {
        userId: newUser.id,
        salt: hashed.salt,
        hash: hashed.hash,
        updatedAt: nowIso(),
      };
      db.pengguna.push(newUser);
      addAudit(req.activeUser!, 'Tambah Akun Pengguna', `${newUser.nama} (${cleanUsername})`, '-', newUser.peran);
      saveAuth();
      saveDb();
      res.json({ user: newUser, state: db });
    }
  );

  app.patch(
    '/api/pengguna/:id',
    requireUser,
    requireRoles(['Admin', 'Pengurus']),
    (req: AuthRequest, res) => {
      const target = db.pengguna.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        return;
      }
      const oldState = `${target.peran} (${target.status})`;
      if (req.body.peran) target.peran = req.body.peran as Role;
      if (req.body.status) target.status = req.body.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
      if (req.body.password) {
        const pass = String(req.body.password);
        if (pass.length < 6) {
          res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
          return;
        }
        const hashed = hashPassword(pass);
        authStore.credentials[target.id] = {
          userId: target.id,
          salt: hashed.salt,
          hash: hashed.hash,
          updatedAt: nowIso(),
        };
        saveAuth();
      }
      addAudit(
        req.activeUser!,
        'Ubah Akun Pengguna',
        `${target.nama} (${target.username})`,
        oldState,
        `${target.peran} (${target.status})`
      );
      saveDb();
      res.json({ user: target, state: db });
    }
  );

  app.get(
    '/api/backup',
    requireUser,
    requireRoles(['Admin', 'Pengurus', 'Bendahara']),
    (req: AuthRequest, res) => {
      addAudit(req.activeUser!, 'Unduh Cadangan Data', 'lumbung-db.json', '-', 'Ekspor penuh JSON');
      saveDb();
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lumbung-pangan-backup-${todayStr()}.json"`
      );
      res.json(db);
    }
  );

  app.post(
    '/api/reset-demo',
    requireUser,
    requireRoles(['Admin']),
    (req: AuthRequest, res) => {
      const preservedUsers = db.pengguna;
      db = createInitialState();
      // Pertahankan kredensial akun aktif agar Admin/Operator tetap bisa login
      for (const pu of preservedUsers) {
        if (authStore.credentials[pu.id] && !db.pengguna.some((u) => u.id === pu.id)) {
          db.pengguna.push(pu);
        }
      }
      addAudit(
        req.activeUser!,
        'Reset Data Awal',
        'Seluruh Basis Data',
        '-',
        'Dikembalikan ke data awal November 2026'
      );
      saveDb();
      res.json({ state: db });
    }
  );

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumbung Pangan Merah Putih berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer();
