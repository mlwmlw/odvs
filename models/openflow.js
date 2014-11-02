var exec = require('child_process').exec;
var sys = require('util');
var ovsctl = require('./ovsdb').ovsctl;
function ofctl(server, bridge) {
	this.server = server;
	this.bridge = bridge;
	this.ovsctl = new ovsctl(server);

	this.ovsctl.get('Bridge', 'tunnel', 'controller', function(error, res) {
		console.log(res);
	});
}/*
ofctl.prototype.exe = function(method, params, cb) {
	params = params ? params : [];
	var child = exec("ovs-ofctl " + this.server + ":" + this.port + " " + method + " " + params.join(" "), function (error, stdout, stderr) {
		cb(JSON.parse(stdout));
	});
}
*/
var of = new ofctl('140.133.76.19', 'tunnel');
