import { useState } from 'react';
import { Check, HeartHandshake, Megaphone, Plus, X } from 'lucide-react';
import { CooperativeState, Pengguna } from '../types/lumbung';
import { formatAngka, formatRupiah, formatTanggal, formatWaktu } from '../utils/formatters';

interface KasDaruratViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function KasDaruratView({ state, activeUser, onApiPost }: KasDaruratViewProps) {
  const [tab, setTab] = useState<'kas' | 'darurat' | 'pengumuman'>('kas');
  const [showKasModal, setShowKasModal] = useState(false);
  const [showDaruratModal, setShowDaruratModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [kasForm, setKasForm] = useState({
    tipe: 'Keluar' as 'Masuk' | 'Keluar',
    kategori: 'Operasional',
    jumlahRp: '150000',
    akun: 'Kas Loket Koperasi',
    catatan: '',
  });

  const [daruratForm, setDaruratForm] = useState({
    penerimaNama: '',
    rtRw: 'RT 01 / RW 01',
    alasan: '',
    komoditasId: 'kom-beras-med',
    jumlahKg: '5',
  });

  const [notifForm, setNotifForm] = useState({
    judul: '',
    isi: '',
    kanal: 'Portal' as 'Portal' | 'WhatsApp',
    tujuan: 'Seluruh Anggota KKMP Singotrunan',
  });

  const canApproveKas = ['Admin', 'Bendahara', 'Pengurus'].includes(activeUser.peran);
  const canCreateKas = ['Admin', 'Petugas', 'Manajer', 'Bendahara', 'Pengurus'].includes(activeUser.peran);
  const canGiveAid = ['Admin', 'Petugas', 'Manajer', 'Pengurus'].includes(activeUser.peran);
  const canBroadcast = ['Admin', 'Petugas', 'Manajer', 'Pengurus'].includes(activeUser.peran);

  const totalKasMasuk = state.kasTransaksi
    .filter((k) => k.tipe === 'Masuk' && k.statusPersetujuan === 'Disetujui')
    .reduce((s, k) => s + k.jumlahRp, 0);
  const totalKasKeluar = state.kasTransaksi
    .filter((k) => k.tipe === 'Keluar' && k.statusPersetujuan === 'Disetujui')
    .reduce((s, k) => s + k.jumlahRp, 0);
  const totalBantuanKg = state.penyaluranDarurat.reduce((s, d) => s + d.jumlahKg, 0);
  const totalBantuanRp = state.penyaluranDarurat.reduce((s, d) => s + d.nilaiRp, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 8, 9 &amp; 12 · Pembukuan Kas, Stok Sosial Darurat &amp; Pengumuman Warga
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Kas, Cadangan Darurat &amp; Pengumuman</h2>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'kas' && canCreateKas && (
            <button
              onClick={() => setShowKasModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Catat Kas Masuk/Keluar
            </button>
          )}
          {tab === 'darurat' && canGiveAid && (
            <button
              onClick={() => setShowDaruratModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <HeartHandshake className="w-4 h-4" /> Salurkan Bantuan Darurat
            </button>
          )}
          {tab === 'pengumuman' && canBroadcast && (
            <button
              onClick={() => setShowNotifModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Megaphone className="w-4 h-4" /> Buat Pengumuman / WA
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setTab('kas')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'kas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Kas &amp; Pembukuan
        </button>
        <button
          onClick={() => setTab('darurat')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'darurat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Cadangan Pangan Darurat
        </button>
        <button
          onClick={() => setTab('pengumuman')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'pengumuman' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Pengumuman &amp; WhatsApp
        </button>
      </div>

      {tab === 'kas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Kas Masuk (Disetujui)</p>
              <p className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1">{formatRupiah(totalKasMasuk)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Kas Keluar (Disetujui)</p>
              <p className="text-xl font-bold font-mono text-red-700 tabular-nums mt-1">{formatRupiah(totalKasKeluar)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Menunggu Persetujuan Bendahara</p>
              <p className="text-xl font-bold font-mono text-amber-700 tabular-nums mt-1">
                {state.kasTransaksi.filter((k) => k.statusPersetujuan === 'Menunggu Bendahara').length} transaksi
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kategori &amp; Akun</th>
                    <th className="py-3 px-4">Catatan &amp; Referensi</th>
                    <th className="py-3 px-4 text-right">Jumlah</th>
                    <th className="py-3 px-4">Status</th>
                    {canApproveKas && <th className="py-3 px-4 text-right">Aksi Bendahara</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {state.kasTransaksi.map((k) => (
                    <tr key={k.id}>
                      <td className="py-3 px-4 text-xs text-slate-600">{formatTanggal(k.tanggal)}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{k.kategori}</p>
                        <p className="text-xs text-slate-500">{k.akun}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="font-mono text-slate-500">{k.referensi}</span> · {k.catatan}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-semibold ${k.tipe === 'Masuk' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {k.tipe === 'Masuk' ? '+' : '-'}{formatRupiah(k.jumlahRp)}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        <span
                          className={
                            k.statusPersetujuan === 'Disetujui'
                              ? 'text-emerald-700'
                              : k.statusPersetujuan === 'Ditolak'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }
                        >
                          {k.statusPersetujuan}
                        </span>
                      </td>
                      {canApproveKas && (
                        <td className="py-3 px-4 text-right">
                          {k.statusPersetujuan === 'Menunggu Bendahara' ? (
                            <button
                              onClick={() =>
                                onApiPost(
                                  `/api/kas/${k.id}/persetujuan`,
                                  { keputusan: 'Disetujui' },
                                  `Pengeluaran kas ${k.referensi} disetujui Bendahara.`
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Setujui
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">{k.disetujuiOleh || '-'}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'darurat' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Beras Sosial Tersalurkan</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatAngka(totalBantuanKg, 1)} kg</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Nilai Bantuan Darurat Warga</p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">{formatRupiah(totalBantuanRp)}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Penerima &amp; Wilayah</th>
                  <th className="py-3 px-4">Alasan Sosial</th>
                  <th className="py-3 px-4 text-right">Bantuan</th>
                  <th className="py-3 px-4">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {state.penyaluranDarurat.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 text-xs text-slate-600">{formatTanggal(d.tanggal)}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{d.penerimaNama} ({d.rtRw})</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{d.alasan}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {d.jumlahKg} kg {d.komoditasNama} ({formatRupiah(d.nilaiRp)})
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">{d.petugasNama}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pengumuman' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Pengumuman &amp; Pesan WhatsApp Terkirim</h3>
            <div className="divide-y divide-slate-100">
              {state.notifikasi.map((n) => (
                <div key={n.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{n.kanal} · {n.tujuan}</span>
                    <span>{formatWaktu(n.tanggal)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{n.judul}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.isi}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Template Resmi WhatsApp Koperasi</h3>
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                <p className="font-semibold text-slate-800">Pengingat Jatuh Tempo (H-3)</p>
                <p className="text-slate-600">{state.pengaturan.templateWaJatuhTempo}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                <p className="font-semibold text-slate-800">Pinjaman Disetujui</p>
                <p className="text-slate-600">{state.pengaturan.templateWaDisetujui}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
                <p className="font-semibold text-slate-800">Informasi Harga &amp; Stok Baru</p>
                <p className="text-slate-600">{state.pengaturan.templateWaInfoHarga}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showKasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Catat Transaksi Kas</h3>
              <button onClick={() => setShowKasModal(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onApiPost('/api/kas', kasForm, 'Transaksi kas berhasil dicatat.');
                if (ok) setShowKasModal(false);
              }}
              className="space-y-3.5 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipe</label>
                  <select value={kasForm.tipe} onChange={(e) => setKasForm({ ...kasForm, tipe: e.target.value as 'Masuk' | 'Keluar' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="Masuk">Kas Masuk</option>
                    <option value="Keluar">Kas Keluar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                  <input type="number" min="1000" required value={kasForm.jumlahRp} onChange={(e) => setKasForm({ ...kasForm, jumlahRp: e.target.value })} className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                <select value={kasForm.kategori} onChange={(e) => setKasForm({ ...kasForm, kategori: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="Operasional">Operasional</option>
                  <option value="Pembelian Stok">Pembelian Stok</option>
                  <option value="Simpanan Pangan">Simpanan Pangan</option>
                  <option value="Angsuran Pinjaman">Angsuran Pinjaman</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Keterangan</label>
                <input type="text" required value={kasForm.catatan} onChange={(e) => setKasForm({ ...kasForm, catatan: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowKasModal(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">Simpan Kas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDaruratModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Salurkan Cadangan Pangan Darurat</h3>
              <button onClick={() => setShowDaruratModal(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onApiPost('/api/darurat', daruratForm, 'Bantuan pangan darurat dicatat dan stok sosial dikurangi.');
                if (ok) setShowDaruratModal(false);
              }}
              className="space-y-3.5 text-sm"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Penerima Bantuan</label>
                <input type="text" required value={daruratForm.penerimaNama} onChange={(e) => setDaruratForm({ ...daruratForm, penerimaNama: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">RT / RW</label>
                  <input type="text" required value={daruratForm.rtRw} onChange={(e) => setDaruratForm({ ...daruratForm, rtRw: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah Beras (kg)</label>
                  <input type="number" min="1" required value={daruratForm.jumlahKg} onChange={(e) => setDaruratForm({ ...daruratForm, jumlahKg: e.target.value })} className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan / Kondisi Darurat</label>
                <input type="text" required value={daruratForm.alasan} onChange={(e) => setDaruratForm({ ...daruratForm, alasan: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDaruratModal(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">Catat Penyaluran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNotifModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Kirim Pengumuman / Pesan Massal</h3>
              <button onClick={() => setShowNotifModal(false)} className="p-1 text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onApiPost('/api/notifikasi', notifForm, 'Pengumuman berhasil dipublikasikan.');
                if (ok) {
                  setShowNotifModal(false);
                  setNotifForm({ ...notifForm, judul: '', isi: '' });
                }
              }}
              className="space-y-3.5 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kanal</label>
                  <select value={notifForm.kanal} onChange={(e) => setNotifForm({ ...notifForm, kanal: e.target.value as 'Portal' | 'WhatsApp' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="Portal">Portal Anggota</option>
                    <option value="WhatsApp">WhatsApp Broadcast</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tujuan</label>
                  <input type="text" required value={notifForm.tujuan} onChange={(e) => setNotifForm({ ...notifForm, tujuan: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul</label>
                <input type="text" required value={notifForm.judul} onChange={(e) => setNotifForm({ ...notifForm, judul: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Isi Pesan</label>
                <textarea rows={3} required value={notifForm.isi} onChange={(e) => setNotifForm({ ...notifForm, isi: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNotifModal(false)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">Kirim Pengumuman</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
