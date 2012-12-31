(function() {
	var map, markers = {}, lastUpdatedTime = 0, routes = {}, marker_positions = {};
	
	
	// Determines the route number for a vehicle, including its branch.
	function abbrForVehicle(vehicle) {
		var dirTag = $(vehicle).attr('dirTag');
		var routeTag = $(vehicle).attr('routeTag');
		var preciseRoute;
		
		// Find vehicle's branch, if specified.
		if (dirTag !== undefined) {
			preciseRoute = dirTag.split('_')[2];
		}
		
		// Either branch wasn't specified, or branch identifier is not actually a branch.
		// If the last letter in the precise route is a capital letter, then it's the branch.
		if (dirTag === undefined || preciseRoute != preciseRoute.toUpperCase()) {
			preciseRoute = routeTag;
		}
		
		return preciseRoute;
	}


	function nameForRoute(vehicle) {
		var routeTag = $(vehicle).attr('routeTag'),
			routeName = routes[routeTag]["name"].split('-')[1];
		
		return abbrForVehicle(vehicle) + " - " + routeName;
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
				routes[$(route).attr('tag')] = {name: $(route).attr('title'), vehicleIDs: []};
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
					 	icon: iconForRoute($(vehicle).attr('routeTag')),
						route_abbr: abbrForVehicle(vehicle)
					});
				}
				
				// Only show this route's markers after a hover.
				google.maps.event.addListener(markers[$(vehicle).attr('id')], "mouseover", function(event) {
					var hoveredMarker = marker_positions[event.latLng];
					var vehicleIDs = Object.keys(markers);

					for (var i = 0; i < vehicleIDs.length; i++) {
						var vehicleID = vehicleIDs[i];

						if (markers.hasOwnProperty(vehicleID)) {
							var markerToDisable = markers[vehicleID];

							if (markerToDisable.route_abbr !== hoveredMarker.route_abbr) {
								markerToDisable.setVisible(false);
							}
						}
					}
				});
				
				var marker = markers[$(vehicle).attr('id')];
				var coordinates = new google.maps.LatLng($(vehicle).attr('lat'), $(vehicle).attr('lon'));
				delete marker_positions[marker.getPosition()]; // marker might be overwriting an old position, which should be removed.
				marker_positions[coordinates] = marker;
				marker.setPosition(coordinates);
				
				routes[$(vehicle).attr('routeTag')]['vehicleIDs'].push($(vehicle).attr('id'));
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