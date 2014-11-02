//Tunnel Manager
var Tunman = function() {
	this.tunnels = {}
}
Tunman.prototype.addWay = function(from, to, info) {
	if(from == to) 
		return false;
	if(!this.tunnels[from]) {
		this.tunnels[from] = {};
	}
	if(!this.tunnels[from][to]) {
		this.tunnels[from][to] = [];
	}
	this.tunnels[from][to].push(info);
}
Tunman.prototype.tun_exists = function(from, to, key) {
	if(from == to) { 
		return false;
	}

	if(typeof(this.tunnels[from][to]) != 'undefined' && typeof(this.tunnels[to][from]) != 'undefined') {
		for(var i in this.tunnels[from][to]) {
			for(var j in this.tunnels[to][from]) {
				if(this.tunnels[from][to][i].key == this.tunnels[to][from][j].key) {	
					//same key
					if(this.tunnels[from][to][i].key == key) {						
						return true;
					}
				}
			}
		}
		
	}

	return false;
}
Tunman.prototype.getTunnels = function() {
	var tunnels = {};
	for(var i in this.tunnels) {
		for(var j in this.tunnels) {
			for(var k in this.tunnels[i][j]) {
				if(this.tun_exists(i, j, this.tunnels[i][j][k].key)) {
					var hash = [i, j].sort().toString() + ',' + this.tunnels[i][j][k].key;				
					if(!tunnels[hash]) {					
						tunnels[hash] = [];
					}
					tunnels[hash].push({ip: i, br: this.tunnels[i][j][k].from});
				}
			}
		}
	}

	return tunnels;
}
	/*links:[
			[ "00001", "00002"]
	]*/
Tunman.prototype.getLinks = function() {
	var tunnels = this.getTunnels();

	var links = [];
	for(var i in tunnels) {
		var link = [];
		for(var j in tunnels[i]) {
			link.push(tunnels[i][j].br);
		}
		links.push(link); 
	}
	return links;
}
module.exports = Tunman;