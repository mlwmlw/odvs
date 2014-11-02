var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var sys = require('util');
var async = require('async');
var util = require('util');
var events = require('events');

var _ = require('underscore');
var OVSPORT = 6666;

function Monitor(server, port) {
	this.server = server;
	this.port = port ? port: OVSPORT;
}
Monitor.prototype.listen = function(target, cb) {
	var segs = target.split(".");
	var table = segs[0],
			column = segs.length > 1 ? segs[1]: '';
			
	var self = this;
	if(this.server instanceof Array) {
		for(var i in this.server) {
			(function(server) {
				
				client = spawn("ovsdb-client", ["monitor", "tcp:" + server + ":" + self.port, table, column]);
				
				client.stdout.on('data', function(data) {
					
					var raw = data.toString().replace(/^ *\n/g, '').split("\n");
					var header = raw[0].replace(/ +$/, "").replace(/ +/g, ",").split(",");
					var rows = [];
					for(var i = 2;i < raw.length; i++) {
						if(!raw[i])
							continue;
						obj = {}
						row = raw[i].replace(/ +$/g, "").replace(/"/g, "").split(" ");
						for(var j in header) {
							obj[header[j]] = row[j];
						}
						obj.host = server;
						rows.push(obj);
					}
					cb(rows);
				});	
			})(this.server[i]);
		}
	}
};

var Cluster = exports.Cluster = function(server) {
	events.EventEmitter.call(this);
	var self = this;
	var mon = new Monitor(server);
	var queue = [];
	var timer = null;
	/*
		migration = hostA insert tap101i0 and hostB delete tap101i0
	*/
	mon.listen('Port.name', function(changes) {
		for(var i in changes) {
			if(changes[i].action != 'initial') {
				var row = changes[i];
				changes[i].at = new Date();
				queue.push(changes[i]);
				self.emit(row.action, {name: row.name, host: row.host, at: row.at});
			}
		}
		clearTimeout(timer);
		timer = setTimeout(function handle() {
			
			//console.log("queue size = ", queue.length);
			var detecter = null;
			for(var i = 0, j = queue.length; i < j; i++) {
				var row = queue.pop();				
				if(/^tap.+$/.test(row.name)) {
					if(row.action == 'delete') {
						detecter = row;
					}
					if(row.action == 'insert' && detecter && detecter.name == row.name && detecter.host != row.host) {
						self.emit("migration", {name: row.name, from: detecter.host, to: row.host, at: new Date()});
					}
				}
				//console.log(row);
			}
		}, 8000);
	});
}
util.inherits(Cluster, events.EventEmitter);

/*
var clusterMonitor = new Cluster(['140.133.76.100', '140.133.76.213', '140.133.76.229']);
clusterMonitor.on('migration', function(data) {
	console.log(data);
})

*/