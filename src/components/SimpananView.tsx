import { useState } from 'react';
import { Percent, Plus, X } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';

interface SimpananViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function SimpananView({ state, activeUser, onApiPost }: SimpananViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [anggotaId, setAnggotaId] = useState(state.anggota[0]?.id || '');
  const [tipe, setTipe] = useState<'Setor' | 'Ambil'>('Setor');
  const [bentuk, setBentuk] = useState<'Beras' | 'Uang'>('Beras');
  const [jumlahInput, setJumlahInput] = useState('10');
  const [catatan, setCatatan] = useState('');

  const canTransact = ['Admin', 'Petugas', 'Manajer', 'Bendahara', 'Pengurus'].includes(activeUser.peran);
  const canDistributeYield = ['Admin', 'Bendahara', 'Pengurus'].includes(activeUser.peran);

  const berasAcuan = state.hargaAcuan.find((h) => h.komoditasId === 'kom-beras-med')?.harga || 14000;
  const totalKg = state.anggota.reduce((s, a) => s + a.saldoSimpananKg, 0);
  const totalRp = state.anggota.reduce((s, a) => s + a.saldoSimpananRp, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onApiPost(
      '/api/simpanan',
      { anggotaId, tipe, bentuk, jumlahInput: Number(jumlahInput), catatan },
      `${tipe} Simpanan Pangan berhasil dicatat.`
    );
    if (ok) {
      setShowModal(false);
      setCatatan('');
    }
  };

  const handleBagiImbalan = async () => {
    await onApiPost(
      '/api/simpanan/bagi-imbalan',
      {},
      `Imbalan Simpanan Pangan ${state.pengaturan.imbalanSimpananPerBulanPersen}% bulan ini berhasil dibukukan ke seluruh anggota aktif.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 2 · Harga Acuan Beras Saat Ini {formatRupiah(berasAcuan)}/kg
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Simpanan Pangan Anggota</h2>
        </div>
        <div className="flex items-center gap-2">
          {canDistributeYield && (
            <button
              onClick={handleBagiImbalan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Percent className="w-3.5 h-3.5 text-emerald-700" />
              Bukukan Imbalan {state.pengaturan.imbalanSimpananPerBulanPersen}%/bln
            </button>
          )}
          {canTransact && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Setor / Ambil Simpanan
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Saldo Simpanan (Kilogram)</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">{formatAngka(totalKg, 1)} kg</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Valuasi Saldo Simpanan (Rupiah)</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">{formatRupiah(totalRp)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Imbalan Simpanan Berlaku</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {state.pengaturan.imbalanSimpananPerBulanPersen}% / bulan
          </p>
        </div>
      </div>

      {/* Buku Simpanan Digital */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Mutasi Buku Simpanan Pangan</h3>
          <span className="text-xs text-slate-500">{state.simpananPangan.length} transaksi tercatat</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Anggota</th>
                <th className="py-2.5 px-4">Jenis &amp; Bentuk</th>
                <th className="py-2.5 px-4 text-right">Setara Kg</th>
                <th className="py-2.5 px-4 text-right">Nilai (Rp)</th>
                <th className="py-2.5 px-4">Petugas &amp; Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {state.simpananPangan.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">{formatTanggal(s.tanggal)}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{s.anggotaNama}</td>
                  <td className="py-2.5 px-4 text-xs">
                    <span
                      className={
                        s.tipe === 'Ambil' || s.tipe === 'Potong Tunggakan'
                          ? 'text-red-700 font-medium'
                          : 'text-emerald-700 font-medium'
                      }
                    >
                      {s.tipe}
                    </span>{' '}
                    <span className="text-slate-500">· {s.bentuk}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-900">
                    {s.tipe === 'Ambil' || s.tipe === 'Potong Tunggakan' ? '-' : '+'}
                    {formatAngka(s.jumlahKg, 2)} kg
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                    {formatRupiah(s.nilaiRp)}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">
                    {s.petugasNama} · {s.catatan || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Catat Simpanan Pangan</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Anggota</label>
                <select
                  value={anggotaId}
                  onChange={(e) => setAnggotaId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {state.anggota.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nama} (Saldo: {formatAngka(a.saldoSimpananKg, 1)} kg)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipe</label>
                  <select
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value as 'Setor' | 'Ambil')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Setor">Setor Simpanan</option>
                    <option value="Ambil">Ambil Simpanan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bentuk</label>
                  <select
                    value={bentuk}
                    onChange={(e) => setBentuk(e.target.value as 'Beras' | 'Uang')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Beras">Beras (kg)</option>
                    <option value="Uang">Uang (Rp)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jumlah ({bentuk === 'Beras' ? 'kg' : 'Rupiah'})
                </label>
                <input
                  type="number"
                  min="1"
                  step={bentuk === 'Beras' ? '0.5' : '1000'}
                  value={jumlahInput}
                  onChange={(e) => setJumlahInput(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  required
                />
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Konversi:{' '}
                  {bentuk === 'Beras'
                    ? formatRupiah((Number(jumlahInput) || 0) * berasAcuan)
                    : `${formatAngka((Number(jumlahInput) || 0) / berasAcuan, 2)} kg beras`}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Keterangan opsional..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
