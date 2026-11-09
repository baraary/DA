import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Star,
  Shield,
  FlaskConical,
  Scan,
  MapPin,
  CreditCard,
  FileText,
  Save,
  Trash2,
} from 'lucide-react';
import {
  DatabaseSchema,
  PatientRecord,
  PaymentStatus,
  ServiceType,
  DEFAULT_PRIMARY_WARDS,
  DEFAULT_SECONDARY_WARDS,
} from '../types';
import {
  buildSortedFrequencyItems,
  formatPersianDate,
  getCurrentTimePersian,
  toPersianNum,
} from '../utils/dateUtils';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseSchema;
  currentDateStr: string;
  editPatient?: PatientRecord | null;
  defaultWard?: string;
  onSave: (
    patient: PatientRecord,
    isNew: boolean,
    metaUpdates: {
      doctor?: string;
      problem?: string;
      request?: string;
      baseInsurance?: string;
      suppInsurance?: string;
    }
  ) => void;
  onAddInsuranceToList: (insType: 'base' | 'supp', name: string) => void;
  onDeleteSmartTag?: (
    category: 'doctor' | 'problem' | 'request' | 'baseIns' | 'suppIns',
    name: string
  ) => void;
}

const IMAGING_OPTIONS = [
  'سونوگرافی',
  'سی‌تی‌اسکن (CT)',
  'ام‌آر‌آی (MRI)',
  'گرافی (CXR / ساده)',
  'اکو / داپلر',
];

const LOCATION_OPTIONS = [
  'بخش سونوگرافی',
  'پرتابل (بر بالین)',
  'سی‌تی‌اسکن',
  'کت‌لب (Cath Lab)',
  'ویزیت در بخش',
  'اتاق عمل',
];

const CONSUMABLE_SUGGESTIONS = [
  'ست نفروستومی',
  'نیدل شیبا',
  'سوزن بیوپسی',
  'کاتتر درناژ / پیگ‌تیل',
  'پرمیکت / شالدون',
  'آنتن مایکروویو',
];

const LAB_QUICK_TAGS = ['INR=1.1', 'Plt>100k', 'Hb نرمال', 'Cr نرمال', 'INR بالا (نیاز به FFP)'];

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  db,
  currentDateStr,
  editPatient,
  defaultWard,
  onSave,
  onAddInsuranceToList,
  onDeleteSmartTag,
}) => {
  const primaryWards = db.primaryWardsOrder?.length
    ? db.primaryWardsOrder
    : DEFAULT_PRIMARY_WARDS;
  const secondaryWards = db.secondaryWardsOrder?.length
    ? db.secondaryWardsOrder
    : DEFAULT_SECONDARY_WARDS;

  const [ward, setWard] = useState<string>(primaryWards[0]);
  const [showSecondaryWards, setShowSecondaryWards] = useState(false);
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('consult');
  const [doctor, setDoctor] = useState('');
  const [baseInsurance, setBaseInsurance] = useState('');
  const [suppInsurance, setSuppInsurance] = useState('');
  const [problem, setProblem] = useState('');
  const [request, setRequest] = useState('');
  const [manageTagsMode, setManageTagsMode] = useState(false);

  // Optional toggle sections
  const [secLabActive, setSecLabActive] = useState(false);
  const [labStatus, setLabStatus] = useState('دارد');
  const [labNote, setLabNote] = useState('');

  const [secImagingActive, setSecImagingActive] = useState(false);
  const [imaging, setImaging] = useState<string[]>([]);

  const [secLocationActive, setSecLocationActive] = useState(false);
  const [location, setLocation] = useState('بخش سونوگرافی');

  const [secPaymentActive, setSecPaymentActive] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [consumableNote, setConsumableNote] = useState('');

  const [secNotesActive, setSecNotesActive] = useState(false);
  const [notes, setNotes] = useState('');

  // Smart Insurance dropdown visibility
  const [openInsDropdown, setOpenInsDropdown] = useState<'base' | 'supp' | null>(null);
  const baseInsRef = useRef<HTMLDivElement>(null);
  const suppInsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setManageTagsMode(false);
    if (editPatient) {
      setWard(editPatient.ward || primaryWards[0]);
      setShowSecondaryWards(secondaryWards.includes(editPatient.ward));
      setName(editPatient.name || '');
      setServiceType(editPatient.serviceType || 'consult');
      setDoctor(editPatient.doctor || '');
      setBaseInsurance(editPatient.baseInsurance || '');
      setSuppInsurance(editPatient.suppInsurance || '');
      setProblem(editPatient.problem || '');
      setRequest(editPatient.request || '');

      if (editPatient.labStatus || editPatient.labNote) {
        setSecLabActive(true);
        setLabStatus(editPatient.labStatus || 'دارد');
        setLabNote(editPatient.labNote || '');
      } else {
        setSecLabActive(false);
        setLabStatus('دارد');
        setLabNote('');
      }

      if (editPatient.imaging && editPatient.imaging.length > 0) {
        setSecImagingActive(true);
        setImaging(editPatient.imaging);
      } else {
        setSecImagingActive(false);
        setImaging([]);
      }

      if (editPatient.location) {
        setSecLocationActive(true);
        setLocation(editPatient.location);
      } else {
        setSecLocationActive(false);
        setLocation('بخش سونوگرافی');
      }

      if (editPatient.paymentStatus && editPatient.paymentStatus !== 'none') {
        setSecPaymentActive(true);
        setPaymentStatus(editPatient.paymentStatus);
        setConsumableNote(editPatient.consumableNote || '');
      } else {
        setSecPaymentActive(false);
        setPaymentStatus('paid');
        setConsumableNote('');
      }

      if (editPatient.notes) {
        setSecNotesActive(true);
        setNotes(editPatient.notes);
      } else {
        setSecNotesActive(false);
        setNotes('');
      }
    } else {
      const targetWard = defaultWard || primaryWards[0];
      setWard(targetWard);
      setShowSecondaryWards(secondaryWards.includes(targetWard));
      setName('');
      setServiceType('consult');
      setDoctor('');
      setBaseInsurance('');
      setSuppInsurance('');
      setProblem('');
      setRequest('');
      setSecLabActive(false);
      setLabStatus('دارد');
      setLabNote('');
      setSecImagingActive(false);
      setImaging([]);
      setSecLocationActive(false);
      setLocation('بخش سونوگرافی');
      setSecPaymentActive(false);
      setPaymentStatus('paid');
      setConsumableNote('');
      setSecNotesActive(false);
      setNotes('');
    }
  }, [isOpen, editPatient, defaultWard]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        baseInsRef.current &&
        !baseInsRef.current.contains(e.target as Node) &&
        suppInsRef.current &&
        !suppInsRef.current.contains(e.target as Node)
      ) {
        setOpenInsDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!isOpen) return null;

  const sortedDoctors = buildSortedFrequencyItems(
    db.doctors,
    db.doctorCounts,
    db.patients,
    'doctor',
    false
  );
  const sortedProblems = buildSortedFrequencyItems(
    db.problems,
    db.problemCounts,
    db.patients,
    'problem',
    true
  );
  const sortedRequests = buildSortedFrequencyItems(
    db.requests,
    db.requestCounts,
    db.patients,
    'request',
    true
  );

  const allRecordsForIns = [...db.patients, ...db.procedures];
  const sortedBaseIns = buildSortedFrequencyItems(
    db.baseInsurances,
    db.baseInsuranceCounts,
    allRecordsForIns,
    'baseInsurance',
    false
  );
  const sortedSuppIns = buildSortedFrequencyItems(
    db.suppInsurances,
    db.suppInsuranceCounts,
    allRecordsForIns,
    'suppInsurance',
    false
  );

  const appendToken = (currentVal: string, token: string, setter: (v: string) => void) => {
    const trimmed = currentVal.trim();
    if (!trimmed) {
      setter(token);
      return;
    }
    if (trimmed.includes(token)) return;
    setter(`${trimmed} + ${token}`);
  };

  const toggleImagingItem = (item: string) => {
    if (item === 'ندارد') {
      setImaging(['ندارد']);
      return;
    }
    const withoutNone = imaging.filter((x) => x !== 'ندارد');
    if (withoutNone.includes(item)) {
      setImaging(withoutNone.filter((x) => x !== item));
    } else {
      setImaging([...withoutNone, item]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'بیمار بی‌نام';
    const isNew = !editPatient;

    const record: PatientRecord = {
      id: editPatient ? editPatient.id : 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: editPatient ? editPatient.date : currentDateStr,
      time: editPatient ? editPatient.time : getCurrentTimePersian(),
      ward,
      name: cleanName,
      serviceType,
      doctor: serviceType === 'own' ? 'دکتر دوانلو' : doctor.trim(),
      baseInsurance: baseInsurance.trim(),
      suppInsurance: suppInsurance.trim(),
      problem: problem.trim(),
      request: request.trim(),
      labStatus: secLabActive ? labStatus : '',
      labNote: secLabActive ? labNote.trim() : '',
      imaging: secImagingActive ? imaging : [],
      location: secLocationActive ? location : '',
      paymentStatus: secPaymentActive ? paymentStatus : 'none',
      consumableNote: secPaymentActive ? consumableNote.trim() : '',
      notes: secNotesActive ? notes.trim() : '',
      status: editPatient ? editPatient.status : 'pending',
      carriedFrom: editPatient?.carriedFrom,
      order: editPatient?.order,
    };

    onSave(record, isNew, {
      doctor: serviceType === 'consult' ? doctor.trim() : undefined,
      problem: problem.trim(),
      request: request.trim(),
      baseInsurance: baseInsurance.trim(),
      suppInsurance: suppInsurance.trim(),
    });
    onClose();
  };

  const renderInsuranceField = (
    type: 'base' | 'supp',
    label: string,
    value: string,
    onChange: (v: string) => void,
    list: { name: string; count: number }[],
    refObj: React.RefObject<HTMLDivElement | null>
  ) => {
    const q = value.trim().toLowerCase();
    const filtered = list.filter((item) => !q || item.name.toLowerCase().includes(q));
    const exactExists = list.some((item) => item.name.toLowerCase() === q);

    return (
      <div className="relative" ref={refObj}>
        <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
          <span>{label}</span>
          <span className="text-[11px] font-normal text-sky-600 dark:text-sky-400">جستجو / افزودن</span>
        </label>
        <input
          type="text"
          value={value}
          onFocus={() => setOpenInsDropdown(type)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpenInsDropdown(type);
          }}
          placeholder={type === 'base' ? 'نام بیمه پایه...' : 'نام بیمه تکمیلی...'}
          className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
        />
        {openInsDropdown === type && (
          <div className="absolute z-30 top-full mt-1 inset-x-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-2 max-h-44 overflow-y-auto">
            {value.trim() && !exactExists && (
              <button
                type="button"
                onClick={() => {
                  onAddInsuranceToList(type, value.trim());
                  setOpenInsDropdown(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 mb-1.5 rounded-lg bg-sky-500/10 border border-dashed border-sky-500/40 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن «{value.trim()}» به فهرست بیمه</span>
              </button>
            )}
            {filtered.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {filtered.map((item) => (
                  <div
                    key={item.name}
                    className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(item.name);
                        setOpenInsDropdown(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 hover:bg-sky-500/15 transition-colors"
                    >
                      <Shield className="w-3 h-3 text-sky-500" />
                      <span>{item.name}</span>
                      {item.count > 0 && (
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          · {toPersianNum(item.count)}
                        </span>
                      )}
                    </button>
                    {onDeleteSmartTag && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSmartTag(type === 'base' ? 'baseIns' : 'suppIns', item.name);
                        }}
                        title="حذف از فهرست بیمه"
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-1">
                نام بیمه را تایپ کنید تا اضافه شود
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white dark:bg-[#0f1623] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {editPatient ? 'ویرایش اطلاعات بیمار / مشاوره' : 'ثبت بیمار / مشاوره جدید'}
            </h2>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
              تاریخ ثبت: {formatPersianDate(editPatient ? editPatient.date : currentDateStr)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onDeleteSmartTag && (
              <button
                type="button"
                onClick={() => setManageTagsMode(!manageTagsMode)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                  manageTagsMode
                    ? 'bg-rose-500/15 border-rose-500 text-rose-500'
                    : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="حذف تگ‌های پیشنهادی اضافی یا اشتباه"
              >
                {manageTagsMode ? 'پایان حذف تگ‌ها' : 'مدیریت تگ‌ها'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* 1. Ward Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ۱. انتخاب بخش
              </label>
              <button
                type="button"
                onClick={() => setShowSecondaryWards(!showSecondaryWards)}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>{showSecondaryWards ? 'بستن بخش‌های فرعی' : '+ سایر بخش‌ها (فرعی)'}</span>
                {showSecondaryWards ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {primaryWards.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWard(w)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    ward === w
                      ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            {showSecondaryWards && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                {secondaryWards.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWard(w)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      ward === w
                        ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                        : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Patient Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              ۲. نام و نام خانوادگی بیمار (و شماره تخت)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: محمد رضایی - تخت ۴"
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* 3. Service Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              ۳. وضعیت سرویس بیمار
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceType('consult')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  serviceType === 'consult'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>سرویس سایر پزشکان (مشاوره)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setServiceType('own');
                  setDoctor('دکتر دوانلو');
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  serviceType === 'own'
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>در سرویس دکتر دوانلو</span>
              </button>
            </div>
          </div>

          {/* 4. Referring Doctor */}
          {serviceType === 'consult' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ۴. نام پزشک معالج
                </label>
                <span className="text-[11px] text-sky-600 dark:text-sky-400">
                  {manageTagsMode ? 'روی × بزنید تا تگ حذف شود' : 'مرتب‌شده بر اساس بیشترین تکرار'}
                </span>
              </div>
              <input
                type="text"
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                placeholder="نام پزشک را بنویسید یا از زیر انتخاب کنید"
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              />
              {sortedDoctors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sortedDoctors.slice(0, 12).map((doc) => (
                    <button
                      key={doc.name}
                      type="button"
                      onClick={() => {
                        if (manageTagsMode && onDeleteSmartTag) {
                          onDeleteSmartTag('doctor', doc.name);
                        } else {
                          setDoctor(doc.name);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        manageTagsMode
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{doc.name}</span>
                      {manageTagsMode ? (
                        <Trash2 className="w-3 h-3 text-rose-500" />
                      ) : (
                        doc.count > 0 && (
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">
                            · {toPersianNum(doc.count)}
                          </span>
                        )
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5 & 6. Base & Supplementary Insurance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderInsuranceField(
              'base',
              '۵. بیمه پایه',
              baseInsurance,
              setBaseInsurance,
              sortedBaseIns,
              baseInsRef
            )}
            {renderInsuranceField(
              'supp',
              '۶. بیمه تکمیلی',
              suppInsurance,
              setSuppInsurance,
              sortedSuppIns,
              suppInsRef
            )}
          </div>

          {/* 7. Problem / Diagnosis */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ۷. نوع مشکل بیمار / تشخیص
              </label>
              <span className="text-[11px] text-sky-600 dark:text-sky-400">
                {manageTagsMode ? 'حالت حذف تگ فعال است' : 'هوشمند بر اساس تکرار'}
              </span>
            </div>
            <input
              type="text"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="مثلاً: هیدرونفروز، توده کبدی، پلورال افیوژن..."
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sortedProblems.slice(0, 12).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    if (manageTagsMode && onDeleteSmartTag) {
                      onDeleteSmartTag('problem', item.name);
                    } else {
                      appendToken(problem, item.name, setProblem);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    manageTagsMode
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{manageTagsMode ? item.name : `+ ${item.name}`}</span>
                  {manageTagsMode ? (
                    <Trash2 className="w-3 h-3 text-rose-500" />
                  ) : (
                    item.count > 0 && (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">
                        · {toPersianNum(item.count)}
                      </span>
                    )
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Consultation / Action Request */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ۸. نوع درخواست مشاوره / اقدام
              </label>
              <span className="text-[11px] text-sky-600 dark:text-sky-400">
                {manageTagsMode ? 'حالت حذف تگ فعال است' : 'هوشمند بر اساس تکرار'}
              </span>
            </div>
            <input
              type="text"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="مثلاً: مشاوره ویزیت، نفروستومی، بیوپسی..."
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sortedRequests.slice(0, 12).map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    if (manageTagsMode && onDeleteSmartTag) {
                      onDeleteSmartTag('request', item.name);
                    } else {
                      appendToken(request, item.name, setRequest);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    manageTagsMode
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{manageTagsMode ? item.name : `+ ${item.name}`}</span>
                  {manageTagsMode ? (
                    <Trash2 className="w-3 h-3 text-rose-500" />
                  ) : (
                    item.count > 0 && (
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">
                        · {toPersianNum(item.count)}
                      </span>
                    )
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Sections Divider */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
              گزینه‌های تکمیلی (هر کدام نیاز است را فعال کنید)
            </span>
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
          </div>

          {/* Toggle 1: Lab Status */}
          <div
            className={`rounded-xl border transition-colors ${
              secLabActive
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setSecLabActive(!secLabActive)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-right"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    secLabActive
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {secLabActive && <Check className="w-3.5 h-3.5" />}
                </div>
                <FlaskConical className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  وضعیت آزمایش‌ها (INR / Plt / Cr)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {secLabActive ? 'فعال' : 'تیک بزنید'}
              </span>
            </button>
            {secLabActive && (
              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {(['دارد', 'ندارد', 'در انتظار جواب', 'مختل (نیاز به اصلاح)'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setLabStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          labStatus === st
                            ? st.includes('مختل') || st === 'ندارد'
                              ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
                <input
                  type="text"
                  value={labNote}
                  onChange={(e) => setLabNote(e.target.value)}
                  placeholder="توضیح آزمایش (مثلاً: INR=1.2 , Plt=140000)"
                  className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-1.5">
                  {LAB_QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => appendToken(labNote, tag, setLabNote)}
                      className="px-2 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-sky-500/15"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toggle 2: Imaging */}
          <div
            className={`rounded-xl border transition-colors ${
              secImagingActive
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setSecImagingActive(!secImagingActive)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-right"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    secImagingActive
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {secImagingActive && <Check className="w-3.5 h-3.5" />}
                </div>
                <Scan className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تصویربرداری (CT، MRI، سونو، گرافی)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {secImagingActive ? 'فعال' : 'تیک بزنید'}
              </span>
            </button>
            {secImagingActive && (
              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5">
                {IMAGING_OPTIONS.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => toggleImagingItem(img)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      imaging.includes(img)
                        ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {img}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => toggleImagingItem('ندارد')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    imaging.includes('ندارد')
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  تصویربرداری ندارد
                </button>
              </div>
            )}
          </div>

          {/* Toggle 3: Location */}
          <div
            className={`rounded-xl border transition-colors ${
              secLocationActive
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setSecLocationActive(!secLocationActive)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-right"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    secLocationActive
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {secLocationActive && <Check className="w-3.5 h-3.5" />}
                </div>
                <MapPin className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  محل انجام اقدام / ویزیت
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {secLocationActive ? 'فعال' : 'تیک بزنید'}
              </span>
            </button>
            {secLocationActive && (
              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5">
                {LOCATION_OPTIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      location === loc
                        ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle 4: Cost & Consumables */}
          <div
            className={`rounded-xl border transition-colors ${
              secPaymentActive
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setSecPaymentActive(!secPaymentActive)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-right"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    secPaymentActive
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {secPaymentActive && <Check className="w-3.5 h-3.5" />}
                </div>
                <CreditCard className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  هزینه و لوازم مصرفی
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {secPaymentActive ? 'فعال' : 'تیک بزنید'}
              </span>
            </button>
            {secPaymentActive && (
              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    هزینه پرداخت شده
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      paymentStatus === 'unpaid'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    پرداخت نشده
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('partial')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      paymentStatus === 'partial'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    بیعانه / بخشی پرداخت شده
                  </button>
                </div>
                <input
                  type="text"
                  value={consumableNote}
                  onChange={(e) => setConsumableNote(e.target.value)}
                  placeholder="هزینه چه وسیله‌ای؟ (مثلاً: ست نفروستومی و نیدل شیبا)"
                  className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-1.5">
                  {CONSUMABLE_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => appendToken(consumableNote, sug, setConsumableNote)}
                      className="px-2 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-sky-500/15"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toggle 5: Notes */}
          <div
            className={`rounded-xl border transition-colors ${
              secNotesActive
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setSecNotesActive(!secNotesActive)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-right"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    secNotesActive
                      ? 'bg-sky-500 border-sky-500 text-white'
                      : 'border-slate-400 dark:border-slate-600'
                  }`}
                >
                  {secNotesActive && <Check className="w-3.5 h-3.5" />}
                </div>
                <FileText className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  توضیحات تکمیلی و شماره همراه
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {secNotesActive ? 'فعال' : 'تیک بزنید'}
              </span>
            </button>
            {secNotesActive && (
              <div className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="هرگونه نکته تکمیلی، شماره تماس همراه، ساعت هماهنگ‌شده..."
                  className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button
            type="submit"
            className="flex-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره اطلاعات بیمار</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            انصراف
          </button>
        </div>
      </form>
    </div>
  );
};
