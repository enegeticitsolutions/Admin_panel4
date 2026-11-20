import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Search,
  Calendar,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  Receipt,
  Percent,
  IndianRupee,
  Eye,
  FileDown,
  Building,
} from 'lucide-react';
import { invoicesApi, creditNotesApi, InvoiceSummary } from '../../services/api';
import { InvoiceViewModal } from '../components/InvoiceViewModal';
import { CreditNoteViewModal } from '../components/modals/CreditNoteViewModal';
import { IssueCreditNoteModal } from '../components/modals/IssueCreditNoteModal';
import { InvoiceRefundBadge } from '../components/invoices/InvoiceCreditNoteSection';
import { toast } from 'sonner';

type PeriodPreset = 'today' | 'week' | 'month' | 'last_month' | 'fy' | 'all' | 'custom';

export const InvoicesPage: React.FC = () => {
  // Period filter state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'invoices' | 'credit_notes'>('invoices');

  // Search & Status filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Invoices data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);

  // Credit notes data
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [cnPage, setCnPage] = useState(1);
  const [cnTotalPages, setCnTotalPages] = useState(1);
  const [cnTotalCount, setCnTotalCount] = useState(0);

  // Summary KPIs
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);

  // Modals state
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewCnId, setViewCnId] = useState<string | null>(null);
  const [issueCnInvoiceId, setIssueCnInvoiceId] = useState<string | null>(null);

  // Calculate Start & End Date based on periodPreset
  const getDateRange = useCallback((): { startDate?: string; endDate?: string } => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (periodPreset === 'today') {
      const ymd = toYMD(now);
      return { startDate: ymd, endDate: ymd };
    }
    if (periodPreset === 'week') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: toYMD(past), endDate: toYMD(now) };
    }
    if (periodPreset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toYMD(startOfMonth), endDate: toYMD(now) };
    }
    if (periodPreset === 'last_month') {
      const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLast = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: toYMD(startOfLast), endDate: toYMD(endOfLast) };
    }
    if (periodPreset === 'fy') {
      // Indian Financial Year: April 1 to March 31
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const fyStartYear = curMonth >= 3 ? curYear : curYear - 1;
      const startOfFY = new Date(fyStartYear, 3, 1);
      return { startDate: toYMD(startOfFY), endDate: toYMD(now) };
    }
    if (periodPreset === 'custom') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return {};
  }, [periodPreset, customStartDate, customEndDate]);

  // Fetch Summary
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const { startDate, endDate } = getDateRange();
      const res = await invoicesApi.getInvoiceSummary({
        startDate,
        endDate,
        status: statusFilter || undefined,
      });
      setSummary(res);
    } catch (err: any) {
      console.error('Failed to load invoice summary:', err);
      toast.error('Failed to load financial summary metrics');
    } finally {
      setLoadingSummary(false);
    }
  }, [getDateRange, statusFilter]);

  // Fetch Invoices Table
  const fetchInvoices = useCallback(async () => {
    setLoadingTable(true);
    try {
      const { startDate, endDate } = getDateRange();
      const res = await invoicesApi.getInvoices({
        page: invoicePage,
        limit: 15,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        startDate,
        endDate,
      });
      setInvoices(res.data || []);
      setInvoiceTotalPages(res.pagination?.totalPages || 1);
      setInvoiceTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err);
      toast.error('Failed to fetch invoices');
    } finally {
      setLoadingTable(false);
    }
  }, [getDateRange, invoicePage, search, statusFilter]);

  // Fetch Credit Notes Table
  const fetchCreditNotes = useCallback(async () => {
    setLoadingTable(true);
    try {
      const { startDate, endDate } = getDateRange();
      const res = await creditNotesApi.getCreditNotes({
        page: cnPage,
        limit: 15,
        search: search.trim() || undefined,
        startDate,
        endDate,
      });
      setCreditNotes(res.data || []);
      setCnTotalPages(res.pagination?.totalPages || 1);
      setCnTotalCount(res.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch credit notes:', err);
      toast.error('Failed to fetch credit notes');
    } finally {
      setLoadingTable(false);
    }
  }, [getDateRange, cnPage, search]);

  // Initial and reactive load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices();
    } else {
      fetchCreditNotes();
    }
  }, [activeTab, fetchInvoices, fetchCreditNotes]);

  // Download CSV Action
  const handleExportCsv = () => {
    const { startDate, endDate } = getDateRange();
    const exportUrl = invoicesApi.getExportCsvUrl({
      startDate,
      endDate,
      status: statusFilter || undefined,
      search: search.trim() || undefined,
    });
    window.open(exportUrl, '_blank');
    toast.success('Downloading statutory invoice summary CSV...');
  };

  const formatCurrency = (val?: number) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-500/10 text-orange-600 rounded-xl border border-orange-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Invoices & Financial Reports
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Review statutory tax invoices, credit notes, GST collections, and export audit statements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              fetchSummary();
              if (activeTab === 'invoices') fetchInvoices();
              else fetchCreditNotes();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh current report"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {/* ── Export Report CSV ── */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Export Report (.CSV)</span>
          </button>
        </div>
      </div>

      {/* ── Time Period Filter Bar ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>Reporting Period:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month (MTD)' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'fy', label: 'Current FY (26-27)' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriodPreset(p.id as PeriodPreset);
                  setInvoicePage(1);
                  setCnPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodPreset === p.id
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Inputs (if Custom selected) */}
        {periodPreset === 'custom' && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={() => {
                fetchSummary();
                if (activeTab === 'invoices') fetchInvoices();
                else fetchCreditNotes();
              }}
              className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 rounded-lg font-bold"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Invoiced */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Gross Invoiced</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg dark:bg-blue-950 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {loadingSummary ? '...' : formatCurrency(summary?.grossInvoiced)}
          </div>
          <div className="mt-1 text-xs text-gray-500 flex items-center justify-between">
            <span>{summary?.totalInvoices || 0} Invoices generated</span>
          </div>
        </div>

        {/* GST Collected */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Taxes Collected (GST)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-950 dark:text-emerald-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {loadingSummary ? '...' : formatCurrency(summary?.totalTax)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 space-x-1 truncate font-mono">
            <span>CGST: ₹{summary?.cgst || 0}</span>
            <span>|</span>
            <span>SGST: ₹{summary?.sgst || 0}</span>
            <span>|</span>
            <span>IGST: ₹{summary?.igst || 0}</span>
          </div>
        </div>

        {/* Total Discounts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Discounts</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-950 dark:text-amber-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {loadingSummary ? '...' : formatCurrency(summary?.totalDiscounts)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <span>Coupons & referral promos applied</span>
          </div>
        </div>

        {/* Total Credit Notes / Refunds */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Credit Notes (Refunds)</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg dark:bg-purple-950 dark:text-purple-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700 dark:text-purple-400">
            {loadingSummary ? '...' : formatCurrency(summary?.totalRefunded)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <span>{summary?.totalCreditNotes || 0} Credit Notes issued</span>
          </div>
        </div>

        {/* Net Realized Revenue */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-md shadow-orange-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-100">Net Realized</span>
            <div className="p-2 bg-white/20 text-white rounded-lg">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-white">
            {loadingSummary ? '...' : formatCurrency(summary?.netRevenue)}
          </div>
          <div className="mt-1 text-xs text-orange-100">
            <span>Gross billed minus total refunds</span>
          </div>
        </div>
      </div>

      {/* ── Main Tabbed Content ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden">
        {/* Navigation Tabs and Search/Filter Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 border-b md:border-b-0 pb-2 md:pb-0">
            <button
              onClick={() => {
                setActiveTab('invoices');
                setSearch('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'invoices'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Tax Invoices ({invoiceTotalCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('credit_notes');
                setSearch('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'credit_notes'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Credit Notes ({cnTotalCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'invoices' ? 'Search by Inv #, Name, Phone...' : 'Search by CN #, Inv #...'}
                className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 w-64 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Status Filter for Invoices */}
            {activeTab === 'invoices' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setInvoicePage(1);
                }}
                className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-700 dark:text-gray-200"
              >
                <option value="">All Statuses</option>
                <option value="PAID">PAID</option>
                <option value="DRAFT">DRAFT</option>
                <option value="VOID">VOID</option>
              </select>
            )}
          </div>
        </div>

        {/* ── Tab 1: Invoices Table ── */}
        {activeTab === 'invoices' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/40 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Place of Supply</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingTable ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">
                      No invoices found for the selected reporting period.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const formattedDate = inv.issuedAt
                      ? new Date(inv.issuedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A';

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-gray-100">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {inv.subscriber?.name || 'N/A'}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">{inv.subscriber?.phone || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">
                          {inv.beneficiary?.name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[11px] font-semibold">
                            {inv.subscription?.package?.name || inv.invoiceType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {inv.placeOfSupply || 'Haryana'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                          ₹{(inv.baseAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{(inv.taxAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                          ₹{(inv.totalAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                inv.status === 'PAID'
                                   ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                   : inv.status === 'DRAFT'
                                   ? 'bg-amber-50 text-amber-700 border-amber-200'
                                   : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              {inv.status}
                            </span>
                            <InvoiceRefundBadge creditNotes={inv.creditNotes} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Invoice Modal */}
                            <button
                              onClick={() => setViewInvoiceId(inv.id)}
                              className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Preview Statutory Invoice PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Direct Print / Save Invoice */}
                            <a
                              href={invoicesApi.getInvoiceHtmlUrl(inv.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Print / Save Invoice (PDF)"
                            >
                              <FileDown className="w-4 h-4" />
                            </a>

                            {/* Issue Credit Note / Refund */}
                            <button
                              onClick={() => setIssueCnInvoiceId(inv.id)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Issue Credit Note / Refund"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {invoiceTotalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {invoicePage} of {invoiceTotalPages} ({invoiceTotalCount} total invoices)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={invoicePage <= 1}
                    onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={invoicePage >= invoiceTotalPages}
                    onClick={() => setInvoicePage((p) => Math.min(invoiceTotalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Credit Notes Table ── */}
        {activeTab === 'credit_notes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/40 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4">Credit Note #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Original Invoice</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Refund Mode</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Tax Reversed</th>
                  <th className="py-3 px-4 text-right">Refund Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingTable ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">
                      Loading credit notes...
                    </td>
                  </tr>
                ) : creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400">
                      No credit notes found for this reporting period.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((cn) => {
                    const formattedDate = cn.issuedAt
                      ? new Date(cn.issuedAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A';

                    return (
                      <tr key={cn.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-700 dark:text-purple-400">
                          {cn.creditNoteNumber}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-gray-700 dark:text-gray-300">
                          {cn.originalInvoiceNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{cn.subscriber?.name || 'N/A'}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{cn.subscriber?.phone || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">
                          {cn.beneficiary?.name || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              cn.refundMode === 'GATEWAY_ONLINE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {cn.refundMode === 'GATEWAY_ONLINE' ? 'Razorpay Online' : 'Bank UTR'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={cn.reason}>
                          {cn.reason || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-purple-600 dark:text-purple-400">
                          ₹{(cn.taxAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-purple-700 dark:text-purple-300">
                          ₹{(cn.totalAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                              cn.status === 'ISSUED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {cn.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setViewCnId(cn.id)}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Preview Credit Note"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {cnTotalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {cnPage} of {cnTotalPages} ({cnTotalCount} total credit notes)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={cnPage <= 1}
                    onClick={() => setCnPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={cnPage >= cnTotalPages}
                    onClick={() => setCnPage((p) => Math.min(cnTotalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {/* 1. View Invoice PDF Modal */}
      <InvoiceViewModal
        isOpen={Boolean(viewInvoiceId)}
        invoiceId={viewInvoiceId}
        onClose={() => setViewInvoiceId(null)}
      />

      {/* 2. View Credit Note PDF/HTML Modal */}
      <CreditNoteViewModal
        isOpen={Boolean(viewCnId)}
        creditNoteId={viewCnId}
        onClose={() => setViewCnId(null)}
      />

      {/* 3. Issue Credit Note / Refund Modal */}
      <IssueCreditNoteModal
        isOpen={Boolean(issueCnInvoiceId)}
        invoiceId={issueCnInvoiceId}
        onClose={() => setIssueCnInvoiceId(null)}
        onSuccess={() => {
          setIssueCnInvoiceId(null);
          fetchSummary();
          fetchInvoices();
        }}
      />
    </div>
  );
};

export default InvoicesPage;
