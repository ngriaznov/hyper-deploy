const chokidar = require("chokidar");
const fs = require("fs-extra");
const { join, relative, dirname, sep } = require("path");

const IPFS = require("ipfs");
const OrbitDB = require("orbit-db");
const dirTree = require("directory-tree");

var encryptor = require("file-encryptor");
let encryptorKey = "Fe3$MFl1nmf7";
var encryptorOptions = { algorithm: "aes256" };

const localPackages = "./packages";
const uploadPackages = "./download";

fs.ensureDirSync(localPackages);
fs.ensureDirSync(uploadPackages);
let db = null;

const updatePackageMetadata = async () => {
  const tree = dirTree(uploadPackages);
  console.log(tree);
  if (db) {
    await db.put({ _id: "storage", structure: tree });
  }
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
    (err) => {
      console.log("file encrypted: " + file);
    }
  );
};

const initializeChokidar = () => {
  chokidar.watch(localPackages).on("change", (file) => {
    copyEncrypt(file, localPackages, uploadPackages);
  });

  chokidar.watch(localPackages).on("add", (file) => {
    copyEncrypt(file, localPackages, uploadPackages);
  });

  chokidar.watch(uploadPackages).on("all", async (file) => {
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
  db = await orbitdb.docstore("deploy-hyper");
  await db.load();

  // Listen for updates from peers
  db.events.on("replicated", (address) => {
    console.log(db.iterator({ limit: -1 }).collect());
  });

  fs.writeJsonSync("orbit.address", db.address);

  // Add initialization entry
  await db.put({ _id: "system", initialized: true });
};

initializeOrbit().then(() => initializeChokidar());
