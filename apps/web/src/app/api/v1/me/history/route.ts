import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";

const sceneIdSchema = z.string().min(3).max(120);
const bodySchema = z.union([
  z.object({ sceneId: sceneIdSchema }).transform(({ sceneId }) => [sceneId]),
  z.object({ sceneIds: z.array(sceneIdSchema).max(100) }).transform(({ sceneIds }) => sceneIds),
]);

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data, error } = await supabase
    .from("view_history")
    .select("scene_id, viewed_at")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Could not read history" }, { status: 500 });
  return NextResponse.json({ sceneIds: data.map((row) => row.scene_id) });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid scene" }, { status: 400 });
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (parsed.data.length === 0) return NextResponse.json({ ok: true }, { status: 200 });
  const viewedAt = new Date();
  const { error } = await supabase.from("view_history").upsert(
    parsed.data.map((sceneId, index) => ({
      user_id: user.id,
      scene_id: sceneId,
      viewed_at: new Date(viewedAt.getTime() - index).toISOString(),
    })),
    { onConflict: "user_id,scene_id" },
  );
  if (error) return NextResponse.json({ error: "Could not save history" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { error } = await supabase.from("view_history").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not clear history" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
