// Aiden C. Desjarlais 2024 (C)

const config = require("./config.json");
const youtube = require("ytdl-core");

const fs = require("fs");
if (!fs.existsSync("./data")) {
    //init file system
    CreateFileSystem();
}

//print() is an override for console.log
const ConsoleLog = console.log;
var print = (msg, params) => { if (params === undefined) params = ""; ConsoleLog.apply(console, [msg, params]) };

var serverPort = 1111;
var useLogs = false;
var wipeCycle = false;
var wipeCycleHours = 48;
var saveWipeCycle = false;
var tytdVersion = "Unknown";
var configVersion = "Unknown";
tytdVersion = config.tytd.version;
configVersion = config.config_version;

if (config.branch === "DEV") {
    print("Selected DEVELOPMENT branch");
    serverPort = config.DEVELOPMENT.server.port;
    useLogs = config.DEVELOPMENT.server.logs;
    wipeCycle = config.DEVELOPMENT.data.wipe_cycle;
    wipeCycleHours = config.DEVELOPMENT.data.wipe_cycle_hours;
    saveWipeCycle = config.DEVELOPMENT.data.save_wipe_cycle;

    if (config.DEVELOPMENT.data.wipe_onstart) {
        fs.rm("./data", { recursive: true }, () => {
            CreateFileSystem();
        })
    }
} else if (config.branch === "PROD") {
    print("Selected PRODUCTION branch");
    serverPort = config.PRODUCTION.server.port;
    useLogs = config.PRODUCTION.server.logs;
    wipeCycle = config.PRODUCTION.data.wipe_cycle;
    wipeCycleHours = config.PRODUCTION.data.wipe_cycle_hours;
    saveWipeCycle = config.PRODUCTION.data.save_wipe_cycle;

    if (config.PRODUCTION.data.wipe_onstart) {
        fs.rm("./data", { recursive: true }, () => {
            CreateFileSystem();
        })
    }
} else
    throw new Error("Selected server config branch \"" + config.branch + "\" doesnt exist");

//wipe cycle V2

const wipeTimeEnd = 60 * 60 * wipeCycleHours; // hours > seconds
var wipeTime = 60 * 60 * wipeCycleHours; // this is our timer

if (wipeCycle) {

    //check for save
    if (fs.existsSync("./timer.json") && saveWipeCycle) {
        fs.readFile("./timer.json", { encoding: "utf8" }, (err, data) => {
            if (err) print(err);
            var json = JSON.parse(data);
            console.log("[WipeCycle] Loaded saved wipe cycle time");
            //override wipe time
            wipeTime = json.timeLeft;
        })
    }

    setInterval(() => {
        wipeTime -= 1;

        //save timer
        if (saveWipeCycle)
            fs.writeFileSync("./timer.json", JSON.stringify({ timeLeft: wipeTime }), { encoding: "utf8" });

        activeTimerSockets.forEach(socket => {
            socket.send(wipeTime);
        })

        if (wipeTimeEnd <= wipeTime) {
            wipeTime = 60 * 60 * wipeCycleHours;
            RemoveData();
        }
    }, 1000);

    /* old timer, with no countdown
    setInterval(() => {
        RemoveData();
    }, 1000 * wipeTime);
    */
}


//begin main server code

console.log = (msg, params) => {
    if (useLogs)
        print(msg, params);
}

console.log("Logs Enabled");

const app = require("express")();
const path = require("path");
const { randomUUID } = require("crypto");
var ffmpeg = require('fluent-ffmpeg');
app.use(require("express").json());
app.use(require("express").urlencoded({ extended: true }))
var expressWs = require('express-ws')(app);


//pages


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/pages/home.html"));
});

app.get("/downloading", (req, res) => {
    if (!req.query.vid) return res.sendStatus(401);
    res.sendFile(path.join(__dirname, "/pages/downloading.html"));
});


// css, js


app.get("/static/global/css", (req, res) => {
    res.sendFile(path.join(__dirname, "/css/global.css"));
});

app.get("/static/home/js", (req, res) => {
    res.sendFile(path.join(__dirname, "/js/home.js"));
});

app.get("/static/downloading/js", (req, res) => {
    res.sendFile(path.join(__dirname, "/js/downloading.js"));
});

app.get("/static/styles", (req, res) => {
    res.sendFile(path.join(__dirname, "/js/styles.js"));
});


// V1 API


app.get("/api/v1/config", (req, res) => {
    res.json(config);
})

app.get("/api/v1/fetchdownload", (req, res) => {
    if (!req.query.vid) { console.log("[/api/v1/fetchdownload]: 401 @VID " + req.query.vid); res.sendStatus(401); return };

    if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp3")) {
        console.log("[/api/v1/fetchdownload]: 200 @VID " + req.query.vid + " MP3");
        //res.sendFile(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp3"));
        res.download(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp3"));
    }
    else if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp4")) {
        console.log("[/api/v1/fetchdownload]: 200 @VID " + req.query.vid + " MP4");
        //res.sendFile(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp4"));
        //stopped streaming for performance increase! Sorry!
        res.download(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp4"));
    }
    else {
        console.log("[/api/v1/fetchdownload]: 404 @VID " + req.query.vid);
        res.sendStatus(404);
    }
});

app.get("/api/v1/checkdownload", (req, res) => {
    if (!req.query.vid) { console.log("[/api/v1/checkdownload]: 401 @VID " + req.query.vid); res.sendStatus(401); return };

    if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp4")) {
        console.log("[/api/v1/checkdownload]: 200 @VID " + req.query.vid + " MP4");
        res.json({ code: 200, details: "found video on server" });
    }
    else if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp3")) {
        console.log("[/api/v1/checkdownload]: 200 @VID " + req.query.vid + " MP3");
        res.json({ code: 200, details: "found audio on server" });
    }
    else if (fs.existsSync("./data/inactive_uuids/" + req.query.vid + ".vid")) {
        console.log("[/api/v1/checkdownload]: 200 @VID " + req.query.vid + " INACTIVE");
        var vidData = JSON.parse(fs.readFileSync("./data/inactive_uuids/" + req.query.vid + ".vid"));
        res.json({ code: 204, details: "This download is no longer available on our servers.", data: vidData });
    }
    else {
        console.log("[/api/v1/checkdownload]: 404 @VID " + req.query.vid);
        res.json({ code: 404, details: "video was not found on the server" });
    }
});


//wipe timer socket
var activeTimerSockets = [];

app.ws('/api/v1/wipetimer', function (ws, req) {
    activeTimerSockets.push(ws);

    ws.on('close', () => {
        activeTimerSockets.splice(activeTimerSockets.indexOf(ws), 1);
    });
});


/***
 * @type {[{ socket: ws, vid: msg }]}
 */
var activeDataSockets = [];

app.ws('/api/v1/datasocket', function (ws, req) {

    var locatedID = false;
    var dataObj = undefined;


    ws.on('message', (msg) => {
        if (!fs.existsSync("./data/active_uuids/" + msg + ".vid") && !locatedID) { console.log("[/api/v1/datasocket@connect]: WS404 @VID " + msg); ws.send("INVALID_VID"); ws.terminate(); } //invalid vID

        locatedID = true;
        dataObj = { socket: ws, vid: msg };
        console.log("[/api/v1/datasocket@connected]: WS200 @VID " + msg,);
        if (!activeDataSockets.includes(ws))
            activeDataSockets.push(dataObj);
    });

    ws.on('close', () => {
        if (locatedID) {
            console.log("[/api/v1/datasocket@closed]: WS499 @VID " + dataObj.vid);
            activeDataSockets.splice(activeDataSockets.indexOf(dataObj), 1);
        }
    });
});

app.post("/api/v1/download", (req, res) => {
    if (req.body.url === undefined) { console.log("[/api/v1/download]: 401 @URL " + req.body.url); res.sendStatus(401); return };
    const url = req.body.url;
    const audioOnly = req.body.audio_only
    var videoID = randomUUID();
    console.log("[/api/v1/download]: GENERATED VID " + videoID + " AS " + (audioOnly ? "MP3" : "MP4"));
    if (!/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/.test(url)) {
        console.log("[/api/v1/download]: 400 @URL " + req.body.url);
        return res.sendStatus(400);
    }

    fs.writeFile("./data/active_uuids/" + videoID + ".vid", JSON.stringify({ created: new Date(Date.now()).toISOString(), url: url, audio_only: audioOnly }), () => res.redirect("/downloading?vid=" + videoID));
    console.log("[/api/v1/download]: GENERATED VID FILE ", "./data/active_uuids/" + videoID + ".vid");

    var audio = undefined;
    var video = undefined;

    setTimeout(() => { //alow time for client to load the new page
        var data = activeDataSockets.find(dataObj => dataObj.vid == videoID);
        if (data === undefined)
            data = { socket: { send: () => { /* no logs womp womp */ }, terminate: () => { /* no termination womp womp */ } }, vid: videoID };
        console.log("[/api/v1/download@datasocket]: " + (data === undefined ? "UNAVAILBLE 503" : "AVAILABLE 200") + " @VID " + videoID);
        data.socket.send("FOUND_SOCKET");

        /* TODO:
        data.socket.send("THUMBNAIL_URL");
        data.socket.send("VIDEO_NAME");
        data.socket.send("VIDEO_LENGTH");
        ETC.
        */

        //download video
        if (!audioOnly) {
            data.socket.send("DOWNLOADING_VIDEO");
            video = youtube(url, { filter: 'videoonly' }).pipe(fs.createWriteStream(path.join(__dirname, "/data/tmp/" + videoID + ".mp4")));
            audio = youtube(url, { filter: 'audioonly' }).pipe(fs.createWriteStream(path.join(__dirname, "/data/tmp/" + videoID + ".m4a")));
        } else {
            data.socket.send("DOWNLOADING_AUDIO");
            audio = youtube(url, { filter: 'audioonly' }).pipe(fs.createWriteStream(path.join(__dirname, "/data/tmp/" + videoID + ".m4a")));
        }

        var awaitingVideo = true;
        var awaitingAudio = true;

        if (!audioOnly)
            video.on("close", () => {
                console.log("[/api/v1/download]: VIDEO COMPLETED FOR VID " + videoID);
                data.socket.send("COMPLETED_VIDEO");
                awaitingVideo = false;

                //wait for audio to complete (if not already)
                if (!awaitingAudio) {
                    console.log("[/api/v1/download]: MERGE " + videoID);
                    data.socket.send("MERGING");
                    Merge(`${__dirname}/data/tmp/${videoID}.mp4`, `${__dirname}/data/tmp/${videoID}.m4a`, `${__dirname}/data/downloads/${videoID}.mp4`, (err) => {
                        if (err) throw err;

                        if (!audioOnly)
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.mp4`)
                        fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`)
                        data.socket.send("COMPLETED");
                        data.socket.terminate();
                        console.log("[/api/v1/download]: DOWNLOAD PROCESS FOR VID " + videoID + " COMPLETED");
                    });
                }
            })

        audio.on("close", () => {
            console.log("[/api/v1/download]: AUDIO COMPLETED FOR VID " + videoID);
            data.socket.send("COMPLETED_AUDIO");
            awaitingAudio = false;

            //wait for video to complete (if not already)
            if (!awaitingVideo || audioOnly) {
                if (audioOnly) {
                    console.log("[/api/v1/download]: CONVERTING > MP3 " + videoID);
                    data.socket.send("CONVERTING");
                    ffmpeg(`${__dirname}/data/tmp/${videoID}.m4a`)
                        .audioBitrate(320)
                        .toFormat('mp3')
                        .addOptions(["-preset ultrafast"])
                        .on('error', (err) => {
                            console.log("[/api/v1/download]: DOWNLOAD PROCESS FOR VID " + videoID + " ERRORED FFMPEG");
                            data.socket.send("ERRORED");
                            data.socket.terminate();
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`);
                        })
                        .on('end', () => {
                            console.log("[/api/v1/download]: DOWNLOAD PROCESS FOR VID " + videoID + " COMPLETED");
                            data.socket.send("COMPLETED");
                            data.socket.terminate();
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`);
                        })
                        .saveToFile(`${__dirname}/data/downloads/${videoID}.mp3`);
                } else {
                    console.log("[/api/v1/download]: MERGE " + videoID);
                    data.socket.send("MERGING");
                    Merge(`${__dirname}/data/tmp/${videoID}.mp4`, `${__dirname}/data/tmp/${videoID}.m4a`, `${__dirname}/data/downloads/${videoID}.mp4`, (err) => {
                        if (err) throw err;

                        if (!audioOnly)
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.mp4`)
                        fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`)
                        data.socket.send("COMPLETED");
                        data.socket.terminate();
                        console.log("[/api/v1/download]: DOWNLOAD PROCESS FOR VID " + videoID + " COMPLETED");
                    });
                }
            }
        })
    }, 1500);
});



app.listen(serverPort, () => {
    print("Server Online");
})

//utilitys

function Merge(video, audio, output, callback) {
    ffmpeg()
        .addInput(video)
        .addInput(audio)
        .addOptions(["-c:v libx264", "-c:a aac", "-preset ultrafast"])
        .format('mp4')
        .on('error', error => callback(error))
        .on('end', () => callback())
        .saveToFile(output)
}

function CreateFileSystem() {
    console.log("[CreateFileSystem()]: Created File System");
    fs.mkdir("./data", () => {
        fs.mkdirSync("./data/active_uuids");
        fs.mkdirSync("./data/downloads");
        fs.mkdirSync("./data/tmp");
        fs.mkdirSync("./data/inactive_uuids");
    })
}

function RemoveData() {
    console.log("[RemoveData()]: Wiped Data");

    fs.readdir("./data/active_uuids", (err, files) => {
        if (err) print(err);

        //move to incactive vid folder
        for (const file of files) {
            fs.copyFile(path.join("./data/active_uuids/", file), path.join("./data/inactive_uuids/", file), () => {
                fs.unlinkSync(path.join("./data/active_uuids/", file));
            });
        }
    });

    fs.readdir("./data/downloads", (err, files) => {
        if (err) print(err);

        for (const file of files) {
            fs.unlink(path.join("./data/downloads/", file), (err) => {
                if (err) print(err);
            });
        }
    });

    fs.readdir("./data/tmp", (err, files) => {
        if (err) print(err);

        for (const file of files) {
            fs.unlink(path.join("./data/tmp/", file), (err) => {
                if (err) print(err);
            });
        }
    });
}
