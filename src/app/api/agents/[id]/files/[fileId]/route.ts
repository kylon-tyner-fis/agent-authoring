import { NextResponse } from "next/server";
import { DocumentService } from "@/src/lib/storage/DocumentService";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { fileId } = await params;

    // Deletes the file from Storage, and deletes the DB record
    // (which cascades to delete the pgvector chunks)
    await DocumentService.deleteFile(fileId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
