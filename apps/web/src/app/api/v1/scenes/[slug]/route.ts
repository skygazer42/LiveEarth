import { NextResponse } from "next/server";
import { getSceneBySlug } from "@/lib/data";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scene = await getSceneBySlug(slug);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  return NextResponse.json(scene, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" },
  });
}
