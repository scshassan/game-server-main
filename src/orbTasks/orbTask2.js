/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
const sleep = require("sleep-promise");

const axios = require("axios");
const { MongoClient } = require("mongodb");
const moment = require("moment");
const { ethers, BigNumber } = require("ethers");

const MONGODB_URL =
    "mongodb+srv://doadmin:Q528id7Y1U694XlK@db-ontropy-main-c344c13a.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=db-ontropy-main";
async function getNewTransactions() {
    const client = new MongoClient(MONGODB_URL, { useNewUrlParser: true });
    console.log("getNewTransactions Task");
    try {
        // get last block from db
        await client.connect();
        const collectionCfg = client.db("admin").collection("orbDataCfg");
        const collectionBalance = client.db("admin").collection("orbBalance");
        const collectionUser = client.db("admin").collection("ontropyUsers");
        const lastBlockRecord = await collectionCfg.findOne({
            name: "lastBlock",
        });
        let dataProcessed = false;
        let lastPromise;
        let lastBlock = lastBlockRecord
            ? lastBlockRecord.blockNumber
            : 38269900;
        console.log(`Last block is ${lastBlock}`);
        const blkResp = await axios.get("https://api.polygonscan.com/api", {
            params: {
                module: "block",
                action: "getblocknobytime",
                timestamp: moment().unix() - 10,
                closest: "before",
                apikey: "ZT9K787G5ECRWCCCN8EKDDQV91GW4KW1XD",
            },
        });
        const latestBlock = blkResp.data.result;
        let newLastBlock;
        console.log(`Latest block is ${latestBlock}`);
        // get new transactions from polyscan
        let blockIncrement = 5000;
        const usersCache = {};
        const provider = new ethers.providers.JsonRpcProvider(
            "https://rpc-mainnet.maticvigil.com"
        );

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
                console.log(
                    `Result was at max, reducing block increment to ${blockIncrement}`
                );
                continue;
            }
            lastBlock = Math.min(lastBlock + blockIncrement, latestBlock);

            console.log(
                `Got result from polyscan length ${response.data.result.length}`
            );
            lastBlock = Math.min(lastBlock + blockIncrement, latestBlock);
            newLastBlock = lastBlock;
            const txs = response.data.result;
            console.log(`Got txs:${txs.length}`);
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                // console.log(`Processing tx: ${tx.functionName}`);

                if (tx.functionName.startsWith("Finish")) {
                    const txHash = tx.hash;
                    console.log(`Got tx Finish with hash ${txHash}`);
                    const receipt = await provider.getTransactionReceipt(
                        txHash
                    );

                    // print the logs array item's topics as hex string
                    if (receipt.logs[0].topics[2]) {
                        dataProcessed = true;
                        const txBlockNumber = receipt.logs[0].blockNumber;
                        lastBlock = txBlockNumber + 1;
                        const contragentWallet = BigNumber.from(
                            receipt.logs[0].topics[2]
                        )
                            .toHexString()
                            .toUpperCase();
                        console.log("contragentWallet:", contragentWallet);
                        let user = usersCache[contragentWallet];
                        // let user;
                        /*                       if (
                            !cachedUser ||
                            !cachedUser.cached ||
                            cachedUser.cached < Date.now() - 1000 * 60 * 30
                        ) { */
                        if (!user) {
                            user = await collectionUser.findOne({
                                walletAddress: contragentWallet,
                            });
                            // if (user) {
                            usersCache[contragentWallet] = user;
                            // usersCache[contragentWallet].cached = Date();
                            // cachedUser = usersCache[contragentWallet];
                            // }
                        }

                        let increment = 0;
                        if (
                            user &&
                            user.userRank &&
                            (user.userRank === "Gold Ontrooper" ||
                                user.userRank === "Chief Ontrooper" ||
                                user.userRank === "Ontrooper")
                        ) {
                            increment = 2;
                            console.log(
                                `Updating balance for Finish after the treshhold date ${contragentWallet} incrementing by ${increment}}`
                            );
                            /* lastPromise = */ await collectionBalance.updateOne(
                                { transactionFrom: contragentWallet },
                                { $inc: { balance: increment } },
                                { upsert: true }
                            );
                        }
                    }
                }
            }
            if (lastPromise) {
                await lastPromise;
            }

            // update last block in db
            if (dataProcessed) {
                console.log(`Updating lastblock to ${newLastBlock}`);
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
        // await sleep(2000);
        client.close();
    }
    await sleep(10000);
    getNewTransactions();
}
const cron = require("node-cron");

// cron.schedule("*/30 * * * * *", getNewTransactions);
getNewTransactions();
