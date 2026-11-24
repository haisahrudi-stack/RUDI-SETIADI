import { useState } from 'react';
import { CalendarClock, MessageSquare, Scissors, UserCheck, X } from 'lucide-react';
import { CooperativeState, Pengguna, Pinjaman } from '../types/lumbung';
import { formatRupiah, formatTanggal, hitungHariTerlambat, klasifikasiTunggakan } from '../utils/formatters';

interface PenagihanViewProps {
  state: CooperativeState;
  activeUser: Pengguna;
  onApiPost: (url: string, body: unknown, successMsg: string) => Promise<boolean>;
}

export function PenagihanView({ state, activeUser, onApiPost }: PenagihanViewProps) {
  const [modalLoan, setModalLoan] = useState<Pinjaman | null>(null);
  const [tindakan, setTindakan] = useState<
    'Pengingat WhatsApp' | 'Kunjungan Lapangan' | 'Panggilan Penjamin' | 'Jadwal Ulang' | 'Potong Simpanan'
  >('Kunjungan Lapangan');
  const [hasil, setHasil] = useState('');
  const [janjiBayarTanggal, setJanjiBayarTanggal] = useState('');
  const [tanggalJatuhTempoBaru, setTanggalJatuhTempoBaru] = useState('');

  const canAct = ['Admin', 'Petugas', 'Manajer', 'Pengurus'].includes(activeUser.peran);
  const canReschedule = ['Admin', 'Manajer', 'Pengurus'].includes(activeUser.peran);

  const loansToMonitor = state.pinjaman
    .filter((p) => ['Berjalan', 'Terlambat', 'Dijadwalkan Ulang', 'Bermasalah'].includes(p.status))
    .sort((a, b) => a.tanggalJatuhTempo.localeCompare(b.tanggalJatuhTempo));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLoan) return;
    const ok = await onApiPost(
      '/api/penagihan',
      {
        pinjamanId: modalLoan.id,
        tindakan,
        hasil,
        janjiBayarTanggal,
        tanggalJatuhTempoBaru,
      },
      `Tindakan penagihan (${tindakan}) untuk ${modalLoan.anggotaNama} berhasil dicatat.`
    );
    if (ok) {
      setModalLoan(null);
      setHasil('');
    }
  };

  const handleQuickWa = async (loan: Pinjaman) => {
    await onApiPost(
      '/api/penagihan',
      {
        pinjamanId: loan.id,
        tindakan: 'Pengingat WhatsApp',
        hasil: `Pengingat jatuh tempo otomatis dikirim ke WhatsApp ${loan.anggotaNama}.`,
      },
      `Pengingat WhatsApp terkirim ke ${loan.anggotaNama}.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Modul 7 · Eskalasi Bertahap: 1–7 hr WA · 8–30 hr Kunjungan · &gt;30 hr Potong Simpanan · &gt;90 hr Agenda Pengurus
          </p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Penagihan &amp; Pengingat Jatuh Tempo</h2>
        </div>
      </div>

      {/* Daftar Pinjaman Aktif & Terlambat */}
      <div className="space-y-3">
        {loansToMonitor.map((loan) => {
          const hari = hitungHariTerlambat(loan.tanggalJatuhTempo);
          const klas = klasifikasiTunggakan(hari);
          const member = state.anggota.find((a) => a.id === loan.anggotaId);

          return (
            <div key={loan.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">{loan.kodePinjaman}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      klas.warna === 'emerald'
                        ? 'text-emerald-700'
                        : klas.warna === 'amber'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {hari > 0 ? `Terlambat ${hari} hari (${klas.tingkat})` : `Jatuh tempo ${formatTanggal(loan.tanggalJatuhTempo)}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>HP: {member?.hp || '-'}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{loan.anggotaNama}</h3>
                <p className="text-xs text-slate-600">
                  Rekomendasi sistem: <strong className="text-slate-800">{klas.tindakan}</strong> · Saldo Simpanan:{' '}
                  <span className="font-mono">{formatRupiah(member?.saldoSimpananRp || 0)}</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                <div className="text-left sm:text-right tabular-nums mr-2">
                  <p className="text-xs text-slate-500">Sisa Tagihan</p>
                  <p className="text-base font-bold font-mono text-slate-900">{formatRupiah(loan.sisaTagihanRp)}</p>
                </div>

                {canAct && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleQuickWa(loan)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Kirim WA
                    </button>
                    <button
                      onClick={() => {
                        setModalLoan(loan);
                        setTindakan(hari > 30 && canReschedule ? 'Potong Simpanan' : 'Kunjungan Lapangan');
                        setTanggalJatuhTempoBaru(loan.tanggalJatuhTempo);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Catat Kunjungan / Opsi
                    </button>
                    {hari > 90 && loan.status !== 'Bermasalah' && canReschedule && (
                      <button
                        onClick={() =>
                          onApiPost(
                            `/api/pinjaman/${loan.id}/tandai-bermasalah`,
                            {},
                            `${loan.kodePinjaman} ditandai Bermasalah untuk agenda Pengurus.`
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        Tandai Bermasalah
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Riwayat Penagihan */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Catatan Kunjungan &amp; Log Penagihan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Tanggal</th>
                <th className="py-2.5 px-4">Anggota &amp; Pinjaman</th>
                <th className="py-2.5 px-4">Tindakan</th>
                <th className="py-2.5 px-4">Hasil / Janji Bayar</th>
                <th className="py-2.5 px-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.penagihan.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 px-4 text-xs text-slate-600">{formatTanggal(t.tanggal)}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-medium text-slate-900">{t.anggotaNama}</span>{' '}
                    <span className="font-mono text-xs text-slate-500">· {t.kodePinjaman}</span>
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium text-slate-800">{t.tindakan}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-600">
                    {t.hasil}
                    {t.janjiBayarTanggal && (
                      <span className="block text-emerald-700 font-medium mt-0.5">
                        Janji bayar: {formatTanggal(t.janjiBayarTanggal)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">{t.petugasNama}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tindak Lanjut Penagihan */}
      {modalLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tindak Lanjut Penagihan</h3>
                <p className="text-xs text-slate-500">{modalLoan.kodePinjaman} · {modalLoan.anggotaNama}</p>
              </div>
              <button onClick={() => setModalLoan(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Tindakan</label>
                <select
                  value={tindakan}
                  onChange={(e) => setTindakan(e.target.value as typeof tindakan)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Kunjungan Lapangan">Catat Kunjungan Lapangan</option>
                  <option value="Panggilan Penjamin">Hubungi Penjamin ({modalLoan.penjaminNama})</option>
                  <option value="Pengingat WhatsApp">Kirim Pengingat WhatsApp</option>
                  {canReschedule && <option value="Jadwal Ulang">Jadwal Ulang Jatuh Tempo (Manajer/Pengurus)</option>}
                  {canReschedule && <option value="Potong Simpanan">Potong Saldo Simpanan Pangan (&gt;30 hari)</option>}
                </select>
              </div>

              {tindakan === 'Jadwal Ulang' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    <CalendarClock className="w-3.5 h-3.5 inline mr-1" /> Tanggal Jatuh Tempo Baru
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalJatuhTempoBaru}
                    onChange={(e) => setTanggalJatuhTempoBaru(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {tindakan === 'Potong Simpanan' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                  <Scissors className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Saldo Simpanan Pangan anggota akan dipotong langsung untuk melunasi/mengurangi sisa tagihan {formatRupiah(modalLoan.sisaTagihanRp)}.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hasil / Catatan Kunjungan</label>
                <textarea
                  rows={2}
                  required
                  value={hasil}
                  onChange={(e) => setHasil(e.target.value)}
                  placeholder="Ringkasan pembicaraan dengan anggota atau penjamin..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Janji Bayar (Opsional)</label>
                <input
                  type="date"
                  value={janjiBayarTanggal}
                  onChange={(e) => setJanjiBayarTanggal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalLoan(null)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer">
                  Simpan Tindakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
