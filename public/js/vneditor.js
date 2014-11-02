Raphael.fn.connection = function (obj1, obj2, line, bg) {
    if (obj1.line && obj1.from && obj1.to) {
        line = obj1;
        obj1 = line.from;
        obj2 = line.to;
    }
    var bb1 = obj1.getBBox(),
        bb2 = obj2.getBBox(),
        p = [{x: bb1.x + bb1.width / 2, y: bb1.y - 1},
        {x: bb1.x + bb1.width / 2, y: bb1.y + bb1.height + 1},
        {x: bb1.x - 1, y: bb1.y + bb1.height / 2},
        {x: bb1.x + bb1.width + 1, y: bb1.y + bb1.height / 2},
        {x: bb2.x + bb2.width / 2, y: bb2.y - 1},
        {x: bb2.x + bb2.width / 2, y: bb2.y + bb2.height + 1},
        {x: bb2.x - 1, y: bb2.y + bb2.height / 2},
        {x: bb2.x + bb2.width + 1, y: bb2.y + bb2.height / 2}],
        d = {}, dis = [];
    for (var i = 0; i < 4; i++) {
        for (var j = 4; j < 8; j++) {
            var dx = Math.abs(p[i].x - p[j].x),
                dy = Math.abs(p[i].y - p[j].y);
            if ((i == j - 4) || (((i != 3 && j != 6) || p[i].x < p[j].x) && ((i != 2 && j != 7) || p[i].x > p[j].x) && ((i != 0 && j != 5) || p[i].y > p[j].y) && ((i != 1 && j != 4) || p[i].y < p[j].y))) {
                dis.push(dx + dy);
                d[dis[dis.length - 1]] = [i, j];
            }
        }
    }
    if (dis.length == 0) {
        var res = [0, 4];
    } else {
        res = d[Math.min.apply(Math, dis)];
    }
    var x1 = p[res[0]].x,
        y1 = p[res[0]].y,
        x4 = p[res[1]].x,
        y4 = p[res[1]].y;
    dx = Math.max(Math.abs(x1 - x4) / 2, 10);
    dy = Math.max(Math.abs(y1 - y4) / 2, 10);
    var x2 = [x1, x1, x1 - dx, x1 + dx][res[0]].toFixed(3),
        y2 = [y1 - dy, y1 + dy, y1, y1][res[0]].toFixed(3),
        x3 = [0, 0, 0, 0, x4, x4, x4 - dx, x4 + dx][res[1]].toFixed(3),
        y3 = [0, 0, 0, 0, y1 + dy, y1 - dy, y4, y4][res[1]].toFixed(3);
    var path = ["M", x1.toFixed(3), y1.toFixed(3), "C", x2, y2, x3, y3, x4.toFixed(3), y4.toFixed(3)].join(",");
    
    if (line && line.line) {
        line.bg && line.bg.attr({path: path});
        line.line.attr({path: path});
    } else {
        var color = typeof line == "string" ? line : "#000";
        return {
            bg: bg && bg.split && this.path(path).attr({stroke: bg.split("|")[0], fill: "none", "stroke-width": bg.split("|")[1] || 3}),
            line: this.path(path).attr({stroke: color, fill: "none"}),
            from: obj1,
            to: obj2,
            remove: function() {
            	this.line.remove();
            	this.bg.remove();
            }
        };
    }
};
Raphael.fn.group = function() {
	var set= this.set();
	var delegate = {};
	delegate.push = set.push;

	set.push = function() {		
		for(var i in arguments) {
			arguments[i].set = set;
		}
		return delegate.push.apply(set, arguments);
	}
	return set;
}



Raphael.VNE = {};
Raphael.VNE.componets = [];
/*

host:
  antslab.tw:  &antslab
    ip: 140.133.76.173
  dev.antslsb.tw:  &dev
    ip: 140.133.76.123

brdige:
  br1:  &ida
    id: a
    type: switch
    host: *antslab
    links:
       - b
  br2:  &idb
    id: b
    type: ap
    host: *dev
    links:
      - a
  br3:  &idc
    id: c
    type: openflow
    host: *antslab
*/
$(document).ready(function() {
	paper = Raphael('hero', 1000, 300);
	registerComponet(paper);
	initToolBar(paper);
	//console.log(db);
	Raphael.VNE.load(paper, db);
	/*Raphael.VNE.load(paper, {
		bridge:
		{ "00001": {
				name: 'br1',
				type: 'switch',
				host: '140.133.76.173',
				position: {x: 100, y: 100}
				 },
			"00002": {
				name: 'br2',
				type: 'ap',
				host: '140.133.76.123',
				position: {x: 300, y: 100} 
				}
			},
		links:[
			[ "00001", "00002"]
		]
	});*/
});
Raphael.VNE.import = function(yaml) {
	Raphael.VNE.load(jsyaml.load(yaml));
}
Raphael.VNE.linker = function(components) {
	var circle = null;
	var link = null;
	for(var i in com) {	
		if(components[i].linker)
			return;
		components[i].linker = linker;
		components[i][0].click(com[i].linker);			
	}
	function linker(event) {
		if(link && link.from.set == this.set) 
			return;
			
		$("#hero").one('mouseleave', function(event) {					
			if(circle && link) {
				circle.remove();
				link.remove();
				circle = null;
				link = null;
				paper.safari();
			}
			
		});
		$("#hero").mousemove(function(e) {										
			if(circle && link) {

				var parentOffset = $(this).offset(); 
				
				//or $(this).offset(); if you really just want the current element's offset
				var offset = {};
				offset.cx = e.pageX - parentOffset.left - parseInt($(this).css('padding-left'));
				offset.cy = e.pageY - parentOffset.top - parseInt($(this).css('padding-top'));					
				//{cx: event.offsetX, cy: event.offsetY}
				circle.attr(offset);
				paper.connection(link);
				paper.safari();
			}
		});
		//start
		if(!circle && !link) {
			circle = paper.circle(this.attrs.x, this.attrs.y, 0);
			link = paper.connection(this, circle, "#000", "#000|2");
		}
		//end
		else if(link.from != this){
			var repeat = false
			for(var i in connections) {
				//repeat check
				if(connections[i].from == link.from.set && connections[i].to == this.set) {
					repeat = true;
				}					
				if(connections[i].to == link.from.set && connections[i].from == this.set) {
					repeat = true;
				}
				if(repeat) {
					connections[i].remove();
					break;
				}
			}

			if(!repeat) {
				connections.push(paper.connection(link.from.set, this.set, "#000", "#000|2"));
			}
			link.remove();
			link = null;
			circle.remove();
			circle = null;
			$('#hero').unbind('mouseleave').unbind('mousemove');
		}
	}	
}
Raphael.VNE.load = function(paper, data) {
	com = {};
	for(var id in data.bridge) {
		var br = data.bridge[id];
		com[id] = paper[br.type](br.name, br.position.x, br.position.y, 0.7, 0.7);
		com[id].info = br;
		com[id].info.id = id;
	}
	for(var i in data.links) {
		var link = data.links[i];
		connections.push(paper.connection(com[link[0]], com[link[1]], "#000", "#000|2"));
	}
	
}


Raphael.VNE.addNetComponet = function(com_name, img, width, height, text_offset_x, text_offset_y) {
	Raphael.VNE.componets.push(com_name);
	
	Raphael.fn[com_name] = function(name, x, y, scale_x, scale_y) {
		var _width = width;
		var _height = height;
		if(scale_x)
			_width *= scale_x;
		else 
			scale_x = 1;
			
		if(scale_y)
			_height *= scale_y;
		else 
			scale_y = 1;
			
		var set = this.group();
		set.width = _width;
		set.height = _height;
		set.push(
			this.image(img, x, y, _width, _height),
			this.text(text_offset_x * scale_x + x, text_offset_y * scale_y + y, name)
		);
		
		set.initDrag = function() {
			this.undrag();
			this.drag(function move(dx, dy) {
					if(!this.set.dragEnable)
						return false;
					this.set.forEach(function(elm, i) {
						elm.attr({x: elm.ox + dx, y: elm.oy + dy});	
					});
					for (i = connections.length; i--;) {
						paper.connection(connections[i]);
					}
					paper.safari();
				}, function start() {
					if(!this.set.dragEnable)
						return false;
					this.set.forEach(function(elm, i) {
						elm.ox = elm.attr("x");
			    	elm.oy = elm.attr("y");
					});
					
				}, function end() {
					//console.log(this.set);
					var elm = this.set[0];
					//console.log(elm);
					/*if(Math.abs((elm.attr("x") - elm.ox)) < 3 && Math.abs((elm.attr("y") - elm.oy)) < 3) {
						if(this.set.length == 3) {
							var glow = this.set.pop();
							glow.remove();
						}
						else {
							var glow = this.glow();
							this.set.push(glow);
							this.set.initDrag();
//							console.log(this.set);
						}
					}*/
			});
		}
		set.initDrag();
		set.setDrag = function(enable) {
			this.dragEnable = (enable != false);
			if(this.dragEnable) {
				this.attr({cursor: "move"});
			}
			else {
				this.attr({cursor: "auto"});
			}
		}
		
		set.setDrag(false);
		return set;
	} 
}

function registerComponet() {
	Raphael.VNE.addNetComponet('ap', '/images/osa_device-wireless-router.png', 100, 100, 50, 90);
	Raphael.VNE.addNetComponet('switch', '/images/osa_hub.png', 100, 55, 50, 60);
	//Raphael.VNE.addNetComponet('router', '/images/osa_vpn.png', 100, 55, 50, 60);
	
	Raphael.VNE.addNetComponet('openflow', '/images/osa_of.png', 100, 70, 50, 75);
	//Raphael.VNE.addNetComponet('pc', '/images/osa_laptop.png', 100, 100, 50, 90);
}
function initToolBar(paper) {
	var offsetY = 0;
	for(var i in Raphael.VNE.componets) {
		var com = Raphael.VNE.componets[i];
		var obj = paper[com](com, 10, offsetY, 0.5, 0.5);
		offsetY += obj.height * 1.5;
	}
}
var paper;
var com;
var connections = [];

$(document).ready(function() {	
	/*
	paper = Raphael('hero', 1000, 300);
	registerComponet(paper);
	initToolBar(paper);
	com = {};
	com.vswitch = paper.vSwitch('vSwitch', 110, 00, 0.8, 0.8);
	com.vswitch2 = paper.openflow('OpenFlow', 130, 100, 0.8, 0.8);
	com.router = paper.router('router', 300, 0, 0.8, 0.8);
	com.ap = paper.ap('AP', 500, 100, 0.8, 0.8);
	com.openflow = paper.openflow('OpenFlow', 700, 0, 0.8, 0.8);
	com.pc = paper.pc('PC', 900, 0, 0.8, 0.8);
	
	for(var i in com) {	
		com[i].setDrag();
	}
	
	connections.push(paper.connection(com.vswitch, com.vswitch2, "#000", "#000|2"));
	connections.push(paper.connection(com.vswitch2, com.ap, "#000", "#000|2"));
	connections.push(paper.connection(com.vswitch, com.router, "#000", "#000|2"));
	connections.push(paper.connection(com.router, com.openflow, "#000", "#000|2"));
	connections.push(paper.connection(com.pc, com.openflow, "#000", "#000|2"));*/
});