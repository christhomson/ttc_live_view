class Application
  routes          = {}
  markers         = {}
  stopMarkers     = {}
  markerPositions = {}
  lastUpdatedTime = 0
  selectedRoute   = null
  map             = null
  routeViewTimer  = null

  # Determines the route number for a vehicle, including its branch.
  abbrForVehicle: (vehicle) =>
    dirTag = $(vehicle).attr 'dirTag'
    routeTag = $(vehicle).attr 'routeTag'

    # Find vehicle's branch, if specified.
    if dirTag isnt undefined
      preciseRoute = dirTag.split('_')[2]

    # Either branch wasn't specified, or branch identifier is not actually a branch.
    # If the last letter in the precise route is a capital letter, then it's the branch.
    if dirTag is undefined or preciseRoute.substr(0, routeTag.length) isnt routeTag or preciseRoute isnt preciseRoute.toUpperCase()
      preciseRoute = routeTag

    return preciseRoute


  # Returns a string like "29 - Dufferin"
  nameForRoute: (vehicle) =>
    routeTag = $(vehicle).attr 'routeTag'
    routeName = routes[routeTag]['name'].split('-')[1]

    return @abbrForVehicle(vehicle) + " - " + routeName


  # Determines if a route is a bus, streetcar, or a night bus route.
  iconForRoute: (route) =>
    if route >= 500 then 'img/streetcar.png'
    else if route >= 300 then 'img/night_bus.png'
    else 'img/bus.png'


  # Hides all markers except those from the currently-hovered route.
  markerMouseOverHandler: (event) =>
    clearTimeout routeViewTimer

    routeViewTimer = setTimeout =>
      hoveredMarker = markerPositions[event.latLng]
      vehicleIDs = Object.keys markers

      @showStopsForVehicle hoveredMarker.vehicle

      for vehicleID in vehicleIDs
        if markers.hasOwnProperty vehicleID
          markerToDisable = markers[vehicleID]
          if markerToDisable.vehicle.attr('routeTag') isnt hoveredMarker.vehicle.attr('routeTag')
            markerToDisable.setVisible false


      selectedRoute = hoveredMarker.vehicle.attr 'routeTag'


  # Shows all markers.
  markerMouseOutHandler: =>
    selectedRoute = null

    for vehicleID in Object.keys markers
      if markers.hasOwnProperty vehicleID
        markers[vehicleID].setVisible true

    for stopID in Object.keys stopMarkers
      if stopMarkers.hasOwnProperty stopID
        stopMarkers[stopID].setMap null

    clearTimeout routeViewTimer


  # Fetches only the vehicle locations that have changed since the last pull.
  fetchVehicleLocations: =>
    $.get 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=ttc&t=' + lastUpdatedTime, (data) =>
      lastUpdatedTime = $(data).find('body lastTime').attr 'time'

      $(data).find('body vehicle').each (id, vehicle) =>
        if not markers[$(vehicle).attr('id')]
          markers[$(vehicle).attr('id')] = new google.maps.Marker {
            map: map
            title: @nameForRoute vehicle
            icon: @iconForRoute $(vehicle).attr('routeTag')
            direction: $(vehicle).attr 'dirTag'
            visible: !selectedRoute
          }

        # Only show this route's markers after a hover.
        google.maps.event.addListener markers[$(vehicle).attr 'id'], 'mouseover', @markerMouseOverHandler.bind(@)
        google.maps.event.addListener markers[$(vehicle).attr 'id'], 'mouseout', @markerMouseOutHandler.bind(@)

        marker = markers[$(vehicle).attr 'id'] # would've done this earlier, but we needed to modify the markers array
        coordinates = new google.maps.LatLng $(vehicle).attr('lat'), $(vehicle).attr('lon')
        delete markerPositions[marker.getPosition()] # marker might be overwriting an old position, which should be removed.

        markerPositions[coordinates] = marker
        marker.setPosition coordinates
        marker.vehicle = $(vehicle)

        routes[$(vehicle).attr 'routeTag']['vehicleIDs'].push $(vehicle).attr('id')


  # Fetches a mapping of route IDs to route names.
  fetchRouteList: (cb) =>
    $.get 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=ttc', (data) ->
      $(data).find('body route').each (id, route) ->
        routes[$(route).attr('tag')] = { name: $(route).attr('title'), vehicleIDs: [] }

      cb()


  # Strips the third portion of the direction their API gives us.
  # This is dumb, but their API does not return results for ALL directions of all branches.
  simplifyDirection: (direction) =>
    return direction.split('_').slice(0, -1).join '_'


  # Fetches information about a given route.
  fetchRouteConfig: (route, cb) =>
    if !routes[route]['stops']? or !routes[route]['directions']?
      $.get 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=ttc&verbose&r=' + route, (data) =>
        route = $($(data).find('body route')[0])
        routeTag = route.attr 'tag'

        routes[routeTag]['stops']       = {}
        routes[routeTag]['directions']  = {}

        $(route).find('> stop').each (id, stop) ->
          stop = $(stop)
          routes[routeTag]['stops'][stop.attr('tag')] = stop

        $(route).find('> direction').each (id, direction) =>
          routes[routeTag]['directions'][$(direction).attr('tag')] = []

          $('stop', direction).each (id, stop) ->
            routes[routeTag].directions[$(direction).attr('tag')].push($(stop).attr('tag'))

        cb()
    else
      cb()


  showStopsForVehicle: (vehicle) =>
    route = vehicle.attr 'routeTag'
    direction = vehicle.attr 'dirTag'

    @fetchRouteConfig route, =>
      # Clear stop markers from the previous route that was shown.
      for marker in Object.keys stopMarkers
        if stopMarkers.hasOwnProperty marker
          stopMarkers[marker].setMap null
          delete stopMarkers[marker]

      # Show stops for this route.
      $(routes[route]['directions'][direction]).each (id, stopTag) =>
        stop = $(routes[route]['stops'][stopTag])

        stopMarkers[stop.attr 'tag'] = new google.maps.Marker {
          map: map
          title: stop.attr 'title'
          stop: stop
          position: new google.maps.LatLng(stop.attr('lat'), stop.attr('lon'))
          icon: 'img/stop.png'
        }


  constructor: ->
    mapOptions = {
      zoom: 12
      center: new google.maps.LatLng 43.7172467450872, -79.37742082519532 # Toronto
      mapTypeId: google.maps.MapTypeId.ROADMAP
    }

    map = new google.maps.Map document.getElementById('map_canvas'), mapOptions

    updateInterval = 1500
    if document.location.search.indexOf("update=") isnt -1
      updateInterval = document.location.search.substr(document.location.search.indexOf("update") + 7)

    @fetchRouteList =>
      @fetchVehicleLocations()
      setInterval @fetchVehicleLocations, updateInterval

google.maps.event.addDomListener(window, 'load', ->
  new Application()
)
