import mongoose from "mongoose";

const sudokuScoreSchema = new mongoose.Schema({
  email: { type: String, required: true },
  nickname: { type: String, required: true },
  difficulty: { type: String, required: true },
  time: { type: Number, required: true },
  mistakes: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("SudokuScore", sudokuScoreSchema);
