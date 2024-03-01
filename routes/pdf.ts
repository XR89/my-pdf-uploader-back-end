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

      // Check if a file with the same name already exists
      const existingFile = await db
        .collection("fs.files")
        .findOne({ filename: originalname });
      if (existingFile) {
        return res
          .status(400)
          .send(
            "A file with the same name already exists. Please choose a different name."
          );
      }

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
        .sort({ uploadDate: -1 })
        .toArray();

      const simplifiedFiles = files.map((file) => ({
        id: file._id.toString(),
        filename: file.filename,
        length: file.length,
        uploadDate: file.uploadDate,
      }));

      res.json(simplifiedFiles);
    } catch (error) {
      console.error("Failed to retrieve files:", error);
      return res.status(500).send("Failed to retrieve files");
    }
  });

  // Extract the common logic for the two routes into a separate function
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

  router.get("/pdf/:fileId/view", (req: Request, res: Response) =>
    handlePdf(req, res, true)
  );

  router.delete("/pdf/:fileId/delete", async (req: Request, res: Response) => {
    const { fileId } = req.params;
    try {
      const _id = new ObjectId(fileId);

      // Use await to wait for the delete operation to complete
      await bucket.delete(_id);
      // If successful, send a success message
      res.send({ message: "File successfully deleted" });
    } catch (error) {
      const errorMessage = (error as Error).message;
      // Error handling for both the try-catch and the promise rejection
      console.error(
        "Error processing delete request or file not found:",
        error
      );
      if (errorMessage.includes("FileNotFound")) {
        return res.status(404).send("File not found");
      }
      return res.status(500).send("Internal server error");
    }
  });

  return router;
};
