/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
const sleep = require("sleep-promise");

const axios = require("axios");
const { MongoClient } = require("mongodb");
const moment = require("moment");

const uri = process.env.MONGODB_URL || "mongodb://localhost:27017";

let lastPromise;
async function orbExport() {
    const client = new MongoClient(uri, { useNewUrlParser: true });
    console.log("Initial export Task");
    try {
        await client.connect();
        const collection = client.db("admin").collection("orbBalance");
        // if there's no recent result, make the API call
        let page = 0;
        const increment = 0;
        const BLOCKS_PER_REQUEST = 20000;
        const CONTRACT_START_BLOCK = 31706490;
        const ORB_END_BLOCK = 37977199;
        while (
            CONTRACT_START_BLOCK + page * BLOCKS_PER_REQUEST <
            ORB_END_BLOCK
        ) {
            page += 1;
            console.log(`Requesting page ${page}`);
            const response = await axios.get(
                "https://api.polygonscan.com/api",
                {
                    params: {
                        module: "account",
                        action: "txlist",
                        address: "0x995901A9dA56629bF69168265239Dc1ece73df4F",
                        startblock:
                            CONTRACT_START_BLOCK +
                            (page - 1) * BLOCKS_PER_REQUEST,
                        endblock:
                            CONTRACT_START_BLOCK + page * BLOCKS_PER_REQUEST,
                        sort: "asc",
                        apikey: "ZT9K787G5ECRWCCCN8EKDDQV91GW4KW1XD",
                    },
                }
            );

            console.log(
                `Got result from polyscan page ${page} length ${response.data.result.length}`
            );
            if (response.data.result.length >= 9900) {
                console.log(
                    "ALERT! Too many transactions in one page, exiting!"
                );
                return;
            }
            const treshholdTimestamp = 1672935720;
            // const threshold_time = moment(1672950120); // 5 Jan 2023 12:20 UTC
            // loop through the transactions and calculate the balance
            if (response.data.result && response.data.result.length > 0) {
                for (const transaction of response.data.result) {
                    const transactionFrom = transaction.from.toUpperCase();
                    if (transaction.functionName.startsWith("Initiate")) {
                        if (transaction.timeStamp <= treshholdTimestamp) {
                            console.log(
                                `Updating balance for Initiate before the treshhold date ${transactionFrom} incrementing by 2`
                            );
                            /* await */ collection.updateOne(
                                { transactionFrom },
                                { $inc: { balance: 2 } },
                                { upsert: true }
                            );
                        } else if (transaction.timeStamp > treshholdTimestamp) {
                            console.log(
                                `Updating balance for Finish before the treshhold date ${transactionFrom} incrementing by 1`
                            );
                            /* await */ lastPromise = collection.updateOne(
                                { transactionFrom },
                                { $inc: { balance: 1 } },
                                { upsert: true }
                            );
                        }
                    }
                }
            }
            await lastPromise;
        }
    } catch (error) {
        console.log(error.message);
    } finally {
        // await sleep(60000);
        client.close();
    }
}
orbExport();
