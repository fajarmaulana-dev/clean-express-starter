export const cGender: Record<string, number> = {
  Male: 0,
  Female: 1,
};

export const cRole = {
  admin: "admin",
  access: ["readonly", "noaccess"],
};

export const cRoute = {
  method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

export const cDefaultAdditions = ["name", "password"];

export const cTokenLen = 32;
