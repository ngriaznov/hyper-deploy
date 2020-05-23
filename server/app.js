const chokidar = require("chokidar");
const fs = require("fs-extra");
const { join, relative, dirname, sep } = require("path");
const hypertrie = require("hypertrie");
const db = hypertrie("./database", { valueEncoding: "json" });
var hyperdrive = require("hyperdrive");

var encryptor = require("file-encryptor");
let encryptorKey = "Fe3$MFl1nmf7";
var encryptorOptions = { algorithm: "aes256" };

const localPackages = "./packages";
const uploadPackages = "./download";

var drive = hyperdrive(uploadPackages);
drive.writeFile("./init.me", true);

drive.on("ready", () => {
  fs.writeFileSync("hyperdrive.key", drive.key.toString("hex"));
});

db.on("ready", d => {
  fs.writeFileSync("hypertrie.key", db.key.toString("hex"));
});

db.put("initialized", true, function() {
  db.get("initialized", console.log);
});

fs.ensureDirSync(localPackages);
fs.ensureDirSync(uploadPackages);

const updatePackageMetadata = filename => {
  const stats = fs.statSync(filename);

  db.put(filename, {
    name: dirname(filename)
      .split(sep)
      .pop(),
    created: stats.birthtime
  });
};

const copyEncrypt = (file, source, target) => {
  const targetFile = join(target, relative(source, file));
  fs.ensureDirSync(dirname(targetFile));
  updatePackageMetadata(targetFile);

  encryptor.encryptFile(
    file,
    targetFile,
    encryptorKey,
    encryptorOptions,
    err => {
      console.log("file encrypted: " + file);
    }
  );
};

const initializeChokidar = () => {
  chokidar.watch(localPackages).on("change", file => {
    copyEncrypt(file, localPackages, uploadPackages);
  });

  chokidar.watch(localPackages).on("add", file => {
    copyEncrypt(file, localPackages, uploadPackages);
  });
};

initializeChokidar();
