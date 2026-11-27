// curb.here/* -> GitHub Pages (here.github.io/curb.here/*). See three/three.md.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    // The page uses relative URLs, so it needs the trailing slash.
    if (url.pathname === "/sunset") {
      return Response.redirect(`${url.origin}/sunset/${url.search}`, 301);
    }
    // Caching (see three/three.md, "Cache-busting"):
    //  - pages (/ or .html): browsers revalidate every load; edge keeps them 60 s
    //  - ?v=<hash> files (stamped by scripts/stamp_sunset.py): the URL changes when the file does,
    //    so cache forever
    //  - everything else: 5 minutes
    // Setting Cache-Control here also replaces the zone's default 4 h browser TTL.
    const isPage = url.pathname.endsWith("/") || url.pathname.endsWith(".html");
    const versioned = url.searchParams.has("v");
    const edgeTtl = isPage ? 60 : versioned ? 86400 : 300;
    const browserCache = isPage ? "no-cache"
      : versioned ? "public, max-age=31536000, immutable"
      : "public, max-age=300";
    const upstream = new URL(env.UPSTREAM + url.pathname + url.search);
    const resp = await fetch(upstream, {
      method: request.method,
      headers: { "User-Agent": "curb.here-worker" },
      redirect: "manual",
      cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": edgeTtl, "404": 30, "500-599": 0 } },
    });
    const out = new Response(resp.body, resp);
    out.headers.set("Cache-Control", resp.ok ? browserCache : "no-store");
    // Keep GitHub redirects on curb.here (e.g. /sunset/foo -> /sunset/foo/).
    const loc = out.headers.get("Location");
    if (loc && loc.startsWith(env.UPSTREAM)) {
      out.headers.set("Location", url.origin + loc.slice(env.UPSTREAM.length));
    }
    for (const h of ["x-github-request-id", "x-fastly-request-id", "via", "x-served-by"]) out.headers.delete(h);
    out.headers.set("x-proxied-by", "curb.here-worker");
    return out;
  },
};
