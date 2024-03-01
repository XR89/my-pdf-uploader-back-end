"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPdfRoutes = void 0;
// pdfRoutes.ts
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const stream_1 = require("stream");
const mongodb_1 = require("mongodb");
const pdf_1 = require("../models/pdf"); // Adjust the path as necessary
const mongodb_2 = require("mongodb");
const createPdfRoutes = (db) => {
    const router = express_1.default.Router();
    const bucket = new mongodb_2.GridFSBucket(db);
    console.log("Bucket set up successfully, handing to routes...");
    // Set up multer for memory storage
    const storage = multer_1.default.memoryStorage();
    const upload = (0, multer_1.default)({ storage });
    router.post("/upload", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.file) {
            return res.status(400).send("No file uploaded");
        }
        // Buffer is the raw data of the file
        const { originalname, mimetype, buffer } = req.file;
        // Check if a file with the same name already exists
        const existingFile = yield db
            .collection("fs.files")
            .findOne({ filename: originalname });
        if (existingFile) {
            return res
                .status(400)
                .send("A file with the same name already exists. Please choose a different name.");
        }
        let newFile = new pdf_1.PdfModel({
            filename: originalname,
            contentType: mimetype,
            length: buffer.length,
        });
        try {
            let uploadStream = bucket.openUploadStream(originalname);
            let readBuffer = new stream_1.Readable();
            readBuffer._read = () => { };
            // Push the buffer (file binary data) to the read buffer for upload
            readBuffer.push(buffer);
            // Null reference denotes the end of the file (EOF)
            readBuffer.push(null);
            // this promise is what actually carries out the upload with the readBuffer being pushed up the uploadStream pipe
            yield new Promise((resolve, reject) => {
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
            let savedFile = yield newFile.save();
            if (!savedFile) {
                return res.status(404).send("Error occurred while saving the file");
            }
            return res.send({
                file: savedFile,
                message: "File uploaded successfully",
            });
        }
        catch (err) {
            return res.status(500).send("Error uploading file");
        }
    }));
    router.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const filesCollection = db.collection("fs.files");
            const files = yield filesCollection
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
            console.log("Files retrieved successfully");
        }
        catch (error) {
            console.error("Failed to retrieve files:", error);
            return res.status(500).send("Failed to retrieve files");
        }
    }));
    const handlePdf = (req, res, isViewOnly) => {
        const { fileId } = req.params;
        const _id = new mongodb_1.ObjectId(fileId);
        let downloadStream = bucket.openDownloadStream(_id);
        downloadStream.on("file", (file) => {
            res.set("Content-Type", "application/pdf");
            res.set("Content-Disposition", `${isViewOnly ? `inline` : `attachment`}; filename="${file.filename}"`);
        });
        downloadStream.on("error", (error) => {
            console.error("Error during file download:", error);
            return res.status(404).send("File not found");
        });
        downloadStream.pipe(res);
    };
    router.get("/pdf/:fileId", (req, res) => handlePdf(req, res, false));
    // Assuming this is within the createPdfRoutes function
    router.get("/pdf/:fileId/view", (req, res) => handlePdf(req, res, true));
    // Add this inside the createPdfRoutes function
    router.delete("/pdf/:fileId/delete", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { fileId } = req.params;
        console.log("File ID to delete:", fileId);
        try {
            const _id = new mongodb_1.ObjectId(fileId);
            // Use await to wait for the delete operation to complete
            yield bucket.delete(_id);
            // If successful, send a success message
            res.send({ message: "File successfully deleted" });
        }
        catch (error) {
            const errorMessage = error.message;
            // Error handling for both the try-catch and the promise rejection
            console.error("Error processing delete request or file not found:", error);
            if (errorMessage.includes("FileNotFound")) {
                return res.status(404).send("File not found");
            }
            return res.status(500).send("Internal server error");
        }
    }));
    return router;
};
exports.createPdfRoutes = createPdfRoutes;
