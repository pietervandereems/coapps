/*jslint couch:true, node:true*/
var  // Libaries
    fs = require("fs"),
    events = new (require("events").EventEmitter)(),
    argv, // will contain optimist later
    db; // Local variables

argv = require('optimist')
    .usage('Upload couchapp to server\nUsage: $0')
    .options("s", {
        alias: "server",
        demand: true,
        describe: "Server to deploy to"
    })
    .options("d", {
        alias: "database",
        demand: true,
        describe: "Database(s) to deploy to, use multiple if needed"
    })
    .argv;

// When possible, start reading files and upload them
(function () {
    "use strict";
    var doc;
    events.once("coappsRead", function (settings) {
        console.log("Settings read", settings);
    });

    events.once("databaseConnected", function (db) {
        console.log("Database Connected", db.name);
    });
}());

// Read json configuration file
fs.readFile("coapps.json", {"encoding": "utf8"}, function (err, data) {
    "use strict";
    var settings;
    if (err) {
        console.error("Error reading coapps.json", err);
        process.exit(1);
    }
    settings = JSON.parse(data);
    events.emit("coappsRead", settings);
});

// Open connection to the database
(function () {
    "use strict";
    var cradle = require("cradle"),
        url = require("url"),
        options = {
            cache: true
        },
        auth,
        conn,
        db;
    conn = url.parse(argv.server, true, true);
    if (conn.auth) {
        auth = conn.auth.split(":");
        options.auth = {
            username: auth[0],
            password: auth[1]
        };
    }
    db = new (cradle.Connection)(conn.protocol + "//" + conn.hostname, options).database(argv.database);
    events.emit("databaseConnected", db);
}());
