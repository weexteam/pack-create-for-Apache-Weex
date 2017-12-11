// Helper functions
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const root = (args) => {
  return path.join(ROOT, 'src', args);
}
const rootNode = (args) => {
  return path.join(ROOT, args);
}
module.exports = {
  root,
  rootNode
}