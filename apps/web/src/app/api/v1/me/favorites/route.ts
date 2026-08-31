import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";

const sceneIdSchema = z.string().uuid().or(z.string().min(3).max(120));
const bodySchema = z.union([
  z.object({ sceneId: sceneIdSchema }).transform(({ sceneId }) => [sceneId]),
  z.object({ sceneIds: z.array(sceneIdSchema).max(100) }).transform(({ sceneIds }) => sceneIds),
]);

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data, error } = await supabase
    .from("favorites")
    .select("scene_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not read favorites" }, { status: 500 });
  return NextResponse.json({ sceneIds: data.map((row) => row.scene_id) });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (parsed.data.length === 0) return NextResponse.json({ ok: true }, { status: 200 });
  const { error } = await supabase
    .from("favorites")
    .upsert(
      parsed.data.map((sceneId) => ({ user_id: user.id, scene_id: sceneId })),
      { onConflict: "user_id,scene_id" },
    );
  if (error) return NextResponse.json({ error: "Could not save favorite" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const parsed = sceneIdSchema.safeParse(request.nextUrl.searchParams.get("sceneId"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("scene_id", parsed.data);
  if (error) return NextResponse.json({ error: "Could not delete favorite" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
