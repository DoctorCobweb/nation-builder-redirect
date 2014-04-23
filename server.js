//
// server.js : a simple redirect server for the nation builder oauth2 process
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    request = require('request'),
    PORT = process.env.PORT || 5000;


var baseUri = 'https://agtest.nationbuilder.com/';
var responseType = 'code';
var grantType = 'authorization_code';

var authorizeUri = baseUri + 'oauth/authorize' +
                  '?response_type=' + responseType +
                  '&client_id=' + process.env.CLIENT_ID +
                  '&redirect_uri=' + process.env.REDIRECT_URI;

var accessTokenUri = baseUri + 'oauth/token';

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
    console.log(req.query.code);

    var postBody = {
        'client_id': process.env.CLIENT_ID,
        'redirect_uri': process.env.REDIRECT_URI,
        'grant_type': grantType,
        'client_secret': process.env.CLIENT_SECRET,
        'code': req.query.code
    };

    console.log('postBody:');
    console.log(postBody);

    var options = {
        url: accessTokenUri,
        method: 'POST',
        json: postBody
    };

    function callback(error, response, body) {
        console.log('in callback of POST request to get access token');
        console.log('error: ' + JSON.stringify(error));
        console.log('response: ' + JSON.stringify(response));
        console.log('body: ' + JSON.stringify(body));

        /*
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            console.log('info:');
            console.log(info);
    
            return res.redirect('https://www.google.com.au');
        }
        */
        return res.redirect('https://www.google.com.au');
    }
    
    console.log('making request to nation builder to get access token.');
    return request(options, callback);
    //return res.redirect('leadorganizerapp://oauth2authorization?code=' + req.query.code);
});


app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
});
