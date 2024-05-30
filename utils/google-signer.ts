import { resMessage } from "../constants/response-data";
import { TGoogleAuthToken, TGoogleAuthUserResponse } from "../dtos/auth";
import apperror from "../errors/apperror";
import { TConfig } from "./config";

export interface IGoogleSigner {
  getToken: (authCode: string) => Promise<TGoogleAuthToken>;
  getUserData: (token: TGoogleAuthToken) => Promise<TGoogleAuthUserResponse>;
}

type TGooglePeople = {
  genders: { formattedValue: string }[];
};

export class GoogleSigner {
  private config: TConfig;
  constructor(config: TConfig) {
    this.config = config;
  }

  async getToken(code: string): Promise<TGoogleAuthToken> {
    const param = {
      code,
      client_id: this.config.googleId,
      client_secret: this.config.googleKey,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    };

    const url = "https://oauth2.googleapis.com/token?" + new URLSearchParams(param);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const token: TGoogleAuthToken = await res.json();
      if (!token.id_token) throw apperror.unauthorized(resMessage.invalidAuthCode);
      return token;
    } catch (error) {
      throw error;
    }
  }

  async getUserData(token: TGoogleAuthToken): Promise<TGoogleAuthUserResponse> {
    try {
      const userUrl = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=";
      const userRes = await fetch(userUrl + token.access_token, {
        headers: { Authorization: "Bearer " + token.id_token },
      });
      const userData: TGoogleAuthUserResponse = await userRes.json();
      if (!userData.email) throw apperror.unauthorized(resMessage.invalidGoogleScope);

      const peopleUrl =
        "https://people.googleapis.com/v1/people/me?personFields=genders%2Cbirthdays&access_token=";
      const peopleRes = await fetch(peopleUrl + token.access_token, {
        headers: { Authorization: "Bearer " + token.id_token },
      });
      const peopleData: TGooglePeople = await peopleRes.json();
      if (!peopleData.genders) throw apperror.unauthorized(resMessage.invalidGoogleScope);

      if (peopleData.genders.length > 0) {
        userData.gender = peopleData.genders[0].formattedValue;
      }
      return userData;
    } catch (error) {
      throw error;
    }
  }
}
