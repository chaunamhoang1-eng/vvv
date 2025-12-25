import bcrypt from "bcrypt";
import Admin from "./models/Admin.js";
import connectDB from "./db.js";

await connectDB();

const hashed = await bcrypt.hash("admin123", 10);

await Admin.create({
  email: "admin@plagx.com",
  password: hashed
});

console.log("Admin created");
process.exit();
