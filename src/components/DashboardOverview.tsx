import { AlertTriangle, ArrowRight, CheckCircle2, Clock, PackageCheck, Users, Wallet, Wheat } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal, hitungHariTerlambat } from '../utils/formatters';

interface DashboardOverviewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onNavigate: (tab: string) => void;
}

export function DashboardOverview({ state, activeUser, onNavigate }: DashboardOverviewProps) {
  const anggotaAktif = state.anggota.filter((a) => a.status === 'Aktif').length;
  const totalSimpananKg = state.anggota.reduce((s, a) => s + a.saldoSimpananKg, 0);
  const totalSimpananRp = state.anggota.reduce((s, a) => s + a.saldoSimpananRp, 0);

  const pinjamanBerjalan = state.pinjaman.filter((p) =>
    ['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(p.status)
  );
  const totalTagihanBerjalan = pinjamanBerjalan.reduce((s, p) => s + p.sisaTagihanRp, 0);

  const antreanPersetujuan = state.pinjaman.filter((p) => p.status === 'Diajukan');
  const siapSerahTerima = state.pinjaman.filter((p) => p.status === 'Disetujui');
  const pinjamanTerlambat = state.pinjaman.filter(
    (p) =>
      p.status === 'Terlambat' ||
      p.status === 'Bermasalah' ||
      (p.status === 'Berjalan' && hitungHariTerlambat(p.tanggalJatuhTempo) >= -3)
  );

  const stokMenipis = state.komoditas.filter((k) => k.stokTotal <= k.stokMinimum);
  const batchDekatKedaluwarsa = state.stokBatches.filter((b) => {
    if (b.jumlahSisa <= 0) return false;
    const diff = new Date(b.tanggalKedaluwarsa).getTime() - new Date('2026-11-24T00:00:00Z').getTime();
    return diff / (1000 * 60 * 60 * 24) <= 30;
  });

  // Ringkasan tren bulanan (real data + pembukuan)
  const totalKasMasuk = state.kasTransaksi
    .filter((k) => k.tipe === 'Masuk' && k.statusPersetujuan === 'Disetujui')
    .reduce((s, k) => s + k.jumlahRp, 0);
  const totalPaketMargin = state.pesananPaket.reduce((s, o) => s + Math.round(o.hargaJualRp * 0.055), 0);
  const cadanganDarurat = Math.round(
    (totalPaketMargin + state.pinjaman.reduce((s, p) => s + p.jasaRp, 0)) *
      (state.pengaturan.cadanganPanganDaruratPersen / 100)
  );
  const cadanganPiutang = Math.round(
    totalTagihanBerjalan * (state.pengaturan.cadanganPiutangTakTertagihPersen / 100)
  );

  // Target keberhasilan (Bab 12)
  const tepatWaktuCount = state.pinjaman.filter((p) => p.status === 'Lunas' || p.status === 'Berjalan').length;
  const rasioTepatWaktu = state.pinjaman.length > 0 ? Math.round((tepatWaktuCount / state.pinjaman.length) * 100) : 100;
  const selisihOpnameTerakhir = state.stokOpname[0]?.selisihPersen ?? 0.47;

  // Chart bars: Komoditas stok vs kapasitas
  const chartCommodities = state.komoditas.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header kontekstual */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {state.pengaturan.namaKoperasi} · {activeUser.jabatanDetail}
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Ringkasan Operasional Lumbung Pangan
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums">
          <span>Cadangan Pangan Darurat ({state.pengaturan.cadanganPanganDaruratPersen}%):</span>
          <span className="font-mono font-semibold text-slate-900">{formatRupiah(cadanganDarurat)}</span>
          <span aria-hidden="true">·</span>
          <span>Cadangan Piutang ({state.pengaturan.cadanganPiutangTakTertagihPersen}%):</span>
          <span className="font-mono font-semibold text-slate-900">{formatRupiah(cadanganPiutang)}</span>
        </div>
      </div>

      {/* KPI Strip 4 Kolom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('anggota')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Anggota Aktif</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{anggotaAktif} warga</p>
          <p className="text-xs text-slate-500 mt-1">
            {state.anggota.filter((a) => a.kategori === 'Petani').length} petani anggota · Singotrunan
          </p>
        </button>

        <button
          onClick={() => onNavigate('simpanan')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Simpanan Pangan</span>
            <Wheat className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{formatAngka(totalSimpananKg, 1)} kg</p>
          <p className="text-xs text-emerald-700 font-medium tabular-nums mt-1">
            Setara {formatRupiah(totalSimpananRp)} · Imbalan {state.pengaturan.imbalanSimpananPerBulanPersen}%/bln
          </p>
        </button>

        <button
          onClick={() => onNavigate('pinjaman')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Pinjaman Berjalan</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{formatRupiah(totalTagihanBerjalan)}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {pinjamanBerjalan.length} pinjaman aktif · {antreanPersetujuan.length} menunggu persetujuan
          </p>
        </button>

        <button
          onClick={() => onNavigate('stok')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Peringatan Gudang & Tunggakan</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {stokMenipis.length + pinjamanTerlambat.length} atensi
          </p>
          <p className="text-xs text-amber-700 font-medium mt-1">
            {stokMenipis.length} stok menipis · {pinjamanTerlambat.length} jatuh tempo/terlambat
          </p>
        </button>
      </div>

      {/* Baris Utama: Kiri Antrean Aksi + Kanan Posisi Stok Gudang */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (7 cols): Antrean Tugas Operasional */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Antrean Persetujuan & Jatuh Tempo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Persetujuan ≤ {formatRupiah(state.pengaturan.batasPersetujuanManajerRp)} oleh Manajer · Di atasnya oleh Pengurus
              </p>
            </div>
            <button
              onClick={() => onNavigate('pinjaman')}
              className="text-xs font-medium text-red-700 hover:text-red-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              Kelola Pinjaman <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {antreanPersetujuan.map((loan) => {
              const butuhPengurus = loan.nilaiPinjamanRp > state.pengaturan.batasPersetujuanManajerRp;
              return (
                <div key={loan.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate">{loan.anggotaNama}</span>
                      <span className="text-xs font-mono text-slate-400">{loan.kodePinjaman}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 pl-6">
                      Diajukan {formatTanggal(loan.tanggalPengajuan)} · Tenor {loan.tenorBulan} bulan ·{' '}
                      <span className="font-medium text-slate-700">
                        {butuhPengurus ? 'Wewenang Pengurus' : 'Wewenang Manajer'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(loan.nilaiPinjamanRp)}
                    </p>
                    <button
                      onClick={() => onNavigate('pinjaman')}
                      className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                    >
                      Tinjau Pengajuan
                    </button>
                  </div>
                </div>
              );
            })}

            {siapSerahTerima.map((loan) => (
              <div key={loan.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{loan.anggotaNama}</span>
                    <span className="text-xs font-mono text-slate-400">{loan.kodePinjaman}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 pl-6">
                    Disetujui oleh {loan.penyetujuNama} · Menunggu serah terima Petugas Gudang
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(loan.nilaiPinjamanRp)}
                  </p>
                  <button
                    onClick={() => onNavigate('pinjaman')}
                    className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                  >
                    Serahkan Barang
                  </button>
                </div>
              </div>
            ))}

            {pinjamanTerlambat.map((loan) => {
              const hari = hitungHariTerlambat(loan.tanggalJatuhTempo);
              return (
                <div key={loan.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${hari > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                      <span className="truncate">{loan.anggotaNama}</span>
                      <span className="text-xs font-mono text-slate-400">{loan.kodePinjaman}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 pl-6">
                      Jatuh tempo {formatTanggal(loan.tanggalJatuhTempo)} ·{' '}
                      <span className={hari > 0 ? 'text-red-700 font-medium' : 'text-amber-700 font-medium'}>
                        {hari > 0 ? `Terlambat ${hari} hari` : `H${hari} (Jatuh tempo dekat)`}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                      Sisa {formatRupiah(loan.sisaTagihanRp)}
                    </p>
                    <button
                      onClick={() => onNavigate('penagihan')}
                      className="text-xs font-medium text-slate-700 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Tindak Lanjut
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan (5 cols): Visual Stok Komoditas & Indikator Keberhasilan */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Posisi Stok Bahan Pokok</h3>
              <button
                onClick={() => onNavigate('stok')}
                className="text-xs font-medium text-red-700 hover:text-red-800 cursor-pointer"
              >
                Detail Gudang
              </button>
            </div>
            <div className="space-y-3">
              {chartCommodities.map((kom) => {
                const pct = Math.min(100, Math.round((kom.stokTotal / kom.stokMaksimum) * 100));
                const isLow = kom.stokTotal <= kom.stokMinimum;
                return (
                  <div key={kom.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{kom.nama}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        <strong className={isLow ? 'text-red-700' : 'text-slate-900'}>
                          {formatAngka(kom.stokTotal)} {kom.satuan}
                        </strong>{' '}
                        / min {kom.stokMinimum}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLow ? 'bg-red-600' : 'bg-slate-800'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {batchDekatKedaluwarsa.length > 0 && (
              <div className="pt-3 border-t border-slate-100 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  FEFO: {batchDekatKedaluwarsa.length} batch komoditas ({batchDekatKedaluwarsa[0].komoditasNama}) mendekati kedaluwarsa dalam 30 hari.
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Indikator Kinerja Koperasi</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Selisih Stok Opname Terakhir (Target &lt; 2%)</span>
                <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700 tabular-nums">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {selisihOpnameTerakhir}%
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Rasio Pinjaman Lancar &amp; Lunas</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">{rasioTepatWaktu}%</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Arus Kas Masuk Tercatat</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">{formatRupiah(totalKasMasuk)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
