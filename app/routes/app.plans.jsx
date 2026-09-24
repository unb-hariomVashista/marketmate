import { useState } from "react";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  Check,
  Zap,
  Globe2,
  ShieldCheck,
  Clock,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Boxes,
  TrendingUp,
} from "lucide-react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // In production, query current billing subscription from Shopify GraphQL Admin API
  // For demo/development, current plan can default to Free / Starter
  return Response.json({
    shop,
    currentPlan: "Starter",
  });
};

export default function PlansPage() {
  const { shop, currentPlan } = useLoaderData();
  const shopify = useAppBridge();

  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const handleSelectPlan = (planName) => {
    shopify.toast.show(`Selecting ${planName} Plan. Redirecting to Shopify Billing...`);
    // In production, this posts to /api/billing to create a recurring application charge
  };

  const plans = [
    {
      name: "Starter",
      description: "Essential tools for single-store merchants testing multi-market sync.",
      monthlyPrice: 9,
      annualPrice: 7,
      popular: false,
      features: [
        "1 Connected Shopify Store",
        "Up to 2 Markets & 2 Warehouses",
        "Bi-directional Sync (Shopify ↔ Google Sheets)",
        "Protected Shopify Variant IDs (Column A)",
        "Row Validation & Quantity Diffing",
        "Standard Email Support",
      ],
      ctaText: currentPlan === "Starter" ? "Current Plan" : "Choose Starter",
      disabled: currentPlan === "Starter",
    },
    {
      name: "Growth",
      description: "Our flagship plan for growing brands managing multi-location inventory & global pricing.",
      monthlyPrice: 29,
      annualPrice: 23,
      popular: true,
      badge: "MOST POPULAR",
      features: [
        "Multi-Store Central Hub (Unlimited stores linked to 1 Google Account)",
        "Unlimited Markets & Warehouses",
        "Dedicated Tabs per Market & Warehouse",
        "Automated PriceList & Fixed Pricing Overrides",
        "Real-Time Smart Diffing (Only updates modified rows)",
        "Audit Log Trail (Up to 100 historical jobs)",
        "Priority Support (4-hour response SLA)",
      ],
      ctaText: "Upgrade to Growth",
      disabled: false,
    },
    {
      name: "Enterprise",
      description: "For high-volume merchants, global retailers, and 3PL fulfillment aggregators.",
      monthlyPrice: 79,
      annualPrice: 63,
      popular: false,
      features: [
        "Everything in Growth",
        "Automated Background Scheduled Sync (Hourly / Daily)",
        "Custom Webhook Integration on Inventory Changes",
        "Multi-Currency Auto-Conversion & Rounding Rules",
        "Custom Field Mapping (Barcodes, Tags, Metafields)",
        "Dedicated Account Manager & Concierge Onboarding",
        "99.9% Uptime Guarantee & Custom SLA",
      ],
      ctaText: "Upgrade to Enterprise",
      disabled: false,
    },
  ];

  const faqs = [
    {
      q: "How does the Multi-Store Central Hub work?",
      a: "With the Growth and Enterprise plans, you can link the same Google account across multiple Shopify stores. MarketMate automatically organizes tabs in shared Google Sheets (e.g., 'Store 1 - Dubai' and 'Store 2 - Dubai'), allowing your team or agency to update all your stores from one central spreadsheet.",
    },
    {
      q: "Can I manage warehouses and locations independently of markets?",
      a: "Yes! Inventory sync is organized by fulfillment location/warehouse (e.g., Delhi Hub, Dubai 3PL, Singapore Depot), while pricing sync is organized by commercial market (e.g., Dubai, Singapore, India). You have full granular control over each.",
    },
    {
      q: "Are my Shopify product IDs protected against accidental edits?",
      a: "Absolutely. MarketMate automatically locks Column A (Shopify Variant GID) in Google Sheets with protected range permissions so that accidental keystrokes cannot corrupt your store data.",
    },
    {
      q: "How is billing handled?",
      a: "All subscription charges are billed securely and transparently through your standard Shopify monthly bill. You can upgrade, downgrade, or cancel anytime directly inside Shopify Admin.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans text-gray-900 space-y-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Transparent Pricing
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-950">
          Supercharge your multi-market inventory & pricing
        </h1>
        <p className="text-base text-gray-600 leading-relaxed">
          Sync spreadsheets across all your stores and warehouses with bulletproof accuracy.
          Scale without spreadsheet headaches.
        </p>

        {/* Monthly / Annual Toggle */}
        <div className="pt-2 flex items-center justify-center gap-3">
          <span
            className={`text-xs font-semibold cursor-pointer ${
              !isAnnual ? "text-gray-900 font-bold" : "text-gray-500"
            }`}
            onClick={() => setIsAnnual(false)}
          >
            Monthly billing
          </span>

          <button
            type="button"
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isAnnual ? "bg-emerald-700" : "bg-gray-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isAnnual ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>

          <span
            className={`text-xs font-semibold cursor-pointer flex items-center gap-1.5 ${
              isAnnual ? "text-gray-900 font-bold" : "text-gray-500"
            }`}
            onClick={() => setIsAnnual(true)}
          >
            <span>Annual billing</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
              Save 20%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan) => {
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? "bg-white border-2 border-emerald-600 shadow-lg shadow-emerald-500/10 md:-translate-y-2 ring-4 ring-emerald-500/10"
                  : "bg-white border border-gray-200 shadow-2xs hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-emerald-600 text-white shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 min-h-[32px]">
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className="py-4 border-y border-gray-100 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-gray-950">
                    ${price}
                  </span>
                  <span className="text-xs font-medium text-gray-500">
                    / month {isAnnual && "(billed annually)"}
                  </span>
                </div>

                {/* Feature Bullet List */}
                <div className="py-5 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    What's included:
                  </span>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={plan.disabled}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    plan.popular
                      ? "bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm"
                      : plan.disabled
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  {!plan.disabled && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Box */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900">
            Why growing multi-market brands choose MarketMate
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Engineered specifically to solve the friction of multi-currency catalog overrides and warehouse stock synchronization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Multi-Store USP</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Connect the same Google Account on Store A, Store B, and Store C. Sync all inventory and markets from one unified workbook.
            </p>
          </div>

          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Protected Variant IDs</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Column A is permanently protected in Google Sheets. Accidental cell deletions or edits won't break your product links.
            </p>
          </div>

          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Smart Diffing Engine</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              We compare existing values and only write changed cells, staying comfortably below Shopify GraphQL rate limits.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto space-y-4 pt-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h2>
          <p className="text-xs text-gray-500 mt-1">
            Have questions about billing, multi-store architecture, or plan limits?
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-gray-900 hover:bg-gray-50/50 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <div className="text-gray-400 shrink-0">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
