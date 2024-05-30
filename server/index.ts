import { connectDB } from "../database/mongo";
import express, { ErrorRequestHandler } from "express";
import appError from "../errors/apperror";
import { unlink } from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { resCode, resMessage } from "../constants/response-data";
import { TConfig } from "../utils/config";
import { Routes } from "./routes";

const init = async (config: TConfig | string) => {
  if (typeof config == "string") {
    console.log(`this env ${config} are undefined`);
    process.exit(1);
  }

  const app = express();
  const routes = new Routes(config);

  app.use(cors({ origin: true, credentials: true }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(cookieParser());

  app.use("/auth", routes.authRoute());

  app.get("/", (_, res) => {
    res.status(resCode.OK).json({ message: resMessage.OK });
  });

  app.use(() => {
    throw appError.notFound(resMessage.routeIsNotFound);
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (req.file) unlink(req.file.path, (err) => console.log(err));
    if (res.headersSent) return next(error);
    if (!(error instanceof appError.AppError)) {
      console.log(error);
      process.exit(1);
    }
    if (error.code == resCode.InternalServerError) console.log(error.error);
    res.status(error.code).json({ message: error.message });
  };

  app.use(errorHandler);

  try {
    await connectDB(config);
    app.listen(config.port, () => console.log(`Server is Fire at http://localhost:${config.port}`));
  } catch (error) {
    console.log(error);
  }
};

export default { init };
