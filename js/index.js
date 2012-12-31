(function() {
	var map, markers = {}, lastUpdatedTime = 0, routes = {};
	
	// Determines the route name, including branch, based on the format RouteNum_Unknown_SpecificRouteNum.
	function nameForRoute(vehicle) {
		var routeDirTag = $(vehicle).attr('dirTag');
		var routeTag = $(vehicle).attr('routeTag');
		var preciseRoute;
		
		// Find vehicle's branch, if specified.
		if (routeDirTag !== undefined) {
			preciseRoute = routeDirTag.split('_')[2];
		}
		
		// Either branch wasn't specified, or branch identifier is not actually a branch.
		// If the last letter in the precise route is a capital letter, then it's the branch.
		if (routeDirTag === undefined 
			|| preciseRoute.substr(0, routeTag.length) != routeTag || preciseRoute != preciseRoute.toUpperCase()) {
			preciseRoute = routeTag;
		}

		var routeName = routes[routeTag].split('-')[1];
		return preciseRoute + " - " + routeName;
	}
	
	// Determines if a route is a bus, streetcar, or night bus route.
	function iconForRoute(route) {
		if (route >= 500) {
			return 'img/streetcar.png';
		} else if (route >= 300) {
			return 'img/night_bus.png';
		} else {
			return 'img/bus.png';
		}
	}
	
	// Fetches a mapping of route IDs to route names.
	function fetchRouteList(cb) {
		$.get('http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=ttc', function(data) {
			$(data).find('body route').each(function(id, route) {
				routes[$(route).attr('tag')] = $(route).attr('title');
			});
			
			cb();
		});
	}
	
	// Fetches only the vehicle locations that have changed since the last pull.
	function updateVehicleLocations() {
		$.get('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=ttc&t=' + lastUpdatedTime, function(data) {
			lastUpdatedTime = $(data).find('body lastTime').attr('time');
  		  	
			$(data).find('body vehicle').each(function(id, vehicle) {
				if (!markers[$(vehicle).attr('id')]) {
					markers[$(vehicle).attr('id')] = new google.maps.Marker({ 
						map: map,
						title: nameForRoute(vehicle),
					 	icon: iconForRoute($(vehicle).attr('routeTag'))
					});
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
			
		var updateInterval = 1500;
		if (document.location.search.indexOf("update=") != -1) {
			updateInterval = document.location.search.substr(document.location.search.indexOf("update=") + 7);
		}
		
		fetchRouteList(function() {
			updateVehicleLocations();
			setInterval(updateVehicleLocations, updateInterval);
		});
	}
	  
	google.maps.event.addDomListener(window, 'load', initialize);
})();