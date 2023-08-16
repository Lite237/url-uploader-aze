import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import express from "express";
import { DownloaderHelper } from "node-downloader-helper";
// import ffmpeg from "fluent-ffmpeg";

import dotenv from "dotenv";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import { NewMessage } from "telegram/events/index.js";

dotenv.config();

const app = express();

app.use(express.static("./downloads"));

app.get("/", (req, res) => {
    res.send("Hello");
});

app.listen(3000, () => {
    console.log("listening");
});

const apiId = parseInt(process.env.APP_API_ID);
const apiHash = process.env.APP_API_HASH;

const stringSession = process.env.APP_SESSION; // leave this empty for now
const BOT_TOKEN = process.env.bot; // put your bot token here

(async () => {
    const client = new TelegramClient(
        new StringSession(stringSession),
        apiId,
        apiHash,
        { connectionRetries: 5 }
    );

    if (stringSession) {
        await client.start();
    } else {
        await client.start({
            botAuthToken: BOT_TOKEN,
        });

        console.log(client.session.save());
    }

    client.addEventHandler(async (update) => {
        const chatID = Number(update.message.chatId);
        console.log(chatID);

        if (update.message.message.startsWith("/start")) {
            await client.sendMessage(chatID, {
                message: "Welcome to my Telegram bot!",
            });
        }

        if (
            update.message.message.startsWith("https") ||
            update.message.message.startsWith("http")
        ) {
            const videoURL = update.message.message;

            await client.sendMessage(chatID, {
                message: `Downloading Video at ${videoURL}`,
            });

            if (!fs.existsSync("./downloads")) {
                await fsPromises.mkdir("./downloads");
            }

            const fileName = path.basename(videoURL);
            const filePath = `./downloads`;

            const dl = new DownloaderHelper(videoURL, filePath, {
                fileName,
            });
            dl.on("end", async () => {
                console.log("Download Completed");

                await client.sendMessage(chatID, {
                    message: "Uploading video to telegram",
                });

                try {
                    await client.sendFile(chatID, {
                        file: filePath,
                        caption: fileName,
                        workers: 1,
                        progressCallback: (pro) => {
                            console.log("Uplaoded: " + pro * 100 + "%");
                        },
                    });
                } catch (error) {
                    console.log(error);
                }
            });

            dl.on("error", (err) => console.log("Download Failed", err));

            dl.on("progress", (c) =>
                console.log(`${c.progress} / ${c.downloaded} / ${c.total}`)
            );

            dl.start().catch((err) => console.error(err));

            // if (!fs.existsSync("./thumbnail")) {
            //     await fsPromises.mkdir("./thumbnail");
            // }

            // ffmpeg.ffprobe(filePath, async (error, metadata) => {
            //     console.log("done", filePath);
            //     const duration = metadata.format.duration;

            // ffmpeg(filePath)
            //     .on("end", async function () {

            //         await fsPromises.rm(`./downloads/${fileName}`);
            //         await fsPromises.rm(`./thumbnail/thumbnail.jpg`);

            //         await client.sendMessage(chatID, {
            //             message: "You can send new url",
            //         });
            //     })
            //     .on("error", function (err) {
            //         console.error(err);
            //     })
            //     .screenshots({
            //         count: 1,
            //         timemarks: [timeIndex],
            //         filename: "thumbnail.jpg",
            //         folder: "./thumbnail",
            //     });
            // });
        }
    }, new NewMessage({}));
})();

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
});
