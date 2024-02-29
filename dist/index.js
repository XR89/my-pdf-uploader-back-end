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
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const multer_1 = __importDefault(require("multer"));
const stream_1 = require("stream");
const pdf_1 = __importDefault(require("./models/pdf"));
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI;
const app = (0, express_1.default)();
app.set("view engine", "ejs");
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(port, () => {
    console.log(`listening on port ${port}`);
});
// Connect to MongoDB database
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => {
    console.log("Connected to MongoDB database successfully");
})
    .catch((error) => {
    console.error("Error occurred while connecting to MongoDB database", error);
});
let connection = mongoose_1.default.connection;
connection.on("open", () => {
    console.log("Connection established successfully");
    let bucket = new mongoose_1.default.mongo.GridFSBucket(connection.db);
    // Set up multer for memory storage
    const storage = multer_1.default.memoryStorage();
    const upload = (0, multer_1.default)({ storage });
    // Route to upload a file
    app.post("/upload", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.file)
            return res.status(400).send("No file uploaded");
        const { originalname, mimetype, buffer } = req.file;
        let newFile = new pdf_1.default({
            filename: originalname,
            contentType: mimetype,
            length: buffer.length,
        });
        try {
            let uploadStream = bucket.openUploadStream(originalname);
            let readBuffer = new stream_1.Readable();
            readBuffer._read = () => { };
            readBuffer.push(buffer);
            readBuffer.push(null);
            yield new Promise((resolve, reject) => {
                readBuffer
                    .pipe(uploadStream)
                    .on("finish", () => resolve("Successful"))
                    .on("error", () => reject("Error occurred while creating stream"));
            });
            newFile.id = uploadStream.id;
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
            res.status(500).send("Error uploading file");
        }
    }));
    // Route to get a list of all files
    app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const filesCollection = connection.db.collection("fs.files");
            // Find all files in the collection
            const files = yield filesCollection.find({}).toArray();
            const simplifiedFiles = files.map((file) => ({
                id: file._id,
                filename: file.filename,
                length: file.length,
                uploadDate: file.uploadDate,
            }));
            // Send the list of files to the frontend in a JSON format so I can then use the ID's to get individual files
            res.json(simplifiedFiles);
        }
        catch (error) {
            console.error("Failed to retrieve files:", error);
            res.status(500).send("Failed to retrieve files");
        }
    }));
    // Route to get an image by its file ID
    app.get("/pdf/:fileId", (req, res) => {
        const { fileId } = req.params;
        const _id = new mongodb_1.ObjectId(fileId);
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
