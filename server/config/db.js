import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDb = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log("Database connection successful");
    } catch (err) {
        console.error("Database connection failed:", err.message);
        process.exit(1);
    }
};

export default connectDb;