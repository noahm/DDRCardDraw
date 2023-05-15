import { onCLS, onFCP, onFID, onLCP, onTTFB, Metric } from "web-vitals";

const vitalsUrl = "https://vitals.vercel-analytics.com/v1/vitals";

declare var navigator: Navigator & {
  connection: {
    effectiveType: string;
  };
};

function getConnectionSpeed() {
  return "connection" in navigator &&
    navigator["connection"] &&
    "effectiveType" in navigator["connection"]
    ? navigator["connection"]["effectiveType"]
    : "";
}

function sendToAnalytics(metric: Metric) {
  const analyticsId = process.env.VERCEL_ANALYTICS_ID;
  if (!analyticsId) {
    return;
  }

  const body = {
    dsn: analyticsId,
    id: metric.id,
    page: window.location.pathname,
    href: window.location.href,
    event_name: metric.name,
    value: metric.value.toString(),
    speed: getConnectionSpeed(),
  };

  const blob = new Blob([new URLSearchParams(body).toString()], {
    // This content type is necessary for `sendBeacon`
    type: "application/x-www-form-urlencoded",
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(vitalsUrl, blob);
  } else
    fetch(vitalsUrl, {
      body: blob,
      method: "POST",
      credentials: "omit",
      keepalive: true,
    });
}

export function webVitals() {
  try {
    onFID(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onLCP(sendToAnalytics);
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
  } catch (err) {
    console.error("[Analytics]", err);
  }
}
