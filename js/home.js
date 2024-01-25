var allowSubmit = false;
window.onload = () => {
    CheckURL(document.getElementById("submit"))
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
        document.getElementById("form").submit();
    else
        alert("Invalid YouTube URL");
}