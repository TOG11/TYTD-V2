window.onload = () => {

    console.log("%cCreated By Togi", TitleCss);
    console.log("%cTYTD V2\n\n", LogCss);

    httpGetAsync("http://" + location.host + "/api/v1/config", (res) => {
        var data = JSON.parse(res);
        console.log(`%cServerBranch: ${data.branch}`, LogCss);
        console.log(`%cVersion: ${data.tytd.version}`, LogCss);
        console.log(`%cPort: ${(data.branch === "PROD" ? data.PRODUCTION.server.port : data.DEVELOPMENT.server.port)}`, LogCss);
        console.log(`%cLoggingEvents: ${(data.branch === "PROD" ? data.PRODUCTION.server.logs : data.DEVELOPMENT.server.logs)}`, LogCss);
        console.log(`%cWipeOnStart: ${(data.branch === "PROD" ? data.PRODUCTION.data.wipe_onstart : data.DEVELOPMENT.data.wipe_onstart)}`, LogCss);
        console.log(`%cUsingWipeCycle: ${(data.branch === "PROD" ? data.PRODUCTION.data.wipe_cycle : data.DEVELOPMENT.data.wipe_cycle)}`, LogCss);
        console.log(`%cWipeCycleHours: ${(data.branch === "PROD" ? data.PRODUCTION.data.wipe_cycle_hours : data.DEVELOPMENT.data.wipe_cycle_hours)}\n\n`, LogCss);
        console.log(`%cConfigVersion: ${data.config_version}`, LogCss);

        document.getElementById("tytdversion").innerHTML = data.tytd.version;
    })

    var wipews = new WebSocket("ws://" + location.host + "/api/v1/wipetimer");
    wipews.onopen = () => {
        console.log(`%c[wipews] Connected to wipe timer socket!`, DefaultCss);
    }
    wipews.onmessage = function (evt) {
        var formatted = new Date(evt.data * 1000).toISOString().slice(11, 19);
        document.getElementById("wipetimer").innerHTML = formatted;
    }

    var searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has("vid") && !searchParams.get("pid")) window.location.href = "/";

    httpGetAsync("http://" + location.host + "/api/v1/checkdownload?uuid=" + (!searchParams.get("vid") ? searchParams.get("pid") : searchParams.get("vid")), (res) => {
        var logArea = document.getElementById("log");
        function log(msg) {
            logArea.innerHTML += msg + "\n";
        }

        if (!searchParams.get("vid") && JSON.parse(res).code == 200) {
            console.log(`%c[downloader] Found playlist on server`, DefaultCss);
            log(JSON.parse(res).details);
            document.getElementById("toptext").innerHTML = "Found Playlist!"
            log("Download for this playlist was found on the server.\nNo socket connection needed, download below.")
            downloadURL = "http://" + location.host + "/api/v1/fetchdownload?pid=" + searchParams.get("pid");
            document.getElementById("downloads").hidden = false;
            return;
        }

        if (JSON.parse(res).code == 200) {
            console.log(`%c[downloader] Found video id on server`, DefaultCss);
            log(JSON.parse(res).details);
            document.getElementById("toptext").innerHTML = "Found Video!"
            log("Download for this video was found on the server.\nNo socket connection needed, download below.")
            downloadURL = "http://" + location.host + "/api/v1/fetchdownload?vid=" + searchParams.get("vid");
            document.getElementById("downloads").hidden = false;
            return;
        } else if (JSON.parse(res).code == 204) {
            console.log(`%c[downloader] Video id has been wiped from the server.\nOnly the info file is left.`, DefaultCss);
            log(JSON.parse(res).details);
            document.getElementById("toptext").innerHTML = "Video No Longer Exists!"
            log("Available details below:\n\n");
            log("Download for: " + JSON.parse(res).data.url);
            log("Created on: " + new Date(JSON.parse(res).data.created).toLocaleString());
            if (JSON.parse(res).data.audio_only)
                log("This download was MP3");
            else
                log("This download was MP4");
            return;
        }



        var ws = new WebSocket("ws://" + location.host + "/api/v1/datasocket");
        var receivedMessage = false;

        var update = setInterval(() => {
            log("ALIVE: Server is most likley working, please wait (Still connected) !!");
        }, 15000);

        var notice = setInterval(() => {
            log("ALERT: Server has not responded in more than 2 minutes, if your video is small and not above 1080p30 then try a re-download !!");
        }, 120000);

        ws.onopen = function () {
            console.log(`%c[downloader] Connected to the data socket`, DefaultCss);
            log("OK: Socket opened");
            ws.send(!searchParams.get("vid") ? searchParams.get("pid") : searchParams.get("vid"));
            setTimeout(() => {
                if (!receivedMessage) {
                    console.log(`%c[downloader] Timed out after 2500ms, server did not respond in time.\nIs the server down?`, DefaultCss);
                    log("FATAL ERROR | CHECK DEBUG LOG");
                    alert("There was an error connecting with the live socket. Check debug log for more info.");
                    clearInterval(update);
                    clearInterval(notice);
                    ws.close();
                }
            }, 2500);
        };

        ws.onmessage = function (evt) {
            receivedMessage = true;
            var msg = evt.data;
            switch (msg) {
                case "INVALID_VID":
                    console.log(`%c[downloader] The video id provided does not exist on any of our records.`, DefaultCss);
                    log("ERROR: Check debug log");
                    alert("There was a fatal error connecting with the live socket.\nServer received invalid video id");
                    clearInterval(update);
                    clearInterval(notice);
                    break;
                case "FOUND_SOCKET":
                    console.log(`%c[downloader] Confirmed connection with server, handshake completed.`, DefaultCss);
                    log("OK: Server found the socket, and has established connection!");
                    break;
                case "DOWNLOADING_VIDEO":
                    log("INFO: Server is downloading the YouTube video\nCOULD TAKE A MOMENT !");
                    break;
                case "DOWNLOADING_AUDIO":
                    console.log(`%c[downloader] Server is downloading the content.`, DefaultCss);
                    log("INFO: Server is downloading the YouTube audio !");
                    break;
                case "COMPLETED_VIDEO":
                    log("INFO: Server has downloaded the video !");
                    break;
                case "COMPLETED_AUDIO":
                    log("INFO: Server has downloaded the audio !");
                    break;
                case "CONVERTING":
                    console.log(`%c[downloader] Server is converting the content.`, DefaultCss);
                    log("INFO: Server is converting the audio !");
                    break;
                case "MERGING":
                    console.log(`%c[downloader] Server is merging the content.`, DefaultCss);
                    log("INFO: Server is merging the audio and video\nTHIS WILL TAKE A MINUTE !!");
                    break;
                case "ERRORED":
                    console.log(`%c[downloader] Server has had an unexpected ffmpeg error, this could be due to bad timing with a wipe cycle, or could be a underlying problem.\nIf this continues, please make in issue on the github.`, DefaultCss);
                    log("ERROR! Server has encountered an FFMPEG coversion error!\nThis could be to the 24hr wipe, so please try to download again!");
                    clearInterval(update);
                    clearInterval(notice);
                    break;
                case "COMPLETED":
                    console.log(`%c[downloader] Server has completed the operation.`, DefaultCss);
                    clearInterval(update);
                    clearInterval(notice);
                    log("INFO: Video completed, download via the now available button below :)\nMade by Togi!!");
                    downloadURL = "http://" + location.host + "/api/v1/fetchdownload?vid=" + searchParams.get("vid");
                    document.getElementById("downloads").hidden = false;
                    break;
                case "PLAYLIST_STARTED":
                    console.log(`%c[downloader] Server is downloading the playlist.`, DefaultCss);
                    log("INFO: Server has begun downloading the playlist\n\nThis will take ahwile.\n\nPlease note there are no logs for each download, the next log will be when it finishes.\n!! This will take a moment !!");
                    break;
                case "PLAYLIST_COMPLETED":
                    console.log(`%c[downloader] Server completed the playlist.`, DefaultCss);
                    log("INFO: Server has downloaded the playlist, you can now download the .zip from the button below!");
                    clearInterval(update);
                    clearInterval(notice);
                    downloadURL = "http://" + location.host + "/api/v1/fetchdownload?pid=" + searchParams.get("pid");
                    document.getElementById("downloads").hidden = false;
                    break;
            }


        };

        ws.onclose = function () {
            console.log(`%c[downloader] Datasocket connection terminated.`, DefaultCss);
            log("CLOSED: Socket closed.");
        };
    });
}



function httpGetAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

var downloadURL = ""
function gotoDownload() {
    window.location.href = downloadURL;
}