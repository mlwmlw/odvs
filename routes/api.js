var ovsctl = require('../libs/ovsctl'),
		ofctl = require('../libs/ofctl'),
		ovsdb = require('../models/ovsdb'),
		_ = require('underscore'),
		async = require('async');
var Step = require('step');

module.exports = function(app) {
	var ovs_model = ovsdb.getInstance();	
	var db = ovs_model.db;
		
	function error(res, msg) {
		res.statusCode = 400;
		res.send(JSON.stringify({status: false, message: msg}));
	}
	function callback(res) {
		return function(err, result) {
			var json;
			if(err) {
				json = {status: false, message: err};
			}
			else if(result) {
				json = {status: true, message: result};
				ovsdb.getInstance().sync();
			}
			else {
				json = {status: true, message: 'unknown'};
			}		
			res.send(JSON.stringify(json));
		}
	}
	app.get('/api', function(req, res) {
		res.render('api', {});
	});
	app.get('/api/br/:host?', function(req, res) {
		if(!req.params.host) {
			error(res, 'GET /api/br/:host, argument error!');
			return;
		}
		ovs_model.getPorts(req.params.host, function(err, rows) {
			var result = {};
			for(var i in rows) {
				var row = rows[i];
				if(!result[row.name]) {
					result[row.name] = {id: row.id, name: row.name, host: row.host, ports: []};
				}
				if(row.type == 'netdev') {
					result[row.name].ports.push({id: row.pid, name: row.pname, type: row.type});
				}
			}
			res.send(JSON.stringify(result));
		});
		/*var ovs = new ovsctl(req.params.host);
		ovs.list('Bridge', function(err, row) {			
			res.send(JSON.stringify(row));
		});
		*/
	});
	app.post('/api/br', function(req, res) {

		if(!req.body.host || !req.body.name) {
			error(res, 'POST /api/br/ {host, name}, argument error!');
			return;
		}
		
		var json = {};
		var ovs = new ovsctl(req.body.host);
		ovs.addBr(req.body.name, callback(res));
	});
	
	app.put('/api/br', function(req, res) {
		if(!req.body.host) {
			error(res, 'POST /api/br/ {host, name}, argument error!');
			return;
		}
		if(!req.body.name) {
			error(res, 'PUT /api/br/ {host, name}, argument error!');
			return;
		}		
		var ovs = new ovsctl(req.body.host);
		if(typeof(req.body.controller) != 'undefined') {
			ovs.setController(req.body.name, [req.body.controller], callback(res));
		}
		else {
			res.send('controller no value!\n');
		}
	});
	app.delete('/api/br', function(req, res) {
		if(!req.body.host || !req.body.name) {
			error(res, 'DELETE /api/br/ {host, name}, argument error!');
			return;
		}
		var ovs = new ovsctl(req.body.host);
		ovs.delBr(req.body.name, callback(res));
	});
	
	app.post('/api/port', function(req, res) {
		if(!req.body.host || !req.body.br || !req.body.iface) {
			error(res, 'POST /api/port/ {host, br, iface}, argument error!');
			return;
		}
		var ovs = new ovsctl(req.body.host);
		ovs.delPort(req.body.br, req.body.iface, function() {
			ovs.addPort(req.body.br, req.body.iface, callback(res));	
		});
	});
	app.delete('/api/port', function(req, res) {
		if(!req.body.host || !req.body.iface) {
			error(res, 'DELETE /api/port/ {host, [br], iface}, argument error!');
			return;
		}
		var ovs = new ovsctl(req.body.host);
		ovs.delPort(req.body.br, req.body.iface, callback(res));
	});
	
	/*
		name : test
		hosts : a, b ,c 
		
		add-br = tunnel_test		
		tunnel = 
			a->b
			a->c
	*/
	app.post('/api/network', function(req, res) {
		if(!req.body.name || !req.body.hosts) {
			error(res, 'POST /api/network/ {name, hosts}, argument error!');
			return;
		}
		var hosts = req.body.hosts.split(",");
		var br = "tunnel_" + req.body.name;
		
		if(hosts.length < 2) {
			//error(res, 'hosts need bigger than 2');
			
		}
		
		async.series([
			function(callback) {
				//check input host
				db.all("SELECT * FROM Host", function(err, rows) {
					var allhost = [];
					for(var i in rows) {
						allhost.push(rows[i].ip);
					}
					for(var j in hosts) {
						//console.log(allhost, hosts[j]);
						if(!_.include(allhost, hosts[j])) {
							//console.log('!!');
							callback('host ' + hosts[j] + ' not exists');
							return;
						}
					}
					callback(null);
				});
			}, function(callback) {
				//check input network name 
				db.all("SELECT * FROM Bridge INNER JOIN Host on Host.ip = Bridge.host WHERE Bridge.name = ?", [br], function(err, rows) {
					if(rows.length > 0) {
						var exists = [];
						for(var i in rows) {
							exists.push(rows[i].ip)
						}
						callback("network exists [" + exists.join(", ") + "]");
						return;
					}
					else {
						callback(null);
					}	
				});				
			}, function(callback) {
				//create bridge
				var funcs = [];
				for(var i in hosts) {
					funcs.push((function(host) {
						return function(callback) {
							var ovs = new ovsctl(host);
							ovs.addBr(br, function(err, result) {								
								ovs.setStp(br, true);
								callback(err, result);
							});							
						};
					})(hosts[i]));	
				}
				async.parallel(funcs, callback);
			}
		], function(err, result) {
			//setup tunnel
			if(err) {
				callback(res)(err, result);
				return;
			}
			var funcs = [];
			var master = hosts[0];
			for(var i = 1; i < hosts.length; i++) {				
				funcs.push((function(host) {
					return function(callback) {
						addTunnel({name: br, host: master}, {name:br, host: host}, callback);
					};
				})(hosts[i]));
			}
			async.parallel(funcs, callback(res));
		});
	});
	/*
	app.put('/api/network', function(req, res) {
		if(!req.body.name || !req.body.hosts) {
			error(res, 'PUT /api/network/ {name, hosts}, argument error!');
			return;
		}
		var hosts = req.body.hosts;
		var br = 'tunnel_' + req.body.name;
		
		async.series([
			function(callback) {
				//check input host
				db.all("SELECT * FROM Host", function(err, rows) {
					var allhost = [];
					for(var i in rows) {
						allhost.push(rows[i].ip);
					}
					for(var j in hosts) {
						if(!_.include(allhost, hosts[j])) {
							callback('host ' + hosts[j] + ' not exists');
							return;
						}
					}
					callback(null);
				});
			}, function(callback) {
				//change bridge
				db.all("SELECT Bridge.host ,Bridge.name FROM Bridge INNER JOIN Host on Host.ip = Bridge.host WHERE Bridge.name = ?", [br], function(err, rows) {
					var allhost = [];
					rows.forEach(function(row) {
						var name = row.name.split("_")[1];
						allhost.push(row.host);
					});
					var msg = [];
					
					var funcs = [];
					if(allhost.length > 0) {
						allhost.forEach(function(host) {
							//remove exists bridge
							if(!_.include(hosts, host)) {
								msg.push("remove bridge " + host);
							}
						});
						hosts.forEach(function(host) {
							//create not found bridge
							if(!_.include(allhost, host)) {
								msg.push("create bridge " + host);
							}
						});
						//res.send(JSON.stringify(result));
					}
					callback(null, msg);
				});
			}], function(err, result) {
				//setup tunnel
				//if(err) {
					callback(res)(err, result);
					//return;
				//}
		});
	});*/
	app.get('/api/network', function(req, res) {
		db.all("SELECT Bridge.host ,Bridge.name FROM Bridge INNER JOIN Host on Host.ip = Bridge.host WHERE Bridge.name LIKE 'tunnel_%'", function(err, rows) {
			var result = {};
			for(var i in rows) {
				var row = rows[i];
				var name = row.name.split("_")[1];
				if(!result[name]) {
					result[name] = {name: row.name, hosts: []};
				}
				result[name].hosts.push(row.host);
			}
			res.send(JSON.stringify(result));
		});
	});
	app.delete('/api/network', function(req, res) {
		if(!req.body.name) {
			error(res, 'DELETE /api/network/ {name}, argument error!');
			return;
		}		
		var br = "tunnel_" + req.body.name;
		var funcs = [];
		db.each("SELECT Bridge.host, Bridge.name FROM Bridge INNER JOIN Host on Host.ip = Bridge.host WHERE Bridge.name = ?", [br], function(err, row) {
			funcs.push((function(host, name) {
				return function(callback) {
					var ovs = new ovsctl(host);
					ovs.delBr(name, callback);		
				};
			})(row.host, row.name));
		}, function() {
			async.parallel(funcs, callback(res));
		});	
		
	});
	app.get('/api/tunnel', function() {
		//TODO
	});
	function addTunnel(src, dst, cb) {
		var uuid = require('node-uuid').v4();
		var port_name = uuid.split('-')[1];
		var key = Math.round(Math.random()*0xfffff);
		async.parallel([function(callback) {			
			var ovs = new ovsctl(src.host);
			ovs.setStp(src.name, true);
			ovs.addTunnel(src.name, port_name, dst.host, key, callback);
		}, function(callback) {			
			var ovs = new ovsctl(dst.host);
			ovs.setStp(src.name, true);	
			ovs.addTunnel(dst.name, port_name, src.host, key, callback);
		}], cb);
	}
	app.post('/api/tunnel', function(req, res) {
		if(req.body.dp.length < 2) {
			res.send('argument error!\n');
		} 
		//var ovs = new ovsctl(req.body.host);
		var uuid = require('node-uuid').v4();
		db.all("SELECT * FROM Bridge where id = ? or id = ?", [req.body.dp[0], req.body.dp[1]], function(err, rows) {
			//addTunnel({rows[0].name}, {rows[1].name})
			Step(function() {
				var group = this.group();
				for(var i in rows) {
					var index = Math.abs(i - 1);
					var ovs = new ovsctl(rows[index].host);
					ovs.setStp(rows[index].name, true);
					
					var port_name = uuid.split('-')[index+1];
					var key = Math.round(Math.random()*0xfffff);
					ovs.addTunnel(rows[index].name, port_name, rows[i].host, key, group());
				}
			}, function(err, results) {
				var json = {status: 1, message: 'success'};
				for(var i in results) {
					if(!results[i]) {
						json = {status: 0, message: err};
					}
				}
				ovsdb.getInstance().sync();
				res.send(JSON.stringify(json));
			});
		});
	});
	app.delete('/api/tunnel', function(req, res) {
		//TODO
	});
	
	
	app.get('/api/flows/:host/:name', function(req, res) {
		var host = req.params.host;
		var name = req.params.name;
		if(!host || !name) {
			res.send('host or bridge not exists!\n');
			return;
		}
		var of = new ofctl(host, name);	
		of.getFlows(callback(res));
	});
	
	
	var nodeflow = require('../libs/nodeflow.js');
	app.post('/api/controller', function(req, res) {		
		var json = {status: 0, message: ''};
		try {
			if(nodeflow.create(parseInt(req.body.port), req.body.name)) {
				json.status = 1;
				json.message = 'success';
			}
		} catch(e){}
		res.send(JSON.stringify(json));
	});
	app.delete('/api/controller', function(req, res) {
		var servers = nodeflow.getServers();
		var json = {status: 1, message: 'success'};	
		for(var i in servers) {
			if(servers[i].name == req.body.name) {
				servers[i].process.kill();				
				delete servers[i];
				res.send(JSON.stringify(json));
				return;
			}
		}
	});
	app.post('/api/collector', function(req, res) {
		if(!req.body.host || !req.body.name) {
			res.send('host not exists!\n');
			return;
		}
		var ovs = new ovsctl(req.body.host);
		ovs.addNetFlow(req.body.name, '140.133.76.173:2055', callback(res));
		
	});
	app.delete('/api/collector', function(req, res) {
		if(!req.body.host || !req.body.name) {
			res.send('host not exists!\n');
			return;
		}
		var ovs = new ovsctl(req.body.host);
		ovs.clear('Bridge', req.body.name, 'netflow', callback(res));
	});
	
	/*
	app.get('/api/:ops?', function(req, res) {
		//console.log(req.params.ops)
		res.send('get');
	});
	app.put('/api/:id?', function(req, res) {
		res.send('update');
	});
	app.delete('/api/:id?', function(req, res) {
		res.send('delete');
	});
	app.post('/api/:ops?', function(req, res) {
		res.send('post');
	});*/

	
}

