import { Schema, model } from "mongoose";
import { Model } from "mongoose";

export type TResetPassword = {
  role: string;
  email: string;
  token: string;
  created_at?: Date;
  expired_at: Date;
};

const resetPasswordSchema = new Schema<TResetPassword>({
  role: { type: String, required: true },
  email: { type: String, required: true },
  token: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  expired_at: { type: Date, default: () => Date.now() + 10 * 60 * 1000, expires: "10m" },
});

export type TResetPasswordModel = Model<TResetPassword>;
export default model<TResetPassword>("ResetPassword", resetPasswordSchema);
