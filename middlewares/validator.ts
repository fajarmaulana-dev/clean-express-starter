import { Request } from "../types";
import { ValidationChain, body, check, validationResult } from "express-validator";
import appError from "../errors/apperror";
import { NextFunction, Response } from "express";
import { IRoleRepository } from "../repositories/role";
import { TRegisterRequest } from "../dtos/auth";
import { resMessage } from "../constants/response-data";

type TValidationError = {
  errors: { msg: string }[];
};

export class Validator {
  private password: (name?: string) => ValidationChain[];
  private email: (name?: string) => ValidationChain[];
  private required: (name: string) => ValidationChain;
  private mustFilled: (name: string) => ValidationChain;
  private isList: (name: string) => ValidationChain;
  private isIn: (name: string, items: string[]) => ValidationChain;
  private isStr: (name: string) => ValidationChain;
  private isBool: (name: string) => ValidationChain;
  private isNum: (name: string) => ValidationChain;
  private isInt: (name: string) => ValidationChain;
  private isOpt: (name: string) => ValidationChain;
  private roleRepository: IRoleRepository;

  constructor(roleRepository: IRoleRepository) {
    this.roleRepository = roleRepository;
    this.isOpt = (name: string) => check(name).optional();
    this.isStr = (name) =>
      check(name, `${name.replace(/(.*)\./g, "")} must be a string`).isString();
    this.isBool = (name) =>
      check(name, `${name.replace(/(.*)\./g, "")} must be a boolean`).isBoolean();
    this.isNum = (name) =>
      check(name, `${name.replace(/(.*)\./g, "")} must be a number`).isNumeric();
    this.isInt = (name) => check(name, `${name.replace(/(.*)\./g, "")} must be a integer`).isInt();
    this.required = (name) => check(name, `${name.replace(/(.*)\./g, "")} is required`).exists();
    this.mustFilled = (name) =>
      check(name, `${name.replace(/(.*)\./g, "")} cannot be empty`).notEmpty();
    this.isIn = (name, items) => {
      let strItems = "";
      items.forEach((i, idx) =>
        idx == items.length - 1
          ? (strItems += `"${i}"`)
          : idx == items.length - 2
          ? (strItems += `"${i}", or `)
          : (strItems += `"${i}", `)
      );
      return check(name, `${name.replace(/(.*)\./g, "")} value is either ${strItems}`).isIn(items);
    };
    this.isList = (name) =>
      check(name, `${name.replace(/(.*)\./g, "")} must be an array`).isArray();
    this.password = (name = "password") => [
      this.required(name),
      check(name, "password cannot be empty").notEmpty(),
      check(name, "password must contain at least 1 uppercase").matches(/[A-Z]/),
      check(name, "password must contain at least 1 lowercase").matches(/[a-z]/),
      check(name, "password must contain at least 1 number").matches(/\d/),
      check(name, "password must contain at least 1 special characters").matches(/[\W+_]/),
      check(name, "password must contain at least of 8 characters").matches(/.{8,}/),
      check(name, "password cannot contain space").matches(/^\S+$/),
    ];
    this.email = (name: string = "email") => [
      this.required(name),
      check(name, "email cannot be empty").notEmpty(),
      check(name, "email must be valid").matches(/^[\w.]+@([\w-]+\.)+[\w]{2,4}$/),
    ];
  }

  private validate = (rules: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      await Promise.all(rules.map((r) => r.run(req)));
      const error: unknown = validationResult(req);
      const errors: string[] = [];
      let iter = 0;
      for (const e of (error as TValidationError).errors) {
        if (e.msg.includes("required")) {
          errors.splice(iter, 0, e.msg);
          iter++;
          continue;
        }
        errors.push(e.msg);
      }
      const errorMsg: string[] = [];
      const errSet = new Set();
      for (const e of errors) {
        const key = e.split(" ")[0];
        if (errSet.has(key)) continue;
        errSet.add(key);
        errorMsg.push(e);
      }
      if (errorMsg.length > 0)
        next(appError.badRequest(errorMsg.map((e, idx) => `${idx + 1}. ${e}.`).join("\n")));
      next();
    };
  };

  register = async (req: Request<TRegisterRequest>, res: Response, next: NextFunction) => {
    const { role } = req.body;
    if (!role) {
      next(appError.badRequest(resMessage.requireRole));
      return;
    }
    const roleConfig = await this.roleRepository.findOneByName(role);
    if (!roleConfig) {
      next(appError.notFound(resMessage.roleIsNotFound));
      return;
    }

    const rules: ValidationChain[] = [
      ...this.email(),
      this.required("additions"),
      this.required("additions.name"),
      this.mustFilled("additions.name"),
      check("additions.picture").optional().isURL().withMessage("picture must be a valid url"),
      ...this.password("additions.password"),
    ];

    roleConfig.additions.forEach((key) => {
      key.validations.forEach((ve) => {
        const rule = body(`additions.${key.name}`);
        switch (ve.method) {
          case "exists":
            rule.exists();
            break;
          case "isString":
            rule.isString();
            break;
          case "isBoolean":
            rule.isBoolean();
            break;
          case "notEmpty":
            rule.notEmpty();
            break;
          case "match":
            const pattern = new RegExp(ve.validator);
            rule.matches(pattern);
            break;
          case "isIn":
            const arr = JSON.parse(ve.validator);
            rule.isIn(arr);
            break;
        }
        rule.withMessage(ve.message);
        rules.push(rule);
      });
    });

    const validator = this.validate(rules);
    validator(req, res, next);
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    const validator = this.validate([this.required("token"), this.mustFilled("token")]);
    validator(req, res, next);
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    const rules = [
      this.required("email"),
      this.mustFilled("email"),
      this.required("password"),
      this.mustFilled("password"),
    ];
    const validator = this.validate(rules);
    validator(req, res, next);
  };

  googleAuth = async (req: Request, res: Response, next: NextFunction) => {
    const rules = [
      this.required("role"),
      this.mustFilled("role"),
      this.required("auth_code"),
      this.mustFilled("auth_code"),
    ];
    const validator = this.validate(rules);
    validator(req, res, next);
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    const validator = this.validate([...this.password()]);
    validator(req, res, next);
  };

  verifyPassword = async (req: Request, res: Response, next: NextFunction) => {
    const validator = this.validate([this.required("password"), this.mustFilled("password")]);
    validator(req, res, next);
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    const validator = this.validate([
      this.required("role"),
      this.mustFilled("role"),
      this.required("email"),
      this.mustFilled("email"),
    ]);
    validator(req, res, next);
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    const validator = this.validate([
      this.required("role"),
      this.mustFilled("role"),
      this.required("email"),
      this.mustFilled("email"),
      this.required("token"),
      this.mustFilled("token"),
      ...this.password(),
    ]);
    validator(req, res, next);
  };

  role = async (req: Request, res: Response, next: NextFunction) => {
    const validationMethods = ["exists", "isString", "isBoolean", "notEmpty", "match", "isIn"];
    const rules = [
      this.required("name"),
      this.mustFilled("name"),
      this.isList("additions"),
      this.required("additions.*.name"),
      this.mustFilled("additions.*.name"),
      this.required("additions.*.validations"),
      this.isStr("additions.*.validations.*.message"),
      this.isIn("additions.*.validations.*.method", validationMethods),
      this.isOpt("additions.*.validations.*.validator")
        .notEmpty()
        .withMessage("validator cannot be empty"),
      this.isList("limits"),
      this.required("limits.*.page"),
      this.isStr("limits.*.page"),
      this.required("limits.*.access"),
      this.isStr("limits.*.access"),
      this.required("registration"),
      this.isBool("registration.approvement"),
      this.isList("registration.whitelist"),
      this.isOpt("registration.whitelist.*")
        .isString()
        .withMessage("whitelist items must be a string"),
    ];
    const validator = this.validate(rules);
    validator(req, res, next);
  };

  route = async (req: Request, res: Response, next: NextFunction) => {
    const rules = [
      this.required("name"),
      this.mustFilled("name"),
      this.isList("restrictions"),
      this.isIn("restrictions.*.method", ["GET", "POST", "PATCH", "PUT", "DELETE"]),
      this.isList("restrictions.*.roles"),
      this.isOpt("restrictions.*.roles.*").isString().withMessage("roles items must be a string"),
    ];
    const validator = this.validate(rules);
    validator(req, res, next);
  };
}
