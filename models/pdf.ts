import mongoose, { Document, Schema } from "mongoose";

interface Pdf extends Document {
  filename: string;
  contentType: string;
  length: number;
  gridFSId?: mongoose.Types.ObjectId;
}

const fileSchema: Schema = new Schema<Pdf>({
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  length: { type: Number, required: true },
  gridFSId: { type: Schema.Types.ObjectId, required: false },
});

export const PdfModel = mongoose.model<Pdf>("File", fileSchema, "metadata");
