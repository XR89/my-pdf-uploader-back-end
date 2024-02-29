// pdfRoutes.ts
import express, { Request, Response } from "express";
import multer, { StorageEngine } from "multer";
import { Readable } from "stream";
import { ObjectId, Db } from "mongodb";
import { PdfModel } from "../models/pdf"; // Adjust the path as necessary
import { GridFSBucket } from "mongodb";

export const createPdfRoutes = (db: Db) => {
  const router = express.Router();
  const bucket = new GridFSBucket(db);

  console.log("Bucket set up successfully, handing to routes...");

  // Set up multer for memory storage
  const storage: StorageEngine = multer.memoryStorage();
  const upload = multer({ storage });

  router.post(
    "/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }
      // Buffer is the raw data of the file
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
        // Push the buffer (file binary data) to the read buffer for upload
        readBuffer.push(buffer);
        // Null reference denotes the end of the file (EOF)
        readBuffer.push(null);

        // this promise is what actually carries out the upload with the readBuffer being pushed up the uploadStream pipe
        await new Promise((resolve, reject) => {
          readBuffer
            // Pipe the read buffer to the upload stream
            .pipe(uploadStream)
            .on("finish", () => resolve("Successful"))
            .on("error", () => reject("Error occurred while creating stream"));
        });

        // file has been uploaded

        // newFile has been assigned the id from the upload function
        newFile.id = uploadStream.id;

        // save file metadata containing the id of the file in Mongo
        let savedFile = await newFile.save();
        if (!savedFile) {
          return res.status(404).send("Error occurred while saving the file");
        }
        return res.send({
          file: savedFile,
          message: "File uploaded successfully",
        });
      } catch (err) {
        return res.status(500).send("Error uploading file");
      }
    }
  );

  router.get("/", async (req: Request, res: Response) => {
    try {
      const filesCollection = db.collection("fs.files");
      const files = await filesCollection
        .find({})
        .sort({ datefield: -1 })
        .toArray();

      const simplifiedFiles = files.map((file) => ({
        id: file._id.toString(),
        filename: file.filename,
        length: file.length,
        uploadDate: file.uploadDate,
      }));

      res.json(simplifiedFiles);
      console.log("Files retrieved successfully");
    } catch (error) {
      console.error("Failed to retrieve files:", error);
      return res.status(500).send("Failed to retrieve files");
    }
  });

  const handlePdf = (req: Request, res: Response, isViewOnly: boolean) => {
    const { fileId } = req.params;
    const _id = new ObjectId(fileId);

    let downloadStream = bucket.openDownloadStream(_id);

    downloadStream.on("file", (file) => {
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        `${isViewOnly ? `inline` : `attachment`}; filename="${file.filename}"`
      );
    });

    downloadStream.on("error", (error) => {
      console.error("Error during file download:", error);
      return res.status(404).send("File not found");
    });

    downloadStream.pipe(res);
  };

  router.get("/pdf/:fileId", (req: Request, res: Response) =>
    handlePdf(req, res, false)
  );

  // Assuming this is within the createPdfRoutes function

  router.get("/pdf/:fileId/view", (req: Request, res: Response) =>
    handlePdf(req, res, true)
  );

  return router;
};
