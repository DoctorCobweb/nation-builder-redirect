var casper = require('casper').create();


var baseUri = 'https://agtest.nationbuilder.com/';
var responseType = 'code';
var authorizeUri = baseUri + 'oauth/authorize' + 
                  '?response_type=' + responseType +
                  '&client_id=' + clientId +
                  '&redirect_uri=' + redirectUri;


//console.log('running casperjs to handle oauth2 login process..');

casper.start(authorizeUri, function () {
    //ui would be the standard login form we see in a browser
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());
    //this.echo('authorizing -> logging you into NB...');

    //login to agtest nation builder account
    this.fillSelectors('form.user_session_form', {
        'input[id="user_session_email"]': 'andretrosky@gmail.com',
        'input[id="user_session_password"]' : 'Express1'
    }, true);
});


casper.then(function () {
    //console.log('logged into NB, got code param too.');

    //sometimes we get a page asking to authorize app access to NB
    //sometimes we don't. think it is to do with caching or something...
    if (this.exists('input.update')) {
        //ui would be the authorize app to access your nation builder
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());
        //this.echo('input element called Authorize exists. click it..');

        //click the authorize button
        this.click('input.update');   
    } else {
        //no authorize app access to NB, we've gone directly to getting
        //access token
        //this.echo(this.getCurrentUrl());
        //this.echo(this.getTitle());

        //this.echo('no input Authorize element. we have the token now.');
        //body contains the access token
        this.echo(this.getPageContent());
 
        //skip over the next then() because we already have the access token.
        this.thenBypass(1);
    }
});

casper.then(function (){
    //console.log('we clicked the authorize button, so we ended here:');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());
    this.echo(this.getPageContent());



});


casper.run();
