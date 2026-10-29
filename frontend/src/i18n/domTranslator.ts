import { getCurrentLocale, subscribeLocale, toBanglaDigits, toEnglishDigits } from '../utils/i18nFormatter';

/**
 * Hardcoded Bangla -> Pure English dictionary for cleaning up any residual Bangla when EN mode is active
 */
const BN_TO_EN_PHRASES: Record<string, string> = {
  'ইউজারনেম প্রবেশ করান (Please enter your Username / Employee ID)': 'Please enter your Username / Employee ID',
  'পাসওয়ার্ড প্রবেশ করান (Please enter your password)': 'Please enter your password',
  'ভুল ইউজারনেম বা পাসওয়ার্ড (Invalid credentials)': 'Invalid username or password',
  'ইউজারনেম (USERNAME)': 'USERNAME',
  'পাসওয়ার্ড (PASSWORD)': 'PASSWORD',
  'লগইন করুন (LOGIN)': 'LOGIN',
  '(মালিকানা ও আর্থিক নিয়ন্ত্রণ কেন্দ্র)': '(Ownership & Financial Control Center)',
  '২°-৮° সে.': '2°C–8°C',
  '২°-৮° সে. (Cold Chain)': '2°C–8°C (Cold Chain)',
  'খোলার পর ২৮ দিন': '28 Days After Opening',
  'খোলার পর ২৮ দিন মেয়াদ': 'Expires 28 Days After Opening',
  'মাত্রা:': 'Dosage:',
  'বিকল্প': 'Substitute',
  'বিকল্প বিকল্পসমূহ': 'Available Substitutes',
  'কাস্টমারকে ফেরত দিন': 'Return to Customer',
  'নোট ফেরত নির্দেশিকা (Currency Notes):': 'Currency Notes Breakdown:',
  'বাংলা থার্মাল রসিদ (Bengali Thermal Receipt)': 'Thermal Receipt Language',
  'ওষুধের বিবরণ ও ভাউচার বাংলায় প্রিন্ট হবে': 'Print medicine details & receipt in selected language',
  'বাংলা ON': 'BN Mode',
  'EN Only': 'EN Mode',
  'ADMIN প্যানেল ব্যাতিত অন্য কেউ বাকিতে বিল করতে পারবে না।': 'Only Admin accounts are authorized to process credit/due bills.',
  'ক্যাশিয়ার বা স্টাফ একাউন্ট থেকে বাকিতে বিল করা নিষিদ্ধ। বাকিতে বিল সম্পন্ন করতে অ্যাডমিন পিন (PIN: 9999) দিন অথবা অ্যাডমিন রোলে লগইন করুন।':
    'Cashier/staff accounts cannot issue credit bills without authorization. Enter Admin PIN (9999) or log in as Admin.',
  'ভুল অ্যাডমিন পিন! শুধুমাত্র অ্যাডমিন প্যানেল বাকিতে বিল অনুমোদন করতে পারে।':
    'Invalid Admin PIN! Only Admin can authorize credit billing.',
  'অ্যাডমিন অনুমোদিত: বাকিতে বিল সক্রিয়': 'Admin Authorized: Credit Billing Active',
  'মাসভিত্তিক ক্রয়মূল্য ও পাইকারি রেট পরিবর্তন ট্র্যাকিং': 'Monthly purchase price and wholesale rate fluctuation tracking',
  'ওষুধ খুঁজুন...': 'Search medicine...',
  'বারকোড স্ক্যান করলেই Brand, Generic, Strength, Batch, Expiry, Stock ও Selling Price স্বয়ংক্রিয়ভাবে চিহ্নিত হবে':
    'Scan barcode to automatically identify Brand, Generic, Strength, Batch, Expiry, Stock & Selling Price',
  'বারকোড স্ক্যান করুন অথবা লিখুন (যেমন: 8941100223019)...': 'Scan or enter barcode (e.g. 8941100223019)...',
  'ইনভেন্টরি বারকোড:': 'Inventory Barcodes:',
  'সিস্টেমে এই বারকোডটি নিবন্ধিত নেই। অনুগ্রহ করে ডিজিডিএ রেজিস্ট্রি থেকে ম্যানুয়াল এন্ট্রি করুন।':
    'This barcode is not registered in the system. Please enter manually from the DGDA registry.',
  'সিস্টেম বিকল্প ওষুধ খুঁজে দিতে প্রস্তুত (ফার্মাসিস্ট নিশ্চিতকরণ প্রযোজ্য)':
    'System ready to suggest therapeutic substitutes (Pharmacist confirmation required)',
  'বিকল্প ব্র্যান্ড প্রয়োজন': 'Substitute Brand Required',
  'মূল ওষুধ স্টকে নেই (Out of Stock) — সমমানের থেরাপিউটিক বায়োইকুইভ্যালেন্স':
    'Primary medicine out of stock — Bioequivalent therapeutic substitute',
  'রোগী অধিক সাশ্রয়ী বিকল্প ওষুধ গ্রহণের অনুরোধ করেছেন': 'Patient requested a more cost-effective generic alternative',
  'প্রেসক্রিপশনকারী চিকিৎসকের সাথে ফোনে কথা বলে বিকল্প অনুমোদন নেওয়া হয়েছে':
    'Substitute approved via phone consultation with prescribing doctor',
  'আমি নিশ্চিত করছি যে প্রস্তাবিত বিকল্পটি একই সক্রিয় উপাদান (Active Molecule) ও স্ট্রেন্থ বহন করে এবং ডিজিডিএ ও ফার্মেসি কাউন্সিলের আইন অনুযায়ী রোগীর সাথে আলোচনা করে প্রতিস্থাপন করা হচ্ছে।':
    'I confirm that the proposed substitute contains the identical active molecule and strength, and is being dispensed with patient consent in accordance with DGDA regulations.',
  'কার্টে অ্যান্টিবায়োটিক বা নিয়ন্ত্রিত ড্রাগ অন্তর্ভুক্ত রয়েছে':
    'Cart contains antibiotics or controlled prescription drugs',
  'কোন কোম্পানির কত টাকার ওষুধ স্টকে রয়েছে এবং কোন প্রোডাক্ট কত পিস মজুদ আছে তা এক নজরে পর্যবেক্ষণ করুন।':
    'Monitor stock valuation by pharmaceutical manufacturer and unit quantities per product at a glance.',
  'মূল্য ক্রয়মূল্য বা ট্রেড প্রাইস (TP)': 'Valuation at Trade Price (TP)',
  'কোন কোম্পানির তথ্য খুঁজে পাওয়া যায়নি': 'No manufacturer records found',
  'অনুসন্ধান ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন অথবা ইনভেন্টরিতে নতুন ওষুধ যোগ করুন।':
    'Adjust your search filter and try again, or add new medicines to inventory.',
  '(ব্যাচ অনুযায়ী মজুদ ও মূল্য তালিকা)': '(Batch-wise Stock & Price Schedule)',
  'সরাসরি এক্সেল ফাইলের মতো গ্রিড শিটে ওষুধ, নতুন ব্যাচ, মেয়াদ ও পরিমাণ টাইপ অথবা কপি-পেস্ট করে ১-ক্লিকে ইনভেন্টরি ও FEFO স্টক আপডেট করুন।':
    'Type or copy-paste medicines, batches, expiry dates, and quantities into the spreadsheet grid to update inventory and FEFO stock in one click.',
  '✓ চালান সফলভাবে রিসিভ এবং স্টক আপডেট সম্পন্ন হয়েছে!': '✓ Chalan received and inventory stock updated successfully!',
  'ইনভেন্টরি দেখুন': 'View Inventory',
  'পরবর্তী চালান এন্ট্রি': 'Next Chalan Entry',
  'কোম্পানি / সাপ্লায়ার ডিপো *': 'Manufacturer / Supplier Depot *',
  'চালান / ইনভয়েস নম্বর *': 'Chalan / Invoice Number *',
  'চালানের তারিখ *': 'Chalan Date *',
  'রিসিভিং ওয়্যারহাউস': 'Receiving Warehouse',
  'পেমেন্ট টাইপ': 'Payment Type',
  '(Excel এর মতো প্রতিটি ঘরে সরাসরি টাইপ করুন)': '(Type directly into each cell like Excel)',
  'মন্তব্য / নোট (ঐচ্ছিক: ড্রয়ার নম্বর, চালানের বিশেষ দ্রষ্টব্য ইত্যাদি)...':
    'Notes / Remarks (Optional: Rack/Drawer number, delivery notes, etc.)...',
  'মোট পরিশোধযোগ্য:': 'Total Payable:',
  'কলামের ক্রম (Excel Column Order):': 'Excel Column Order:',
  '* এক্সেল ফাইল থেকে রো সিলেক্ট করে কপি (Ctrl+C) করে নিচের বক্সে পেস্ট (Ctrl+V) করুন।':
    '* Select rows in Excel, copy (Ctrl+C), and paste (Ctrl+V) into the box below.',
  '💡 ইউএসবি বারকোড স্ক্যানার দিয়ে ড্রাগ বক্সের বারকোড সরাসরি স্ক্যান করতে পারেন অথবা অটো-জেনারেট বাটনে ক্লিক করুন।':
    '💡 Scan the medicine box barcode directly with a USB scanner or click Auto-Generate.',
  '১টি ক্যাপসুল প্রতিদিন সকালে খাবার ৩০ মিনিট আগে': '1 capsule daily in the morning 30 minutes before meals',
};

/**
 * Comprehensive English -> Bangla phrase dictionary covering all modules, buttons, headers, KPIs, tables, and statuses
 */
const EN_TO_BN_PHRASES: Record<string, string> = {
  // Brand & Global Shell
  'pharmaPulse': 'ফার্মাপালস',
  'pharmapulse': 'ফার্মাপালস',
  'hospital & retail os': 'হাসপাতাল ও রিটেইল ওএস',
  'central dispensary': 'কেন্দ্রীয় ডিসপেন্সারি',
  'central hub': 'কেন্দ্রীয় হাব',
  'search medicine, generic, barcode (f2)...': 'ওষুধ, জেনেরিক বা বারকোড খুঁজুন (F2)...',
  'drawer cash:': 'ক্যাশ ড্রয়ার:',
  'scanner': 'স্ক্যানার',
  'alerts': 'সতর্কতা',
  'hotkeys': 'শর্টকাট',
  'online': 'অনলাইন',
  'offline': 'অফলাইন',
  'expiring soon': 'মেয়াদ শেষের পথে',
  'sign out / lock terminal': 'লগ আউট / টার্মিনাল লক',
  'administrator': 'অ্যাডমিনিস্ট্রেটর',
  'super admin': 'সুপার অ্যাডমিন',
  'pharmacy manager': 'ফার্মেসি ম্যানেজার',
  'senior pharmacist': 'সিনিয়র ফার্মাসিস্ট',
  'counter cashier': 'কাউন্টার ক্যাশিয়ার',
  'inventory auditor': 'ইনভেন্টরি অডিটর',
  'store manager': 'স্টোর ম্যানেজার',
  'pharmacist': 'ফার্মাসিস্ট',
  'cashier': 'ক্যাশিয়ার',

  // Sidebar Navigation
  'sales & pos': 'বিক্রয় ও কাউন্টার',
  'pos billing': 'ক্যাশ কাউন্টার',
  'prescription hub': 'প্রেসক্রিপশন হাব',
  'returns & refunds': 'রিটার্ন ও রিফান্ড',
  'customers & dues': 'কাস্টমার ও বাকি',
  'inventory & supply': 'স্টক ও সাপ্লাই',
  'inventory & fefo': 'ইনভেন্টরি ও ফেফো',
  'suppliers & purchase': 'সাপ্লায়ার ও ক্রয়',
  'batches & expiry': 'ব্যাচ ও মেয়াদ',
  'audit logs & trail': 'অডিট ও ট্রেইল',
  'management & finance': 'ম্যানেজমেন্ট ও হিসাব',
  'executive dashboard': 'সিইও ড্যাশবোর্ড',
  'command center': 'কমান্ড সেন্টার',
  'accounts & ledger': 'হিসাব ও লেজার',
  'multi-branch (ibt)': 'মাল্টি-ব্রাঞ্চ',
  'analytics & ai': 'অ্যানালিটিক্স ও এআই',
  'settings & roles': 'সেটিংস ও রোল',
  'live': 'লাইভ',
  'vip': 'ভিআইপি',
  'ai': 'এআই',

  // Login Page
  'username': 'ইউজারনেম',
  'password': 'পাসওয়ার্ড',
  'login': 'লগইন করুন',
  'sign in': 'লগইন করুন',
  'enterprise healthcare & regulatory system': 'উন্নত স্বাস্থ্যসেবা ও ওষুধ নিয়ন্ত্রক ব্যবস্থাপনা',
  'a quantum project': 'একটি কোয়ান্টাম প্রজেক্ট',

  // POS Ribbon & Cart
  'quick search': 'দ্রুত অনুসন্ধান',
  'smart barcode': 'স্মার্ট বারকোড',
  'price history': 'মূল্য ইতিহাস',
  'prescribing doctor': 'প্রেসক্রিপশনকারী চিকিৎসক',
  'complete ↵': 'সম্পন্ন করুন ↵',
  'complete': 'সম্পন্ন করুন',
  'clear': 'মুছুন',
  'cold chain monitor active': 'কোল্ড চেইন মনিটর সক্রিয়',
  'scanner ready': 'স্ক্যানার প্রস্তুত',
  'scan barcode or search by brand, generic, symptom (f2)...': 'বারকোড স্ক্যান করুন অথবা ব্র্যান্ড, জেনেরিক বা লক্ষণ দিয়ে খুঁজুন (F2)...',
  'fast add:': 'দ্রুত যোগ:',
  'active prescription cart': 'সক্রিয় প্রেসক্রিপশন কার্ট',
  'active billing cart': 'সক্রিয় বিলিং কার্ট',
  'clear cart': 'কার্ট খালি করুন',
  'medicine / generic': 'ওষুধ / জেনেরিক',
  'batch & expiry': 'ব্যাচ ও মেয়াদ',
  'unit price': 'একক মূল্য',
  'qty': 'পরিমাণ',
  'disc %': 'ছাড় %',
  'disc': 'ছাড়',
  'line total': 'মোট মূল্য',
  'total': 'মোট',
  'action': 'পদক্ষেপ',
  'actions': 'পদক্ষেপ',
  'cart is empty': 'কার্ট খালি রয়েছে',
  'scan a medicine barcode or search above to begin billing': 'বিলিং শুরু করতে ওষুধের বারকোড স্ক্যান করুন অথবা উপরে অনুসন্ধান করুন',
  'rx required': 'প্রেসক্রিপশন আবশ্যক',
  'cold chain': 'কোল্ড চেইন',
  '2°c–8°c': '২°–৮° সে.',
  '28 days after opening': 'খোলার পর ২৮ দিন',
  'dosage:': 'মাত্রা:',
  'substitute': 'বিকল্প',
  'generic alternatives': 'সমমানের জেনেরিক বিকল্প',
  'bioequivalent brands': 'সমমানের ব্র্যান্ডসমূহ',
  'switch': 'পরিবর্তন',
  'current': 'বর্তমান',
  'in stock': 'স্টকে আছে',
  'out of stock': 'স্টক নেই',
  'low stock': 'স্বল্প স্টক',
  'cart profit economics': 'কার্ট লাভ বিশ্লেষণ',
  'est. cost': 'আনুমানিক ব্যয়',
  'est. profit': 'আনুমানিক লাভ',
  'margin': 'মার্জিন',
  'hide profit': 'লাভ লুকান',
  'show profit': 'লাভ দেখুন',

  // POS Checkout & Billing
  'checkout & billing': 'চেকআউট ও বিলিং',
  'customer lookup (phone / loyalty)': 'গ্রাহক অনুসন্ধান (ফোন / লয়্যালটি)',
  'enter customer mobile (e.g. 017...)': 'গ্রাহকের মোবাইল নম্বর দিন (যেমন: ০১৭...)',
  'walk-in customer': 'সাধারণ গ্রাহক',
  'subtotal': 'উপমোট',
  'loyalty points redeem': 'লয়্যালটি পয়েন্ট ছাড়',
  'special discount': 'বিশেষ ছাড়',
  'govt vat / tax': 'সরকারি ভ্যাট / কর',
  'round off': 'রাউন্ড অফ',
  'net payable': 'নিট প্রদেয়',
  'payment method': 'পরিশোধের মাধ্যম',
  'cash': 'নগদ ক্যাশ',
  'card': 'কার্ড',
  'card / pos': 'কার্ড / পিওএস',
  'bkash / nagad': 'বিকাশ / নগদ',
  'mfs (bkash/nagad)': 'মোবাইল ব্যাংকিং (বিকাশ/নগদ)',
  'due / credit': 'বাকি / ক্রেডিট',
  'due': 'বাকি',
  'cash tendered': 'গৃহীত নগদ',
  'cash tendered:': 'গৃহীত নগদ:',
  'change due': 'ফেরতযোগ্য টাকা',
  'return to customer': 'গ্রাহককে ফেরত দিন',
  'currency notes breakdown:': 'নোট ফেরত নির্দেশিকা:',
  'complete dispense (f10)': 'বিক্রয় সম্পন্ন করুন (F10)',
  'process dispense (f10)': 'বিক্রয় সম্পন্ন করুন (F10)',
  'hold order (f8)': 'অর্ডার হোল্ড করুন (F8)',
  'thermal receipt': 'থার্মাল রসিদ',
  'print thermal': 'রসিদ প্রিন্ট',
  'fefo priority queue': 'ফেফো অগ্রাধিকার তালিকা',
  'earliest expiring batches to dispense first': 'আগে মেয়াদ শেষ হওয়া ব্যাচগুলো আগে বিক্রি করুন',
  'urgent': 'জরুরি',
  'priority': 'অগ্রাধিকার',
  'warning': 'সতর্কতা',
  'add to cart': 'কার্টে যোগ করুন',
  'dispensing velocity': 'বিক্রয় গতিবেগ',
  'top moving medicine': 'সর্বাধিক বিক্রিত ওষুধ',
  'units sold': 'বিক্রিত ইউনিট',
  'catalog active': 'ক্যাটালগ সক্রিয়',
  'all items monitored': 'সকল পণ্য পর্যবেক্ষণাধীন',
  'baseline': 'স্বাভাবিক',
  'restock needed': 'পুনরায় স্টক প্রয়োজন',
  'held orders': 'হোল্ড করা অর্ডারসমূহ',
  'no held orders in queue': 'কোনো হোল্ড করা অর্ডার নেই',
  'restore cart': 'কার্টে ফিরিয়ে আনুন',
  'close': 'বন্ধ করুন',

  // KPI Row & Dashboard
  "today's sales": 'আজকের বিক্রয়',
  'gross profit': 'মোট লাভ',
  'net profit': 'নিট লাভ',
  'near expiry': 'মেয়াদ শেষের পথে',
  'low stock alert': 'স্বল্প স্টক সতর্কতা',
  'low stock items': 'স্বল্প স্টক পণ্য',
  'customer dues': 'গ্রাহকের বকেয়া',
  'supplier payables': 'সাপ্লায়ার পাওনা',
  'inventory healthy': 'ইনভেন্টরি স্বাভাবিক',
  'invoices': 'চালানসমূহ',
  'today': 'আজ',
  'yesterday': 'গতকাল',
  'this week': 'এই সপ্তাহ',
  'this month': 'এই মাস',
  'ytd': 'বার্ষিক',
  'all branches': 'সকল শাখা',
  'export pdf': 'পিডিএফ ডাউনলোড',
  'refresh': 'রিফ্রেশ',

  // Common Table Headers & Actions across Views
  'search': 'অনুসন্ধান',
  'filter': 'ফিল্টার',
  'status': 'অবস্থা',
  'date': 'তারিখ',
  'time': 'সময়',
  'customer': 'গ্রাহক',
  'customer name': 'গ্রাহকের নাম',
  'phone': 'ফোন নম্বর',
  'doctor': 'চিকিৎসক',
  'medicine': 'ওষুধ',
  'medicine name': 'ওষুধের নাম',
  'generic': 'জেনেরিক',
  'generic name': 'জেনেরিক নাম',
  'brand': 'ব্র্যান্ড',
  'brand name': 'ব্র্যান্ড নাম',
  'company': 'কোম্পানি',
  'manufacturer': 'প্রস্তুতকারক কোম্পানি',
  'category': 'ক্যাটাগরি',
  'dosage form': 'ডোজের ধরন',
  'strength': 'শক্তি / মাত্রা',
  'batch': 'ব্যাচ',
  'batch no': 'ব্যাচ নং',
  'batch number': 'ব্যাচ নম্বর',
  'expiry': 'মেয়াদ',
  'expiry date': 'মেয়াদোত্তীর্ণের তারিখ',
  'stock': 'মজুদ',
  'current stock': 'বর্তমান মজুদ',
  'reorder level': 'রি-অর্ডার সীমা',
  'rack': 'র‍্যাক',
  'rack location': 'র‍্যাক অবস্থান',
  'purchase price': 'ক্রয়মূল্য',
  'selling price': 'বিক্রয়মূল্য',
  'mrp': 'এমআরপি',
  'price': 'মূল্য',
  'quantity': 'পরিমাণ',
  'amount': 'পরিমাণ / টাকা',
  'paid': 'পরিশোধিত',
  'due balance': 'বকেয়া পাওনা',
  'active': 'সক্রিয়',
  'inactive': 'নিষ্ক্রিয়',
  'expired': 'মেয়াদোত্তীর্ণ',
  'quarantined': 'পৃথকীকৃত (কোয়ারেন্টাইন)',
  'pending': 'অপেক্ষমাণ',
  'approved': 'অনুমোদিত',
  'rejected': 'প্রত্যাখ্যাত',
  'completed': 'সম্পন্ন',
  'dispensed': 'বিতরণকৃত',
  'save': 'সংরক্ষণ করুন',
  'cancel': 'বাতিল করুন',
  'submit': 'জমা দিন',
  'confirm': 'নিশ্চিত করুন',
  'delete': 'মুছে ফেলুন',
  'edit': 'সম্পাদনা করুন',
  'view': 'দেখুন',
  'details': 'বিস্তারিত',
  'print': 'প্রিন্ট করুন',
  'export': 'এক্সপোর্ট করুন',
  'add new': 'নতুন যোগ করুন',
  'add medicine': 'নতুন ওষুধ যোগ করুন',
  'add new medicine': 'নতুন ওষুধ যোগ করুন',
  'new purchase order': 'নতুন ক্রয় আদেশ',
  'create purchase order': 'ক্রয় আদেশ তৈরি করুন',
  'receive stock (grn)': 'স্টক গ্রহণ (জিআরএন)',
  'excel chalan entry': 'এক্সেল চালান এন্ট্রি',
  'company stock valuation': 'কোম্পানি স্টক মূল্যায়ন',
  'new prescription': 'নতুন প্রেসক্রিপশন',
  'dispense in pos': 'পিওএস-এ বিতরণ করুন',
  'process return': 'রিটার্ন সম্পন্ন করুন',
  'collect due': 'বকেয়া আদায় করুন',
  'add customer': 'নতুন গ্রাহক যোগ করুন',
  'stock transfer': 'স্টক ট্রান্সফার',
  'new transfer': 'নতুন ট্রান্সফার',
  'add branch': 'নতুন শাখা যোগ করুন',
  'add employee': 'নতুন কর্মী যোগ করুন',
  'add user': 'নতুন ইউজার যোগ করুন',
  'create role': 'নতুন রোল তৈরি করুন',
  'permissions': 'অনুমতিসমূহ',
  'audit logs': 'অডিট লগ',
  'stock adjustments': 'স্টক সমন্বয়',

  // Dosage Forms
  'tablet': 'ট্যাবলেট',
  'capsule': 'ক্যাপসুল',
  'syrup': 'সিরাপ',
  'injection': 'ইনজেকশন',
  'drops': 'ড্রপস',
  'eye drops': 'চোখের ড্রপস',
  'ointment': 'মলম',
  'cream': 'ক্রিম',
  'suspension': 'সাসপেনশন',
  'inhaler': 'ইনহেলার',
  'insulin': 'ইনসুলিন',
};

/**
 * Word-level fallback dictionary for translating multi-word headers, sentences, and dynamic phrases in Bangla mode
 */
const EN_TO_BN_WORDS: Record<string, string> = {
  'pharmacy': 'ফার্মেসি',
  'hospital': 'হাসপাতাল',
  'retail': 'রিটেইল',
  'enterprise': 'এন্টারপ্রাইজ',
  'executive': 'এক্সিকিউটিভ',
  'dashboard': 'ড্যাশবোর্ড',
  'command': 'কমান্ড',
  'center': 'সেন্টার',
  'branch': 'শাখা',
  'branches': 'শাখাসমূহ',
  'central': 'কেন্দ্রীয়',
  'dispensary': 'ডিসপেন্সারি',
  'hub': 'হাব',
  'sales': 'বিক্রয়',
  'sale': 'বিক্রয়',
  'billing': 'বিলিং',
  'counter': 'কাউন্টার',
  'invoice': 'চালান',
  'invoices': 'চালানসমূহ',
  'receipt': 'রসিদ',
  'thermal': 'থার্মাল',
  'prescription': 'প্রেসক্রিপশন',
  'prescriptions': 'প্রেসক্রিপশনসমূহ',
  'return': 'রিটার্ন',
  'returns': 'রিটার্নসমূহ',
  'refund': 'রিফান্ড',
  'refunds': 'রিফান্ডসমূহ',
  'customer': 'গ্রাহক',
  'customers': 'গ্রাহকবৃন্দ',
  'patient': 'রোগী',
  'patients': 'রোগীবৃন্দ',
  'doctor': 'চিকিৎসক',
  'doctors': 'চিকিৎসকবৃন্দ',
  'pharmacist': 'ফার্মাসিস্ট',
  'cashier': 'ক্যাশিয়ার',
  'admin': 'অ্যাডমিন',
  'manager': 'ম্যানেজার',
  'staff': 'কর্মী',
  'employee': 'কর্মী',
  'employees': 'কর্মীবৃন্দ',
  'user': 'ইউজার',
  'users': 'ইউজারবৃন্দ',
  'role': 'রোল',
  'roles': 'রোলসমূহ',
  'settings': 'সেটিংস',
  'inventory': 'ইনভেন্টরি',
  'stock': 'স্টক',
  'stocks': 'স্টক',
  'batch': 'ব্যাচ',
  'batches': 'ব্যাচসমূহ',
  'lot': 'লট',
  'lots': 'লট',
  'expiry': 'মেয়াদ',
  'expired': 'মেয়াদোত্তীর্ণ',
  'expiring': 'মেয়াদ শেষের পথে',
  'soon': 'শীঘ্রই',
  'days': 'দিন',
  'day': 'দিন',
  'months': 'মাস',
  'month': 'মাস',
  'year': 'বছর',
  'years': 'বছর',
  'today': 'আজ',
  'yesterday': 'গতকাল',
  'week': 'সপ্তাহ',
  'daily': 'দৈনিক',
  'weekly': 'সাপ্তাহিক',
  'monthly': 'মাসিক',
  'annual': 'বার্ষিক',
  'medicine': 'ওষুধ',
  'medicines': 'ওষুধসমূহ',
  'drug': 'ওষুধ',
  'drugs': 'ওষুধসমূহ',
  'product': 'পণ্য',
  'products': 'পণ্যসমূহ',
  'item': 'আইটেম',
  'items': 'আইটেমসমূহ',
  'generic': 'জেনেরিক',
  'brand': 'ব্র্যান্ড',
  'company': 'কোম্পানি',
  'manufacturer': 'প্রস্তুতকারক',
  'supplier': 'সাপ্লায়ার',
  'suppliers': 'সাপ্লায়ারবৃন্দ',
  'purchase': 'ক্রয়',
  'purchases': 'ক্রয়সমূহ',
  'order': 'অর্ডার',
  'orders': 'অর্ডারসমূহ',
  'chalan': 'চালান',
  'grn': 'জিআরএন',
  'valuation': 'মূল্যায়ন',
  'value': 'মূল্য',
  'price': 'মূল্য',
  'cost': 'ব্যয়',
  'profit': 'লাভ',
  'gross': 'মোট',
  'net': 'নিট',
  'margin': 'মার্জিন',
  'margins': 'মার্জিন',
  'revenue': 'রাজস্ব',
  'expense': 'খরচ',
  'expenses': 'খরচসমূহ',
  'account': 'হিসাব',
  'accounts': 'হিসাবসমূহ',
  'accounting': 'হিসাবরক্ষণ',
  'ledger': 'লেজার',
  'payable': 'প্রদেয়',
  'payables': 'পাওনা',
  'receivable': 'প্রাপ্য',
  'receivables': 'বকেয়া',
  'due': 'বকেয়া',
  'dues': 'বকেয়া',
  'credit': 'ক্রেডিট',
  'debit': 'ডেবিট',
  'cash': 'নগদ',
  'drawer': 'ড্রয়ার',
  'balance': 'ব্যালেন্স',
  'payment': 'পেমেন্ট',
  'payments': 'পেমেন্টসমূহ',
  'paid': 'পরিশোধিত',
  'unpaid': 'অপরিশোধিত',
  'partial': 'আংশিক',
  'discount': 'ছাড়',
  'tax': 'কর',
  'vat': 'ভ্যাট',
  'total': 'মোট',
  'subtotal': 'উপমোট',
  'quantity': 'পরিমাণ',
  'qty': 'পরিমাণ',
  'unit': 'ইউনিট',
  'units': 'ইউনিট',
  'pack': 'প্যাক',
  'strip': 'স্ট্রিপ',
  'box': 'বক্স',
  'bottle': 'বোতল',
  'tablet': 'ট্যাবলেট',
  'tablets': 'ট্যাবলেট',
  'capsule': 'ক্যাপসুল',
  'capsules': 'ক্যাপসুল',
  'syrup': 'সিরাপ',
  'injection': 'ইনজেকশন',
  'drops': 'ড্রপস',
  'search': 'অনুসন্ধান',
  'scan': 'স্ক্যান',
  'scanner': 'স্ক্যানার',
  'barcode': 'বারকোড',
  'filter': 'ফিল্টার',
  'all': 'সকল',
  'active': 'সক্রিয়',
  'inactive': 'নিষ্ক্রিয়',
  'status': 'অবস্থা',
  'type': 'ধরন',
  'category': 'ক্যাটাগরি',
  'action': 'পদক্ষেপ',
  'actions': 'পদক্ষেপসমূহ',
  'view': 'দেখুন',
  'add': 'যোগ করুন',
  'new': 'নতুন',
  'create': 'তৈরি করুন',
  'edit': 'সম্পাদনা',
  'update': 'আপডেট',
  'delete': 'মুছুন',
  'remove': 'সরান',
  'clear': 'পরিষ্কার',
  'reset': 'রিসেট',
  'save': 'সংরক্ষণ',
  'cancel': 'বাতিল',
  'close': 'বন্ধ',
  'confirm': 'নিশ্চিত',
  'approve': 'অনুমোদন',
  'approved': 'অনুমোদিত',
  'reject': 'প্রত্যাখ্যান',
  'rejected': 'প্রত্যাখ্যাত',
  'pending': 'অপেক্ষমাণ',
  'completed': 'সম্পন্ন',
  'print': 'প্রিন্ট',
  'export': 'এক্সপোর্ট',
  'download': 'ডাউনলোড',
  'refresh': 'রিফ্রেশ',
  'loading': 'লোড হচ্ছে',
  'alert': 'সতর্কতা',
  'alerts': 'সতর্কতা',
  'warning': 'সতর্কবার্তা',
  'critical': 'জরুরি',
  'urgent': 'জরুরি',
  'priority': 'অগ্রাধিকার',
  'normal': 'স্বাভাবিক',
  'healthy': 'স্বাভাবিক',
  'low': 'কম',
  'high': 'বেশি',
  'audit': 'অডিট',
  'log': 'লগ',
  'logs': 'লগসমূহ',
  'trail': 'ট্রেইল',
  'history': 'ইতিহাস',
  'analytics': 'অ্যানালিটিক্স',
  'forecast': 'পূর্বাভাস',
  'forecasting': 'পূর্বাভাস',
  'intelligence': 'ইনটেলিজেন্স',
  'anomaly': 'অসংগতি',
  'anomalies': 'অসংগতিসমূহ',
  'transfer': 'ট্রান্সফার',
  'transfers': 'ট্রান্সফারসমূহ',
  'adjustment': 'সমন্বয়',
  'adjustments': 'সমন্বয়সমূহ',
  'quarantine': 'কোয়ারেন্টাইন',
  'quarantined': 'কোয়ারেন্টাইনকৃত',
  'damage': 'ক্ষতিগ্রস্ত',
  'damaged': 'ক্ষতিগ্রস্ত',
  'loss': 'ক্ষতি',
  'loyalty': 'লয়্যালটি',
  'points': 'পয়েন্ট',
  'member': 'সদস্য',
  'tier': 'স্তর',
  'limit': 'সীমা',
  'phone': 'ফোন',
  'mobile': 'মোবাইল',
  'address': 'ঠিকানা',
  'name': 'নাম',
  'code': 'কোড',
  'date': 'তারিখ',
  'time': 'সময়',
  'notes': 'নোট',
  'reason': 'কারণ',
  'summary': 'সারসংক্ষেপ',
  'details': 'বিস্তারিত',
  'report': 'রিপোর্ট',
  'reports': 'রিপোর্টসমূহ',
  'financial': 'আর্থিক',
  'operating': 'পরিচালন',
  'pillar': 'স্তম্ভ',
  'compliance': 'কমপ্লায়েন্স',
  'security': 'নিরাপত্তা',
  'access': 'অ্যাক্সেস',
  'control': 'নিয়ন্ত্রণ',
  'permission': 'অনুমতি',
  'permissions': 'অনুমতিসমূহ',
  'cart': 'কার্ট',
  'hold': 'হোল্ড',
  'held': 'হোল্ডকৃত',
  'recall': 'রিকল',
  'restore': 'পুনরুদ্ধার',
  'dispense': 'বিতরণ',
  'dispensed': 'বিতরণকৃত',
  'substitute': 'বিকল্প',
  'alternatives': 'বিকল্পসমূহ',
  'strength': 'শক্তি',
  'dosage': 'মাত্রা',
  'rack': 'র‍্যাক',
  'location': 'অবস্থান',
  'warehouse': 'ওয়্যারহাউস',
  'depot': 'ডিপো',
  'online': 'অনলাইন',
  'offline': 'অফলাইন',
  'live': 'লাইভ',
};

const HAS_BANGLA_REGEX = /[\u0980-\u09F1\u09F4-\u09FF]/;
const HAS_ENGLISH_LETTERS_REGEX = /[A-Za-z]/;

/**
 * Strip or convert any Bangla text to pure English when EN mode is active
 */
export function normalizeToEnglish(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);

  // 1. Direct lookup for known Bangla strings
  if (BN_TO_EN_PHRASES[trimmed]) {
    return leading + BN_TO_EN_PHRASES[trimmed] + trailing;
  }

  let result = trimmed;

  // 2. Pattern: "বাংলা টেক্সট (English Text)" -> "English Text"
  const bnThenEnMatch = result.match(/^[\u0980-\u09FF\s0-9০-৯/:•.,!-]+\(([^)]*[A-Za-z][^)]*)\)$/);
  if (bnThenEnMatch && bnThenEnMatch[1]) {
    return leading + toEnglishDigits(bnThenEnMatch[1].trim()) + trailing;
  }

  // 3. Pattern: "English Text (বাংলা টেক্সট)" -> "English Text"
  const enThenBnMatch = result.match(/^([^()]*[A-Za-z][^()]*)\s*\([^)]*[\u0980-\u09F1\u09F4-\u09FF][^)]*\)$/);
  if (enThenBnMatch && enThenBnMatch[1]) {
    return leading + toEnglishDigits(enThenBnMatch[1].trim()) + trailing;
  }

  // 4. Pattern: "English Text / বাংলা টেক্সট" -> "English Text"
  if (result.includes('/') && HAS_BANGLA_REGEX.test(result) && HAS_ENGLISH_LETTERS_REGEX.test(result)) {
    const parts = result.split('/').map((p) => p.trim());
    const enPart = parts.find((p) => HAS_ENGLISH_LETTERS_REGEX.test(p) && !HAS_BANGLA_REGEX.test(p));
    if (enPart) {
      return leading + toEnglishDigits(enPart) + trailing;
    }
  }

  // 5. Convert any Bangla digits to English digits
  result = toEnglishDigits(result);
  return leading + result + trailing;
}

/**
 * Translate any string to 100% Bangla when BN mode is active
 */
export function translateToBangla(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // Preserve toggle labels
  if (trimmed === 'EN' || trimmed === 'বাং') return raw;

  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);

  // 1. Exact phrase match (case-insensitive)
  const lower = trimmed.toLowerCase();
  if (EN_TO_BN_PHRASES[lower]) {
    return leading + EN_TO_BN_PHRASES[lower] + trailing;
  }

  // 2. Bilingual pattern: "English Text (বাংলা টেক্সট)" -> extract "বাংলা টেক্সট"
  const enThenBnMatch = trimmed.match(/^[^()]*[A-Za-z][^()]*\(([^)]*[\u0980-\u09F1\u09F4-\u09FF][^)]*)\)$/);
  if (enThenBnMatch && enThenBnMatch[1]) {
    return leading + toBanglaDigits(enThenBnMatch[1].trim()) + trailing;
  }

  // 3. Bilingual pattern: "বাংলা টেক্সট (English Text)" -> extract "বাংলা টেক্সট"
  const bnThenEnMatch = trimmed.match(/^([\u0980-\u09FF\s0-9০-৯/:•.,!-]+)\([^)]*[A-Za-z][^)]*\)$/);
  if (bnThenEnMatch && bnThenEnMatch[1]) {
    return leading + toBanglaDigits(bnThenEnMatch[1].trim()) + trailing;
  }

  // 4. Bilingual slash pattern: "English / বাংলা" -> extract "বাংলা"
  if (trimmed.includes('/') && HAS_BANGLA_REGEX.test(trimmed) && HAS_ENGLISH_LETTERS_REGEX.test(trimmed)) {
    const parts = trimmed.split('/').map((p) => p.trim());
    const bnPart = parts.find((p) => HAS_BANGLA_REGEX.test(p));
    if (bnPart) {
      return leading + toBanglaDigits(bnPart) + trailing;
    }
  }

  // 5. Dynamic pattern rules
  let result = trimmed;

  // e.g. "5 Lots < 30d" -> "৫টি লট < ৩০ দিন"
  result = result.replace(/^(\d+)\s+Lots?\s*<\s*(\d+)d$/i, (_, n, d) => `${toBanglaDigits(n)}টি লট < ${toBanglaDigits(d)} দিন`);
  // e.g. "4 Br" -> "৪টি শাখা"
  result = result.replace(/^(\d+)\s+Br$/i, (_, n) => `${toBanglaDigits(n)}টি শাখা`);
  // e.g. "Hold Cart (2)" -> "কার্ট হোল্ড (২)"
  result = result.replace(/^Hold Cart\s*\((\d+)\)$/i, (_, n) => `কার্ট হোল্ড (${toBanglaDigits(n)})`);
  // e.g. "Recall Held (2)" -> "হোল্ড রিকল (২)"
  result = result.replace(/^Recall Held\s*\((\d+)\)$/i, (_, n) => `হোল্ড রিকল (${toBanglaDigits(n)})`);
  // e.g. "12 Invoices" -> "১২টি চালান"
  result = result.replace(/^(\d+)\s+Invoices?$/i, (_, n) => `${toBanglaDigits(n)}টি চালান`);
  // e.g. "Avg ৳120/rx" -> "গড় ৳১২০/প্রেসক্রিপশন"
  result = result.replace(/^Avg\s+৳([\d,.]+)\/rx$/i, (_, n) => `গড় ৳${toBanglaDigits(n)}/প্রেসক্রিপশন`);
  // e.g. "24.5% margin" -> "২৪.৫% মার্জিন"
  result = result.replace(/^([\d.]+)%\s*margin$/i, (_, n) => `${toBanglaDigits(n)}% মার্জিন`);
  // e.g. "120 units in stock" -> "১২০ ইউনিট স্টকে আছে"
  result = result.replace(/^(\d+)\s+units?\s+in\s+stock$/i, (_, n) => `${toBanglaDigits(n)} ইউনিট স্টকে আছে`);
  // e.g. "Terminal v4.12" -> "টার্মিনাল ৪.১২"
  result = result.replace(/^Terminal\s+v([\d.]+)$/i, (_, v) => `টার্মিনাল সংস্করণ ${toBanglaDigits(v)}`);

  if (result !== trimmed) {
    return leading + result + trailing;
  }

  // 6. Token/word-level replacement for remaining English words
  if (HAS_ENGLISH_LETTERS_REGEX.test(result)) {
    result = result.replace(/\b([A-Za-z]+)\b/g, (word) => {
      const wLower = word.toLowerCase();
      if (EN_TO_BN_PHRASES[wLower]) return EN_TO_BN_PHRASES[wLower];
      if (EN_TO_BN_WORDS[wLower]) return EN_TO_BN_WORDS[wLower];
      return word;
    });
  }

  // 7. Convert all digits 0-9 to Bangla digits ০-৯
  result = toBanglaDigits(result);

  return leading + result + trailing;
}

const originalTextMap = new WeakMap<Text, string>();
const lastRenderedMap = new WeakMap<Text, string>();

function shouldSkipNode(node: Node | null): boolean {
  if (!node) return true;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  if (!el) return true;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE') return true;
  if (el.closest('[data-no-translate="true"]')) return true;
  return false;
}

function processTextNode(textNode: Text, locale: 'en' | 'bn'): void {
  if (shouldSkipNode(textNode)) return;
  const currentVal = textNode.nodeValue || '';
  if (!currentVal.trim()) return;

  const lastOut = lastRenderedMap.get(textNode);
  if (lastOut === undefined || currentVal !== lastOut) {
    originalTextMap.set(textNode, currentVal);
  }

  const orig = originalTextMap.get(textNode) ?? currentVal;
  const nextVal = locale === 'bn' ? translateToBangla(orig) : normalizeToEnglish(orig);

  if (nextVal !== currentVal) {
    lastRenderedMap.set(textNode, nextVal);
    textNode.nodeValue = nextVal;
  } else {
    lastRenderedMap.set(textNode, currentVal);
  }
}

function processElementAttributes(el: HTMLElement, locale: 'en' | 'bn'): void {
  if (shouldSkipNode(el)) return;

  const attrs = ['placeholder', 'title', 'aria-label'] as const;
  for (const attr of attrs) {
    const val = el.getAttribute(attr);
    if (!val || !val.trim()) continue;

    const origAttrName = `data-i18n-orig-${attr}`;
    const lastAttrName = `data-i18n-last-${attr}`;
    const lastVal = el.getAttribute(lastAttrName);

    if (lastVal === null || val !== lastVal) {
      el.setAttribute(origAttrName, val);
    }

    const orig = el.getAttribute(origAttrName) ?? val;
    const nextVal = locale === 'bn' ? translateToBangla(orig) : normalizeToEnglish(orig);

    if (nextVal !== val) {
      el.setAttribute(lastAttrName, nextVal);
      el.setAttribute(attr, nextVal);
    } else {
      el.setAttribute(lastAttrName, val);
    }
  }
}

export function applyDomTranslation(root: Node = document.body, customLocale?: 'en' | 'bn'): void {
  if (typeof document === 'undefined' || !root) return;
  const locale = customLocale || getCurrentLocale();
  document.documentElement.lang = locale;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      processTextNode(current as Text, locale);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      processElementAttributes(current as HTMLElement, locale);
    }
    current = walker.nextNode();
  }
}

let isInitialized = false;
let isApplying = false;

export function initializeDomTranslator(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const runPass = (locale?: 'en' | 'bn') => {
    if (isApplying) return;
    isApplying = true;
    try {
      applyDomTranslation(document.body, locale);
    } finally {
      isApplying = false;
    }
  };

  // Initial pass
  runPass();

  // Re-run whenever locale changes
  subscribeLocale((newLocale) => {
    runPass(newLocale);
  });

  // Observe DOM mutations so new modals, tabs, and dynamic rows are translated immediately
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (isApplying || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      runPass();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
