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

    /*
    //simple authentication for now for demo purposes
    if (req.body.email !== process.env.LOGIN_EMAIL ||
        req.body.password !== process.env.LOGIN_PASSWORD) {
        return res.send({'error': 'credentials are invalid'});
    }
    */

    //make sure the parameters are truthy
    if (!req.body.email || !req.body.password) {
        return res.send({'error': 'you supplied some blank credentials'});
    }

    var myNBId;
    var opt11 = ' --email=' + req.body.email;
    var opt12 = ' --password=' + req.body.password;
    var casperCmd1 = 'casperjs tryLoginToNB.js ' + opt11 + opt12;
    //console.log('casperCmd1: ' + casperCmd1);

    //constuct the parameters to send into mimick.js
    var opt21 = ' --clientId=' + process.env.CLIENT_ID;
    var opt22 = ' --clientSecret=' + process.env.CLIENT_SECRET;
    var opt23 = ' --redirectUri=' + process.env.REDIRECT_URI;
    var opt24 = ' --loginEmail=' + process.env.LOGIN_EMAIL;
    var opt25 = ' --loginPassword=' + process.env.LOGIN_PASSWORD;
    var casperCmd2 = 'casperjs mimick.js ' + opt21 + opt22 + opt23 + opt24 + opt25;
    //console.log('casperCmd2: ' + casperCmd2);



    function overBearer() {
        //1. first try to log user in standard NB account using their details
        //if success, we can get their NBId from the href from 'Your account' <a> 
        function tryToLoginToNB() {
            console.log('tryToLoginToNB function called');
            exec(casperCmd1 , {}, function (e, stdout, stderr) {
                if (e) {
                    return res.send({'error': 'summoning failed to log you in'});
                }
                //stdout is merely the found NBId for the user.
                myNBId = stdout;
                console.log('hwat is the: ' + myNBId);
                summonCasper();
            });
    
    
        }
    
    
        
        //2. go onto asking for the more laborious task of creating access_token
        function summonCasper() {
            console.log('wake up, Casper the ghost!');
            exec(casperCmd2 , {}, function (e, stdout, stderr) {
                if (e) {
                    return res.send({'error': 'summoning failed to get access_token'});
                }
                var result = JSON.parse(stdout);
                
                var obj = { "myNBId": myNBId, "access_token":result.access_token};

                //myNBId gets some weird newline char which we dont want
                var tmp_split= obj["myNBId"].split("\n");
                obj["myNBId"] = tmp_split[0];

                console.log('sending off myNBId and the access_token');
                return res.send(obj);
            });
        }

        //start the process
        tryToLoginToNB();
    }

    return overBearer();
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
