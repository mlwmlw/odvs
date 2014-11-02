//var p = require('rpc-socket/lib/protocols/process')
//var ovsdb = require('../libs/ovsdb-client');
var	fs = require('fs'),
		sqlite3 = require('sqlite3').verbose(), 
		async = require('async'),
		ovsctl = require('../libs/ovsctl'),
		ofctl = require('../libs/ofctl'),
		ovsdb = require('../models/ovsdb'),
		graphviz = require('../libs/graphviz'),
		yaml = require('js-yaml'),
		events = require('events');

var nodeflow = require('../libs/nodeflow.js');
var netflow = require('../libs/netflow.js');
//[/*'140.133.76.19',*/ '140.133.76.227', '140.110.111.19', '140.133.76.100', '140.116.164.180'];
var configs = require('../configs/config.yml').pop();
//tunnel manager
var Tunman = require('../libs/tunman');
var HOSTIP = '140.133.76.173';
module.exports = function(app) {

	app.all('/:page?/:op?', function(req, res, next) {
		var page = '';
		if(req.params.page) {
			page = req.params.page;			
		}
		else {
			page = '';
		}

		res.addOptions({HOSTIP : HOSTIP});
		res.addOptions({page : page});
		res.addOptions({hosts : configs.nodes});
		next();
	});
	
	var ovs_model = new ovsdb(configs.nodes);	
	var db = ovs_model.db;
	init();
	
	
	app.get('/', function(req, res) {
		/*db.each("SELECT * from Bridge INNER JOIN Port ON Bridge.id = Port.datapath_id INNER JOIN Interface on Port.interface = Interface.id", function(err, row) {
			console.log(row);			
		});*/
		var brs = {};
		var group = {};
		var links;
		var tunman = new Tunman();
		db.each("SELECT Bridge.*, Host.name as hostname from Bridge INNER JOIN Host on Host.ip = Bridge.host WHERE Bridge.name != 'vmbr0'", function(err, row) {

			brs[row.id] = {
				name: row.hostname + '-' + row.name,
				type: row.controller ? 'openflow': 'switch' ,
				host: row.host
			}
			if(!group[row.host]) {
				group[row.host] = [];
			}
			group[row.host].push(row.id);
		}, function() {	
			async.series([
				function(callback) {
					db.each("SELECT Port.*, Interface.*,Bridge.host from Interface INNER JOIN Port ON Interface.id = Port.interface INNER JOIN Bridge ON Bridge.id = Port.datapath_id" , function(err, row)  {
						row.options = JSON.parse(row.options);
	
						if(row.type == 'gre' || row.type == 'capwap' || row.type =='ipsec_gre') {				
							tunman.addWay(row.host, row.options.remote_ip, {from: row.datapath_id, key: row.options.key ? row.options.key : ''});
						}
					}, callback);
				}, function(callback) {
					links = tunman.getLinks();
					graphviz(900, 250, group, links, function(dot) {					
						for(var i in dot.nodes) {
							for(var j in dot.nodes[i]) {
								
								brs[j].position = dot.nodes[i][j];
								//console.log( dot.nodes[i][j]);
								//console.log(brs[j]);
								brs[j].position.x += 100;
							}
						}
						callback(null);
					});
			}], function(err, results) {

				res.render('editor', {'brs': {'bridge': brs, 'links': links}, events: events});
			});			
		});		
	});
	
	app.get('/events', function(req, res) {
		var len = events.length;
		var timer = null;
		setInterval(function() {
			if(len != events.length) {
				clearTimeout(timer);
				res.send(JSON.stringify(events));
			}
		}, 1000);
	});
	
	app.get('/events/:fake', function(req, res) {
		events.push({event: req.params.fake, info: 'fake', at: new Date()});
		res.send('done');
	});
	app.get('/host/:host?', function(req, res) {
		var host = req.params.host ? req.params.host : '%';
		var controllers = nodeflow.getServers();
		ovs_model.getAllPort(host, function(err, results) {
			results.controllers = controllers;
			res.render('host', results);
		});
	});
	
	app.get('/openflow', function(req, res) {
		ovs_model.getAllPort(function(err, results) {
			results.controllers = nodeflow.getServers();
			res.render('openflow', results);
		});		
	});

	app.get('/sync', function(req, res) {
		ovs_model.sync();
		res.redirect('/');
	});
	
	app.get('/controller', function(req, res) {
		var servers = nodeflow.getServers();
		res.render('controller', {servers: servers});		
	});
	
	app.get('/collector', function(req, res) {
		
		ovs_model.getNetflowSum(function(err, rows) {
			res.render('netflow.ejs', {brs: rows});
		});
		
	});
	app.get('/collector/:datapath_id', function(req, res) {
		ovs_model.getNetflowRecords(req.params.datapath_id, function(err, rows) {	
			console.log((rows && rows.length > 1) ? rows[0]: {})
			res.render('netflow.ejs', {br: (rows && rows.length > 1) ? rows[0]: {}, records: rows});
		});
	});
	app.get('/collector/delete/:datapath_id', function(req, res) {
		db.run('DELETE FROM NetFlow_Collector WHERE datapath_id = ?', req.params.datapath_id, function(err, result) {
			res.redirect('/collector');
		});
	});
}

var events = [];
function init() {
	//reset ovs
	ovsctl.clean(configs.nodes);
	ofctl.clean(configs.nodes);
	var collector = netflow.create(function(flow) {
		var ovsdb = require('../models/ovsdb');
		var ovs_model = new ovsdb();	
		var db = ovs_model.db;
		var flows = flow.v5Flows;
		var header = flow.header;
		db.each("SELECT * FROM netflow INNER JOIN Bridge on Bridge.netflow = netflow.id WHERE engine_type = ? and engine_id = ?", [header.engine_type, header.engine_id], function(err, row) {
			if(row) {
				for(var i in flows) {
					ovs_model.addNetflowRecord(header, row, flows[i]);
				}
			}
		});
	});
	
	var hosts = [];
	for(var i in configs.nodes) {
		hosts.push(configs.nodes[i].ip);
	}
	var monitor = require('../libs/ovsdb-monitor');
	var clusterMonitor = new monitor.Cluster(hosts);
	clusterMonitor.on('insert', function(data) {
		events.push({event: 'insert', info: data.host + ' insert ' + data.name, at: data.at});
		//console.log(data);
	});
	clusterMonitor.on('delete', function(data) {
		events.push({event: 'delete', info: data.host + ' delete ' + data.name, at: data.at});
	});
	clusterMonitor.on('migration', function(data) {
		events.push({event: 'migration', info: data.name + ' - from : ' + data.from + ', to : ' + data.to, at: data.at});
		//console.log(data);
	});
}

//when nodemon auto restart cleanup fork process  
process.once('SIGUSR2', function () {
  nodeflow.stop();
  netflow.stop();
	process.kill(process.pid, 'SIGUSR2');
});

