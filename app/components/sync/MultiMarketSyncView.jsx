import { useState, useMemo } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Check,
  CheckCircle2,
  HelpCircle,
  Globe,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
  Store,
  Info,
  Layers,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

export function MultiMarketSyncView({
  type = "INVENTORY", // "INVENTORY" or "PRICING"
  connected = false,
  googleAccount = null,
  spreadsheets = [],
  markets = [],
  locations = [],
  shop = null,
  currentShop = "",
  googleOauthUrl = null,
  storePlan = null,
  planAccess = null,
}) {
  const shopify = useAppBridge();

  const isInventory = type === "INVENTORY";
  const items = isInventory ? locations : markets;
  const itemPluralLabel = isInventory ? "Warehouses / Locations" : "Markets";
  const itemSingularLabel = isInventory ? "Warehouse / Location" : "Market";
  const shopName =
    shop?.name || currentShop.replace(".myshopify.com", "") || "Store";

  // Direction State: "SHOPIFY_TO_SHEET" (Sync from store to sheet) or "SHEET_TO_SHOPIFY" (Sync from sheet to store)
  const [activeDirection, setActiveDirection] = useState("SHOPIFY_TO_SHEET");
  const [selectedSheetId, setSelectedSheetId] = useState(
    spreadsheets.length > 0 ? spreadsheets[0].id : "",
  );
  const [selectedItemIds, setSelectedItemIds] = useState(
    items.length > 0 ? [items[0].id] : [],
  );

  // Stepper State
  const [currentStep, setCurrentStep] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sourceTabsByItemId, setSourceTabsByItemId] = useState({});

  const setSourceTabForItem = (itemId, tabTitle) => {
    setSourceTabsByItemId((prev) => ({
      ...prev,
      [itemId]: tabTitle,
    }));
  };

  // Modals & Sheet Creation
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(
    spreadsheets.length === 0,
  );
  const [newSheetTitle, setNewSheetTitle] = useState(
    `${shopName} - ${isInventory ? "Inventory" : "Pricing"}`,
  );
  const [isSubmittingSheet, setIsSubmittingSheet] = useState(false);

  // Preview & Sync Execution State
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const activeSheet =
    spreadsheets.find((s) => s.id === selectedSheetId) ||
    (spreadsheets.length > 0 ? spreadsheets[0] : null);

  // Handle Google OAuth Connect
  const handleConnectGoogle = () => {
    if (googleOauthUrl) {
      window.top.location.href = googleOauthUrl;
    } else {
      window.location.href = "/app";
    }
  };

  // Toggle Item Selection
  const toggleItem = (itemId) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  };

  const selectAllItems = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((it) => it.id));
    }
  };

  // Create New Sheet
  const handleCreateNewSheet = async (e) => {
    e.preventDefault();
    if (!newSheetTitle.trim()) return;

    setIsSubmittingSheet(true);
    try {
      const response = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSheetTitle.trim(),
          type,
        }),
      });

      const res = await response.json();
      if (!response.ok) {
        shopify.toast.show(res.error || "Failed to create sheet", {
          isError: true,
        });
      } else {
        shopify.toast.show("Google Sheet created successfully!");
        window.location.reload();
      }
    } catch (err) {
      shopify.toast.show("Network error creating sheet", { isError: true });
    } finally {
      setIsSubmittingSheet(false);
      setIsCreatingSheet(false);
      setIsSheetModalOpen(false);
    }
  };

  // Proceed to Step 2
  const handleProceedToStep2 = async () => {
    if (selectedItemIds.length === 0) {
      shopify.toast.show(
        `Please select at least one ${itemSingularLabel.toLowerCase()}.`,
        { isError: true },
      );
      return;
    }

    if (activeDirection === "SHOPIFY_TO_SHEET") {
      setPreviewSummary({
        direction: "SHOPIFY_TO_SHEET",
        itemCount: selectedItemIds.length,
        items: items.filter((it) => selectedItemIds.includes(it.id)),
      });
      setCurrentStep(2);
      return;
    }

    // For Sheet -> Store, fetch diff preview for the first selected item
    setIsLoadingPreview(true);
    setCurrentStep(2);

    try {
      const targetItem =
        items.find((it) => it.id === selectedItemIds[0]) || items[0];
      const targetSourceTab = sourceTabsByItemId[targetItem?.id] || undefined;
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: isInventory ? "PREVIEW_INVENTORY" : "PREVIEW_PRICING",
          spreadsheetId: selectedSheetId,
          sourceTabTitle: targetSourceTab,
          ...(isInventory
            ? { locationId: targetItem.id }
            : { marketId: targetItem.id }),
        }),
      });

      const data = await res.json();
      if (res.ok && data.preview) {
        setPreviewRows(data.preview.rows || []);
        setPreviewSummary(data.preview.summary || null);
      } else {
        setPreviewRows([]);
        setPreviewSummary({
          info: `Ready to sync ${selectedItemIds.length} ${itemPluralLabel.toLowerCase()}.`,
        });
      }
    } catch (err) {
      console.warn("Preview load error:", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Execute Final Sync (Step 3)
  const handleExecuteSync = async () => {
    setIsSyncing(true);
    setCurrentStep(3);

    const actionType =
      activeDirection === "SHOPIFY_TO_SHEET"
        ? isInventory
          ? "EXPORT_INVENTORY"
          : "EXPORT_PRICING"
        : isInventory
          ? "IMPORT_INVENTORY"
          : "IMPORT_PRICING";

    let successCount = 0;
    const errors = [];

    for (const itemId of selectedItemIds) {
      try {
        const itemSourceTab = sourceTabsByItemId[itemId] || undefined;
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionType,
            spreadsheetId: selectedSheetId,
            sourceTabTitle: itemSourceTab,
            ...(isInventory ? { locationId: itemId } : { marketId: itemId }),
          }),
        });

        const resData = await response.json();
        if (response.ok && (!resData.result?.errors || resData.result.errors.length === 0)) {
          successCount++;
        } else {
          const errMsg =
            resData.error ||
            (resData.result?.errors && resData.result.errors.length > 0
              ? resData.result.errors.join("; ")
              : `Sync failed for ${itemSingularLabel}`);
          errors.push(errMsg);
        }
      } catch (err) {
        errors.push(err.message);
      }
    }

    setIsSyncing(false);
    setSyncResult({
      success: errors.length === 0,
      successCount,
      totalCount: selectedItemIds.length,
      errors,
    });

    if (errors.length === 0) {
      shopify.toast.show(
        activeDirection === "SHOPIFY_TO_SHEET"
          ? "Successfully exported to Google Sheet!"
          : "Successfully synced back to Shopify store!",
      );
    } else {
      shopify.toast.show("Sync finished with warnings/errors", {
        isError: true,
      });
    }
  };

  // Format last synced timestamp
  const formattedLastSync = useMemo(() => {
    if (!activeSheet?.updatedAt) return "Never";
    return new Date(activeSheet.updatedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [activeSheet]);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 font-sans text-gray-900 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-2">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">
              Multi-market sync
            </h1>
            {storePlan?.plan === "PRO" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Pro Plan ($22/mo) • Unlimited
              </span>
            ) : storePlan?.plan === "STANDARD" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                Standard Plan ($11/mo) • {isInventory ? `${locations.length}/3 Locations` : `${markets.length}/3 Markets`}
              </span>
            ) : (
              <a
                href={`/app/plans?returnTo=${encodeURIComponent(isInventory ? "/app/inventory" : "/app/pricing")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> No Active Plan (Select $11 or $22)
              </a>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-700">
            Keep your product data in sync between your store and Google Sheets.
          </p>
          <p className="text-xs text-gray-500">
            Update inventory, pricing, and product details across multiple
            markets with ease.
          </p>
        </div>

        {/* Decorative Illustration / Image Placeholder Slot */}
        <div
          data-slot="illustration-placeholder"
          className="relative shrink-0 flex items-center justify-center px-4 py-3"
        >
          {/* Background Soft Sky/Mint Glow */}
          <div className="absolute inset-0 bg-linear-to-r from-sky-50/70 via-teal-50/60 to-emerald-50/70 rounded-3xl -z-10 blur-xs" />

          {/* Sparkle 1: Top-Right */}
          <svg
            className="w-3.5 h-3.5 text-emerald-500 absolute -top-1 right-2 animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>

          {/* Sparkle 2: Bottom-Right */}
          <svg
            className="w-2.5 h-2.5 text-teal-400 absolute -bottom-1 right-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>

          {/* Sparkle 3: Top-Left */}
          <svg
            className="w-3 h-3 text-emerald-400 absolute -top-1.5 left-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>

          {/* Sparkle 4: Bottom-Left */}
          <svg
            className="w-2.5 h-2.5 text-emerald-500 absolute -bottom-1 left-8"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>

          {/* Illustration Container */}
          <div className="flex items-center gap-3">
            {/* 1. Storefront Card */}
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100/90 shadow-sm flex items-center justify-center p-2">
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                {/* Store Roof / Awning */}
                <path d="M6 16L10 8H38L42 16H6Z" fill="#14B8A6" />
                <path
                  d="M6 16C6 18.2 7.8 20 10 20C12.2 20 14 18.2 14 16H6Z"
                  fill="#0D9488"
                />
                <path
                  d="M14 16C14 18.2 15.8 20 18 20C20.2 20 22 18.2 22 16H14Z"
                  fill="#14B8A6"
                />
                <path
                  d="M22 16C22 18.2 23.8 20 26 20C28.2 20 30 18.2 30 16H22Z"
                  fill="#0D9488"
                />
                <path
                  d="M30 16C30 18.2 31.8 20 34 20C36.2 20 38 18.2 38 16H30Z"
                  fill="#14B8A6"
                />
                <path
                  d="M38 16C38 18.2 39.8 20 42 20H42C44.2 20 44 18.2 44 16H38Z"
                  fill="#0D9488"
                />
                {/* Store Walls & Base */}
                <rect
                  x="9"
                  y="19"
                  width="30"
                  height="21"
                  rx="2"
                  fill="#38BDF8"
                  opacity="0.25"
                />
                <rect
                  x="9"
                  y="19"
                  width="30"
                  height="21"
                  rx="2"
                  stroke="#0284C7"
                  strokeWidth="2.5"
                />
                {/* Door */}
                <rect
                  x="20"
                  y="27"
                  width="8"
                  height="13"
                  rx="1"
                  fill="#0284C7"
                />
                {/* Windows */}
                <rect
                  x="12"
                  y="25"
                  width="5"
                  height="6"
                  rx="1"
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="1.5"
                />
                <rect
                  x="31"
                  y="25"
                  width="5"
                  height="6"
                  rx="1"
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="1.5"
                />
                <line
                  x1="7"
                  y1="40"
                  x2="41"
                  y2="40"
                  stroke="#0284C7"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* 2. Dotted Green Arrow */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <svg
                className="w-4 h-4 text-emerald-600 stroke-[3]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* 3. Google Sheets Document Card */}
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100/90 shadow-sm flex items-center justify-center p-2">
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                {/* Green Sheet Shape with folded corner */}
                <path
                  d="M12 8C10.8954 8 10 8.89543 10 10V38C10 39.1046 10.8954 40 12 40H36C37.1046 40 38 39.1046 38 38V18L28 8H12Z"
                  fill="#10B981"
                />
                {/* Folded Corner */}
                <path
                  d="M28 8V16C28 17.1046 28.8954 18 30 18H38L28 8Z"
                  fill="#059669"
                />
                {/* White Grid Table */}
                <rect
                  x="16"
                  y="22"
                  width="16"
                  height="12"
                  rx="1.5"
                  fill="white"
                />
                <path
                  d="M16 26H32M16 30H32M21 22V34M27 22V34"
                  stroke="#10B981"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Limitation Alert Banner */}
      {planAccess && !planAccess.allowed && (
        <div className="bg-amber-50 border-2 border-amber-400/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-950">
                {planAccess.reason === "NO_PLAN"
                  ? "Active Subscription Required"
                  : "Pro Plan ($22/mo) Required for this Store"}
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed max-w-2xl">
                {planAccess.message}
              </p>
            </div>
          </div>

          <a
            href={`/app/plans?returnTo=${encodeURIComponent(isInventory ? "/app/inventory" : "/app/pricing")}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shrink-0 shadow-xs transition-colors"
          >
            <span>{planAccess.requiredPlan === "PRO" ? "Upgrade to Pro ($22/mo)" : "Choose Plan ($11 or $22)"}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* 3. DIRECTION SELECTOR (TWO BIG CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Sync from sheet to store */}
        <div
          onClick={() => setActiveDirection("SHEET_TO_SHOPIFY")}
          className={`rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-all ${
            activeDirection === "SHEET_TO_SHOPIFY"
              ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-xs ring-4 ring-emerald-500/10"
              : "border border-gray-200 bg-white hover:border-gray-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                activeDirection === "SHEET_TO_SHOPIFY"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <ArrowDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-bold text-sm text-gray-950">
                Sync from sheet to store
              </h3>
              <p className="text-xs text-gray-500 leading-snug">
                Update product {isInventory ? "inventory" : "pricing"} in your
                store using data from Google Sheet.
              </p>
            </div>
          </div>

          {/* Radio Indicator */}
          <div className="shrink-0 pl-2">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                activeDirection === "SHEET_TO_SHOPIFY"
                  ? "border-emerald-600 bg-white"
                  : "border-gray-300 bg-transparent"
              }`}
            >
              {activeDirection === "SHEET_TO_SHOPIFY" && (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Sync from store to sheet */}
        <div
          onClick={() => setActiveDirection("SHOPIFY_TO_SHEET")}
          className={`rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-all ${
            activeDirection === "SHOPIFY_TO_SHEET"
              ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-xs ring-4 ring-emerald-500/10"
              : "border border-gray-200 bg-white hover:border-gray-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                activeDirection === "SHOPIFY_TO_SHEET"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <h3 className="font-bold text-sm text-gray-950">
                Sync from store to sheet
              </h3>
              <p className="text-xs text-gray-500 leading-snug">
                Export product{" "}
                {isInventory
                  ? "inventory levels"
                  : "pricing & currency overrides"}{" "}
                from your store to Google Sheet.
              </p>
            </div>
          </div>

          {/* Radio Indicator */}
          <div className="shrink-0 pl-2">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                activeDirection === "SHOPIFY_TO_SHEET"
                  ? "border-emerald-600 bg-white"
                  : "border-gray-300 bg-transparent"
              }`}
            >
              {activeDirection === "SHOPIFY_TO_SHEET" && (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN CARD / WHITE CANVAS (VERTICAL STEPPER + STEP CONTENT) */}
      {!connected ? (
        /* Empty State when Google is NOT connected */
        <div className="bg-white border border-gray-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-xl font-bold text-gray-950">
              Connect your Google Account
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Connect your Google account once to create and sync dedicated{" "}
              {isInventory ? "inventory" : "pricing"} tabs for all your markets
              and warehouses.
            </p>
          </div>
          <button
            onClick={handleConnectGoogle}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span>Connect with Google Sheets</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Authenticated Sync Wizard Canvas */
        <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Vertical Stepper Navigation */}
            <div className="lg:col-span-3 pr-2 lg:border-r lg:border-gray-100">
              <div className="space-y-0">
                {/* Step 1 */}
                <div
                  onClick={() => currentStep > 1 && setCurrentStep(1)}
                  className={`relative flex items-start gap-3.5 pb-8 ${
                    currentStep > 1 ? "cursor-pointer" : ""
                  }`}
                >
                  {/* Continuous Connecting Line to Step 2 */}
                  <div
                    className={`absolute w-0.5 transition-colors ${
                      currentStep > 1 ? "bg-emerald-600" : "bg-gray-200"
                    }`}
                    style={{ left: "13px", top: "28px", bottom: "-2px" }}
                  />
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      currentStep === 1
                        ? "bg-[#044e3d] text-white ring-4 ring-emerald-100"
                        : currentStep > 1
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {currentStep > 1 ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "1"}
                  </div>
                  <div className="pt-0.5">
                    <h4
                      className={`text-xs font-bold ${
                        currentStep === 1 ? "text-gray-950 font-extrabold" : "text-gray-600"
                      }`}
                    >
                      Select {itemPluralLabel.toLowerCase()}
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                      Choose the {itemPluralLabel.toLowerCase()} you want to{" "}
                      {activeDirection === "SHOPIFY_TO_SHEET"
                        ? "export"
                        : "import"}
                      .
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => currentStep > 2 && setCurrentStep(2)}
                  className={`relative flex items-start gap-3.5 pb-8 ${
                    currentStep > 2 ? "cursor-pointer" : ""
                  }`}
                >
                  {/* Continuous Connecting Line to Step 3 */}
                  <div
                    className={`absolute w-0.5 transition-colors ${
                      currentStep > 2 ? "bg-emerald-600" : "bg-gray-200"
                    }`}
                    style={{ left: "13px", top: "28px", bottom: "-2px" }}
                  />
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      currentStep === 2
                        ? "bg-[#044e3d] text-white ring-4 ring-emerald-100"
                        : currentStep > 2
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {currentStep > 2 ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "2"}
                  </div>
                  <div className="pt-0.5">
                    <h4
                      className={`text-xs font-bold ${
                        currentStep === 2 ? "text-gray-950 font-extrabold" : "text-gray-600"
                      }`}
                    >
                      Review changes
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                      Verify {itemPluralLabel.toLowerCase()} and settings before
                      syncing.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex items-start gap-3.5">
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      currentStep === 3
                        ? "bg-[#044e3d] text-white ring-4 ring-emerald-100"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    3
                  </div>
                  <div>
                    <h4
                      className={`text-xs font-bold ${
                        currentStep === 3 ? "text-gray-950 font-extrabold" : "text-gray-600"
                      }`}
                    >
                      {activeDirection === "SHOPIFY_TO_SHEET"
                        ? "Export to Google Sheet"
                        : "Sync to store"}
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                      Confirm and start{" "}
                      {activeDirection === "SHOPIFY_TO_SHEET"
                        ? "exporting"
                        : "syncing"}{" "}
                      your data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: STEP CONTENT */}
            <div className="lg:col-span-9 space-y-6">
              {/* === STEP 1: Select Markets / Warehouses === */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* Step Header */}
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-950">
                      Select {itemPluralLabel.toLowerCase()}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Choose the {itemPluralLabel.toLowerCase()} you want to{" "}
                      {activeDirection === "SHOPIFY_TO_SHEET"
                        ? "export product data from your store"
                        : "update using data from your Google Sheet"}
                      .
                    </p>
                  </div>

                  {/* 2-Column Sub-Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Left Sub-Column: Dropdown, Pills & Settings Callout */}
                    <div className="md:col-span-7 space-y-3">
                      <label className="text-xs font-bold text-gray-900 block">
                        {itemPluralLabel}
                      </label>

                      {/* Dropdown Box */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs bg-white text-left flex items-center justify-between hover:border-gray-300 font-medium cursor-pointer shadow-2xs"
                        >
                          <span className="text-gray-800">
                            {selectedItemIds.length === 0
                              ? `Select ${itemPluralLabel.toLowerCase()}`
                              : `${selectedItemIds.length} ${selectedItemIds.length === 1 ? itemSingularLabel.toLowerCase() : itemPluralLabel.toLowerCase()} selected`}
                          </span>
                          {isDropdownOpen ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-20 p-2 space-y-1 max-h-60 overflow-y-auto">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 text-xs">
                              <span className="font-semibold text-gray-600">
                                Available {itemPluralLabel}
                              </span>
                              <button
                                type="button"
                                onClick={selectAllItems}
                                className="text-emerald-700 font-bold hover:underline"
                              >
                                {selectedItemIds.length === items.length
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            </div>

                            {items.map((it) => {
                              const isChecked = selectedItemIds.includes(it.id);
                              return (
                                <label
                                  key={it.id}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer text-xs text-gray-800"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleItem(it.id)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                  />
                                  <span className="font-semibold">
                                    {it.name}
                                  </span>
                                  {!isInventory && it.currency && (
                                    <span className="text-[11px] text-gray-400">
                                      ({it.currency})
                                    </span>
                                  )}
                                  {isInventory && it.shipsInventory && (
                                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                      Fulfillment
                                    </span>
                                  )}
                                  {!isInventory && it.primary && (
                                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                      Primary
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Selected Pill Tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {items
                          .filter((it) => selectedItemIds.includes(it.id))
                          .map((it) => (
                            <span
                              key={it.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#eefbf3] text-gray-900 border border-emerald-200/80 shadow-2xs"
                            >
                              {/* Country Flag or Warehouse Icon */}
                              {isInventory ? (
                                <Store className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>
                                {it.name}{" "}
                                {!isInventory && it.currency
                                  ? `(${it.currency})`
                                  : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleItem(it.id)}
                                className="text-gray-400 hover:text-gray-700 ml-0.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                      </div>

                      {/* Cross-Store Source Tab Selector */}
                      {activeDirection === "SHEET_TO_SHOPIFY" && (
                        <div className="p-4 sm:p-5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-4 shadow-2xs mt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-700" />
                              <label className="text-xs font-bold text-gray-950">
                                Source Tabs in Google Sheet (Sync From)
                              </label>
                            </div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                              SKU Matching
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-600 leading-relaxed">
                            Configure the source Google Sheet tab to sync for each selected {itemSingularLabel.toLowerCase()}.
                            Each {itemSingularLabel.toLowerCase()} can read from its own designated tab, or cross-sync data from another store / market.
                          </p>

                          {/* Individual Option per Selected Item */}
                          <div className="space-y-2.5">
                            {items
                              .filter((it) => selectedItemIds.includes(it.id))
                              .map((item) => {
                                const currentTabVal = sourceTabsByItemId[item.id] || "";
                                return (
                                  <div
                                    key={item.id}
                                    className="bg-white border border-indigo-100/90 rounded-xl p-3 shadow-2xs space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                        <span className="text-xs font-bold text-gray-900">
                                          {item.name}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 font-semibold">
                                        Target {itemSingularLabel}
                                      </span>
                                    </div>

                                    <select
                                      value={currentTabVal}
                                      onChange={(e) =>
                                        setSourceTabForItem(item.id, e.target.value)
                                      }
                                      className="w-full text-xs font-medium bg-[#fcfdff] border border-gray-300 rounded-lg px-3 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-gray-800"
                                    >
                                      <option value="">
                                        Auto-detect ({shopName} - {item.name} {isInventory ? "Inventory" : "Pricing"})
                                      </option>
                                      {activeSheet?.tabs?.map((t) => {
                                        const cleanTitle = (t.tabTitle || "")
                                          .replace(
                                            /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1FAFF}]/gu,
                                            ""
                                          )
                                          .trim();
                                        return (
                                          <option key={t.id || t.tabTitle} value={t.tabTitle}>
                                            {cleanTitle}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                );
                              })}
                          </div>

                          <div className="flex items-start gap-2 pt-1 text-[11px] text-indigo-900 bg-white/80 rounded-xl p-2.5 border border-indigo-100">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Cross-Store SKU Matching:</strong> Rows in each source tab are mapped to this store's products by matching their <strong>SKU</strong>, even across different Shopify store IDs.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Store settings callout box */}
                      <div className="p-3.5 border border-gray-200 rounded-2xl flex items-center justify-between gap-3 bg-white mt-5 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-600 text-white flex items-center justify-center shrink-0">
                            <Info className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">
                              Need to add or edit{" "}
                              {isInventory ? "locations" : "markets"}?
                            </p>
                            <p className="text-[11px] text-gray-500">
                              You can manage your{" "}
                              {isInventory ? "locations" : "markets"} in your
                              store settings.
                            </p>
                          </div>
                        </div>

                        <a
                          href={`https://${currentShop}/admin/settings/${isInventory ? "locations" : "markets"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors shrink-0 shadow-2xs"
                        >
                          <span>Open store settings</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </a>
                      </div>
                    </div>

                    {/* Right Sub-Column: Feature Callout Card */}
                    <div className="md:col-span-5 bg-[#f0fdf4] border border-emerald-200/70 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          {isInventory ? (
                            <Store className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-gray-950">
                          Sync for multiple{" "}
                          {isInventory ? "warehouses" : "markets"}
                        </h4>
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed">
                        Select the {itemPluralLabel.toLowerCase()} you want to{" "}
                        {activeDirection === "SHOPIFY_TO_SHEET"
                          ? "export"
                          : "update"}
                        . We'll add dedicated tabs for each{" "}
                        {itemSingularLabel.toLowerCase()} inside your connected
                        Google Sheet.
                      </p>

                      <div className="pt-2 border-t border-emerald-200/60 space-y-2.5 text-xs text-gray-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Separate tab for each{" "}
                            {itemSingularLabel.toLowerCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Exports{" "}
                            {isInventory
                              ? "inventory per location"
                              : "inventory, pricing and product details"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Safe and secure row-level diffing</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connected Google Sheet Bottom Card */}
                  {!activeSheet ? (
                    <div className="p-4 border border-amber-200 bg-amber-50/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">
                            No {itemPluralLabel.toLowerCase()} spreadsheet connected
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Create or connect a Google Sheet to begin syncing with your store.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (spreadsheets.length === 0) {
                            setIsCreatingSheet(true);
                          }
                          setIsSheetModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        + Create {itemSingularLabel} Sheet
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 border border-gray-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shadow-2xs">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 text-white shadow-2xs">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">
                            Connected Google Sheet
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <a
                              href={activeSheet.spreadsheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-gray-950 hover:text-emerald-700 flex items-center gap-1 text-xs"
                            >
                              <span>{activeSheet.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            </a>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Last synced: {formattedLastSync} •{" "}
                            {googleAccount?.email}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSheetModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                        <span>Change sheet</span>
                      </button>
                    </div>
                  )}

                  {/* Continue Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    {planAccess && !planAccess.allowed ? (
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        {planAccess.message}
                      </p>
                    ) : !activeSheet ? (
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        Please connect or create a {itemSingularLabel.toLowerCase()} spreadsheet to continue.
                      </p>
                    ) : <div />}

                    <button
                      type="button"
                      onClick={handleProceedToStep2}
                      disabled={selectedItemIds.length === 0 || !activeSheet || (planAccess && !planAccess.allowed)}
                      className="px-6 py-2.5 bg-[#044e3d] hover:bg-[#033c2e] text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-end sm:self-auto"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* === STEP 2: Review changes === */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-extrabold text-gray-950">
                        Review changes
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activeDirection === "SHOPIFY_TO_SHEET"
                          ? `Verify ${itemPluralLabel.toLowerCase()} before exporting to Google Sheet.`
                          : "We'll show you a preview of the updates before syncing to your store."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                    >
                      Back to Step 1
                    </button>
                  </div>

                  {isLoadingPreview ? (
                    <div className="py-12 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="font-semibold text-gray-700">
                        Reading sheet data and checking for differences...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="font-bold text-gray-900 text-sm">
                            {activeDirection === "SHOPIFY_TO_SHEET"
                              ? `Ready to export ${selectedItemIds.length} ${itemPluralLabel.toLowerCase()} tab(s) to "${activeSheet?.title || 'Selected Sheet'}".`
                              : `Ready to sync updates for ${selectedItemIds.length} ${itemPluralLabel.toLowerCase()} into Shopify store.`}
                          </p>
                          {activeDirection === "SHEET_TO_SHOPIFY" && previewSummary?.matchedBySku > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              {previewSummary.matchedBySku} matched by SKU (Cross-store)
                            </span>
                          )}
                        </div>

                        {activeDirection === "SHEET_TO_SHOPIFY" && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[11px] font-bold text-gray-700">
                              Configured Tab Mappings:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {items
                                .filter((it) => selectedItemIds.includes(it.id))
                                .map((item) => (
                                  <div
                                    key={item.id}
                                    className="p-2.5 bg-white border border-gray-200 rounded-xl text-[11px] flex items-center justify-between"
                                  >
                                    <span className="font-bold text-gray-900">
                                      {item.name}
                                    </span>
                                    <span className="text-gray-500 font-mono text-[10px] truncate max-w-[160px]">
                                      ← {sourceTabsByItemId[item.id] || "Auto-detect tab"}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        <p className="text-gray-600">
                          Destination {itemPluralLabel.toLowerCase()}:{" "}
                          <span className="font-semibold text-gray-900">
                            {items
                              .filter((it) => selectedItemIds.includes(it.id))
                              .map((it) => it.name)
                              .join(", ")}
                          </span>
                        </p>
                      </div>

                      {previewRows.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-[10px]">
                              <tr>
                                <th className="p-2.5">Variant ID</th>
                                <th className="p-2.5">SKU</th>
                                <th className="p-2.5">Title</th>
                                <th className="p-2.5">Values</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {previewRows.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-2.5 font-mono text-[10px] text-gray-500">
                                    {row[0]}
                                  </td>
                                  <td className="p-2.5">{row[1] || "-"}</td>
                                  <td className="p-2.5 font-medium">
                                    {row[3] || row[2] || "-"}
                                  </td>
                                  <td className="p-2.5">
                                    {row.slice(4).join(" | ")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-3">
                      {planAccess && !planAccess.allowed && (
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                          {planAccess.message}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleExecuteSync}
                        disabled={isSyncing || (planAccess && !planAccess.allowed)}
                        className="px-6 py-2.5 bg-[#044e3d] hover:bg-[#033c2e] text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>
                          {activeDirection === "SHOPIFY_TO_SHEET"
                            ? "Start Export"
                            : "Start Sync to Store"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* === STEP 3: Sync In Progress / Completed === */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-950">
                      {activeDirection === "SHOPIFY_TO_SHEET"
                        ? "Export to Google Sheet"
                        : "Sync to Store"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Processing product synchronization.
                    </p>
                  </div>

                  {isSyncing ? (
                    <div className="py-12 text-center space-y-3 bg-gray-50 border border-gray-200 rounded-2xl">
                      <RefreshCw className="w-7 h-7 animate-spin text-emerald-600 mx-auto" />
                      <p className="text-sm font-bold text-gray-900">
                        Syncing {itemPluralLabel.toLowerCase()} in progress...
                      </p>
                      <p className="text-xs text-gray-400">
                        Please do not close this browser window.
                      </p>
                    </div>
                  ) : syncResult ? (
                    <div className="p-6 bg-[#f0fdf4] border border-emerald-200 rounded-2xl space-y-3 text-xs">
                      <div className="flex items-center gap-2.5 text-emerald-950 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Sync Finished Successfully!</span>
                      </div>
                      <p className="text-emerald-800">
                        Processed {syncResult.successCount} of{" "}
                        {syncResult.totalCount} {itemPluralLabel.toLowerCase()}{" "}
                        cleanly into Google Sheets.
                      </p>
                      {syncResult.errors.length > 0 && (
                        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 mt-2">
                          {syncResult.errors.join("; ")}
                        </div>
                      )}
                      <div className="pt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-[#044e3d] hover:bg-[#033c2e] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Done / Refresh View
                        </button>

                        <a
                          href={activeSheet?.spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"
                        >
                          <span>Open Google Sheet</span>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Change Sheet / Create New Sheet */}
      {isSheetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">
                Connected Google Sheet
              </h3>
              <button
                onClick={() => {
                  setIsSheetModalOpen(false);
                  setIsCreatingSheet(false);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isCreatingSheet ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Select an existing Google Sheet workbook or create a new one
                  for {isInventory ? "inventory" : "pricing"}:
                </p>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {spreadsheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      onClick={() => {
                        setSelectedSheetId(sheet.id);
                        setIsSheetModalOpen(false);
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        sheet.id === selectedSheetId
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                          : "border-gray-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{sheet.title}</span>
                      </div>
                      {sheet.id === selectedSheetId && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setIsCreatingSheet(true)}
                    className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-emerald-800 hover:bg-emerald-50/50 transition-colors"
                  >
                    + Create New Google Sheet
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateNewSheet} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Workbook Title:
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. Market Pricing 2026"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingSheet(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSheet}
                    className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingSheet ? "Creating..." : "Create Sheet"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
