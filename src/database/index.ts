import mongoose from "mongoose";
import { MONGODB_URL } from "../config";

export async function connectToDB() {
  const dbName = process.env.ENVIRONMENT || "development";
  const baseConnectionString = MONGODB_URL.split("/admin")[0];
  const connectionStringOptions = MONGODB_URL.split("?")[1] || "";
  const connectionString = `${baseConnectionString}/${dbName}?${connectionStringOptions}`;
  console.log("connection string: ", connectionString);
  await mongoose.connect(connectionString);

  console.log(`Connected to MongoDB using Mongoose: ${dbName}`);
}
