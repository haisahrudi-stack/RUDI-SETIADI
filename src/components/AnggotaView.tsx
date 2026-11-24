import { useState } from 'react';
import { Plus, Search, UserCheck, X } from 'lucide-react';
import { Anggota, CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal } from '../utils/formatters';
import { QrCodeBox } from './QrCodeBox';

interface AnggotaViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
  onApiPatch: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function AnggotaView({ state, activeUser, onApiPost, onApiPatch }: AnggotaViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Petani'>('Semua');
  const [selected, setSelected] = useState<Anggota | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    nama: '',
    alamat: '',
    rtRw: 'RT 01 / RW 01',
    hp: '',
    noIdentitas: '',
    kategori: 'Umum' as 'Umum' | 'Petani',
    penjaminNama: '',
    penjaminHp: '',
    simpananPokokRp: 100000,
    simpananWajibRp: 20000,
  });

  const canRegister = ['Admin', 'Operator', 'Petugas', 'Manajer', 'Pengurus'].includes(activeUser.peran);
  const canToggleStatus = ['Manajer', 'Pengurus', 'Admin'].includes(activeUser.peran);

  const filtered = state.anggota.filter((a) => {
    const matchText =
      a.nama.toLowerCase().includes(search.toLowerCase()) ||
      a.nomorAnggota.toLowerCase().includes(search.toLowerCase()) ||
      a.rtRw.toLowerCase().includes(search.toLowerCase());
    if (!matchText) return false;
    if (statusFilter === 'Aktif') return a.status === 'Aktif';
    if (statusFilter === 'Petani') return a.kategori === 'Petani';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onApiPost(
      '/api/anggota',
      form,
      `Anggota baru ${form.nama} berhasil didaftarkan dan kartu QR diterbitkan.`
    );
    if (ok) {
      setShowAdd(false);
      setForm({
        nama: '',
        alamat: '',
        rtRw: 'RT 01 / RW 01',
        hp: '',
        noIdentitas: '',
        kategori: 'Umum',
        penjaminNama: '',
        penjaminHp: '',
        simpananPokokRp: 100000,
        simpananWajibRp: 20000,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">Modul 1 · Data Induk Warga &amp; Kartu Digital QR</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Keanggotaan Koperasi</h2>
        </div>
        {canRegister && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Daftarkan Anggota Baru
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, nomor anggota, atau RT/RW..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(['Semua', 'Aktif', 'Petani'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                statusFilter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Anggota */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Nomor &amp; Nama Anggota</th>
                <th className="py-3 px-4">Wilayah</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Simpanan Pangan</th>
                <th className="py-3 px-4 text-right">Skor &amp; Plafon</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{a.nama}</p>
                    <p className="font-mono text-xs text-slate-500">{a.nomorAnggota} · {a.hp}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{a.rtRw}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">{a.kategori}</td>
                  <td className="py-3 px-4 text-right">
                    <p className="font-mono font-medium text-slate-900">{formatAngka(a.saldoSimpananKg, 1)} kg</p>
                    <p className="font-mono text-xs text-slate-500">{formatRupiah(a.saldoSimpananRp)}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className="font-mono font-semibold text-slate-900">{formatRupiah(a.plafonAktifRp)}</p>
                    <p className="text-xs text-slate-500">Skor {a.skorKelayakan}/100</p>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium">
                    <span className={a.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-500'}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelected(a)}
                      className="text-xs font-medium text-red-700 hover:text-red-800 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Kartu &amp; Profil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Kartu Anggota QR Drawer/Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-medium text-red-700">Kartu Anggota Digital · KKMP Singotrunan</p>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{selected.nama}</h3>
                <p className="font-mono text-xs text-slate-500">{selected.nomorAnggota}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-slate-50 p-4 rounded-xl border border-slate-200">
              <QrCodeBox value={selected.nomorAnggota} size={120} label={selected.nomorAnggota} />
              <div className="flex-1 space-y-1.5 text-xs w-full">
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Alamat</span>
                  <span className="font-medium text-slate-900 text-right">{selected.alamat} ({selected.rtRw})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Identitas (Terbatas UU PDP)</span>
                  <span className="font-mono text-slate-700">{selected.noIdentitasMask}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Bergabung Sejak</span>
                  <span className="text-slate-900">{formatTanggal(selected.tanggalBergabung)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Penjamin</span>
                  <span className="text-slate-900">{selected.penjaminNama}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Skor Kelayakan &amp; Plafon</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selected.skorKelayakan}/100 · {formatRupiah(selected.plafonAktifRp)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {canToggleStatus ? (
                <button
                  onClick={async () => {
                    const nextStatus = selected.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
                    const ok = await onApiPatch(
                      `/api/anggota/${selected.id}/status`,
                      { status: nextStatus },
                      `Status anggota ${selected.nama} diubah menjadi ${nextStatus}.`
                    );
                    if (ok) setSelected(null);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer"
                >
                  {selected.status === 'Aktif' ? 'Nonaktifkan Keanggotaan' : 'Aktifkan Kembali'}
                </button>
              ) : (
                <span className="text-xs text-slate-400">Simpanan Pokok {formatRupiah(selected.simpananPokokRp)}</span>
              )}
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Anggota */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Pendaftaran Anggota Baru</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap (sesuai KTP)</label>
                <input
                  type="text"
                  required
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">RT / RW</label>
                  <input
                    type="text"
                    required
                    value={form.rtRw}
                    onChange={(e) => setForm({ ...form, rtRw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nomor HP / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={form.hp}
                    onChange={(e) => setForm({ ...form, hp: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Domisili Singotrunan</label>
                <input
                  type="text"
                  required
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIK (disimpan tersamar UU PDP)</label>
                  <input
                    type="text"
                    value={form.noIdentitas}
                    onChange={(e) => setForm({ ...form, noIdentitas: e.target.value })}
                    placeholder="3510xxxxxxxxxxxx"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kategori Anggota</label>
                  <select
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value as 'Umum' | 'Petani' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Umum">Umum (Tenor s.d. 3 bln)</option>
                    <option value="Petani">Petani (Tenor s.d. 4 bln)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nama Penjamin (Ketua RT/Anggota)</label>
                  <input
                    type="text"
                    value={form.penjaminNama}
                    onChange={(e) => setForm({ ...form, penjaminNama: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Simpanan Pokok Awal (Rp)</label>
                  <input
                    type="number"
                    value={form.simpananPokokRp}
                    onChange={(e) => setForm({ ...form, simpananPokokRp: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                Anggota menyetujui kebijakan privasi data koperasi sesuai prinsip pelindungan data pribadi.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                >
                  Simpan &amp; Terbitkan QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
