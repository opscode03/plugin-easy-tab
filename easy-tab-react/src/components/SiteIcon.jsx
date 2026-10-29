import { useState } from "react";
import { Globe2 } from "lucide-react";

export default function SiteIcon({ url, size = 32, className = "", fallback }) {
  const [failedUrl, setFailedUrl] = useState("");
  let iconUrl = "";

  if (globalThis.chrome?.runtime?.getURL) {
    const faviconUrl = new URL(globalThis.chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", url);
    faviconUrl.searchParams.set("size", String(size));
    iconUrl = faviconUrl.toString();
  }

  if (!iconUrl || failedUrl === url) {
    return fallback ?? <Globe2 className={`text-ink-muted ${className}`} aria-hidden="true" />;
  }

  return (
    <img
      className={className}
      src={iconUrl}
      alt=""
      aria-hidden="true"
      onError={() => setFailedUrl(url)}
    />
  );
}
