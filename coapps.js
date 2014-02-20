/*jslint couch:true, node:true*/
var fs = require("fs"),  // Libaries
    events = new (require("events").EventEmitter)(),
    argv, // will contain optimist later
    coappsDefault, // Defaults
    uploadFile, // Local functions
    db; // Local variables

// Set Defaults
coappsDefault = Object.create({}, {
    name: {value: "coapps.json, no name set", enumerable: true},
    description: {value: "coapps.json, no description set", enumerable: true},
    attachments: {value: ["index.html"], enumerable: true}
}); // by default properties ARE NOT writable, enumerable or configurable

// Set cli options with optimist
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


// ** Main **
// When possible, start reading files and upload them
(function () {
    "use strict";
    var doc,
        coapss,
        db,
        uploadFile;

    // Location functions
    uploadFile = (function () {
        var queue = [],
            doing = 0,
            started = false,
            start,
            upload,
            next;

        start = function () {
            if (started) {
                return;
            }
            started = true;
        };

        upload = function (filename) {
            var do = function (fname) {
                // upload it
                event.emit("uploadDone", fname);
            }
            if (db) {
                return;
            }
            events.once("dbReady", function () {
                //do something
            });
        };

        next = function (filename) {
            var done = function (res) {
                events.emit("nextDone", res);
            };
            if (doing < 5) {
                upload(filename, done);
            } else {
                events.on("uploadDone", function () {
                    upload(filename, res);
                });
            }
        };
        return {
            add: function (filename) {
                queue.push(filename);
                start();
            }
        };
    }());

    events.once("coappsRead", function (settings) {
        console.log("Settings read", settings);
        // set defaults
        coapss.name = settings.name || coappsDefault.name;
        coapss.description = settings.description || coappsDefault.description;
        coapss.attachments = settings.attachments || coappsDefault.attachments;

        // Read files declared in attachments
        if (Array.isArray(settings.attachments)) {
            coapss.attachments.forEach(function (attachment) {
                console.log("attachment", attachment);
                uploadFile.add(attachment);
            });
        }
    });

    events.once("databaseConnected", function (dbconn) {
        console.log("Database Connected", dbconn.name);
        db = dbconn;
        events.emit("dbReady");
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
