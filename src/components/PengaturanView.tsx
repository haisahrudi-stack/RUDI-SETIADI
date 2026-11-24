import { useState } from 'react';
import { Download, KeyRound, Plus, RotateCcw, Save, Shield, X } from 'lucide-react';
import { CooperativeState, PengaturanSistem, Pengguna, Role } from '../types/lumbung';
import { formatWaktu } from '../utils/formatters';

interface PengaturanViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  authToken: string;
  onApiPut: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
  onApiPatch: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function PengaturanView({
  state,
  activeUser,
  authToken,
  onApiPut,
  onApiPost,
  onApiPatch,
}: PengaturanViewProps) {
  const [form, setForm] = useState<PengaturanSistem>(state.pengaturan);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    nama: '',
    peran: 'Operator' as Role,
    jabatanDetail: '',
    password: '',
  });
  const [resetTarget, setResetTarget] = useState<Pengguna | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const canEditRules = ['Pengurus', 'Admin'].includes(activeUser.peran);
  const isAdmin = activeUser.peran === 'Admin';

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    await onApiPut('/api/pengaturan', form, 'Aturan bisnis dan pengaturan koperasi berhasil diperbarui.');
  };

  const handleDownloadBackup = () => {
    fetch('/api/backup', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal mengunduh cadangan.');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lumbung-pangan-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 13 · Aturan Bisnis Rapat Anggota, Hak Akses Peran &amp; Cadangan Data
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Pengaturan Sistem &amp; Pengguna</h2>
        </div>
        <div className="flex items-center gap-2">
          {['Admin', 'Pengurus', 'Bendahara'].includes(activeUser.peran) && (
            <button
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Cadangan JSON
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onApiPost('/api/reset-demo', {}, 'Data dikembalikan ke kondisi awal November 2026.')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Data Awal
            </button>
          )}
        </div>
      </div>

      {/* Form Aturan Bisnis (Bab 7) */}
      <form onSubmit={handleSaveRules} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Parameter Aturan Bisnis Koperasi</h3>
            <p className="text-xs text-slate-500">Dapat disesuaikan sewaktu-waktu sesuai keputusan Rapat Anggota tanpa mengubah kode.</p>
          </div>
          {!canEditRules && (
            <span className="text-xs font-medium text-amber-700">Hanya Pengurus / Admin yang dapat mengubah</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Plafon Awal Pinjaman (Rp)</label>
            <input
              type="number"
              disabled={!canEditRules}
              value={form.plafonAwalRp}
              onChange={(e) => setForm({ ...form, plafonAwalRp: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Plafon Maksimal Bertahap (Rp)</label>
            <input
              type="number"
              disabled={!canEditRules}
              value={form.plafonMaksimalRp}
              onChange={(e) => setForm({ ...form, plafonMaksimalRp: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Batas Persetujuan Manajer (Rp)</label>
            <input
              type="number"
              disabled={!canEditRules}
              value={form.batasPersetujuanManajerRp}
              onChange={(e) => setForm({ ...form, batasPersetujuanManajerRp: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tarif Jasa Pinjaman (%/bulan)</label>
            <input
              type="number"
              step="0.1"
              disabled={!canEditRules}
              value={form.tarifJasaPerBulanPersen}
              onChange={(e) => setForm({ ...form, tarifJasaPerBulanPersen: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tenor Maks Umum / Petani (bln)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                disabled={!canEditRules}
                value={form.tenorMaksUmumBulan}
                onChange={(e) => setForm({ ...form, tenorMaksUmumBulan: Number(e.target.value) })}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
              <input
                type="number"
                disabled={!canEditRules}
                value={form.tenorMaksPetaniBulan}
                onChange={(e) => setForm({ ...form, tenorMaksPetaniBulan: Number(e.target.value) })}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Margin Maks Paket Sembako (%)</label>
            <input
              type="number"
              step="0.5"
              disabled={!canEditRules}
              value={form.marginMaksPaketPersen}
              onChange={(e) => setForm({ ...form, marginMaksPaketPersen: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Imbalan Simpanan Pangan (%/bln)</label>
            <input
              type="number"
              step="0.1"
              disabled={!canEditRules}
              value={form.imbalanSimpananPerBulanPersen}
              onChange={(e) => setForm({ ...form, imbalanSimpananPerBulanPersen: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Cadangan Pangan Darurat (% margin)</label>
            <input
              type="number"
              step="0.5"
              disabled={!canEditRules}
              value={form.cadanganPanganDaruratPersen}
              onChange={(e) => setForm({ ...form, cadanganPanganDaruratPersen: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Cadangan Piutang Tak Tertagih (%)</label>
            <input
              type="number"
              step="0.5"
              disabled={!canEditRules}
              value={form.cadanganPiutangTakTertagihPersen}
              onChange={(e) => setForm({ ...form, cadanganPiutangTakTertagihPersen: Number(e.target.value) })}
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
        </div>

        {canEditRules && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
            >
              <Save className="w-4 h-4" /> Simpan Aturan Bisnis
            </button>
          </div>
        )}
      </form>

      {/* Manajemen Akun & Hak Akses */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Daftar Pengguna &amp; Pemisahan Hak Akses</h3>
          </div>
          {canEditRules && (
            <button
              onClick={() => setShowAddUser(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Pengguna
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Nama &amp; Username</th>
                <th className="py-2.5 px-4">Peran Sistem</th>
                <th className="py-2.5 px-4">Jabatan / Keterangan</th>
                <th className="py-2.5 px-4">Login Terakhir</th>
                <th className="py-2.5 px-4 text-right">Status &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.pengguna.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 px-4">
                    <p className="font-semibold text-slate-900">{u.nama}</p>
                    <p className="font-mono text-xs text-slate-500">@{u.username}</p>
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium text-slate-700">{u.peran}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">{u.jabatanDetail}</td>
                  <td className="py-2.5 px-4 text-xs font-mono text-slate-500">{formatWaktu(u.loginTerakhir)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      {canEditRules && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetTarget(u);
                            setResetPassword('');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer whitespace-nowrap"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Atur Sandi
                        </button>
                      )}
                      {canEditRules && u.id !== activeUser.id ? (
                        <button
                          type="button"
                          onClick={() =>
                            onApiPatch(
                              `/api/pengguna/${u.id}`,
                              { status: u.status === 'Aktif' ? 'Nonaktif' : 'Aktif' },
                              `Status akun ${u.nama} diperbarui.`
                            )
                          }
                          className={`text-xs font-medium cursor-pointer hover:underline whitespace-nowrap ${
                            u.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {u.status}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">{u.status}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengguna</h3>
              <button onClick={() => setShowAddUser(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onApiPost(
                  '/api/pengguna',
                  newUser,
                  `Akun @${newUser.username.trim().toLowerCase()} (${newUser.peran}) ditambahkan.`
                );
                if (ok) {
                  setShowAddUser(false);
                  setNewUser({ username: '', nama: '', peran: 'Operator', jabatanDetail: '', password: '' });
                }
              }}
              className="space-y-3.5 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Username Login</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="cth: operator2"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Peran</label>
                  <select
                    value={newUser.peran}
                    onChange={(e) => setNewUser({ ...newUser, peran: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Operator">Operator (Transaksi Cepat &amp; Input Anggota)</option>
                    <option value="Admin">Admin Sistem (Akses Penuh)</option>
                    <option value="Petugas">Petugas Layanan/Gudang</option>
                    <option value="Manajer">Manajer Unit</option>
                    <option value="Bendahara">Bendahara</option>
                    <option value="Pengurus">Pengurus (Ketua/Sekretaris)</option>
                    <option value="Pengawas">Pengawas (Hanya Lihat)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newUser.nama}
                  onChange={(e) => setNewUser({ ...newUser, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kata Sandi Awal (min. 6 karakter)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keterangan Jabatan</label>
                <input
                  type="text"
                  value={newUser.jabatanDetail}
                  onChange={(e) => setNewUser({ ...newUser, jabatanDetail: e.target.value })}
                  placeholder="cth: Operator Loket Shift Pagi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">Simpan Akun</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Atur Kata Sandi Pengguna</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {resetTarget.nama} (<span className="font-mono">@{resetTarget.username}</span> · {resetTarget.peran})
                </p>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onApiPatch(
                  `/api/pengguna/${resetTarget.id}`,
                  { password: resetPassword },
                  `Kata sandi akun @${resetTarget.username} berhasil diperbarui.`
                );
                if (ok) {
                  setResetTarget(null);
                  setResetPassword('');
                }
              }}
              className="space-y-4 text-sm"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kata Sandi Baru (minimal 6 karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                >
                  Simpan Kata Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
