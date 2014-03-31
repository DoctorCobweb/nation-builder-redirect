//
// server.js : a simple redirect server for the nation builder oauth2 process
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    PORT = process.env.PORT || 5000;


var app = express();


app.configure(function () {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.query());
    app.use(app.router);
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});


app.get('/oauth2callback', function (req, res) {
    console.log('in /oauth2callback route handler');
    console.log(req.query);

    //return res.send('hello');
    return res.redirect('leadorganizerapp://oauth2authorization?code=' + req.query.code);
});


app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
});
