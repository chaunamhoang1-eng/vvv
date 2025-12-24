import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://two82361_db_uers:FOfvtiUFmYn91QVy@cluster0.n80wcex.mongodb.net/?appName=Cluster0",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    );
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.log("MongoDB Error:", err);
  }
};

export default connectDB;
