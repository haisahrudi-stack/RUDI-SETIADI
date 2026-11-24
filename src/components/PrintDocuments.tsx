import { Printer, X } from 'lucide-react';
import { Angsuran, CooperativeState, Pinjaman } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';

interface PrintModalProps {
  type: 'berita-acara' | 'kuitansi' | 'laporan-rat';
  loan?: Pinjaman;
  angsuran?: Angsuran;
  state: CooperativeState;
  onClose: () => void;
}

export function PrintDocumentModal({ type, loan, angsuran, state, onClose }: PrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const member = loan
    ? state.anggota.find((a) => a.id === loan.anggotaId)
    : angsuran
      ? state.anggota.find((a) => a.id === angsuran.anggotaId)
      : undefined;

  const totalSimpananRp = state.anggota.reduce((s, a) => s + a.saldoSimpananRp, 0);
  const totalSimpananKg = state.anggota.reduce((s, a) => s + a.saldoSimpananKg, 0);
  const totalPokokWajib = state.anggota.reduce((s, a) => s + a.simpananPokokRp + a.simpananWajibRp, 0);
  const pinjamanAktif = state.pinjaman.filter((p) => ['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(p.status));
  const totalPiutangBerjalan = pinjamanAktif.reduce((s, p) => s + p.sisaTagihanRp, 0);
  const totalJasaLunas = state.pinjaman
    .filter((p) => p.status === 'Lunas')
    .reduce((s, p) => s + p.jasaRp, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full shadow-xl overflow-hidden my-auto">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {type === 'berita-acara' && 'Pratinjau Berita Acara Serah Terima'}
              {type === 'kuitansi' && 'Pratinjau Kuitansi Pembayaran'}
              {type === 'laporan-rat' && 'Pratinjau Laporan Rapat Anggota (RAT)'}
            </h3>
            <p className="text-xs text-slate-500">Dokumen resmi siap cetak · {state.pengaturan.namaKoperasi}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="print-document p-8 bg-white text-slate-900 space-y-6 text-sm max-h-[80vh] overflow-y-auto">
          {/* Kop Dokumen Koperasi */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-red-700">UNIT USAHA {state.pengaturan.namaUnit}</p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">{state.pengaturan.namaKoperasi}</h1>
              <p className="text-xs text-slate-600 mt-1">{state.pengaturan.alamatKoperasi}</p>
              <p className="text-xs text-slate-600">Kontak Layanan: {state.pengaturan.kontakWhatsApp} · {state.pengaturan.jamLayanan}</p>
            </div>
            <div className="text-right shrink-0 font-mono text-xs text-slate-600">
              <p className="font-semibold text-slate-900">
                {type === 'berita-acara' && loan?.kodePinjaman}
                {type === 'kuitansi' && angsuran?.nomorKuitansi}
                {type === 'laporan-rat' && 'LAP-RAT-2026'}
              </p>
              <p>Banyuwangi, {formatTanggal(new Date().toISOString())}</p>
            </div>
          </div>

          {type === 'berita-acara' && loan && (
            <>
              <div className="text-center">
                <h2 className="text-lg font-bold underline underline-offset-4">BERITA ACARA SERAH TERIMA PINJAMAN PANGAN</h2>
                <p className="text-xs text-slate-600 mt-1">Nomor Transaksi: {loan.kodePinjaman}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div className="space-y-1">
                  <p className="text-slate-500">Penerima Pinjaman (Anggota)</p>
                  <p className="font-semibold text-slate-900 text-sm">{loan.anggotaNama}</p>
                  <p className="text-slate-600">No. Anggota: {member?.nomorAnggota || '-'}</p>
                  <p className="text-slate-600">{member?.alamat || '-'} ({member?.rtRw || '-'})</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500">Ketentuan Pinjaman (Nilai Terkunci)</p>
                  <p className="text-slate-700">Tanggal Serah Terima: <span className="font-medium">{formatTanggal(loan.tanggalSerahTerima || loan.tanggalPengajuan)}</span></p>
                  <p className="text-slate-700">Tenor & Jasa: <span className="font-medium">{loan.tenorBulan} bulan · {loan.tarifJasaPersen}%/bln</span></p>
                  <p className="text-slate-700">Jatuh Tempo: <span className="font-semibold text-red-700">{formatTanggal(loan.tanggalJatuhTempo)}</span></p>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 px-3 py-2 text-left">Komoditas</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Jumlah</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Harga Acuan Terkunci</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Nilai (Rp)</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {loan.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 px-3 py-2 font-medium">{item.komoditasNama}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right">{formatAngka(item.jumlah)} {item.satuan}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right">{formatRupiah(item.hargaSaatTransaksi)}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-medium">{formatRupiah(item.subtotalRp)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right font-medium">Total Nilai Barang Pokok</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-semibold">{formatRupiah(loan.nilaiPinjamanRp)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">Jasa Koperasi ({loan.tarifJasaPersen}% × {loan.tenorBulan} bulan)</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">{formatRupiah(loan.jasaRp)}</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">Total Kewajiban Pengembalian</td>
                    <td className="border border-slate-300 px-3 py-2 text-right text-slate-900">{formatRupiah(loan.totalKembaliRp)}</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-xs text-slate-600 leading-relaxed">
                Barang bahan pokok tersebut di atas telah diperiksa bersama dalam kondisi baik, timbangan tepat, dan diterima oleh anggota. Nilai pinjaman dikunci sesuai harga acuan pada saat transaksi dan dapat dilunasi menggunakan uang atau bahan pokok setara sesuai harga acuan koperasi yang berlaku saat pembayaran.
              </p>

              <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs">
                <div>
                  <p className="text-slate-600">Disetujui Oleh ({loan.penyetujuPeran || 'Manajer'}),</p>
                  <div className="h-16" />
                  <p className="font-semibold underline">{loan.penyetujuNama || 'Pengurus Unit'}</p>
                </div>
                <div>
                  <p className="text-slate-600">Diserahkan Oleh (Petugas Gudang),</p>
                  <div className="h-16" />
                  <p className="font-semibold underline">{loan.petugasSerahNama || 'Petugas Loket'}</p>
                </div>
                <div>
                  <p className="text-slate-600">Diterima Oleh (Anggota),</p>
                  <div className="h-16" />
                  <p className="font-semibold underline">{loan.anggotaNama}</p>
                </div>
              </div>
            </>
          )}

          {type === 'kuitansi' && angsuran && (
            <>
              <div className="text-center">
                <h2 className="text-lg font-bold underline underline-offset-4">KUITANSI PEMBAYARAN ANGSURAN</h2>
                <p className="text-xs text-slate-600 mt-1">Nomor Kuitansi: {angsuran.nomorKuitansi}</p>
              </div>

              <div className="border border-slate-300 rounded-lg p-5 space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Telah diterima dari</span>
                  <span className="col-span-2 font-semibold">{angsuran.anggotaNama} ({member?.nomorAnggota || '-'})</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Referensi Pinjaman</span>
                  <span className="col-span-2 font-mono">{angsuran.kodePinjaman}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Metode Pembayaran</span>
                  <span className="col-span-2 font-medium">
                    {angsuran.metode}
                    {angsuran.barangDetail &&
                      ` — ${angsuran.barangDetail.jumlah} ${angsuran.barangDetail.satuan} ${angsuran.barangDetail.komoditasNama} (@ ${formatRupiah(angsuran.barangDetail.hargaKonversi)})`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Jumlah Pembayaran</span>
                  <span className="col-span-2 text-lg font-bold tabular-nums text-slate-900">{formatRupiah(angsuran.jumlahRp)}</span>
                </div>
                {loan && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Sisa Tagihan Pinjaman</span>
                    <span className="col-span-2 font-semibold tabular-nums">
                      {formatRupiah(loan.sisaTagihanRp)} ({loan.status})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-end pt-6 text-xs">
                <p className="text-slate-500">Catatan: {angsuran.catatan || 'Pembayaran tercatat sah dalam sistem Lumbung Pangan.'}</p>
                <div className="text-center min-w-[180px]">
                  <p className="text-slate-600">Petugas Penerima,</p>
                  <div className="h-14" />
                  <p className="font-semibold underline">{angsuran.petugasNama}</p>
                </div>
              </div>
            </>
          )}

          {type === 'laporan-rat' && (
            <>
              <div className="text-center">
                <h2 className="text-lg font-bold underline underline-offset-4">RINGKASAN LAPORAN RAPAT ANGGOTA TAHUNAN (RAT)</h2>
                <p className="text-xs text-slate-600 mt-1">Periode Berjalan · November 2026</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-300 rounded-lg p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1">1. Keanggotaan & Simpanan</h3>
                  <div className="flex justify-between"><span>Total Anggota Aktif</span><span className="font-mono font-semibold">{state.anggota.filter((a) => a.status === 'Aktif').length} orang</span></div>
                  <div className="flex justify-between"><span>Simpanan Pokok & Wajib</span><span className="font-mono font-semibold">{formatRupiah(totalPokokWajib)}</span></div>
                  <div className="flex justify-between"><span>Saldo Simpanan Pangan</span><span className="font-mono font-semibold">{formatAngka(totalSimpananKg, 1)} kg · {formatRupiah(totalSimpananRp)}</span></div>
                </div>
                <div className="border border-slate-300 rounded-lg p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1">2. Pinjaman, Jasa & Cadangan</h3>
                  <div className="flex justify-between"><span>Piutang Pinjaman Berjalan</span><span className="font-mono font-semibold">{formatRupiah(totalPiutangBerjalan)}</span></div>
                  <div className="flex justify-between"><span>Pendapatan Jasa Terealisasi</span><span className="font-mono font-semibold">{formatRupiah(totalJasaLunas)}</span></div>
                  <div className="flex justify-between">
                    <span>Cadangan Piutang ({state.pengaturan.cadanganPiutangTakTertagihPersen}%)</span>
                    <span className="font-mono font-semibold">{formatRupiah(totalPiutangBerjalan * (state.pengaturan.cadanganPiutangTakTertagihPersen / 100))}</span>
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left">Komoditas Gudang</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Stok Tersedia</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Harga Acuan</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Valuasi Persediaan</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {state.komoditas.map((k) => {
                    const harga = state.hargaAcuan.find((h) => h.komoditasId === k.id)?.harga || 0;
                    return (
                      <tr key={k.id}>
                        <td className="border border-slate-300 px-3 py-1.5">{k.nama}</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right">{formatAngka(k.stokTotal)} {k.satuan}</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right">{formatRupiah(harga)}</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-right font-medium">{formatRupiah(k.stokTotal * harga)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
