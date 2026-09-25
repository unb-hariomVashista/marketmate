import {
  Tag,
  Boxes,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Globe,
  Building2,
  Zap,
  ArrowLeftRight,
  Database,
  Store,
} from "lucide-react";

export const UnauthenticatedHome = ({ signInHandler }) => {
  const WORKFLOW_STEPS = [
    {
      step: "01",
      title: "Connect Google Account",
      description:
        "Link your Google Drive in one click with secure, minimal drive.file permissions.",
      badge: "Fast & Secure",
      icon: <Building2 className="w-5 h-5 text-emerald-700" />,
      accentBg: "bg-emerald-50",
      accentBorder: "border-emerald-200/70",
    },
    {
      step: "02",
      title: "Organize Locations & Markets",
      description:
        "Auto-generate dedicated sheet tabs for fulfillment warehouses and localized market prices.",
      badge: "Multi-Market",
      icon: <Layers className="w-5 h-5 text-indigo-700" />,
      accentBg: "bg-indigo-50",
      accentBorder: "border-indigo-200/70",
    },
    {
      step: "03",
      title: "Bi-Directional Sync & Diffing",
      description:
        "Edit quantities and prices in Google Sheets, review change diffs, and sync safely back to Shopify.",
      badge: "2-Way Sync",
      icon: <ArrowLeftRight className="w-5 h-5 text-amber-700" />,
      accentBg: "bg-amber-50",
      accentBorder: "border-amber-200/70",
    },
  ];

  const CORE_FEATURES = [
    {
      icon: <Tag className="w-5 h-5 text-indigo-600" />,
      iconBg: "bg-indigo-50 border-indigo-200/60",
      title: "Localized Market Pricing",
      description:
        "Set country-specific price overrides and manage localized currencies effortlessly per international market.",
      tag: "Pricing Lists",
    },
    {
      icon: <Boxes className="w-5 h-5 text-emerald-600" />,
      iconBg: "bg-emerald-50 border-emerald-200/60",
      title: "Warehouse Inventory Sync",
      description:
        "Track stock levels independently across all your fulfillment centers, retail stores, and global locations.",
      tag: "Fulfillment",
    },
    {
      icon: <Sparkles className="w-5 h-5 text-violet-600" />,
      iconBg: "bg-violet-50 border-violet-200/60",
      title: "Cross-Store SKU Matching",
      description:
        "Share a single Google Sheet across multiple Shopify stores and map rows automatically by SKU.",
      tag: "SKU Matching",
    },
    {
      icon: <Lock className="w-5 h-5 text-blue-600" />,
      iconBg: "bg-blue-50 border-blue-200/60",
      title: "Safe Column Protection",
      description:
        "Shopify Variant IDs are automatically locked against accidental edits while quantities remain free to modify.",
      tag: "Protected Ranges",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-3 font-sans text-gray-900 space-y-8">
      {/* ========================================================= */}
      {/* 1. HERO SECTION                                           */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-10 shadow-xs">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Heading & Connect CTA */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Shopify Multi-Market & Google Sheets Sync</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-950 tracking-tight leading-[1.2]">
                Synchronize Your Store Inventory & Pricing with{" "}
                <span className="text-emerald-700">Google Sheets</span>
              </h1>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-xl">
                Manage fulfillment warehouse quantities and localized market
                prices from the comfort of spreadsheets. Real-time bi-directional
                sync, smart cross-store SKU matching, and safe row diffing.
              </p>
            </div>

            {/* Connect Button */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={signInHandler}
                className="group inline-flex items-center gap-3.5 px-6 py-3.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-900 rounded-2xl font-bold text-sm shadow-sm hover:shadow transition-all transform hover:-translate-y-0.5 cursor-pointer active:translate-y-0"
              >
                {/* Official Google G Logo */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Connect with Google</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
              </button>

              {/* Privacy / Security Notice */}
              <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Granular Google Drive access. We only access sheets you connect or create.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Interactive Graphic */}
          <div className="lg:col-span-5">
            <div className="relative bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] border border-gray-200/90 rounded-2xl p-5 shadow-inner space-y-4">
              {/* Header inside mockup */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Live Sync Simulation
                </span>
              </div>

              {/* Sync Diagram */}
              <div className="flex items-center justify-between gap-3 py-2">
                {/* Shopify Node */}
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 shadow-2xs text-center space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                    <Store className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-gray-900">Shopify Store</p>
                  <p className="text-[10px] text-gray-400">Inventory & Markets</p>
                </div>

                {/* Animated Arrow Connector */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] font-extrabold text-emerald-700 uppercase">
                    2-Way
                  </span>
                </div>

                {/* Google Sheet Node */}
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 shadow-2xs text-center space-y-1">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-gray-900">Google Sheet</p>
                  <p className="text-[10px] text-gray-400">Dedicated Tabs</p>
                </div>
              </div>

              {/* Sample Tab Preview Cards */}
              <div className="space-y-2 pt-1">
                <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-bold text-gray-900 text-xs">
                        Inventory Tab
                      </p>
                      <p className="text-[11px] text-gray-400">
                        1,000 variants • Warehouse Sync
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <div>
                      <p className="font-bold text-gray-900 text-xs">
                        Pricing Tab
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Multi-Currency • Price Lists
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                    Localized
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. HOW IT WORKS (3 SIMPLE STEPS)                           */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-950">
            How MarketMate Works
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Three simple steps to connect and synchronize your catalog.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.step}
              className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-xl ${step.accentBg} border ${step.accentBorder} flex items-center justify-center`}
                  >
                    {step.icon}
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-300">
                    STEP {step.step}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="inline-block text-[11px] font-bold text-gray-600">
                  {step.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CORE FEATURES GRID                                     */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-950">
            Powerful Features for Modern Shopify Stores
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Built for multi-location merchants scaling across international borders.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CORE_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between hover:border-gray-300 transition-colors"
            >
              <div className="space-y-3">
                <div
                  className={`w-10 h-10 rounded-xl ${feature.iconBg} border flex items-center justify-center`}
                >
                  {feature.icon}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  {feature.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. SECURITY & PERMISSIONS CALLOUT                         */}
      {/* ========================================================= */}
      <div className="bg-[#f8fafc] border border-gray-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-950">
              Enterprise Data Security & Strict Privacy
            </h4>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">
              MarketMate uses Google OAuth 2.0 with minimal scopes (
              <code className="text-[11px] font-mono bg-gray-200/80 px-1 py-0.5 rounded text-gray-800">
                drive.file
              </code>
              ). We cannot see, modify, or read your personal files or unselected documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Scopes
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. BOTTOM CTA BANNER                                      */}
      {/* ========================================================= */}
      <div className="bg-[#044e3d] text-white rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Ready to streamline your multi-market catalog?
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Connect your Google account in 30 seconds and start synchronizing your
            pricing and warehouse stock in real-time.
          </p>
        </div>

        <button
          type="button"
          onClick={signInHandler}
          className="inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-white hover:bg-gray-50 text-gray-950 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <span>Get Started Now</span>
          <ArrowRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default UnauthenticatedHome;