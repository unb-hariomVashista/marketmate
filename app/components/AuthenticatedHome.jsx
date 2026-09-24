import { useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  Store,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  ArrowRight,
  TrendingUp,
  Boxes,
  Globe2,
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header Profile Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {googleAccount.pictureUrl ? (
            <img
              src={googleAccount.pictureUrl}
              alt={googleAccount.name || "Google User"}
              className="w-14 h-14 rounded-full ring-2 ring-emerald-500/20"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
              {googleAccount.name ? googleAccount.name[0] : "G"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">
                {googleAccount.name || "Google Account Connected"}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            </div>
            <p className="text-sm text-gray-500">{googleAccount.email}</p>
          </div>
        </div>

        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer self-start md:self-auto"
        >
          <LogOut className="w-4 h-4 text-gray-500" />
          {isDisconnecting ? "Disconnecting..." : "Disconnect Google"}
        </button>
      </div>

      {/* The Multi-Store USP Banner */}
      <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/70 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-xs">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Multi-Store Central Hub (Single Google Account)
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Manage inventory and multi-market pricing across stores from shared Google Sheets.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-xs">
            {linkedStores.length} {linkedStores.length === 1 ? "Store Connected" : "Stores Connected"}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-200/50 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Connected Stores:
          </span>
          {linkedStores.map((store) => {
            const isCurrent = store.shop === currentShop;
            return (
              <span
                key={store.shop}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border ${
                  isCurrent
                    ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                {store.shop} {isCurrent && "(Current Store)"}
              </span>
            );
          })}
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inventory Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Multi-Market Inventory
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Export and synchronize inventory levels for each market and fulfillment location via dedicated sheet tabs.
            </p>
            <div className="text-xs text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between">
              <span>Active Inventory Sheets:</span>
              <span className="font-semibold text-gray-800">
                {inventorySheets.length} sheet(s) configured
              </span>
            </div>
          </div>
          <Link
            to="/app/inventory"
            className="inline-flex items-center justify-between px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg transition-colors"
          >
            <span>Manage Inventory Tabs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Pricing Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Multi-Market Pricing
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Manage localized currency overrides and PriceLists per market with automatic row validation and protected product IDs.
            </p>
            <div className="text-xs text-gray-500 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center justify-between">
              <span>Active Pricing Sheets:</span>
              <span className="font-semibold text-gray-800">
                {pricingSheets.length} sheet(s) configured
              </span>
            </div>
          </div>
          <Link
            to="/app/pricing"
            className="inline-flex items-center justify-between px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors"
          >
            <span>Manage Pricing Tabs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Linked Spreadsheets List */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-gray-700" />
            <h3 className="text-base font-bold text-gray-900">
              Connected Google Spreadsheets
            </h3>
          </div>
        </div>

        {spreadsheets.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">No spreadsheets linked yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Visit the Inventory or Pricing tabs to create your first synced Google Sheet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {spreadsheets.map((sheet) => (
              <div
                key={sheet.id}
                className="py-3.5 flex items-center justify-between hover:bg-gray-50/50 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                      sheet.type === "INVENTORY"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    }`}
                  >
                    {sheet.type}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{sheet.title}</h4>
                    <p className="text-xs text-gray-500">
                      {sheet.tabs?.length || 0} market tab(s) configured
                    </p>
                  </div>
                </div>

                <a
                  href={sheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Log */}
      {recentJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-bold text-gray-900">Recent Sync Activity</h3>
            </div>
            <Link
              to="/app/logs"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View all logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-semibold uppercase px-2 py-0.5 rounded text-[10px] ${
                        job.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : job.status === "PARTIAL_FAILED"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {job.status}
                    </span>
                    <span className="font-semibold text-gray-700">
                      {job.direction === "SHOPIFY_TO_SHEET"
                        ? "Shopify → Google Sheet"
                        : "Google Sheet → Shopify"}
                    </span>
                    <span className="text-gray-400">({job.type})</span>
                  </div>
                  <p className="text-gray-600">{job.summary || "Sync finished."}</p>
                </div>
                <span className="text-gray-400 whitespace-nowrap ml-4">
                  {new Date(job.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};