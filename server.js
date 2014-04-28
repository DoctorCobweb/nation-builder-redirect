//
// server.js : a server for the nation builder oauth2 process
//             it also handles getting all lists from the nation
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    request = require('request'),
    exec = require('child_process').exec,
    PORT = process.env.PORT || 5000,
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36',

    baseUri = 'https://' + process.env.NB_SLUG + '.nationbuilder.com/',
    responseType = 'code',
    grantType = 'authorization_code',
    authorizeUri = baseUri + 'oauth/authorize' +
                  '?response_type=' + responseType +
                  '&client_id=' + process.env.CLIENT_ID +
                  '&redirect_uri=' + process.env.REDIRECT_URI,

    accessTokenUri = baseUri + 'oauth/token',
    allLists = baseUri + 'api/v1/' + 'lists';


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

    //make sure the parameters are truthy
    if (!req.body.email || !req.body.password) {
        return res.send({'error': 'you supplied some blank credentials'});
    }

    var myNBId,
        opt11 = ' --email=' + req.body.email,
        opt12 = ' --password=' + req.body.password,
        opt13 = ' --nationBuilderSlug=' + process.env.NB_SLUG,
        casperCmd1 = 'casperjs tryLoginToNB.js ' + opt11 + opt12 + opt13,

        //constuct the parameters to send into mimick.js
        opt21 = ' --clientId=' + process.env.CLIENT_ID,
        opt22 = ' --clientSecret=' + process.env.CLIENT_SECRET,
        opt23 = ' --redirectUri=' + process.env.REDIRECT_URI,
        opt24 = ' --loginEmail=' + process.env.LOGIN_EMAIL,
        opt25 = ' --loginPassword=' + process.env.LOGIN_PASSWORD,
        opt26 = ' --nationBuilderSlug=' + process.env.NB_SLUG,
        casperCmd2 = 'casperjs mimick.js ' + opt21 + opt22 + opt23 
                                           + opt24 + opt25 + opt26;


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
                if (stdout === "") {
                    return res.send({'error': 'invalid credentials'});
                }

                myNBId = stdout;
                summonCasper();
            });
    
    
        }
    
        //2. go onto asking for the more laborious task of creating access_token
        function summonCasper() {
            console.log('wake up Casper');
            exec(casperCmd2 , {}, function (e, stdout, stderr) {
                if (e) {
                    return res.send({'error': 'summoning failed to get access_token'});
                }
                var result = JSON.parse(stdout);
                accessToken = result.access_token;
                var obj = { "myNBId": myNBId, "access_token":accessToken};

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

    //ultimately we want to res with json data so set the headers accordingly
    res.set('Content-Type', 'application/json');

    var postBody = {
        'client_id': process.env.CLIENT_ID,
        'redirect_uri': process.env.REDIRECT_URI,
        'grant_type': grantType,
        'client_secret': process.env.CLIENT_SECRET,
        'code': req.query.code
    };

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
            return res.send({'access_token': body.access_token});
        } else {
            return res.send({'error': 'unable to get access_token'});
        }
    }
        
    return request(options, callback);
});


app.get('/myLists/:id/:access_token', function (req, res) {
    var perPage = 50,
        allListsArray = [],
        accessToken = req.params.access_token,
        totalPages,
        totalNumberOfLists,
        extraUrls = [],
        firstPageOfLists = allLists + 
                          '?access_token=' + accessToken + 
                          '&page=1&per_page=' + perPage,
        optionsForFirstRequest = {
        url: firstPageOfLists,
        method: 'GET',
        headers: {
            'User-Agent': userAgent,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        };


    function callbackForFirstRequest(error, response, body) {
        console.log('in callbackForFirstRequest for GET /lists req request.');

        if (error) return errorCb(error);
      
        if (response.statusCode == 200) {
            var bodyObject = JSON.parse(body); // a string
            totalNumberOfLists = bodyObject.total;
            totalPages = bodyObject.total_pages; // a number
            //console.log(bodyObject);
            console.log('totalNumberOfLists: ' + totalNumberOfLists);
            console.log('totalPages: ' + totalPages);

            //append individual first page lists to listsArray
            for (var i = 0; i < bodyObject.results.length; i++) {
                allListsArray.push(bodyObject.results[i]);
            }
            //console.log(allListsArray);
            
            //see if we need to paginate to get all lists
            if (totalPages === 1) {
                //DONT need to paginate
                return res.send({'lists': allListsArray});

            } else {
                //DO need to paginate
                console.log('With per_page= ' + perPage + ' => have ' 
                          + (totalPages - 1) + ' to get.');

                //create all the extra urls we need to call
                for (var j = totalPages ; j > 1; j--) {
                    var aUrl = allLists + '?access_token=' + accessToken +
                               '&page=' + j + '&per_page=' + perPage;
                    extraUrls.push(aUrl);
                }

                //start the heavy lifting to get all the pages concurrently
                downloadAllAsync(extraUrls, successCb, errorCb);                
            }

        } else {
            return errorCb(response.statusCode);
        }
    }


    function successCb(result) {
        console.log('successCb called. got all results');
        //result is an array of arrays wih objects
        for (var i = 0; i < result.length; i++) {
            for (var j = 0; j < result[i].length; j++) {
                allListsArray.push(result[i][j]);
            }
        }
  
        console.log('THE FOLLOWING SHOULD HAVE THE SAME VALUE');
        console.log('allListsArray.length = ' + allListsArray.length);
        console.log('totalNumberOfLists = ' + totalNumberOfLists);

        return res.send({'lists': allListsArray});
    }


    function errorCb(error) {
        console.log('error: ' + error);
        return res.send({'error': error});
    }


    function downloadAllAsync(urls, onsuccess, onerror) {
        var pending = urls.length;
        var result = [];

        if (pending === 0) {
            setTimeout(onsuccess.bind(null, result), 0);
            return;
        }

        urls.forEach(function (url, i) {
            downloadAsync(url, function (someListsInAnArray) {
                if (result) {
                    result[i] = someListsInAnArray; //store at fixed index
                    pending--;                    //register the success
                    if (pending === 0) {
                        onsuccess(result);
                    } 
                }
            }, function (error) {
                if (result) {
                    result = null;
                    onerror(error);
                }
            });
        });
    }


    function downloadAsync(url_, successCb, errorCb) {
        //console.log('downloading lists from: ' + url_);

        var optionsIndividual = {
            url: url_,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };


        function callbackIndividual(error, response, body) {
            if (!error && response.statusCode == 200) {
                var bodyObj = JSON.parse(body);
                return successCb(bodyObj.results);
            } else {
                return errorCb(error);
            }
        }

        //make a call for an individual page of lists
        request(optionsIndividual, callbackIndividual);
    }


    //ultimately we want to res with json data so set the headers accordingly
    res.set('Content-Type', 'application/json');

    //KICK OFF
    //we make an initial call for the first page. from the response we can see how many
    //additional pages we need to call to get all the lists of a nation.
    //to get additional pages we make use of downloadAllAsync function
    request(optionsForFirstRequest, callbackForFirstRequest);
});


app.listen(PORT, function () {
    console.log('HTTP express server listening on port %d in %s mode',
        PORT, app.settings.env);
});
