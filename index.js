const create = require('./bin/index');
create('./testbuild', '', 'testname', {})
.then(() => {
  console.log('Create Successful!')
})
.fail((e)=> console.log(e))
