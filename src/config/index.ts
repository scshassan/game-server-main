import * as dotenv from "dotenv";

dotenv.config();

export const ENVIRONMENT: string = process.env.ENVIRONMENT!;
export const MONGODB_URL: string = process.env.MONGODB_URL!;
