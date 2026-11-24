import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Tag,
  Users,
  Wallet,
  Wheat,
  X,
  Zap,
} from 'lucide-react';
import { AnggotaView } from './components/AnggotaView';
import { DashboardOverview } from './components/DashboardOverview';
import { HargaAcuanView } from './components/HargaAcuanView';
import { KasDaruratView } from './components/KasDaruratView';
import { LaporanAuditView } from './components/LaporanAuditView';
import { AuthSuccessPayload, LoginView } from './components/LoginView';
import { MemberPortal } from './components/MemberPortal';
import { PaketSembakoView } from './components/PaketSembakoView';
import { PenagihanView } from './components/PenagihanView';
import { PengaturanView } from './components/PengaturanView';
import { PinjamanView } from './components/PinjamanView';
import { PrintDocumentModal } from './components/PrintDocuments';
import { SimpananView } from './components/SimpananView';
import { StokGudangView } from './components/StokGudangView';
import { TransaksiCepatView } from './components/TransaksiCepatView';
import { Angsuran, CooperativeState, Pengguna, Pinjaman } from './types/lumbung';

type NavKey =
  | 'dashboard'
  | 'transaksi-cepat'
  | 'anggota'
  | 'simpanan'
  | 'pinjaman'
  | 'paket'
  | 'stok'
  | 'harga'
  | 'penagihan'
  | 'kas-darurat'
  | 'laporan'
  | 'pengaturan';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<Pengguna | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [state, setState] = useState<CooperativeState | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [printModal, setPrintModal] = useState<{
    type: 'berita-acara' | 'kuitansi' | 'laporan-rat';
    loan?: Pinjaman;
    angsuran?: Angsuran;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const clearSession = useCallback((notice?: string) => {
    setAuthToken(null);
    setActiveUser(null);
    setState(null);
    setPrintModal(null);
    setMobileMenuOpen(false);
    setSessionNotice(notice || null);
  }, []);

  const handleAuthenticated = useCallback(
    (payload: AuthSuccessPayload) => {
      setAuthToken(payload.token);
      setActiveUser(payload.user);
      setState(payload.state);
      setSessionNotice(null);
      if (payload.user.peran === 'Operator') {
        setActiveNav('transaksi-cepat');
      } else {
        setActiveNav('dashboard');
      }
      showToast('success', `Selamat datang, ${payload.user.nama} (${payload.user.peran}).`);
    },
    [showToast]
  );

  const fetchState = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/state', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        clearSession('Sesi login telah berakhir. Silakan masuk kembali.');
        return;
      }
      if (!res.ok) throw new Error('Gagal memuat data Lumbung Pangan.');
      const data = (await res.json()) as CooperativeState;
      setState(data);
      setActiveUser((prev) => (prev ? data.pengguna.find((u) => u.id === prev.id) || prev : prev));
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  }, [authToken, clearSession, showToast]);

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    clearSession();
  };

  const mutateApi = async (
    method: 'POST' | 'PUT' | 'PATCH',
    url: string,
    body: unknown,
    successMsg: string
  ): Promise<boolean> => {
    if (!authToken) {
      clearSession('Sesi login tidak ditemukan. Silakan masuk kembali.');
      return false;
    }
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        clearSession('Sesi login telah berakhir. Silakan masuk kembali.');
        return false;
      }
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Terjadi kesalahan saat memproses permintaan.');
        return false;
      }
      if (data.state) {
        const nextState = data.state as CooperativeState;
        setState(nextState);
        setActiveUser((prev) =>
          prev ? nextState.pengguna.find((u) => u.id === prev.id) || prev : prev
        );
      } else {
        await fetchState();
      }
      showToast('success', successMsg);
      return true;
    } catch {
      showToast('error', 'Koneksi ke server terputus. Silakan coba lagi.');
      return false;
    }
  };

  if (!authToken || !activeUser || !state) {
    return (
      <LoginView
        onAuthenticated={handleAuthenticated}
        sessionNotice={sessionNotice}
      />
    );
  }

  const isMemberView = activeUser.peran === 'Anggota';
  const isOperator = activeUser.peran === 'Operator';

  const allNavItems: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'transaksi-cepat', label: 'Transaksi Cepat', icon: Zap },
    { key: 'anggota', label: isOperator ? 'Input Anggota' : 'Anggota', icon: Users },
    { key: 'simpanan', label: 'Simpanan Pangan', icon: Wheat },
    { key: 'pinjaman', label: 'Pinjaman Pangan', icon: Wallet },
    { key: 'paket', label: 'Paket Sembako', icon: Package },
    { key: 'stok', label: 'Stok & Gudang', icon: Boxes },
    { key: 'harga', label: 'Harga Acuan', icon: Tag },
    { key: 'penagihan', label: 'Penagihan', icon: Bell },
    { key: 'kas-darurat', label: 'Kas & Darurat', icon: ClipboardList },
    { key: 'laporan', label: 'Laporan & Audit', icon: FileBarChart },
    { key: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  const navItems = isOperator
    ? allNavItems.filter((n) => n.key === 'transaksi-cepat' || n.key === 'anggota')
    : allNavItems;

  const effectiveNav: NavKey =
    isOperator && activeNav !== 'transaksi-cepat' && activeNav !== 'anggota'
      ? 'transaksi-cepat'
      : activeNav;

  const activeNavLabel = navItems.find((n) => n.key === effectiveNav)?.label || navItems[0].label;

  // Portal Anggota View
  if (isMemberView) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Top Bar Contract (3 zones) */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              Lumbung Pangan Merah Putih
            </span>

            <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap truncate">
              Portal Anggota · {activeUser.nama}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <MemberPortal
            state={state}
            activeUser={activeUser}
            onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
          />
        </main>

        {toast && (
          <div
            role="status"
            className={`no-print fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-sm border rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5 text-xs font-medium ${
              toast.type === 'success'
                ? 'bg-white border-emerald-200 text-emerald-900'
                : 'bg-white border-red-200 text-red-900'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Dashboard Admin, Operator & Pengurus View
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="no-print hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-200">
          <p className="font-display text-lg font-bold tracking-tight text-slate-900">
            Lumbung Pangan
          </p>
          <p className="text-xs font-medium text-red-700 mt-0.5">KKMP Singotrunan · Banyuwangi</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Menu Utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = effectiveNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-red-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
          {isOperator && (
            <div className="mt-4 mx-1 p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              Akun <strong>Operator</strong> hanya memiliki akses loket Transaksi Cepat dan Input Anggota.
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 truncate">{activeUser.nama}</span>
              <span className="text-[11px] font-semibold text-red-700 shrink-0">{activeUser.peran}</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 truncate">@{activeUser.username}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{activeUser.jabatanDetail}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-display text-base font-bold text-slate-900">Lumbung Pangan</p>
                <p className="text-xs text-red-700">KKMP Singotrunan</p>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = effectiveNav === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveNav(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active ? 'bg-red-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/70">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 truncate">{activeUser.nama}</span>
                  <span className="font-semibold text-red-700">{activeUser.peran}</span>
                </div>
                <p className="font-mono text-[11px] text-slate-500">@{activeUser.username}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar Akun
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Lumbung Pangan Merah Putih</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {effectiveNav !== 'transaksi-cepat' && (
              <button
                onClick={() => setActiveNav('transaksi-cepat')}
                className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Loket Transaksi Cepat
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto">
          {activeUser.peran === 'Pengawas' && (
            <div className="no-print mb-5 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-700">
              Mode Pengawas Internal (Hanya Lihat): Anda dapat memeriksa seluruh data, stok opname, dan audit log tanpa mengubah transaksi.
            </div>
          )}

          {!isOperator && effectiveNav === 'dashboard' && (
            <DashboardOverview
              state={state}
              activeUser={activeUser}
              onNavigate={(tab) => setActiveNav(tab as NavKey)}
            />
          )}
          {effectiveNav === 'transaksi-cepat' && (
            <TransaksiCepatView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {effectiveNav === 'anggota' && (
            <AnggotaView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
              onApiPatch={(url, body, msg) => mutateApi('PATCH', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'simpanan' && (
            <SimpananView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'pinjaman' && (
            <PinjamanView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
              onPrintBeritaAcara={(loan) => setPrintModal({ type: 'berita-acara', loan })}
              onPrintKuitansi={(angsuran, loan) => setPrintModal({ type: 'kuitansi', angsuran, loan })}
            />
          )}
          {!isOperator && effectiveNav === 'paket' && (
            <PaketSembakoView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'stok' && (
            <StokGudangView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'harga' && (
            <HargaAcuanView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'penagihan' && (
            <PenagihanView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'kas-darurat' && (
            <KasDaruratView
              state={state}
              activeUser={activeUser}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
            />
          )}
          {!isOperator && effectiveNav === 'laporan' && (
            <LaporanAuditView
              state={state}
              onPrintRat={() => setPrintModal({ type: 'laporan-rat' })}
            />
          )}
          {!isOperator && effectiveNav === 'pengaturan' && (
            <PengaturanView
              state={state}
              activeUser={activeUser}
              authToken={authToken}
              onApiPut={(url, body, msg) => mutateApi('PUT', url, body, msg)}
              onApiPost={(url, body, msg) => mutateApi('POST', url, body, msg)}
              onApiPatch={(url, body, msg) => mutateApi('PATCH', url, body, msg)}
            />
          )}
        </main>
      </div>

      {/* Print Modal */}
      {printModal && (
        <PrintDocumentModal
          type={printModal.type}
          loan={printModal.loan}
          angsuran={printModal.angsuran}
          state={state}
          onClose={() => setPrintModal(null)}
        />
      )}

      {/* Feedback Toast */}
      {toast && (
        <div
          role="status"
          className={`no-print fixed bottom-5 right-5 z-50 max-w-sm border rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5 text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-900'
              : 'bg-white border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
