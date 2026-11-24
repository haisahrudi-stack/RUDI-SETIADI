export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};

export const formatAngka = (val: number, decimals = 0): string => {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

export const formatTanggal = (isoDate?: string): string => {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

export const formatWaktu = (isoDateTime?: string): string => {
  if (!isoDateTime) return '-';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const hitungHariTerlambat = (tanggalJatuhTempo: string, refDate = new Date('2026-11-24T00:00:00Z')): number => {
  const due = new Date(tanggalJatuhTempo);
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = refDate.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const klasifikasiTunggakan = (hariTerlambat: number): {
  tingkat: 'Tepat Waktu' | '1-7 Hari' | '8-30 Hari' | '> 30 Hari' | '> 90 Hari';
  tindakan: string;
  warna: 'emerald' | 'amber' | 'orange' | 'red';
} => {
  if (hariTerlambat <= 0) {
    return {
      tingkat: 'Tepat Waktu',
      tindakan: hariTerlambat >= -3 ? 'Kirim pengingat H-3 WhatsApp' : 'Pantau jadwal angsuran',
      warna: 'emerald',
    };
  }
  if (hariTerlambat <= 7) {
    return {
      tingkat: '1-7 Hari',
      tindakan: 'Pengingat WhatsApp otomatis',
      warna: 'amber',
    };
  }
  if (hariTerlambat <= 30) {
    return {
      tingkat: '8-30 Hari',
      tindakan: 'Tugas kunjungan petugas & opsi jadwal ulang',
      warna: 'orange',
    };
  }
  if (hariTerlambat <= 90) {
    return {
      tingkat: '> 30 Hari',
      tindakan: 'Panggil anggota & penjamin, opsi potong Simpanan Pangan',
      warna: 'red',
    };
  }
  return {
    tingkat: '> 90 Hari',
    tindakan: 'Ditandai Bermasalah, masuk agenda Pengurus',
    warna: 'red',
  };
};

export const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((row) => row.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
