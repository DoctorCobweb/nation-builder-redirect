//
// server.js : a server for the nation builder oauth2 process
//             it also handles getting all lists from the nation
//

var applicationRoot = __dirname,
    path = require('path'),
    express = require('express'),
    request = require('request'),
    mongoose = require('mongoose'),
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
    allLists = baseUri + 'api/v1/' + 'lists',
    app; //express app


//mongodb stuff, used for storing all the lists for a nation
//using mongolab for cloud hosting the mongodb
var mongoUri = process.env.MONGOLAB_URI ||
               'mongodb://localhost/theGreensApp';

//connect to the default mongoose connection
var conn = mongoose.connect(mongoUri, function (err, res) {
    if (err) throw new Error('ERROR: ' + err);

    console.log('SUCCESS: connected to MongoDB: ' + mongoUri);
});


//define the Schema for a list
var List = new mongoose.Schema({
    id:          Number,
    name:        String,
    slug:        String,
    authorId:    {type: Number, index:true},
    sortOrder:   String,
    count:       Number
});


//define the Schema for a permission
var UserPermission = new mongoose.Schema({
    email:              {type: String, index: true, unique:true},
    permissionLevel:    String

});

//create the Model of the list. instances of Models are documents in mongodb
//SYNTAX: conn.model(modelName, schema)
var ListModel = conn.model('List', List);

//similarly for permissions
var UserPermissionModel = conn.model('UserPermission', UserPermission);

//listen for open event explicitly
mongoose.connection.on('open', function () {
    console.log('\'open\' event fired for mongo. now, safely start express sever');
    app = express();
    globalWrapper();
});


function globalWrapper() {
    app.configure(function () {
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.query());
        app.use(app.router);
        app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
    });
    
    app.configure('development', function(){
      app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });
    
    app.configure('production', function(){
      app.use(express.errorHandler());
    });
    
    
    //route handlers
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
    
    
        //NOTE ABOUT RETURNED JSON STRUCTURE
        //
        //if an error is encountered somewhere along the way, we return JSON with ONLY
        //an 'error' fields. Nothing else. No accessToken, myNBId or permissionLevel
        //field is even defined:
        // {'error': 'there was some error dude'}
        //
        //ONLY if everything 'check's out' do we return a JSON response of form:
        // {'error': null, 
        //  'access_token': '...', 
        //  'myNBId': '...', 
        //  'permissionLevel: '...'} 
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
                        return res.send({'error': 'summoning fail to get access_token'});
                    }
                    var result = JSON.parse(stdout);
                    accessToken = result.access_token;
                    var obj = {"error": null, 
                               "myNBId": myNBId, 
                               "access_token":accessToken};
    
                    //myNBId gets some weird newline char which we dont want
                    var tmp_split= obj["myNBId"].split("\n");
                    obj["myNBId"] = tmp_split[0];


                    UserPermissionModel.findOne({'email': req.body.email}, function (e, r) {
                        if (e || !r) {
                            console.log('ERROR: tried to find users permission: ' + e);
                            return res.send({'error': 'error finding permission'});
                        }


                        console.log('SUCCES: found user permission: ' + r);
                        //late match req.body.email to db with permissions.
                        obj["permissionLevel"] = r.permissionLevel; 
                        return res.send(obj);
                    });
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
    
    
    //returns all the lists for a person's NB id, which is the :id param passed in
    app.get('/myLists/:id/:access_token', function (req, res) {
        var perPage = 1000,
            allListsArray = [], //holds all of the nations lists
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
            },
            listsForAuthorId = [], //holds only lists for a persons NB id
            myNBId = parseInt(req.params.id, 10);

    
        function callbackForFirstRequest(error, response, body) {
            console.log('in callbackForFirstRequest for GET /lists req request.');
    
            if (error) return errorCb(error);
          
            if (response.statusCode == 200) {
                var bodyObject = JSON.parse(body), // a string
                    results = bodyObject.results;

                totalNumberOfLists = bodyObject.total;
                totalPages = bodyObject.total_pages; // a number
                 
                //console.log(bodyObject);
                console.log('totalNumberOfLists: ' + totalNumberOfLists);
                console.log('totalPages: ' + totalPages);
    
                //append individual first page lists to listsArray
                for (var i = 0; i < results.length; i++) {
                    allListsArray.push(results[i]);

                    //also create the lists for a secific authorId 
                    if (results[i].author_id === myNBId) {
                       listsForAuthorId.push(results[i]);
                    }
                }
                console.log('listsForAuthorId.length = ' + listsForAuthorId.length);

                //see if we need to paginate to get all lists
                if (totalPages === 1) {
                    //DONT need to paginate
                    
                    //create and save all the lists to mongodb
                    saveAllListsToMongo();
    
                    //return res.send({'lists': allListsArray});
                    return res.send({'lists': listsForAuthorId});
    
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
    
            var i, j;
    
            //result is an array of arrays wih objects
            for (i = 0; i < result.length; i++) {
                for (j = 0; j < result[i].length; j++) {
                    allListsArray.push(result[i][j]);

                    //also create the lists for a secific authorId 
                    if (result[i][j].author_id === myNBId) {
                       listsForAuthorId.push(result[i][j]);
                    }
                }
            }
      
            console.log('THE FOLLOWING SHOULD HAVE THE SAME VALUE');
            console.log('allListsArray.length = ' + allListsArray.length);
            console.log('totalNumberOfLists = ' + totalNumberOfLists);
            console.log('listsForAuthorId.length= ' + listsForAuthorId.length);
           
            //create and save all the lists to mongodb
            saveAllListsToMongo();

    
            //return res.send({'lists': allListsArray});
            return res.send({'lists': listsForAuthorId});
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
    
    
        function saveAllListsToMongo() {
            var k, aList, update = {}, query = {};

            for (k = 0; k < allListsArray.length; k++) {
                aList = allListsArray[k];

                update.id =        aList.id;
                update.name =      aList.name;
                update.slug =      aList.slug;
                update.authorId =  aList.author_id;
                update.sortOrder = aList.sort_order;
                update.count =     aList.count;
  
                //find doc based on the list id sent from NB
                query.id = update.id;                

                ListModel.findOneAndUpdate(query, update, {upsert: true}, cb);
            }

            function cb (err, doc) {
                if (err) return new Error('Error: ' + err);

                //doc is the new and updated doc
                //console.log('findOneAndUpdate doc: ' + doc);
            }
        }
    
    
        //ultimately we want to res with json data so set the headers accordingly
        res.set('Content-Type', 'application/json');
    
        //KICK OFF
        //make an initial call for the first page. from the response we can see how many
        //additional pages we need to call to get all the lists of a nation.
        //to get additional pages we make use of downloadAllAsync function
        request(optionsForFirstRequest, callbackForFirstRequest);
    });

    /* used to seed the collection with a user permission
    app.post('/seedUserPermission', function (req, res) {
        console.log('in POST /seedUserPermission handler');
        console.log(req.body);

        var p = new UserPermissionModel({
            permissionLevel: req.body.permissionLevel,
            email:           req.body.email
        });

        p.save(function (e, p) {
            if (e) return new Error('ERROR: ' + e);

            console.log('saved permission p: ' + p);
            return res.send({'result': 'ok'});
        });
    });
    */
    
    
    app.listen(PORT, function () {
        console.log('HTTP express server listening on port %d in %s mode',
            PORT, app.settings.env);
    });

} //globalWrapper function
