import { useState } from 'react';
import { Download, Printer, Search, ShieldAlert } from 'lucide-react';
import { CooperativeState } from '../types/lumbung';
import { exportToCsv, formatAngka, formatRupiah, formatWaktu } from '../utils/formatters';

interface LaporanAuditViewProps {
  state: CooperativeState;
  initialTab?: 'laporan' | 'audit';
  onPrintRat: () => void;
}

export function LaporanAuditView({ state, initialTab = 'laporan', onPrintRat }: LaporanAuditViewProps) {
  const [tab, setTab] = useState<'laporan' | 'audit'>(initialTab);
  const [periode, setPeriode] = useState<'Harian' | 'Bulanan' | 'Tahunan (RAT)'>('Bulanan');
  const [auditQuery, setAuditQuery] = useState('');

  const totalSimpananKg = state.anggota.reduce((s, a) => s + a.saldoSimpananKg, 0);
  const totalSimpananRp = state.anggota.reduce((s, a) => s + a.saldoSimpananRp, 0);
  const totalPokokWajib = state.anggota.reduce((s, a) => s + a.simpananPokokRp + a.simpananWajibRp, 0);

  const pinjamanAktif = state.pinjaman.filter((p) =>
    ['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(p.status)
  );
  const totalPiutang = pinjamanAktif.reduce((s, p) => s + p.sisaTagihanRp, 0);
  const totalJasaTercatat = state.pinjaman.reduce((s, p) => s + p.jasaRp, 0);
  const valuasiGudang = state.komoditas.reduce((sum, k) => {
    const h = state.hargaAcuan.find((x) => x.komoditasId === k.id)?.harga || 0;
    return sum + k.stokTotal * h;
  }, 0);

  const handleExportPinjamanCsv = () => {
    exportToCsv(
      `laporan-pinjaman-lumbung-pangan-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Kode Pinjaman', 'Anggota', 'Tanggal Pengajuan', 'Jatuh Tempo', 'Nilai Pokok (Rp)', 'Jasa (Rp)', 'Total Kembali (Rp)', 'Sisa Tagihan (Rp)', 'Status'],
      state.pinjaman.map((p) => [
        p.kodePinjaman,
        p.anggotaNama,
        p.tanggalPengajuan,
        p.tanggalJatuhTempo,
        p.nilaiPinjamanRp,
        p.jasaRp,
        p.totalKembaliRp,
        p.sisaTagihanRp,
        p.status,
      ])
    );
  };

  const handleExportStokCsv = () => {
    exportToCsv(
      `laporan-stok-gudang-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Komoditas', 'Kategori', 'Satuan', 'Stok Tersedia', 'Stok Minimum', 'Harga Acuan (Rp)', 'Valuasi (Rp)'],
      state.komoditas.map((k) => {
        const h = state.hargaAcuan.find((x) => x.komoditasId === k.id)?.harga || 0;
        return [k.nama, k.kategori, k.satuan, k.stokTotal, k.stokMinimum, h, k.stokTotal * h];
      })
    );
  };

  const filteredAudit = state.auditLog.filter(
    (a) =>
      a.penggunaNama.toLowerCase().includes(auditQuery.toLowerCase()) ||
      a.aksi.toLowerCase().includes(auditQuery.toLowerCase()) ||
      a.objek.toLowerCase().includes(auditQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 10 &amp; 14 · Ekspor Excel (CSV), Cetak PDF RAT &amp; Jejak Audit Tak Dapat Dihapus
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Laporan Koperasi &amp; Audit Log</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPinjamanCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor CSV Pinjaman
          </button>
          <button
            onClick={handleExportStokCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor CSV Stok
          </button>
          <button
            onClick={onPrintRat}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Cetak Laporan RAT
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setTab('laporan')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'laporan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Laporan Ringkasan &amp; RAT
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Audit Log ({state.auditLog.length})
          </button>
        </div>

        {tab === 'laporan' && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['Harian', 'Bulanan', 'Tahunan (RAT)'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  periode === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'laporan' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Simpanan Pokok &amp; Wajib</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatRupiah(totalPokokWajib)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Saldo Simpanan Pangan</p>
              <p className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1">
                {formatAngka(totalSimpananKg, 1)} kg · {formatRupiah(totalSimpananRp)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Piutang Pinjaman Berjalan</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatRupiah(totalPiutang)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Valuasi Persediaan Gudang</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatRupiah(valuasiGudang)}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Rekapitulasi Keuangan Unit ({periode})</h3>
                <p className="text-xs text-slate-500">Disiapkan otomatis untuk pertanggungjawaban Pengurus &amp; Rapat Anggota</p>
              </div>
              <span className="font-mono text-xs text-slate-500">KKMP Singotrunan · Nov 2026</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm tabular-nums">
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Total Nilai Pinjaman Disalurkan</span>
                  <span className="font-mono font-semibold">{formatRupiah(state.pinjaman.reduce((s, p) => s + p.nilaiPinjamanRp, 0))}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Proyeksi &amp; Realisasi Jasa Pinjaman ({state.pengaturan.tarifJasaPerBulanPersen}%/bln)</span>
                  <span className="font-mono font-semibold text-emerald-700">{formatRupiah(totalJasaTercatat)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Total Omzet Paket Sembako Cicil</span>
                  <span className="font-mono font-semibold">{formatRupiah(state.pesananPaket.reduce((s, o) => s + o.hargaJualRp, 0))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Cadangan Piutang Tak Tertagih ({state.pengaturan.cadanganPiutangTakTertagihPersen}%)</span>
                  <span className="font-mono font-semibold">{formatRupiah(totalPiutang * (state.pengaturan.cadanganPiutangTakTertagihPersen / 100))}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Alokasi Cadangan Pangan Darurat ({state.pengaturan.cadanganPanganDaruratPersen}% margin)</span>
                  <span className="font-mono font-semibold">{formatRupiah(totalJasaTercatat * (state.pengaturan.cadanganPanganDaruratPersen / 100))}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Penyaluran Bantuan Darurat Warga</span>
                  <span className="font-mono font-semibold">{formatRupiah(state.penyaluranDarurat.reduce((s, d) => s + d.nilaiRp, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Cari pengguna, aksi, atau kode objek..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <p className="text-xs text-slate-600 inline-flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              Catatan audit bersifat tetap dan tidak dapat diubah atau dihapus.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Pengguna &amp; Peran</th>
                    <th className="py-3 px-4">Aksi &amp; Objek</th>
                    <th className="py-3 px-4">Nilai Lama → Nilai Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredAudit.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">{formatWaktu(a.waktu)}</td>
                      <td className="py-2.5 px-4 text-xs">
                        <span className="font-semibold text-slate-900">{a.penggunaNama}</span> ·{' '}
                        <span className="text-slate-600">{a.penggunaPeran}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <span className="font-semibold text-slate-900">{a.aksi}</span> —{' '}
                        <span className="text-slate-600">{a.objek}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-600">
                        {a.nilaiLama} → <strong className="text-slate-900">{a.nilaiBaru}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
