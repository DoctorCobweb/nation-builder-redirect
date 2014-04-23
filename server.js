//
// server.js : a simple redirect server for the nation builder oauth2 process
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    request = require('request'),
    PORT = process.env.PORT || 5000;

var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36';
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
        json: postBody,
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    function callback(error, response, body) {
        console.log('in callback of POST request to get access token');
             
        if (!error && response.statusCode == 200) {
            //console.log(body.access_token);
            //console.log(body.token_type);
            //console.log(body.scope);
        
            return res.send(body.access_token);
        }
    }
        
    console.log('making request to nation builder to get access token.');
    return request(options, callback);
});


app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
});
