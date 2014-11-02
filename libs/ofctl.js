var exec = require('child_process').exec;
var async = require('async');
var ovsctl = require('./ovsctl');
var OFPORT = 6634;

function ofctl(server, br) {
	this.server = server;
	var ovs = this.ovs = new ovsctl(server);
	var self = this;
	self.ready = false;
	if(br) {
		this.clean('ptcp:' + OFPORT, function(error, result) {
			ovs.addController(br, 'ptcp:' + OFPORT, function(err, result) {
				self.ready = true;
			});
		});
	}
}
module.exports = ofctl;
ofctl.clean = function(nodes) {
	for(var i in nodes) {
		var ovs = new ovsctl(nodes[i].ip, nodes[i].port);
		var of = new ofctl(nodes[i].ip);
		of.clean();
	}
};
ofctl.prototype.clean = function(uri, cb) {
	if(typeof(uri) == "function") {
		cb = uri;
		uri = null;
	}
	var self = this;
	var ovs = this.ovs;
	ovs.list('Bridge', function(err, brs) {
		var func = [];
		for(var i in brs) {	
			func.push((function(br) {
				return function(callback) {
					ovs.delController(br.name, uri, function(err, result) {
						callback(err, result);
					});
				}
			})(brs[i]));
		}
		async.parallel(func, cb ? cb : function(){});
	});
};
ofctl.prototype.exe = function(method, params, cb) {
	if(params && !cb) {
		cb = params;
		params = '';
	}
	var child = exec("ovs-ofctl " + method + " tcp:" + this.server + ":" + OFPORT + ' ' + params, function (error, stdout, stderr) {
		cb(stderr, stdout);
	});
};
/*
of.addFlow({dl_src='11:22:33:44:55:66'}, ['output:1', 'normal']);
*/
ofctl.prototype.addFlow = function(rules, actions, cb) {
	var self = this;
	this.wait(function() {
		var params = '';
		for(var filed in rules) {
			params += filed + '=' + rules[filed] + ',';
		}
		params += 'action=' + actions.join(',');
		self.exe('add-flow', params, function(err, result) {
			cb(err, result);
		});
	});
};
ofctl.prototype.delFlow = function(rules, cb) {
	var self = this;
	this.wait(function() {
		var params = '';
		for(var filed in rules) {
			params += filed + '=' + rules[filed] + ',';
		}
		if(!params) {
			cb('no input rule', null);
		}
		self.exe('del-flows', params, function(err, result) {
			cb(err, result);
		});
	});
};
ofctl.prototype.getFlows = function(cb) {
	var self = this;
	this.wait(function() {
		self.exe('dump-flows', function(err, result) {
			
			var data = format(result);
			console.log(err);
			var flows = [];
			for(var i = 0; i< data.length; i++) {
				var row = data[i].split('actions=');
				var rules = row[0].replace(/^ +/, '').split(', ');
				var actions = row[1].split(',');
				var rules_obj = {};
				for(var j in rules) {
					var seg = rules[j].split('=');
					rules_obj[seg[0]] = seg[1];
				}
				//console.log(rule);
				//console.log(actions);
				flows.push({rules: rules_obj, actions: actions});
			}
			
			cb(err, flows);
		});
	});
};
ofctl.prototype.getPorts = function(cb) {
	var self = this;
	this.wait(function() {
		self.exe('dump-ports', function(err, result) {
			var data = format(result);
			//var header = data.pop();
			var ports = {};
			for(var i = 0, len = data.length; i < len; i++) {
				var row = data[i].split(': ');
				var num = row[0].replace(/ +port +/, '');
				var columns = row[1].split(', ');
				var stats = {};
				for(var j in columns) {
					var seg = columns[j].split('=');
					stats[seg[0].replace(' ', '_')] = seg[1];
				}
				ports[num] = stats 
			}
			cb(err, ports);
		})
	});
};
function format(result) {
	return result.replace(/^.+\n/, '').replace(/\n$/g, '').replace(/\n           /g, ', ').split("\n");
}
ofctl.prototype.wait = function(cb) {
	var self = this;
	setTimeout(this.ready ? cb: function() {
		self.wait(cb);
	}, 30);
}
/*
var of = new ofctl('140.133.76.229', 'vmbr1');
of.addFlow({dl_src: '11:22:33:44:55:66'}, ['output:1', 'normal'], function() {
	of.getFlows(function(err, flows) {
		console.log(flows);
	});	
	of.delFlow({dl_src: '11:22:33:44:55:66'}, function() {
		of.getFlows(function(err, flows) {
			console.log(flows);
		});	
	});
});

of.getPorts(function(err, ports) {
	//console.log(ports);
});
// usage:

var of = new ofctl('140.133.76.229', 'tunnel');
of.getPorts(function(err, ports) {
	console.log(ports);
});
{ '1':
   { rx_pkts: '0',
     bytes: '0',
     drop: '0',
     errs: '0',
     frame: '0',
     over: '0',
     crc: '0',
     tx_pkts: '0',
     coll: '0' },
  '65534':
   { rx_pkts: '0',
     bytes: '0',
     drop: '0',
     errs: '0',
     frame: '0',
     over: '0',
     crc: '0',
     tx_pkts: '0',
     coll: '0' } }
 */