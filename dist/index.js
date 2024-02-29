"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const pdf_1 = require("./routes/pdf"); // Adjust the import path as necessary
const cors_1 = __importDefault(require("cors")); // Import cors
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI;
const app = (0, express_1.default)();
app.set("view engine", "ejs");
app.use((0, cors_1.default)());
const port = parseInt(process.env.PORT || "3000");
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => {
    console.log("Connected to MongoDB database successfully");
    const pdfRoutes = (0, pdf_1.createPdfRoutes)(mongoose_1.default.connection.db);
    app.use(pdfRoutes);
    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
})
    .catch((error) => {
    console.error("Error occurred while connecting to MongoDB database", error);
});
