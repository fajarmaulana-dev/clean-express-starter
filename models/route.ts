import { Schema, model } from "mongoose";
import mongooseUniqueValidator from "mongoose-unique-validator";
import { Model } from "mongoose";

export type TRoute = {
  name: string;
  restrictions: { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; roles: string[] }[];
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
};

const routeSchema = new Schema<TRoute>({
  name: { type: String, required: true, unique: true },
  restrictions: [{ method: String, roles: [String] }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

routeSchema.plugin(mongooseUniqueValidator);

export type TRouteModel = Model<TRoute>;
export default model<TRoute>("Route", routeSchema);
