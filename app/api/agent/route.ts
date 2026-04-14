import { NextResponse } from "next/server";
import { compileAndRunAgent } from "@/lib/compiler";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { config, input } = await req.json();

    if (!config) {
      return NextResponse.json(
        { error: "Missing Agent Configuration" },
        { status: 400 },
      );
    }

    // 1. Fetch the latest skills from Supabase so the compiler has the actual prompt templates
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: skills, error } = await supabase.from("skills").select("*");

    if (error) {
      throw new Error(`Failed to fetch skills dependencies: ${error.message}`);
    }

    // 2. Compile & Execute the Graph
    const result = await compileAndRunAgent(config, skills || [], input);

    // 3. Return the result back to the Playground
    return NextResponse.json({
      success: true,
      result: JSON.stringify(result),
    });
  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
