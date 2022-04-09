const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
var serveIndex = require("serve-index");
const { extractCrashReports } = require("./ue4CrashExtractor");

const PORT = process.env.PORT || 8080;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads"; // TODO: Add environment var for dir, port
const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

app.get("/", (req, res) => {
  res.status(200).send("CRR ready.");
});

var immediateSched = false; // Makes sure immediate scheduling doesn't get repetitive for quick consecutive requests

app.post("/upload", (req, res) => {
  var uniqueDTID = getDateTimeString();
  req.pipe(fs.createWriteStream(`${UPLOAD_DIR}/${uniqueDTID}.ue4crash`));
  fs.writeFile(
    `${UPLOAD_DIR}/${uniqueDTID}.json`,
    JSON.stringify(req.query, null, "\t"),
    (err) => {
      if (err) {
        console.log("(✖) Receiving crash file failed.", "\n", err);
        res.status(409).send("Report uploading failed."); // https://stackoverflow.com/a/7088468
      } else {
        console.log("(✔) Received a crash file.");
        res.status(201).send("Report uploaded.");

        if (!immediateSched) {
          setTimeout(() => {
            extractCrashReports(); // Schedule extraction
            immediateSched = false;
          }, 3000);
          immediateSched = true;
        }
      }
    }
  );
});

app.listen(PORT, () => {
  console.log("(+) Crash Report Receiver started.");
  extractCrashReports(); // Run extraction now
});

// Serve extracted reports as an index for now
app.use("/reports", serveIndex(REPORTS_DIR));
app.use("/reports", express.static(REPORTS_DIR));

setInterval(() => {
  extractCrashReports(); // Periodical extraction
}, 1000 * 60 * 10); // Every 10 mins

const getDateTimeString = () => {
  // https://stackoverflow.com/a/30272803
  // e.g. 2022_08_29_10_09_32
  var d = new Date();
  var dateTime =
    d.getFullYear() +
    "_" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "_" +
    ("0" + d.getDate()).slice(-2) +
    "_" +
    ("0" + d.getHours()).slice(-2) +
    "_" +
    ("0" + d.getMinutes()).slice(-2) +
    "_" +
    crypto.randomBytes(20).toString("hex").slice(-5);

  return dateTime;
};
