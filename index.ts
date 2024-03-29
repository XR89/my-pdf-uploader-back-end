import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createPdfRoutes } from "./routes/pdf"; // Adjust the import path as necessary
import cors from "cors"; // Import cors

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const app = express();
app.set("view engine", "ejs");

app.use(cors());

const port: number = parseInt(process.env.PORT || "3000");

mongoose
  .connect(MONGO_URI as string)
  .then(() => {
    console.log("Connected to MongoDB database successfully");
    const pdfRoutes = createPdfRoutes(mongoose.connection.db);
    app.use(pdfRoutes);
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Error occurred while connecting to MongoDB database", error);
  });
