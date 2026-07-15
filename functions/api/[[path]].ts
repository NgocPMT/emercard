interface Env {
  EMERCARD_API_ORIGIN: string;
}

type PagesContext = {
  request: Request;
  env: Env;
};

export const onRequest = async ({ request, env }: PagesContext): Promise<Response> => {
  const incomingUrl = new URL(request.url);
  const backendOrigin = new URL(env.EMERCARD_API_ORIGIN);
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin);
  const headers = new Headers(request.headers);

  // Render must receive its own host, not the Cloudflare Pages hostname.
  headers.delete("host");
  headers.delete("content-length");

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
};
