var forever = require('forever-monitor');

console.log('forever.js file innit');

var child = new (forever.Monitor)('./server.js', {
    max: 3,
    silent: true,
    options: []
  });

  child.on('exit', function () {
    console.log('server.js has exited after 3 restarts');
  });

  child.start();
