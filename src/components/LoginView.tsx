import { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { CooperativeState, Pengguna, Role } from '../types/lumbung';

interface AuthAccountSummary {
  username: string;
  peran: Role;
  nama: string;
}

interface AuthStatusResponse {
  needsAdminSetup: boolean;
  envPasscodeActive: boolean;
  operatorConfigured: boolean;
  activeAccounts: AuthAccountSummary[];
}

export interface AuthSuccessPayload {
  token: string;
  user: Pengguna;
  state: CooperativeState;
}

interface LoginViewProps {
  onAuthenticated: (payload: AuthSuccessPayload) => void;
  sessionNotice?: string | null;
}

export function LoginView({ onAuthenticated, sessionNotice }: LoginViewProps) {
  const [status, setStatus] = useState<AuthStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(sessionNotice || null);
  const [submitting, setSubmitting] = useState(false);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-run Admin (+ optional Operator) bootstrap form state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminNama, setAdminNama] = useState('Admin Koperasi');
  const [adminPassword, setAdminPassword] = useState('');
  const [setupOperatorToo, setSetupOperatorToo] = useState(true);
  const [operatorUsername, setOperatorUsername] = useState('operator');
  const [operatorNama, setOperatorNama] = useState('Operator Loket');
  const [operatorPassword, setOperatorPassword] = useState('');

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error('Gagal memeriksa status autentikasi server.');
      const data = (await res.json()) as AuthStatusResponse;
      setStatus(data);
      if (data.activeAccounts.length > 0 && !username) {
        setUsername(data.activeAccounts[0].username);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal masuk. Periksa kembali username dan kata sandi Anda.');
        setSubmitting(false);
        return;
      }
      onAuthenticated(data as AuthSuccessPayload);
    } catch {
      setError('Tidak dapat terhubung ke server Lumbung Pangan.');
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (adminPassword.length < 6) {
      setError('Kata sandi Admin minimal 6 karakter.');
      return;
    }
    if (setupOperatorToo && operatorPassword.length > 0 && operatorPassword.length < 6) {
      setError('Kata sandi Operator minimal 6 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: adminUsername.trim(),
          adminNama: adminNama.trim(),
          adminPassword,
          operatorUsername: setupOperatorToo ? operatorUsername.trim() : undefined,
          operatorNama: setupOperatorToo ? operatorNama.trim() : undefined,
          operatorPassword: setupOperatorToo && operatorPassword ? operatorPassword : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal melakukan aktivasi awal Admin.');
        setSubmitting(false);
        return;
      }
      onAuthenticated(data as AuthSuccessPayload);
    } catch {
      setError('Gagal menghubungi server untuk aktivasi awal.');
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full space-y-3 text-center">
          <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-700">Memeriksa akses sistem koperasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Identitas Koperasi & Panduan Hak Akses */}
        <div className="lg:col-span-5 space-y-6 pt-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">
              KKMP Singotrunan · Banyuwangi
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              Lumbung Pangan Merah Putih
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sistem informasi simpan pinjam bahan pokok dengan pengendalian hak akses bertingkat antara Admin Sistem dan Operator Loket.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pembagian Hak Akses Pengguna
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Admin Sistem</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Akses penuh seluruh modul: dashboard, persetujuan pinjaman, gudang FEFO, harga acuan, kas &amp; darurat, laporan RAT, pengaturan aturan bisnis, serta manajemen akun.
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-start gap-3">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Operator Loket</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Akses terbatas hanya untuk <strong>Transaksi Cepat</strong> (setor/ambil simpanan, serah terima, bayar angsuran) dan <strong>Input Anggota</strong> baru.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!status?.needsAdminSetup && status && status.activeAccounts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-medium text-slate-600">
                Akun aktif terdaftar (klik untuk mengisi username):
              </p>
              <div className="flex flex-wrap gap-2">
                {status.activeAccounts.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => setUsername(acc.username)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      username === acc.username
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono">@{acc.username}</span> · {acc.peran}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Login atau Aktivasi Awal */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          {error && (
            <div
              role="alert"
              className="mb-5 bg-red-50 border border-red-200 text-red-900 rounded-lg px-4 py-3 text-xs font-medium flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {status?.needsAdminSetup ? (
            <form onSubmit={handleBootstrap} className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-red-700 text-xs font-semibold">
                  <KeyRound className="w-4 h-4" />
                  <span>AKTIVASI AWAL KEAMANAN SISTEM</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Tetapkan Kata Sandi Admin &amp; Operator
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Belum ada kata sandi Admin yang diklaim. Buat kata sandi Admin terlebih dahulu untuk mengunci dan melindungi data koperasi.
                </p>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                  1. Akun Admin (Akses Semua Modul)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Username Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Lengkap Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={adminNama}
                      onChange={(e) => setAdminNama(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kata Sandi Admin (minimal 6 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Admin..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupOperatorToo}
                    onChange={(e) => setSetupOperatorToo(e.target.checked)}
                    className="w-4 h-4 accent-red-700 rounded cursor-pointer"
                  />
                  <span>2. Sekaligus aktifkan akun Operator Loket (Transaksi Cepat &amp; Input Anggota)</span>
                </label>

                {setupOperatorToo && (
                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Username Operator
                        </label>
                        <input
                          type="text"
                          value={operatorUsername}
                          onChange={(e) => setOperatorUsername(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nama Operator
                        </label>
                        <input
                          type="text"
                          value={operatorNama}
                          onChange={(e) => setOperatorNama(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Kata Sandi Operator (opsional sekarang, bisa diatur di menu Pengaturan)
                      </label>
                      <input
                        type="password"
                        minLength={6}
                        value={operatorPassword}
                        onChange={(e) => setOperatorPassword(e.target.value)}
                        placeholder="Minimal 6 karakter jika diisi sekarang..."
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Mengaktifkan Sistem...' : 'Simpan Kredensial & Masuk sebagai Admin'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-red-700 text-xs font-semibold">
                  <Lock className="w-4 h-4" />
                  <span>MASUK KE SISTEM KOPERASI</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Login Multi-Level Pengguna
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Masukkan username dan kata sandi akun Admin atau Operator Anda.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="login-username" className="block text-xs font-medium text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: admin atau operator"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi..."
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Memverifikasi...' : 'Masuk ke Lumbung Pangan'}
              </button>

              {status?.envPasscodeActive && (
                <p className="text-[11px] text-slate-500 text-center">
                  Mode passcode lingkungan aktif untuk akun Admin (@admin).
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
