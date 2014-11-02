var Element = Joint.dia.Element;
var ovs = {};
var rect = {x: 0, y: 0, width: 135, height: 50};
ovs.vswitch = Element.extend({
	object: "switch",
	module: "ovs",
	init: function(properties) {
		var p = Joint.DeepSupplement(this.properties, properties, {
					radius: 5,
					rect: rect,
          labelOffsetX: 130/2 - (properties.label.length/2)*6.2,
          labelOffsetY: rect.height/2-8,
          portsOffsetX: 5,
          portsOffsetY: 30,
          PortRadius: 5,
					labelAttrs: { 'font-size': '13px'},
          PortAttrs: { fill: 'white', stroke: 'black' },
          Ports: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]
    });
		// wrapper
		var paper = this.paper, i, l;
		this.setWrapper(paper.rect(p.rect.x, p.rect.y, p.rect.width, p.rect.height, p.radius).attr(p.attrs));
		// inner
		this.addInner(this.getLabelElement());// label
		// draw ports
		for (i = 0, l = p.Ports.length; i < l; i++) {
			p.Ports[i] = this.getPortElement(i, p.Ports[i])
			this.addInner(p.Ports[i]);
		}
	},
	getLabelElement: function() {
		var p = this.properties,
				bb = this.wrapper.getBBox(),
				t = this.paper.text(bb.x, bb.y, p.label).attr(p.labelAttrs || {}),
				tbb = t.getBBox();
		t.translate(bb.x - tbb.x + p.labelOffsetX, bb.y - tbb.y + p.labelOffsetY);
		return t;
  },
	getPortElement: function(index, label) {
		var bb = this.wrapper.getBBox(), p = this.properties,
				port = ovs.Port.create({
								 label: label,
								 position: {x: bb.x + (parseInt(index/2)*15) + 15, 
														y: (index%2==0) ? bb.y : bb.y + bb.height},
								 radius: p.PortRadius,
								 attrs: p.PortAttrs,
								 offsetX: p.PortLabelOffsetX,
								 offsetY: (index % 2 == 0) ? 8 : -12

							});
		port.draggable(false);
		return port;
	},
	getPort: function(index) {
		return this.properties.Ports[index];
	},
	getPorts: function() {
		return this.properties.Ports;
	},
	findPort: function(name) {

		var ports = this.properties.Ports;
		for(var i in ports) {
			if(ports[i].properties.name == name)
				return ports[i];
		}
		return null;
	},
	getFreePort: function() {
		var ports = this.properties.Ports;
		for(var i in ports) {
			if(ports[i].properties.status == 'empty')
				return ports[i];
		}
	}
});
ovs.Port = Element.extend({
		object: "Port",
		module: "ovs",
		 // doesn't have object and module properties => it's invisible for
		 // serializer
		init: function(properties){
			var p = Joint.DeepSupplement(this.properties, properties, {
								label: '',
								offsetX: 0,
								offsetY: 0,
								status: 'empty'
						 });
			this.setWrapper(this.paper.circle(p.position.x, p.position.y, p.radius).attr(p.attrs));
			this.addInner(this.getLabelElement());
		},
		getLabelElement: function(){
			var bb = this.wrapper.getBBox(), p = this.properties,
					 t = this.paper.text(bb.x, bb.y, p.label),
					 tbb = t.getBBox();
			t.translate(bb.x - tbb.x + p.offsetX, bb.y - tbb.y + p.offsetY);
			return t;
		},
		setName: function(name) {
			this.properties.name = name;
		},
		setPortStatus: function(status) {
			this.properties.status = status;
		},
		zoom: function(){
			// @todo
		}
});

