/**
 * Google Analytics 4 (GA4) Analytics Service
 * Dynamically initializes and manages GA4 based on environment configuration.
 * Keeps local developer environments clean while enabling live tracking on production.
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Initializes GA4 script and dataLayer only when VITE_GA_MEASUREMENT_ID is present.
 */
export const initGoogleAnalytics = () => {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) {
    return;
  }

  // Prevent duplicate script injection
  if (document.getElementById("mhn-ga4-script")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "mhn-ga4-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false, // Page views are tracked dynamically via SPA route transitions
  });
};

/**
 * Tracks Single Page Application (SPA) route changes.
 *
 * @param {string} pageTitle - Active page title
 * @param {string} [path] - Active route pathname
 */
export const trackPageView = (pageTitle, path = window.location.pathname) => {
  if (typeof window !== "undefined" && typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    window.gtag("event", "page_view", {
      page_title: pageTitle,
      page_location: window.location.href,
      page_path: path,
    });
  }
};

/**
 * Tracks custom conversion and interaction events (e.g. WhatsApp clicks, waitlist submits).
 *
 * @param {string} eventName - Name of the custom event
 * @param {object} [params] - Optional parameters payload
 */
export const trackCustomEvent = (eventName, params = {}) => {
  if (typeof window !== "undefined" && typeof window.gtag === "function" && GA_MEASUREMENT_ID) {
    window.gtag("event", eventName, params);
  }
};

