(function() {
	var map, markers = {}, lastUpdatedTime = 0;
	  
	function iconForRoute(route) {
		if (route >= 500) {
			return 'img/streetcar.png';
		} else if (route >= 300) {
			return 'img/night_bus.png';
		} else {
			return 'img/bus.png';
		}
	}
	
	function updateVehicleLocations() {
		$.get('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=ttc&t=' + lastUpdatedTime, function(data) {
			lastUpdatedTime = $(data).find('body lastTime').attr('time');
  		  	
			$(data).find('body vehicle').each(function(id, vehicle) {
				if (!markers[$(vehicle).attr('id')]) {
					markers[$(vehicle).attr('id')] = new google.maps.Marker({ map: map, title: $(vehicle).attr('routeTag'),
					 icon: iconForRoute($(vehicle).attr('routeTag'))});
				}
				
				var marker = markers[$(vehicle).attr('id')];
				marker.setPosition(new google.maps.LatLng($(vehicle).attr('lat'), $(vehicle).attr('lon')));
			});
		});
	}
	  
	function initialize() {
		var mapOptions = {
			zoom: 12,
			center: new google.maps.LatLng(43.7172467450872, -79.37742082519532),
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		
		map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);
			
		var updateInterval = 2000;
		if (document.location.search.indexOf("update=") != -1) {
			updateInterval = document.location.search.substr(document.location.search.indexOf("update=") + 7);
		}
		
		updateVehicleLocations();
		setInterval(updateVehicleLocations, updateInterval);
	}
	  
	google.maps.event.addDomListener(window, 'load', initialize);
})();