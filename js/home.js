var allowSubmit = false;
window.onload = () => {

    httpGetAsync("http://" + location.host + "/api/v1/config", (res) => {
        var data = JSON.parse(res);
        document.getElementById("tytdversion").innerHTML = data.tytd.version;
    })

    var wipews = new WebSocket("ws://" + location.host + "/api/v1/wipetimer");
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