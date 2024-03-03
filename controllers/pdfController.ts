import { Request, Response } from "express";
import { Readable } from "stream";
import { ObjectId, GridFSBucket, Db } from "mongodb";
import { PdfModel } from "../models/pdf";

export const uploadPdf =
  (db: Db, bucket: GridFSBucket) => async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }
    const { originalname, mimetype, buffer } = req.file;

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
      readBuffer.push(buffer);
      readBuffer.push(null);

      await new Promise((resolve, reject) => {
        readBuffer
          .pipe(uploadStream)
          .on("finish", () => resolve("Successful"))
          .on("error", () => reject("Error occurred while creating stream"));
      });

      newFile.gridFSId = uploadStream.id;
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
  };

export const listPdfs = (db: Db) => async (req: Request, res: Response) => {
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
    res.status(500).send("Failed to retrieve files");
  }
};

export const viewPdf = (
  bucket: GridFSBucket,
  req: Request,
  res: Response,
  isViewOnly: boolean
) => {
  const { fileId } = req.params;
  const _id = new ObjectId(fileId);

  let downloadStream = bucket.openDownloadStream(_id);

  downloadStream.on("file", (file) => {
    res.set("Content-Type", "application/pdf");
    res.set(
      "Content-Disposition",
      `${isViewOnly ? "inline" : "attachment"}; filename="${file.filename}"`
    );
  });

  downloadStream.on("error", (error) => {
    console.error("Error during file download:", error);
    res.status(404).send("File not found");
  });

  downloadStream.pipe(res);
};

export const deletePdf =
  (bucket: GridFSBucket) => async (req: Request, res: Response) => {
    const { fileId } = req.params;

    try {
      const _id = new ObjectId(fileId);
      await bucket.delete(_id);
      await PdfModel.deleteOne({ gridFSId: _id });
      res.send({ message: "File and document successfully deleted" });
    } catch (error) {
      console.error("Error processing delete request:", error);
      res.status(500).send("Internal server error");
    }
  };
