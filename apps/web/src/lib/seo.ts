import { useEffect } from "react";

type SEOInput = {
  title: string;
  description: string;
  path?: string;
  robots?: string;
  imagePath?: string;
  type?: "website" | "article" | "profile";
  jsonLd?: Record<string, unknown> | null;
};

const SITE_NAME = "Evidensify";
const DEFAULT_SITE_URL = "https://evidensify.com";
const DEFAULT_IMAGE = "/Evidensify.png";

function resolveSiteUrl() {
  if (typeof window === "undefined") return DEFAULT_SITE_URL;
  return window.location.origin || DEFAULT_SITE_URL;
}

function upsertMetaByName(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let tag = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let tag = document.head.querySelector(`link[rel="canonical"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function upsertJsonLd(jsonLd: Record<string, unknown> | null) {
  const id = "route-json-ld";
  const current = document.getElementById(id);
  if (!jsonLd) {
    if (current) current.remove();
    return;
  }
  let script = current as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

export function useSEO({
  title,
  description,
  path = "/",
  robots = "index,follow",
  imagePath = DEFAULT_IMAGE,
  type = "website",
  jsonLd = null,
}: SEOInput) {
  useEffect(() => {
    const siteUrl = resolveSiteUrl();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const canonicalUrl = `${siteUrl}${normalizedPath}`;
    const imageUrl = imagePath.startsWith("http") ? imagePath : `${siteUrl}${imagePath}`;
    const fullTitle = `${title} | ${SITE_NAME}`;

    document.title = fullTitle;
    upsertCanonical(canonicalUrl);
    upsertMetaByName("description", description);
    upsertMetaByName("robots", robots);

    upsertMetaByProperty("og:site_name", SITE_NAME);
    upsertMetaByProperty("og:type", type);
    upsertMetaByProperty("og:title", fullTitle);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:url", canonicalUrl);
    upsertMetaByProperty("og:image", imageUrl);

    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", fullTitle);
    upsertMetaByName("twitter:description", description);
    upsertMetaByName("twitter:image", imageUrl);

    upsertJsonLd(jsonLd);
  }, [description, imagePath, jsonLd, path, robots, title, type]);
}
