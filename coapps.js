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

events.setMaxListeners(20);

// Set cli options with nomnom
argv = require('nomnom')
    .help('Upload couchapp to server')
    .options({
        "server": {
            abbr: "s",
            required: true,
            help: "Server to deploy to"
        },
        "database": {
            abbr: "d",
            required: true,
            help: "Database(s) to deploy to, use multiple if needed"
        }
    })
    .parse();


// ** Main **
// When possible, start reading files and upload them
(function () {
    "use strict";
    var MMMagic = require('mmmagic').Magic,
        mmmagic = new MMMagic(MMMagic.MAGIC_MIME_TYPE),
        coapps = {},
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
        events.on("uploadDone", function (filename) {
            var index = doing.indexOf(filename);
            if (index !== -1) {
                doing.splice(index, 1);
            }
            console.log("uploadDone", filename);
            next();
        });
        events.on("uploadError", function (error) {
            var index = doing.indexOf(error.filename);
            if (index !== -1) {
                doing.splice(index, 1);
            }
            console.error("Error", error);
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
            var doUpload;
            doUpload = function (fname) {  // FIXME: add the file upload code here!
                var read,
                    write,
                    pipe,
                    destination = "design/" + coapps.name;
                mmmagic.detectFile(fname, function (err, mime) {
                    if (err) {
                        events.emit("uploadError", {filename: fname, destination: destination, database: db.name, message: "Error getting mimetype", error: err});
                        return;
                    }
                    console.log("mime", mime);
                    read = fs.createReadStream(fname);
                    write = db.saveAttachment({id: destination}, {name: fname}, function (err) {
                        if (err) {
                            events.emit("uploadError", {filename: fname, destination: destination, database: db.name, message: "Error saving attachment", error: err});
                            return;
                        }
                        events.emit("uploadDone", fname);
                    });
                    read.on("error", function (err) {
                        events.emit("uploadError", {filename: fname, destination: destination, database: db.name, message: "Error reading file", error: err});
                    });
                    pipe = read.pipe(write);
                    pipe.on("error", function (err) {
                        events.emit("uploadError", {filename: fname, destination: destination, database: db.name, message: "Error piping file to database", error: err});
                    });
                });
            };
            if (db) {
                doUpload(filename);
                return;
            }
            events.once("dbReady", function () {
                doUpload(filename);
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
        coapps.name = settings.name || coappsDefault.name;
        coapps.description = settings.description || coappsDefault.description;
        coapps.attachments = settings.attachments || coappsDefault.attachments;

        // Read files declared in attachments
        if (Array.isArray(settings.attachments)) {
            coapps.attachments.forEach(function (attachment) {
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
