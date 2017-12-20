const weexCreate = require('./src/index');
module.exports = function (dir, optionalId, optionalName, cfg, extEvents, autoInstall) {
    return weexCreate(dir, optionalId, optionalName, cfg, extEvents, autoInstall);
}