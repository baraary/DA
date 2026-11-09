export type ServiceType = 'consult' | 'own';
export type PatientStatus = 'pending' | 'informed' | 'done';
export type PaymentStatus = 'none' | 'paid' | 'unpaid' | 'partial';

export interface PatientRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  ward: string;
  name: string;
  serviceType: ServiceType;
  doctor: string;
  baseInsurance: string;
  suppInsurance: string;
  problem: string;
  request: string;
  labStatus: string;
  labNote: string;
  imaging: string[];
  location: string;
  paymentStatus: PaymentStatus;
  consumableNote: string;
  notes: string;
  status: PatientStatus;
  carriedFrom?: string; // Optional date string when carried over from an earlier day
  order?: number; // Custom drag-and-drop order
}

export interface ProcedureRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  linkedPatientId: string;
  name: string;
  baseInsurance: string;
  suppInsurance: string;
  device: string;
  anesStart: string;
  anesEnd: string;
  anesDoctor: string;
  codes: string[];
  invasive: boolean;
  order?: number;
}

export interface SuspendRecord {
  id: string;
  name: string;
  xray: string;
  date: string; // Formatted Persian date e.g. ۱۴۰۵/۰۸/۱۷
  history: string;
  createdAt: string;
  order?: number;
}

export interface NoteRecord {
  id: string;
  category: 'حسین امیرفخریان' | 'دکتر دوانلو' | 'سفارش لوازم' | 'یادداشت عمومی' | string;
  text: string;
  done: boolean;
  date: string;
  order?: number;
}

export interface DatabaseSchema {
  patients: PatientRecord[];
  wardChecks: Record<string, Record<string, 'empty' | string>>;
  primaryWardsOrder?: string[];
  secondaryWardsOrder?: string[];
  doctors: string[];
  doctorCounts: Record<string, number>;
  problems: string[];
  problemCounts: Record<string, number>;
  requests: string[];
  requestCounts: Record<string, number>;
  xrayTypes: string[];
  xrayCounts: Record<string, number>;
  baseInsurances: string[];
  baseInsuranceCounts: Record<string, number>;
  suppInsurances: string[];
  suppInsuranceCounts: Record<string, number>;
  procCodes: string[];
  procCodeCounts: Record<string, number>;
  suspends: SuspendRecord[];
  notes: NoteRecord[];
  procedures: ProcedureRecord[];
  procedurePresets?: ProcedurePreset[];
  theme: 'dark' | 'light';
  lastUpdated?: number;
}

export interface CloudConfig {
  token: string;
  gistId: string;
}

export interface ProcedurePreset {
  id: string;
  label: string;
  codes: string[];
  device: string;
  invasive: boolean;
}

export const DEFAULT_PRIMARY_WARDS: string[] = [
  'بخش ۱',
  'بخش ۲',
  'بخش ۳',
  'بخش ۴',
  'آی‌سی‌یو (ICU)',
  'سی‌سی‌یو (CCU)',
  'پست سی‌سی‌یو',
  'پست سی‌سی‌یو ستاره‌دار',
  'اورژانس',
];

export const DEFAULT_SECONDARY_WARDS: string[] = [
  'بخش ۵',
  'نوزادان',
  'زایشگاه',
  'اطفال',
  'آی‌سی‌یو قلب',
  'درمانگاه',
  'مطب / سرپایی',
];

export const DEFAULT_PROBLEMS: string[] = [
  'هیدرونفروز',
  'پلورال افیوژن',
  'کالکشن / آبسه',
  'آسیت',
  'توده کبدی',
  'کلیه پیوندی',
  'پنوموتوراکس',
];

export const DEFAULT_REQUESTS: string[] = [
  'مشاوره و تعیین تکلیف',
  'سونوگرافی',
  'نفروستومی',
  'بیوپسی',
  'درناژ / تعبیه کاتتر',
  'تپ مایع',
  'شالدون / پرمیکت',
  'کشیدن/اصلاح درن',
];

export const DEFAULT_XRAYS: string[] = [
  'CXR',
  'گرافی شکم',
  'گرافی لگن',
  'گرافی ستون فقرات',
  'گرافی زانو',
  'گرافی شانه',
  'گرافی مچ دست',
  'گرافی مچ پا',
];

export const PROCEDURE_PRESETS: ProcedurePreset[] = [
  {
    id: 'nephrostomy',
    label: 'نفروستومی (PCN)',
    codes: ['نفروستومی زیر راهنمای سونوگرافی', 'سونوگرافی راهنمای مداخله‌ای'],
    device: 'ست نفروستومی و نیدل شیبا',
    invasive: true,
  },
  {
    id: 'permcath',
    label: 'تعبیه پرمیکت / شالدون',
    codes: ['تعبیه کاتتر دیالیز دائمی (پرمیکت)', 'سونوگرافی عروق جهت کاتترگذاری'],
    device: 'پرمیکت / شالدون',
    invasive: true,
  },
  {
    id: 'biopsy',
    label: 'بیوپسی زیر گاید سونو',
    codes: ['بیوپسی سوزنی عمقی (Core Biopsy)', 'سونوگرافی راهنمای بیوپسی'],
    device: 'سوزن بیوپسی اتوماتیک',
    invasive: true,
  },
  {
    id: 'drainage',
    label: 'درناژ کالکشن / پیگ‌تیل',
    codes: ['درناژ پرکوتانئوس آبسه یا کالکشن', 'سونوگرافی راهنمای درناژ'],
    device: 'کاتتر درناژ / پیگ‌تیل',
    invasive: true,
  },
  {
    id: 'pleural_tap',
    label: 'تپ پلور / آسیت',
    codes: ['توراکوسنتز / پاراسنتز زیر گاید سونوگرافی'],
    device: '',
    invasive: false,
  },
];

export const STORAGE_KEY = 'davanloo_assistant_db_v1';
export const CLOUD_CFG_KEY = 'davanloo_cloud_cfg_v1';
