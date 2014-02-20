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
            maxAsync = 5,
            doing = [],
            start,
            upload,
            next;

        // When upload is done,
        //  remove it from the doing list
        //  do the next upload
        events.on("uploadDone", function (fname) {
            var index = doing.indexOf(fname);
            if (index !== -1) {
                doing.splice(index, 1);
            }
            next();
        });

        // If there are more files queued and we are not doing maxAsync number of uploads yet
        //   remove the first item from the queue and put it in doing
        //   upload the file
        next = function () {
            var index;
            if (queue.length > 0 && doing.length < maxAsync) {
                index = doing.push(queue.shift());
                upload(doing[index - 1]);
            }
        };

        // start the queue with the first maxAsync uploads (next will test if there are more to do)
        start = function () {
            var i;
            for (i = doing.length; i < maxAsync; i += 1) {
                next();
            }
        };

        upload = function (filename) {
            var do;
            do = function (fname) {
                // upload code here
                event.emit("uploadDone", fname);
            }
            if (db) {
                do(filename);
                return;
            }
            events.once("dbReady", function () {
                do(filename);
                return;
            });
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
