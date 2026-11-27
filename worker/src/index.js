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
    const upstream = new URL(env.UPSTREAM + url.pathname + url.search);
    const resp = await fetch(upstream, {
      method: request.method,
      headers: { "User-Agent": "curb.here-worker" },
      redirect: "manual",
      cf: { cacheEverything: true, cacheTtl: 300 },
    });
    const out = new Response(resp.body, resp);
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
