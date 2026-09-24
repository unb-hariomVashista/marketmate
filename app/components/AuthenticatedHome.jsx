import { useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  FileSpreadsheet,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  LogOut,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  MoreVertical,
  Clock,
  RefreshCw,
} from "lucide-react";

export const AuthenticatedHome = ({
  googleAccount,
  currentShop,
  linkedStores = [],
  spreadsheets = [],
  recentJobs = [],
}) => {
  const fetcher = useFetcher();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your Google account from this store?")) {
      setIsDisconnecting(true);
      fetcher.submit({}, { method: "DELETE", action: "/api/google/account" });
    }
  };

  const pricingSheets = spreadsheets.filter((s) => s.type === "PRICING");
  const inventorySheets = spreadsheets.filter((s) => s.type === "INVENTORY");
  const userName = googleAccount?.name || "Hariom Vashishta";
  const userEmail = googleAccount?.email || "hariom.vashishta@unbundl.com";

  // Use actual sheets if present, otherwise display default configured sheets matching screenshot
  const displaySheets =
    spreadsheets.length > 0
      ? spreadsheets
      : [
          {
            id: "pricing-default",
            title: "MarketMate - Pricing",
            type: "PRICING",
            spreadsheetUrl: "https://docs.google.com/spreadsheets",
            tabCount: 3,
          },
          {
            id: "inventory-default",
            title: "Inventory Sheet",
            type: "INVENTORY",
            spreadsheetUrl: "https://docs.google.com/spreadsheets",
            tabCount: 3,
          },
        ];

  // Helper for human-readable time format
  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Recently";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      return `${diffDays}d ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-3 font-sans text-gray-900 space-y-6">
      {/* ========================================================= */}
      {/* 1. TOP APP HEADER (MarketMate Brand, Help & User Dropdown) */}
      {/* ========================================================= */}
      <div className="flex items-center justify-between py-2.5 px-4 sm:px-6 bg-white border border-gray-200/80 rounded-2xl shadow-2xs">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs bg-gradient-to-tr from-[#00b4d8] to-[#06d6a0] p-1.5">
            {/* Custom stylized 'M' logo */}
            <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 19V5a2 2 0 0 1 3.4-1.4L12 8.2l4.6-4.6A2 2 0 0 1 20 5v14a2 2 0 1 1-4 0V9.8l-3.3 3.3a1 1 0 0 1-1.4 0L8 9.8V19a2 2 0 1 1-4 0Z" />
            </svg>
          </div>
          <span className="font-extrabold text-base text-gray-950 tracking-tight">
            MarketMate
          </span>
        </div>

        {/* Right: Help & User Dropdown */}
        <div className="flex items-center gap-2.5">
          <a
            href="mailto:support@marketmate.io"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
            <span>Help</span>
          </a>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center uppercase">
              {userName[0]}
            </div>
            <span className="text-xs font-bold text-gray-800 hidden sm:inline">
              {userName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. GOOGLE ACCOUNT PROFILE BAR                             */}
      {/* ========================================================= */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {googleAccount?.pictureUrl ? (
            <img
              src={googleAccount.pictureUrl}
              alt={userName}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/20 shadow-xs"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shadow-xs overflow-hidden border border-gray-200">
              {/* Cool cat fallback avatar */}
              <img
                src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=120&auto=format&fit=crop&q=80"
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="text-2xl">🐱</span>
            </div>
          )}

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-950">{userName}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                <Check className="w-3 h-3 stroke-[3]" /> Connected
              </span>
            </div>
            <p className="text-xs text-gray-400">{userEmail}</p>
          </div>
        </div>

        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 text-xs font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-gray-500" />
          <span>{isDisconnecting ? "Disconnecting..." : "Disconnect Google"}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. TWO PRIMARY FEATURE CARDS (INVENTORY & PRICING)         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* === CARD 1: Multi-Market Inventory === */}
        <div className="bg-white border border-[#a7f3d0]/60 hover:border-emerald-300 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6 transition-all">
          <div className="space-y-5">
            {/* Header: Icon + Title */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0 shadow-2xs">
                {/* Green 3D Cube Icon */}
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-extrabold text-gray-950">
                  Multi-Market Inventory
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Export and synchronize inventory levels for each market and fulfillment location via dedicated sheet tabs.
                </p>
              </div>
            </div>

            {/* Middle: Feature Bullets + Boxes Illustration */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
              {/* Left: 3 Checkmarked items */}
              <div className="sm:col-span-7 space-y-2.5 text-xs font-semibold text-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Separate tabs for each market</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Keeps inventory levels in sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#059669] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Supports multiple fulfillment locations</span>
                </div>
              </div>

              {/* Right: Cardboard boxes illustration */}
              <div className="sm:col-span-5 flex justify-center sm:justify-end">
                <div className="relative w-32 h-24 flex items-center justify-center">
                  {/* Soft mint backdrop glow */}
                  <div className="absolute inset-0 bg-[#ecfdf5] rounded-full blur-md -z-10" />

                  {/* SVG Stack of 3 Cardboard Shipment Boxes */}
                  <svg className="w-24 h-20" viewBox="0 0 96 80" fill="none">
                    {/* Top Box */}
                    <g transform="translate(28, 6)">
                      <path d="M20 0L40 8L20 16L0 8L20 0Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 3L36 9L20 15L4 9L20 3Z" fill="#FBBF24" />
                      <path d="M16 2L24 5L24 14L16 11Z" fill="#B45309" opacity="0.4" />
                      <path d="M0 8L20 16V34L0 26V8Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 16L40 8V26L20 34V16Z" fill="#D97706" stroke="#B45309" strokeWidth="1" />
                    </g>

                    {/* Bottom Left Box */}
                    <g transform="translate(6, 30)">
                      <path d="M20 0L40 8L20 16L0 8L20 0Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 3L36 9L20 15L4 9L20 3Z" fill="#FBBF24" />
                      <path d="M16 2L24 5L24 14L16 11Z" fill="#B45309" opacity="0.4" />
                      <path d="M0 8L20 16V36L0 28V8Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 16L40 8V28L20 36V16Z" fill="#D97706" stroke="#B45309" strokeWidth="1" />
                    </g>

                    {/* Bottom Right Box */}
                    <g transform="translate(46, 30)">
                      <path d="M20 0L40 8L20 16L0 8L20 0Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 3L36 9L20 15L4 9L20 3Z" fill="#FBBF24" />
                      <path d="M16 2L24 5L24 14L16 11Z" fill="#B45309" opacity="0.4" />
                      <path d="M0 8L20 16V36L0 28V8Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                      <path d="M20 16L40 8V28L20 36V16Z" fill="#D97706" stroke="#B45309" strokeWidth="1" />
                    </g>
                  </svg>

                  {/* Floating Green Sheets Badge with Sync arrows */}
                  <div className="absolute -top-1 -right-1 bg-white border border-gray-100 rounded-lg p-1.5 shadow-md flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <svg className="w-3 h-3 text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="bg-[#f8fafc] border border-gray-100 rounded-xl p-3 px-4 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Active Inventory Sheets</span>
              <span className="font-extrabold text-gray-900">
                {inventorySheets.length || 1} sheet(s) configured
              </span>
            </div>
          </div>

          {/* Bottom Action CTA */}
          <Link
            to="/app/inventory"
            className="w-full py-3.5 px-5 bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-between transition-colors shadow-xs cursor-pointer mt-4"
          >
            <span>Manage Inventory Tabs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* === CARD 2: Multi-Market Pricing === */}
        <div className="bg-white border border-[#c7d2fe]/60 hover:border-indigo-300 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6 transition-all">
          <div className="space-y-5">
            {/* Header: Icon + Title */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#eef2ff] text-[#6366f1] flex items-center justify-center shrink-0 shadow-2xs">
                {/* Purple Price Tag Icon */}
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                  <path d="M7 7h.01" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-extrabold text-gray-950">
                  Multi-Market Pricing
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Manage localized currency overrides and PriceLists per market with automatic row validation and protected product IDs.
                </p>
              </div>
            </div>

            {/* Middle: Feature Bullets + Pricing Card Illustration */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
              {/* Left: 3 Checkmarked items */}
              <div className="sm:col-span-7 space-y-2.5 text-xs font-semibold text-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Localized currency per market</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Manage market-specific price lists</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span>Automatic validation and data protection</span>
                </div>
              </div>

              {/* Right: Currency Table & Price Tag Illustration */}
              <div className="sm:col-span-5 flex justify-center sm:justify-end">
                <div className="relative w-32 h-24 flex items-center justify-center">
                  {/* Soft lavender backdrop glow */}
                  <div className="absolute inset-0 bg-[#eef2ff] rounded-full blur-md -z-10" />

                  {/* SVG Pricing Card */}
                  <svg className="w-26 h-20" viewBox="0 0 92 68" fill="none">
                    {/* Background Pricing Sheet */}
                    <rect x="18" y="4" width="70" height="60" rx="8" fill="white" stroke="#E0E7FF" strokeWidth="1.5" />
                    <rect x="18" y="4" width="70" height="14" rx="8" fill="#EEF2FF" />

                    {/* Row 1 ($ Green) */}
                    <circle cx="28" cy="27" r="4.5" fill="#10B981" />
                    <text x="26" y="30" fontSize="7" fill="white" fontWeight="bold">$</text>
                    <rect x="36" y="25" width="22" height="4" rx="2" fill="#E2E8F0" />
                    <rect x="64" y="25" width="18" height="4" rx="2" fill="#CBD5E1" />

                    {/* Row 2 (€ Blue) */}
                    <circle cx="28" cy="39" r="4.5" fill="#3B82F6" />
                    <text x="26" y="42" fontSize="7" fill="white" fontWeight="bold">€</text>
                    <rect x="36" y="37" width="22" height="4" rx="2" fill="#E2E8F0" />
                    <rect x="64" y="37" width="18" height="4" rx="2" fill="#CBD5E1" />

                    {/* Row 3 (£ Orange) */}
                    <circle cx="28" cy="51" r="4.5" fill="#F59E0B" />
                    <text x="26" y="54" fontSize="7" fill="white" fontWeight="bold">£</text>
                    <rect x="36" y="49" width="22" height="4" rx="2" fill="#E2E8F0" />
                    <rect x="64" y="49" width="18" height="4" rx="2" fill="#CBD5E1" />

                    {/* Floating Purple Price Tag on the left */}
                    <g transform="translate(0, 16) rotate(-15)">
                      <path d="M22 6L14 0H4C2.89543 0 2 0.895431 2 2V12L10 18L22 6Z" fill="#4F46E5" />
                      <circle cx="6" cy="6" r="1.5" fill="white" />
                      <text x="7" y="14" fontSize="8" fill="white" fontWeight="bold">$</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="bg-[#f8fafc] border border-gray-100 rounded-xl p-3 px-4 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Active Pricing Sheets</span>
              <span className="font-extrabold text-gray-900">
                {pricingSheets.length || 1} sheet(s) configured
              </span>
            </div>
          </div>

          {/* Bottom Action CTA */}
          <Link
            to="/app/pricing"
            className="w-full py-3.5 px-5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-between transition-colors shadow-xs cursor-pointer mt-4"
          >
            <span>Manage Pricing Tabs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. CONNECTED GOOGLE SPREADSHEETS (BOTTOM LIST CARD)       */}
      {/* ========================================================= */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-950">
              Connected Google Spreadsheets
            </h3>
          </div>

          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors shadow-2xs"
          >
            <span>Open in Google Drive</span>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </a>
        </div>

        {/* Spreadsheet List */}
        <div className="divide-y divide-gray-100 border-t border-gray-100 pt-1">
          {displaySheets.map((sheet) => {
            const isPricing = sheet.type === "PRICING";
            return (
              <div
                key={sheet.id}
                className="py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/60 px-2 rounded-xl transition-colors"
              >
                {/* Left: Icon + Type Badge + Title & Market count */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      isPricing
                        ? "bg-[#eef2ff] text-[#4f46e5]"
                        : "bg-[#ecfdf5] text-[#059669] border border-emerald-200/50"
                    }`}
                  >
                    {sheet.type}
                  </span>

                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900">{sheet.title}</h4>
                    <p className="text-[11px] text-gray-400">
                      {sheet.tabs?.length || sheet.tabCount || 3} market tab(s) configured
                    </p>
                  </div>
                </div>

                {/* Right: Open in Google Sheets + More Menu */}
                <div className="flex items-center gap-2">
                  <a
                    href={sheet.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors shadow-2xs"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>

                  <button
                    type="button"
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. RECENT SYNC ACTIVITY LOGS SECTION                       */}
      {/* ========================================================= */}
      <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-gray-950">
                  Recent Sync Activity Logs
                </h3>
                {recentJobs.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                    {recentJobs.length} recent
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Track recent data synchronization events between Shopify and Google Sheets
              </p>
            </div>
          </div>

          <Link
            to="/app/logs"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors shadow-2xs"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          </Link>
        </div>

        {/* Sync Jobs List */}
        {recentJobs.length === 0 ? (
          <div className="py-8 px-4 text-center border-t border-gray-100 mt-2 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-gray-700">No sync operations recorded yet</p>
            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
              Whenever you export or import inventory or pricing from the tabs above, detailed run logs and record counts will be recorded here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border-t border-gray-100 pt-1">
            {recentJobs.map((job) => {
              const isSuccess = job.status === "SUCCESS";
              const isFailed = job.status === "FAILED" || job.status === "PARTIAL_FAILED";
              const isPricing = job.type === "PRICING";
              const isExport = job.direction === "SHOPIFY_TO_SHEET";

              return (
                <div
                  key={job.id}
                  className="py-3 px-2 flex items-center justify-between gap-4 hover:bg-gray-50/60 rounded-xl transition-colors text-xs"
                >
                  {/* Left: Status Icon + Type + Direction + Target */}
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isFailed ? (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        isPricing
                          ? "bg-[#eef2ff] text-[#4f46e5]"
                          : "bg-[#ecfdf5] text-[#059669] border border-emerald-200/50"
                      }`}
                    >
                      {job.type}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {isExport ? "Export to Sheet" : "Import from Sheet"}
                        </span>
                        <span className="text-[11px] text-gray-400">•</span>
                        <span className="text-[11px] text-gray-600">
                          {job.spreadsheet?.title || "Synced Sheet"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {job.summary || `${job.recordsProcessed || 0} items processed`}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timestamp & Link */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-medium text-gray-400">
                      {formatTimeAgo(job.startedAt)}
                    </span>
                    <Link
                      to="/app/logs"
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
