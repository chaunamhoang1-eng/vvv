import mongoose from "mongoose";

const sudokuScoreSchema = new mongoose.Schema({
  email: { type: String, default: "" },   // not required anymore
  nickname: { type: String, required: true },
  difficulty: { type: String, required: true },
  time: { type: Number, required: true },
  mistakes: { type: Number, required: true },
}, { timestamps: true });  // generates createdAt automatically

export default mongoose.model("SudokuScore", sudokuScoreSchema);
