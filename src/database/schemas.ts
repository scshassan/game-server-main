import { Schema, model } from "mongoose";

const ActionSchema = new Schema(
  {
    walletAddress: String,
    actionType: String,
    actionDate: Date,
  },
  { collection: "ontropyActions2" }
);

const UserSchema = new Schema(
  {
    walletAddress: String,
    userRank: String,
  },
  { collection: "ontropyUsers" }
);

const BalanceSchema = new Schema(
  {
    transactionFrom: String,
    balance: Number,
  },
  { collection: "orbBalance" }
);

// Create models from schemas
const Action = model("ontropyActions2", ActionSchema);
const User = model("ontropyUsers", UserSchema);
const Balance = model("orbBalance", BalanceSchema);

export { Action, User, Balance };
