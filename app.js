
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');
  
var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
//app.set('view engine', 'jade');
	app.set('view engine', 'ejs');
	app.set('view options', {
		open: '<?',
    close: '?>'
  });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

//override render
var http = require('http'),
		_ = require('underscore'),
		response = http.ServerResponse.prototype,
		_render = response.render;
response.render = function(view, options, callback) {	
	_.extend(arguments[1] ? arguments[1] : {}, this.options);
	return _render.apply(this, arguments);
}
response.addOptions = function(v) {	
	_.extend(this.options, v);
}
response.options = {};



// Routes
//app.get('/', routes.index);
require('./routes/ovs')(app);
require('./routes/api')(app);
require('./routes/index')(app);

app.listen(8080, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

