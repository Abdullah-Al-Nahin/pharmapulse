import i18n from '../i18n/config';

// Bangla numeral mapping: 0-9 to ০-৯
const BANGLA_DIGITS: { [key: string]: string } = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

const ENGLISH_DIGITS: { [key: string]: string } = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Convert any string or number to Bangla numerals (০-৯)
 */
export function toBanglaDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/[0-9]/g, (digit) => BANGLA_DIGITS[digit] || digit);
}

/**
 * Convert Bangla numerals back to English digits (0-9)
 */
export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => ENGLISH_DIGITS[digit] || digit);
}

type LocaleListener = (locale: 'en' | 'bn') => void;
const localeListeners: LocaleListener[] = [];

export function subscribeLocale(listener: LocaleListener): () => void {
  localeListeners.push(listener);
  return () => {
    const idx = localeListeners.indexOf(listener);
    if (idx !== -1) localeListeners.splice(idx, 1);
  };
}

/**
 * Get current active locale ('en' | 'bn')
 */
export function getCurrentLocale(): 'en' | 'bn' {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('rx_locale_preference') : null;
  const lng = saved || i18n.language || 'en';
  return lng.toLowerCase().startsWith('bn') ? 'bn' : 'en';
}

/**
 * Set active locale and persist to localStorage
 */
export function setLocale(locale: 'en' | 'bn'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rx_locale_preference', locale);
    document.documentElement.lang = locale;
  }
  i18n.changeLanguage(locale);
  queueMicrotask(() => {
    localeListeners.forEach((l) => {
      try {
        l(locale);
      } catch {}
    });
  });
}

/**
 * Format currency with appropriate symbol (৳ for Bangla, $ / BDT for English)
 * and localized numeral representation
 */
export function formatCurrency(
  amount: number | string | null | undefined, 
  customLocale?: 'en' | 'bn',
  options?: { showCurrencyCode?: boolean; forceEnglishNumeral?: boolean }
): string {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || 0)) || 0;
  const locale = customLocale || getCurrentLocale();

  // Format base number with commas and 2 decimals
  const formattedEnNumber = numericAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (locale === 'bn' && !options?.forceEnglishNumeral) {
    const banglaNumber = toBanglaDigits(formattedEnNumber);
    return options?.showCurrencyCode ? `BDT ${banglaNumber}` : `৳${banglaNumber}`;
  }

  return options?.showCurrencyCode ? `BDT ${formattedEnNumber}` : `৳${formattedEnNumber}`;
}

/**
 * Format general numbers with thousands separator and localized digits
 */
export function formatNumber(
  num: number | string | null | undefined,
  customLocale?: 'en' | 'bn',
  decimals: number = 0
): string {
  const numericVal = typeof num === 'number' ? num : parseFloat(String(num || 0)) || 0;
  const locale = customLocale || getCurrentLocale();

  const formattedEn = numericVal.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (locale === 'bn') {
    return toBanglaDigits(formattedEn);
  }

  return formattedEn;
}

/**
 * Format date string (YYYY-MM-DD or ISO) into localized format
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  customLocale?: 'en' | 'bn',
  includeTime: boolean = false
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const locale = customLocale || getCurrentLocale();

  if (locale === 'bn') {
    const day = toBanglaDigits(date.getDate().toString().padStart(2, '0'));
    const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const month = monthNamesBn[date.getMonth()];
    const year = toBanglaDigits(date.getFullYear().toString());

    if (includeTime) {
      const hours = toBanglaDigits(date.getHours().toString().padStart(2, '0'));
      const minutes = toBanglaDigits(date.getMinutes().toString().padStart(2, '0'));
      return `${day} ${month}, ${year} ${hours}:${minutes}`;
    }

    return `${day} ${month}, ${year}`;
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };

  return date.toLocaleDateString('en-US', options);
}

/**
 * Localized POS Invoice Helper Functions
 */

export interface LocalizedInvoiceLabels {
  invoiceTitle: string;
  invoiceNo: string;
  date: string;
  time: string;
  customer: string;
  phone: string;
  pharmacist: string;
  doctor: string;
  item: string;
  batch: string;
  exp: string;
  qty: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  discount: string;
  vatTax: string;
  netPayable: string;
  paid: string;
  changeDue: string;
  dueBalance: string;
  paymentMethod: string;
  complianceNotice: string;
  footerThankYou: string;
}

export function getLocalizedInvoiceLabels(customLocale?: 'en' | 'bn'): LocalizedInvoiceLabels {
  const locale = customLocale || getCurrentLocale();

  if (locale === 'bn') {
    return {
      invoiceTitle: 'বিক্রয় চালান / ইনভয়েস',
      invoiceNo: 'চালান নং',
      date: 'তারিখ',
      time: 'সময়',
      customer: 'গ্রাহক',
      phone: 'ফোন',
      pharmacist: 'ফার্মাসিস্ট',
      doctor: 'চিকিৎসক',
      item: 'ওষুধ / পণ্য',
      batch: 'ব্যাচ',
      exp: 'মেয়াদ',
      qty: 'পরিমাণ',
      unitPrice: 'দর',
      total: 'মোট',
      subtotal: 'উপমোট',
      discount: 'বিশেষ ছাড়',
      vatTax: 'ভ্যাট (অন্তর্ভুক্ত)',
      netPayable: 'মোট প্রদেয়',
      paid: 'পরিশোধিত',
      changeDue: 'ফেরত টাকা',
      dueBalance: 'বকেয়া পাওনা',
      paymentMethod: 'পরিশোধের মাধ্যম',
      complianceNotice: 'ডিজিডিএ বিধিমালা অনুযায়ী বিক্রি কৃত অ্যান্টিবায়োটিক ও জীবন রক্ষাকারী ওষুধ প্রেসক্রিপশন ছাড়া ফেরতযোগ্য নয়।',
      footerThankYou: 'মদিনা ফার্মাসিউটিক্যালস সেবা গ্রহণের জন্য ধন্যবাদ। আপনার সুস্থতা আমাদের কাম্য।',
    };
  }

  return {
    invoiceTitle: 'TAX INVOICE / CASH MEMO',
    invoiceNo: 'Invoice #',
    date: 'Date',
    time: 'Time',
    customer: 'Customer',
    phone: 'Phone',
    pharmacist: 'Pharmacist',
    doctor: 'Doctor',
    item: 'Item / Medicine',
    batch: 'Batch',
    exp: 'Exp',
    qty: 'Qty',
    unitPrice: 'Price',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    vatTax: 'VAT / Tax (Incl)',
    netPayable: 'NET PAYABLE',
    paid: 'Paid Amount',
    changeDue: 'Change Returned',
    dueBalance: 'Due Balance',
    paymentMethod: 'Payment Mode',
    complianceNotice: 'As per DGDA pharmacy regulations, dispensed Schedule H & antibiotic medicines are strictly non-returnable once leaving premises.',
    footerThankYou: 'Thank you for choosing Madina Pharmaceuticals & Eye Hospital Dispensary. Get well soon!',
  };
}

export function getLocalizedPaymentMethodLabel(method: string, customLocale?: 'en' | 'bn'): string {
  const locale = customLocale || getCurrentLocale();

  if (locale === 'bn') {
    switch (method) {
      case 'bkash_nagad':
      case 'upi_mobile':
        return 'বিকাশ / নগদ মোবাইল ব্যাংকিং';
      case 'card':
        return 'ক্রেডিট / ডেবিট কার্ড';
      case 'split':
        return 'মিশ্র বহু-পরিশোধ (স্প্লিট)';
      case 'due':
        return 'বকেয়া / অন অ্যাকাউন্ট';
      case 'cash':
      default:
        return 'নগদ টাকা (ক্যাশ)';
    }
  }

  switch (method) {
    case 'bkash_nagad':
    case 'upi_mobile':
      return 'bKash / Nagad Mobile Banking';
    case 'card':
      return 'Credit / Debit Card';
    case 'split':
      return 'Split Multi-Tender';
    case 'due':
      return 'Due / On Account';
    case 'cash':
    default:
      return 'Cash on Counter';
  }
}

export function getLocalizedCopyTypeLabel(copyType: string, customLocale?: 'en' | 'bn'): string {
  const locale = customLocale || getCurrentLocale();

  if (locale === 'bn') {
    switch (copyType) {
      case 'store':
        return 'দ্বিতীয় কপি (দোকান / নিরীক্ষা কপি)';
      case 'accounts':
        return 'তৃতীয় কপি (হিসাব বিভাগ কপি)';
      case 'customer':
      default:
        return 'মূল কপি (গ্রাহক কপি)';
    }
  }

  switch (copyType) {
    case 'store':
      return 'DUPLICATE (STORE / AUDIT COPY)';
    case 'accounts':
      return 'TRIPLICATE (ACCOUNTS COPY)';
    case 'customer':
    default:
      return 'ORIGINAL (CUSTOMER COPY)';
  }
}
