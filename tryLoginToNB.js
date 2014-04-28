var casper = require('casper').create();
var NBSlug = casper.cli.raw.get('nationBuilderSlug');
var newSessionUri = 'https://' + NBSlug + '.nationbuilder.com/forms/user_sessions/new';
var email = casper.cli.raw.get('email');
var password = casper.cli.raw.get('password');

//'You account' link on page gets us the user id param
var yourAccountSelector = 'div.footer-account-links.span-9 > a';

//the last link in the div is the 'Sign out' link
var signOutSelector = 'div.footer-account-links.span-9 >a:last-child';


casper.start(newSessionUri, function () {
    //this.echo('F1');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());
    //console.log('trying to log user in...');
    if (this.exists('form.user_session_form')) {
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': email,
            'input[id="user_session_password"]': password
        }, true);
    }
});

casper.then(function () {
    //this.echo('F2');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());

    if (this.exists('form.user_session_form')) {
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': email,
            'input[id="user_session_password"]': password
        }, true);
    } 
    if (this.exists(yourAccountSelector)){
        //console.log('at least an <a> element exists');
        var hrefVal = this.getElementAttribute(yourAccountSelector, 'href');
        //console.log('hrefVal: ' + hrefVal);
        //console.log(hrefVal);
        var hrefArray = hrefVal.split("/");
        //this.echo(hrefArray);
      
        //this outputs the NB user id
        console.log(hrefArray[3]);

        if (this.exists(signOutSelector)) {
            //console.log('logging out');
            this.click(signOutSelector);
            this.thenBypass(3);
        }
    }
})

casper.then(function () {
    //this.echo('F3');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());

    if (this.exists('form.user_session_form')) {
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': email,
            'input[id="user_session_password"]': password
        }, true);
    } 
    if (this.exists(yourAccountSelector)) {
        //console.log('at least an <a> element exists');
        var hrefVal = this.getElementAttribute(yourAccountSelector, 'href');
        //console.log('hrefVal: ' + hrefVal);
        //console.log(hrefVal);
        var hrefArray = hrefVal.split("/");
        //this.echo(hrefArray);
      
        //this outputs the NB user id
        console.log(hrefArray[3]);

        if (this.exists(signOutSelector)) {
            //console.log('logging out');
            this.click(signOutSelector);
            this.thenBypass(2);
        }
    }
});

casper.then(function () {
    //this.echo('F4');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());
    if (this.exists('form.user_session_form')) {
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': email,
            'input[id="user_session_password"]': password
        }, true);
    } 
    if (this.exists(yourAccountSelector)) {
        //console.log('at least an <a> element exists');
        var hrefVal = this.getElementAttribute(yourAccountSelector, 'href');
        //console.log('hrefVal: ' + hrefVal);
        //console.log(hrefVal);
        var hrefArray = hrefVal.split("/");
        //this.echo(hrefArray);
      
        //this outputs the NB user id
        console.log(hrefArray[3]);

        //this.thenBypass(1);
        if (this.exists(signOutSelector)) {
            //console.log('logging out');
            this.click(signOutSelector);
            this.thenBypass(1);
        }
    }

});

casper.then(function () {
    //this.echo('F5');
    //this.echo(this.getCurrentUrl());
    //this.echo(this.getTitle());
    if (this.exists('form.user_session_form')) {
        this.fillSelectors('form.user_session_form', {
            'input[id="user_session_email"]': email,
            'input[id="user_session_password"]': password
        }, true);
    } 
    if (this.exists(yourAccountSelector)) {
        //console.log('at least an <a> element exists');
        var hrefVal = this.getElementAttribute(yourAccountSelector, 'href');
        //console.log('hrefVal: ' + hrefVal);
        //console.log(hrefVal);
        var hrefArray = hrefVal.split("/");
        //this.echo(hrefArray);
      
        //this outputs the NB user id
        console.log(hrefArray[3]);
        if (this.exists(signOutSelector)) {
            //console.log('logging out');
            this.click(signOutSelector);
        }
    }

});


casper.run();
