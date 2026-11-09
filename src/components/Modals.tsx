import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Share2,
  CheckCheck,
  Download,
  Upload,
  Cloud,
  CloudUpload,
  CloudDownload,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import {
  CloudConfig,
  DatabaseSchema,
  DEFAULT_PRIMARY_WARDS,
} from '../types';
import {
  addDaysISO,
  downloadCSV,
  formatPersianDate,
  formatShortPersianDate,
  getRelativeDayLabel,
  getTodayISO,
  toPersianNum,
} from '../utils/dateUtils';

/* ==========================================
   1. REPORT GENERATOR MODAL
   ========================================== */
interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseSchema;
  currentDateStr: string;
  onMarkAllInformed: () => void;
  onToast: (msg: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  db,
  currentDateStr,
  onMarkAllInformed,
  onToast,
}) => {
  const [mode, setMode] = useState<'all' | 'uninformed' | 'own' | 'consult'>('all');

  const reportText = useMemo(() => {
    const dateTitle = formatPersianDate(currentDateStr);
    let list = db.patients.filter((p) => p.date === currentDateStr);
    if (mode === 'uninformed') list = list.filter((p) => p.status === 'pending');
    if (mode === 'own') list = list.filter((p) => p.serviceType === 'own');
    if (mode === 'consult') list = list.filter((p) => p.serviceType === 'consult');

    const lines: string[] = [];
    lines.push('*گزارش آمار و مشاوره‌های دکتر دوانلو*');
    lines.push(`تاریخ: ${dateTitle}`);
    lines.push('────────────────────');

    if (list.length === 0) {
      lines.push('موردی برای گزارش در این فیلتر ثبت نشده است.');
      return lines.join('\n');
    }

    list.forEach((p, idx) => {
      const num = toPersianNum(idx + 1);
      const serviceStr =
        p.serviceType === 'own'
          ? 'سرویس دکتر دوانلو'
          : `مشاوره (پزشک معالج: ${p.doctor || '—'})`;
      lines.push(`${num}. *${p.ward || 'بخش'}* | بیمار: *${p.name || '—'}*`);
      lines.push(`   • سرویس: ${serviceStr}`);
      if (p.baseInsurance || p.suppInsurance) {
        lines.push(
          `   • بیمه: ${p.baseInsurance || '—'}${
            p.suppInsurance ? ` / تکمیلی: ${p.suppInsurance}` : ''
          }`
        );
      }
      if (p.problem) lines.push(`   • مشکل: ${p.problem}`);
      if (p.request) lines.push(`   • درخواست: ${p.request}`);
      if (p.labStatus) {
        lines.push(`   • آزمایش: ${p.labStatus}${p.labNote ? ` (${p.labNote})` : ''}`);
      }
      if (p.imaging && p.imaging.length > 0) {
        lines.push(`   • تصویربرداری: ${p.imaging.join('، ')}`);
      }
      if (p.location) {
        lines.push(`   • محل انجام: ${p.location}`);
      }
      if (p.paymentStatus && p.paymentStatus !== 'none') {
        const payMap: Record<string, string> = {
          paid: 'پرداخت شده',
          unpaid: 'پرداخت نشده',
          partial: 'بخشی پرداخت شده',
        };
        lines.push(
          `   • هزینه وسیله مصرفی: ${payMap[p.paymentStatus] || ''}${
            p.consumableNote ? ` (${p.consumableNote})` : ''
          }`
        );
      }
      if (p.notes) {
        lines.push(`   • توضیحات: ${p.notes}`);
      }
      lines.push('');
    });

    const checks = db.wardChecks[currentDateStr] || {};
    const primaryWards = db.primaryWardsOrder?.length
      ? db.primaryWardsOrder
      : DEFAULT_PRIMARY_WARDS;
    const emptyWards = primaryWards.filter((w) => {
      const hasP = db.patients.some((p) => p.date === currentDateStr && p.ward === w);
      return checks[w] === 'empty' && !hasP;
    });

    if (emptyWards.length > 0 && mode === 'all') {
      lines.push('*بخش‌های تماس‌گرفته‌شده بدون بیمار:*');
      lines.push(emptyWards.join('، '));
    }

    return lines.join('\n');
  }, [db, currentDateStr, mode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(reportText).then(
      () => onToast('متن گزارش در حافظه کپی شد'),
      () => onToast('کپی انجام شد')
    );
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'گزارش بیماران دکتر دوانلو',
          text: reportText,
        })
        .catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#0f1623] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              گزارش آماده ارسال برای دکتر دوانلو
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              مرتب‌شده بر اساس چیدمان دستی شما در لیست بیماران
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'همه بیماران امروز' },
                { id: 'uninformed', label: 'فقط اطلاع‌داده‌نشده‌ها' },
                { id: 'own', label: 'فقط سرویس دکتر' },
                { id: 'consult', label: 'فقط مشاوره‌ها' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === tab.id
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <pre className="w-full rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 max-h-72 overflow-y-auto">
            {reportText}
          </pre>

          <button
            type="button"
            onClick={onMarkAllInformed}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>علامت‌گذاری همه بیماران این روز به عنوان «اطلاع داده شد»</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>کپی متن گزارش</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs"
          >
            <Share2 className="w-4 h-4" />
            <span>اشتراک‌گذاری</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   2. ANALYTICS & MONTHLY EXPORT MODAL
   ========================================== */
interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseSchema;
  currentDateStr: string;
  onJumpToDate: (isoDate: string) => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  db,
  currentDateStr,
  onJumpToDate,
}) => {
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const stats = useMemo(() => {
    const today = getTodayISO();
    const minDate =
      range === 'today'
        ? currentDateStr
        : range === '7d'
        ? addDaysISO(today, -6)
        : range === '30d'
        ? addDaysISO(today, -29)
        : '0000-00-00';

    const patients = db.patients.filter((p) =>
      range === 'today' ? p.date === currentDateStr : p.date >= minDate
    );
    const procedures = db.procedures.filter((pr) =>
      range === 'today' ? pr.date === currentDateStr : pr.date >= minDate
    );

    const consultCount = patients.filter((p) => p.serviceType === 'consult').length;
    const ownCount = patients.filter((p) => p.serviceType === 'own').length;
    const invasiveCount = procedures.filter((pr) => pr.invasive).length;

    const unpaidPatients = db.patients.filter(
      (p) => p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial'
    );

    // Code frequencies
    const codeMap: Record<string, number> = {};
    procedures.forEach((pr) => {
      (pr.codes || []).forEach((c) => {
        codeMap[c] = (codeMap[c] || 0) + 1;
      });
    });
    const topCodes = Object.entries(codeMap).sort((a, b) => b[1] - a[1]);

    // Doctor frequencies
    const docMap: Record<string, number> = {};
    patients
      .filter((p) => p.serviceType === 'consult' && p.doctor)
      .forEach((p) => {
        docMap[p.doctor] = (docMap[p.doctor] || 0) + 1;
      });
    const topDoctors = Object.entries(docMap).sort((a, b) => b[1] - a[1]);

    return {
      patients,
      procedures,
      consultCount,
      ownCount,
      invasiveCount,
      unpaidPatients,
      topCodes,
      topDoctors,
    };
  }, [db, range, currentDateStr]);

  if (!isOpen) return null;

  const exportPatientsCSV = () => {
    downloadCSV(
      `davanloo-patients-${range}.csv`,
      [
        'تاریخ میلادی',
        'تاریخ شمسی',
        'بخش',
        'نام بیمار',
        'نوع سرویس',
        'پزشک معالج',
        'بیمه پایه',
        'بیمه تکمیلی',
        'مشکل / تشخیص',
        'درخواست',
        'محل انجام',
        'وضعیت پرداخت وسیله',
        'توضیح وسیله مصرفی',
        'وضعیت اقدام',
      ],
      stats.patients.map((p) => [
        p.date,
        formatShortPersianDate(p.date),
        p.ward,
        p.name,
        p.serviceType === 'own' ? 'سرویس دکتر دوانلو' : 'مشاوره',
        p.doctor,
        p.baseInsurance,
        p.suppInsurance,
        p.problem,
        p.request,
        p.location,
        p.paymentStatus,
        p.consumableNote,
        p.status,
      ])
    );
  };

  const exportProceduresCSV = () => {
    downloadCSV(
      `davanloo-procedures-${range}.csv`,
      [
        'تاریخ میلادی',
        'تاریخ شمسی',
        'نام بیمار',
        'بیمه پایه',
        'بیمه تکمیلی',
        'وسیله مصرفی',
        'شروع بیهوشی',
        'پایان بیهوشی',
        'متخصص بیهوشی',
        'کد تهاجم',
        'کدهای عمل',
      ],
      stats.procedures.map((pr) => [
        pr.date,
        formatShortPersianDate(pr.date),
        pr.name,
        pr.baseInsurance,
        pr.suppInsurance,
        pr.device,
        pr.anesStart,
        pr.anesEnd,
        pr.anesDoctor,
        pr.invasive ? 'بله' : 'خیر',
        (pr.codes || []).join(' | '),
      ])
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#0f1623] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              آمار کارکرد، بدهی وسایل و خروجی اکسل
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-5 flex-1">
          {/* Range Selector */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl">
              {(
                [
                  { id: 'today', label: 'روز انتخابی' },
                  { id: '7d', label: '۷ روز اخیر' },
                  { id: '30d', label: '۳۰ روز اخیر' },
                  { id: 'all', label: 'کل تاریخچه' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    range === r.id
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportPatientsCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>اکسل بیماران (CSV)</span>
              </button>
              <button
                type="button"
                onClick={exportProceduresCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-500/20"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>اکسل پروسیجرها (CSV)</span>
              </button>
            </div>
          </div>

          {/* Summary KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {toPersianNum(stats.patients.length)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">کل بیماران ثبت‌شده</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {toPersianNum(stats.consultCount)} / {toPersianNum(stats.ownCount)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">مشاوره / سرویس دکتر</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {toPersianNum(stats.procedures.length)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">پروسیجرهای انجام‌شده</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {toPersianNum(stats.invasiveCount)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">موارد دارای کد تهاجم</div>
            </div>
          </div>

          {/* Unpaid / Partial Consumables across ALL days */}
          {stats.unpaidPatients.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    پیگیری هزینه‌های وسایل مصرفی تسویه‌نشده ({toPersianNum(stats.unpaidPatients.length)}{' '}
                    مورد در کل روزها)
                  </span>
                </div>
              </div>
              <div className="divide-y divide-rose-500/15 max-h-40 overflow-y-auto">
                {stats.unpaidPatients.map((p) => (
                  <div
                    key={p.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </span>
                      <span className="text-slate-500 mx-1.5">·</span>
                      <span className="text-slate-600 dark:text-slate-300">{p.ward}</span>
                      {p.consumableNote && (
                        <>
                          <span className="text-slate-500 mx-1.5">·</span>
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {p.consumableNote}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onJumpToDate(p.date);
                        onClose();
                      }}
                      className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0 tabular-nums"
                    >
                      {formatShortPersianDate(p.date)} ←
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-column breakdown: Procedure codes & Referring Doctors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">
                پرتکرارترین کدهای عمل ثبت‌شده
              </h3>
              {stats.topCodes.length === 0 ? (
                <p className="text-xs text-slate-400">کدی در این بازه ثبت نشده است.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {stats.topCodes.map(([code, count]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                    >
                      <span className="text-slate-700 dark:text-slate-300 truncate pl-2">
                        {code}
                      </span>
                      <span className="font-bold text-sky-600 dark:text-sky-400 tabular-nums shrink-0">
                        {toPersianNum(count)} مورد
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">
                بیشترین مشاوره‌ها به تفکیک پزشک معالج
              </h3>
              {stats.topDoctors.length === 0 ? (
                <p className="text-xs text-slate-400">مشاوره‌ای در این بازه ثبت نشده است.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {stats.topDoctors.map(([doc, count]) => (
                    <div
                      key={doc}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                    >
                      <span className="text-slate-700 dark:text-slate-300 truncate pl-2">
                        {doc}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                        {toPersianNum(count)} مشاوره
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   3. JALALI CALENDAR QUICK-JUMP MODAL
   ========================================== */
interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseSchema;
  currentDateStr: string;
  onSelectDate: (isoStr: string) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  db,
  currentDateStr,
  onSelectDate,
}) => {
  if (!isOpen) return null;

  const today = getTodayISO();
  // Build last 30 days + next 2 days for quick clinical jump
  const daysList: string[] = [];
  for (let i = 1; i >= -29; i--) {
    daysList.push(addDaysISO(today, i));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#0f1623] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              پرش سریع به تاریخ (۳۰ روز اخیر)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 overflow-y-auto space-y-1.5 flex-1">
          {daysList.map((iso) => {
            const pCount = db.patients.filter((p) => p.date === iso).length;
            const prCount = db.procedures.filter((pr) => pr.date === iso).length;
            const isSelected = iso === currentDateStr;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  onSelectDate(iso);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-right transition-colors ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div>
                  <span className="text-xs font-bold">{formatPersianDate(iso)}</span>
                  <span className="text-[11px] text-slate-400 mr-2">
                    ({getRelativeDayLabel(iso)})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] tabular-nums shrink-0">
                  {pCount > 0 && (
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">
                      {toPersianNum(pCount)} بیمار
                    </span>
                  )}
                  {prCount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      · {toPersianNum(prCount)} عمل
                    </span>
                  )}
                  {pCount === 0 && prCount === 0 && (
                    <span className="text-slate-400">بدون ثبت</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ==========================================
   4. SETTINGS, CLOUD SYNC & BACKUP MODAL
   ========================================== */
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudConfig: CloudConfig;
  cloudStatus: string;
  onSaveCloudConfig: (cfg: CloudConfig) => void;
  onSyncToCloud: (cfg: CloudConfig) => void;
  onPullFromCloud: (cfg: CloudConfig) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  cloudConfig,
  cloudStatus,
  onSaveCloudConfig,
  onSyncToCloud,
  onPullFromCloud,
  onExportBackup,
  onImportBackup,
}) => {
  const [token, setToken] = useState(cloudConfig.token);
  const [gistId, setGistId] = useState(cloudConfig.gistId);

  React.useEffect(() => {
    if (isOpen) {
      setToken(cloudConfig.token);
      setGistId(cloudConfig.gistId);
    }
  }, [isOpen, cloudConfig]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#0f1623] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            تنظیمات، همگام‌سازی ابری و پشتیبان‌گیری
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Local Backup */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              پشتیبان‌گیری فایل روی گوشی یا سیستم (آفلاین)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              تمامی اطلاعات به صورت لحظه‌ای در حافظه آفلاین مرورگر ذخیره می‌شوند و کاملاً سازگار با
              نسخه قبلی دستیار دوانلو هستند.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onExportBackup}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>دانلود فایل پشتیبان (JSON)</span>
              </button>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>بازیابی فایل پشتیبان</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportBackup(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* GitHub Gist Cloud Sync */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                همگام‌سازی ابری گیت‌هاب (GitHub Gist Cloud)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              با وارد کردن توکن گیت‌هاب (دارای دسترسی <code>gist</code>)، اطلاعات شما به صورت
              هوشمند با تأخیر ۳ ثانیه (Debounced) روی فضای ابری خصوصی گیت‌هاب ذخیره می‌شود.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                توکن شخصی گیت‌هاب (GitHub Token)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  onSaveCloudConfig({ token: e.target.value.trim(), gistId: gistId.trim() });
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                dir="ltr"
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                شناسه Gist ابری (خالی بگذارید تا خودکار ساخته شود)
              </label>
              <input
                type="text"
                value={gistId}
                onChange={(e) => {
                  setGistId(e.target.value);
                  onSaveCloudConfig({ token: token.trim(), gistId: e.target.value.trim() });
                }}
                placeholder="به صورت خودکار پر می‌شود"
                dir="ltr"
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onSyncToCloud({ token: token.trim(), gistId: gistId.trim() })
                }
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-colors"
              >
                <CloudUpload className="w-4 h-4" />
                <span>ذخیره و ارسال به ابر</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onPullFromCloud({ token: token.trim(), gistId: gistId.trim() })
                }
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                <CloudDownload className="w-4 h-4" />
                <span>دریافت از ابر</span>
              </button>
            </div>
            {cloudStatus && (
              <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                {cloudStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
