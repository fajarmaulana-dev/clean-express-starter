import { Schema, model } from "mongoose";
import mongooseUniqueValidator from "mongoose-unique-validator";
import { Model } from "mongoose";

export type TUserRole = { name: string; additions: Map<string, any> };
export type TUser = {
  email: string;
  verify_email_token: string | null;
  addresses: string[];
  roles: TUserRole[];
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
  expired_at?: Date | null;
};

const userSchema = new Schema<TUser>({
  email: { type: String, required: true, unique: true },
  verify_email_token: String,
  addresses: [String],
  roles: [{ name: String, additions: { type: Map, of: Schema.Types.Mixed } }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
  expired_at: { type: Date, default: () => Date.now() + 3 * 24 * 60 * 60 * 1000, expires: "3d" },
});

userSchema.plugin(mongooseUniqueValidator);

export type TUserAddition = {
  gender: number;
};

export type TUserModel = Model<TUser>;
export default model<TUser>("User", userSchema);
