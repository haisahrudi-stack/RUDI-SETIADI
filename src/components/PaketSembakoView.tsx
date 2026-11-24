import { useState } from 'react';
import { CheckCircle2, Package, Plus, ShoppingBag, X } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatRupiah, formatTanggal } from '../utils/formatters';

interface PaketSembakoViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function PaketSembakoView({ state, activeUser, onApiPost }: PaketSembakoViewProps) {
  const [showOrder, setShowOrder] = useState<string | null>(null);
  const [showNewPkg, setShowNewPkg] = useState(false);

  const [anggotaId, setAnggotaId] = useState(state.anggota[0]?.id || '');
  const [tenorMingguan, setTenorMingguan] = useState<4 | 8>(4);

  const [newNama, setNewNama] = useState('');
  const [newDeskripsi, setNewDeskripsi] = useState('');
  const [newMargin, setNewMargin] = useState('5');
  const [newItems, setNewItems] = useState<{ komoditasId: string; jumlah: number }[]>([
    { komoditasId: 'kom-beras-med', jumlah: 5 },
    { komoditasId: 'kom-minyak', jumlah: 1 },
  ]);

  const canManagePkg = ['Admin', 'Manajer', 'Pengurus'].includes(activeUser.peran);
  const canOrder = ['Admin', 'Petugas', 'Manajer'].includes(activeUser.peran);
  const canPay = ['Admin', 'Petugas', 'Bendahara'].includes(activeUser.peran);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOrder) return;
    const ok = await onApiPost(
      '/api/pesanan-paket',
      { anggotaId, paketId: showOrder, tenorMingguan },
      'Pesanan Paket Sembako Cicil berhasil dibuat dan stok gudang diperbarui.'
    );
    if (ok) setShowOrder(null);
  };

  const handleCreatePkg = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onApiPost(
      '/api/paket-sembako',
      { nama: newNama, deskripsi: newDeskripsi, marginPersen: Number(newMargin), isi: newItems },
      `Paket baru "${newNama}" berhasil ditambahkan ke katalog.`
    );
    if (ok) {
      setShowNewPkg(false);
      setNewNama('');
      setNewDeskripsi('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 4 · Margin Maks {state.pengaturan.marginMaksPaketPersen}% · Batas {state.pengaturan.maksPaketAktifPerAnggota} Paket Aktif/Anggota
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Paket Sembako Cicil</h2>
        </div>
        {canManagePkg && (
          <button
            onClick={() => setShowNewPkg(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Buat Paket Baru
          </button>
        )}
      </div>

      {/* Katalog Paket */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {state.paketSembako.map((pkt) => (
          <div key={pkt.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
              <img
                src={pkt.gambarUrl}
                alt={pkt.nama}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-slate-500 tabular-nums">
                  <span>Pokok {formatRupiah(pkt.hargaPokokRp)}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="text-emerald-700 font-medium">Margin {pkt.marginPersen}%</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{pkt.nama}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{pkt.deskripsi}</p>
                <ul className="text-xs text-slate-700 space-y-1 pt-2 border-t border-slate-100">
                  {pkt.isi.map((it, idx) => (
                    <li key={idx} className="flex justify-between tabular-nums">
                      <span>{it.komoditasNama}</span>
                      <span className="font-mono font-medium">{it.jumlah} {it.satuan}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-500">Harga Jual (4x / 8x minggu)</p>
                  <p className="text-lg font-bold font-mono text-slate-900 tabular-nums">{formatRupiah(pkt.hargaJualRp)}</p>
                </div>
                {canOrder && (
                  <button
                    onClick={() => setShowOrder(pkt.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Pesankan
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daftar Pesanan & Cicilan Mingguan */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Pesanan Paket &amp; Jadwal Cicilan Mingguan</h3>
          <span className="text-xs text-slate-500">{state.pesananPaket.length} pesanan</span>
        </div>
        <div className="divide-y divide-slate-100">
          {state.pesananPaket.map((ord) => {
            const paidCount = ord.jadwalCicilan.filter((j) => j.lunas).length;
            return (
              <div key={ord.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">{ord.kodePesanan}</span>
                    <span aria-hidden="true">·</span>
                    <span className={ord.status === 'Lunas' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      {ord.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Dipesan {formatTanggal(ord.tanggalPesan)}</span>
                  </div>
                  <h4 className="font-bold text-slate-900">
                    {ord.anggotaNama} — <span className="font-medium text-slate-700">{ord.paketNama}</span>
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ord.jadwalCicilan.map((slot) => (
                      <span
                        key={slot.ke}
                        className={`text-[11px] font-mono tabular-nums px-2 py-1 rounded border ${
                          slot.lunas
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        M{slot.ke}: {slot.lunas ? 'Lunas' : formatTanggal(slot.jatuhTempo)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 tabular-nums">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      Terbayar {paidCount}/{ord.tenorMingguan} minggu ({formatRupiah(ord.cicilanPerMingguRp)}/mg)
                    </p>
                    <p className="text-base font-bold font-mono text-slate-900">
                      Sisa {formatRupiah(ord.sisaTagihanRp)}
                    </p>
                  </div>
                  {ord.status === 'Aktif' && canPay && (
                    <button
                      onClick={() =>
                        onApiPost(
                          `/api/pesanan-paket/${ord.id}/bayar-cicilan`,
                          {},
                          `Cicilan mingguan ${ord.kodePesanan} berhasil dibukukan.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Bayar 1 Minggu
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Pesan Paket */}
      {showOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Pemesanan Paket Sembako Cicil</h3>
              <button onClick={() => setShowOrder(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOrder} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Anggota Pemesan</label>
                <select
                  value={anggotaId}
                  onChange={(e) => setAnggotaId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {state.anggota.map((a) => (
                    <option key={a.id} value={a.id}>{a.nama} ({a.nomorAnggota})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Skema Cicilan Mingguan</label>
                <select
                  value={tenorMingguan}
                  onChange={(e) => setTenorMingguan(Number(e.target.value) as 4 | 8)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value={4}>4 Minggu (1 bulan)</option>
                  <option value={8}>8 Minggu (2 bulan)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowOrder(null)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">
                  Proses Pesanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Paket Baru */}
      {showNewPkg && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Tambah Paket Sembako</h3>
              <button onClick={() => setShowNewPkg(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePkg} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Paket</label>
                <input
                  type="text"
                  required
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Contoh: Paket Sahur & Berbuka"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={newDeskripsi}
                  onChange={(e) => setNewDeskripsi(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Margin Usaha (Maks {state.pengaturan.marginMaksPaketPersen}%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={state.pengaturan.marginMaksPaketPersen}
                  value={newMargin}
                  onChange={(e) => setNewMargin(e.target.value)}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">Isi Komoditas</label>
                  <button
                    type="button"
                    onClick={() => setNewItems([...newItems, { komoditasId: 'kom-gula', jumlah: 1 }])}
                    className="text-xs text-red-700 font-medium cursor-pointer"
                  >
                    + Tambah Item
                  </button>
                </div>
                {newItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    <select
                      value={it.komoditasId}
                      onChange={(e) => {
                        const copy = [...newItems];
                        copy[idx].komoditasId = e.target.value;
                        setNewItems(copy);
                      }}
                      className="col-span-2 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                    >
                      {state.komoditas.map((k) => (
                        <option key={k.id} value={k.id}>{k.nama} ({k.satuan})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={it.jumlah}
                      onChange={(e) => {
                        const copy = [...newItems];
                        copy[idx].jumlah = Number(e.target.value);
                        setNewItems(copy);
                      }}
                      className="px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewPkg(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">
                  <Package className="w-4 h-4" /> Simpan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
