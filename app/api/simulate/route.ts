import { NextResponse } from "next/server";
import mock from "../../../data/mock-risks.json";

export async function GET() {
  return NextResponse.json(mock);
}
