export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Trace Fix AI` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Trace Fix AI` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
