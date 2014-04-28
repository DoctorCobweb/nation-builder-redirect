//PROCEDURE
//casperjs will try 3 times to get an access token.
//if it fails, it sends back simply 'error' as its message to user
//otherwise the response is the access_token.


var casper = require('casper').create();
var utils = require('utils');
var slug = 'agv';
var baseUri = 'https://' + slug + '.nationbuilder.com/';
var responseType = 'code';
var clientId = casper.cli.raw.get('clientId');
var clientSecret = casper.cli.raw.get('clientSecret');
var redirectUri = casper.cli.raw.get('redirectUri');
var loginEmail = casper.cli.raw.get('loginEmail');
var loginPassword = casper.cli.raw.get('loginPassword');


var authorizeUri = baseUri + 'oauth/authorize' + 
                  '?response_type=' + responseType +
                  '&client_id=' + clientId +
                  '&redirect_uri=' + redirectUri;



casper.start(authorizeUri, function () {
    //this.echo('F1');
    //ui would be the standard login form we see in a browser
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());

    //login to agtest nation builder account
    this.fillSelectors('form.user_session_form', {
        'input[id="user_session_email"]': loginEmail,
        'input[id="user_session_password"]' : loginPassword
    }, true);
});


casper.then(function () {
    //this.echo('F2');

    if(this.exists('form.user_session_form')){
        //this.echo('LOGIN FAILED...trying again');
        //login to agtest nation builder account
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': loginEmail,
            'input[id="user_session_password"]' : loginPassword
        }, true);
    } else if (this.exists('input.update')) {
        //this.echo('Authorize input exists. clicking it...');
        //sometimes we get a page asking to authorize app access to NB
        //sometimes we don't. think it is to do with caching or something...
        //ui would be the authorize app to access your nation builder
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());

        //click the authorize button
        this.click('input.update');   
    } else {
        //no authorize app access to NB, we've gone directly to getting
        //access token
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());
        //this.echo('no input Authorize element. we should have token now.');

        //body contains the access token
        this.echo(this.getPageContent());
 
        //skip over the next then() because we already have the access token.
        this.thenBypass(3);
    }
});

casper.then(function () {
    //this.echo('F3');

    if(this.exists('form.user_session_form')){
        //this.echo('LOGIN FAILED...trying again');
        //login to agtest nation builder account
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': loginEmail,
            'input[id="user_session_password"]' : loginPassword
        }, true);
    } else if (this.exists('input.update')) {
        //this.echo('Authorize input exists. clicking it...');
        //sometimes we get a page asking to authorize app access to NB
        //sometimes we don't. think it is to do with caching or something...
        //ui would be the authorize app to access your nation builder
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());

        //click the authorize button
        this.click('input.update');   
    } else {
        //no authorize app access to NB, we've gone directly to getting
        //access token
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());
        //this.echo('no input Authorize element. we should have token now.');

        //body contains the access token
        this.echo(this.getPageContent());
 
        //skip over the next then() because we already have the access token.
        this.thenBypass(2);
    }
});

casper.then(function (){
    //this.echo('F4');

    if (this.exists('input.update')) {
        //this.echo('Authorize input exists. clicking it...');
        //sometimes we get a page asking to authorize app access to NB
        //sometimes we don't. think it is to do with caching or something...
        //ui would be the authorize app to access your nation builder
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());

        //click the authorize button
        this.click('input.update');   
    } else {
        //no authorize app access to NB, we've gone directly to getting
        //access token
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());
        //this.echo('no input Authorize element. we should have token now.');

        //body contains the access token
        this.echo(this.getPageContent());
 
        //skip over the next then() because we already have the access token.
        this.thenBypass(1);
    }
});


casper.then(function (){
    //this.echo('F5');
    //this.echo('no input Authorize element. we should have token now.');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());

    if (this.exists('input.update') || this.exists('form.user_session_form')) {
        //still have not got a token
        this.echo('error');
    } else {
        //we have a token
        this.echo(this.getPageContent());
    }
});


casper.run();
