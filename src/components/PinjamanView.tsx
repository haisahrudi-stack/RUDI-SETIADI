import { useState } from 'react';
import { Banknote, Check, FileText, PackageCheck, Plus, Printer, ShieldCheck, X } from 'lucide-react';
import { Angsuran, CooperativeState, Pengguna, Pinjaman, StatusPinjaman } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';

interface PinjamanViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
  onPrintBeritaAcara: (loan: Pinjaman) => void;
  onPrintKuitansi: (angsuran: Angsuran, loan?: Pinjaman) => void;
}

export function PinjamanView({
  state,
  activeUser,
  onApiPost,
  onPrintBeritaAcara,
  onPrintKuitansi,
}: PinjamanViewProps) {
  const [statusFilter, setStatusFilter] = useState<'Semua' | StatusPinjaman>('Semua');
  const [showCreate, setShowCreate] = useState(false);
  const [repayLoan, setRepayLoan] = useState<Pinjaman | null>(null);

  // Create Loan State
  const [anggotaId, setAnggotaId] = useState(state.anggota[0]?.id || '');
  const [tenorBulan, setTenorBulan] = useState(2);
  const [itemQty, setItemQty] = useState<Record<string, number>>({
    'kom-beras-med': 10,
    'kom-minyak': 2,
    'kom-gula': 1,
  });
  const [catatan, setCatatan] = useState('');

  // Repay State
  const [metode, setMetode] = useState<'Tunai' | 'Transfer' | 'Barang Setara'>('Tunai');
  const [jumlahRp, setJumlahRp] = useState('100000');
  const [barangKomoditasId, setBarangKomoditasId] = useState('kom-beras-med');
  const [barangJumlah, setBarangJumlah] = useState('5');

  const isAdmin = activeUser.peran === 'Admin';
  const canCreate = ['Admin', 'Petugas', 'Manajer', 'Pengurus'].includes(activeUser.peran);
  const isManajer = activeUser.peran === 'Manajer';
  const isPengurus = activeUser.peran === 'Pengurus';
  const canHandover = ['Admin', 'Petugas'].includes(activeUser.peran);
  const canRepay = ['Admin', 'Petugas', 'Bendahara'].includes(activeUser.peran);

  const selectedAnggota = state.anggota.find((a) => a.id === anggotaId);
  const maxTenor =
    selectedAnggota?.kategori === 'Petani'
      ? state.pengaturan.tenorMaksPetaniBulan
      : state.pengaturan.tenorMaksUmumBulan;

  const nilaiBarang = state.komoditas.reduce((sum, kom) => {
    const qty = itemQty[kom.id] || 0;
    if (qty <= 0) return sum;
    const harga = state.hargaAcuan.find((h) => h.komoditasId === kom.id)?.harga || 0;
    return sum + qty * harga;
  }, 0);
  const jasaRp = Math.round(nilaiBarang * (state.pengaturan.tarifJasaPerBulanPersen / 100) * tenorBulan);
  const totalKembali = nilaiBarang + jasaRp;

  const filteredLoans = state.pinjaman.filter((p) =>
    statusFilter === 'Semua' ? true : p.status === statusFilter
  );

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(itemQty)
      .filter(([, q]) => q > 0)
      .map(([komoditasId, jumlah]) => ({ komoditasId, jumlah }));
    const ok = await onApiPost(
      '/api/pinjaman',
      { anggotaId, items, tenorBulan, catatan },
      'Pengajuan pinjaman pangan berhasil dicatat dengan nilai barang terkunci.'
    );
    if (ok) {
      setShowCreate(false);
      setCatatan('');
    }
  };

  const handleKeputusan = async (loan: Pinjaman, keputusan: 'Disetujui' | 'Ditolak') => {
    await onApiPost(
      `/api/pinjaman/${loan.id}/keputusan`,
      { keputusan },
      `Pinjaman ${loan.kodePinjaman} berhasil ${keputusan.toLowerCase()}.`
    );
  };

  const handleSerahTerima = async (loan: Pinjaman) => {
    await onApiPost(
      `/api/pinjaman/${loan.id}/serah-terima`,
      {},
      `Barang untuk ${loan.kodePinjaman} diserahkan. Stok gudang FEFO diperbarui.`
    );
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    const ok = await onApiPost(
      `/api/pinjaman/${repayLoan.id}/angsuran`,
      {
        metode,
        jumlahRp: Number(jumlahRp),
        barangKomoditasId,
        barangJumlah: Number(barangJumlah),
      },
      `Pembayaran angsuran ${repayLoan.kodePinjaman} tercatat.`
    );
    if (ok) setRepayLoan(null);
  };

  const statusColor = (st: StatusPinjaman) => {
    if (st === 'Lunas') return 'text-emerald-700';
    if (st === 'Berjalan' || st === 'Disetujui') return 'text-slate-900';
    if (st === 'Diajukan' || st === 'Dijadwalkan Ulang') return 'text-amber-700';
    return 'text-red-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 3 · Jasa {state.pengaturan.tarifJasaPerBulanPersen}%/bln flat · Batas Manajer ≤{' '}
            {formatRupiah(state.pengaturan.batasPersetujuanManajerRp)}
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Pinjaman Pangan</h2>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Ajukan Pinjaman Pangan
          </button>
        )}
      </div>

      {/* Filter Status */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(['Semua', 'Diajukan', 'Disetujui', 'Berjalan', 'Terlambat', 'Lunas', 'Bermasalah'] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Daftar Pinjaman */}
      <div className="space-y-3">
        {filteredLoans.map((loan) => {
          const butuhPengurus = loan.nilaiPinjamanRp > state.pengaturan.batasPersetujuanManajerRp;
          const canApproveThis =
            loan.status === 'Diajukan' &&
            (isAdmin || (!butuhPengurus && (isManajer || isPengurus)) || (butuhPengurus && isPengurus));

          return (
            <div
              key={loan.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">{loan.kodePinjaman}</span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold ${statusColor(loan.status)}`}>{loan.status}</span>
                  <span aria-hidden="true">·</span>
                  <span>Ajuan {formatTanggal(loan.tanggalPengajuan)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Jatuh tempo {formatTanggal(loan.tanggalJatuhTempo)}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{loan.anggotaNama}</h3>
                <p className="text-xs text-slate-600">
                  {loan.items
                    .map(
                      (i) =>
                        `${i.jumlah} ${i.satuan} ${i.komoditasNama} (@ ${formatRupiah(i.hargaSaatTransaksi)})`
                    )
                    .join(' · ')}
                </p>
                {loan.wajibPenjamin && (
                  <p className="text-xs text-slate-500">
                    Penjamin: {loan.penjaminNama} —{' '}
                    <span className={loan.penjaminKonfirmasi ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                      {loan.penjaminKonfirmasi ? 'Sudah dikonfirmasi' : 'Menunggu konfirmasi penjamin'}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div className="text-left sm:text-right tabular-nums">
                  <p className="text-xs text-slate-500">
                    Pokok {formatRupiah(loan.nilaiPinjamanRp)} + Jasa {formatRupiah(loan.jasaRp)} ({loan.tenorBulan} bln)
                  </p>
                  <p className="text-base font-bold font-mono text-slate-900">
                    Sisa {formatRupiah(loan.sisaTagihanRp)}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {formatRupiah(loan.totalKembaliRp)}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {loan.status === 'Diajukan' && loan.wajibPenjamin && !loan.penjaminKonfirmasi && (
                    <button
                      onClick={() =>
                        onApiPost(
                          `/api/pinjaman/${loan.id}/konfirmasi-penjamin`,
                          {},
                          `Jaminan ${loan.penjaminNama} dikonfirmasi.`
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Konfirmasi Penjamin
                    </button>
                  )}

                  {canApproveThis && (
                    <>
                      <button
                        onClick={() => handleKeputusan(loan, 'Disetujui')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button
                        onClick={() => handleKeputusan(loan, 'Ditolak')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        Tolak
                      </button>
                    </>
                  )}

                  {loan.status === 'Diajukan' && !canApproveThis && (
                    <span className="text-xs text-amber-700 font-medium">
                      Menunggu {butuhPengurus ? 'Pengurus' : 'Manajer'}
                    </span>
                  )}

                  {loan.status === 'Disetujui' && canHandover && (
                    <button
                      onClick={() => handleSerahTerima(loan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5" /> Serah Terima Barang
                    </button>
                  )}

                  {['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(loan.status) &&
                    canRepay && (
                      <button
                        onClick={() => {
                          setRepayLoan(loan);
                          setJumlahRp(String(loan.sisaTagihanRp));
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" /> Catat Angsuran
                      </button>
                    )}

                  {['Berjalan', 'Lunas', 'Terlambat', 'Dijadwalkan Ulang'].includes(loan.status) && (
                    <button
                      onClick={() => onPrintBeritaAcara(loan)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Berita Acara
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Riwayat Pembayaran Angsuran & Kuitansi */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Riwayat Angsuran &amp; Kuitansi</h3>
          <span className="text-xs text-slate-500">{state.angsuran.length} pembayaran</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Kuitansi</th>
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Anggota &amp; Pinjaman</th>
                <th className="py-2.5 px-4">Metode</th>
                <th className="py-2.5 px-4 text-right">Nominal</th>
                <th className="py-2.5 px-4 text-right">Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {state.angsuran.map((ang) => {
                const parentLoan = state.pinjaman.find((p) => p.id === ang.pinjamanId);
                return (
                  <tr key={ang.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">{ang.nomorKuitansi}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{formatTanggal(ang.tanggal)}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-900">{ang.anggotaNama}</span>{' '}
                      <span className="font-mono text-xs text-slate-500">· {ang.kodePinjaman}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">
                      {ang.metode}
                      {ang.barangDetail &&
                        ` (${ang.barangDetail.jumlah} ${ang.barangDetail.satuan} ${ang.barangDetail.komoditasNama})`}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700">
                      {formatRupiah(ang.jumlahRp)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onPrintKuitansi(ang, parentLoan)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Kuitansi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Pinjaman */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Pengajuan Pinjaman Pangan (Nilai Terkunci)</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitLoan} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Anggota Pemohon</label>
                  <select
                    value={anggotaId}
                    onChange={(e) => setAnggotaId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {state.anggota.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama} (Plafon {formatRupiah(a.plafonAktifRp)} · {a.kategori})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tenor (Maks {maxTenor} bulan untuk {selectedAnggota?.kategori})
                  </label>
                  <select
                    value={tenorBulan}
                    onChange={(e) => setTenorBulan(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {Array.from({ length: maxTenor }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} bulan ({m * state.pengaturan.tarifJasaPerBulanPersen}% jasa total)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {state.komoditas.map((kom) => {
                  const harga = state.hargaAcuan.find((h) => h.komoditasId === kom.id)?.harga || 0;
                  const qty = itemQty[kom.id] || 0;
                  return (
                    <div key={kom.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{kom.nama}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {formatRupiah(harga)}/{kom.satuan} · Stok {kom.stokTotal} {kom.satuan}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={kom.stokTotal}
                          value={qty}
                          onChange={(e) =>
                            setItemQty({ ...itemQty, [kom.id]: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-20 px-2.5 py-1.5 text-right font-mono border border-slate-300 rounded-md"
                        />
                        <span className="text-xs text-slate-500 w-10">{kom.satuan}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-600">Nilai Pinjaman Terkunci</span>
                  <span className="font-mono font-semibold text-slate-900">{formatRupiah(nilaiBarang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Jasa ({state.pengaturan.tarifJasaPerBulanPersen}% × {tenorBulan} bulan)
                  </span>
                  <span className="font-mono text-slate-900">{formatRupiah(jasaRp)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 text-sm font-bold">
                  <span>Total Kewajiban Kembali</span>
                  <span className="font-mono text-red-700">{formatRupiah(totalKembali)}</span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Persetujuan:{' '}
                  {nilaiBarang > state.pengaturan.batasPersetujuanManajerRp
                    ? 'Memerlukan persetujuan Pengurus & konfirmasi Penjamin'
                    : 'Dapat disetujui Manajer Unit'}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={nilaiBarang <= 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Kirim Pengajuan Pinjaman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Angsuran */}
      {repayLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Catat Angsuran Pinjaman</h3>
                <p className="text-xs text-slate-500">
                  {repayLoan.kodePinjaman} · {repayLoan.anggotaNama} (Sisa {formatRupiah(repayLoan.sisaTagihanRp)})
                </p>
              </div>
              <button onClick={() => setRepayLoan(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRepaySubmit} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Metode Pembayaran</label>
                <select
                  value={metode}
                  onChange={(e) => setMetode(e.target.value as 'Tunai' | 'Transfer' | 'Barang Setara')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer">Transfer Bank</option>
                  <option value="Barang Setara">Barang Setara (Tambah Stok Gudang)</option>
                </select>
              </div>

              {metode === 'Barang Setara' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Komoditas</label>
                    <select
                      value={barangKomoditasId}
                      onChange={(e) => setBarangKomoditasId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {state.komoditas.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={barangJumlah}
                      onChange={(e) => setBarangJumlah(e.target.value)}
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nominal Bayar (Rp)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={jumlahRp}
                    onChange={(e) => setJumlahRp(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepayLoan(null)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                >
                  Simpan &amp; Cetak Kuitansi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
