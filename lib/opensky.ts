const TIMEOUT_MS = 8000;

export type StateVector = [
  string, string | null, string,
  number | null, number, number | null,
  number | null, number | null, boolean,
  number | null, number | null, number | null,
  number[] | null, number | null, string | null,
  boolean, number, number?
];

const authHeader = () => {
  const u = process.env.OPENSKY_USER;
  const p = process.env.OPENSKY_PASS;
  if (!u || !p) return {};
  const token = Buffer.from(`${u}:${p}`).toString("base64");
  return { Authorization: `Basic ${token}` };
};

export async function osGet(url: string) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const res = await fetch(url, {
      headers: { ...authHeader(), Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(id);
    
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`opensky_http_${res.status}: ${body.slice(0, 200)}`);
    }
    return await res.json();
  } catch (e: any) {
    clearTimeout(id);
    throw new Error(`network_error: ${e?.message || e}`);
  }
}

export async function fetchAllStates(bbox?: { lamin:number; lomin:number; lamax:number; lomax:number; }) {
  const params = new URLSearchParams();
  if (bbox) { params.set("lamin", String(bbox.lamin)); params.set("lomin", String(bbox.lomin)); params.set("lamax", String(bbox.lamax)); params.set("lomax", String(bbox.lomax)); }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`https://opensky-network.org/api/states/all?${params}`, {
      headers: { ...authHeader() },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e:any) {
    clearTimeout(id);
    throw new Error(`network_error: ${e?.message || e}`);
  }
  clearTimeout(id);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`opensky_http_${res.status}: ${body.slice(0,200)}`);
  }
  const json = await res.json().catch(() => null) as { time:number; states: StateVector[] | null } | null;
  if (!json) throw new Error("bad_json");
  return json.states ?? [];
}
