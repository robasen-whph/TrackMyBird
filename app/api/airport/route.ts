import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get("icao") || "").toUpperCase();
  
  if (!icao || icao.length < 3 || icao.length > 5) {
    return NextResponse.json({ message: "invalid_icao" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://airport-data.com/api/ap_info.json?icao=${icao}`,
      { cache: "force-cache", next: { revalidate: 86400 } }
    );
    
    if (!r.ok) {
      return NextResponse.json({ 
        icao, 
        name: icao, 
        country: "Unknown",
        country_code: "XX" 
      });
    }

    const data: any = await r.json();
    
    return NextResponse.json({
      icao: data.icao || icao,
      name: data.name || icao,
      city: data.location || undefined,
      country: data.country || "Unknown",
      country_code: data.country_code || "XX",
    });
  } catch (e) {
    return NextResponse.json({ 
      icao, 
      name: icao, 
      country: "Unknown",
      country_code: "XX" 
    });
  }
}
