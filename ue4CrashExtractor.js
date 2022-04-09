const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const REPORTS_DIR = process.env.REPORTS_DIR || "./reports";

exports.extractCrashReports = async () => {
  console.log(`(!) Starting ASYNC crash report extraction...`);

  fs.readdir(UPLOAD_DIR, async (err, crashFiles) => {
    crashFiles = crashFiles.filter((crashFile) => {
      // Filter out .ue4crash files
      var crashFileExt = path.parse(crashFile).ext;
      if (crashFileExt == ".ue4crash") return true;
      else return false;
    });
    if (!crashFiles.length) console.log(`(!) Nothing left to extract.`);

    crashFiles.forEach(async (crashFile) => {
      var crashFileName = path.parse(crashFile).name;

      var reportDir = `${REPORTS_DIR}/${crashFileName}`;
      fs.mkdir(reportDir, async (err) => {
        if (err) {
          console.log(`(✖) MKDIR for '${crashFileName}' failed.`, "\n", err);
          return;
        }

        fs.readFile(`${UPLOAD_DIR}/${crashFile}`, async (err, buf) => {
          if (err) {
            console.log(`(✖) Reading '${crashFile}' failed.`, "\n", err);
            return;
          }

          zlib.inflate(buf, async (err, buf) => {
            if (err) {
              console.log(`(✖) ZLIB on '${crashFile}' failed.`, "\n", err);
              return;
            }

            console.log(`(*) Extracting '${crashFile}'...`);
            // HEADER
            // https://stackoverflow.com/a/16202908
            // 0 - 3 <-- 4 bytes 04 01 00 00 | IS THIS REALLY A MAGIC NUMBER?, always infront of a string
            var DirectoryName = buf
              .slice(4, 264)
              .toString("utf8")
              .replace(/\0.*$/g, ""); // 3 - 262 <-- FString: 260 bytes
            // 264 - 267 <-- 4 bytes 04 01 00 00
            var FileName = buf.slice(268, 528).toString("utf8"); // 268 - 528 <-- FString: 260 bytes
            var UncompressedSize = buf.readInt32LE(528); // 528 - 531 <-- int32: 4 bytes
            var FileCount = buf.readInt32LE(532); // 532 - 535 <-- int32: 4 bytes
            // console.log(DirectoryName);console.log(FileName);console.log(UncompressedSize);console.log(FileCount);

            // READING ALL FILES
            var bytePtr = 536;
            var bufEnd = buf.length - 1;
            while (bytePtr < bufEnd) {
              // FILE
              var CurrentFileIndex = buf.readInt32LE(bytePtr); // 536 - 539 <-- int32: 4 bytes
              // 540 - 543 <-- 4 bytes 04 01 00 00
              bytePtr += 8;
              var FileName = buf
                .slice(bytePtr, bytePtr + 260)
                .toString("utf8")
                .replace(/\0.*$/g, ""); // 544 - 803 <-- FString: 260 bytes
              bytePtr += 260;
              var FileSize = buf.readInt32LE(bytePtr); // 804 - 807 <-- int32: 4 bytes
              bytePtr += 4;
              var FileData = buf.slice(bytePtr, bytePtr + FileSize); // 808 -->
              bytePtr += FileSize;
              // console.log(CurrentFileIndex, FileName, FileSize);
              fs.writeFile(`${reportDir}/${FileName}`, FileData, (err) => {
                if (err) {
                  console.log(
                    `(✖) Writing '${reportDir}/${FileName}' failed.`,
                    "\n",
                    err
                  );
                }
              });
            }
            fs.rename(
              `${UPLOAD_DIR}/${crashFileName}.ue4crash`,
              `${reportDir}/${DirectoryName}.ue4crash`,
              (err) => {
                if (err) {
                  console.log(
                    `(✖) Moving '${crashFileName}.ue4crash' failed.`,
                    "\n",
                    err
                  );
                }
              }
            );
            fs.rename(
              `${UPLOAD_DIR}/${crashFileName}.json`,
              `${reportDir}/${DirectoryName}.json`,
              (err) => {
                if (err) {
                  console.log(
                    `(✖) Moving '${crashFileName}.json' failed.`,
                    "\n",
                    err
                  );
                }
              }
            );
            console.log(`(✔) Extracting '${crashFile}' completed.`);
          });
        });
      });
    });
  });
};

// REFERENCES
// CrashUpload.cpp - https://github.com/EpicGames/UnrealEngine/blob/4.27/Engine/Source/Runtime/CrashReportCore/Private/CrashUpload.cpp
// https://github.com/EpicGames/UnrealEngine/blob/4.17/Engine/Source/Programs/CrashReporter/CrashReportProcess/DataRouterReportQueue.cs
