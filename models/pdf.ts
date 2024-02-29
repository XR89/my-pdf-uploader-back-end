import mongoose, { Document, Schema } from "mongoose";

// Interface to describe a file document
interface Pdf extends Document {
  filename: string;
  contentType: string;
  length: number;
  id?: mongoose.Types.ObjectId; // Optional since MongoDB automatically generates it
}

// Define the file schema
const fileSchema: Schema = new Schema<Pdf>({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  length: { type: Number, required: true },
  // id field is typically not needed to be defined explicitly as MongoDB generates _id automatically
});

// Create the model from the schema
export const PdfModel = mongoose.model<Pdf>("File", fileSchema);
