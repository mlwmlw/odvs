var net = require('net');
var EventEmitter = require('events').EventEmitter;
exports.connect = function(port, server) {
	var cbs = {};
	cbs.length = 0;
	var client;
	function connect() {
		client = net.connect(port, server);
		//client.setKeepAlive(true);
		var result = '';
		client.on('data', function(chunk) {
			result += chunk.toString();
			try {
				var decoded = JSON.parse(result);
				cbs[decoded.id](decoded.result);
				delete cbs[decoded.id];
				result = '';
			} catch(e) {}
		});
		client.on('end', function() {
			client = null;
		});
	}
	return {
		request: function(method, params, cb) {
			if(!client) {
				connect();
			}
			var rid = (Math.round(Math.random()*100) + '' + (new Date()).getTime());
			method = method.replace('-', '_');
			if(typeof params == 'function') {
				cb = params;
				params = [];
			}
			cbs[rid] = cb;
			cbs.length++;
			var requestJSON = JSON.stringify({
							'id': rid,
							'method': method,
							'params': params
			});	
			client.write(requestJSON);
		},
		close: function() {
				client.end();
		}
	}
}
