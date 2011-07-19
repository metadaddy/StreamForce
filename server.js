//Salesforce.com Streaming API Demo
//By: @aashay/@aashaysfdc (adesai@salesforce.com)
//License:  MIT STYLE, NO RIGHTS RESERVED
//Misc: NO WARRANTIES OR REFUNDS.  ALL SALES FINAL.  VOID WHERE PROHIBITED.


//set up your config vars like your oauth secrets and login all that jazz in a file like this.
//Don't forget to put this in your .gitignore or the whole world will know about it!
var config = require('./config.js')

var http = require('http'),
https = require('https'),
sys = require('sys'),
rest = require('restler'),
sys = require('sys'),
express = require('express'),
url = require('url'),
faye = require('faye'),
OAuth = require('oauth').OAuth2;

//Monkey-patch OAuth2's get method to include some nice headers
OAuth.prototype.get= function(url, access_token, callback) {
  this._request("GET", url, {"Authorization":"OAuth " + access_token, "X-PrettyPrint":"1"}, access_token, callback );
}

//Nobody should ever use MemoryStore in production.  If you do...what are you doing?!?!
MemoryStore = require('connect').session.MemoryStore;
var sessionStore = new MemoryStore();

var app = express.createServer();
app.configure(function(){    
    //bodyDecoder will parse JSON POST request bodies (as well as others), and place the result in req.body
    app.use(express.bodyParser());
    
    //When using methods such as PUT with a form, we can utilize a hidden input named _method, which can be used to alter the HTTP method. To do so we first need the methodOverride middleware
    app.use(express.methodOverride());
       
    //In case you feel like showing some cool HTML pages, do this.   
    app.set("view engine", "html");
    app.set("view options", {layout: false});
    //app.register(".html", require('ejs'));    
       
    //serve up static files
    app.use(express.static(__dirname + '/public'));
    
    //Cookies and sessions.  Mmm, cookies.
    app.use(express.cookieParser());
    app.use(express.session({ store: sessionStore, secret: config.sessionSecret }))
    
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

//NODE_ENV=production node app.js
app.configure('production', function(){
  app.use(express.errorHandler());
});


//Configure OAuth!
var oa = new OAuth(config.CLIENT_ID, config.CLIENT_SECRET, 
     'https://login.salesforce.com/',
     'services/oauth2/authorize',
     'services/oauth2/token'
);

//Redirect to do the oauth dance if we don't have an access token in this user's session
app.get('/', function(req,res){    
    if(!req.session.access_token) {
		res.redirect("/oauthDance");
	}
	else {		
		res.redirect('/stream');
	}    
});

app.get('/oauthDance', function(req,res){         
     var authurl = oa.getAuthorizeUrl({redirect_uri : "http://localhost:"+config.PORT+"/oauth/yay", response_type: "code"});
     res.redirect(authurl);     
});

//This URL must match the configuration in Settings > Develop > Remote Access
app.get('/oauth/yay', function(req,res){    
    var code = req.query.code;
    if(!code){ console.log ("GOT NO CODE MANG"); }
    else{        
        oa.getOAuthAccessToken(code,{redirect_uri : "http://localhost:"+config.PORT+"/oauth/yay",grant_type: "authorization_code"}, function(error, access_token, refresh_token){
             if(error) { 
                 console.log('error');
                 console.log(error); 
             }else{ 
                 // store the tokens in the session req.session.oa = oa; req.session.oauth_token = oauth_token;
                 req.session.access_token = access_token;
                 req.session.refresh_token = refresh_token;
                 console.log("ACCESS TOKEN ACQUIRED: " + access_token);           
                 
                 res.redirect('/');
             } 
         });
    }
});

//Hooray streaming!
app.get('/stream', function(req,res){    
        req.session.access_token = "00D80000000ajhG!AQcAQEe88NFUXUFVRB3mn9nBT.B6Vbts4VSPWpV90RxTUtf2BGVmwbCMw_RX4tu3iA8vibiGd6eXaQUCpPDBL40rC2WCZeYZ";
        if(!req.session.access_token){
            res.redirect("/oauthDance");
        }else{
            //Time to do some cool streaming stuff!
            console.log("GOT IT " + req.session.access_token);
            var client = new faye.Client('https://na6.salesforce.com/cometd');
            
            var cookies = {
                sid: req.session.access_token,  //We grabbed this from the oauthDance
                login: config.LOGIN,  //you@yourorg.com
                "com.salesforce.LocaleInfo":"us",
                language: "en_US",
            };
            //A neat hack to pass in oauth and login information
            client.addExtension({
              outgoing: function(message, callback) {
                                                   
                message.ext = message.ext || {};                
                message.ext.cookies = cookies;
                callback(message);            
              },              
            });
            
            var subscription = client.subscribe('/TestTopic', function(message) {
                console.log("HEY LOOK GOT A SWEET MSG " + JSON.stringify(message));
            });
            
            subscription.callback(function() {
              console.log('Subscription is now active! YEAAAAAAAA!');
            });
            subscription.errback(function(error) {
              console.error("ERROR ON SUBSCRIPTION ATTEMPT: " + error.message);
            });
            
            res.send("Check your console bud");  //TODO:  Console.log is boring, do something better!
        }
});

//Go baby go!
app.listen(config.PORT);

console.log("Server is running on port " + config.PORT);
    
