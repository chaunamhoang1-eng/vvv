import express from "express";
import multer from "multer";

const router = express.Router();

// Configure file storage
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Upload Endpoint
router.post("/upload", upload.single("file"), (req, res) => {

  // Fake plagiarism percent (for testing)
  const fakePercentage = Math.floor(Math.random() * 40) + 1;

  res.json({
    status: "success",
    file: req.file.filename,
    plagiarism: `${fakePercentage}%`
  });
});

export default router;
