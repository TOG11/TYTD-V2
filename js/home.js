var allowSubmit = false;



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

    CheckURL(document.getElementById("url").value);
}

function CheckURL(elem) {
    var check = elem.value;
    if (/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/.test(check)) {
        allowSubmit = true;
    } else {
        allowSubmit = false;
    }
}

function Submit() {
    if (allowSubmit)
        document.getElementById("downloadform").submit();
    else
        alert("Invalid YouTube URL");
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