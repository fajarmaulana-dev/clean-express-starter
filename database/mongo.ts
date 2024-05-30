import { TConfig } from "../utils/config";
import { set, connect } from "mongoose";

export const connectDB = async (config: TConfig) => {
  set("strictQuery", false);
  try {
    connect(config.dbUrl);
  } catch (error) {
    throw error;
  }
};
