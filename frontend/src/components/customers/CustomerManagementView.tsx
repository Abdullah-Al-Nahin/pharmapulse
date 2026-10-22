import React, { useState, useEffect } from 'react';
import { 
  Customer, 
  CustomerType, 
  PricingTier, 
  LoyaltyConfig 
} from '../../types/customer';
import { CustomerService } from '../../services/customerService';
import { CustomerDuePaymentLoyaltyModal } from './CustomerDuePaymentLoyaltyModal';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  DollarSign, 
  Award, 
  AlertTriangle, 
  Building2, 
  FileText, 
  Receipt, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  CreditCard,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  X,
  Sparkles
} from 'lucide-react';

export const CustomerManagementView: React.FC = () => {
  const { hasPermission } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>(() => 
    CustomerService.getLoyaltyConfig()
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [onlyWithDue, setOnlyWithDue] = useState(false);

  // Modals
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<Customer | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'payment' | 'ledger' | 'loyalty'>('payment');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Customer Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formType, setFormType] = useState<CustomerType>('regular');
  const [formTier, setFormTier] = useState<PricingTier>('retail');
  const [formCreditLimit, setFormCreditLimit] = useState<string>('500');
  const [formTaxId, setFormTaxId] = useState('');
  const [formInstitutionName, setFormInstitutionName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Load Data
  const loadCustomers = () => {
    setCustomers(CustomerService.getCustomers());
    setLoyaltyConfig(CustomerService.getLoyaltyConfig());
  };

  useEffect(() => {
    loadCustomers();
    CustomerService.syncFromDB();
    const unsubscribe = CustomerService.subscribe(loadCustomers);
    return () => unsubscribe();
  }, []);

  // Sync pricing tier default when type changes
  const handleTypeChange = (type: CustomerType) => {
    setFormType(type);
    switch (type) {
      case 'wholesale':
        setFormTier('wholesale');
        setFormCreditLimit('8000');
        break;
      case 'corporate':
        setFormTier('dealer');
        setFormCreditLimit('5000');
        break;
      case 'institution':
        setFormTier('institution');
        setFormCreditLimit('15000');
        break;
      case 'regular':
        setFormTier('retail');
        setFormCreditLimit('500');
        break;
      default:
        setFormTier('retail');
        setFormCreditLimit('0');
    }
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Phone number is required for account identification.');
      return;
    }

    try {
      const created = CustomerService.createCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        customerType: formType,
        pricingTier: formTier,
        creditLimit: parseFloat(formCreditLimit) || 0,
        taxId: formTaxId.trim() || undefined,
        institutionName: formInstitutionName.trim() || undefined,
        contactPerson: formContactPerson.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      loadCustomers();
      setShowCreateModal(false);
      resetForm();

      // Open due & loyalty modal for quick inspection
      setSelectedCustomerForModal(created);
      setModalInitialTab('ledger');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create customer.');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormType('regular');
    setFormTier('retail');
    setFormCreditLimit('500');
    setFormTaxId('');
    setFormInstitutionName('');
    setFormContactPerson('');
    setFormNotes('');
    setFormError('');
  };

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.institutionName && c.institutionName.toLowerCase().includes(q)) ||
      (c.taxId && c.taxId.toLowerCase().includes(q));

    const matchesType = selectedType === 'all' || c.customerType === selectedType;
    const matchesTier = selectedTier === 'all' || c.pricingTier === selectedTier;
    const matchesDue = !onlyWithDue || c.outstandingBalance > 0;

    return matchesSearch && matchesType && matchesTier && matchesDue;
  });

  // KPI Calculations
  const totalReceivablesDue = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalCreditLimitAllocated = customers.reduce((sum, c) => sum + c.creditLimit, 0);
  const customersWithDueCount = customers.filter((c) => c.outstandingBalance > 0).length;
  const totalActiveLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const totalLoyaltyValue = totalActiveLoyaltyPoints * loyaltyConfig.redemptionRatePerPoint;

  const getTypeBadge = (type: CustomerType) => {
    switch (type) {
      case 'wholesale':
        return <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">Wholesale</span>;
      case 'corporate':
        return <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">Corporate</span>;
      case 'institution':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">Institution</span>;
      case 'regular':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">Regular</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">Retail</span>;
    }
  };

  const getTierBadge = (tier: PricingTier) => {
    switch (tier) {
      case 'wholesale':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-purple-200">Wholesale Tier</span>;
      case 'dealer':
        return <span className="bg-indigo-100 text-indigo-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200">Corporate / Dealer</span>;
      case 'institution':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">Hospital Tier</span>;
      case 'mrp':
        return <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200">MRP Tier</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">Retail Tier</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Customer Management & Receivables Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Multi-Tier Pricing (Retail, Wholesale, Corporate, Hospital), Credit Limits & Due Collections, and Loyalty Points Program
          </p>
        </div>

        <button
          id="btn-open-create-customer-modal"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables Due */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outstanding Receivables</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-600">
              ${totalReceivablesDue.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
              {customersWithDueCount} Due Accounts
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Total credit limit allocated: <strong className="text-slate-600 font-mono">${totalCreditLimitAllocated.toFixed(2)}</strong>
          </div>
        </div>

        {/* Customer Directory Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Customers</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {customers.length} <span className="text-sm font-normal text-slate-400">Profiles</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Wholesale: <strong className="text-slate-700">{customers.filter(c => c.customerType === 'wholesale').length}</strong></span>
            <span>•</span>
            <span>Corporate: <strong className="text-slate-700">{customers.filter(c => c.customerType === 'corporate').length}</strong></span>
            <span>•</span>
            <span>Hospital: <strong className="text-slate-700">{customers.filter(c => c.customerType === 'institution').length}</strong></span>
          </div>
        </div>

        {/* Total Loyalty Points */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Loyalty Points</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-indigo-600">
              {totalActiveLoyaltyPoints}
            </span>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
              Pts Circulating
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Cash discount liability: <strong className="text-emerald-700 font-mono font-bold">${totalLoyaltyValue.toFixed(2)}</strong>
          </div>
        </div>

        {/* Dynamic Pricing Engine Rules */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Tier Pricing Rules</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Tag className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Wholesale:</span>
              <span className="font-bold text-purple-700 font-mono">18% off MRP / Trade</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Corporate:</span>
              <span className="font-bold text-indigo-700 font-mono">22% off MRP / Dealer</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Institution:</span>
              <span className="font-bold text-blue-700 font-mono">25% off MRP / Hospital</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="customer-search-input"
            type="text"
            placeholder="Search customer by name, phone, email, institution, or tax ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Customer Type Filter */}
          <select
            id="filter-customer-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Customer Types</option>
            <option value="retail">Retail (OTC)</option>
            <option value="regular">Regular Patients</option>
            <option value="corporate">Corporate Clients</option>
            <option value="wholesale">Wholesale Dealers</option>
            <option value="institution">Hospitals & Clinics</option>
          </select>

          {/* Pricing Tier Filter */}
          <select
            id="filter-pricing-tier"
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All Pricing Tiers</option>
            <option value="retail">Retail Tier</option>
            <option value="wholesale">Wholesale Tier</option>
            <option value="dealer">Corporate / Dealer Tier</option>
            <option value="institution">Hospital Tier</option>
            <option value="mrp">MRP Tier</option>
          </select>

          {/* Toggle Due Only */}
          <button
            id="filter-due-only-btn"
            onClick={() => setOnlyWithDue(!onlyWithDue)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border ${
              onlyWithDue
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-rose-600" />
            <span>Has Due Balance ({customersWithDueCount})</span>
          </button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Type & Category</th>
                <th className="py-3 px-4">Pricing Tier</th>
                <th className="py-3 px-4 text-right">Outstanding Due</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Loyalty Points</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">No matching customer profiles found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try adjusting search keywords or filters</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const creditPercent = cust.creditLimit > 0 
                    ? Math.min(100, Math.round((cust.outstandingBalance / cust.creditLimit) * 100))
                    : 0;
                  const isOverCredit = cust.creditLimit > 0 && cust.outstandingBalance >= cust.creditLimit;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer Details */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{cust.name}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{cust.phone}</span>
                          {cust.email && <span>• {cust.email}</span>}
                        </div>
                        {cust.institutionName && (
                          <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                            {cust.institutionName} {cust.contactPerson && `(Attn: ${cust.contactPerson})`}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getTypeBadge(cust.customerType)}
                      </td>

                      {/* Pricing Tier */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getTierBadge(cust.pricingTier)}
                      </td>

                      {/* Outstanding Due */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className={`font-bold text-sm ${(cust.outstandingBalance ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          ${(cust.outstandingBalance ?? 0).toFixed(2)}
                        </span>
                        {isOverCredit && (
                          <span className="block text-[10px] text-rose-600 font-bold">
                            Exceeds Limit!
                          </span>
                        )}
                      </td>

                      {/* Credit Limit & Bar */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className="font-bold text-slate-800">
                          ${(cust.creditLimit ?? 0).toFixed(2)}
                        </span>
                        {cust.creditLimit > 0 && (
                          <div className="w-24 ml-auto mt-1 flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  creditPercent >= 90 ? 'bg-rose-500' : creditPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${creditPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 font-sans">{creditPercent}%</span>
                          </div>
                        )}
                      </td>

                      {/* Loyalty Points */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className="font-bold text-indigo-700">
                          {cust.loyaltyPoints} <span className="text-[10px] font-normal text-slate-400">Pts</span>
                        </span>
                        <div className="text-[10px] text-emerald-600">
                          ≈ ${(cust.loyaltyPoints * loyaltyConfig.redemptionRatePerPoint).toFixed(2)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            id={`btn-manage-due-loyalty-${cust.id}`}
                            onClick={() => {
                              setSelectedCustomerForModal(cust);
                              setModalInitialTab(cust.outstandingBalance > 0 ? 'payment' : 'ledger');
                            }}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Due & Ledger</span>
                          </button>

                          <button
                            id={`btn-view-loyalty-${cust.id}`}
                            onClick={() => {
                              setSelectedCustomerForModal(cust);
                              setModalInitialTab('loyalty');
                            }}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded cursor-pointer transition"
                            title="Loyalty Rewards History"
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Due Payment & Loyalty Modal */}
      {selectedCustomerForModal && (
        <CustomerDuePaymentLoyaltyModal
          customer={selectedCustomerForModal}
          isOpen={!!selectedCustomerForModal}
          onClose={() => setSelectedCustomerForModal(null)}
          onCustomerUpdated={(updated) => {
            loadCustomers();
            setSelectedCustomerForModal(updated);
          }}
          initialTab={modalInitialTab}
        />
      )}

      {/* New Customer Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Create New Customer Profile</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Entity Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe, Metro Clinic"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (555) 000-0000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="regular">Regular Patient</option>
                    <option value="retail">Retail (Standard OTC)</option>
                    <option value="corporate">Corporate Client</option>
                    <option value="wholesale">Wholesale Dealer</option>
                    <option value="institution">Institution / Hospital</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dynamic Pricing Tier *</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as PricingTier)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="retail">Retail Tier (Standard POS)</option>
                    <option value="wholesale">Wholesale Tier (18% off MRP)</option>
                    <option value="dealer">Corporate / Dealer Tier (22% off MRP)</option>
                    <option value="institution">Hospital Tier (25% off MRP)</option>
                    <option value="mrp">MRP Tier (Zero Discount)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    placeholder="0.00"
                    value={formCreditLimit}
                    onChange={(e) => setFormCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Maximum receivables credit ceiling allowed for this account
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tax ID / Trade License</label>
                  <input
                    type="text"
                    placeholder="e.g. VAT-99120, BIN-4421"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person / Officer</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Marcus Vance"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Delivery / Billing Address</label>
                <input
                  type="text"
                  placeholder="Street address, Suite, City"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Operational Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Net 30 days settlement terms, weekly billing"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-create-customer-btn"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                >
                  Register Customer Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
