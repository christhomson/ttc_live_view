(function() {
	var map,
		markers = {},
		stopMarkers = {},
		marker_positions = {},
		lastUpdatedTime = 0,
		routes = {},
		selectedRoute = null,
		routeViewTimer;
	
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
		if (dirTag === undefined 
			|| preciseRoute.substr(0, routeTag.length) != routeTag || preciseRoute != preciseRoute.toUpperCase()) {
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
	
	// Hides all markers except all of the markers from the currently-hovered route.
	function markerMouseOverHandler(event) {
		clearTimeout(routeViewTimer);
		
		routeViewTimer = setTimeout(function() {
			var hoveredMarker = marker_positions[event.latLng];
			var vehicleIDs = Object.keys(markers);
			
			showStopsForVehicle(hoveredMarker.vehicle);
			
			for (var i = 0; i < vehicleIDs.length; i++) {
				var vehicleID = vehicleIDs[i];

				if (markers.hasOwnProperty(vehicleID)) {
					var markerToDisable = markers[vehicleID];

					if (markerToDisable.vehicle.attr('routeTag') !== hoveredMarker.vehicle.attr('routeTag')) {
						markerToDisable.setVisible(false);
					}
				}
			}
		
			selectedRoute = hoveredMarker.vehicle.attr('routeTag');
		}, 250);
	}
	
	// Shows all markers.
	function markerMouseOutHandler() {
		selectedRoute = null;
		
		var vehicleIDs = Object.keys(markers);
		for (var i = 0; i < vehicleIDs.length; i++) {
			if (markers.hasOwnProperty(vehicleIDs[i])) {
				markers[vehicleIDs[i]].setVisible(true);
			}
		}
		
		var stopIDs = Object.keys(stopMarkers);
		for (var i = 0; i < stopIDs.length; i++) {
			if (stopMarkers.hasOwnProperty(stopIDs[i])) {
				stopMarkers[stopIDs[i]].setMap(null);
			}
		}
		
		clearTimeout(routeViewTimer);
 	}
	
	// Fetches only the vehicle locations that have changed since the last pull.
	function fetchVehicleLocations() {
		$.get('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=ttc&t=' + lastUpdatedTime, function(data) {
			lastUpdatedTime = $(data).find('body lastTime').attr('time');
  		  	
			$(data).find('body vehicle').each(function(id, vehicle) {
				if (!markers[$(vehicle).attr('id')]) {
					markers[$(vehicle).attr('id')] = new google.maps.Marker({ 
						map: map,
						title: nameForRoute(vehicle),
					 	icon: iconForRoute($(vehicle).attr('routeTag')),
						direction: $(vehicle).attr('dirTag'),
						visible: !selectedRoute
					});
				}
				
				// Only show this route's markers after a hover.
				google.maps.event.addListener(markers[$(vehicle).attr('id')], "mouseover", markerMouseOverHandler);
				google.maps.event.addListener(markers[$(vehicle).attr('id')], "mouseout", markerMouseOutHandler);
				
				var marker = markers[$(vehicle).attr('id')];
				var coordinates = new google.maps.LatLng($(vehicle).attr('lat'), $(vehicle).attr('lon'));
				delete marker_positions[marker.getPosition()]; // marker might be overwriting an old position, which should be removed.
				marker_positions[coordinates] = marker;
				marker.setPosition(coordinates);
				marker.vehicle = $(vehicle);
				
				routes[$(vehicle).attr('routeTag')]['vehicleIDs'].push($(vehicle).attr('id'));
			});
		});
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
	
	// Strips the third portion of the direction their API gives us.
	// This is dumb, but their API does not return results for ALL directions of all branches.
	function simplifyDirection(direction) {
		return direction.split('_').slice(0, -1).join('_');
	}
	
	// Fetches information about a given route.
	function fetchRouteConfig(route, cb) {
		if (routes[route]['stops'] == null || routes[route]['directions'] == null) {
			$.get('http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=ttc&verbose&r=' + route, function(data) {
				var route = $($(data).find('body route')[0]),
					routeTag = route.attr('tag');
					
				routes[routeTag]['stops'] = {}, routes[routeTag]['directions'] = {};
			
				route.find('> stop').each(function(id, stop) {
					stop = $(stop);
					routes[routeTag]['stops'][stop.attr('tag')] = stop;
				});

				$(route).find('> direction').each(function(id, direction) {
          routes[routeTag].directions[$(direction).attr('tag')] = [];
          $('stop', direction).each(function(id, stop) {
            routes[routeTag].directions[$(direction).attr('tag')].push($(stop).attr('tag'));
          });
				});
			
				cb();
			});
		} else {
			cb();
		}
	}
	
	function showStopsForVehicle(vehicle) {
		var route = vehicle.attr('routeTag'),
			direction = vehicle.attr('dirTag');
      console.log("Attempting to show stops for route " + route + ", direction " + direction + ".");
		fetchRouteConfig(route, function() {			
			// Clear stop markers from the previous route that was shown.
			var previousMarkerIDs = Object.keys(stopMarkers);
			for (var i = 0; i < previousMarkerIDs.length; i++) {
				stopMarkers[previousMarkerIDs[i]].setMap(null);
				delete stopMarkers[previousMarkerIDs[i]];
			}
			
			// Show stops for this route.
			$(routes[route]['directions'][direction]).each(function(id, stopTag) {
				stop = $(routes[route]['stops'][stopTag]);
				
				stopMarkers[stop.attr('tag')] = new google.maps.Marker({ 
					map: map,
					title: stop.attr('title'),
					stop: stop,
					position: new google.maps.LatLng(stop.attr('lat'), stop.attr('lon')),
				 	icon: 'img/stop.png'
				});
			});
		});
	}
	  
	function initialize() {
		var mapOptions = {
			zoom: 12,
			center: new google.maps.LatLng(43.7172467450872, -79.37742082519532), // Toronto
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		
		map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);
		
		var updateInterval = 1500;
		if (document.location.search.indexOf("update=") != -1) {
			updateInterval = document.location.search.substr(document.location.search.indexOf("update=") + 7);
		}
		
		fetchRouteList(function() {
			fetchVehicleLocations();
			setInterval(fetchVehicleLocations, updateInterval);
		});
	}
	  
	google.maps.event.addDomListener(window, 'load', initialize);
})();