import { useState } from 'react';
import { Edit3, Lock, X } from 'lucide-react';
import { CooperativeState, HargaAcuan, Pengguna } from '../types/lumbung';
import { formatRupiah, formatTanggal } from '../utils/formatters';

interface HargaAcuanViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function HargaAcuanView({ state, activeUser, onApiPost }: HargaAcuanViewProps) {
  const [editing, setEditing] = useState<HargaAcuan | null>(null);
  const [hargaBaru, setHargaBaru] = useState('');
  const [catatan, setCatatan] = useState('');

  const canEdit = ['Admin', 'Manajer', 'Pengurus'].includes(activeUser.peran);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ok = await onApiPost(
      '/api/harga-acuan',
      { komoditasId: editing.komoditasId, hargaBaru: Number(hargaBaru), catatan },
      `Harga acuan ${editing.komoditasNama} diperbarui menjadi ${formatRupiah(Number(hargaBaru))}.`
    );
    if (ok) {
      setEditing(null);
      setCatatan('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 6 · Kunci Nilai Transaksi (Pinjaman berjalan tetap memakai harga saat pencairan)
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Harga Acuan Komoditas</h2>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <Lock className="w-3.5 h-3.5 text-emerald-700" />
          <span>Melindungi anggota &amp; koperasi dari sengketa fluktuasi harga</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Komoditas</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4 text-right">Harga Acuan Aktif</th>
                <th className="py-3 px-4">Berlaku Mulai</th>
                <th className="py-3 px-4">Ditetapkan Oleh</th>
                {canEdit && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {state.hargaAcuan.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{h.komoditasNama}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">per {h.satuan}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(h.harga)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{formatTanggal(h.berlakuMulai)}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{h.ditetapkanOleh}</td>
                  {canEdit && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditing(h);
                          setHargaBaru(String(h.harga));
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Ubah Harga
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat Perubahan Harga */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Riwayat Peninjauan Harga Bulanan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Komoditas</th>
                <th className="py-2.5 px-4 text-right">Harga Lama</th>
                <th className="py-2.5 px-4 text-right">Harga Baru</th>
                <th className="py-2.5 px-4">Penetap &amp; Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {state.riwayatHarga.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-4 text-xs text-slate-600">{formatTanggal(r.tanggal)}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{r.komoditasNama}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500">{formatRupiah(r.hargaLama)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">{formatRupiah(r.hargaBaru)}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">{r.ditetapkanOleh} · {r.catatan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Tetapkan Harga Acuan Baru</h3>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-900">{editing.komoditasNama}</p>
                <p>Harga sebelumnya: {formatRupiah(editing.harga)}/{editing.satuan}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Harga Acuan Baru (Rp)</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={hargaBaru}
                  onChange={(e) => setHargaBaru(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan Penyesuaian</label>
                <input
                  type="text"
                  required
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Peninjauan harga pasar Banyuwangi awal bulan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">
                  Simpan Harga Acuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
