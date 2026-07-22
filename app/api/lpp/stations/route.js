// Server-side proxy for the LPP station list (CORS workaround, see arrivals
// route). There's no "all stations" endpoint anymore; stations-in-range from
// Ljubljana's centre with a 20 km radius covers the whole network (~1250 stops,
// each with name + ref_id). Rarely changes → cache 1h (revalidate: 3600).
export async function GET() {
  try {
    const res = await fetch(
      'https://data.lpp.si/api/station/stations-in-range?latitude=46.056&longitude=14.505&radius=20000',
      { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return Response.json({ data: [] }, { status: res.status });
    }
    const json = await res.json();
    return Response.json({ data: json?.data || [] });
  } catch (e) {
    return Response.json({ data: [], error: String(e) }, { status: 500 });
  }
}
