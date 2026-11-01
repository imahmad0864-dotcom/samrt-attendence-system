import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";

const port = Number(process.env.PORT || 5000);

try {
  await connectDB();
  app.listen(port, () => {
    console.log(`Express API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Could not start server:", error.message);
  process.exit(1);
}
