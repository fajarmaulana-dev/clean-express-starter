import { Schema, model } from "mongoose";
import mongooseUniqueValidator from "mongoose-unique-validator";
import { Model } from "mongoose";

export type TUserAddition = {
  name: string;
  validations: {
    message: string;
    method: string;
    validator: string;
  }[];
};

export type TRole = {
  name: string;
  additions: TUserAddition[];
  limits: { page: string; access: "readonly" | "noaccess" }[];
  registration: { approvement: boolean; whitelist: string[] };
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
};

const roleKeySchema = new Schema<TUserAddition>({
  name: { type: String, required: true },
  validations: [{ message: String, method: String, validator: String }],
});

const roleSchema = new Schema<TRole>({
  name: { type: String, required: true, unique: true },
  additions: [roleKeySchema],
  limits: [{ page: String, access: String }],
  registration: { approvement: { type: Boolean, default: false }, whitelist: [String] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

roleSchema.plugin(mongooseUniqueValidator);

export type TRoleModel = Model<TRole>;
export default model<TRole>("Role", roleSchema);
