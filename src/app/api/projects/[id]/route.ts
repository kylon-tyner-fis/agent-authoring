// src/app/api/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, description } = await req.json();

    const { data, error } = await supabase
      .from("projects")
      .update({ name, description })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, project: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Check if it's the Default Project
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", id)
      .single();

    if (project?.name === "Default Project") {
      return NextResponse.json(
        { error: "The Default Project cannot be deleted." },
        { status: 400 },
      );
    }

    // Note: Foreign key constraints in the schema will prevent deletion
    // if agents or orchestrators are still linked.
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
