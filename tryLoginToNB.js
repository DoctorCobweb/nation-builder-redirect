var casper = require('casper').create();

var newSessionUri = 'https://agtest.nationbuilder.com/forms/user_sessions/new';
var email = casper.cli.raw.get('email');
var password = casper.cli.raw.get('password');

//'You account' link on page gets us the user id param
var yourAccountSelector = 'div.footer-account-links.span-9 > a';

//the last link in the div is the 'Sign out' link
var signOutSelector = 'div.footer-account-links.span-9 >a:last-child';


casper.start(newSessionUri, function () {
    //console.log('trying to log user in...');
    this.fillSelectors('form.user_session_form', {
        'input[id="user_session_email"]': email,
        'input[id="user_session_password"]': password
    }, true);
});

casper.then(function () {
    if (this.exists(yourAccountSelector)){
        console.log('at least an <a> element exists');
        var hrefVal = this.getElementAttribute(yourAccountSelector, 'href');
        console.log('hrefVal: ' + hrefVal);
        console.log(hrefVal);
        var hrefArray = hrefVal.split("/");
        this.echo(hrefArray);
      
        //this outputs the NB user id
        console.log(hrefArray[3]);
    }
})

casper.then(function () {
    //log the user out
    if (this.exists(signOutSelector)) {
        this.click(signOutSelector);
    }
});

casper.then(function () {
    this.echo(this.getCurrentUrl());
    this.echo(this.getTitle());

});
casper.run();
