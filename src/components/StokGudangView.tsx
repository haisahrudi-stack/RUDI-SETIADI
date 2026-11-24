import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Plus, X } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';

interface StokGudangViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function StokGudangView({ state, activeUser, onApiPost }: StokGudangViewProps) {
  const [tab, setTab] = useState<'posisi' | 'batch' | 'mutasi' | 'opname'>('posisi');
  const [showMutasi, setShowMutasi] = useState(false);
  const [showOpname, setShowOpname] = useState(false);

  const [mutForm, setMutForm] = useState({
    komoditasId: 'kom-telur',
    tipe: 'Masuk' as 'Masuk' | 'Keluar' | 'Penyusutan',
    jumlah: '20',
    kodeBatch: '',
    tanggalKedaluwarsa: '2027-06-30',
    catatan: '',
  });

  const [opnForm, setOpnForm] = useState({
    komoditasId: 'kom-beras-med',
    stokFisik: '420',
    catatan: 'Pengecekan timbangan fisik mingguan',
  });

  const canModifyStock = ['Admin', 'Petugas', 'Manajer'].includes(activeUser.peran);

  const sortedBatches = [...state.stokBatches]
    .filter((b) => b.jumlahSisa > 0)
    .sort((a, b) => a.tanggalKedaluwarsa.localeCompare(b.tanggalKedaluwarsa));

  const handleMutasi = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onApiPost(
      '/api/stok/mutasi',
      mutForm,
      `Mutasi stok (${mutForm.tipe}) berhasil dicatat.`
    );
    if (ok) setShowMutasi(false);
  };

  const handleOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onApiPost(
      '/api/stok/opname',
      opnForm,
      'Hasil stok opname berhasil disimpan dan stok sistem disesuaikan.'
    );
    if (ok) setShowOpname(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 5 · Metode FEFO (First Expired, First Out) · Target Selisih Opname &lt; 2%
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Stok &amp; Gudang Pangan</h2>
        </div>
        {canModifyStock && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const selectedKom = state.komoditas.find((k) => k.id === opnForm.komoditasId);
                if (selectedKom) setOpnForm({ ...opnForm, stokFisik: String(selectedKom.stokTotal) });
                setShowOpname(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-slate-600" />
              Stok Opname
            </button>
            <button
              onClick={() => setShowMutasi(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Catat Stok Masuk/Keluar
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(
          [
            ['posisi', 'Posisi Stok Komoditas'],
            ['batch', 'Urutan Batch FEFO'],
            ['mutasi', 'Riwayat Mutasi'],
            ['opname', 'Catatan Stok Opname'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              tab === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'posisi' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Komoditas</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Stok Tersedia</th>
                  <th className="py-3 px-4 text-right">Min / Maks</th>
                  <th className="py-3 px-4 text-right">Valuasi Acuan</th>
                  <th className="py-3 px-4">Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {state.komoditas.map((k) => {
                  const isLow = k.stokTotal <= k.stokMinimum;
                  const harga = state.hargaAcuan.find((h) => h.komoditasId === k.id)?.harga || 0;
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">{k.nama}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{k.kategori}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatAngka(k.stokTotal)} {k.satuan}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                        {k.stokMinimum} / {k.stokMaksimum} {k.satuan}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatRupiah(k.stokTotal * harga)}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" /> Stok Menipis (Perlu Belanja)
                          </span>
                        ) : (
                          <span className="text-emerald-700">Aman</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'batch' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Kode Batch</th>
                  <th className="py-3 px-4">Komoditas</th>
                  <th className="py-3 px-4">Tanggal Masuk</th>
                  <th className="py-3 px-4">Kedaluwarsa (Prioritas FEFO)</th>
                  <th className="py-3 px-4 text-right">Sisa / Awal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {sortedBatches.map((b) => {
                  const daysLeft = Math.round(
                    (new Date(b.tanggalKedaluwarsa).getTime() - new Date('2026-11-24T00:00:00Z').getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  const nearExpiry = daysLeft <= 30;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">{b.kodeBatch}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{b.komoditasNama}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{formatTanggal(b.tanggalMasuk)}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className={nearExpiry ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                          {formatTanggal(b.tanggalKedaluwarsa)}
                        </span>{' '}
                        <span className="text-slate-400">({daysLeft} hari lagi)</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900">
                        <strong>{formatAngka(b.jumlahSisa)}</strong> / {formatAngka(b.jumlahAwal)} {b.satuan}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mutasi' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Komoditas &amp; Batch</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4 text-right">Jumlah</th>
                  <th className="py-3 px-4">Referensi &amp; Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {state.stokMutasi.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 text-xs text-slate-600">{formatTanggal(m.tanggal)}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-900">{m.komoditasNama}</span>{' '}
                      <span className="font-mono text-xs text-slate-500">· {m.kodeBatch}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          m.tipe === 'Masuk' || m.tipe === 'Penyesuaian'
                            ? 'text-emerald-700'
                            : m.tipe === 'Penyusutan'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }
                      >
                        {m.tipe}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium">
                      {m.tipe === 'Masuk' ? '+' : '-'}{formatAngka(m.jumlah)} {m.satuan}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      {m.referensiTransaksi} · {m.petugasNama} · {m.catatan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'opname' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Komoditas</th>
                  <th className="py-3 px-4 text-right">Sistem</th>
                  <th className="py-3 px-4 text-right">Fisik</th>
                  <th className="py-3 px-4 text-right">Selisih (%)</th>
                  <th className="py-3 px-4">Petugas &amp; Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {state.stokOpname.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs text-slate-600">{formatTanggal(o.tanggal)}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{o.komoditasNama}</td>
                    <td className="py-3 px-4 text-right font-mono">{o.stokSistem} {o.satuan}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{o.stokFisik} {o.satuan}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={o.selisihPersen >= 2 ? 'text-red-700 font-bold' : 'text-emerald-700 font-medium'}>
                        {o.selisih > 0 ? `+${o.selisih}` : o.selisih} ({o.selisihPersen}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{o.petugasNama} · {o.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Mutasi Stok */}
      {showMutasi && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Catat Mutasi Stok Gudang</h3>
              <button onClick={() => setShowMutasi(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMutasi} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Komoditas</label>
                <select
                  value={mutForm.komoditasId}
                  onChange={(e) => setMutForm({ ...mutForm, komoditasId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {state.komoditas.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama} (Stok: {k.stokTotal} {k.satuan})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipe Mutasi</label>
                  <select
                    value={mutForm.tipe}
                    onChange={(e) => setMutForm({ ...mutForm, tipe: e.target.value as 'Masuk' | 'Keluar' | 'Penyusutan' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Masuk">Barang Masuk (Batch Baru)</option>
                    <option value="Keluar">Barang Keluar (FEFO)</option>
                    <option value="Penyusutan">Penyusutan / Rusak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={mutForm.jumlah}
                    onChange={(e) => setMutForm({ ...mutForm, jumlah: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              {mutForm.tipe === 'Masuk' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kode Batch (Opsional)</label>
                    <input
                      type="text"
                      value={mutForm.kodeBatch}
                      onChange={(e) => setMutForm({ ...mutForm, kodeBatch: e.target.value })}
                      placeholder="Otomatis"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Kedaluwarsa</label>
                    <input
                      type="date"
                      value={mutForm.tanggalKedaluwarsa}
                      onChange={(e) => setMutForm({ ...mutForm, tanggalKedaluwarsa: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={mutForm.catatan}
                  onChange={(e) => setMutForm({ ...mutForm, catatan: e.target.value })}
                  placeholder="Sumber pasokan / keterangan susut"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowMutasi(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">
                  Simpan Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Stok Opname */}
      {showOpname && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Catat Stok Opname Fisik</h3>
              <button onClick={() => setShowOpname(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOpname} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Komoditas</label>
                <select
                  value={opnForm.komoditasId}
                  onChange={(e) => {
                    const k = state.komoditas.find((x) => x.id === e.target.value);
                    setOpnForm({
                      ...opnForm,
                      komoditasId: e.target.value,
                      stokFisik: k ? String(k.stokTotal) : '0',
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {state.komoditas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} (Tercatat: {k.stokTotal} {k.satuan})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hasil Hitung Fisik Gudang</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={opnForm.stokFisik}
                  onChange={(e) => setOpnForm({ ...opnForm, stokFisik: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Pemeriksaan</label>
                <input
                  type="text"
                  value={opnForm.catatan}
                  onChange={(e) => setOpnForm({ ...opnForm, catatan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowOpname(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer">
                  Simpan Hasil Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
