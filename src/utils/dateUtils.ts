export function toPersianNum(n: string | number | undefined | null): string {
  if (n === undefined || n === null) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, (x) => persianDigits[parseInt(x, 10)]);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(isoStr: string, days: number): string {
  const parts = isoStr.split('-').map(Number);
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatPersianDate(isoStr: string): string {
  try {
    const parts = isoStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt);
  } catch {
    return isoStr;
  }
}

export function formatShortPersianDate(isoStr: string): string {
  try {
    const parts = isoStr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  } catch {
    return isoStr;
  }
}

export function getRelativeDayLabel(isoStr: string): string {
  const today = getTodayISO();
  if (isoStr === today) return 'امروز';
  if (isoStr === addDaysISO(today, -1)) return 'دیروز';
  if (isoStr === addDaysISO(today, 1)) return 'فردا';
  if (isoStr === addDaysISO(today, -2)) return 'پریروز';

  const p1 = today.split('-').map(Number);
  const p2 = isoStr.split('-').map(Number);
  const d1 = new Date(p1[0], p1[1] - 1, p1[2], 12, 0, 0);
  const d2 = new Date(p2[0], p2[1] - 1, p2[2], 12, 0, 0);
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${toPersianNum(Math.abs(diffDays))} روز پیش`;
  return `${toPersianNum(diffDays)} روز دیگر`;
}

export function getCurrentTimePersian(): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

export function calculateAnesthesiaDuration(start?: string, end?: string): {
  minutes: number | null;
  label: string;
  isError: boolean;
} {
  if (!start || !end) return { minutes: null, label: '', isError: false };
  const sParts = start.split(':').map(Number);
  const eParts = end.split(':').map(Number);
  if (sParts.length < 2 || eParts.length < 2 || isNaN(sParts[0]) || isNaN(eParts[0])) {
    return { minutes: null, label: '', isError: false };
  }
  const sMins = sParts[0] * 60 + sParts[1];
  const eMins = eParts[0] * 60 + eParts[1];
  const diff = eMins - sMins;
  if (diff <= 0) {
    return {
      minutes: diff,
      label: 'ساعت پایان باید بعد از ساعت شروع باشد',
      isError: true,
    };
  }
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${toPersianNum(hrs)} ساعت`);
  if (mins > 0) parts.push(`${toPersianNum(mins)} دقیقه`);
  return {
    minutes: diff,
    label: `${ parts.join(' و ') } (${toPersianNum(diff)} دقیقه)`,
    isError: false,
  };
}

export function splitTokens(rawStr: string): string[] {
  if (!rawStr) return [];
  return rawStr
    .split(/[،,\-+/_]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function buildSortedFrequencyItems<T extends Record<string, any>>(
  savedList: string[],
  storedCounts: Record<string, number>,
  liveRecords: T[],
  fieldKey: keyof T,
  splitMultiple = false
): { name: string; count: number }[] {
  const freqMap: Record<string, number> = {};
  (savedList || []).forEach((item) => {
    const clean = (item || '').trim();
    if (clean) {
      freqMap[clean] = (storedCounts && storedCounts[clean]) || 0;
    }
  });

  const liveCounts: Record<string, number> = {};
  (liveRecords || []).forEach((rec) => {
    const val = rec[fieldKey];
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((v: unknown) => {
        const clean = String(v || '').trim();
        if (clean) liveCounts[clean] = (liveCounts[clean] || 0) + 1;
      });
    } else if (typeof val === 'string') {
      const tokens = splitMultiple ? splitTokens(val) : [val.trim()];
      tokens.forEach((t) => {
        if (t) liveCounts[t] = (liveCounts[t] || 0) + 1;
      });
    }
  });

  Object.keys(liveCounts).forEach((k) => {
    if (freqMap[k] === undefined) {
      freqMap[k] = liveCounts[k];
    }
  });

  return Object.keys(freqMap)
    .map((name) => ({
      name,
      count: Math.max(freqMap[name] || 0, liveCounts[name] || 0),
    }))
    .sort((a, b) => b.count - a.count);
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
