import { useState } from 'react';
import {
  Calendar,
  CreditCard,
  History,
  Home,
  Info,
  Package,
  Phone,
  PlusCircle,
  Printer,
  Wallet,
} from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal, formatWaktu } from '../utils/formatters';
import { QrCodeBox } from './QrCodeBox';

interface MemberPortalProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

type MemberScreen =
  | 'beranda'
  | 'pinjaman'
  | 'ajukan'
  | 'paket'
  | 'riwayat'
  | 'kartu'
  | 'informasi';

export function MemberPortal({ state, activeUser, onApiPost }: MemberPortalProps) {
  const [screen, setScreen] = useState<MemberScreen>('beranda');
  const [riwayatFilter, setRiwayatFilter] = useState<'Semua' | 'Simpanan' | 'Pinjaman' | 'Paket'>('Semua');

  const member =
    state.anggota.find((a) => a.id === activeUser.linkedAnggotaId) || state.anggota[0];

  // Form Ajukan Pinjaman state
  const [tenorBulan, setTenorBulan] = useState(2);
  const [itemQty, setItemQty] = useState<Record<string, number>>({
    'kom-beras-med': 5,
    'kom-minyak': 1,
  });
  const [catatanPinjam, setCatatanPinjam] = useState('');
  const [tenorPaket, setTenorPaket] = useState<4 | 8>(4);

  const memberLoans = state.pinjaman.filter((p) => p.anggotaId === member.id);
  const memberSimpanan = state.simpananPangan.filter((s) => s.anggotaId === member.id);
  const memberOrders = state.pesananPaket.filter((o) => o.anggotaId === member.id);
  const memberAngsuran = state.angsuran.filter((a) => a.anggotaId === member.id);

  const activeLoans = memberLoans.filter((p) =>
    ['Diajukan', 'Disetujui', 'Berjalan', 'Terlambat', 'Dijadwalkan Ulang'].includes(p.status)
  );
  const nearestLoan = activeLoans.sort((a, b) => a.tanggalJatuhTempo.localeCompare(b.tanggalJatuhTempo))[0];

  const maxTenor =
    member.kategori === 'Petani'
      ? state.pengaturan.tenorMaksPetaniBulan
      : state.pengaturan.tenorMaksUmumBulan;

  const nilaiPinjaman = state.komoditas.reduce((sum, k) => {
    const qty = itemQty[k.id] || 0;
    const harga = state.hargaAcuan.find((h) => h.komoditasId === k.id)?.harga || 0;
    return sum + qty * harga;
  }, 0);
  const jasaRp = Math.round(nilaiPinjaman * (state.pengaturan.tarifJasaPerBulanPersen / 100) * tenorBulan);
  const totalKembali = nilaiPinjaman + jasaRp;

  const handleAjukan = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(itemQty)
      .filter(([, q]) => q > 0)
      .map(([komoditasId, jumlah]) => ({ komoditasId, jumlah }));
    const ok = await onApiPost(
      '/api/pinjaman',
      { anggotaId: member.id, items, tenorBulan, catatan: catatanPinjam },
      'Pengajuan pinjaman Anda terkirim dan menunggu persetujuan pengurus.'
    );
    if (ok) {
      setScreen('pinjaman');
      setCatatanPinjam('');
    }
  };

  const handlePesanPaket = async (paketId: string) => {
    await onApiPost(
      '/api/pesanan-paket',
      { anggotaId: member.id, paketId, tenorMingguan: tenorPaket },
      'Paket Sembako Cicil berhasil dipesan! Silakan ambil di loket koperasi.'
    );
  };

  const navItems: { id: MemberScreen; label: string; icon: typeof Home }[] = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'pinjaman', label: 'Pinjaman', icon: Wallet },
    { id: 'ajukan', label: 'Ajukan', icon: PlusCircle },
    { id: 'paket', label: 'Sembako', icon: Package },
    { id: 'riwayat', label: 'Riwayat', icon: History },
    { id: 'kartu', label: 'Kartu QR', icon: CreditCard },
    { id: 'informasi', label: 'Info', icon: Info },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Desktop Portal Navigation Bar */}
      <div className="no-print hidden md:flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {member.nomorAnggota} · Plafon {formatRupiah(member.plafonAktifRp)}
        </div>
      </div>

      {/* Screen 1: Beranda */}
      {screen === 'beranda' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div>
                <p className="text-xs font-medium text-red-700">Portal Anggota · {member.rtRw}</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">Sugeng Rawuh, {member.nama}</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Pantau saldo Simpanan Pangan, jadwal jatuh tempo pinjaman, dan pesan paket sembako langsung dari HP Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-500 block">Saldo Simpanan Pangan</span>
                  <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                    {formatAngka(member.saldoSimpananKg, 1)} kg
                  </span>
                  <span className="text-xs text-slate-600 block font-mono tabular-nums">
                    Setara {formatRupiah(member.saldoSimpananRp)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Jatuh Tempo Terdekat</span>
                  {nearestLoan ? (
                    <>
                      <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {formatRupiah(nearestLoan.sisaTagihanRp)}
                      </span>
                      <span className="text-xs text-amber-700 font-medium block">
                        {nearestLoan.kodePinjaman} · {formatTanggal(nearestLoan.tanggalJatuhTempo)}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-semibold text-slate-700 block mt-1">Tidak ada tagihan berjalan</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setScreen('ajukan')}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer min-h-[44px]"
                >
                  Ajukan Pinjaman Pangan
                </button>
                <button
                  onClick={() => setScreen('paket')}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer min-h-[44px]"
                >
                  Lihat Paket Sembako
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative min-h-[220px]">
              <img
                src="/src/assets/images/lumbung_koperasi_hero_1795507217514.jpg"
                alt="Gudang dan loket Lumbung Pangan Merah Putih Singotrunan"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
                <p className="text-xs font-medium text-white/90">{state.pengaturan.namaKoperasi}</p>
                <p className="text-sm font-semibold">{state.pengaturan.jamLayanan}</p>
              </div>
            </div>
          </div>

          {/* Info Cepat Plafon & Paket Aktif */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Plafon Pinjaman Aktif</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatRupiah(member.plafonAktifRp)}</p>
              <p className="text-xs text-slate-500 mt-1">Skor kelayakan {member.skorKelayakan}/100 · Ketepatan {member.ketepatanBayarPersen}%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Paket Sembako Cicil Aktif</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">
                {memberOrders.filter((o) => o.status === 'Aktif').length} / {state.pengaturan.maksPaketAktifPerAnggota} paket
              </p>
              <p className="text-xs text-slate-500 mt-1">Cicilan ringan mingguan tanpa bunga tersembunyi</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Harga Acuan Beras Medium</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">
                {formatRupiah(state.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000)}/kg
              </p>
              <p className="text-xs text-slate-500 mt-1">Tetap terkunci saat transaksi pinjaman</p>
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Pinjaman Saya */}
      {screen === 'pinjaman' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pinjaman Pangan Saya</h2>
              <p className="text-xs text-slate-500">Daftar seluruh pinjaman dengan rincian nilai terkunci dan sisa tagihan</p>
            </div>
            <button
              onClick={() => setScreen('ajukan')}
              className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer min-h-[44px]"
            >
              + Ajukan Pinjaman
            </button>
          </div>

          <div className="space-y-3">
            {memberLoans.map((loan) => (
              <div key={loan.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-900">{loan.kodePinjaman}</span> ·{' '}
                    <span className="font-semibold text-red-700">{loan.status}</span> · Jatuh tempo{' '}
                    <span className="font-medium text-slate-800">{formatTanggal(loan.tanggalJatuhTempo)}</span>
                  </div>
                  <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    Sisa {formatRupiah(loan.sisaTagihanRp)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {loan.items.map((i) => `${i.jumlah} ${i.satuan} ${i.komoditasNama}`).join(' · ')}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 tabular-nums">
                  <span>Nilai Barang {formatRupiah(loan.nilaiPinjamanRp)} + Jasa {formatRupiah(loan.jasaRp)}</span>
                  <span>Sudah dibayar {formatRupiah(loan.sudahDibayarRp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screen 3: Ajukan Pinjaman */}
      {screen === 'ajukan' && (
        <form onSubmit={handleAjukan} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Ajukan Pinjaman Bahan Pokok</h2>
              <p className="text-xs text-slate-500">Pilih jumlah barang sesuai kebutuhan. Nilai pinjaman terkunci saat pengajuan.</p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {state.komoditas.map((kom) => {
                const harga = state.hargaAcuan.find((h) => h.komoditasId === kom.id)?.harga || 0;
                const qty = itemQty[kom.id] || 0;
                return (
                  <div key={kom.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{kom.nama}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {formatRupiah(harga)}/{kom.satuan} · Stok {kom.stokTotal} {kom.satuan}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setItemQty({ ...itemQty, [kom.id]: Math.max(0, qty - 1) })}
                        className="w-10 h-10 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-mono text-sm font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setItemQty({ ...itemQty, [kom.id]: Math.min(kom.stokTotal, qty + 1) })}
                        className="w-10 h-10 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
            <h3 className="text-base font-bold text-slate-900">Ringkasan Hitungan</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pilih Tenor (Maks {maxTenor} bulan)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: maxTenor }, (_, i) => i + 1).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTenorBulan(m)}
                    className={`py-2.5 text-xs font-medium rounded-lg border cursor-pointer min-h-[44px] ${
                      tenorBulan === m
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {m} Bulan
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catatan (Opsional)</label>
              <input
                type="text"
                value={catatanPinjam}
                onChange={(e) => setCatatanPinjam(e.target.value)}
                placeholder="Contoh: Ambil besok pagi di loket"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Nilai Barang Pokok</span>
                <span className="font-mono font-semibold">{formatRupiah(nilaiPinjaman)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Jasa ({state.pengaturan.tarifJasaPerBulanPersen}% × {tenorBulan} bln)</span>
                <span className="font-mono">{formatRupiah(jasaRp)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold">
                <span>Total Dikembalikan</span>
                <span className="font-mono text-red-700">{formatRupiah(totalKembali)}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Plafon Anda: {formatRupiah(member.plafonAktifRp)}
              </p>
            </div>

            <button
              type="submit"
              disabled={nilaiPinjaman <= 0}
              className="w-full py-3 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-xl disabled:opacity-50 cursor-pointer min-h-[48px]"
            >
              Kirim Pengajuan Pinjaman
            </button>
          </div>
        </form>
      )}

      {/* Screen 4: Paket Sembako */}
      {screen === 'paket' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Paket Sembako Cicil</h2>
              <p className="text-xs text-slate-500">
                Batas maksimal {state.pengaturan.maksPaketAktifPerAnggota} paket aktif · Cicilan mingguan
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                onClick={() => setTenorPaket(4)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tenorPaket === 4 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Cicil 4 Minggu
              </button>
              <button
                onClick={() => setTenorPaket(8)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tenorPaket === 8 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Cicil 8 Minggu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {state.paketSembako.map((pkt) => (
              <div key={pkt.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="aspect-[4/3] bg-slate-100">
                  <img src={pkt.gambarUrl} alt={pkt.nama} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-slate-900">{pkt.nama}</h3>
                    <p className="text-xs text-slate-600">{pkt.isi.map((i) => `${i.jumlah} ${i.satuan} ${i.komoditasNama}`).join(' · ')}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="tabular-nums">
                      <p className="text-base font-bold font-mono text-slate-900">{formatRupiah(pkt.hargaJualRp)}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        ~{formatRupiah(Math.ceil(pkt.hargaJualRp / tenorPaket))}/minggu
                      </p>
                    </div>
                    <button
                      onClick={() => handlePesanPaket(pkt.id)}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer min-h-[44px]"
                    >
                      Pesan &amp; Cicil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {memberOrders.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Pesanan Paket Saya</h3>
              <div className="divide-y divide-slate-100">
                {memberOrders.map((o) => (
                  <div key={o.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{o.paketNama} ({o.kodePesanan})</p>
                      <p className="text-slate-500">Status: {o.status} · Cicilan {formatRupiah(o.cicilanPerMingguRp)}/minggu</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                      Sisa {formatRupiah(o.sisaTagihanRp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen 5: Riwayat */}
      {screen === 'riwayat' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Riwayat Transaksi Saya</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['Semua', 'Simpanan', 'Pinjaman', 'Paket'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRiwayatFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    riwayatFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {(riwayatFilter === 'Semua' || riwayatFilter === 'Simpanan') &&
              memberSimpanan.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between text-xs tabular-nums">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Simpanan Pangan ({s.tipe} · {s.bentuk})</p>
                    <p className="text-slate-500">{formatTanggal(s.tanggal)} · {s.catatan}</p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-emerald-700">+{s.jumlahKg} kg</p>
                    <p className="text-slate-500">{formatRupiah(s.nilaiRp)}</p>
                  </div>
                </div>
              ))}
            {(riwayatFilter === 'Semua' || riwayatFilter === 'Pinjaman') &&
              memberAngsuran.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between text-xs tabular-nums">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Angsuran {a.kodePinjaman} ({a.metode})</p>
                    <p className="text-slate-500">{formatTanggal(a.tanggal)} · Kuitansi {a.nomorKuitansi}</p>
                  </div>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(a.jumlahRp)}</span>
                </div>
              ))}
            {(riwayatFilter === 'Semua' || riwayatFilter === 'Paket') &&
              memberOrders.map((o) => (
                <div key={o.id} className="p-4 flex items-center justify-between text-xs tabular-nums">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{o.paketNama}</p>
                    <p className="text-slate-500">{formatTanggal(o.tanggalPesan)} · {o.kodePesanan}</p>
                  </div>
                  <span className="font-mono font-bold text-slate-900">{formatRupiah(o.hargaJualRp)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Screen 6: Kartu Anggota QR */}
      {screen === 'kartu' && (
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-semibold text-red-700">{state.pengaturan.namaKoperasi}</p>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Kartu Anggota Digital</h2>
            </div>
            <button
              onClick={() => window.print()}
              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak
            </button>
          </div>

          <div className="flex flex-col items-center text-center gap-3 py-2">
            <QrCodeBox value={member.nomorAnggota} size={160} label={member.nomorAnggota} />
            <div>
              <p className="text-xl font-bold text-slate-900">{member.nama}</p>
              <p className="text-xs text-slate-600">{member.alamat} ({member.rtRw})</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs tabular-nums">
            <div className="flex justify-between"><span className="text-slate-500">Status &amp; Kategori</span><span className="font-semibold text-slate-900">{member.status} · {member.kategori}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Bergabung Sejak</span><span className="text-slate-900">{formatTanggal(member.tanggalBergabung)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Plafon Pinjaman</span><span className="font-mono font-bold text-slate-900">{formatRupiah(member.plafonAktifRp)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Penjamin</span><span className="text-slate-900">{member.penjaminNama}</span></div>
          </div>
        </div>
      )}

      {/* Screen 7: Informasi */}
      {screen === 'informasi' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Pengumuman Koperasi</h3>
            <div className="divide-y divide-slate-100">
              {state.notifikasi
                .filter((n) => n.kanal === 'Portal')
                .map((n) => (
                  <div key={n.id} className="py-3 space-y-1">
                    <p className="text-xs text-slate-500">{formatWaktu(n.tanggal)}</p>
                    <p className="text-sm font-semibold text-slate-900">{n.judul}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.isi}</p>
                  </div>
                ))}
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-red-700" /> Kontak Koperasi: {state.pengaturan.kontakWhatsApp}
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> {state.pengaturan.jamLayanan}
              </p>
              <p>{state.pengaturan.alamatKoperasi}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Daftar Harga Acuan Terbaru</h3>
            <div className="divide-y divide-slate-100 text-sm tabular-nums">
              {state.hargaAcuan.map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{h.komoditasNama}</p>
                    <p className="text-xs text-slate-500">Berlaku {formatTanggal(h.berlakuMulai)}</p>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {formatRupiah(h.harga)} / {h.satuan}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Thumb Navigation (<= 15% viewport height) */}
      <nav
        aria-label="Navigasi Portal Anggota"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-16"
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] cursor-pointer ${
                active ? 'text-red-700 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
