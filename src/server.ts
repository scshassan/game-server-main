let createServer: any;

import { Timer } from "easytimer.js";
import { readFileSync } from "fs";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { GameData, GameStages, PlacedChip, Winner } from "./Global";
import { MONGODB_URL, ENVIRONMENT } from "./config";
import { connectToDB } from "./database";
import { calculateWinnings } from "./utils/helpers";
import { Action, User } from "./database/schemas";
import ShortUniqueId from "short-unique-id";

console.log("ENVIRONMENT: " + ENVIRONMENT);

let httpServer;
if (ENVIRONMENT === "development") {
  createServer = require("http").createServer;
  httpServer = createServer();
} else {
  createServer = require("https").createServer;
  httpServer = createServer({
    key: readFileSync("/etc/letsencrypt/live/ontropy.io-0001/privkey.pem"),
    cert: readFileSync("/etc/letsencrypt/live/ontropy.io-0001/fullchain.pem"),
  });
}

console.log("MONGO URL:" + MONGODB_URL);
connectToDB();

/** Server Handling */
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.ENVIRONMENT === "development"
        ? "http://localhost:3000"
        : "https://alpha.ontropy.io",
      "https://ontropy.io",
      "https://www.ontropy.io",
      "https://alpha.ontropy.io",
      "http://192.168.1.4:3000",
      "https://www.alpha.ontropy.io",
    ],
  },
});
var timer = new Timer();
var users: Map<string, string> = new Map();
let gameData = {} as GameData;
let usersData = new Map<
  string,
  { commitment: string; bets: PlacedChip[]; result?: number; missed: number }
>();
let wins = [] as Winner[];
const MAX_USERS_PER_GROUP = 3;
let rng_users: any[][] = [];
var round = 0;

timer.addEventListener("secondsUpdated", function (e: any) {
  var currentSeconds = timer.getTimeValues().seconds;
  gameData.time_remaining = currentSeconds;
  if (currentSeconds == 1) {
    round++;
    if (round % 10 == 0) {
      try {
        if (global.gc) {
          global.gc();
        }
      } catch (e) {
        console.log("`node --expose-gc index.js`");
      }
    }
    // First - clean up all rng users
    rng_users = [];
    // clean commitments for all users
    for (let key of Array.from(usersData.keys())) {
      var userData = usersData.get(key);
      if (userData != undefined) {
        userData.commitment = "";
        userData.bets = [];
        usersData.set(key, userData);
        //usersData[key] = userData;
      }
    }
    console.log("Place bet");
    console.log("Users data: " + JSON.stringify(usersData));
    let filteredUsers = [];
    for (let [key, userData] of usersData.entries()) {
      if (userData.missed === undefined || userData.missed < 3) {
        filteredUsers.push([key, userData]);
      }
    }
    console.log("Filtered users: " + JSON.stringify(filteredUsers));

    // Split users into groups
    let group: string[] = [];
    filteredUsers.forEach(([walletAddress, user], index) => {
      group.push(walletAddress);

      if (
        (index + 1) % MAX_USERS_PER_GROUP === 0 ||
        index === filteredUsers.length - 1
      ) {
        if (group.length > 0) rng_users.push(group);
        group = [];
      }
    });
    // Send the groups to the clients
    io.emit("groups2", JSON.stringify(rng_users));

    gameData.stage = GameStages.PLACE_BET;
    wins.length = 0;
    const uid = new ShortUniqueId({ length: 4 });
    gameData.id = uid(); //uuid();
    sendStageEvent(gameData);
  } else if (currentSeconds == 10) {
    gameData.stage = GameStages.NO_MORE_BETS;
    console.log("No more bets");
    console.log("RNG users: " + JSON.stringify(rng_users));
    //console.log("UserData: " + JSON.stringify(usersData));
    sendStageEvent(gameData);
  } else if (currentSeconds == 20) {
    gameData.stage = GameStages.ROLL;
    sendStageEvent(gameData);
  } else if (currentSeconds == 30) {
    for (let key of Array.from(usersData.keys())) {
      if (key != undefined) {
        var userData = usersData.get(key);
        if (userData != undefined) {
          var chipsPlaced = userData.bets as PlacedChip[];
          if (userData.commitment === "" || userData.commitment == undefined) {
            if (userData.missed == undefined) {
              userData.missed = 1;
              console.log("User missed: " + key);
            } else {
              userData.missed += 1;
            }
          }
          console.log(
            "Calculating winnings for user: " +
              key +
              " with result: " +
              userData.result +
              " and chips: " +
              JSON.stringify(chipsPlaced)
          );
          var sumWon = calculateWinnings(userData.result, chipsPlaced);
          if (sumWon > 0) {
            wins.push({
              username: key as string,
              sum: sumWon,
            });
            // shrink wins to 30 entries
            if (wins.length > 30) {
              wins.shift();
            }
          }
        }
      }
    }

    console.log("Winners");
    gameData.stage = GameStages.WINNERS;
    // sort winners desc
    if (gameData.history == undefined) {
      gameData.history = [];
    }
    gameData.history.push(gameData.value);

    if (gameData.history.length > 10) {
      gameData.history.shift();
    }
    gameData.wins = wins.sort((a, b) => b.sum - a.sum);
    sendStageEvent(gameData);
    rng_users = [];
  } else if (currentSeconds == 35) {
    timer.reset();
  }
});

io.on("connection", (socket) => {
  const actions = ["enter4", "commitment3"];

  actions.forEach((action) => {
    socket.on(action, (data: string) => {
      handleSocketEvent(socket, action, data);
    });
  });

  socket.on("place-bet2", (data: string) => {
    if (socket.handshake.auth.address == undefined) return;
    console.log("Got bet: " + data);
    var gameData = JSON.parse(data) as PlacedChip[];
    var userData = usersData.get(socket.handshake.auth.address);
    if (userData != undefined) {
      userData.bets = gameData;
      usersData.set(<string>socket.handshake.auth.address, userData);
      checkLimit(socket.handshake.auth.address).then((limit) => {
        console.log(
          "Checking limit for " +
            socket.handshake.auth.address +
            " is: " +
            limit
            ? "yes"
            : "no"
        );
        registerAction(socket.handshake.auth.address);
        //if (limit) increaseBalance(socket.handshake.auth.address);
      });
    }
  });
  socket.on("result2", (data: string) => {
    if (socket.handshake.auth.address == undefined) return;
    console.log("Got result: " + data);
    var gameData = JSON.parse(data) as GameData;
    var userData = usersData.get(socket.handshake.auth.address);
    if (userData != undefined) {
      userData.result = gameData[1];
      //usersData.set(socket.handshake.auth.address, userData);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(
      "Disconnecting: " + reason + " " + socket.handshake.auth.address
    );
    if (socket.handshake.auth.address == undefined) return;
    //delete (<any>users)[socket.handshake.auth.address];
    //delete (<any>usersData)[socket.handshake.auth.address];
    users.delete(socket.handshake.auth.address);
    usersData.delete(socket.handshake.auth.address);
  });
});

async function registerAction(addrSock: string) {
  // addr from addrSock as string before _ is the wallet address
  let addr = addrSock.split("_")[0];
  try {
    // add action to db
    const action = new Action({
      walletAddress: addr.toUpperCase(),
      actionType: "bet",
      actionDate: new Date(),
    });
    await action.save();
    console.log("Registering action for " + addr.toUpperCase());
  } catch (error) {
    console.log("MongoError: " + error);
    return;
  }
}

async function increaseBalance(addrSock: string) {
  // addr from addrSock as string before _ is the wallet address
  let addr = addrSock.split("_")[0];
  try {
    const userResult = await User.findOne({
      transactionFrom: addr.toUpperCase(),
    });
    if (userResult) {
      let inc = 1;
      console.log("Incr balance for " + addr.toLocaleUpperCase());
      await User.updateOne(
        { transactionFrom: addr.toUpperCase() },
        { $inc: { balance: inc } }
      );
    }
    {
      console.log("Insert balance for " + addr.toLocaleUpperCase());
      const newUser = new User({
        transactionFrom: addr.toUpperCase(),
        balance: 1,
      });
      await newUser.save();
    }
  } catch (error) {
    console.log("MongoError: " + error);
    return;
  }
}

async function checkLimit(addrComplete: string) {
  //addr is substr before _ from addrComplete
  let addr = addrComplete.split("_")[0];
  try {
    // get user rank
    const userResult = await User.findOne({
      walletAddress: addr.toUpperCase(),
    });
    const userRank = userResult ? userResult.userRank : "Tester";
    // actions for last 24 hours
    const existingResult = Action.find({
      walletAddress: addr.toUpperCase(),
      actionDate: {
        $gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
      },
    });
    const actions = await existingResult.exec();
    const actionsCount = actions.length;

    const existingChiefResult = Action.find({
      walletAddress: addr.toUpperCase(),
      actionDate: {
        $gte: new Date(new Date().getTime() - 15 * 60 * 1000),
      },
    });
    const actionsChief = await existingChiefResult.exec();
    const actionsChiefCount = actionsChief.length;

    console.log(" [Actions count: " + actionsCount + " for user " + addr);

    if (userRank === "Ontrooper" && actionsCount < 100) {
      return true;
    }
    if (userRank === "Chief Ontrooper" && actionsChiefCount < 10) {
      return true;
    }
    if (userRank === "Gold Ontrooper" && actionsCount < 150) {
      return true;
    }
  } catch (error) {
    console.log("MongoError: " + error);
    return false;
  }
  return false;
}

function handleSocketEvent(socket: any, eventType: string, data: string) {
  if (socket.handshake.auth.address == undefined) return;
  let userData = usersData[socket.handshake.auth.address];

  switch (eventType) {
    case "enter4":
      console.log(" [ User " + socket.handshake.auth.address + " connected ]");
      //(<any>users)[socket.handshake.auth.address] = data;
      const newUser = { commitment: "", bets: [], missed: 0 };
      (<any>usersData)[socket.handshake.auth.address] = newUser;
      usersData.set(<string>socket.handshake.auth.address.toString(), newUser);
      //users.set(socket.handshake.auth.address.toString(), data);
      console.log("New UserData " + JSON.stringify(usersData));
      sendStageEvent(gameData);
      break;

    case "commitment3":
      console.log(
        "Received commitment from " +
          socket.handshake.auth.address +
          " commitment:" +
          data
      );
      let commitment = {};
      try {
        let commitment = JSON.parse(data);
        if (userData && socket.handshake.auth.address) {
          userData.commitment = commitment;
          usersData[socket.handshake.auth.address] = userData; //.set(socket.handshake.auth.address, userData);
          emitAck("commitment-relay2", socket, data);
        } else {
          console.log(
            "Could not find userData for " + socket.handshake.auth.address
          );
        }
      } catch (e) {
        console.log(
          "Could not parse commitment from " +
            socket.handshake.auth.address +
            " commitment:" +
            data
        );
      }
      break;
    case "result2":
      console.log(
        "Recieved result from " +
          socket.handshake.auth.address +
          " result:" +
          data
      );
  }
}

function emitAck(eventType: string, socket: any, data: any) {
  io.emit(
    eventType,
    JSON.stringify({ username: socket.handshake.auth.address, data })
  );
  console.log("Ack " + eventType + " from " + socket.handshake.auth.address);
}

let srvPORT = 8123;
httpServer.listen(srvPORT, () => {
  console.log(`Server is running on port ` + srvPORT);
  timer.start({ precision: "seconds" });
});

function sendStageEvent(_gameData: GameData) {
  var json = JSON.stringify(_gameData);
  console.log(json);
  io.emit("stage-change2", json);
}
