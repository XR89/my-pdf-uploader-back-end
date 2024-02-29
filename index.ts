import express from "express";
import mongoose from "mongoose";
import multer, { StorageEngine } from "multer";
import { Readable } from "stream";
import PdfModel from "./models/pdf";
import { ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const app = express();

app.set("view engine", "ejs");

const port: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

// Connect to MongoDB database
mongoose
  .connect(MONGO_URI!)
  .then(() => {
    console.log("Connected to MongoDB database successfully");
  })
  .catch((error) => {
    console.error("Error occurred while connecting to MongoDB database", error);
  });

let connection = mongoose.connection;

connection.on("open", () => {
  console.log("Connection established successfully");
  let bucket = new mongoose.mongo.GridFSBucket(connection.db);

  // Set up multer for memory storage
  const storage: StorageEngine = multer.memoryStorage();
  const upload = multer({ storage });

  // Route to upload a file
  app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");

    const { originalname, mimetype, buffer } = req.file;

    let newFile = new PdfModel({
      filename: originalname,
      contentType: mimetype,
      length: buffer.length,
    });

    try {
      let uploadStream = bucket.openUploadStream(originalname);
      let readBuffer = new Readable();
      readBuffer._read = () => {};
      readBuffer.push(buffer);
      readBuffer.push(null);

      await new Promise((resolve, reject) => {
        readBuffer
          .pipe(uploadStream)
          .on("finish", () => resolve("Successful"))
          .on("error", () => reject("Error occurred while creating stream"));
      });

      newFile.id = uploadStream.id;
      let savedFile = await newFile.save();
      if (!savedFile) {
        return res.status(404).send("Error occurred while saving the file");
      }
      return res.send({
        file: savedFile,
        message: "File uploaded successfully",
      });
    } catch (err) {
      res.status(500).send("Error uploading file");
    }
  });

  // Route to get a list of all files
  app.get("/", async (req, res) => {
    try {
      const filesCollection = connection.db.collection("fs.files");

      // Find all files in the collection
      const files = await filesCollection.find({}).toArray();

      const simplifiedFiles = files.map((file) => ({
        id: file._id,
        filename: file.filename,
        length: file.length,
        uploadDate: file.uploadDate,
      }));

      // Send the list of files to the frontend in a JSON format so I can then use the ID's to get individual files
      res.json(simplifiedFiles);
    } catch (error) {
      console.error("Failed to retrieve files:", error);
      res.status(500).send("Failed to retrieve files");
    }
  });

  // Route to get an image by its file ID
  app.get("/pdf/:fileId", (req, res) => {
    const { fileId } = req.params;
    const _id = new ObjectId(fileId);

    console.log("File ID:", _id);
    let downloadStream = bucket.openDownloadStream(_id);

    downloadStream.on("file", (file) => {
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    });

    downloadStream.on("error", (error) => {
      console.error("Error during file download:", error);
      res.status(404).send("File not found");
    });

    downloadStream.pipe(res);
  });
});
