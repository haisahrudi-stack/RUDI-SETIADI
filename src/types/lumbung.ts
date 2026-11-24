export type Role =
  | 'Admin'
  | 'Operator'
  | 'Anggota'
  | 'Petugas'
  | 'Manajer'
  | 'Bendahara'
  | 'Pengurus'
  | 'Pengawas';

export interface Pengguna {
  id: string;
  username: string;
  nama: string;
  peran: Role;
  status: 'Aktif' | 'Nonaktif';
  loginTerakhir: string;
  jabatanDetail: string;
  linkedAnggotaId?: string;
}

export interface Anggota {
  id: string;
  nomorAnggota: string;
  nama: string;
  alamat: string;
  rtRw: string;
  hp: string;
  noIdentitasMask: string; // Disimpan terbatas sesuai UU PDP
  kategori: 'Umum' | 'Petani';
  status: 'Aktif' | 'Nonaktif';
  tanggalBergabung: string;
  penjaminNama: string;
  penjaminHp: string;
  simpananPokokRp: number;
  simpananWajibRp: number;
  saldoSimpananKg: number;
  saldoSimpananRp: number;
  ketepatanBayarPersen: number;
  skorKelayakan: number; // 0 - 100
  plafonAktifRp: number; // Rp300.000 bertahap s.d. Rp1.000.000
}

export interface Komoditas {
  id: string;
  nama: string;
  satuan: 'kg' | 'liter' | 'butir' | 'pak';
  kategori: 'Pangan Pokok' | 'Minyak & Gula' | 'Protein & Tepung';
  stokMinimum: number;
  stokMaksimum: number;
  stokTotal: number;
}

export interface HargaAcuan {
  id: string;
  komoditasId: string;
  komoditasNama: string;
  satuan: string;
  harga: number;
  berlakuMulai: string;
  ditetapkanOleh: string;
}

export interface RiwayatHarga {
  id: string;
  komoditasId: string;
  komoditasNama: string;
  hargaLama: number;
  hargaBaru: number;
  tanggal: string;
  ditetapkanOleh: string;
  catatan: string;
}

export interface StokBatch {
  id: string;
  kodeBatch: string;
  komoditasId: string;
  komoditasNama: string;
  satuan: string;
  jumlahAwal: number;
  jumlahSisa: number;
  tanggalMasuk: string;
  tanggalKedaluwarsa: string;
  hargaPokok: number;
}

export interface StokMutasi {
  id: string;
  komoditasId: string;
  komoditasNama: string;
  satuan: string;
  tipe: 'Masuk' | 'Keluar' | 'Penyesuaian' | 'Penyusutan' | 'Darurat';
  jumlah: number;
  kodeBatch: string;
  tanggalKedaluwarsa?: string;
  referensiTransaksi: string;
  tanggal: string;
  petugasNama: string;
  catatan?: string;
}

export interface StokOpnameRecord {
  id: string;
  tanggal: string;
  komoditasId: string;
  komoditasNama: string;
  satuan: string;
  stokSistem: number;
  stokFisik: number;
  selisih: number;
  selisihPersen: number;
  petugasNama: string;
  catatan: string;
}

export interface SimpananPangan {
  id: string;
  anggotaId: string;
  anggotaNama: string;
  tipe: 'Setor' | 'Ambil' | 'Imbalan' | 'Potong Tunggakan';
  bentuk: 'Beras' | 'Uang';
  jumlahKg: number;
  nilaiRp: number;
  hargaBerasAcuan: number;
  tanggal: string;
  petugasNama: string;
  catatan?: string;
}

export interface PinjamanItem {
  komoditasId: string;
  komoditasNama: string;
  satuan: string;
  jumlah: number;
  hargaSaatTransaksi: number; // Dikunci saat transaksi
  subtotalRp: number;
}

export type StatusPinjaman =
  | 'Diajukan'
  | 'Disetujui'
  | 'Berjalan'
  | 'Lunas'
  | 'Terlambat'
  | 'Dijadwalkan Ulang'
  | 'Bermasalah'
  | 'Ditolak';

export interface Pinjaman {
  id: string;
  kodePinjaman: string;
  anggotaId: string;
  anggotaNama: string;
  tanggalPengajuan: string;
  tanggalDisetujui?: string;
  tanggalSerahTerima?: string;
  tanggalJatuhTempo: string;
  items: PinjamanItem[];
  nilaiPinjamanRp: number;
  tarifJasaPersen: number;
  tenorBulan: number;
  jasaRp: number;
  totalKembaliRp: number;
  sudahDibayarRp: number;
  sisaTagihanRp: number;
  status: StatusPinjaman;
  wajibPenjamin: boolean;
  penjaminNama?: string;
  penjaminKonfirmasi: boolean;
  penyetujuNama?: string;
  penyetujuPeran?: Role;
  petugasSerahNama?: string;
  catatan?: string;
}

export interface Angsuran {
  id: string;
  nomorKuitansi: string;
  pinjamanId: string;
  kodePinjaman: string;
  anggotaId: string;
  anggotaNama: string;
  tanggal: string;
  metode: 'Tunai' | 'Transfer' | 'Barang Setara' | 'Potong Simpanan';
  jumlahRp: number;
  barangDetail?: {
    komoditasId: string;
    komoditasNama: string;
    satuan: string;
    jumlah: number;
    hargaKonversi: number;
  };
  petugasNama: string;
  catatan?: string;
}

export interface PaketSembakoItem {
  komoditasId: string;
  komoditasNama: string;
  jumlah: number;
  satuan: string;
}

export interface PaketSembako {
  id: string;
  nama: string;
  deskripsi: string;
  isi: PaketSembakoItem[];
  hargaPokokRp: number;
  marginPersen: number;
  hargaJualRp: number;
  gambarUrl: string;
  aktif: boolean;
}

export interface JadwalCicilanPaket {
  ke: number;
  jatuhTempo: string;
  jumlahRp: number;
  lunas: boolean;
  tanggalBayar?: string;
}

export interface PesananPaket {
  id: string;
  kodePesanan: string;
  anggotaId: string;
  anggotaNama: string;
  paketId: string;
  paketNama: string;
  hargaJualRp: number;
  tenorMingguan: 4 | 8;
  cicilanPerMingguRp: number;
  sudahDibayarRp: number;
  sisaTagihanRp: number;
  jadwalCicilan: JadwalCicilanPaket[];
  status: 'Aktif' | 'Lunas';
  tanggalPesan: string;
}

export interface KasTransaksi {
  id: string;
  tanggal: string;
  tipe: 'Masuk' | 'Keluar';
  kategori:
    | 'Simpanan Pangan'
    | 'Angsuran Pinjaman'
    | 'Cicilan Paket Sembako'
    | 'Pembelian Stok'
    | 'Operasional'
    | 'Penyaluran Darurat';
  jumlahRp: number;
  akun: string;
  referensi: string;
  statusPersetujuan: 'Disetujui' | 'Menunggu Bendahara' | 'Ditolak';
  dibuatOleh: string;
  disetujuiOleh?: string;
  catatan: string;
}

export interface PenyaluranDarurat {
  id: string;
  tanggal: string;
  penerimaNama: string;
  rtRw: string;
  alasan: string;
  jenis: 'Beras Sosial' | 'Paket Sembako Darurat';
  komoditasId: string;
  komoditasNama: string;
  jumlahKg: number;
  nilaiRp: number;
  petugasNama: string;
}

export interface Penagihan {
  id: string;
  pinjamanId: string;
  kodePinjaman: string;
  anggotaId: string;
  anggotaNama: string;
  tanggal: string;
  tindakan:
    | 'Pengingat WhatsApp'
    | 'Kunjungan Lapangan'
    | 'Panggilan Penjamin'
    | 'Jadwal Ulang'
    | 'Potong Simpanan';
  hasil: string;
  janjiBayarTanggal?: string;
  petugasNama: string;
}

export interface PengumumanNotifikasi {
  id: string;
  tanggal: string;
  judul: string;
  isi: string;
  kanal: 'Portal' | 'WhatsApp';
  tujuan: string;
  statusKirim: 'Terkirim' | 'Terjadwal';
  dibuatOleh: string;
}

export interface AuditLog {
  id: string;
  waktu: string;
  penggunaNama: string;
  penggunaPeran: Role;
  aksi: string;
  objek: string;
  nilaiLama: string;
  nilaiBaru: string;
}

export interface PengaturanSistem {
  namaKoperasi: string;
  namaUnit: string;
  alamatKoperasi: string;
  kontakWhatsApp: string;
  jamLayanan: string;
  plafonAwalRp: number;
  plafonMaksimalRp: number;
  tenorMaksUmumBulan: number;
  tenorMaksPetaniBulan: number;
  tarifJasaPerBulanPersen: number;
  batasPersetujuanManajerRp: number;
  marginMaksPaketPersen: number;
  maksPaketAktifPerAnggota: number;
  imbalanSimpananPerBulanPersen: number;
  cadanganPanganDaruratPersen: number;
  cadanganPiutangTakTertagihPersen: number;
  templateWaJatuhTempo: string;
  templateWaDisetujui: string;
  templateWaInfoHarga: string;
}

export interface CooperativeState {
  pengaturan: PengaturanSistem;
  pengguna: Pengguna[];
  anggota: Anggota[];
  komoditas: Komoditas[];
  hargaAcuan: HargaAcuan[];
  riwayatHarga: RiwayatHarga[];
  stokBatches: StokBatch[];
  stokMutasi: StokMutasi[];
  stokOpname: StokOpnameRecord[];
  simpananPangan: SimpananPangan[];
  pinjaman: Pinjaman[];
  angsuran: Angsuran[];
  paketSembako: PaketSembako[];
  pesananPaket: PesananPaket[];
  kasTransaksi: KasTransaksi[];
  penyaluranDarurat: PenyaluranDarurat[];
  penagihan: Penagihan[];
  notifikasi: PengumumanNotifikasi[];
  auditLog: AuditLog[];
}
