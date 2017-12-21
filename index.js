const weexCreate = require('./lib/index');
module.exports = function (dir, optionalId, optionalName, cfg, extEvents, autoInstall) {
    return weexCreate(dir, optionalId, optionalName, cfg, extEvents, autoInstall);
}