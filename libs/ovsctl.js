var exec = require('child_process').exec;
var sys = require('util');
var async = require('async');
var _ = require('underscore');
var OVSPORT = 6666;

function ovsctl(server, port) {
	var segs = server.split(':');
	if(segs.length > 1) {
		this.server = segs[0];
		this.port = segs[1];
	}
	else {
		this.server = server;
		this.port = port ? port : OVSPORT;
	}
};
ovsctl.clean = function(nodes) {	
	for(var i in nodes) {
		var ovs = new ovsctl(nodes[i].ip, nodes[i].port);
		(function(ovs) {
			ovs.list('Bridge', function(err, brs) {
				for(var j in brs) {
					ovs.clear('Bridge', brs[j].name, 'netflow', function(err, res) {});
				}
			});
		})(ovs);
	}
};
ovsctl.prototype.exe = function(method, params, cb) {
	params = params ? params : [];
	var child = exec("ovs-vsctl --format json --db tcp:" + this.server + ":" + this.port + " " + method + " " + params.join(" "), function (error, stdout, stderr) {
		var result = '';
		try {
			result = JSON.parse(stdout);
			cb(undefined, result);
		}
		catch(e) {
			if(stderr) {
				cb(stderr, result);
			}
			else {
				cb(undefined, stdout);
			}
		}
	});
};

ovsctl.prototype.list = function(table, cb) {
	var self = this;
	this.exe('list', [table], function(err, res) {
		var error = undefined;
		var result = [];
		for(var i in res.data) {
			var obj = array2object(res.data[i], res.headings)
			result.push(obj);
		}
		cb.apply(self, [error, result]);
	});

};
ovsctl.prototype.get = function(table, name, column, cb) {
	var action;
	var params = [table, name];
	//console.log(typeof(column));
	if(typeof(column) == 'function') {
		cb = column;
		action = 'list';
	}
	else {
		action = 'get';
		params.push(column);
	}
	//console.log(action, params);
	this.exe(action, params, function(err, res) {
		var error = undefined;
		if(res.data.length >= 0) {
			var obj = array2object(res.data.pop(), res.headings);
			cb(error, obj);
			
		}
		else {
			error = 'empty';
			cb(error);
		}
	});
};
//ovs-vsctl find netflow targets=\"140.133.76.173:2055\"
ovsctl.prototype.find = function(table, column, value, cb) {
	this.exe('find', [table, column + '=' + value], function(err, res) {
		var result = [];
		for(var i in res.data) {
			var obj = array2object(res.data[i], res.headings)
			result.push(obj);
		}		
		if(err) {
			cb(err);
		}
		else {
			cb(undefined, result);
		}	
	});
};
ovsctl.prototype.clear = function(table, name, column, cb) {
	this.exe('clear', [table, name, column], function(err, res) {
		if(err) {
			cb(err, true);
		}
		else {
			cb(undefined, false);
		}
	});
};
ovsctl.prototype.addBr = function(br, cb) {
	this.exe('add-br', [br], function(err, result) {
		if(!err) {
			cb(err, result);
		}
		else {
			cb(err, false);
		}
	});
};
ovsctl.prototype.delBr = function(br, cb) {
	this.exe('del-br', [br], function(err, result) {
		if(!err) {
			cb(err, true);
		}
		else {
			cb(err, false);
		}
	});
};
ovsctl.prototype.addPort = function(br, iface, cb) {
	this.exe('add-port', [br, iface], function(err, result) {
		if(!err) {
			cb(err, true);
		}
		else {
			cb(err, false);
		}
	});
};
ovsctl.prototype.delPort = function(br, port, cb) {
	var args = []
	if(br) {
		args = [br, port];
	}
	else {
		args = [port]
	}
	this.exe('del-port', args, function(err, result) {
		if(!err) {
			cb(err, true);
		}
		else {
			cb(err, false);
		}
	});
};
ovsctl.prototype.addTunnel = function(br_name, port_name, remote_ip, key, cb) {
	this.exe('add-port', [br_name, port_name, '--', 'set', 'interface', port_name, 'type=gre', 'options:remote_ip=' + remote_ip, 'options:key=' + key], function(err, result) {
		if(!err) {
			cb(err, true);
		}
		else {
			cb(err, false);
		}
	});
};

//ovs-vsctl -- set Bridge br0 netflow=@nf -- --id=@nf create NetFlow targets=\"140.133.76.26:5566\" active-timeout=30
ovsctl.prototype.addNetFlow = function(br, uri, cb) {
	/*0 to 255*/
	var engine_type = this.server.split('.')[3];
	var self = this;
	this.genEngineID(function(engine_id) {
		self.exe('-- set Bridge', [br, 'netflow=@nf', '--', '--id=@nf', 'create', 'NetFlow' ,'targets=\\"' + uri + '\\"'/*, "add_id_to_interface=true"*/, "active-timeout=30", "engine_type="+engine_type, "engine_id="+engine_id], function(err, result) {
			if(!err) {
				cb(err, result);
			}
			else {
				cb(err, 0);
			}
		});	
	});
	
};

ovsctl.prototype.genEngineID = function(cb) {
	/*0 to 255*/
	var id = parseInt(Math.random() * 255);
	this.find('netflow', 'engine_id', id, function(err, res) {
		if(res.length == 0) {
			cb(id);
		}
		else {
			this.genEngineID(cb);
		}
	});
};


ovsctl.prototype.setController = function(br, controller, cb) {
	this.exe('set-controller', [br, (typeof controller == 'string' ? controller: controller.join(" "))], function(err, result) {
		if(!err) {
			cb(err, 1);
		}
		else {
			cb(err, 0);
		}
	});
};
ovsctl.prototype.addController = function(br, controller, cb) {
	var self = this;
	self.getController(br, function(err, controllers) {		
		controllers.push(controller);
		self.setController(br, controllers, function(err, result) {
			if(!err) {
				cb(err, 1);
			}
			else {
				cb(err, 0);
			}
		});
	});
}
ovsctl.prototype.getController = function(br, cb) {
	this.exe('get-controller', [br], function(err, result) {
		if(!err) {
			cb(err, result.replace(/\n$/, '').split('\n'));
		}
		else {
			cb(err, 0);
		}
	});
};
ovsctl.prototype.delController = function(br, uri, cb) {
	if(typeof(uri) == 'function') {
		cb = uri;
		uri = null;
	}

	var self = this;
	async.series([
		function(callback) {
			if(!uri) {
				callback(null, null);
			}
			else {
				self.getController(br, function(err, result) {
					callback(err, result);
				});
			}
		}
	], function(error, results) {
		var controller = results[0];
		controller = _.filter(controller, function(c) {
			return c != uri;
		});
		async.series([
			function(callback) {
				
				self.exe('del-controller', [br], function(err, result) {
					callback(err, result);
				});
			}], function(error, results) {
				self.setController(br, controller, function(err, result) {
					if(!err) {
						cb(err, 1);
					}
					else {
						cb(err, 0);
					}
				});
		});
	});
};
ovsctl.prototype.setStp = function(br_name, bool, cb) {
	cb = cb ? cb: function(){};
	this.exe('set Bridge', [br_name, 'stp_enable=' + bool ? 'true': 'false'], function(err, result) {
		if(!err) {
			cb(err, 1);
		}
		else {
			cb(err, 0);
		}
	});
};

function array2object(data, headings) {
	var obj = {};
	if(headings) {
		for(var i in headings) {
			var name = headings[i];
			if(typeof data[i] == 'string') {
				obj[name] = data[i];
			}
			else {
				obj[name] = data[i][1];
				if(!obj[name]) {
					obj[name] = [];
				}
				//hidden orig value
				obj[name].value = data[i];
			}
		}
	}
	else {
		for(var i in data) {
			if(/[0-9]/.test(i)) {
				obj[data[i][0]] = data[i][1];
			}	
		}
	}
	return obj;
}
function array2array(data) {
	var arr = [];
	if(typeof data == 'string') {
		arr.push(data);
	}
	else {
		for(var i in data) {
			if(/[0-9]/.test(i)) {								
				arr.push(data[i][1]);
			}	
		}
	}
	return arr;
}
ovsctl.array2object = array2object;
ovsctl.array2array = array2array;
module.exports = ovsctl;
/* usage:
var ovs = new ovsctl('140.133.76.19', 6666);
ovs.list('Bridge', function(res) {
	console.log(res);
});

ovs.get('Bridge', 'br0', function(res) {
	console.log('---');
	console.log(res);
});
*/
