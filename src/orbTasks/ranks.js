const fs = require("fs");
const csv = require("csv-parser");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGODB_URL =
    "mongodb+srv://doadmin:Q528id7Y1U694XlK@db-ontropy-main-c344c13a.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=db-ontropy-main";
const uri = MONGODB_URL;
const collectionName = "ontropyUsers";
const filePath = "alphaRanks.csv";

async function importCSV() {
    try {
        fs.createReadStream(filePath)
            .pipe(
                csv({ headers: ["userRank", "displayName", "walletAddress"] })
            )
            .on("data", async (data) => {
                const client = await MongoClient.connect(uri, {
                    useNewUrlParser: true,
                });
                const collection = client
                    .db("admin")
                    .collection(collectionName);
                const user = {
                    userRank: data.userRank,
                    displayName: data.displayName,
                    walletAddress: data.walletAddress.toUpperCase(),
                };
                if (!data.walletAddress || data.walletAddress === "") return;
                await collection.insertOne(user);
                client.close();
            })
            .on("end", () => {
                console.log("CSV Parsing Done");
            });
    } catch (error) {
        console.log(error);
    }
}
importCSV();
