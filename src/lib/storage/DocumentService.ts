import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Initialize the Supabase admin client for backend operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export class DocumentService {
  /**
   * Uploads a raw file to Storage, creates the metadata record,
   * and triggers the background processing for vectors if needed.
   */
  static async uploadFile(
    file: File,
    agentId: string,
    usageType: "instruction" | "reference",
  ) {
    // 1. Generate a unique, safe path for Supabase Storage
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${agentId}/${Date.now()}-${safeFilename}`;
    const textContent = await file.text();

    // 2. Upload the raw file to the Storage bucket
    const { error: uploadError } = await supabase.storage
      .from("agent-documents")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 3. Insert the metadata record into the database
    const { data: fileRecord, error: dbError } = await supabase
      .from("agent_files")
      .insert([
        {
          agent_id: agentId,
          filename: file.name,
          usage_type: usageType,
          file_path: filePath,
        },
      ])
      .select()
      .single();

    if (dbError) {
      // Rollback: delete the file from storage if the DB insert fails
      await supabase.storage.from("agent-documents").remove([filePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    // 4. Process the file (Chunking & Embedding)
    // We await this here to ensure the UI doesn't report success until vectors are ready
    await this.processFile(
      fileRecord.id,
      agentId,
      usageType,
      textContent,
      file.name,
    );

    return fileRecord;
  }

  /**
   * Handles the RAG pipeline: splits text into chunks and generates vectors.
   */
  private static async processFile(
    fileId: string,
    agentId: string,
    usageType: "instruction" | "reference",
    textContent: string,
    filename: string,
  ) {
    // Instruction files bypass the chunking process entirely.
    // At runtime, we will just fetch their raw content from Storage.
    if (usageType === "instruction") {
      return;
    }

    // --- REFERENCE FILE PROCESSING ---

    // 1. Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([textContent], [{ filename }]);

    if (docs.length === 0) return;

    // 2. Embed the chunks
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
    });

    const vectors = await embeddings.embedDocuments(
      docs.map((d) => d.pageContent),
    );

    // 3. Prepare records for the database
    const chunkRecords = docs.map((doc, index) => ({
      file_id: fileId,
      agent_id: agentId,
      content: doc.pageContent,
      metadata: { ...doc.metadata, chunk_index: index },
      embedding: vectors[index],
    }));

    // 4. Batch insert into file_chunks
    // Supabase can easily handle inserting hundreds of rows in a single call
    const { error } = await supabase.from("file_chunks").insert(chunkRecords);

    if (error) {
      throw new Error(`Failed to insert vector chunks: ${error.message}`);
    }
  }

  /**
   * Completely removes a file from the system.
   */
  static async deleteFile(agentId: string, fileId: string) {
    // 1. Get the file path from the database
    const { data, error: fetchError } = await supabase
      .from("agent_files")
      .select("file_path")
      .eq("id", fileId)
      .eq("agent_id", agentId)
      .single();

    if (fetchError || !data) {
      throw new Error("File not found for this agent.");
    }

    // 2. Delete the raw file from Storage
    const { error: storageError } = await supabase.storage
      .from("agent-documents")
      .remove([data.file_path]);

    if (storageError) {
      console.error(
        "[DocumentService] Failed to delete from storage:",
        storageError,
      );
    }

    // 3. Delete from Database
    // Because we set `ON DELETE CASCADE` in SQL, deleting this row
    // will automatically delete all associated vectors in `file_chunks`!
    const { error: dbError } = await supabase
      .from("agent_files")
      .delete()
      .eq("id", fileId)
      .eq("agent_id", agentId);

    if (dbError) {
      throw new Error(`Failed to delete database record: ${dbError.message}`);
    }
  }

  /**
   * Retrieves the raw text content of a saved file.
   */
  static async getFileText(agentId: string, fileId: string): Promise<string> {
    // 1. Get the file path
    const { data: fileRecord, error: fetchError } = await supabase
      .from("agent_files")
      .select("file_path")
      .eq("id", fileId)
      .eq("agent_id", agentId)
      .single();

    if (fetchError || !fileRecord)
      throw new Error("File not found for this agent.");

    // 2. Download from storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("agent-documents")
      .download(fileRecord.file_path);

    if (downloadError || !fileBlob)
      throw new Error("Could not download file from storage.");

    return await fileBlob.text();
  }

  /**
   * Overwrites the file in storage. If it is a reference file,
   * purges the old vector chunks and generates new ones.
   */
  static async updateFileText(
    agentId: string,
    fileId: string,
    newText: string,
  ): Promise<void> {
    // 1. Get the file details
    const { data: fileRecord, error: fetchError } = await supabase
      .from("agent_files")
      .select("*")
      .eq("id", fileId)
      .eq("agent_id", agentId)
      .single();

    if (fetchError || !fileRecord)
      throw new Error("File not found for this agent.");

    // 2. Overwrite the file in Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("agent-documents")
      .upload(fileRecord.file_path, newText, {
        upsert: true,
        contentType: "text/plain",
      });

    if (uploadError) throw uploadError;

    // 3. If it's a reference file, we must rebuild the vector memory
    if (fileRecord.usage_type === "reference") {
      // Purge old chunks
      await supabase.from("file_chunks").delete().eq("file_id", fileId);

      // Re-embed new chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const chunks = await textSplitter.createDocuments([newText]);
      const embeddings = new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
      });

      const chunksToInsert = await Promise.all(
        chunks.map(async (chunk) => {
          const embedding = await embeddings.embedQuery(chunk.pageContent);
          return {
            file_id: fileId,
            agent_id: fileRecord.agent_id,
            content: chunk.pageContent,
            embedding,
            metadata: { filename: fileRecord.filename },
          };
        }),
      );

      const { error: insertError } = await supabase
        .from("file_chunks")
        .insert(chunksToInsert);

      if (insertError) {
        console.error("Failed to re-insert chunks:", insertError);
        throw new Error("Failed to update vector database.");
      }
    }
  }
}
