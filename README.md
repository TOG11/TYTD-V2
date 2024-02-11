# TYTD V2
 Repo for TYTD V2
# http://togi.download
### Please make sure your on the LTS of Node.js or greater!<br>
### Please make sure you have FFMPEG (.exe) installed in the local directory of index.js!<br>
### run ```npm install``` to install dependenices.

# Config Documentation
For config version 1.0.3
```
{
    "branch": "PROD", // What branch should the server run? For developing, use DEV, for production, use PROD

    "tytd": {
        "version": "2.4.0" // tytd version, used site-wide
    },
    "DEVELOPMENT": { // development server branch
        "data": { // everything involving the ./data folder
            "wipe_onstart": true, // will wipe the data folder on server start
            "wipe_cycle": true, // will enable the wipe cycle (timer)
            "wipe_cycle_hours": "24", // timer for wipe cycle (if enabled)
            "save_wipe_cycle": false // enable the saviing of the wipe timer
        },
        "server": { // backend server config
            "port": 3000, // port for the server to run on
            "logs": true, // use developer logs
            "useHTTPS": false //enable HTTPS
        }
    },

// this is the same thing, but used for PRODUCTION instead of DEVELOPMENT,
// makes it easier to switch between the two

    "PRODUCTION": { 
        "data": { 
            "wipe_onstart": false,
            "wipe_cycle": true,
            "wipe_cycle_hours": "24",
            "save_wipe_cycle": true
        },
        "server": {
            "port": 3750,
            "logs": false,
            "useHTTPS": false //enable HTTPS
        }
    },
    "config_version": "1.0.3" // config file version
}
```
