// Server-side proxy for LPP arrivals — data.lpp.si sends no CORS headers, so the
// browser can't call it directly. Our server has no such restriction.
// The live endpoint is /station/arrival (nests arrivals under data.arrivals);
// we flatten it to { data: [...] } sorted soonest-first so the client just
// reads json.data[0]. Live data → no caching (revalidate: 0).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('station-code');
  if (!code) {
    return Response.json({ data: [] }, { status: 400 });
  }
  try {
    const res = await fetch(`https://data.lpp.si/api/station/arrival?station-code=${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return Response.json({ data: [] }, { status: res.status });
    }
    const json = await res.json();
    const arrivals = (json?.data?.arrivals || []).slice().sort((a, b) => (a.eta_min ?? 999) - (b.eta_min ?? 999));
    return Response.json({ data: arrivals });
  } catch (e) {
    return Response.json({ data: [], error: String(e) }, { status: 500 });
  }
}
