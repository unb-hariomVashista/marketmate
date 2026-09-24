import { useState, useMemo } from "react";
import { useLoaderData, useRevalidator, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Search,
  FileSpreadsheet,
  Boxes,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const jobs = await prisma.syncJob.findMany({
    where: { shop },
    include: {
      spreadsheet: {
        select: {
          title: true,
          spreadsheetUrl: true,
          type: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const totalCount = jobs.length;
  const successCount = jobs.filter((j) => j.status === "SUCCESS").length;
  const failedCount = jobs.filter(
    (j) => j.status === "FAILED" || j.status === "PARTIAL_FAILED"
  ).length;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 100;

  return Response.json({
    jobs,
    stats: {
      totalCount,
      successCount,
      failedCount,
      successRate,
      lastSyncAt: jobs[0]?.startedAt || null,
    },
    shop,
  });
};

export default function LogsPage() {
  const { jobs = [], stats, shop } = useLoaderData();
  const revalidator = useRevalidator();

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL"); // "ALL" | "INVENTORY" | "PRICING"
  const [selectedDirection, setSelectedDirection] = useState("ALL"); // "ALL" | "SHOPIFY_TO_SHEET" | "SHEET_TO_SHOPIFY"
  const [selectedStatus, setSelectedStatus] = useState("ALL"); // "ALL" | "SUCCESS" | "FAILED"
  const [expandedJobId, setExpandedJobId] = useState(null);

  const toggleExpand = (jobId) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Type filter
      if (selectedType !== "ALL" && job.type !== selectedType) return false;

      // Direction filter
      if (selectedDirection !== "ALL" && job.direction !== selectedDirection) return false;

      // Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "SUCCESS" && job.status !== "SUCCESS") return false;
        if (
          selectedStatus === "FAILED" &&
          job.status !== "FAILED" &&
          job.status !== "PARTIAL_FAILED"
        ) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSummary = job.summary?.toLowerCase().includes(query);
        const matchesSheet = job.spreadsheet?.title?.toLowerCase().includes(query);
        const matchesErrors = job.errorLogs?.toLowerCase().includes(query);
        if (!matchesSummary && !matchesSheet && !matchesErrors) return false;
      }

      return true;
    });
  }, [jobs, selectedType, selectedDirection, selectedStatus, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-sans text-gray-900 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Sync Activity & Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review detailed audit records, performance metrics, and error diagnostics for all sync runs.
          </p>
        </div>

        <button
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state === "loading"}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-gray-500 ${
              revalidator.state === "loading" ? "animate-spin text-emerald-600" : ""
            }`}
          />
          <span>{revalidator.state === "loading" ? "Refreshing..." : "Refresh logs"}</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Syncs */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Runs</span>
            <Layers className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{stats.totalCount}</div>
          <p className="text-[11px] text-gray-400 mt-1">Recorded audit jobs</p>
        </div>

        {/* Successful Syncs */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{stats.successCount}</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Clean executions</p>
        </div>

        {/* Failed Syncs */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed / Warnings</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700">{stats.failedCount}</div>
          <p className="text-[11px] text-rose-500 font-medium mt-1">Requires review</p>
        </div>

        {/* Success Rate */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-gray-900">{stats.successRate}%</div>
          <p className="text-[11px] text-gray-400 mt-1">Overall reliability</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by sheet name, summary, or error..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Quick Filter Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Types</option>
              <option value="INVENTORY">Inventory</option>
              <option value="PRICING">Pricing</option>
            </select>

            {/* Direction Filter */}
            <select
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Directions</option>
              <option value="SHOPIFY_TO_SHEET">Shopify → Sheet</option>
              <option value="SHEET_TO_SHOPIFY">Sheet → Shopify</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed / Warnings</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        {filteredJobs.length === 0 ? (
          <div className="py-14 text-center">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-gray-700">No logs found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {jobs.length === 0
                ? "Perform your first sync from the Inventory or Pricing pages to generate activity records."
                : "No log entries match your current search or filter criteria."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredJobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const hasErrors = !!job.errorLogs;

              return (
                <div key={job.id} className="transition-colors hover:bg-gray-50/60">
                  <div
                    onClick={() => toggleExpand(job.id)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
                  >
                    {/* Status & Basic Info */}
                    <div className="flex items-start md:items-center gap-3">
                      {/* Status Icon */}
                      <div className="mt-0.5 md:mt-0">
                        {job.status === "SUCCESS" ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : job.status === "PARTIAL_FAILED" ? (
                          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : job.status === "IN_PROGRESS" ? (
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                            <XCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              job.status === "SUCCESS"
                                ? "bg-emerald-100 text-emerald-800"
                                : job.status === "PARTIAL_FAILED"
                                ? "bg-amber-100 text-amber-800"
                                : job.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {job.status}
                          </span>

                          <span className="text-xs font-semibold text-gray-800">
                            {job.direction === "SHOPIFY_TO_SHEET"
                              ? "Shopify → Google Sheet"
                              : "Google Sheet → Shopify"}
                          </span>

                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-medium ${
                              job.type === "INVENTORY"
                                ? "bg-teal-50 text-teal-700 border border-teal-200"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            }`}
                          >
                            {job.type}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 line-clamp-1">
                          {job.summary || "Sync finished."}
                        </p>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 self-end md:self-auto shrink-0">
                      {job.spreadsheet && (
                        <a
                          href={job.spreadsheet.spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hidden sm:inline-flex items-center gap-1 text-gray-600 hover:text-emerald-700 font-medium"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />
                          <span>{job.spreadsheet.title}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      )}

                      <span className="whitespace-nowrap">
                        {new Date(job.startedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Diagnostics Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50/80 border-t border-gray-100 text-xs space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-gray-600 bg-white p-3 rounded-lg border border-gray-200/60">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                            Job ID
                          </span>
                          <span className="font-mono text-gray-800 break-all">{job.id}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                            Duration
                          </span>
                          <span>
                            {job.completedAt
                              ? `${(
                                  (new Date(job.completedAt) - new Date(job.startedAt)) /
                                  1000
                                ).toFixed(1)}s`
                              : "In Progress"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                            Google Spreadsheet
                          </span>
                          {job.spreadsheet ? (
                            <a
                              href={job.spreadsheet.spreadsheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <span>{job.spreadsheet.title}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </div>
                      </div>

                      {job.summary && (
                        <div>
                          <span className="text-gray-500 font-semibold block mb-1">
                            Execution Summary:
                          </span>
                          <div className="p-2.5 bg-white border border-gray-200 rounded text-gray-700">
                            {job.summary}
                          </div>
                        </div>
                      )}

                      {hasErrors && (
                        <div>
                          <span className="text-rose-600 font-semibold block mb-1">
                            Diagnostics & Error Trace:
                          </span>
                          <pre className="p-3 bg-rose-50/80 border border-rose-200 rounded text-rose-800 font-mono text-[11px] whitespace-pre-wrap break-all overflow-x-auto">
                            {job.errorLogs}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
