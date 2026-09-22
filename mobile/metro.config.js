// Metro bundles from this folder by default, and would refuse to read the
// shared domain core in ../lib. Watching the repository root fixes that, and
// pinning node_modules keeps a single copy of React in the bundle — two copies
// is the classic monorepo crash ("invalid hook call").
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
// The web app's own dependencies are not this app's: resolve only from here.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
