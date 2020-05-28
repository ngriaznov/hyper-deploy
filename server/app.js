const operators = require("rxjs/operators");
const rxjs = require("rxjs");
const logger = require("./logger.js").logger;

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

const startDat = async (tree) => {
  let promises = [];

  dats.forEach((d) => {
    const promise = new Promise((resolve, reject) => {
      d.close(() => {
        resolve();
      });
    });
    promises.push(promise);
  });

  await Promise.all(promises);
  promises = [];

  // Iterate tree, recreate and share dats
  tree.children.forEach((dir) => {
    const promise = new Promise((resolve, reject) => {
      Dat(dir.path, function (err, dat) {
        if (err) throw err;
        var progress = dat.importFiles({ watch: true }); // with watch: true, there is no callback
        progress.on("put", function (src, dest) {
          logger.info(`Importing ${src.name} into archive`);
        });
        dat.joinNetwork();
        resolve(Object.assign(dir, { storage: dat.key.toString("hex") }));
        // TODO: Read metadata if any
        dats.set(dir.path, dat);
      });
    });
    promises.push(promise);
  });

  const update = await Promise.all(promises);
  tree.children.forEach((child) => {
    tree.children[tree.children.indexOf(child)] = update.find(
      (f) => f.path === child.path
    );
  });

  if (db) {
    await db.put({
      _id: "storage",
      structure: cryptr.encrypt(encryptorKey, JSON.stringify(tree)),
    });
  }
};

updatePackageMetadataSubject
  .pipe(operators.debounceTime(10000))
  .subscribe(async (tree) => {
    await startDat(tree);
  });

const updatePackageMetadata = async () => {
  try {
    updatePackageMetadataSubject.next(dirTree(uploadPackages));
  } catch {
    logger.error("failed to update package metadata");
  }
};

const copyEncrypt = (file, source, target) => {
  const targetFile = join(target, relative(source, file));

  try {
    fs.ensureDirSync(dirname(targetFile));
    updatePackageMetadata(targetFile);

    if (!file.includes("package.json")) {
      encryptor.encryptFile(
        file,
        targetFile,
        encryptorKey,
        encryptorOptions,
        (err) => {
          if (err) {
            logger.error(err);
          }
          logger.info("file encrypted: " + file);
        }
      );
    } else {
      fs.copyFileSync(file, targetFile)
    }
  } catch {
    logger.error("failed to encrypt file: " + file);
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

  fs.watch(uploadPackages, { recursive: true }, async (action, path) => {
    if (!path.includes(".dat")) {
      await updatePackageMetadata();
    }
  });
};

const initializeOrbit = async () => {
  logger.info("initializing orbit...");
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
