//
// server.js : a server for the nation builder oauth2 process
//             it also handles getting all lists from the nation

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
    allPeopleUri =  baseUri + 'api/v1/' + 'people',
    allListsUri =  baseUri + 'api/v1/' + 'lists',
    allEventsUri = baseUri + 'api/v1/' + 'sites/' + process.env.NB_SLUG + '/pages/events',
    rsvpsForEventUri = baseUri + 'api/v1/' + 'sites/' 
                       + process.env.NB_SLUG + '/pages/events',
    peopleInAListUri = baseUri + 'api/v1/' + 'lists',


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

var Person = new mongoose.Schema({
    id:        Number, //NB id
    firstName: String,
    lastName:  String,
    email:     String,
    phone:     String,
    mobile:    String,
});


var Jobs = new mongoose.Schema(
    {
        jobType:    String,
        httpMethod: String,
        personId:   Number,
        listId:     Number
    },
    {
        capped: 8000000 //create a capped collection. want tailable cursors
    }
);


//create the Model of the list. instances of Models are documents in mongodb
//SYNTAX: conn.model(modelName, schema)
var ListModel = conn.model('List', List);

//similarly for permissions
var UserPermissionModel = conn.model('UserPermission', UserPermission);

//similarly for person 
var PersonModel = conn.model('Person', Person);

var JobsModel = conn.model('Job', Jobs);

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
    

    app.post('/addAJob', function (req, res) {
        console.log('in POST /addAJob');
        console.log(req.body.jobType);
        console.log(req.body.httpMethod);
        console.log(req.body.personId);
        console.log(req.body.listId);

        var aJob = new JobsModel({
                jobType:    req.body.jobType,
                httpMethod: req.body.httpMethod,
                personId:   req.body.personId,
                listId:     req.body.listId
            });

        aJob.save(function (err, aJob, numberAffected) {
            if (err) throw new Error(err);

            console.log('SUCCESS aJob: ' + aJob);
            return res.send({'jobAdded': aJob});
        });
    });


    
    // *** ROUTE *** 
    app.post('/logthedawgin', function (req, res) {
        console.log('in POST /logthedawgin handler');
    
        //calling device is expectin json as data
        res.set('Content-Type', 'application/json');
    
        //make sure the parameters are truthy
        if (!req.body.email || !req.body.password) {
            return res.send({'error': 'you supplied some blank credentials'});
        }
    
        var myNBId,
            permissionLevel,
            respObj = {},
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
    
        console.log(casperCmd2);
    
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

            //0. see if user has a permission set in our database before nagging NB 
            function checkPermissionLevel() {
                UserPermissionModel.findOne({'email': req.body.email}, function (e, r) {
                    if (e || !r) {
                        console.log('ERROR: tried to find users permission: ' + e);
                        return res.send({'error': 'error finding permission'});
                    }

                    //TODO: dont hardcode permissionLevel values here.
                    if (r.permissionLevel !== "admin" && 
                        r.permissionLevel !== "volunteer" ) {

                        console.log('ERROR: permissionLevel is not in permission set');
                        return res.send({'error': 'permissionLevel not in perm. set'});
                    }


                    console.log('0. => found user permission set');
                    console.log('r: ' + r);
                    console.log('r.permissionLevel: ' + r.permissionLevel);


                    //set the the permissionLevel variable
                    permissionLevel = r.permissionLevel; 

                    //go onto next step
                    tryToLoginToNB();
                });
            }


            //1. try to log user in standard NB account using their details
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
    
                    console.log('1. => casperCmd1 finished its process');

                    //the std output of casperCmd1 is simply myNBId, but it has a 
                    //trailing newline character which we fix up in next step 
                    myNBId = stdout;

                    //myNBId gets some weird newline char which we dont want
                    myNBId = myNBId.split("\n")[0];

                    //go onto next step
                    summonCasper();
                });
        
        
            }
        
            //2. go onto asking for the more laborious task of creating access_token
            function summonCasper() {
                console.log('wake up Casper 2');
                exec(casperCmd2 , {}, function (e, stdout, stderr) {
                    if (e) {
                        return res.send({'error': 'summoning fail to get access_token'});
                    }

                    console.log('2. => casperCmd2 finished its process');

                    var result = JSON.parse(stdout);
                    accessToken = result.access_token;
                    console.log('accessToken: ' + accessToken);

                    //construct the final response object to send off to app
                    respObj = {"error": null, 
                               "myNBId": myNBId, 
                               "access_token":accessToken,
                               "permissionLevel": permissionLevel};
    

                    //all done. woot.
                    return res.send(respObj);
                });
            }
    
            //start the process
            checkPermissionLevel();
        }
    
        return overBearer();
    });
    

    
    // *** ROUTE *** 
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
            console.log('in callback of POST /oauth2callback handler');
                 
            if (!error && response.statusCode == 200) {
                return res.send({'access_token': body.access_token});
            } else {
                return res.send({'error': 'unable to get access_token'});
            }
        }
            
        return request(options, callback);
    });
    
    
    // *** ROUTE *** 
    //returns all the lists for a 
    app.get('/allLists/:id/:access_token', function (req, res) {
        var perPage = 1000,
            allListsArray = [], //holds all of the nations lists
            accessToken = req.params.access_token,
            totalPages,
            totalNumberOfLists,
            extraUrls = [],
            firstPageOfLists = allListsUri + 
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
            }

    
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
                }


                //see if we need to paginate to get all lists
                if (totalPages === 1) {
                    //DONT need to paginate
                    
                    //create and save all the lists to mongodb
                    saveAllListsToMongo();
    
                    return res.send({'lists': allListsArray});
    
                } else {
                    //DO need to paginate
                    console.log('With per_page= ' + perPage + ' => have ' 
                              + (totalPages - 1) + ' to get.');
    
                    //create all the extra urls we need to call
                    for (var j = totalPages ; j > 1; j--) {
                        var aUrl = allListsUri + '?access_token=' + accessToken +
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
            //
            //result is of structure:
            // result = [  {page:3, ..., results: [{list}, {list}, ..., {list}]},
            //             , {page:4, ..., results: [{list}, {list}, ..., {list}]}
            //             , ...
            //             , {page:8, ..., results: [{list}, {list}, ..., {list}]}
            //          ];
            //

            var i, j;
    
            //result is an array of arrays wih objects
            for (i = 0; i < result.length; i++) {
                for (j = 0; j < result[i].results.length; j++) {
                    allListsArray.push(result[i].results[j]);
                }
            }
      
            console.log('THE FOLLOWING SHOULD HAVE THE SAME VALUE');
            console.log('allListsArray.length = ' + allListsArray.length);
            console.log('totalNumberOfLists = ' + totalNumberOfLists);
           
            //create and save all the lists to mongodb
            saveAllListsToMongo();

    
            return res.send({'lists': allListsArray});
        }
    
    
        function errorCb(error) {
            console.log('error: ' + error);
            return res.send({'error': error});
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




    // *** ROUTE *** 
    //return all events. an event is of form:
    // {
    //    eventId   : ...,
    //    name      : ...,
    //    startTime : ...,
    //    venue     : ... 
    // }

    app.get('/events/all/:myNBId/:access_token', function (req, res) {
        console.log('in /events/all/:myNBId/:access_token handler');

        var myNBId = parseInt(req.params.myNBId, 10),
            accessToken = req.params.access_token;

        //ultimately we want to res with json data so set the headers accordingly
        res.set('Content-Type', 'application/json');

        getAllEventIds(accessToken, function (err, results) {
            if (err) throw new Error(err);

            return res.send(results);
        });
    });


    // *** ROUTE *** 
    //return if person is in list specified by query param listId
    // {
    //    'isInList: true|false 
    // }

    app.get('/isPersonInList/:myNBId/:access_token', function (req, res) {
        console.log('in /isPersonInList/:myNBId/:access_token handler');

        var myNBId = parseInt(req.params.myNBId, 10),
            accessToken = req.params.access_token,
            listId = req.query.listId,
            personId = req.query.personId;


        //console.log('listId: ' + listId);
        //console.log('personId: ' + personId);

        //ultimately we want to res with json data so set the headers accordingly
        res.set('Content-Type', 'application/json');

        getAllPeopleInAList(accessToken, listId, function (err, results) {
            var i,
                people = results.people;

            if (err) { throw new Error(err);}

            for (i = 0; i < people.length; i++) {

                //typeof people[i].personId = number
                //typeof personId = string 
                //=> must parse string to int
                if (people[i].personId === parseInt(personId, 10)) {
                    return res.send({'isInList': true});
                }
            }

            return res.send({'isInList': false});
        });
    });


    // *** ROUTE *** 
    app.post('/namesForIds/:id/:access_token', function (req, res) {
        console.log('in POST /namesForIds/:id/:access_token handler');
        //console.log(req.body);
        var peopleIds = req.body.peopleIds,
            peopleUris = [],
            accessToken = req.params.access_token,
            myNBId = parseInt(req.params.id, 10),
            aPersonUri,
            peopleNames = [];
   
        //console.log(peopleIds);

        //create the array of uris we are going request
        for (var j = 0; j < peopleIds.length; j++) {
            aPersonUri = allPeopleUri + '/' + peopleIds[j] 
                        + '?access_token=' + accessToken;
            peopleUris.push(aPersonUri);
        }
        //console.log('peopleUris: ' + peopleUris);


        //ultimately we want to res with json data so set the headers accordingly
        res.set('Content-Type', 'application/json');
    

        //start the heavy lifting
        downloadAllAsync(peopleUris, successCb, errorCb);                
    

        function successCb(result) {
            console.log('successCb called. got all results');
            //console.log(result);
    
            var i, j,
                firstName,
                lastName;

            //result is an array of arrays wih objects
            for (i = 0; i < result.length; i++) {
               firstName = result[i].person.first_name,
               lastName  = result[i].person.last_name;

                peopleNames.push({
                    personId:  result[i].person.id || '',
                    firstName: firstName || '',
                    lastName:  lastName || '',
                    fullName:  firstName + ' ' + lastName 
                });
            }
            return res.send({'translatedPeople': peopleNames});
        }
    
        function errorCb(error) {
            console.log('error: ' + error);
            return res.send({'error': error});
        }

    });


    /*
    //TODO: implement.
    //
    app.get('/rsvpsForPerson/:myNBId/:access_token', function (req, res) {
        var myNBId = parseInt(req.params.myNBId, 10),
            token = req.params.access_token;


        getAllEventIds(token, function (e1, events) {
            if (e1) throw new Error(e1);

            getAllRsvpsForEvents(token, events, function (e2, eventsWithRsvps) {
                if (e2) throw new Error(e2);
             
                filterEventRsvpsForPerson(eventsWithRsvps, function (e3, eIds ) {
                    if (e3) throw new Error(e3);

                    eventNamesForEventIds(myNBId, token, eIds, function (e4, events) {
                        if (e4) throw new Error(e4);

                        //events is [    {eventId: '...', eventName: '...'}
                        //             ,  ...
                        //             , {...}
                        //          ]

                        return res.send(events: events);
                    });
                });
            });
        });
    });
    */



    //FINALLY START SERVER
    app.listen(PORT, function () {
        console.log('HTTP express server listening on port %d in %s mode',
            PORT, app.settings.env);
    });
} //globalWrapper function






//---------------------- HELPER FUNCTIONS -------------------------------


function getAllPeopleInAList(accessToken, listId, cb) {
    var perPage = 1000,
        allPeopleArray = [], //holds all of the people in a list 
        totalPages,
        totalNumberOfPeople,
        extraUrls = [],
        firstPageOfPeople = peopleInAListUri + '/' + listId + '/people' +
    		      '?access_token=' + accessToken + 
    		      '&page=1&per_page=' + perPage,
        optionsForFirstRequest = {
    	url: firstPageOfPeople,
    	method: 'GET',
    	headers: {
    	    'User-Agent': userAgent,
    	    'Content-Type': 'application/json',
    	    'Accept': 'application/json'
     	    }
        },
        reducedPeopleArray= []; //holds only person id, first and lastname
                                // which is sent back 

    
    function callbackForFirstRequest(error, response, body) {
        console.log('in callbackForFirstRequest for GET people in list  req.');
        
    
        if (error) return errorCb(error);
      
        if (response.statusCode == 200) {
    	var bodyObject = JSON.parse(body), // a string
    	    results = bodyObject.results;
    
    	totalNumberOfPeople = bodyObject.total;
    	totalPages = bodyObject.total_pages; // a number
    	 
    	console.log('totalNumberOfPeople: ' + totalNumberOfPeople);
    	console.log('totalPages: ' + totalPages);
    
    	//append individual first page people to peopleArray
    	for (var i = 0; i < results.length; i++) {
    	    allPeopleArray.push(results[i]);
    
    	    reducedPeopleArray.push({
    		personId  : results[i].id,
    		firstName : results[i].first_name,
    		lastName  : results[i].last_name
    	    });        
    	}
    
    	//see if we need to paginate to get all people 
    	if (totalPages === 1) {
    	    //DONT need to paginate
    	    
    	    //create and save all the events to mongodb
    	    //saveAllListsToMongo();
    
    	    return cb(null, {'people': reducedPeopleArray});
    
    	} else {
    	    //DO need to paginate
    	    console.log('With per_page= ' + perPage + ' => have ' 
    		      + (totalPages - 1) + ' to get.');
    
    	    //create all the extra urls we need to call
    	    for (var j = totalPages ; j > 1; j--) {
    		var aUrl = peopleInAListUri + '/' + listId + '/people' + 
                           '?access_token=' + accessToken +
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
        //
        //result is of structure:
        // result = [    {page:3, ..., results: [{person}, {person}, ..., {person}]},
        //             , {page:4, ..., results: [{person}, {person}, ..., {person}]}
        //             , ...
        //             , {page:8, ..., results: [{person}, {person}, ..., {person}]}
        //          ];
        //
    
        var i, j;
    
        //result is an array of arrays wih objects
        for (i = 0; i < result.length; i++) {
    	    for (j = 0; j < result[i].results[j].length; j++) {
                allPeopleArray.push(result[i].results[j]);
    
    	        reducedPeopleArray.push({
    	    	    personId:  result[i].results[j].id,
    		    firstName: result[i].results[j].first_name,
    		    lastName:  result[i].results[j].last_name
    	        });        
    	    }
        }
    
        return cb(null, {'people': reducedPeopleArray});
    }
    
    
    function errorCb(error) {
        console.log('error: ' + error);
        return cb(error);
    }
    
    
    
    //KICK OFF
    //make an initial call for the first page. from the response we can see how many
    //additional pages we need to call to get all the events of a nation.
    //to get additional pages we make use of downloadAllAsync function
    request(optionsForFirstRequest, callbackForFirstRequest);
}







//HELPER FUNCTION
function getAllEventIds(accessToken, cb) {
    console.log('in getAllEventIds() ....');

    var perPage = 1000,
        allEventsArray = [], //holds all of the nations events 
        totalPages,
        totalNumberOfEvents,
        extraUrls = [],
        firstPageOfEvents = allEventsUri + 
    		      '?access_token=' + accessToken + 
    		      '&page=1&per_page=' + perPage,
        optionsForFirstRequest = {
    	url: firstPageOfEvents,
    	method: 'GET',
    	headers: {
    	    'User-Agent': userAgent,
    	    'Content-Type': 'application/json',
    	    'Accept': 'application/json'
     	    }
        },
        reducedEventsArray= []; //holds only event_id and name, which is sent back 

    function makeAddressString(venueObj) {
        var address1, city;

        if (venueObj === undefined || 
            venueObj.address === undefined) return '';

        if (venueObj === null || 
            venueObj.address === null) return '';

        address1 = venueObj.address.address1 || '';
        city     = venueObj.address.city || '';

        return address1 + ' ' + city;
    }
    
    
    function callbackForFirstRequest(error, response, body) {
        console.log('in callbackForFirstRequest for GET all events req request.');
        
    
        if (error) return errorCb(error);
        //if (error) return cb(error);
      
        if (response.statusCode == 200) {
    	var bodyObject = JSON.parse(body), // a string
    	    results = bodyObject.results;
    
    	totalNumberOfEvents = bodyObject.total;
    	totalPages = bodyObject.total_pages; // a number
    	 
    	console.log('totalNumberOfEvents: ' + totalNumberOfEvents);
    	console.log('totalPages: ' + totalPages);
    
    	//append individual first page events to eventsArray
    	for (var i = 0; i < results.length; i++) {
    	    allEventsArray.push(results[i]);
    
    	    reducedEventsArray.push({
    		eventId   : results[i].id,
    		name      : results[i].name,
    		startTime : results[i].start_time,
    		venue     : makeAddressString(results[i].venue) 
    		//venue     : results[i].venue || ''
    	    });        
    	}
    
    	//see if we need to paginate to get all events 
    	if (totalPages === 1) {
    	    //DONT need to paginate
    	    
    	    //create and save all the events to mongodb
    	    //saveAllListsToMongo();
    
    	    return cb(null, {'events': reducedEventsArray});
    
    	} else {
    	    //DO need to paginate
    	    console.log('With per_page= ' + perPage + ' => have ' 
    		      + (totalPages - 1) + ' to get.');
    
    	    //create all the extra urls we need to call
    	    for (var j = totalPages ; j > 1; j--) {
    		var aUrl = allEventsUri + '?access_token=' + accessToken +
    			   '&page=' + j + '&per_page=' + perPage;
    		extraUrls.push(aUrl);
    	    }
    
    	    //start the heavy lifting to get all the pages concurrently
    	    //downloadAllAsync(extraUrls, successCb, errorCb);                
    	    downloadAllAsync(extraUrls, successCb, errorCb);                
    	}
    
        } else {
    	    return errorCb(response.statusCode);
        }
    }
    
    
    function successCb(result) {
        console.log('successCb called. got all results');
        //
        //result is of structure:
        // result = [    {page:3, ..., results: [{event}, {event}, ..., {event}]},
        //             , {page:4, ..., results: [{event}, {event}, ..., {event}]}
        //             , ...
        //             , {page:8, ..., results: [{event}, {event}, ..., {event}]}
        //          ];
        //
    
        var i, j;
    
        //result is an array of arrays wih objects
        for (i = 0; i < result.length; i++) {
    	    for (j = 0; j < result[i].results[j].length; j++) {
    	        allEventsArray.push(result[i].results[j]);
    
    	        reducedEventsArray.push({
        	    eventId:    result[i].results[j].id,
    		    name:       result[i].results[j].name,
    		    startTime:  result[i].results[j].start_time,
    		    venue:      makeAddressString(results[i].venue) 
    	        });        
    	    }
        }
       
        //create and save all the events to mongodb
        //saveAllListsToMongo();
    
        //return {'events': reducedEventsArray};
        return cb(null, {'events': reducedEventsArray});
    }
    
    
    function errorCb(error) {
        console.log('error: ' + error);
        //return {'error': error};
        return cb(error);
    }
    
    
    //function saveAllListsToMongo() {
    //    var k, aList, update = {}, query = {};
    
    //    for (k = 0; k < allListsArray.length; k++) {
    //	aList = allListsArray[k];
    //
    //	update.id =        aList.id;
    //	update.name =      aList.name;
    //	update.slug =      aList.slug;
    //	update.authorId =  aList.author_id;
    //	update.sortOrder = aList.sort_order;
    //	update.count =     aList.count;
    
    	//find doc based on the list id sent from NB
    //	query.id = update.id;                
    
    //	ListModel.findOneAndUpdate(query, update, {upsert: true}, cb);
    //    }
    
    //    function cb (err, doc) {
    //	if (err) return new Error('Error: ' + err);
    
    	//doc is the new and updated doc
    	//console.log('findOneAndUpdate doc: ' + doc);
    //    }
    //}
    
    
    //KICK OFF
    //make an initial call for the first page. from the response we can see how many
    //additional pages we need to call to get all the events of a nation.
    //to get additional pages we make use of downloadAllAsync function
    request(optionsForFirstRequest, callbackForFirstRequest);
}




//HELPER FUNCTION
function downloadAllAsync(urls, onsuccess, onerror) {

    var pending = urls.length;
    var result = [];

    if (pending === 0) {
	setTimeout(onsuccess.bind(null, result), 0);
	return;
    }

    urls.forEach(function (url, i) {
        downloadAsync(url, function (someThingsInAnArray) {
                if (result) {
                    result[i] = someThingsInAnArray; //store at fixed index
        	    pending--;                    //register the success
                    console.log('pending: ' + pending);
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
	    return successCb(bodyObj);
	} else {
	    return errorCb(error);
	}
    }

    //make a call for an individual page of events 
    request(optionsIndividual, callbackIndividual);
}






//------------------------------------------------------------------------------ 

    //*** EXPERIMENTAL SECTION ***
    //
    // *** storage shed ***
    //
    // *** route *** 
    /* used to seed the collection with a user permission
    app.post('/seeduserpermission', function (req, res) {
        console.log('in post /seeduserpermission handler');
        console.log(req.body);

        var p = new userpermissionmodel({
            permissionlevel: req.body.permissionlevel,
            email:           req.body.email
        });

        p.save(function (e, p) {
            if (e) return new error('error: ' + e);

            console.log('saved permission p: ' + p);
            return res.send({'result': 'ok'});
        });
    });
    */
    
    /*
    // *** ROUTE *** 
    app.post('/seedPeopleCollection', function (req, res) {
        console.log('in POST /seedPeopleCollection handler');
        console.log(req.body);

        var p = new PersonModel({
            id:        parseInt(req.body.id, 10),
            firstName: req.body.firstName,
            lastName:  req.body.lastName,
            email:     req.body.email,
            phone:     req.body.phone,
            mobile:    req.body.mobile
        });

        p.save(function (e, p) {
            if (e) return new Error('ERROR: ' + e);

            console.log('saved person : ' + p);
            return res.send({'result': p});
        });
    });
    */
