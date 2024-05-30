import nodemailer from "nodemailer";
import { TConfig } from "./config";
import appError from "../errors/apperror";
import { resMessage } from "../constants/response-data";

export interface IMailer {
  sendMail: (data: {
    email: string;
    subject: string;
    path: string;
    user: string;
    text: string;
    btn?: string;
  }) => Promise<void>;
}

class Mailer {
  private config: TConfig;
  constructor(config: TConfig) {
    this.config = config;
  }
  async sendMail(data: {
    email: string;
    subject: string;
    path: string;
    user: string;
    text: string;
    btn?: string;
  }) {
    try {
      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
        secure: false,
        auth: { user: this.config.email, pass: this.config.emailPassword },
        debug: false,
        logger: true,
      });

      await transporter.sendMail({
        from: `MyApp <${this.config.email}>`,
        to: data.email,
        subject: data.subject,
        html: `
                <div style="height: 20rem; text-align: center;">
                    <img src="https://drive.google.com/uc?export=view&id=1ic7bG6dkAV9C-ZWBdQj6bZ3vAzNumvYi"
                    alt="fim logo" style="min-width: 4rem; width: 24vw; max-width: 20vh;" />
                    <h3 style="margin: 3rem 0 1rem 0; font-weight: bolder; color: #28a0f6;">Hi, ${
                      data.user
                    }</h3>
                    <h4 style="margin-bottom: 2rem; color: #4b5563;">${data.text}</h4>
                    ${
                      data.btn
                        ? `<a style="padding: .75rem 2rem; background-color: #28a0f6; color: #ffff; border-radius: .5rem; text-decoration: none; font-weight: bolder;"
                            href="${this.config.frontendUrl + data.path}">${data.btn}</a>`
                        : ""
                    }
                </div>
            `,
      });

      console.log("Email has been sent");
    } catch (error) {
      throw appError.internalServer(new Error(resMessage.emailFailed), resMessage.emailFailed);
    }
  }
}

export default Mailer;
