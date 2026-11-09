import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Star,
  Shield,
  Activity,
  Trash2,
  Sparkles,
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

interface FastEntrySheetProps {
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
  onDeleteSmartTag?: (
    category: 'doctor' | 'problem' | 'request' | 'baseIns' | 'suppIns',
    name: string
  ) => void;
}

export const FastEntrySheet: React.FC<FastEntrySheetProps> = ({
  isOpen,
  onClose,
  db,
  currentDateStr,
  editPatient,
  defaultWard,
  onSave,
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
  const [problem, setProblem] = useState('');
  const [request, setRequest] = useState('');
  const [baseInsurance, setBaseInsurance] = useState('');
  const [suppInsurance, setSuppInsurance] = useState('');
  const [labStatus, setLabStatus] = useState<string>('');
  const [labNote, setLabNote] = useState('');
  const [location, setLocation] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
  const [consumableNote, setConsumableNote] = useState('');
  const [notes, setNotes] = useState('');

  const [activeStep, setActiveStep] = useState<'core' | 'details'>('core');

  useEffect(() => {
    if (!isOpen) return;
    setActiveStep('core');
    if (editPatient) {
      setWard(editPatient.ward || primaryWards[0]);
      setShowSecondaryWards(secondaryWards.includes(editPatient.ward));
      setName(editPatient.name || '');
      setServiceType(editPatient.serviceType || 'consult');
      setDoctor(editPatient.doctor || '');
      setProblem(editPatient.problem || '');
      setRequest(editPatient.request || '');
      setBaseInsurance(editPatient.baseInsurance || '');
      setSuppInsurance(editPatient.suppInsurance || '');
      setLabStatus(editPatient.labStatus || '');
      setLabNote(editPatient.labNote || '');
      setLocation(editPatient.location || '');
      setPaymentStatus(editPatient.paymentStatus || 'none');
      setConsumableNote(editPatient.consumableNote || '');
      setNotes(editPatient.notes || '');
    } else {
      const targetWard = defaultWard || primaryWards[0];
      setWard(targetWard);
      setShowSecondaryWards(secondaryWards.includes(targetWard));
      setName('');
      setServiceType('consult');
      setDoctor('');
      setProblem('');
      setRequest('');
      setBaseInsurance('');
      setSuppInsurance('');
      setLabStatus('');
      setLabNote('');
      setLocation('');
      setPaymentStatus('none');
      setConsumableNote('');
      setNotes('');
    }
  }, [isOpen, editPatient, defaultWard]);

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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim() || 'بیمار بدون نام';
    const isNew = !editPatient;

    const record: PatientRecord = {
      id: editPatient
        ? editPatient.id
        : 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
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
      labStatus,
      labNote: labNote.trim(),
      imaging: editPatient?.imaging || [],
      location: location.trim(),
      paymentStatus,
      consumableNote: consumableNote.trim(),
      notes: notes.trim(),
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-[#0b0f19] text-slate-100 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Command Deck Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#080b12] border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-sm shadow-teal-400/50" />
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                <span>{editPatient ? 'ویرایش پرونده بالینی' : 'پذیرش بالینی سریع'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-mono">
                  FAST-DECK
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {formatPersianDate(editPatient ? editPatient.date : currentDateStr)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveStep('core')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeStep === 'core'
                    ? 'bg-teal-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                اصلی
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('details')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeStep === 'details'
                    ? 'bg-teal-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                تکمیلی
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
          {activeStep === 'core' ? (
            <>
              {/* 1. Ward Grid Selector */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                  <span>۱. انتخاب بخش بستری</span>
                  <button
                    type="button"
                    onClick={() => setShowSecondaryWards(!showSecondaryWards)}
                    className="text-teal-400 hover:underline flex items-center gap-0.5 text-[10.5px]"
                  >
                    <span>{showSecondaryWards ? 'بستن فرعی' : '+ سایر بخش‌ها'}</span>
                    {showSecondaryWards ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {primaryWards.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWard(w)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-extrabold border truncate transition-all ${
                        ward === w
                          ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-xs shadow-teal-500/20'
                          : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                {showSecondaryWards && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-slate-800/60">
                    {secondaryWards.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWard(w)}
                        className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold border truncate transition-all ${
                          ward === w
                            ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                            : 'bg-slate-900/50 border-slate-800/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Patient Name & Service Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    ۲. نام و مشخصات بیمار
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="نام، نام خانوادگی، شماره تخت..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    ۳. سرویس
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setServiceType('consult')}
                      className={`py-2 px-1.5 rounded-xl text-[10.5px] font-bold border transition-colors truncate ${
                        serviceType === 'consult'
                          ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      مشاوره
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceType('own');
                        setDoctor('دکتر دوانلو');
                      }}
                      className={`py-2 px-1.5 rounded-xl text-[10.5px] font-bold border transition-colors truncate ${
                        serviceType === 'own'
                          ? 'bg-indigo-500/25 border-indigo-400 text-indigo-300 font-black'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      دوانلو
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Attending Doctor (If consult) */}
              {serviceType === 'consult' && (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>۴. پزشک معالج</span>
                    <span className="text-[10px] text-teal-400/80">کلیک سریع روی نام</span>
                  </div>
                  <input
                    type="text"
                    value={doctor}
                    onChange={(e) => setDoctor(e.target.value)}
                    placeholder="نام پزشک معالج..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 mb-1.5"
                  />
                  {sortedDoctors.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {sortedDoctors.slice(0, 10).map((doc) => (
                        <button
                          key={doc.name}
                          type="button"
                          onClick={() => setDoctor(doc.name)}
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border transition-colors ${
                            doctor === doc.name
                              ? 'bg-teal-500 text-slate-950 font-black border-teal-400'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {doc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Clinical Diagnosis / Problem */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>۵. مشکل بالینی / تشخیص</span>
                  <span className="text-[10px] text-teal-400/80">برای ترکیب، چند تگ بزنید</span>
                </div>
                <input
                  type="text"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="تشخیص یا مشکل اصلی..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {sortedProblems.slice(0, 10).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        if (!problem.trim()) setProblem(item.name);
                        else if (!problem.includes(item.name))
                          setProblem(`${problem} + ${item.name}`);
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-[10.5px] font-semibold text-slate-300 hover:border-slate-700 hover:text-white"
                    >
                      + {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Consultation Request / Desired Action */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>۶. درخواست اقدام / مشاوره</span>
                  <span className="text-[10px] text-teal-400/80">کلیک روی اقدام</span>
                </div>
                <input
                  type="text"
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="مثلاً: نفروستومی، بیوپسی، تعبیه کاتتر..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {sortedRequests.slice(0, 10).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        if (!request.trim()) setRequest(item.name);
                        else if (!request.includes(item.name))
                          setRequest(`${request} + ${item.name}`);
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-800 text-[10.5px] font-semibold text-slate-300 hover:border-slate-700 hover:text-white"
                    >
                      + {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* STEP 2: DETAILS & LOGISTICS */
            <div className="space-y-3 animate-in fade-in duration-100">
              {/* Insurance */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    بیمه پایه
                  </label>
                  <input
                    type="text"
                    value={baseInsurance}
                    onChange={(e) => setBaseInsurance(e.target.value)}
                    placeholder="تأمین، سلامت..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    بیمه تکمیلی
                  </label>
                  <input
                    type="text"
                    value={suppInsurance}
                    onChange={(e) => setSuppInsurance(e.target.value)}
                    placeholder="دانا، آتیه‌سازان..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Lab Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  وضعیت آزمایش (INR / Plt)
                </label>
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {(['دارد', 'ندارد', 'در انتظار', 'مختل (نیاز به اصلاح)'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setLabStatus(labStatus === st ? '' : st)}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-colors truncate ${
                        labStatus === st
                          ? st.includes('مختل')
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-teal-500/20 border-teal-400 text-teal-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={labNote}
                  onChange={(e) => setLabNote(e.target.value)}
                  placeholder="مقادیر آزمایش (مثلاً: INR=1.2 , Plt=130k)..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* Procedure Location */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  محل انجام اقدام
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    'بخش سونوگرافی',
                    'کت‌لب (Cath Lab)',
                    'پرتابل (در بخش)',
                    'سی‌تی‌اسکن',
                    'اتاق عمل',
                    'ویزیت در بخش',
                  ].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(location === loc ? '' : loc)}
                      className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold border truncate transition-colors ${
                        location === loc
                          ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consumable Device & Payment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  هزینه و وسایل مصرفی
                </label>
                <div className="grid grid-cols-3 gap-1 mb-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentStatus(paymentStatus === 'paid' ? 'none' : 'paid')
                    }
                    className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold border ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    تسویه شده
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentStatus(paymentStatus === 'unpaid' ? 'none' : 'unpaid')
                    }
                    className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold border ${
                      paymentStatus === 'unpaid'
                        ? 'bg-rose-500/25 border-rose-400 text-rose-300 font-black'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    پرداخت نشده
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentStatus(paymentStatus === 'partial' ? 'none' : 'partial')
                    }
                    className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold border ${
                      paymentStatus === 'partial'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    بیعانه
                  </button>
                </div>
                <input
                  type="text"
                  value={consumableNote}
                  onChange={(e) => setConsumableNote(e.target.value)}
                  placeholder="عنوان وسیله (مثلاً: ست نفروستومی، نیدل شیبا)..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  یادداشت و هماهنگی
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="شماره تماس همراه، ساعت هماهنگ‌شده..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-750 px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Deck */}
        <div className="p-3 bg-[#080b12] border-t border-slate-800/80 flex items-center gap-2">
          {activeStep === 'core' ? (
            <>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="flex-2 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/20 cursor-pointer active:scale-98 transition-all"
              >
                <Check className="w-4 h-4 stroke-[2.8]" />
                <span>ثبت فوری پرونده</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('details')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs border border-slate-800 cursor-pointer"
              >
                + تکمیل جزئیات
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="flex-2 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-500/20"
              >
                <Check className="w-4 h-4 stroke-[2.8]" />
                <span>ذخیره تمام اطلاعات</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('core')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 text-slate-400 font-bold text-xs border border-slate-800 cursor-pointer"
              >
                بازگشت به اصلی
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
