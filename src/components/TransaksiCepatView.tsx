import { useState } from 'react';
import { QrCode, Search, CheckCircle2, ArrowDownLeft, ArrowUpRight, PackageCheck, Banknote } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';
import { QrCodeBox } from './QrCodeBox';

interface TransaksiCepatViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function TransaksiCepatView({ state, activeUser, onApiPost }: TransaksiCepatViewProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(state.anggota[0]?.id || '');
  const [mode, setMode] = useState<'setor' | 'ambil' | 'serah' | 'bayar'>('setor');

  // Form states
  const [bentuk, setBentuk] = useState<'Beras' | 'Uang'>('Beras');
  const [jumlahSimpanan, setJumlahSimpanan] = useState('5');
  const [catatanSimpanan, setCatatanSimpanan] = useState('');

  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'Transfer' | 'Barang Setara'>('Tunai');
  const [jumlahBayarRp, setJumlahBayarRp] = useState('108000');
  const [barangKomoditasId, setBarangKomoditasId] = useState('kom-beras-med');
  const [barangJumlah, setBarangJumlah] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  const filteredMembers = state.anggota.filter(
    (a) =>
      a.nama.toLowerCase().includes(query.toLowerCase()) ||
      a.nomorAnggota.toLowerCase().includes(query.toLowerCase())
  );

  const member = state.anggota.find((a) => a.id === selectedId) || filteredMembers[0];
  const memberLoansDisetujui = state.pinjaman.filter(
    (p) => p.anggotaId === member?.id && p.status === 'Disetujui'
  );
  const memberLoansBerjalan = state.pinjaman.filter(
    (p) =>
      p.anggotaId === member?.id &&
      ['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(p.status)
  );

  const berasHarga = state.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000;
  const barangHarga = state.hargaAcuan.find((h) => h.komoditasId === barangKomoditasId)?.harga || 14000;

  const handleSimulasiQrScan = () => {
    // Memilih anggota yang memiliki pinjaman siap serah atau berjalan untuk mempercepat demo pemindai QR
    const nextIdx = (state.anggota.findIndex((a) => a.id === selectedId) + 1) % state.anggota.length;
    const picked = state.anggota[nextIdx];
    if (picked) {
      setSelectedId(picked.id);
      setQuery(picked.nomorAnggota);
    }
  };

  const handleSimpananSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSubmitting(true);
    await onApiPost(
      '/api/simpanan',
      {
        anggotaId: member.id,
        tipe: mode === 'ambil' ? 'Ambil' : 'Setor',
        bentuk,
        jumlahInput: Number(jumlahSimpanan),
        catatan: catatanSimpanan,
      },
      `${mode === 'ambil' ? 'Pengambilan' : 'Setoran'} Simpanan Pangan ${member.nama} berhasil dicatat.`
    );
    setSubmitting(false);
    setCatatanSimpanan('');
  };

  const handleSerahTerima = async (loanId: string) => {
    setSubmitting(true);
    await onApiPost(
      `/api/pinjaman/${loanId}/serah-terima`,
      {},
      'Barang pinjaman telah diserahkan dan stok gudang otomatis berkurang.'
    );
    setSubmitting(false);
  };

  const handleBayarAngsuran = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetLoan =
      memberLoansBerjalan.find((l) => l.id === selectedLoanId) || memberLoansBerjalan[0];
    if (!targetLoan) return;
    setSubmitting(true);
    await onApiPost(
      `/api/pinjaman/${targetLoan.id}/angsuran`,
      {
        metode: metodeBayar,
        jumlahRp: Number(jumlahBayarRp),
        barangKomoditasId,
        barangJumlah: Number(barangJumlah),
      },
      `Pembayaran angsuran ${targetLoan.kodePinjaman} berhasil dicatat.`
    );
    setSubmitting(false);
  };

  const canSerahTerima = ['Admin', 'Operator', 'Petugas'].includes(activeUser.peran);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">Loket Pelayanan Terpadu · {activeUser.nama}</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Transaksi Cepat & Pemindai QR</h2>
        </div>
        <button
          type="button"
          onClick={handleSimulasiQrScan}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <QrCode className="w-4 h-4 text-red-700" />
          Pindai QR Anggota Berikutnya
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel Pencarian & Identitas Anggota */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor QR anggota (mis. KKMP-SGT...)"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  member?.id === m.id ? 'bg-red-50/70 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm text-slate-900">{m.nama}</p>
                  <p className="font-mono text-[11px] text-slate-500">{m.nomorAnggota} · {m.rtRw}</p>
                </div>
                <span className="font-mono font-medium text-slate-700 tabular-nums">
                  {formatAngka(m.saldoSimpananKg, 1)} kg
                </span>
              </button>
            ))}
          </div>

          {member && (
            <div className="pt-3 border-t border-slate-200 flex items-start gap-4">
              <QrCodeBox value={member.nomorAnggota} size={88} />
              <div className="min-w-0 flex-1 space-y-1 text-xs">
                <p className="text-base font-bold text-slate-900 truncate">{member.nama}</p>
                <p className="font-mono text-slate-500">{member.nomorAnggota}</p>
                <p className="text-slate-600">{member.kategori} · Skor Kelayakan {member.skorKelayakan}/100</p>
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block">Simpanan Pangan</span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      {formatAngka(member.saldoSimpananKg, 1)} kg ({formatRupiah(member.saldoSimpananRp)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Plafon Pinjaman</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiah(member.plafonAktifRp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel Aksi Transaksi 1 Layar */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('setor')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'setor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Setor
            </button>
            <button
              type="button"
              onClick={() => setMode('ambil')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'ambil' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Ambil
            </button>
            <button
              type="button"
              onClick={() => setMode('serah')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'serah' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" /> Serah Terima
            </button>
            <button
              type="button"
              onClick={() => setMode('bayar')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'bayar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" /> Bayar Angsuran
            </button>
          </div>

          {(mode === 'setor' || mode === 'ambil') && member && (
            <form onSubmit={handleSimpananSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bentuk Transaksi</label>
                  <select
                    value={bentuk}
                    onChange={(e) => setBentuk(e.target.value as 'Beras' | 'Uang')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Beras">Beras (kg)</option>
                    <option value="Uang">Uang Tunai (Rp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jumlah ({bentuk === 'Beras' ? 'kg' : 'Rupiah'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step={bentuk === 'Beras' ? '0.5' : '1000'}
                    value={jumlahSimpanan}
                    onChange={(e) => setJumlahSimpanan(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs flex items-center justify-between">
                <span className="text-slate-600">Konversi Acuan Beras ({formatRupiah(berasHarga)}/kg):</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {bentuk === 'Beras'
                    ? `${jumlahSimpanan || 0} kg = ${formatRupiah((Number(jumlahSimpanan) || 0) * berasHarga)}`
                    : `${formatRupiah(Number(jumlahSimpanan) || 0)} = ${formatAngka((Number(jumlahSimpanan) || 0) / berasHarga, 2)} kg`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Loket</label>
                <input
                  type="text"
                  value={catatanSimpanan}
                  onChange={(e) => setCatatanSimpanan(e.target.value)}
                  placeholder="Contoh: Setoran simpanan rutin minggu ke-4"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? 'Memproses...'
                  : mode === 'setor'
                    ? 'Catat Setoran Simpanan'
                    : 'Catat Pengambilan Simpanan'}
              </button>
            </form>
          )}

          {mode === 'serah' && member && (
            <div className="space-y-3">
              {memberLoansDisetujui.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
                  Tidak ada pinjaman berstatus <strong>Disetujui</strong> untuk {member.nama} saat ini.
                </div>
              ) : (
                memberLoansDisetujui.map((loan) => (
                  <div key={loan.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{loan.kodePinjaman} · {formatRupiah(loan.nilaiPinjamanRp)}</p>
                        <p className="text-xs text-slate-500">
                          Disetujui oleh {loan.penyetujuNama} ({loan.penyetujuPeran})
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canSerahTerima || submitting}
                        onClick={() => handleSerahTerima(loan.id)}
                        className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        Serahkan Barang &amp; Potong Stok
                      </button>
                    </div>
                    {!canSerahTerima && (
                      <p className="text-xs text-amber-700">
                        Pemisahan tugas: Hanya Admin, Operator Loket, atau Petugas Gudang yang dapat melakukan serah terima fisik barang.
                      </p>
                    )}
                    <ul className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2">
                      {loan.items.map((it, idx) => (
                        <li key={idx} className="flex justify-between tabular-nums">
                          <span>{it.komoditasNama}</span>
                          <span className="font-mono">{it.jumlah} {it.satuan}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}

          {mode === 'bayar' && member && (
            <div className="space-y-4">
              {memberLoansBerjalan.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
                  {member.nama} tidak memiliki tagihan pinjaman aktif.
                </div>
              ) : (
                <form onSubmit={handleBayarAngsuran} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Pinjaman Berjalan</label>
                    <select
                      value={selectedLoanId || memberLoansBerjalan[0].id}
                      onChange={(e) => {
                        setSelectedLoanId(e.target.value);
                        const found = memberLoansBerjalan.find((l) => l.id === e.target.value);
                        if (found) setJumlahBayarRp(String(found.sisaTagihanRp));
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {memberLoansBerjalan.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.kodePinjaman} — Sisa {formatRupiah(l.sisaTagihanRp)} (Jatuh tempo {formatTanggal(l.tanggalJatuhTempo)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Metode Pengembalian</label>
                      <select
                        value={metodeBayar}
                        onChange={(e) => setMetodeBayar(e.target.value as 'Tunai' | 'Transfer' | 'Barang Setara')}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="Tunai">Tunai di Loket</option>
                        <option value="Transfer">Transfer Rekening Koperasi</option>
                        <option value="Barang Setara">Barang Setara (Konversi Acuan)</option>
                      </select>
                    </div>

                    {metodeBayar === 'Barang Setara' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Komoditas Diserahkan</label>
                        <select
                          value={barangKomoditasId}
                          onChange={(e) => setBarangKomoditasId(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        >
                          {state.komoditas.map((k) => (
                            <option key={k.id} value={k.id}>{k.nama} ({k.satuan})</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Nominal Bayar (Rp)</label>
                        <input
                          type="number"
                          min="1000"
                          step="1000"
                          value={jumlahBayarRp}
                          onChange={(e) => setJumlahBayarRp(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {metodeBayar === 'Barang Setara' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah Barang</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={barangJumlah}
                          onChange={(e) => setBarangJumlah(e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-500 block">Nilai Konversi Masuk Stok</span>
                        <span className="text-base font-mono font-bold text-emerald-700 tabular-nums">
                          {formatRupiah((Number(barangJumlah) || 0) * barangHarga)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Catat Pembayaran & Terbitkan Kuitansi'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
