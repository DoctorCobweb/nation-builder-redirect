//
// server.js : a simple redirect server for the nation builder oauth2 process
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    request = require('request'),
    exec = require('child_process').exec,
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

app.post('/logthedawgin', function (req, res) {
    console.log('in POST /logthedawgin handler');

    //calling device is expectin json as data
    res.set('Content-Type', 'application/json');

    //simple authentication for now for demo purposes
    if (req.body.email !== process.env.LOGIN_EMAIL ||
        req.body.password !== process.env.LOGIN_PASSWORD) {
        return res.send({'error': 'credentials are invalid'});
    }

    //constuct the parameters to append to nation-builder-1.js from 
    //process.env object here
    var opt1 = ' --clientId=' + process.env.CLIENT_ID;
    var opt2 = ' --clientSecret=' + process.env.CLIENT_SECRET;
    var opt3 = ' --redirectUri=' + process.env.REDIRECT_URI;
    var opt4 = ' --loginEmail=' + process.env.LOGIN_EMAIL;
    var opt5 = ' --loginPassword=' + process.env.LOGIN_PASSWORD;
    var casperCmd = 'casperjs mimick.js ' + opt1 + opt2 + opt3 + opt4 + opt5;

    //console.log('casperCmd: ' + casperCmd);
    
    function summonCasper() {
        console.log('wake up, Casper the ghost!');
        exec(casperCmd , {}, function (e, stdout, stderr) {
            if (e) {
                throw new Error('error: couldnt add redirectUri variable');
            }
            console.log(stdout);
            //return res.send(stdout);
            //for now send a constant string. when we are ready to hook it up to the app
            //we should send stdout back to iphone. 
            return res.send('got the access token, thankyou casperjs');
        });
    }

    return summonCasper();
});


app.get('/oauth2callback', function (req, res) {
    console.log('in /oauth2callback route handler');
    //console.log(req.query.code);

    //ultimately we want to res with json data so set the headers accordingly
    res.set('Content-Type', 'application/json');

    var postBody = {
        'client_id': process.env.CLIENT_ID,
        'redirect_uri': process.env.REDIRECT_URI,
        'grant_type': grantType,
        'client_secret': process.env.CLIENT_SECRET,
        'code': req.query.code
    };

    //console.log('postBody:');
    //console.log(postBody);

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
        //console.log('in callback of POST request to get access token');
             
        if (!error && response.statusCode == 200) {
            //console.log(body.access_token);
            //console.log(body.token_type);
            //console.log(body.scope);
        
            return res.send({'access_token': body.access_token});
        } else {
            return res.send({'error': 'unable to get access_token'});
        }
    }
        
    return request(options, callback);
});


app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
});
