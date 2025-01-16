/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
const sleep = require("sleep-promise");

const axios = require("axios");
const { MongoClient } = require("mongodb");
const moment = require("moment");

const uri = process.env.MONGODB_URL || "mongodb://localhost:27017";

async function getNewTransactions() {
    const client = new MongoClient(uri, { useNewUrlParser: true });
    console.log("getNewTransactions Task");
    try {
        // get last block from db
        await client.connect();
        const collectionCfg = client.db("admin").collection("orbDataCfg");
        const collection = client.db("admin").collection("orbBalance");
        const collectionUser = client.db("admin").collection("ontropyUsers");
        const lastBlockRecord = await collectionCfg.findOne({
            name: "lastBlock",
        });
        let dataProcessed = false;
        let lastBlock = lastBlockRecord
            ? lastBlockRecord.blockNumber
            : 37977199;
        console.log(`Last block is ${lastBlock}`);
        const blkResp = await axios.get("https://api.polygonscan.com/api", {
            params: {
                module: "block",
                action: "getblocknobytime",
                timestamp: moment().unix() - 60,
                closest: "before",
                apikey: "ZT9K787G5ECRWCCCN8EKDDQV91GW4KW1XD",
            },
        });
        const latestBlock = blkResp.data.result;
        let newLastBlock;
        console.log(`Latest block is ${latestBlock}`);
        // get new transactions from polyscan
        let blockIncrement = 20000;
        const usersCache = {};
        while (lastBlock < latestBlock) {
            await sleep(250); // ensure we dont hit the rate limit
            const response = await axios.get(
                "https://api.polygonscan.com/api",
                {
                    params: {
                        module: "account",
                        action: "txlist",
                        address: "0x995901A9dA56629bF69168265239Dc1ece73df4F",
                        startblock: lastBlock,
                        endblock: Math.min(
                            lastBlock + blockIncrement,
                            latestBlock
                        ),
                        sort: "asc",
                        apikey: "ZT9K787G5ECRWCCCN8EKDDQV91GW4KW1XD",
                    },
                }
            );
            if (response.data.result.length === 10000) {
                blockIncrement = Math.ceil(blockIncrement / 2);
                console.log("Result was at max, reducing block increment");
                continue;
            }

            console.log(
                `Got result from polyscan length ${response.data.result.length}`
            );
            lastBlock = Math.min(lastBlock + blockIncrement, latestBlock);
            newLastBlock = lastBlock;
            // loop through the transactions and calculate the balance
            if (response.data.result && response.data.result.length > 0) {
                dataProcessed = true;
                for (const transaction of response.data.result) {
                    if (
                        !transaction.blockNumber ||
                        !transaction.from ||
                        !transaction.functionName
                    ) {
                        console.log(`GOT STRANGE RESULT:${transaction}`);
                        continue;
                    }
                    if (transaction.blockNumber > newLastBlock) {
                        newLastBlock = transaction.blockNumber;
                    }
                    const transactionFrom = transaction.from.toUpperCase();
                    // const transactionTime = moment(transaction.timeStamp);
                    if (transaction.functionName.startsWith("Finish")) {
                        // check the user status from local cache
                        // if not in cache, get from db
                        // if not in db, set to default
                        let user = usersCache[transactionFrom];
                        if (!user) {
                            user = await collectionUser.findOne({
                                walletAddress: transactionFrom,
                            });
                            usersCache[transactionFrom] = user;
                        }
                        console.log("TX Finish:");
                        console.log(JSON.stringify(transaction));

                        let increment = 1;
                        if (user && user.userRank) {
                            if (
                                user.userRank === "Gold Ontrooper" ||
                                user.userRank === "Ontrooper"
                            ) {
                                increment = 2;
                            }
                        }
                        console.log(
                            `Updating balance for Init after the treshhold date \
                            ${transactionFrom} incrementing by ${increment}}`
                        );
                        collection.updateOne(
                            { transactionFrom },
                            { $inc: { balance: increment } },
                            { upsert: true }
                        );
                    }
                }
            }
            // update last block in db
            if (dataProcessed) {
                await collectionCfg.updateOne(
                    { name: "lastBlock" },
                    { $set: { blockNumber: newLastBlock } },
                    { upsert: true }
                );
            }
        }
        console.log(`New last block is ${newLastBlock}`);
    } catch (error) {
        console.log(error.message);
    } finally {
        await sleep(2000);
        client.close();
    }
}
const cron = require("node-cron");

cron.schedule("*/30 * * * * *", getNewTransactions);
// getNewTransactions();
