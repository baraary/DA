import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  PhoneCall,
  Users,
  ClipboardCheck,
  ListTodo,
  Plus,
  Minus,
  Search,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  Settings,
  Sun,
  Moon,
  Check,
  Clock,
  Bell,
  Edit3,
  Trash2,
  Copy,
  BarChart3,
  RotateCcw,
  Sparkles,
  Package,
  Activity,
  X,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DatabaseSchema,
  PatientRecord,
  ProcedureRecord,
  ProcedurePreset,
  SuspendRecord,
  NoteRecord,
  CloudConfig,
  DEFAULT_PRIMARY_WARDS,
  DEFAULT_SECONDARY_WARDS,
  DEFAULT_PROBLEMS,
  DEFAULT_REQUESTS,
  DEFAULT_XRAYS,
  PROCEDURE_PRESETS,
  STORAGE_KEY,
  CLOUD_CFG_KEY,
} from './types';
import {
  getTodayISO,
  addDaysISO,
  formatPersianDate,
  formatShortPersianDate,
  getRelativeDayLabel,
  getCurrentTimePersian,
  calculateAnesthesiaDuration,
  buildSortedFrequencyItems,
  splitTokens,
  toPersianNum,
} from './utils/dateUtils';
import { SortableItem } from './components/SortableItem';
import { SwipeablePatientCard } from './components/SwipeablePatientCard';
import { PatientModal } from './components/PatientModal';
import {
  ReportModal,
  AnalyticsModal,
  CalendarModal,
  SettingsModal,
} from './components/Modals';

const INITIAL_DB: DatabaseSchema = {
  patients: [],
  wardChecks: {},
  primaryWardsOrder: DEFAULT_PRIMARY_WARDS.slice(),
  secondaryWardsOrder: DEFAULT_SECONDARY_WARDS.slice(),
  doctors: ['دکتر دوانلو'],
  doctorCounts: {},
  problems: DEFAULT_PROBLEMS.slice(),
  problemCounts: {},
  requests: DEFAULT_REQUESTS.slice(),
  requestCounts: {},
  xrayTypes: DEFAULT_XRAYS.slice(),
  xrayCounts: {},
  baseInsurances: [],
  baseInsuranceCounts: {},
  suppInsurances: [],
  suppInsuranceCounts: {},
  procCodes: [],
  procCodeCounts: {},
  suspends: [],
  notes: [],
  procedures: [],
  procedurePresets: PROCEDURE_PRESETS.slice(),
  theme: 'dark',
  lastUpdated: Date.now(),
};

/** Helper to group an array of code strings into { code, count } items preserving first-seen order */
function groupCodesWithCounts(codes: string[]): { code: string; count: number }[] {
  const map = new Map<string, number>();
  (codes || []).forEach((c) => {
    const clean = (c || '').trim();
    if (!clean) return;
    map.set(clean, (map.get(clean) || 0) + 1);
  });
  return Array.from(map.entries()).map(([code, count]) => ({ code, count }));
}

export default function App() {
  // 1. Database & Cloud State
  const [db, setDb] = useState<DatabaseSchema>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...INITIAL_DB,
          ...parsed,
          patients: Array.isArray(parsed.patients) ? parsed.patients : [],
          procedures: Array.isArray(parsed.procedures) ? parsed.procedures : [],
          suspends: Array.isArray(parsed.suspends) ? parsed.suspends : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
          procedurePresets: Array.isArray(parsed.procedurePresets)
            ? parsed.procedurePresets
            : PROCEDURE_PRESETS.slice(),
          primaryWardsOrder:
            Array.isArray(parsed.primaryWardsOrder) && parsed.primaryWardsOrder.length > 0
              ? parsed.primaryWardsOrder
              : DEFAULT_PRIMARY_WARDS.slice(),
        };
      }
    } catch {
      // Fallback to initial DB
    }
    return INITIAL_DB;
  });

  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => {
    try {
      const raw = localStorage.getItem(CLOUD_CFG_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { token: '', gistId: '' };
  });

  const [cloudSyncState, setCloudSyncState] = useState<
    'idle' | 'syncing' | 'synced' | 'offline' | 'error'
  >(navigator.onLine ? 'idle' : 'offline');
  const [cloudStatusText, setCloudStatusText] = useState('');

  // 2. Navigation & Date State
  const [currentDateStr, setCurrentDateStr] = useState<string>(getTodayISO());
  const [activeTab, setActiveTab] = useState<'wards' | 'patients' | 'procedures' | 'tasks'>(
    'wards'
  );
  const [activeTaskSubTab, setActiveTaskSubTab] = useState<'suspend' | 'notes'>('suspend');
  const [clockStr, setClockStr] = useState<string>(getCurrentTimePersian());

  // 3. Modals State
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [modalDefaultWard, setModalDefaultWard] = useState<string | undefined>(undefined);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 4. Tab 1 (Wards) State
  const [showSecondaryWards, setShowSecondaryWards] = useState(false);
  const [reorderWardsMode, setReorderWardsMode] = useState(false);

  // 5. Tab 2 (Patients) Filters & Search
  const [patientFilter, setPatientFilter] = useState<
    'all' | 'uninformed' | 'own_service' | 'consult' | 'has_payment' | 'unpaid_all_days'
  >('all');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [searchAllHistory, setSearchAllHistory] = useState(false);

  // 6. Tab 3 (Procedures) Form & Presets Editor State
  const [editProcedureId, setEditProcedureId] = useState('');
  const [procLinkedPatientId, setProcLinkedPatientId] = useState('');
  const [procPatientName, setProcPatientName] = useState('');
  const [procBaseInsurance, setProcBaseInsurance] = useState('');
  const [procSuppInsurance, setProcSuppInsurance] = useState('');
  const [secProcDevice, setSecProcDevice] = useState(false);
  const [procDeviceName, setProcDeviceName] = useState('');
  const [secProcAnes, setSecProcAnes] = useState(false);
  const [procAnesStart, setProcAnesStart] = useState('');
  const [procAnesEnd, setProcAnesEnd] = useState('');
  const [procAnesDoctor, setProcAnesDoctor] = useState('');
  const [procCodeInput, setProcCodeInput] = useState('');
  const [procCodeQty, setProcCodeQty] = useState<number>(1);
  const [currentProcCodes, setCurrentProcCodes] = useState<string[]>([]);
  const [procInvasive, setProcInvasive] = useState(false);
  const [procPickerScope, setProcPickerScope] = useState<'unrecorded' | 'today' | 'all'>('unrecorded');
  const [procSearchQuery, setProcSearchQuery] = useState('');

  // Editable Presets State
  const [isManagingPresets, setIsManagingPresets] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetLabelInput, setPresetLabelInput] = useState('');
  const [presetCodesInput, setPresetCodesInput] = useState('');
  const [presetDeviceInput, setPresetDeviceInput] = useState('');
  const [presetInvasiveInput, setPresetInvasiveInput] = useState(false);

  // 7. Tab 4 (Suspend & Notes) Form State
  const [editSuspendId, setEditSuspendId] = useState('');
  const [susName, setSusName] = useState('');
  const [susXray, setSusXray] = useState('');
  const [susDate, setSusDate] = useState(() =>
    formatShortPersianDate(addDaysISO(getTodayISO(), -1))
  );
  const [susHistory, setSusHistory] = useState('');

  const [editNoteId, setEditNoteId] = useState('');
  const [noteCategory, setNoteCategory] = useState<string>('حسین امیرفخریان');
  const [noteText, setNoteText] = useState('');
  const [noteFilter, setNoteFilter] = useState<string>('all');

  // 8. Toast & Undo System
  const [toast, setToast] = useState<{
    message: string;
    undoAction?: () => void;
  } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const cloudDebounceRef = useRef<number | null>(null);

  const showToast = (message: string, undoAction?: () => void) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, undoAction });
    toastTimeoutRef.current = window.setTimeout(
      () => {
        setToast(null);
      },
      undoAction ? 4500 : 2500
    );
  };

  // Configure @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync theme to documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (db.theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [db.theme]);

  // Persist DB to localStorage & trigger debounced GitHub Gist Cloud Sync
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore storage quota errors
    }

    if (cloudConfig.token && cloudConfig.gistId && navigator.onLine) {
      if (cloudDebounceRef.current) window.clearTimeout(cloudDebounceRef.current);
      setCloudSyncState('syncing');
      cloudDebounceRef.current = window.setTimeout(() => {
        fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `token ${cloudConfig.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: {
              'davanloo_db.json': {
                content: JSON.stringify(db),
              },
            },
          }),
        })
          .then((res) => {
            if (res.ok) setCloudSyncState('synced');
            else setCloudSyncState('error');
          })
          .catch(() => {
            setCloudSyncState('error');
          });
      }, 2800);
    }
  }, [db, cloudConfig.token, cloudConfig.gistId]);

  // Clock & Online/Offline listeners
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockStr(getCurrentTimePersian());
    }, 30000);

    const onOnline = () => setCloudSyncState('idle');
    const onOffline = () => setCloudSyncState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const updateDB = (updater: (prev: DatabaseSchema) => DatabaseSchema) => {
    setDb((prev) => ({
      ...updater(prev),
      lastUpdated: Date.now(),
    }));
  };

  // --- DERIVED STATS FOR SELECTED DATE ---
  const primaryWards = db.primaryWardsOrder?.length
    ? db.primaryWardsOrder
    : DEFAULT_PRIMARY_WARDS;
  const secondaryWards = db.secondaryWardsOrder?.length
    ? db.secondaryWardsOrder
    : DEFAULT_SECONDARY_WARDS;
  const activePresets = db.procedurePresets ?? PROCEDURE_PRESETS;

  const dayPatients = useMemo(
    () => db.patients.filter((p) => p.date === currentDateStr),
    [db.patients, currentDateStr]
  );
  const dayProcedures = useMemo(
    () => db.procedures.filter((pr) => pr.date === currentDateStr),
    [db.procedures, currentDateStr]
  );

  const uninformedCount = dayPatients.filter((p) => p.status === 'pending').length;
  const ownServiceCount = dayPatients.filter((p) => p.serviceType === 'own').length;
  const consultCount = dayPatients.filter((p) => p.serviceType === 'consult').length;
  const openTasksCount =
    db.suspends.length + db.notes.filter((n) => !n.done).length;
  const unpaidAllDaysCount = db.patients.filter(
    (p) => p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial'
  ).length;

  const dayChecks = db.wardChecks[currentDateStr] || {};
  const checkedPrimaryCount = primaryWards.filter((w) => {
    const hasPatient = dayPatients.some((p) => p.ward === w);
    return hasPatient || dayChecks[w] === 'empty';
  }).length;
  const wardsProgressPct = Math.round(
    (checkedPrimaryCount / Math.max(primaryWards.length, 1)) * 100
  );

  const prevDayISO = addDaysISO(currentDateStr, -1);
  const prevDayUnfinishedCount = db.patients.filter(
    (p) => p.date === prevDayISO && p.status !== 'done'
  ).length;

  // --- DRAG AND DROP HANDLERS (@dnd-kit) ---
  const handleWardsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = primaryWards.indexOf(String(active.id));
    const newIndex = primaryWards.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(primaryWards, oldIndex, newIndex);
      updateDB((prev) => ({
        ...prev,
        primaryWardsOrder: reordered,
      }));
      showToast('ترتیب بخش‌های اصلی ذخیره شد');
    }
  };

  const handlePatientsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateDB((prev) => {
      const currentList = prev.patients.filter((p) => p.date === currentDateStr);
      const otherDays = prev.patients.filter((p) => p.date !== currentDateStr);
      const oldIdx = currentList.findIndex((p) => p.id === String(active.id));
      const newIdx = currentList.findIndex((p) => p.id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reorderedDay = arrayMove(currentList, oldIdx, newIdx);
      return {
        ...prev,
        patients: [...otherDays, ...reorderedDay],
      };
    });
    showToast('اولویت بیمار در لیست و گزارش جابه‌جا شد');
  };

  const handleProceduresDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateDB((prev) => {
      const currentList = prev.procedures.filter((pr) => pr.date === currentDateStr);
      const otherDays = prev.procedures.filter((pr) => pr.date !== currentDateStr);
      const oldIdx = currentList.findIndex((pr) => pr.id === String(active.id));
      const newIdx = currentList.findIndex((pr) => pr.id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reorderedDay = arrayMove(currentList, oldIdx, newIdx);
      return {
        ...prev,
        procedures: [...otherDays, ...reorderedDay],
      };
    });
    showToast('ترتیب کارهای انجام‌شده به‌روز شد');
  };

  const handleSuspendsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateDB((prev) => {
      const oldIdx = prev.suspends.findIndex((s) => s.id === String(active.id));
      const newIdx = prev.suspends.findIndex((s) => s.id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return {
        ...prev,
        suspends: arrayMove(prev.suspends, oldIdx, newIdx),
      };
    });
    showToast('ترتیب لیست ساسپند و پیامک جابه‌جا شد');
  };

  const handleNotesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateDB((prev) => {
      const oldIdx = prev.notes.findIndex((n) => n.id === String(active.id));
      const newIdx = prev.notes.findIndex((n) => n.id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      return {
        ...prev,
        notes: arrayMove(prev.notes, oldIdx, newIdx),
      };
    });
    showToast('ترتیب لیست یادداشت‌ها تغییر کرد');
  };

  // --- ACTIONS: WARDS & PATIENTS ---
  const toggleWardEmpty = (wardName: string) => {
    updateDB((prev) => {
      const checksForDay = { ...(prev.wardChecks[currentDateStr] || {}) };
      if (checksForDay[wardName] === 'empty') {
        delete checksForDay[wardName];
      } else {
        checksForDay[wardName] = 'empty';
      }
      return {
        ...prev,
        wardChecks: {
          ...prev.wardChecks,
          [currentDateStr]: checksForDay,
        },
      };
    });
  };

  const carryOverUnfinished = () => {
    const unfinished = db.patients.filter(
      (p) => p.date === prevDayISO && p.status !== 'done'
    );
    if (unfinished.length === 0) return;

    const existingKeys = new Set(dayPatients.map((p) => `${p.name}|${p.ward}`));
    const toCopy = unfinished.filter((p) => !existingKeys.has(`${p.name}|${p.ward}`));
    if (toCopy.length === 0) {
      showToast('همه بیماران انجام‌نشده دیروز قبلاً به امروز اضافه شده‌اند');
      return;
    }

    const cloned: PatientRecord[] = toCopy.map((p, idx) => ({
      ...p,
      id: `p_${Date.now()}_${idx}`,
      date: currentDateStr,
      status: 'pending',
      carriedFrom: p.carriedFrom || prevDayISO,
    }));

    updateDB((prev) => ({
      ...prev,
      patients: [...prev.patients, ...cloned],
    }));
    showToast(`${toPersianNum(cloned.length)} بیمار انجام‌نشده به لیست امروز منتقل شد`);
  };

  const handleSavePatient = (
    record: PatientRecord,
    isNew: boolean,
    meta: {
      doctor?: string;
      problem?: string;
      request?: string;
      baseInsurance?: string;
      suppInsurance?: string;
    }
  ) => {
    updateDB((prev) => {
      const nextDoctors = [...prev.doctors];
      const nextDocCounts = { ...prev.doctorCounts };
      if (meta.doctor) {
        if (!nextDoctors.includes(meta.doctor)) nextDoctors.push(meta.doctor);
        if (isNew) nextDocCounts[meta.doctor] = (nextDocCounts[meta.doctor] || 0) + 1;
      }

      const nextProblems = [...prev.problems];
      const nextProbCounts = { ...prev.problemCounts };
      if (meta.problem) {
        splitTokens(meta.problem).forEach((tok) => {
          if (!nextProblems.includes(tok)) nextProblems.push(tok);
          if (isNew) nextProbCounts[tok] = (nextProbCounts[tok] || 0) + 1;
        });
      }

      const nextRequests = [...prev.requests];
      const nextReqCounts = { ...prev.requestCounts };
      if (meta.request) {
        splitTokens(meta.request).forEach((tok) => {
          if (!nextRequests.includes(tok)) nextRequests.push(tok);
          if (isNew) nextReqCounts[tok] = (nextReqCounts[tok] || 0) + 1;
        });
      }

      const nextBaseIns = [...prev.baseInsurances];
      const nextBaseCounts = { ...prev.baseInsuranceCounts };
      if (meta.baseInsurance) {
        if (!nextBaseIns.includes(meta.baseInsurance)) nextBaseIns.push(meta.baseInsurance);
        if (isNew)
          nextBaseCounts[meta.baseInsurance] =
            (nextBaseCounts[meta.baseInsurance] || 0) + 1;
      }

      const nextSuppIns = [...prev.suppInsurances];
      const nextSuppCounts = { ...prev.suppInsuranceCounts };
      if (meta.suppInsurance) {
        if (!nextSuppIns.includes(meta.suppInsurance)) nextSuppIns.push(meta.suppInsurance);
        if (isNew)
          nextSuppCounts[meta.suppInsurance] =
            (nextSuppCounts[meta.suppInsurance] || 0) + 1;
      }

      const nextPatients = isNew
        ? [...prev.patients, record]
        : prev.patients.map((p) => (p.id === record.id ? record : p));

      return {
        ...prev,
        patients: nextPatients,
        doctors: nextDoctors,
        doctorCounts: nextDocCounts,
        problems: nextProblems,
        problemCounts: nextProbCounts,
        requests: nextRequests,
        requestCounts: nextReqCounts,
        baseInsurances: nextBaseIns,
        baseInsuranceCounts: nextBaseCounts,
        suppInsurances: nextSuppIns,
        suppInsuranceCounts: nextSuppCounts,
      };
    });

    showToast(isNew ? 'بیمار جدید ثبت شد' : 'اطلاعات بیمار ویرایش شد');
  };

  const handleDeleteSmartTag = (
    category: 'doctor' | 'problem' | 'request' | 'baseIns' | 'suppIns',
    name: string
  ) => {
    updateDB((prev) => {
      if (category === 'doctor') {
        const nextCounts = { ...prev.doctorCounts };
        delete nextCounts[name];
        return {
          ...prev,
          doctors: prev.doctors.filter((d) => d !== name),
          doctorCounts: nextCounts,
        };
      }
      if (category === 'problem') {
        const nextCounts = { ...prev.problemCounts };
        delete nextCounts[name];
        return {
          ...prev,
          problems: prev.problems.filter((d) => d !== name),
          problemCounts: nextCounts,
        };
      }
      if (category === 'request') {
        const nextCounts = { ...prev.requestCounts };
        delete nextCounts[name];
        return {
          ...prev,
          requests: prev.requests.filter((d) => d !== name),
          requestCounts: nextCounts,
        };
      }
      if (category === 'baseIns') {
        const nextCounts = { ...prev.baseInsuranceCounts };
        delete nextCounts[name];
        return {
          ...prev,
          baseInsurances: prev.baseInsurances.filter((d) => d !== name),
          baseInsuranceCounts: nextCounts,
        };
      }
      const nextCounts = { ...prev.suppInsuranceCounts };
      delete nextCounts[name];
      return {
        ...prev,
        suppInsurances: prev.suppInsurances.filter((d) => d !== name),
        suppInsuranceCounts: nextCounts,
      };
    });
    showToast(`«${name}» از فهرست پیشنهادها حذف شد`);
  };

  const copySinglePatientText = (p: PatientRecord) => {
    const serviceStr =
      p.serviceType === 'own'
        ? 'سرویس دکتر دوانلو'
        : `مشاوره (${p.doctor || '—'})`;
    const parts = [`*${p.ward}* | *${p.name}* (${serviceStr})`];
    if (p.baseInsurance || p.suppInsurance) {
      parts.push(
        `بیمه: ${p.baseInsurance || '—'}${p.suppInsurance ? ` / ${p.suppInsurance}` : ''}`
      );
    }
    if (p.problem) parts.push(`تشخیص: ${p.problem}`);
    if (p.request) parts.push(`درخواست: ${p.request}`);
    if (p.labStatus)
      parts.push(`آزمایش: ${p.labStatus}${p.labNote ? ` (${p.labNote})` : ''}`);
    if (p.location) parts.push(`محل: ${p.location}`);
    if (p.notes) parts.push(`توضیحات: ${p.notes}`);
    navigator.clipboard?.writeText(parts.join('\n'));
    showToast(`مشخصات «${p.name}» کپی شد`);
  };

  const cyclePatientStatus = (patientId: string) => {
    const target = db.patients.find((p) => p.id === patientId);
    if (!target) return;
    const prevStatus = target.status;
    const nextStatus =
      prevStatus === 'pending'
        ? 'informed'
        : prevStatus === 'informed'
        ? 'done'
        : 'pending';

    updateDB((prev) => ({
      ...prev,
      patients: prev.patients.map((p) =>
        p.id === patientId ? { ...p, status: nextStatus } : p
      ),
    }));

    const statusMsg =
      nextStatus === 'informed'
        ? 'وضعیت: به دکتر اطلاع داده شد'
        : nextStatus === 'done'
        ? 'وضعیت: اقدام انجام شد'
        : 'وضعیت: در انتظار اطلاع';

    showToast(statusMsg, () => {
      updateDB((prev) => ({
        ...prev,
        patients: prev.patients.map((p) =>
          p.id === patientId ? { ...p, status: prevStatus } : p
        ),
      }));
    });
  };

  const deletePatient = (patientId: string) => {
    const deleted = db.patients.find((p) => p.id === patientId);
    if (!deleted) return;
    const snapshot = [...db.patients];

    updateDB((prev) => ({
      ...prev,
      patients: prev.patients.filter((p) => p.id !== patientId),
    }));

    showToast(`«${deleted.name}» حذف شد`, () => {
      updateDB((prev) => ({
        ...prev,
        patients: snapshot,
      }));
    });
  };

  const jumpToProcedureFromPatient = (p: PatientRecord) => {
    setActiveTab('procedures');
    setProcPatientName(`${p.name}${p.ward ? ` (${p.ward})` : ''}`);
    setProcLinkedPatientId(p.id);
    if (p.baseInsurance) setProcBaseInsurance(p.baseInsurance);
    if (p.suppInsurance) setProcSuppInsurance(p.suppInsurance);
    if (p.consumableNote) {
      setSecProcDevice(true);
      setProcDeviceName(p.consumableNote);
    }
    showToast('بیمار برای ثبت کار انجام‌شده انتخاب شد');
  };

  // --- ACTIONS: PROCEDURES, MULTI-COUNT CODES & EDITABLE PRESETS ---
  const applyProcedurePreset = (preset: ProcedurePreset) => {
    setCurrentProcCodes((prev) => [...prev, ...preset.codes]);
    if (preset.device) {
      setSecProcDevice(true);
      setProcDeviceName(preset.device);
    }
    setProcInvasive(preset.invasive);
    showToast(`بسته «${preset.label}» اعمال شد`);
  };

  const handleSavePreset = () => {
    const cleanLabel = presetLabelInput.trim();
    if (!cleanLabel) {
      showToast('نام بسته آماده را وارد کنید');
      return;
    }
    const codesArr = presetCodesInput
      .split(/[\r\n،,|]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newPreset: ProcedurePreset = {
      id: editingPresetId || `preset_${Date.now()}`,
      label: cleanLabel,
      codes: codesArr,
      device: presetDeviceInput.trim(),
      invasive: presetInvasiveInput,
    };

    updateDB((prev) => {
      const currentList = prev.procedurePresets ?? PROCEDURE_PRESETS;
      const exists = currentList.some((p) => p.id === newPreset.id);
      const nextList = exists
        ? currentList.map((p) => (p.id === newPreset.id ? newPreset : p))
        : [...currentList, newPreset];
      return {
        ...prev,
        procedurePresets: nextList,
      };
    });

    setEditingPresetId(null);
    setPresetLabelInput('');
    setPresetCodesInput('');
    setPresetDeviceInput('');
    setPresetInvasiveInput(false);
    showToast('بسته آماده ذخیره شد');
  };

  const handleDeletePreset = (id: string) => {
    updateDB((prev) => ({
      ...prev,
      procedurePresets: (prev.procedurePresets ?? PROCEDURE_PRESETS).filter(
        (p) => p.id !== id
      ),
    }));
    showToast('بسته آماده حذف شد');
  };

  const addProcCodeFromInput = () => {
    const val = procCodeInput.trim();
    if (!val) return;
    const parts = val
      .split(/[\r\n،,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const qty = Math.max(1, Math.min(20, procCodeQty || 1));
    const repeated: string[] = [];
    parts.forEach((p) => {
      for (let i = 0; i < qty; i++) {
        repeated.push(p);
      }
    });
    setCurrentProcCodes((prev) => [...prev, ...repeated]);
    setProcCodeInput('');
    setProcCodeQty(1);
  };

  const incrementCodeCount = (codeName: string) => {
    setCurrentProcCodes((prev) => [...prev, codeName]);
  };

  const decrementCodeCount = (codeName: string) => {
    setCurrentProcCodes((prev) => {
      const lastIdx = prev.lastIndexOf(codeName);
      if (lastIdx === -1) return prev;
      return prev.filter((_, i) => i !== lastIdx);
    });
  };

  const removeAllInstancesOfCode = (codeName: string) => {
    setCurrentProcCodes((prev) => prev.filter((c) => c !== codeName));
  };

  const groupedCurrentProcCodes = useMemo(
    () => groupCodesWithCounts(currentProcCodes),
    [currentProcCodes]
  );

  const resetProcedureForm = () => {
    setEditProcedureId('');
    setProcLinkedPatientId('');
    setProcPatientName('');
    setProcBaseInsurance('');
    setProcSuppInsurance('');
    setSecProcDevice(false);
    setProcDeviceName('');
    setSecProcAnes(false);
    setProcAnesStart('');
    setProcAnesEnd('');
    setProcAnesDoctor('');
    setProcCodeInput('');
    setProcCodeQty(1);
    setCurrentProcCodes([]);
    setProcInvasive(false);
  };

  const saveProcedureItem = (e: React.FormEvent) => {
    e.preventDefault();
    const pendingVal = procCodeInput.trim();
    let finalCodes = [...currentProcCodes];
    if (pendingVal) {
      const parts = pendingVal
        .split(/[\r\n،,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const qty = Math.max(1, Math.min(20, procCodeQty || 1));
      parts.forEach((p) => {
        for (let i = 0; i < qty; i++) {
          finalCodes.push(p);
        }
      });
    }

    if (!procPatientName.trim()) {
      showToast('لطفاً نام بیمار را وارد یا از لیست انتخاب کنید');
      return;
    }

    const isNew = !editProcedureId;
    const record: ProcedureRecord = {
      id: editProcedureId || `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: currentDateStr,
      time: getCurrentTimePersian(),
      linkedPatientId: procLinkedPatientId,
      name: procPatientName.trim(),
      baseInsurance: procBaseInsurance.trim(),
      suppInsurance: procSuppInsurance.trim(),
      device: secProcDevice ? procDeviceName.trim() : '',
      anesStart: secProcAnes ? procAnesStart : '',
      anesEnd: secProcAnes ? procAnesEnd : '',
      anesDoctor: secProcAnes ? procAnesDoctor.trim() : '',
      codes: finalCodes,
      invasive: procInvasive,
    };

    updateDB((prev) => {
      const nextProcCodes = [...prev.procCodes];
      const nextCodeCounts = { ...prev.procCodeCounts };
      finalCodes.forEach((c) => {
        if (!nextProcCodes.includes(c)) nextProcCodes.push(c);
        if (isNew) nextCodeCounts[c] = (nextCodeCounts[c] || 0) + 1;
      });

      const nextPatients = procLinkedPatientId
        ? prev.patients.map((p) =>
            p.id === procLinkedPatientId ? { ...p, status: 'done' as const } : p
          )
        : prev.patients;

      const nextProcedures = isNew
        ? [...prev.procedures, record]
        : prev.procedures.map((pr) => (pr.id === editProcedureId ? record : pr));

      return {
        ...prev,
        patients: nextPatients,
        procedures: nextProcedures,
        procCodes: nextProcCodes,
        procCodeCounts: nextCodeCounts,
      };
    });

    resetProcedureForm();
    showToast(isNew ? 'کار انجام‌شده ثبت شد' : 'کار انجام‌شده ویرایش شد');
  };

  // --- ACTIONS: SUSPENDS & NOTES ---
  const saveSuspendItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!susName.trim() && !susXray.trim()) {
      showToast('نام بیمار یا نوع گرافی را وارد کنید');
      return;
    }
    const isNew = !editSuspendId;
    const item: SuspendRecord = {
      id: editSuspendId || `sus_${Date.now()}`,
      name: susName.trim(),
      xray: susXray.trim(),
      date: susDate.trim(),
      history: susHistory.trim(),
      createdAt: getTodayISO(),
    };

    updateDB((prev) => {
      const nextXrays = [...prev.xrayTypes];
      const nextXrayCounts = { ...prev.xrayCounts };
      if (item.xray) {
        splitTokens(item.xray).forEach((tok) => {
          if (!nextXrays.includes(tok)) nextXrays.push(tok);
          if (isNew) nextXrayCounts[tok] = (nextXrayCounts[tok] || 0) + 1;
        });
      }
      const nextSuspends = isNew
        ? [...prev.suspends, item]
        : prev.suspends.map((s) => (s.id === editSuspendId ? item : s));
      return {
        ...prev,
        xrayTypes: nextXrays,
        xrayCounts: nextXrayCounts,
        suspends: nextSuspends,
      };
    });

    setEditSuspendId('');
    setSusName('');
    setSusXray('');
    setSusHistory('');
    showToast(isNew ? 'به لیست ساسپند اضافه شد' : 'مورد ساسپند ویرایش شد');
  };

  const formatSuspendLine = (s: SuspendRecord) =>
    [s.name || 'بیمار', s.xray || 'گرافی', s.date || '—', s.history || 'بدون شرح حال'].join(
      ' - '
    );

  const suspendSmsText = useMemo(() => {
    if (db.suspends.length === 0) return 'موردی در لیست ساسپند ثبت نشده است.';
    return db.suspends.map(formatSuspendLine).join('\n');
  }, [db.suspends]);

  const saveNoteItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) {
      showToast('متن یادداشت را وارد کنید');
      return;
    }
    const isNew = !editNoteId;
    const item: NoteRecord = {
      id: editNoteId || `note_${Date.now()}`,
      category: noteCategory,
      text: noteText.trim(),
      done: false,
      date: formatShortPersianDate(currentDateStr),
    };

    updateDB((prev) => ({
      ...prev,
      notes: isNew
        ? [...prev.notes, item]
        : prev.notes.map((n) =>
            n.id === editNoteId ? { ...n, category: item.category, text: item.text } : n
          ),
    }));

    setEditNoteId('');
    setNoteText('');
    showToast(isNew ? 'یادداشت ذخیره شد' : 'یادداشت ویرایش شد');
  };

  // --- FILTERED PATIENTS LIST ---
  const filteredPatients = useMemo(() => {
    const q = patientSearchQuery.trim().toLowerCase();
    let baseList =
      searchAllHistory || patientFilter === 'unpaid_all_days'
        ? db.patients
        : dayPatients;

    if (patientFilter === 'uninformed')
      baseList = baseList.filter((p) => p.status === 'pending');
    if (patientFilter === 'own_service')
      baseList = baseList.filter((p) => p.serviceType === 'own');
    if (patientFilter === 'consult')
      baseList = baseList.filter((p) => p.serviceType === 'consult');
    if (patientFilter === 'has_payment')
      baseList = baseList.filter((p) => p.paymentStatus && p.paymentStatus !== 'none');
    if (patientFilter === 'unpaid_all_days')
      baseList = baseList.filter(
        (p) => p.paymentStatus === 'unpaid' || p.paymentStatus === 'partial'
      );

    if (q) {
      baseList = baseList.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.doctor || '').toLowerCase().includes(q) ||
          (p.ward || '').toLowerCase().includes(q) ||
          (p.baseInsurance || '').toLowerCase().includes(q) ||
          (p.suppInsurance || '').toLowerCase().includes(q) ||
          (p.problem || '').toLowerCase().includes(q) ||
          (p.request || '').toLowerCase().includes(q) ||
          (p.consumableNote || '').toLowerCase().includes(q)
      );
    }
    return baseList;
  }, [
    db.patients,
    dayPatients,
    patientFilter,
    patientSearchQuery,
    searchAllHistory,
  ]);

  const isDragEnabledOnPatients =
    !searchAllHistory &&
    patientFilter === 'all' &&
    !patientSearchQuery.trim() &&
    filteredPatients.length > 1;

  // Anesthesia duration preview
  const anesDurationInfo = useMemo(
    () => calculateAnesthesiaDuration(procAnesStart, procAnesEnd),
    [procAnesStart, procAnesEnd]
  );

  // Sorted procedure codes suggestions
  const sortedProcCodes = useMemo(() => {
    const freqMap: Record<string, number> = {};
    (db.procCodes || []).forEach((c) => {
      if (c.trim()) freqMap[c.trim()] = db.procCodeCounts?.[c.trim()] || 0;
    });
    (db.procedures || []).forEach((pr) => {
      (pr.codes || []).forEach((c) => {
        if (c.trim()) freqMap[c.trim()] = (freqMap[c.trim()] || 0) + 1;
      });
    });
    return Object.keys(freqMap)
      .map((name) => ({ name, count: freqMap[name] }))
      .sort((a, b) => b.count - a.count);
  }, [db.procCodes, db.procCodeCounts, db.procedures]);

  // Sorted Xray suggestions
  const sortedXrays = useMemo(
    () =>
      buildSortedFrequencyItems(
        db.xrayTypes,
        db.xrayCounts,
        db.suspends,
        'xray',
        true
      ),
    [db.xrayTypes, db.xrayCounts, db.suspends]
  );

  // --- CLOUD SYNC HANDLERS ---
  const handleSyncToCloudNow = (cfg: CloudConfig) => {
    setCloudConfig(cfg);
    localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
    if (!cfg.token) {
      showToast('لطفاً ابتدا توکن گیت‌هاب را وارد کنید');
      return;
    }
    setCloudStatusText('در حال ارسال اطلاعات به فضای ابری گیت‌هاب...');
    setCloudSyncState('syncing');

    const payload = {
      description: 'Davanloo Assistant Cloud Backup',
      public: false,
      files: {
        'davanloo_db.json': {
          content: JSON.stringify(db, null, 2),
        },
      },
    };
    const url = cfg.gistId
      ? `https://api.github.com/gists/${cfg.gistId}`
      : 'https://api.github.com/gists';
    const method = cfg.gistId ? 'PATCH' : 'POST';

    fetch(url, {
      method,
      headers: {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('خطا');
        return res.json();
      })
      .then((data) => {
        const newGistId = data?.id || cfg.gistId;
        const updatedCfg = { token: cfg.token, gistId: newGistId };
        setCloudConfig(updatedCfg);
        localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(updatedCfg));
        setCloudStatusText(`همگام‌سازی ابری با موفقیت انجام شد (شناسه: ${newGistId})`);
        setCloudSyncState('synced');
        showToast('در فضای ابری گیت‌هاب ذخیره شد');
      })
      .catch(() => {
        setCloudStatusText('خطا: توکن گیت‌هاب یا اتصال اینترنت را بررسی کنید.');
        setCloudSyncState('error');
        showToast('خطا در همگام‌سازی ابری');
      });
  };

  const handlePullFromCloudNow = (cfg: CloudConfig) => {
    setCloudConfig(cfg);
    localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
    if (!cfg.token || !cfg.gistId) {
      showToast('توکن و شناسه Gist را وارد کنید');
      return;
    }
    setCloudStatusText('در حال دریافت اطلاعات از فضای ابری...');
    fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: {
        Authorization: `token ${cfg.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('خطا');
        return res.json();
      })
      .then((data) => {
        const content = data?.files?.['davanloo_db.json']?.content;
        if (content) {
          const imported = JSON.parse(content);
          setDb((prev) => ({
            ...prev,
            ...imported,
          }));
          setCloudStatusText('اطلاعات با موفقیت از فضای ابری بازیابی شد.');
          setCloudSyncState('synced');
          showToast('اطلاعات از فضای ابری دریافت شد');
        } else {
          setCloudStatusText('فایل پشتیبان در این Gist یافت نشد.');
        }
      })
      .catch(() => {
        setCloudStatusText('خطا در دریافت اطلاعات از ابر.');
        showToast('خطا در دریافت از ابر');
      });
  };

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `davanloo-backup-${currentDateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('فایل پشتیبان دانلود شد');
    setIsSettingsModalOpen(false);
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(String(e.target?.result || ''));
        if (imported && Array.isArray(imported.patients)) {
          setDb((prev) => ({
            ...prev,
            ...imported,
          }));
          showToast('اطلاعات با موفقیت بازیابی شد');
          setIsSettingsModalOpen(false);
        } else {
          showToast('فایل انتخابی معتبر نیست');
        }
      } catch {
        showToast('خطا در خواندن فایل پشتیبان');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract (3 zones) */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('wards')}
            className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            دستیار آمار دکتر دوانلو
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab('wards')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'wards'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ۱. تماس بخش‌ها ({toPersianNum(checkedPrimaryCount)}/{toPersianNum(primaryWards.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('patients')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'patients'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ۲. بیماران و مشاوره‌ها ({toPersianNum(dayPatients.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('procedures')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'procedures'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ۳. کارهای انجام‌شده ({toPersianNum(dayProcedures.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'tasks'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ۴. ساسپند و یادداشت‌ها ({toPersianNum(openTasksCount)})
            </button>
          </nav>

          {/* Zone 3: Primary Action in Top Bar (Report Generator) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>گزارش برای دکتر</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-2.5 pb-28 md:pb-12 space-y-3">
        {/* Compact Workspace Toolbar: Date Nav + Utility Actions */}
        <div className="flex items-center justify-between gap-1.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-2">
          {/* Date Selector Bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setCurrentDateStr(addDaysISO(currentDateStr, -1))}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="روز قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer text-center"
              title="کلیک برای پرش به تاریخ"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-500 shrink-0 hidden sm:inline" />
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {formatPersianDate(currentDateStr)}
                </div>
                <div className="text-[10.5px] text-sky-600 dark:text-sky-400 font-medium truncate">
                  {getRelativeDayLabel(currentDateStr)} · ساعت {clockStr}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCurrentDateStr(addDaysISO(currentDateStr, 1))}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="روز بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {currentDateStr !== getTodayISO() && (
              <button
                type="button"
                onClick={() => setCurrentDateStr(getTodayISO())}
                className="px-2 py-1.5 rounded-lg bg-sky-500 text-white text-[11px] font-bold whitespace-nowrap cursor-pointer shrink-0"
              >
                امروز
              </button>
            )}
          </div>

          {/* Utility Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsAnalyticsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              title="آمار ماهانه، بدهی وسایل و خروجی اکسل"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">آمار و اکسل</span>
              {unpaidAllDaysCount > 0 && (
                <span className="text-[10.5px] text-rose-500 font-bold tabular-nums">
                  ({toPersianNum(unpaidAllDaysCount)})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="تنظیمات و پشتیبان‌گیری"
            >
              <Settings
                className={`w-4 h-4 ${
                  cloudSyncState === 'syncing'
                    ? 'animate-spin text-sky-500'
                    : cloudSyncState === 'synced'
                    ? 'text-emerald-500'
                    : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() =>
                updateDB((prev) => ({
                  ...prev,
                  theme: prev.theme === 'dark' ? 'light' : 'dark',
                }))
              }
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="تغییر پوسته تاریک / روشن"
            >
              {db.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          </div>
        </div>

        {/* Daily KPI Strip */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('patients');
              setPatientFilter('all');
            }}
            className="py-2 px-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 text-center hover:border-sky-500/50 transition-colors cursor-pointer"
          >
            <div className="text-sm sm:text-base font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
              {toPersianNum(dayPatients.length)}
            </div>
            <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              کل بیماران
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('patients');
              setPatientFilter('uninformed');
            }}
            className="py-2 px-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 text-center hover:border-amber-500/50 transition-colors cursor-pointer"
          >
            <div className="text-sm sm:text-base font-extrabold text-amber-500 tabular-nums">
              {toPersianNum(uninformedCount)}
            </div>
            <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              اطلاع‌داده‌نشده
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('patients');
              setPatientFilter('own_service');
            }}
            className="py-2 px-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
          >
            <div className="text-sm sm:text-base font-extrabold text-indigo-500 tabular-nums">
              {toPersianNum(ownServiceCount)}
            </div>
            <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              سرویس دوانلو
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('procedures')}
            className="py-2 px-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
          >
            <div className="text-sm sm:text-base font-extrabold text-emerald-500 tabular-nums">
              {toPersianNum(dayProcedures.length)}
            </div>
            <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              عمل انجام‌شده
            </div>
          </button>
        </div>

        {/* Carry-Over Banner from Yesterday */}
        {prevDayUnfinishedCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {toPersianNum(prevDayUnfinishedCount)} بیمار
              </span>{' '}
              از روز قبل هنوز «انجام شد» نخورده‌اند.
            </div>
            <button
              type="button"
              onClick={carryOverUnfinished}
              className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              انتقال به امروز
            </button>
          </div>
        )}

        {/* ==========================================
            TAB 1: 2-COLUMN COMPACT WARDS CHECKLIST
           ========================================== */}
        {activeTab === 'wards' && (
          <section className="space-y-2.5">
            {/* Compact Progress Header */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/90 rounded-2xl px-3.5 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                    تماس صبحگاهی بخش‌های اصلی
                  </h2>
                  <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                    ({toPersianNum(checkedPrimaryCount)} از {toPersianNum(primaryWards.length)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReorderWardsMode(!reorderWardsMode)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    reorderWardsMode
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>{reorderWardsMode ? 'پایان جابه‌جایی' : 'تغییر چیدمان بخش‌ها'}</span>
                </button>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-emerald-500 to-sky-500 transition-all duration-300"
                  style={{ width: `${wardsProgressPct}%` }}
                />
              </div>
            </div>

            {/* 2-Column Compact Wards Grid with @dnd-kit rectSortingStrategy */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleWardsDragEnd}
            >
              <SortableContext items={primaryWards} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {primaryWards.map((wardName) => {
                    const wardPatients = dayPatients.filter((p) => p.ward === wardName);
                    const isEmptyChecked =
                      dayChecks[wardName] === 'empty' && wardPatients.length === 0;
                    const hasPatient = wardPatients.length > 0;

                    return (
                      <SortableItem
                        key={wardName}
                        id={wardName}
                        compact
                        disabled={!reorderWardsMode}
                        handleTitle="جابه‌جایی ترتیب بخش"
                      >
                        <div
                          className={`rounded-xl border p-2.5 flex flex-col justify-between gap-2 transition-colors ${
                            hasPatient
                              ? 'bg-sky-500/10 border-sky-500/50'
                              : isEmptyChecked
                              ? 'bg-emerald-500/5 border-emerald-500/30 opacity-75'
                              : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                              {wardName}
                            </div>
                            {hasPatient ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('patients');
                                  setPatientSearchQuery(wardName);
                                }}
                                className="text-[10.5px] font-extrabold text-sky-600 dark:text-sky-400 shrink-0 tabular-nums cursor-pointer hover:underline"
                              >
                                {toPersianNum(wardPatients.length)} بیمار
                              </button>
                            ) : isEmptyChecked ? (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                بی‌مورد ✓
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                بررسی‌نشده
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPatient(null);
                                setModalDefaultWard(wardName);
                                setIsPatientModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-600 dark:text-sky-400 text-[11px] font-extrabold transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3 shrink-0" />
                              <span className="truncate">بیمار</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleWardEmpty(wardName)}
                              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                isEmptyChecked
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <Check className="w-3 h-3 shrink-0" />
                              <span className="truncate">بی‌مورد</span>
                            </button>
                          </div>
                        </div>
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Secondary Wards Toggle (Also 2-column compact) */}
            <button
              type="button"
              onClick={() => setShowSecondaryWards(!showSecondaryWards)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:border-sky-500 transition-colors cursor-pointer"
            >
              <span>بخش‌های فرعی (در صورت داشتن مشاوره یا بیمار)</span>
              <span>{showSecondaryWards ? 'بستن ▲' : 'مشاهده ▼'}</span>
            </button>

            {showSecondaryWards && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {secondaryWards.map((wardName) => {
                  const wardPatients = dayPatients.filter((p) => p.ward === wardName);
                  return (
                    <div
                      key={wardName}
                      className="flex items-center justify-between gap-1.5 p-2.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {wardName}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {wardPatients.length > 0
                            ? `${toPersianNum(wardPatients.length)} بیمار`
                            : 'فرعی'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPatient(null);
                          setModalDefaultWard(wardName);
                          setIsPatientModalOpen(true);
                        }}
                        className="inline-flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>بیمار</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==========================================
            TAB 2: PATIENTS & CONSULTATIONS (WITH SWIPE GESTURES & DND-KIT)
           ========================================== */}
        {activeTab === 'patients' && (
          <section className="space-y-3">
            {/* Search & Global History Switch */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder="جستجوی نام بیمار، بخش، پزشک، بیمه، تشخیص یا وسیله..."
                  className="w-full rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 pr-9 pl-8 py-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                />
                {patientSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPatientSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSearchAllHistory(!searchAllHistory)}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  searchAllHistory
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {searchAllHistory ? 'جستجو در کل تاریخچه: فعال' : 'جستجو در کل تاریخچه'}
                </span>
              </button>
            </div>

            {/* Interactive Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: 'all', label: `همه (${toPersianNum(dayPatients.length)})` },
                  {
                    id: 'uninformed',
                    label: `اطلاع‌داده‌نشده (${toPersianNum(uninformedCount)})`,
                  },
                  {
                    id: 'own_service',
                    label: `سرویس دکتر (${toPersianNum(ownServiceCount)})`,
                  },
                  { id: 'consult', label: `مشاوره‌ها (${toPersianNum(consultCount)})` },
                  { id: 'has_payment', label: 'دارای هزینه وسیله' },
                  {
                    id: 'unpaid_all_days',
                    label: `بدهی کل روزها (${toPersianNum(unpaidAllDaysCount)})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPatientFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                    patientFilter === f.id
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredPatients.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span>کشیدن کارت به راست: تغییر وضعیت · کشیدن به چپ: ثبت عمل انجام‌شده</span>
              </div>
            )}

            {/* Patients List with @dnd-kit & Touch Swipe Gestures */}
            {filteredPatients.length === 0 ? (
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  بیماری با این فیلتر یافت نشد.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePatientsDragEnd}
              >
                <SortableContext
                  items={filteredPatients.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2.5">
                    {filteredPatients.map((p) => {
                      const nextStatusLabel =
                        p.status === 'pending'
                          ? 'اطلاع داده شد'
                          : p.status === 'informed'
                          ? 'انجام شد'
                          : 'در انتظار اطلاع';

                      return (
                        <SortableItem
                          key={p.id}
                          id={p.id}
                          disabled={!isDragEnabledOnPatients}
                          handleTitle="جابه‌جایی اولویت بیمار"
                        >
                          <SwipeablePatientCard
                            onSwipeRight={() => cyclePatientStatus(p.id)}
                            onSwipeLeft={() => jumpToProcedureFromPatient(p)}
                            statusLabel={nextStatusLabel}
                          >
                            <div
                              className={`rounded-2xl border p-3.5 transition-all bg-white dark:bg-[#111827] ${
                                p.status === 'done'
                                  ? 'border-slate-200 dark:border-slate-800/70 opacity-75'
                                  : p.serviceType === 'own'
                                  ? 'border-indigo-500/40'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                                    {p.ward || 'بخش'}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">·</span>
                                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                                    {p.name}
                                  </h3>
                                  <span className="text-slate-300 dark:text-slate-700">·</span>
                                  <span
                                    className={`text-xs font-semibold ${
                                      p.serviceType === 'own'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {p.serviceType === 'own'
                                      ? 'سرویس دکتر دوانلو'
                                      : `مشاوره (${p.doctor || '—'})`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums shrink-0">
                                  {(searchAllHistory || patientFilter === 'unpaid_all_days') && (
                                    <span className="text-sky-500 font-semibold">
                                      {formatShortPersianDate(p.date)} ·
                                    </span>
                                  )}
                                  {p.carriedFrom && (
                                    <span className="text-amber-500 font-semibold">
                                      انتقالی از {formatShortPersianDate(p.carriedFrom)} ·
                                    </span>
                                  )}
                                  <span>{p.time}</span>
                                </div>
                              </div>

                              {/* Clean unboxed metadata with typographic separators */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {(p.baseInsurance || p.suppInsurance) && (
                                  <span>
                                    بیمه:{' '}
                                    <strong className="text-slate-900 dark:text-slate-100">
                                      {p.baseInsurance || '—'}
                                      {p.suppInsurance ? ` + ${p.suppInsurance}` : ''}
                                    </strong>
                                  </span>
                                )}
                                {p.problem && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span>
                                      تشخیص:{' '}
                                      <strong className="text-slate-900 dark:text-slate-100">
                                        {p.problem}
                                      </strong>
                                    </span>
                                  </>
                                )}
                                {p.request && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span>
                                      درخواست:{' '}
                                      <strong className="text-sky-600 dark:text-sky-400">
                                        {p.request}
                                      </strong>
                                    </span>
                                  </>
                                )}
                                {p.location && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span>
                                      محل:{' '}
                                      <strong className="text-slate-900 dark:text-slate-100">
                                        {p.location}
                                      </strong>
                                    </span>
                                  </>
                                )}
                                {p.labStatus && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span
                                      className={
                                        p.labStatus.includes('مختل') || p.labStatus === 'ندارد'
                                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                                          : ''
                                      }
                                    >
                                      آزمایش: <strong>{p.labStatus}</strong>
                                      {p.labNote ? ` (${p.labNote})` : ''}
                                    </span>
                                  </>
                                )}
                                {p.imaging && p.imaging.length > 0 && (
                                  <>
                                    <span aria-hidden="true" className="text-slate-400">
                                      ·
                                    </span>
                                    <span>
                                      تصویربرداری: <strong>{p.imaging.join('، ')}</strong>
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Consumable Payment Status Banner */}
                              {p.paymentStatus && p.paymentStatus !== 'none' && (
                                <div
                                  className={`mt-2 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between flex-wrap gap-2 border ${
                                    p.paymentStatus === 'paid'
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                      : p.paymentStatus === 'unpaid'
                                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  <span>
                                    {p.paymentStatus === 'paid'
                                      ? 'هزینه وسیله پرداخت شده'
                                      : p.paymentStatus === 'unpaid'
                                      ? 'هزینه وسیله پرداخت نشده'
                                      : 'بیعانه پرداخت شده'}
                                  </span>
                                  {p.consumableNote && <span>وسیله: {p.consumableNote}</span>}
                                </div>
                              )}

                              {/* Notes */}
                              {p.notes && (
                                <div className="mt-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 text-xs text-slate-600 dark:text-slate-300">
                                  {p.notes}
                                </div>
                              )}

                              {/* Footer Actions */}
                              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => cyclePatientStatus(p.id)}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                    p.status === 'pending'
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                      : p.status === 'informed'
                                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400'
                                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {p.status === 'pending' ? (
                                    <>
                                      <Clock className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">در انتظار اطلاع</span>
                                    </>
                                  ) : p.status === 'informed' ? (
                                    <>
                                      <Bell className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">اطلاع داده شد</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">انجام شد</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => jumpToProcedureFromPatient(p)}
                                  title="ثبت در کارهای انجام‌شده (پروسیجرها)"
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/15 hover:text-emerald-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => copySinglePatientText(p)}
                                  title="کپی مشخصات همین بیمار"
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 hover:text-sky-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPatient(p);
                                    setIsPatientModalOpen(true);
                                  }}
                                  title="ویرایش"
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 hover:text-sky-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deletePatient(p.id)}
                                  title="حذف"
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/15 hover:text-rose-500 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </SwipeablePatientCard>
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        )}

        {/* ==========================================
            TAB 3: PROCEDURES DONE (WITH MULTI-COUNT CODES & EDITABLE PRESETS)
           ========================================== */}
        {activeTab === 'procedures' && (
          <section className="space-y-4">
            {/* Procedure Entry Form */}
            <form
              onSubmit={saveProcedureItem}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editProcedureId
                    ? 'ویرایش کار انجام‌شده (پروسیجر)'
                    : 'ثبت کار انجام‌شده / پروسیجر جدید'}
                </h2>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatShortPersianDate(currentDateStr)}
                </span>
              </div>

              {/* 1. Quick Patient Picker from Registered Patients */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    انتخاب سریع از بیماران ثبت‌شده
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setProcPickerScope('unrecorded')}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        procPickerScope === 'unrecorded'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                      title="بیمارانی که هنوز کار انجام‌شده برایشان ثبت نشده است"
                    >
                      اقدام ثبت‌نشده
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcPickerScope('today')}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        procPickerScope === 'today'
                          ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      همه بیماران امروز
                    </button>
                    <button
                      type="button"
                      onClick={() => setProcPickerScope('all')}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        procPickerScope === 'all'
                          ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      کل تاریخچه
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {(() => {
                    const recordedPatientIds = new Set(
                      db.procedures
                        .map((pr) => pr.linkedPatientId)
                        .filter(Boolean)
                    );
                    const list =
                      procPickerScope === 'unrecorded'
                        ? dayPatients.filter((p) => !recordedPatientIds.has(p.id))
                        : procPickerScope === 'today'
                        ? dayPatients
                        : db.patients;

                    if (list.length === 0) {
                      return (
                        <span className="text-[11px] text-slate-400 py-1">
                          {procPickerScope === 'unrecorded'
                            ? 'همه بیماران امروز پروسیجر ثبت‌شده دارند ✓ (می‌توانید نام را دستی بنویسید یا دکمه «همه بیماران امروز» را بزنید)'
                            : 'بیماری در این فیلتر یافت نشد.'}
                        </span>
                      );
                    }

                    return list.map((p) => {
                      const hasProc = recordedPatientIds.has(p.id);
                      const isPicked = procLinkedPatientId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProcPatientName(`${p.name}${p.ward ? ` (${p.ward})` : ''}`);
                            setProcLinkedPatientId(p.id);
                            if (p.baseInsurance) setProcBaseInsurance(p.baseInsurance);
                            if (p.suppInsurance) setProcSuppInsurance(p.suppInsurance);
                            if (p.consumableNote) {
                              setSecProcDevice(true);
                              setProcDeviceName(p.consumableNote);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            isPicked
                              ? 'bg-sky-500 text-white border-sky-500'
                              : hasProc
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-500'
                          }`}
                        >
                          <span className="text-[10px] opacity-75">[{p.ward}]</span>
                          <span>{p.name}</span>
                          {hasProc && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 2. Editable / Customizable Procedure Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    بسته‌های آماده عمل (قابل ویرایش و شخصی‌سازی)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingPresets(!isManagingPresets);
                      setEditingPresetId(null);
                    }}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    {isManagingPresets ? 'بستن مدیریت بسته‌ها ▲' : 'ویرایش / افزودن بسته ✎'}
                  </button>
                </div>

                {activePresets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activePresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="inline-flex items-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => applyProcedurePreset(preset)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{preset.label}</span>
                        </button>
                        {isManagingPresets && (
                          <div className="flex items-center border-r border-indigo-500/20 pr-1 pl-1.5 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPresetId(preset.id);
                                setPresetLabelInput(preset.label);
                                setPresetCodesInput(preset.codes.join('، '));
                                setPresetDeviceInput(preset.device);
                                setPresetInvasiveInput(preset.invasive);
                              }}
                              title="ویرایش این بسته"
                              className="p-1 hover:text-sky-500"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePreset(preset.id)}
                              title="حذف این بسته"
                              className="p-1 hover:text-rose-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isManagingPresets && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {editingPresetId ? 'ویرایش بسته آماده' : 'افزودن بسته آماده جدید'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPresetCodesInput(currentProcCodes.join('، '));
                          setPresetDeviceInput(procDeviceName);
                          setPresetInvasiveInput(procInvasive);
                        }}
                        className="text-[11px] font-semibold text-sky-500 hover:underline"
                      >
                        کپی مقادیر فعلی فرم به این بسته
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={presetLabelInput}
                        onChange={(e) => setPresetLabelInput(e.target.value)}
                        placeholder="عنوان بسته (مثلاً: پورت‌گذاری)"
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={presetDeviceInput}
                        onChange={(e) => setPresetDeviceInput(e.target.value)}
                        placeholder="وسیله مصرفی پیش‌فرض (اختیاری)"
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      value={presetCodesInput}
                      onChange={(e) => setPresetCodesInput(e.target.value)}
                      placeholder="کدها را با ویرگول جدا کنید (مثلاً: تعبیه پورت، سونوگرافی عروق)"
                      className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={presetInvasiveInput}
                          onChange={(e) => setPresetInvasiveInput(e.target.checked)}
                          className="rounded accent-rose-500"
                        />
                        <span>دارای کد تهاجم پیش‌فرض</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {editingPresetId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPresetId(null);
                              setPresetLabelInput('');
                              setPresetCodesInput('');
                              setPresetDeviceInput('');
                              setPresetInvasiveInput(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
                          >
                            انصراف
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSavePreset}
                          className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold cursor-pointer"
                        >
                          {editingPresetId ? 'به‌روزرسانی بسته' : '+ ذخیره بسته جدید'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Patient Name & Insurances */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    نام بیمار
                  </label>
                  <input
                    type="text"
                    value={procPatientName}
                    onChange={(e) => setProcPatientName(e.target.value)}
                    placeholder="نام و نام خانوادگی بیمار..."
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    بیمه پایه
                  </label>
                  <input
                    type="text"
                    value={procBaseInsurance}
                    onChange={(e) => setProcBaseInsurance(e.target.value)}
                    placeholder="تأمین اجتماعی، سلامت..."
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    بیمه تکمیلی
                  </label>
                  <input
                    type="text"
                    value={procSuppInsurance}
                    onChange={(e) => setProcSuppInsurance(e.target.value)}
                    placeholder="دانا، البرز، آتیه‌سازان..."
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium"
                  />
                </div>
              </div>

              {/* 4. Optional Device & Anesthesia Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className={`rounded-xl border p-3 ${
                    secProcDevice
                      ? 'border-sky-500/60 bg-sky-500/5'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSecProcDevice(!secProcDevice)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-sky-500" />
                      <span>وسیله مصرفی به کار رفته</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {secProcDevice ? 'فعال' : 'تیک بزنید'}
                    </span>
                  </button>
                  {secProcDevice && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                      <input
                        type="text"
                        value={procDeviceName}
                        onChange={(e) => setProcDeviceName(e.target.value)}
                        placeholder="نام وسیله مصرفی..."
                        className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                      />
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    secProcAnes
                      ? 'border-sky-500/60 bg-sky-500/5'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSecProcAnes(!secProcAnes)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      <span>بیهوشی (ساعت شروع، پایان و مدت)</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {secProcAnes ? 'فعال' : 'تیک بزنید'}
                    </span>
                  </button>
                  {secProcAnes && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            شروع بیهوشی
                          </label>
                          <input
                            type="time"
                            value={procAnesStart}
                            onChange={(e) => setProcAnesStart(e.target.value)}
                            className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            پایان بیهوشی
                          </label>
                          <input
                            type="time"
                            value={procAnesEnd}
                            onChange={(e) => setProcAnesEnd(e.target.value)}
                            className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                      </div>
                      {anesDurationInfo.label && (
                        <div
                          className={`text-[11px] font-bold ${
                            anesDurationInfo.isError
                              ? 'text-rose-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          مدت زمان بیهوشی: {anesDurationInfo.label}
                        </div>
                      )}
                      <input
                        type="text"
                        value={procAnesDoctor}
                        onChange={(e) => setProcAnesDoctor(e.target.value)}
                        placeholder="نام متخصص بیهوشی..."
                        className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Multi-Code Tag Entry with Multi-Count / Quantity Support */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    کدها یا عناوین عمل انجام‌شده (امکان ثبت چندباره هر کد با دکمه + و -)
                  </label>
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold tabular-nums">
                    مجموع کدها: {toPersianNum(currentProcCodes.length)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={procCodeInput}
                    onChange={(e) => setProcCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addProcCodeFromInput();
                      }
                    }}
                    placeholder="کد یا نام عمل را بنویسید..."
                    className="flex-1 min-w-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                  />

                  {/* Quantity multiplier selector before adding */}
                  <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setProcCodeQty((q) => Math.max(1, q - 1))}
                      className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      title="کاهش تعداد"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-1.5 text-xs font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                      ×{toPersianNum(procCodeQty)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setProcCodeQty((q) => Math.min(20, q + 1))}
                      className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      title="افزایش تعداد"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={addProcCodeFromInput}
                    className="px-3 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    + افزودن
                  </button>
                </div>

                {/* Added Codes List with per-code + / - counter controls */}
                <div className="flex flex-wrap gap-1.5 mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 min-h-10">
                  {groupedCurrentProcCodes.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      هنوز کدی اضافه نشده است (برای ثبت چندباره یک کد، روی + کنار آن یا تگ پیشنهادی
                      چند بار بزنید)
                    </span>
                  ) : (
                    groupedCurrentProcCodes.map(({ code, count }) => (
                      <div
                        key={code}
                        className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-bold px-2 py-1"
                      >
                        <span>{code}</span>
                        {count > 1 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-sky-500 text-white text-[11px] font-extrabold tabular-nums">
                            ×{toPersianNum(count)}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 mr-1 border-r border-sky-500/30 pr-1">
                          <button
                            type="button"
                            onClick={() => incrementCodeCount(code)}
                            title="تکرار مجدد این کد (+۱)"
                            className="p-0.5 rounded hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => decrementCodeCount(code)}
                            title="کم کردن تعداد (-۱)"
                            className="p-0.5 rounded hover:bg-amber-500/20 text-slate-500 hover:text-amber-500 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAllInstancesOfCode(code)}
                            title="حذف کامل این کد"
                            className="p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Frequent Codes Suggestions (Each click adds +1 instance) */}
                {sortedProcCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sortedProcCodes.slice(0, 10).map((item) => {
                      const activeCount = currentProcCodes.filter(
                        (c) => c === item.name
                      ).length;
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => incrementCodeCount(item.name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            activeCount > 0
                              ? 'bg-sky-500/15 border-sky-500/40 text-sky-600 dark:text-sky-400 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-300 hover:bg-sky-500/15'
                          }`}
                        >
                          + {item.name}
                          {activeCount > 0
                            ? ` (×${toPersianNum(activeCount)})`
                            : ` · ${toPersianNum(item.count)}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. Invasive Checkbox & Submit */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={procInvasive}
                    onChange={(e) => setProcInvasive(e.target.checked)}
                    className="w-4 h-4 rounded accent-rose-500"
                  />
                  <span>ثبت «کد تهاجم» برای این عمل</span>
                </label>

                <div className="flex items-center gap-2">
                  {editProcedureId && (
                    <button
                      type="button"
                      onClick={resetProcedureForm}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
                    >
                      انصراف
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {editProcedureId ? 'ذخیره تغییرات عمل' : '+ ثبت در لیست کارهای انجام‌شده'}
                  </button>
                </div>
              </div>
            </form>

            {/* Procedures List with Search & @dnd-kit Reordering */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  لیست کارهای انجام‌شده در این تاریخ ({toPersianNum(dayProcedures.length)} مورد)
                </h3>
                <input
                  type="text"
                  value={procSearchQuery}
                  onChange={(e) => setProcSearchQuery(e.target.value)}
                  placeholder="فیلتر نام یا کد عمل..."
                  className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs"
                />
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleProceduresDragEnd}
              >
                <SortableContext
                  items={dayProcedures.map((pr) => pr.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {dayProcedures
                      .filter(
                        (pr) =>
                          !procSearchQuery.trim() ||
                          pr.name.toLowerCase().includes(procSearchQuery.toLowerCase()) ||
                          (pr.codes || []).some((c) =>
                            c.toLowerCase().includes(procSearchQuery.toLowerCase())
                          )
                      )
                      .map((pr) => {
                        const dur = calculateAnesthesiaDuration(pr.anesStart, pr.anesEnd);
                        const groupedCodes = groupCodesWithCounts(pr.codes || []);
                        return (
                          <SortableItem
                            key={pr.id}
                            id={pr.id}
                            disabled={Boolean(procSearchQuery.trim())}
                            handleTitle="جابه‌جایی ترتیب پروسیجر"
                          >
                            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-3.5 flex items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                                    {pr.name}
                                  </span>
                                  {pr.invasive && (
                                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                      · کد تهاجم
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                                  {(pr.baseInsurance || pr.suppInsurance) && (
                                    <span>
                                      بیمه:{' '}
                                      <strong>
                                        {pr.baseInsurance || '—'}
                                        {pr.suppInsurance ? ` + ${pr.suppInsurance}` : ''}
                                      </strong>
                                    </span>
                                  )}
                                  {pr.device && (
                                    <>
                                      <span>·</span>
                                      <span className="text-amber-600 dark:text-amber-400">
                                        وسیله: <strong>{pr.device}</strong>
                                      </span>
                                    </>
                                  )}
                                  {(pr.anesStart || pr.anesEnd || pr.anesDoctor) && (
                                    <>
                                      <span>·</span>
                                      <span className="text-indigo-600 dark:text-indigo-400">
                                        بیهوشی: {pr.anesStart || '؟'} تا {pr.anesEnd || '؟'}
                                        {dur.label && !dur.isError ? ` (${dur.label})` : ''}
                                        {pr.anesDoctor ? ` · دکتر ${pr.anesDoctor}` : ''}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {groupedCodes.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {groupedCodes.map(({ code, count }) => (
                                      <span
                                        key={code}
                                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1"
                                      >
                                        <span>{code}</span>
                                        {count > 1 && (
                                          <strong className="text-sky-700 dark:text-sky-300 tabular-nums">
                                            ×{toPersianNum(count)}
                                          </strong>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditProcedureId(pr.id);
                                    setProcLinkedPatientId(pr.linkedPatientId || '');
                                    setProcPatientName(pr.name || '');
                                    setProcBaseInsurance(pr.baseInsurance || '');
                                    setProcSuppInsurance(pr.suppInsurance || '');
                                    setSecProcDevice(Boolean(pr.device));
                                    setProcDeviceName(pr.device || '');
                                    setSecProcAnes(
                                      Boolean(pr.anesStart || pr.anesEnd || pr.anesDoctor)
                                    );
                                    setProcAnesStart(pr.anesStart || '');
                                    setProcAnesEnd(pr.anesEnd || '');
                                    setProcAnesDoctor(pr.anesDoctor || '');
                                    setCurrentProcCodes(pr.codes || []);
                                    setProcInvasive(Boolean(pr.invasive));
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-500 cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const snapshot = [...db.procedures];
                                    updateDB((prev) => ({
                                      ...prev,
                                      procedures: prev.procedures.filter(
                                        (item) => item.id !== pr.id
                                      ),
                                    }));
                                    showToast('پروسیجر حذف شد', () => {
                                      updateDB((prev) => ({
                                        ...prev,
                                        procedures: snapshot,
                                      }));
                                    });
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </SortableItem>
                        );
                      })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </section>
        )}

        {/* ==========================================
            TAB 4: TASKS (SUSPENDS & NOTES WITH DND-KIT REORDERING)
           ========================================== */}
        {activeTab === 'tasks' && (
          <section className="space-y-4">
            {/* Sub-navigation */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTaskSubTab('suspend')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTaskSubTab === 'suspend'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                ساسپند گرافی / سی‌تی ({toPersianNum(db.suspends.length)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTaskSubTab('notes')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTaskSubTab === 'notes'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                یادداشت‌ها و سفارش لوازم ({toPersianNum(db.notes.filter((n) => !n.done).length)})
              </button>
            </div>

            {activeTaskSubTab === 'suspend' ? (
              <div className="space-y-4">
                <form
                  onSubmit={saveSuspendItem}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    ثبت بیمار برای خارج کردن از ساسپند (پیامک همکار)
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        ۱. نام و نام خانوادگی بیمار
                      </label>
                      <input
                        type="text"
                        value={susName}
                        onChange={(e) => setSusName(e.target.value)}
                        placeholder="مثلاً: علی محمدی"
                        className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          ۲. تاریخ گرفتن عکس
                        </label>
                        <div className="flex gap-1">
                          {(
                            [
                              { offset: -1, label: 'دیروز' },
                              { offset: 0, label: 'امروز' },
                              { offset: -2, label: 'پریروز' },
                            ] as const
                          ).map((d) => (
                            <button
                              key={d.label}
                              type="button"
                              onClick={() =>
                                setSusDate(
                                  formatShortPersianDate(addDaysISO(getTodayISO(), d.offset))
                                )
                              }
                              className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold"
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={susDate}
                        onChange={(e) => setSusDate(e.target.value)}
                        className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      ۳. نوع گرافی / تصویربرداری
                    </label>
                    <input
                      type="text"
                      value={susXray}
                      onChange={(e) => setSusXray(e.target.value)}
                      placeholder="مثلاً: CXR، گرافی شکم، لگن..."
                      className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {sortedXrays.slice(0, 8).map((x) => (
                        <button
                          key={x.name}
                          type="button"
                          onClick={() =>
                            setSusXray((prev) =>
                              prev.trim() ? `${prev} + ${x.name}` : x.name
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                        >
                          + {x.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      ۴. شرح حال کوتاه بیمار
                    </label>
                    <input
                      type="text"
                      value={susHistory}
                      onChange={(e) => setSusHistory(e.target.value)}
                      placeholder="مثلاً: تروما، تصادف، سقوط، درد شکم..."
                      className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {editSuspendId ? 'ذخیره تغییرات ساسپند' : '+ افزودن به لیست ساسپند'}
                  </button>
                </form>

                {/* SMS Preview & Sortable Suspend Items */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      متن آماده پیامک (جابه‌جایی آیتم‌ها با Drag & Drop ترتیب پیامک را تغییر می‌دهد)
                    </h3>
                    <span className="text-xs font-bold text-sky-500 tabular-nums">
                      {toPersianNum(db.suspends.length)} مورد
                    </span>
                  </div>

                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {suspendSmsText}
                  </pre>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(suspendSmsText);
                        showToast('متن پیامک ساسپند کپی شد');
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی همه (خط‌به‌خط)</span>
                    </button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSuspendsDragEnd}
                  >
                    <SortableContext
                      items={db.suspends.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 pt-2">
                        {db.suspends.map((s) => (
                          <SortableItem
                            key={s.id}
                            id={s.id}
                            handleTitle="جابه‌جایی ترتیب ساسپند"
                          >
                            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatSuspendLine(s)}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditSuspendId(s.id);
                                    setSusName(s.name);
                                    setSusXray(s.xray);
                                    setSusDate(s.date);
                                    setSusHistory(s.history);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDB((prev) => ({
                                      ...prev,
                                      suspends: prev.suspends.filter((x) => x.id !== s.id),
                                    }))
                                  }
                                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            ) : (
              /* SUB-TAB 2: NOTES & TASK LIST WITH DND-KIT */
              <div className="space-y-4">
                <form
                  onSubmit={saveNoteItem}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    ثبت یادداشت، کار روزانه یا سفارش لوازم بخش
                  </h2>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'حسین امیرفخریان', label: 'حسین امیرفخریان', activeClass: 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500 shadow-xs' },
                      { id: 'دکتر دوانلو', label: 'دکتر دوانلو', activeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-xs' },
                      { id: 'سفارش لوازم', label: 'سفارش لوازم و کسری', activeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500 shadow-xs' },
                      { id: 'یادداشت عمومی', label: 'یادداشت عمومی', activeClass: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500 shadow-xs' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNoteCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          noteCategory === cat.id
                            ? cat.activeClass
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="مثلاً: سفارش ست نفروستومی سایز ۸ / موردی که باید به دکتر دوانلو بگویم..."
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                  />

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {editNoteId ? 'ذخیره تغییرات یادداشت' : '+ ذخیره در لیست کارها و یادداشت‌ها'}
                  </button>
                </form>

                {/* Filter & Sortable Task List */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                    { id: 'all', label: 'همه کارها و یادداشت‌ها' },
                    { id: 'حسین امیرفخریان', label: 'حسین امیرفخریان' },
                    { id: 'دکتر دوانلو', label: 'دکتر دوانلو' },
                    { id: 'سفارش لوازم', label: 'سفارش لوازم' },
                    { id: 'یادداشت عمومی', label: 'عمومی' },
                  ].map((f) => {
                    const isSelected = noteFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setNoteFilter(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleNotesDragEnd}
                >
                  <SortableContext
                    items={db.notes.map((n) => n.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {db.notes
                        .filter((n) => {
                          if (noteFilter === 'all') return true;
                          if (noteFilter === 'حسین امیرفخریان') {
                            return n.category === 'حسین امیرفخریان' || n.category === 'مسئول بخش';
                          }
                          return n.category === noteFilter;
                        })
                        .map((n) => {
                          const isAmirfakhrian = n.category === 'حسین امیرفخریان' || n.category === 'مسئول بخش';
                          const isDavanloo = n.category === 'دکتر دوانلو';
                          const isSupply = n.category === 'سفارش لوازم';

                          const categoryStyle = isAmirfakhrian
                            ? {
                                border: 'border-sky-500/30',
                                bg: 'bg-sky-500/5',
                                badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
                                label: 'حسین امیرفخریان',
                              }
                            : isDavanloo
                            ? {
                                border: 'border-emerald-500/30',
                                bg: 'bg-emerald-500/5',
                                badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                                label: 'دکتر دوانلو',
                              }
                            : isSupply
                            ? {
                                border: 'border-amber-500/30',
                                bg: 'bg-amber-500/5',
                                badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                                label: 'سفارش لوازم و کسری',
                              }
                            : {
                                border: 'border-indigo-500/30',
                                bg: 'bg-indigo-500/5',
                                badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
                                label: 'یادداشت عمومی',
                              };

                          return (
                          <SortableItem
                            key={n.id}
                            id={n.id}
                            disabled={noteFilter !== 'all'}
                            handleTitle="جابه‌جایی اولویت یادداشت"
                          >
                            <div
                              className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111827] border transition-all ${
                                categoryStyle.border
                              } ${n.done ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : categoryStyle.bg}`}
                            >
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDB((prev) => ({
                                      ...prev,
                                      notes: prev.notes.map((item) =>
                                        item.id === n.id
                                          ? { ...item, done: !item.done }
                                          : item
                                      ),
                                    }))
                                  }
                                  className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 cursor-pointer ${
                                    n.done
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-slate-400 dark:border-slate-600 hover:border-sky-500'
                                  }`}
                                >
                                  {n.done && <Check className="w-3.5 h-3.5" />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border ${categoryStyle.badge}`}>
                                      {categoryStyle.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 tabular-nums">
                                      {n.date}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-xs font-semibold mt-0.5 ${
                                      n.done
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                  >
                                    {n.text}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditNoteId(n.id);
                                    setNoteCategory(n.category);
                                    setNoteText(n.text);
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-sky-500"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDB((prev) => ({
                                      ...prev,
                                      notes: prev.notes.filter((item) => item.id !== n.id),
                                    }))
                                  }
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </SortableItem>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Bottom Floating Action Button (FAB) in Thumb Zone for Tabs 1 & 2 */}
      {(activeTab === 'wards' || activeTab === 'patients') && (
        <button
          type="button"
          onClick={() => {
            setEditingPatient(null);
            setModalDefaultWard(undefined);
            setIsPatientModalOpen(true);
          }}
          className="fixed bottom-16 md:bottom-6 left-4 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-sky-500/30 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.8]" />
          <span>ثبت بیمار / مشاوره</span>
        </button>
      )}

      {/* Mobile Bottom Navigation Bar (4 Tabs) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#090d16]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('wards')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors ${
            activeTab === 'wards'
              ? 'text-sky-500'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <PhoneCall className="w-4 h-4 mb-0.5" />
          <span>بخش‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('patients')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors ${
            activeTab === 'patients'
              ? 'text-sky-500'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>بیماران ({toPersianNum(dayPatients.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('procedures')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors ${
            activeTab === 'procedures'
              ? 'text-sky-500'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 mb-0.5" />
          <span>انجام‌شده ({toPersianNum(dayProcedures.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors ${
            activeTab === 'tasks'
              ? 'text-sky-500'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ListTodo className="w-4 h-4 mb-0.5" />
          <span>سایر کارها ({toPersianNum(openTasksCount)})</span>
        </button>
      </nav>

      {/* Toast Notification with Undo Support */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xl">
          <span>{toast.message}</span>
          {toast.undoAction && (
            <button
              type="button"
              onClick={() => {
                toast.undoAction?.();
                setToast(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500 text-white text-[11px] font-extrabold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>بازگردانی (Undo)</span>
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        db={db}
        currentDateStr={currentDateStr}
        editPatient={editingPatient}
        defaultWard={modalDefaultWard}
        onSave={handleSavePatient}
        onDeleteSmartTag={handleDeleteSmartTag}
        onAddInsuranceToList={(insType, name) => {
          updateDB((prev) => {
            if (insType === 'base') {
              return {
                ...prev,
                baseInsurances: prev.baseInsurances.includes(name)
                  ? prev.baseInsurances
                  : [...prev.baseInsurances, name],
                baseInsuranceCounts: {
                  ...prev.baseInsuranceCounts,
                  [name]: (prev.baseInsuranceCounts[name] || 0) + 1,
                },
              };
            }
            return {
              ...prev,
              suppInsurances: prev.suppInsurances.includes(name)
                ? prev.suppInsurances
                : [...prev.suppInsurances, name],
              suppInsuranceCounts: {
                ...prev.suppInsuranceCounts,
                [name]: (prev.suppInsuranceCounts[name] || 0) + 1,
              },
            };
          });
          showToast(`«${name}» به فهرست بیمه اضافه شد`);
        }}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        db={db}
        currentDateStr={currentDateStr}
        onToast={(msg) => showToast(msg)}
        onMarkAllInformed={() => {
          updateDB((prev) => ({
            ...prev,
            patients: prev.patients.map((p) =>
              p.date === currentDateStr && p.status === 'pending'
                ? { ...p, status: 'informed' }
                : p
            ),
          }));
          showToast('همه بیماران امروز به حالت «اطلاع داده شد» تغییر یافتند');
        }}
      />

      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        db={db}
        currentDateStr={currentDateStr}
        onJumpToDate={(iso) => {
          setCurrentDateStr(iso);
          setActiveTab('patients');
        }}
      />

      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        db={db}
        currentDateStr={currentDateStr}
        onSelectDate={(iso) => setCurrentDateStr(iso)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        cloudConfig={cloudConfig}
        cloudStatus={cloudStatusText}
        onSaveCloudConfig={(cfg) => {
          setCloudConfig(cfg);
          localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
        }}
        onSyncToCloud={handleSyncToCloudNow}
        onPullFromCloud={handlePullFromCloudNow}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
}
