import { useState } from "react";
import { useLoaderData, useRouteError, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getStorePlan,
  setStorePlan,
  PLAN_STANDARD,
  PLAN_PRO,
} from "../services/plan.service";
import { getStoreMarketsAndLocations } from "../services/shopify/market.service";
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
  ArrowLeft,
  Boxes,
  AlertTriangle,
  Store,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

export const loader = async ({ request }) => {
  const { session, billing, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/app";

  const [storePlan, storeData] = await Promise.all([
    getStorePlan(shop, billing),
    getStoreMarketsAndLocations(admin).catch((err) => {
      console.warn("Error fetching store markets and locations:", err.message);
      return { locations: [], markets: [], shop: { name: shop } };
    }),
  ]);

  const locationsCount = storeData.locations?.length || 0;
  const marketsCount = storeData.markets?.length || 0;

  return Response.json({
    shop,
    currentPlan: storePlan.plan, // "STANDARD", "PRO", or null
    currentPlanDetails: storePlan,
    locationsCount,
    marketsCount,
    returnTo,
  });
};

export const action = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const planKey = formData.get("planKey"); // "STANDARD" or "PRO"

  if (planKey !== "STANDARD" && planKey !== "PRO") {
    return Response.json({ error: "Invalid plan selected" }, { status: 400 });
  }

  const selectedPlanName = planKey === "PRO" ? PLAN_PRO : PLAN_STANDARD;
  const apiKey = process.env.SHOPIFY_API_KEY || "599a19cf88962122adcc38c482c7bf20";
  const returnUrl = `https://${shop}/admin/apps/${apiKey}/app`;

  try {
    // Request Shopify Billing subscription.
    // In Shopify apps, billing.request throws a redirect response that App Bridge uses to
    // navigate the merchant to Shopify's plan approval screen (admin.shopify.com/.../confirm_recurring_application_charge)
    return await billing.request({
      plan: selectedPlanName,
      isTest: true,
      returnUrl,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error; // Propagate redirect response so App Bridge navigates to Shopify approval page
    }
    console.error("Shopify billing request error:", error);
    throw error;
  }
};

export default function PlansPage() {
  const {
    shop,
    currentPlan,
    currentPlanDetails,
    locationsCount,
    marketsCount,
    returnTo,
  } = useLoaderData();
  const shopify = useAppBridge();

  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const exceedsLocations = locationsCount > 3;
  const exceedsMarkets = marketsCount > 3;
  const requiresPro = exceedsLocations || exceedsMarkets;

  const plans = [
    {
      key: "STANDARD",
      name: "Standard Plan",
      description:
        "Ideal for stores with up to 3 locations and up to 3 markets.",
      monthlyPrice: 11,
      annualPrice: 9,
      popular: !requiresPro,
      badge: !requiresPro ? "RECOMMENDED FOR YOUR STORE" : null,
      features: [
        "Up to 3 Warehouses / Locations (Inventory Sync)",
        "Up to 3 Commercial Markets (Pricing Sync)",
        "Bi-directional Sync (Shopify ↔ Google Sheets)",
        "Protected Shopify Variant IDs (Column A Locked)",
        "Row Validation & Quantity Smart Diffing",
        "Multi-Store Hub (Link shared Google Account)",
        "Standard Email Support",
      ],
      isCurrent: currentPlan === "STANDARD",
      isRestricted: requiresPro,
      restrictionText: `Your store has ${
        exceedsLocations && exceedsMarkets
          ? `${locationsCount} locations and ${marketsCount} markets`
          : exceedsLocations
            ? `${locationsCount} locations (>3 limit)`
            : `${marketsCount} markets (>3 limit)`
      }. Upgrading to Pro ($22) is required.`,
      ctaText:
        currentPlan === "STANDARD"
          ? "Current Plan"
          : "Choose Standard ($11/mo)",
      disabled: currentPlan === "STANDARD",
    },
    {
      key: "PRO",
      name: "Pro Plan",
      description:
        "Required if store has more than 3 locations or more than 3 markets.",
      monthlyPrice: 22,
      annualPrice: 18,
      popular: requiresPro,
      badge: requiresPro ? "REQUIRED FOR YOUR STORE" : "UNLIMITED SCALE",
      features: [
        "Unlimited Warehouses & Locations (>3 Locations)",
        "Unlimited Commercial Markets (>3 Markets)",
        "Full Inventory & Pricing Bi-directional Sync",
        "Multi-Store Central Hub (Unlimited stores in 1 Google Account)",
        "Dedicated Tabs per Market & Warehouse",
        "Real-Time Smart Diffing & Audit Logs",
        "Priority Support (4-hour SLA)",
      ],
      isCurrent: currentPlan === "PRO",
      isRestricted: false,
      ctaText:
        currentPlan === "PRO" ? "Current Plan" : "Upgrade to Pro ($22/mo)",
      disabled: currentPlan === "PRO",
    },
  ];

  const faqs = [
    {
      q: "Which plan do I need for my store?",
      a: "If your store has up to 3 locations, up to 3 markets, or both, the $11 Standard Plan is completely fine. But if either of them goes more than 3, that functionality (inventory if locations > 3, or pricing if markets > 3) requires the $22 Pro Plan.",
    },
    {
      q: "Is there a free plan available?",
      a: "No. MarketMate does not offer a free plan. To use the bi-directional Google Sheets sync for your store inventory and multi-market pricing, you must be subscribed to either the $11/mo Standard Plan or the $22/mo Pro Plan.",
    },
    {
      q: "What happens if I have 4 locations but only 2 markets?",
      a: "Because your locations exceed 3, inventory sync cannot work on the $11 plan and requires the $22 Pro Plan. Upgrading to the $22 Pro plan unlocks unlimited locations and unlimited markets across both inventory and pricing.",
    },
    {
      q: "Can I manage warehouses and locations independently of markets?",
      a: "Yes! Inventory sync is organized by fulfillment location/warehouse, while pricing sync is organized by commercial market. You have full granular control over each.",
    },
    {
      q: "Are my Shopify product IDs protected in Google Sheets?",
      a: "Absolutely. MarketMate automatically protects Column A (Shopify Variant GID) in Google Sheets with locked permissions so accidental edits won't break sync links.",
    },
    {
      q: "How is billing handled?",
      a: "All subscription charges are billed securely and transparently through your standard Shopify monthly bill. You can switch plans or cancel anytime directly inside Shopify Admin.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 font-sans text-gray-900 space-y-8">
      {/* Back button to previous route */}
      {returnTo && (
        <div className="flex items-center justify-start">
          <a
            href={returnTo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              Back to{" "}
              {returnTo.includes("inventory")
                ? "Inventory Sync"
                : returnTo.includes("pricing")
                  ? "Pricing Sync"
                  : "Home"}
            </span>
          </a>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-950">
          MarketMate Subscription Plans
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          Simple, transparent pricing tailored to your store's warehouse
          locations and commercial markets. There is no free plan.
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
              Save ~18%
            </span>
          </span>
        </div>
      </div>

      {/* Store Status & Guidance Callout Banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Your Store Metrics:
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                <Store className="w-3.5 h-3.5 text-gray-500" />
                <strong>{locationsCount}</strong>{" "}
                {locationsCount === 1 ? "Location" : "Locations"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                <Globe2 className="w-3.5 h-3.5 text-gray-500" />
                <strong>{marketsCount}</strong>{" "}
                {marketsCount === 1 ? "Market" : "Markets"}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {requiresPro ? (
                <span className="text-amber-800 font-medium flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Store exceeds 3{" "}
                  {exceedsLocations && exceedsMarkets
                    ? "locations and markets"
                    : exceedsLocations
                      ? "locations (requires Pro for inventory)"
                      : "markets (requires Pro for pricing)"}
                  . Pro Plan ($22/mo) is required.
                </span>
              ) : (
                <span className="text-emerald-800 font-medium flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Your store has 3 or fewer locations and markets. The $11/mo
                  Standard Plan is completely fine for your store!
                </span>
              )}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs text-gray-500">Active Plan:</span>
            {currentPlan ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {currentPlan === "PRO"
                  ? "Pro Plan ($22/mo)"
                  : "Standard Plan ($11/mo)"}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                No Active Plan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
        {plans.map((plan) => {
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.key}
              className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? "bg-white border-2 border-emerald-600 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/10"
                  : "bg-white border border-gray-200 shadow-2xs hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase shadow-sm ${
                    plan.key === "PRO" && requiresPro
                      ? "bg-emerald-700 text-white ring-2 ring-emerald-300"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {plan.badge}
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {plan.name}
                    </h3>
                    {plan.isCurrent && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 min-h-[36px]">
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

                {/* Restriction Note if on Standard with >3 */}
                {plan.isRestricted && (
                  <div className="my-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{plan.restrictionText}</span>
                  </div>
                )}

                {/* Feature Bullet List */}
                <div className="py-5 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                    What's included:
                  </span>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-gray-700"
                      >
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-gray-100">
                <Form method="post">
                  <input type="hidden" name="planKey" value={plan.key} />
                  <button
                    type="submit"
                    disabled={plan.disabled}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
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
                </Form>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Box */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6 max-w-4xl mx-auto">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900">
            Engineered for Multi-Market & Warehouse Synchronization
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Bi-directional sync between Shopify and Google Sheets with zero data
            corruption.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Globe2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">
              3 Locations / Markets Rule
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Stores with up to 3 locations and 3 markets use the $11 plan. If
              either goes above 3, that functionality is unlocked with the $22
              Pro plan.
            </p>
          </div>

          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">
              Protected Variant IDs
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Column A is permanently protected in Google Sheets. Accidental
              cell deletions or edits won't break your product links.
            </p>
          </div>

          <div className="p-4 bg-gray-50/70 border border-gray-100 rounded-xl space-y-2">
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">
              Smart Diffing Engine
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Only changed values are written back to Shopify, keeping your
              store within GraphQL rate limits and ensuring fast updates.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto space-y-4 pt-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Have questions about billing, plan limits, or multi-market sync?
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
