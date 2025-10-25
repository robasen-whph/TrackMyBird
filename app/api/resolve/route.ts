import { NextResponse } from "next/server";
import { nNumberToIcao, isValidNNumber } from "@/lib/nnumber-converter";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let tail = (searchParams.get("tail") || "").toUpperCase().replace(/\s+/g, "");
  
  if (!tail) {
    return NextResponse.json({ 
      error: "no_tail",
      message: "Please provide a tail number" 
    }, { status: 400 });
  }

  // Check if it's a US N-number
  if (!tail.startsWith('N')) {
    return NextResponse.json({
      error: "non_us_aircraft",
      message: "This app currently supports US-registered aircraft only (N-numbers). Please enter a tail number starting with 'N'."
    }, { status: 400 });
  }

  // Validate and convert using algorithm
  const hex = nNumberToIcao(tail);
  
  if (!hex) {
    return NextResponse.json({
      error: "invalid_nnumber",
      message: `'${tail}' is not a valid US tail number format. Valid examples: N1, N12345, N260PC, N842QS`
    }, { status: 400 });
  }

  return NextResponse.json({
    hex: hex.toUpperCase(),
    tail,
    source: "algorithm"
  });
}
