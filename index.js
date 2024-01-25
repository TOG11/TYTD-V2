// Aiden C. Desjarlais 2024 (C)

const youtube = require("ytdl-core");
const fs = require("fs");
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

//cleaners (every 24hrs)

setInterval(() => {
    fs.readdir("./data/tmp", (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
          fs.unlink(path.join("./data/tmp/", file), (err) => {
            if (err) throw err;
          });
        }
      });

      fs.readdir("./data/downloads", (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
          fs.unlink(path.join("./data/downloads/", file), (err) => {
            if (err) throw err;
          });
        }
      });

      fs.readdir("./data/active_uuids", (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
          fs.unlink(path.join("./data/active_uuids/", file), (err) => {
            if (err) throw err;
          });
        }
      });
}, 1000 * 60 * 60 * 24);


// V1 API


app.get("/api/v1/fetchdownload", (req, res) => {
    if (!req.query.vid) { res.sendStatus(401); return };

    if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp3"))
        res.sendFile(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp3"));
    else if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp4"))
        res.sendFile(path.join(__dirname, "/data/downloads/" + req.query.vid + ".mp4"));
    else
        res.sendStatus(404);
});

app.get("/api/v1/checkdownload", (req, res) => {
    if (!req.query.vid) { res.sendStatus(401); return };

    if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp4"))
        res.json({ code: 200, details: "found video on server" });
    else if (fs.existsSync("./data/downloads/" + req.query.vid + ".mp3"))
        res.json({ code: 200, details: "found audio on server" });
    else
        res.json({ code: 404, details: "video was not found on the server" });

});


/***
 * @type {[{ socket: ws, vid: msg }]}
 */
var activeDataSockets = [];

app.ws('/api/v1/datasocket', function (ws, req) {

    var locatedID = false;
    var dataObj = undefined;


    ws.on('message', (msg) => {
        if (!fs.existsSync("./data/active_uuids/" + msg + ".vid") && !locatedID) { ws.send("INVALID_VID"); ws.terminate(); } //invalid vID

        locatedID = true;
        dataObj = { socket: ws, vid: msg };
        if (!activeDataSockets.includes(ws))
            activeDataSockets.push(dataObj);
    });

    ws.on('close', () => {
        if (locatedID)
            activeDataSockets.splice(activeDataSockets.indexOf(dataObj), 1);
    });
});

app.post("/api/v1/download", (req, res) => {
    if (req.body.url === undefined) { res.sendStatus(401); return };
    const url = req.body.url;
    const audioOnly = req.body.audio_only
    var videoID = randomUUID();

    if (!/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/.test(url))
        return res.sendStatus(400);

    fs.writeFile("./data/active_uuids/" + videoID + ".vid", JSON.stringify({ created: new Date(Date.now()).toISOString(), url: url, audio_only: audioOnly }), () => res.redirect("/downloading?vid=" + videoID));

    var audio = undefined;
    var video = undefined;

    setTimeout(() => { //alow time for client to load the new page
        var data = activeDataSockets.find(dataObj => dataObj.vid == videoID);
        if (data === undefined)
            data = { socket: { send: () => { /* no logs womp womp */ }, terminate: () => { /* no termination womp womp */ } }, vid: videoID };
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
                data.socket.send("COMPLETED_VIDEO");
                awaitingVideo = false;

                //wait for audio to complete (if not already)
                if (!awaitingAudio) {
                    data.socket.send("MERGING");
                    merge(`${__dirname}/data/tmp/${videoID}.mp4`, `${__dirname}/data/tmp/${videoID}.m4a`, `${__dirname}/data/downloads/${videoID}.mp4`, (err) => {
                        if (err) throw err;

                        if (!audioOnly)
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.mp4`)
                        fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`)
                        data.socket.send("COMPLETED");
                        data.socket.terminate();
                    });
                }
            })

        audio.on("close", () => {
            data.socket.send("COMPLETED_AUDIO");
            awaitingAudio = false;

            //wait for video to complete (if not already)
            if (!awaitingVideo || audioOnly) {
                if (audioOnly) {
                    data.socket.send("CONVERTING");
                    ffmpeg(`${__dirname}/data/tmp/${videoID}.m4a`)
                        .audioBitrate(320)
                        .toFormat('mp3')
                        .addOptions(["-preset ultrafast"])
                        .on('error', (err) => console.error(err))
                        .on('end', () => { data.socket.send("COMPLETED"); data.socket.terminate(); fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`) })
                        .saveToFile(`${__dirname}/data/downloads/${videoID}.mp3`);
                } else {
                    data.socket.send("MERGING");
                    merge(`${__dirname}/data/tmp/${videoID}.mp4`, `${__dirname}/data/tmp/${videoID}.m4a`, `${__dirname}/data/downloads/${videoID}.mp4`, (err) => {
                        if (err) throw err;

                        if (!audioOnly)
                            fs.rmSync(`${__dirname}/data/tmp/${videoID}.mp4`)
                        fs.rmSync(`${__dirname}/data/tmp/${videoID}.m4a`)
                        data.socket.send("COMPLETED");
                        data.socket.terminate();
                    });
                }
            }
        })
    }, 1500);
});



app.listen(3000, () => {
    console.log("Server Online");
})

//utilitys

function merge(video, audio, output, callback) {
    ffmpeg()
        .addInput(video)
        .addInput(audio)
        .addOptions(["-c:v libx264", "-c:a aac", "-preset ultrafast"])
        .format('mp4')
        .on('error', error => callback(error))
        .on('end', () => callback())
        .saveToFile(output)
}
