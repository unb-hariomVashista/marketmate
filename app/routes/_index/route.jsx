import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>MarketMate — Multi-Market Pricing & Inventory</h1>
        <p className={styles.text}>
          Effortlessly synchronize Shopify Markets pricing and multi-location warehouse inventory with Google Sheets in real-time.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Multi-Market Price Lists</strong>. Export and import fixed prices and localized currency adjustments per market using connected Google Sheets.
          </li>
          <li>
            <strong>Multi-Location Inventory</strong>. Manage stock quantities across all your physical and fulfillment locations with automatic diff detection.
          </li>
          <li>
            <strong>Two-Way Sheet Automation</strong>. Keep your store catalog updated effortlessly while protecting variant identifiers from accidental changes.
          </li>
        </ul>
      </div>
    </div>
  );
}
