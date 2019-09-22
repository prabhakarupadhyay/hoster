var express = require("express");
var app = express();
var server = require("http").Server(app);
var path = require("path");
var mime = require("mime-types");
var multer = require("multer");
var fs = require("fs");
var Unzipper = require("decompress-zip");
var shortid = require("shortid");
var bodyParser = require("body-parser");

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var server_port = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 3000;
var server_ip_address =
  process.env.OPENSHIFT_NODEJS_IP || process.env.IP || "0.0.0.0";

var myLogger = function(req, res, next) {
  setHead(res);
  next();
};

var zipStore = multer.diskStorage({
  destination: function(req, file, callback) {
    var rootPath = "./public/site"; // + shortid.generate();
    fs.mkdir(rootPath, err => callback(err, rootPath));
  },
  filename: function(req, file, callback) {
    let OrignalName = file.originalname.split(".")[0];
    let extension = file.originalname.split(".")[
      file.originalname.split(".").length - 1
    ];
    callback(null, OrignalName + "-" + Date.now() + "." + extension);
  }
});

var uploadZip = multer({
  storage: zipStore,
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(myLogger);

// index page
app.get("/", function(req, res, next) {
  res.render("./index.html");
  console.log("remote user ip connecting to index page: " + req.ip);
});

app.post("/uploadZip", uploadZip.single("zip"), function(req, res) {
  if (!req.file) {
    res.end("Upload error 400");
  }

  var filepath = path.join(req.file.destination, req.file.filename);
  var unzipper = new Unzipper(filepath);
  // console.log(filepath);
  unzipper.on("extract", function() {
    console.log("Finished extracting");
    unzipper.list();
  });

  unzipper.on("progress", function(fileIndex, fileCount) {
    console.log("Extracted file " + (fileIndex + 1) + " of " + fileCount);
  });

  unzipper.on("list", function(files) {
    console.log("The archive contains:");
    for (var i in files) {
      if (
        files[i].split("\\")[files[i].split("\\").length - 1].includes("index")
      ) {
        fs.unlink(req.file.destination + "/" + req.file.filename, function(
          err
        ) {
          if (err) throw err;
          // if no error, file has been deleted successfully
          console.log("File deleted!");
          res.redirect(
            req.protocol +
              "://" +
              req.get("host") +
              req.file.destination.split("public")[1] +
              "/" +
              files[i].split("\\").join("/")
          );
        });
        break;
      } else {
        if (i == files.length - 1) {
          fs.unlink(req.file.destination + "/" + req.file.filename, function(
            err
          ) {
            if (err) throw err;
            // if no error, file has been deleted successfully
            res.end(
              "Could not find index html. Add relative path after the root path to access the website. Your root path is - " +
                req.protocol +
                "://" +
                req.get("host") +
                req.file.destination.split("public")[1] +
                "/"
            );
            console.log("File            deleted!");
          });
        }
      }
    }
  });

  unzipper.on("error", function(err) {
    console.log("Caught an error", err);
    res.end("Caught an error");
  });

  unzipper.extract({
    path: path.join(__dirname, req.file.destination)
  });
});

server.listen(server_port, function() {
  console.log("Listening on server_port and ip  " + server_port);
});

function setHead(res) {
  // Website you wish to allow connection- * (all)
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
}
