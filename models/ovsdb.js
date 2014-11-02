var sqlite3 = require('sqlite3').verbose(),
		ovsctl = require('../libs/ovsctl'),
		fs = require('fs'),
		nodeflow = require('../libs/nodeflow.js'),
		netflow = require('../libs/netflow.js');
		
var DB_PROVIDER = [':memory:', '/home/mlwmlw/www/odvs/db/odvs.db'][1];//:memory:, 
function ovsdb(server) {
	var self = this;
	if(server) {
		if(DB_PROVIDER != ':memory:') {
			try {
				fs.unlinkSync(DB_PROVIDER);
			} catch(e) {}
				
		}
		this.db = ovsdb.getDB();
		this.server = server;
		this.create_schema();
		this.sync();		
	}
	else {
		this.db = ovsdb.getDB();
	}
	ovsdb.instance = this;
};

ovsdb.prototype.clean = function(cb) {
	var db = this.db;
	var tables = ['Host', 'Bridge', 'Port', 'Interface', 'Controller', 'NodeFlow', 'NetFlow'/*, 'NetFlow_Collector'*/];
	db.serialize(function() {
		for(var i in tables) {
			db.run("DELETE FROM " + tables[i]);
		}
		db.all("SELECT 1", cb);
	});
};
ovsdb.getDB = function() {
	if(ovsdb.instance) {
		return ovsdb.instance.db;
	}
	return new sqlite3.Database(DB_PROVIDER);
};

ovsdb.getInstance = function() {
	return ovsdb.instance;
};
ovsdb.prototype.create_schema = function() {
	var db = this.db;
	db.serialize(function() {
		db.run("CREATE TABLE Host (ip TEXT, name TEXT)");
	  db.run("CREATE TABLE Bridge (id TEXT, host TEXT, name TEXT, controller TEXT, netflow TEXT)");
	  db.run("CREATE TABLE Port (id TEXT, datapath_id TEXT, name TEXT, interface TEXT)");
	  db.run("CREATE TABLE Interface (id TEXT, ofport INT, type TEXT, name TEXT, statistics TEXT, options TEXT)");
	  db.run("CREATE TABLE Controller (id TEXT, target TEXT)");
	  db.run("CREATE TABLE NodeFlow (id TEXT, name TEXT)");
	  db.run("CREATE TABLE NetFlow (id TEXT, engine_type INT, engine_id INT)");
	  db.run("CREATE TABLE NetFlow_Collector (datapath_id TEXT, input int, output int, src_ip TEXT, src_port TEXT, dst_ip TEXT, dst_port TEXT, size INTEGER, packets INTEGER, time INTEGER)");
	});
};
ovsdb.prototype.sync = function() {
	var db = this.db;
	var server = this.server;	
	var self = this;	
	this.clean(function() {
		for(var i = 0; i < server.length; i++) {
			var ovs = new ovsctl(server[i].ip, server[i].port);
			db.run("INSERT INTO host VALUES (?, ?)", server[i].ip, server[i].name);	
			self.syncBridges(ovs, function(_ovs, dp_port) {
				self.syncPorts(_ovs, dp_port);
				self.syncIfaces( _ovs);
				self.syncNetflow(_ovs);
			});
		}		
	});
};
ovsdb.prototype.syncBridges = function(ovs, cb) {
	var db = this.db;
	var dp_port = {};

	ovs.list('Bridge', function(err, brs) {
		for(var j = 0; j < brs.length; j++) {
			var controllers = ovsctl.array2array(brs[j].controller);
			for(var k in controllers) {
				ovs.get('Controller', controllers[k], function(err, ctl) {
					
					db.run("INSERT INTO Controller VALUES (?,  ?)", ctl._uuid, ctl.target);					
				});
			}
			db.run("INSERT INTO Bridge VALUES (?, ?, ?, ?, ?)", brs[j].datapath_id, this.server, brs[j].name, controllers.join(','), brs[j].netflow);
			var ports = ovsctl.array2array(brs[j].ports);
			for(var k in ports) {
				dp_port[ports[k]] = brs[j].datapath_id;
			}
		}
		cb(ovs, dp_port);	
	});	


};
ovsdb.prototype.syncPorts = function(ovs, dp_port) {
	var db = this.db;
	ovs.list('Port', function(err, ports) {
			for(var j = 0; j < ports.length; j++) {
				//console.log(dp_port[ports[j]._uuid]);
				db.run("INSERT INTO Port VALUES (?, ?, ?, ?)", ports[j]._uuid, dp_port[ports[j]._uuid], ports[j].name, ports[j].interfaces);
			}
	});
};

ovsdb.prototype.syncIfaces = function(ovs) {
	var db = this.db;
	ovs.list('Interface', function(err, ifaces) {
		
		for(var i = 0; i < ifaces.length; i++) {
			db.run("INSERT INTO Interface VALUES (?, ?, ?, ?, ?, ?)", ifaces[i]._uuid, ifaces[i].ofport.value, ifaces[i].type ? ifaces[i].type : 'netdev', ifaces[i].name, JSON.stringify(ovsctl.array2object(ifaces[i].statistics)), JSON.stringify(ovsctl.array2object(ifaces[i].options)));
		}
	});				
};
ovsdb.prototype.syncNetflow = function(ovs) {
	var db = this.db;
	ovs.list('netflow', function(err, entities) {
		for(var i = 0; i < entities.length; i++) {
			var entity = entities[i];
			db.run("INSERT INTO NetFlow VALUES (?, ?, ?)", entity._uuid, entity.engine_type.value, entity.engine_id.value);
		}
	});	
};
ovsdb.prototype.getPorts = function(host, cb) {
	var db = this.db;
	db.all("SELECT Bridge.id, Bridge.name, Port.id pid, Port.name pname, Interface.type, Host.ip host from Bridge INNER JOIN Host on Bridge.host = Host.ip INNER JOIN Port ON Bridge.id = Port.datapath_id INNER JOIN Interface on Port.interface = Interface.id Where Host Like ? Order By Bridge.host, Bridge.name, Interface.ofport", host, cb);
};
ovsdb.prototype.getAllPort = function(host, cb) {
	if(host && !cb) {
		cb = host;
		host = '%';
	}
	var db = this.db;
	var brs = {};
	var ports = {};
	var hosts = {};
	var controllers = nodeflow.getServers();
	db.each("SELECT Port.*, Interface.type, Interface.ofport, Interface.statistics, Host.name AS host_name,Bridge.host host, Bridge.name AS br_name, netflow, Controller.target controller from Bridge LEFT JOIN Controller on Controller.id = Bridge.controller INNER JOIN Host on Bridge.host = Host.ip INNER JOIN Port ON Bridge.id = Port.datapath_id INNER JOIN Interface on Port.interface = Interface.id Where Host Like ? Order By Bridge.host, Bridge.name, Interface.ofport", host, function(err, row) {
		//console.log(row);
		if(err) {
			cb(err, []);
			return;
		}
		if(!brs[row.host_name]) {
			brs[row.host_name] = [];
			ports[row.host_name] = [];
		}
		if(!brs[row.host_name][row.br_name]) {
			var seg = row.controller ? row.controller.split(':') : [];
			var port = seg[2] ? seg[2] : seg[1];
			var ip = seg[2] ? seg[1] : '';
			brs[row.host_name][row.br_name] = {
					netflow: row.netflow,
					controller: {
						uri: row.controller,
						ip: ip,
						port: port
					}
			};
			ports[row.host_name][row.br_name] = [];
		}
		row.statistics = JSON.parse(row.statistics)
		ports[row.host_name][row.br_name].push(row);
		
		if(!hosts[row.host_name]) {
			hosts[row.host_name] = row.host;
		}
	}, function(err) {
		var result = {};
		result.brs = brs;
		result.ports = ports;
		result.host = hosts;
		cb(err, result);
	});
};
ovsdb.prototype.addNetflowRecord = function(header, bridge, netflow) {
	var db = this.db;
	//datapath_id TEXT, input int, output int, src_ip TEXT, src_port TEXT, dst_ip TEXT, dst_port TEXT, size INTEGER, packets INTEGER, time INTEGER

	db.run("INSERT INTO NetFlow_Collector VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
					bridge.id, 
					netflow.input, 
					netflow.output, 
					netflow.srcaddr.join('.'), 
					netflow.srcport, 
					netflow.dstaddr.join('.'),
					netflow.dstport,
					netflow.dOctets, 
					netflow.dPkts, 
					header.unix_secs 
				);
};
ovsdb.prototype.getNetflowSum = function(bridge, cb) {
	var db = this.db;
	if(typeof(bridge) == 'function') {
		cb = bridge;
		bridge = '%'		
	}
	db.all("SELECT Bridge.id, host, name, SUM(size) size, SUM(packets) packets,netflow FROM NetFlow_Collector INNER JOIN Bridge on NetFlow_Collector.datapath_id = Bridge.id WHERE bridge.id LIKE ? GROUP BY Bridge.id", bridge, function(err, rows) {
		//console.log(rows);
		cb(err, rows);
	});
};
ovsdb.prototype.getNetflowRecords = function(bridge, cb) {
	var db = this.db;
	if(typeof(bridge) == 'function') {
		cb = brdige;
		bridge = '%'		
	}
	/*
		without interface name
		SELECT * FROM NetFlow_Collector 
		INNER JOIN Bridge on NetFlow_Collector.datapath_id = Bridge.id 
		INNER JOIN Port on Bridge.id = Port.datapath_id 
		with interface name
		SELECT * FROM NetFlow_Collector 
		INNER JOIN Bridge on NetFlow_Collector.datapath_id = Bridge.id 
		INNER JOIN Port As input_port on Bridge.id = input_port.datapath_id 
		INNER JOIN Interface As input_interface 
		on input_interface.ofport = NetFlow_Collector.input and input_interface.id = input_port.interface 
		INNER JOIN Port As output_port on Bridge.id = output_port.datapath_id 
		INNER JOIN Interface As output_interface 
		on output_interface.ofport = NetFlow_Collector.output and output_interface.id = output_port.interface
	*/
	db.all("SELECT NetFlow_Collector.*, Bridge.name, datetime(time, 'unixepoch', 'localtime') time_format, input_interface.name input_name, output_interface.name output_name FROM NetFlow_Collector INNER JOIN Bridge on NetFlow_Collector.datapath_id = Bridge.id INNER JOIN Port As input_port on Bridge.id = input_port.datapath_id INNER JOIN Interface As input_interface on input_interface.ofport = NetFlow_Collector.input and input_interface.id = input_port.interface INNER JOIN Port As output_port on Bridge.id = output_port.datapath_id 		INNER JOIN Interface As output_interface on output_interface.ofport = NetFlow_Collector.output and output_interface.id = output_port.interface Where Bridge.id = ? ORDER BY time", [bridge], function(err, rows) {
		//console.log(err);
		cb(err, rows);
	});
};
module.exports = ovsdb;