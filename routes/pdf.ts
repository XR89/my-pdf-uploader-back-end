import express from "express";
import multer from "multer";
import { Db, GridFSBucket } from "mongodb";
import * as pdfController from "../controllers/pdfController";

export const createPdfRoutes = (db: Db) => {
  const router = express.Router();
  const bucket = new GridFSBucket(db);

  // Set up multer for memory storage
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // PDF Upload
  router.post(
    "/upload",
    upload.single("file"),
    pdfController.uploadPdf(db, bucket)
  );

  // List PDFs
  router.get("/", pdfController.listPdfs(db));

  // View PDF
  router.get("/pdf/:fileId/view", (req, res) =>
    pdfController.viewPdf(bucket, req, res, true)
  );

  // Download PDF
  router.get("/pdf/:fileId", (req, res) =>
    pdfController.viewPdf(bucket, req, res, false)
  );

  // Delete PDF
  router.delete("/pdf/:fileId/delete", pdfController.deletePdf(bucket));

  return router;
};
