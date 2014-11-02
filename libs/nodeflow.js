var controller = [];
exports.create = function(port, name) {
	var cp = require('child_process');
	try {
		var nf = cp.fork('./libs/nodeflow.js');
		var obj = {
			process: nf,
			port: port,
			name: name, 
			table: {}
		};
		controller.push(obj);
		nf.send({port: port});
		nf.on('message', function(msg) {
			if(msg.cmd == 'update_table') {
				obj.table = msg.table;
			}
		});
		return true;
	} catch(e) {
		return false;
	}
}
exports.getServers = function() {
	return controller;
}
exports.stop = function() {
	for(var i in controller) {
		controller[i].process.kill();
	}
}

process.on('message', function(m) {
	var NodeFlowServer = require('NodeFLow').NodeFlowServer;
	var ns = new NodeFlowServer();		
	ns.start("0.0.0.0", m.port);
	ns.on('OFPT_STATS_REQUEST', function() {
		console.log('YA OFPT_STATS_REQUEST');
	});
	ns.on('OFPT_PACKET_IN', function(obj) {
		process.send({cmd: 'update_table', table: ns.getForwarding()});
  });
});
