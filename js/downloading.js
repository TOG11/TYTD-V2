window.onload = () => {
    var searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has("vid")) window.location.href = "/";

    httpGetAsync("http://" + location.host + "/api/v1/checkdownload?vid=" + searchParams.get("vid"), (res) => {
        var logArea = document.getElementById("log");
        function log(msg) {
            logArea.innerHTML += msg + "\n";
        }

        if (JSON.parse(res).code == 200) {
            log(JSON.parse(res).details);
            document.getElementById("toptext").innerHTML = "Found Video!"
            log("Download for this video was found on the server.\nNo socket connection needed, download below.")
            downloadURL = "http://" + location.host + "/api/v1/fetchdownload?vid=" + searchParams.get("vid");
            document.getElementById("downloads").hidden = false;
            return;
        }

        var ws = new WebSocket("ws://" + location.host + "/api/v1/datasocket");
        var receivedMessage = false;

        var update = setInterval(() => {
            log("ALIVE: Server is most likley working, please wait (Still connected) !!");
        }, 15000);

        var notice = setInterval(() => {
            log("ALERT: Server has not responded in more than 1 minute, if your video is small and not above 1080p30 then try a re-download !!");
        }, 60000);

        ws.onopen = function () {
            log("OK: Socket opened");
            ws.send(searchParams.get("vid"));
            setTimeout(() => {
                if (!receivedMessage) {
                    log("ERROR: Client timed out after 2500ms");
                    alert("There was an error connecting with the live socket. Client Timed Out after 2500ms");
                    ws.close();
                }
            }, 2500);
        };

        ws.onmessage = function (evt) {
            receivedMessage = true;
            var msg = evt.data;
            switch (msg) {
                case "INVALID_VID":
                    log("ERROR: Server received invalid vID");
                    alert("There was a fatal error connecting with the live socket.\nServer received invalid vID");
                    break;
                case "FOUND_SOCKET":
                    log("OK: Server found the socket, and has established connection!");
                    break;
                case "DOWNLOADING_VIDEO":
                    log("INFO: Server is downloading the YouTube video\nCOULD TAKE A MOMENT !");
                    break;
                case "DOWNLOADING_AUDIO":
                    log("INFO: Server is downloading the YouTube audio !");
                    break;
                case "COMPLETED_VIDEO":
                    log("INFO: Server has downloaded the video !");
                    break;
                case "COMPLETED_AUDIO":
                    log("INFO: Server has downloaded the audio !");
                    break;
                case "CONVERTING":
                    log("INFO: Server is converting the audio !");
                    break;
                case "MERGING":
                    log("INFO: Server is merging the audio and video\nTHIS WILL TAKE A MINUTE !!");
                    break;
                case "COMPLETED":
                    clearInterval(update);
                    clearInterval(notice);
                    log("INFO: Video completed, download via the now available button below :)\nMade by Togi!!");
                    downloadURL = "http://" + location.host + "/api/v1/fetchdownload?vid=" + searchParams.get("vid");
                    document.getElementById("downloads").hidden = false;
                    break;
            }


        };

        ws.onclose = function () {
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