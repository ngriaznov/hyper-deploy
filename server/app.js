const operators = require("rxjs/operators");
const rxjs = require("rxjs");

const chokidar = require("chokidar");
const fs = require("fs-extra");
const { join, relative, dirname, sep } = require("path");

const IPFS = require("ipfs");
const OrbitDB = require("orbit-db");
const dirTree = require("directory-tree");

var encryptor = require("file-encryptor");
let encryptorKey = "Fe3$MFl1nmf7";
var encryptorOptions = { algorithm: "aes256" };

const cryptr = require("aes256");

var Dat = require("dat-node");

const localPackages = "./packages";
const uploadPackages = "./download";

fs.ensureDirSync(localPackages);
fs.ensureDirSync(uploadPackages);
let db = null;
const dats = new Map();
const updatePackageMetadataSubject = new rxjs.Subject();

updatePackageMetadataSubject.pipe(operators.debounceTime(10000)).subscribe(() => {
  const stor = db.get("storage")
  const treeData = cryptr.decrypt(encryptorKey, stor[0].structure);
  const tree = JSON.parse(treeData);
  console.log(tree);
})

// Dat("./dat", function (err, dat) {
//   if (err) throw err;
//   console.log('importing files...')
//   var progress = dat.importFiles({ watch: true }); // with watch: true, there is no callback
//   progress.on("put", function (src, dest) {
//     console.log("Importing ", src.name, " into archive");
//   });
// });

const updatePackageMetadata = async () => {
  try {
    const tree = dirTree(uploadPackages);
    if (db) {
      await db.put({
        _id: "storage",
        structure: cryptr.encrypt(encryptorKey, JSON.stringify(tree)),
      });
      updatePackageMetadataSubject.next();
    }
  } catch {
    console.error("failed to update package metadata");
  }
};

const copyEncrypt = (file, source, target) => {
  try {
    const targetFile = join(target, relative(source, file));
    fs.ensureDirSync(dirname(targetFile));
    updatePackageMetadata(targetFile);

    encryptor.encryptFile(
      file,
      targetFile,
      encryptorKey,
      encryptorOptions,
      (err) => {
        console.log("file encrypted: " + file);
      }
    );
  } catch {
    console.log("failed to encrypt file: " + file);
  }
};

const initializeChokidar = () => {
  chokidar.watch(localPackages).on("change", (file) => {
    copyEncrypt(file, localPackages, uploadPackages);
  });

  chokidar.watch(localPackages).on("add", (file) => {
    copyEncrypt(file, localPackages, uploadPackages);
  });

  chokidar.watch(localPackages).on("unlink", (file) => {
    const targetFile = join(uploadPackages, relative(localPackages, file));
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }
  });

  chokidar.watch(localPackages).on("unlinkDir", async (dir) => {
    const targetDir = join(uploadPackages, relative(localPackages, dir));
    if (fs.existsSync(targetDir)) {
      fs.removeSync(targetDir);
    }
  });

  fs.watch(uploadPackages, { recursive: true }, async (file) => {
    await updatePackageMetadata();
  });
};

const initializeOrbit = async () => {
  const initIPFSInstance = async () => {
    return await IPFS.create({ repo: "./ipfs" });
  };

  const ipfs = await initIPFSInstance();
  const orbitdb = await OrbitDB.createInstance(ipfs);

  // Create / Open a database
  // db = await orbitdb.docstore("deploy-hyper");
  db = await orbitdb.open(
    "/orbitdb/zdpuArAhoH47pxDHvkHuZKrMUsALrWpfwex4Ded9ewrxhW1U2/deploy-hyper",
    { sync: true }
  );
  await db.load();

  fs.writeJsonSync("orbit.address", db.address);

  // Add initialization entry
  await db.put({ _id: "system", initialized: true });
};

initializeOrbit().then(() => initializeChokidar());
