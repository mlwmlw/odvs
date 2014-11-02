var _ = require('underscore');
/*
  data ex:
  {a:[1, 2], b: [3, 4], c: [5, 6]}
*/
function setup_graphviz(data, links, cb) {
	//setup graphviz
	var graphviz = require('node-graphviz');
	var g = graphviz.digraph("G");
	g.setNodeAttribut('width', '5');
	g.setNodeAttribut('height', '1.2');
	for(var i in data) {
		var cluster = g.addCluster('"cluster_' + i + '"');
		for(var j = 0; j < data[i].length; j++) {
			cluster.addNode(i + '-' + data[i][j]);
		}
	}	
	//add Edge
	var edges = [];
	for(var i in links) {
		edges[i] = _.clone(links[i]);
	}
	for(var i in data) {
		for(var j in data[i]) {
			for(var k in edges) {
				for(var l in edges[k]) {
					if(edges[k][l] == data[i][j]) {
						edges[k][l] = i + '-' + data[i][j];
					}
				}
			}
		}
	}
	for(var i in edges) {
		g.addEdge(edges[i][0], edges[i][1]);
	}
	//for(var i in server) {
		//g.addNode(server[i]);
	//}
	g.setGraphVizPath( "/usr/bin");
	//console.log(g.to_dot());
	//g.output({use: 'fdp', type: 'png'}, "./public/images/dot.png" ); 
	g.output({use:'fdp', type: 'dot'}, function(res) {
		var str = res.toString('utf8');
		var dot = {nodes: {}};
		var coord = str.match(/graph \[.+?=\"(.+?)"\]/)[1].split(",");
		//var nodes = str.match(/pos=\"(.+?)\"/g);
		var nodes = str.match(/".+?".+? pos=\"(.+?)\"/g);
		
		for(var i in nodes) {
			var name = nodes[i].match(/"(.+?)"/)[1].split('-');
			var pos = nodes[i].match(/pos=\"(.+?)\"/)[1].split(',');
			var cluster = name[0];
			var node = name[1];
			if(!dot.nodes[cluster])
				dot.nodes[cluster] = {};
			dot.nodes[cluster][node] = { x: pos[0], y: parseInt(pos[1])};
		}
		dot.width = coord[2];
		dot.height = parseInt(coord[3]);
		
		//self(undefined, dot);
		cb(dot);
	});
}
function graphviz_translate(width, height, data, links, cb) {
	setup_graphviz(data, links, function(dot) {
		var scale = {};
		scale.x = width / dot.width;
		scale.y = height / dot.height;
		
		//console.log(JSON.stringify(dot));	
		for(var i in dot.nodes) {
			for(var j in dot.nodes[i]) {
				dot.nodes[i][j].x = Math.round(dot.nodes[i][j].x * scale.x * 100)/100;
				dot.nodes[i][j].y = Math.round(dot.nodes[i][j].y * scale.y * 100)/100;
			}
		}
		dot.width = width;
		dot.height = height;
		//console.log(JSON.stringify(dot));		
		cb(dot);
	});
}
module.exports = graphviz_translate;