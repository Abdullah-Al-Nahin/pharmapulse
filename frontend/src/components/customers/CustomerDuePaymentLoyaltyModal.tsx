import React, { useState } from 'react';
import { 
  Customer, 
  CustomerLedgerEntry, 
  DuePaymentReceipt, 
  LoyaltyTransaction,
  LoyaltyConfig 
} from '../../types/customer';
import { CustomerService } from '../../services/customerService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/i18nFormatter';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  Receipt, 
  Award, 
  Clock, 
  CheckCircle2, 
  Printer, 
  FileText, 
  AlertTriangle,
  Building2,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

interface CustomerDuePaymentLoyaltyModalProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
  onCustomerUpdated: (updatedCustomer: Customer) => void;
  initialTab?: 'payment' | 'ledger' | 'loyalty';
}

export const CustomerDuePaymentLoyaltyModal: React.FC<CustomerDuePaymentLoyaltyModalProps> = ({
  customer: initialCustomer,
  isOpen,
  onClose,
  onCustomerUpdated,
  initialTab = 'payment',
}) => {
  const { currentUser } = useAuth();
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [activeTab, setActiveTab] = useState<'payment' | 'ledger' | 'loyalty'>(initialTab);

  // Ledger and Loyalty state
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>(() => 
    CustomerService.getCustomerLedger(customer.id)
  );
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>(() => 
    CustomerService.getLoyaltyHistory(customer.id)
  );
  const [loyaltyConfig] = useState<LoyaltyConfig>(() => 
    CustomerService.getLoyaltyConfig()
  );

  // Due Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'upi_mobile'>('cash');
  const [trxReference, setTrxReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string>('');
  const [lastReceipt, setLastReceipt] = useState<DuePaymentReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Loyalty Manual Adjustment state
  const [showAdjustPoints, setShowAdjustPoints] = useState(false);
  const [adjustPointsDelta, setAdjustPointsDelta] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'adjusted' | 'expired'>('adjusted');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  if (!isOpen) return null;

  const refreshData = (updated: Customer) => {
    setCustomer(updated);
    setLedgerEntries(CustomerService.getCustomerLedger(updated.id));
    setLoyaltyHistory(CustomerService.getLoyaltyHistory(updated.id));
    onCustomerUpdated(updated);
  };

  // Quick payment percentage buttons
  const handleQuickAmount = (ratio: number) => {
    const amount = (customer.outstandingBalance * ratio).toFixed(2);
    setPaymentAmount(amount);
    setPaymentError('');
  };

  const handleProcessDuePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Please enter a valid positive payment amount.');
      return;
    }

    if (amount > customer.outstandingBalance) {
      setPaymentError(`Payment amount (${formatCurrency(amount)}) exceeds customer outstanding balance (${formatCurrency(customer.outstandingBalance)}).`);
      return;
    }

    setIsProcessing(true);
    try {
      const collectorName = currentUser ? `${currentUser.name} (${currentUser.roleName || currentUser.role})` : 'Authorized Cashier';
      const result = CustomerService.collectDuePayment({
        customerId: customer.id,
        amountPaid: amount,
        paymentMethod,
        transactionReference: trxReference.trim() || undefined,
        referenceNotes: paymentNotes.trim() || undefined,
        collectedBy: collectorName,
      });

      setLastReceipt(result.receipt);
      refreshData(result.customer);
      setPaymentAmount('');
      setTrxReference('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjustPoints = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');

    const points = parseInt(adjustPointsDelta, 10);
    if (isNaN(points) || points === 0) {
      setAdjustError('Please specify a valid non-zero points number.');
      return;
    }

    if (adjustType === 'expired' && points > 0) {
      setAdjustError('Expired points must be entered as a deduction or select positive for bonus adjustment.');
      return;
    }

    const finalDelta = adjustType === 'expired' ? -Math.abs(points) : points;
    if (customer.loyaltyPoints + finalDelta < 0) {
      setAdjustError(`Cannot deduct more points than customer balance (${customer.loyaltyPoints} points).`);
      return;
    }

    try {
      const processorName = currentUser ? `${currentUser.name}` : 'Pharmacy Supervisor';
      const result = CustomerService.adjustLoyaltyPoints(
        customer.id,
        finalDelta,
        adjustType,
        adjustReason || (finalDelta > 0 ? 'Goodwill Loyalty Bonus' : 'Point Expiry Policy'),
        processorName
      );

      refreshData(result.customer);
      setShowAdjustPoints(false);
      setAdjustPointsDelta('');
      setAdjustReason('');
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust points.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Credit limit calculation
  const creditUsagePercent = customer.creditLimit > 0 
    ? Math.min(100, Math.round((customer.outstandingBalance / customer.creditLimit) * 100))
    : 0;

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'wholesale':
        return <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-purple-200">Wholesale Tier</span>;
      case 'dealer':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-indigo-200">Corporate / Dealer</span>;
      case 'institution':
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">Hospital / Institution</span>;
      case 'mrp':
        return <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-slate-200">MRP Tier</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-emerald-200">Retail Tier</span>;
    }
  };

  const getTypeBadge = (type: string) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="customer-due-loyalty-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight text-white">{customer.name}</h2>
                {getTypeBadge(customer.customerType)}
                {getTierBadge(customer.pricingTier)}
                {customer.status === 'blocked' && (
                  <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Account Blocked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span>Phone: <strong className="text-white font-mono">{customer.phone}</strong></span>
                {customer.taxId && <span>• Tax ID: <strong className="text-slate-200 font-mono">{customer.taxId}</strong></span>}
                {customer.institutionName && <span>• {customer.institutionName}</span>}
              </p>
            </div>
          </div>

          <button
            id="close-due-loyalty-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot Metrics Ribbon */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
          <div className="p-3.5">
            <div className="text-slate-500 font-medium">Outstanding Due Balance</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-xl font-bold font-mono ${customer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(customer.outstandingBalance)}
              </span>
              {customer.outstandingBalance > 0 && (
                <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded font-bold">
                  Receivable
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-slate-500 font-medium flex items-center justify-between">
              <span>Credit Limit</span>
              <span className="font-mono text-slate-700 font-bold">{formatCurrency(customer.creditLimit)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    creditUsagePercent >= 90 ? 'bg-rose-500' : creditUsagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${creditUsagePercent}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">
                {creditUsagePercent}%
              </span>
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-slate-500 font-medium flex items-center justify-between">
              <span>Active Loyalty Points</span>
              <span className="text-[10px] text-emerald-600 font-medium">
                ≈ {formatCurrency(customer.loyaltyPoints * loyaltyConfig.redemptionRatePerPoint)} Value
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-indigo-600">
                {customer.loyaltyPoints}
              </span>
              <span className="text-[11px] text-slate-500">Points available</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-5 shrink-0">
          <button
            id="tab-collect-due-payment"
            onClick={() => { setActiveTab('payment'); setLastReceipt(null); }}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'payment'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Collect Due Payment</span>
          </button>

          <button
            id="tab-receivables-ledger"
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'ledger'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Receivables Ledger ({ledgerEntries.length})</span>
          </button>

          <button
            id="tab-loyalty-rewards"
            onClick={() => setActiveTab('loyalty')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'loyalty'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Loyalty Points & Rewards</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {/* ========================================================= */}
          {/* TAB 1: COLLECT DUE PAYMENT                                 */}
          {/* ========================================================= */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              {lastReceipt ? (
                /* Formal Payment Receipt Voucher */
                <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 text-emerald-600">
                      <CheckCircle2 className="w-6 h-6" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Payment Recorded Successfully</h3>
                        <p className="text-xs text-slate-500">Official Customer Due Collection Voucher</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-md border border-slate-200">
                        {lastReceipt.receiptNumber}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {lastReceipt.date} • {lastReceipt.timestamp}
                      </div>
                    </div>
                  </div>

                  {/* Receipt Details Box */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block">Amount Collected</span>
                      <span className="text-base font-bold text-emerald-700">{formatCurrency(lastReceipt.amountPaid)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Previous Balance</span>
                      <span className="text-slate-700 font-bold">{formatCurrency(lastReceipt.previousBalance)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Remaining Due</span>
                      <span className={`text-base font-bold ${lastReceipt.remainingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(lastReceipt.remainingBalance)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Payment Mode</span>
                      <span className="text-slate-800 font-semibold uppercase">{lastReceipt.paymentMethod.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p><strong>Customer:</strong> {lastReceipt.customerName} ({lastReceipt.customerPhone})</p>
                    <p><strong>Collector:</strong> {lastReceipt.collectedBy}</p>
                    {lastReceipt.transactionReference && (
                      <p><strong>Trx / Cheque Ref:</strong> {lastReceipt.transactionReference}</p>
                    )}
                    {lastReceipt.notes && (
                      <p><strong>Notes:</strong> {lastReceipt.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      id="print-due-receipt-btn"
                      onClick={handlePrintReceipt}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      onClick={() => setLastReceipt(null)}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Record Another Payment
                    </button>
                  </div>
                </div>
              ) : (
                /* Payment Input Form */
                <form onSubmit={handleProcessDuePayment} className="space-y-5">
                  {customer.outstandingBalance <= 0 ? (
                    <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                      <h3 className="text-sm font-bold text-emerald-900">Zero Outstanding Balance</h3>
                      <p className="text-xs text-emerald-700 max-w-md mx-auto">
                        This customer currently has no pending receivables. All historical invoices are fully settled.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Balance & Quick Actions */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 block">Total Due To Settle</span>
                          <span className="text-2xl font-black font-mono text-rose-600">
                            {formatCurrency(customer.outstandingBalance)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400 font-medium">Quick Amounts:</span>
                          <button
                            type="button"
                            onClick={() => handleQuickAmount(1.0)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold cursor-pointer transition"
                          >
                            Full Due (100%)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAmount(0.5)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-bold cursor-pointer transition"
                          >
                            50% Due
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAmount(0.25)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-bold cursor-pointer transition"
                          >
                            25% Due
                          </button>
                        </div>
                      </div>

                      {paymentError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{paymentError}</span>
                        </div>
                      )}

                      {/* Payment Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Payment Amount (৳) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">৳</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={customer.outstandingBalance}
                              required
                              placeholder="0.00"
                              value={paymentAmount}
                              onChange={(e) => {
                                setPaymentAmount(e.target.value);
                                setPaymentError('');
                              }}
                              className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                          {parseFloat(paymentAmount) > 0 && parseFloat(paymentAmount) <= customer.outstandingBalance && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Remaining balance will be:{' '}
                              <strong className="text-slate-800 font-mono">
                                {formatCurrency(customer.outstandingBalance - parseFloat(paymentAmount))}
                              </strong>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Payment Method *
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="cash">Cash Tender</option>
                            <option value="bank_transfer">Bank Wire Transfer / EFT</option>
                            <option value="cheque">Bank Cheque</option>
                            <option value="upi_mobile">bKash / Nagad / Mobile Wallet</option>
                            <option value="card">Credit / Debit Card POS</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Transaction Reference / Cheque No
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Cheque #77491, ACH-88192, TRX-9923"
                            value={trxReference}
                            onChange={(e) => setTrxReference(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Receipt Notes / Remarks
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Partial settlement for August supply"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          id="submit-collect-due-btn"
                          disabled={isProcessing}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isProcessing ? 'Processing...' : 'Record Payment & Issue Receipt'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: RECEIVABLES LEDGER                                  */}
          {/* ========================================================= */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Displaying chronological receivables accounting journal</span>
                <span className="font-mono font-bold text-slate-700">{ledgerEntries.length} ledger movements</span>
              </div>

              {ledgerEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No ledger transactions recorded yet for this customer.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Debit (+Due)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-Paid)</th>
                          <th className="py-2.5 px-3 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {ledgerEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                              {entry.date} <span className="text-slate-400 text-[10px]">{entry.timestamp}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                              {entry.type === 'INVOICE_DUE' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">
                                  <ArrowUpRight className="w-3 h-3" /> Sale Due
                                </span>
                              )}
                              {entry.type === 'PAYMENT_RECEIVED' && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                                  <ArrowDownLeft className="w-3 h-3" /> Payment
                                </span>
                              )}
                              {entry.type === 'CREDIT_NOTE' && (
                                <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-[10px] font-bold border border-sky-200">
                                  Credit Note
                                </span>
                              )}
                              {entry.type === 'ADJUSTMENT' && (
                                <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                  Adjustment
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">
                              {entry.referenceId}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate" title={entry.description}>
                              {entry.description}
                              {entry.collectedBy && (
                                <span className="block text-[10px] text-slate-400">By {entry.collectedBy}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50/50">
                              {formatCurrency(entry.runningBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: LOYALTY POINTS & REWARDS                           */}
          {/* ========================================================= */}
          {activeTab === 'loyalty' && (
            <div className="space-y-6">
              {/* Rewards Summary Card */}
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                      Loyalty Points Balance
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                    Tier Rate: 1 pt = {formatCurrency(loyaltyConfig.redemptionRatePerPoint)} Discount
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <div className="text-3xl font-black font-mono tracking-tight text-white">
                      {customer.loyaltyPoints} <span className="text-lg font-normal text-indigo-200">Pts</span>
                    </div>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Redeemable Cash Value:{' '}
                      <strong className="text-amber-300 font-mono text-sm">
                        {formatCurrency(customer.loyaltyPoints * loyaltyConfig.redemptionRatePerPoint)}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdjustPoints(!showAdjustPoints)}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold border border-white/20 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    <span>{showAdjustPoints ? 'Close Adjustment' : 'Manual Point Adjust'}</span>
                  </button>
                </div>

                {/* Loyalty Rules Footer */}
                <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-indigo-200">
                  <div>
                    <strong>Earn Rule:</strong> 1 Pt per {formatCurrency(loyaltyConfig.currencySpentPerPoint)} spent
                  </div>
                  <div>
                    <strong>Min to Redeem:</strong> {loyaltyConfig.minimumPointsToRedeem} Pts ({formatCurrency(loyaltyConfig.minimumPointsToRedeem * loyaltyConfig.redemptionRatePerPoint)})
                  </div>
                  <div>
                    <strong>Max Order Offset:</strong> {loyaltyConfig.maxRedemptionPercentagePerOrder}% of subtotal
                  </div>
                </div>
              </div>

              {/* Manual Point Adjustment Drawer */}
              {showAdjustPoints && (
                <form onSubmit={handleAdjustPoints} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3 animate-in fade-in duration-150">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Supervisor Loyalty Point Adjustment</span>
                  </h4>

                  {adjustError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold">
                      {adjustError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Adjustment Action</label>
                      <select
                        value={adjustType}
                        onChange={(e) => setAdjustType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                      >
                        <option value="adjusted">Credit Bonus Points (+)</option>
                        <option value="expired">Deduct Expired Points (-)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Points Amount</label>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 50"
                        value={adjustPointsDelta}
                        onChange={(e) => setAdjustPointsDelta(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Audit Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. Birthday gift, Promotion"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdjustPoints(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      Commit Adjustment
                    </button>
                  </div>
                </form>
              )}

              {/* Loyalty History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Loyalty Movement History</h4>
                {loyaltyHistory.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
                    No points transactions logged yet. Points are automatically credited upon POS checkout.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 font-sans">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Points Delta</th>
                          <th className="py-2.5 px-3 text-right">Cash Value</th>
                          <th className="py-2.5 px-3 text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {loyaltyHistory.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                              {tx.date} <span className="text-slate-400 text-[10px]">{tx.timestamp}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                              {tx.type === 'earned' && (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                                  Earned
                                </span>
                              )}
                              {tx.type === 'redeemed' && (
                                <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">
                                  Redeemed
                                </span>
                              )}
                              {tx.type === 'expired' && (
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">
                                  Expired
                                </span>
                              )}
                              {tx.type === 'adjusted' && (
                                <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                  Adjusted
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {tx.points > 0 ? `+${tx.points}` : tx.points}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {tx.monetaryEquivalent ? formatCurrency(tx.monetaryEquivalent) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50/50">
                              {tx.balanceAfter} Pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Customer ID: <strong className="font-mono text-slate-700">{customer.id}</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold cursor-pointer transition shadow-2xs"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
