var DEFAULT_PORT = 2055;
//var count = 0;
var collector;
var create = exports.create = function(handler) {
	var cp = require('child_process');
	var nf = cp.fork('./libs/netflow.js');	
	collector = {
		process: nf,
		port: DEFAULT_PORT,
		handler: handler
	};	
	nf.send({port: collector.port, handler: handler.toString()});
	return collector;
}
exports.stop = function() {
  if(collector) {
  	collector.process.kill();
  }
  return true;
}
exports.getServer = function() {
	if(!collector) {
		return create();
	}
	else {
		return collector;
	}
}
process.on('message', function(msg) {
	//var handler = eval(msg.handler);
	eval("var handler = " + msg.handler);
	var Collector = require("Netflow");
	var nf = new Collector(function (err){
		if(err!=null){
		   console.log("ERROR \n"+err);
		}
	});	
	nf.on("listening", function(){
		console.log("netflow listening on :" + msg.port);
	});
	nf.on("packet", function(flow) {
		handler(flow);
		//console.log(JSON.stringify(packet));
	});
	nf.listen(msg.port);
});
