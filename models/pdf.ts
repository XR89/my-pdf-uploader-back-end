import mongoose, { Document, Schema } from "mongoose";

// Interface to describe a file document
interface Pdf extends Document {
  filename: string;
  contentType: string;
  length: number;
  gridFSId?: mongoose.Types.ObjectId; // Optional since MongoDB automatically generates it
}

// Define the file schema
const fileSchema: Schema = new Schema<Pdf>({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  length: { type: Number, required: true },
  gridFSId: { type: Schema.Types.ObjectId, required: false },
});

// Create the model from the schema
export const PdfModel = mongoose.model<Pdf>("File", fileSchema);
