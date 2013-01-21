# TTC Live View on Google Maps

So, I was bored and thought this could be a neat (but simple) mashup. It allows you to view the real-time locations of all TTC surface vehicles (buses and streetcars) on a Google map. 

The locations are the *actual* locations of the vehicles; not expected locations based on preset schedules. Each bus/streetcar sends its current coordinates to a server every 20 seconds or so (sometimes longer, sometimes shorter), so it's pretty close to real-time. The map fetches new vehicle locations from the TTC every 1.5 seconds (by default).

You can hover over a vehicle to see the other vehicles currently on the same route, as well as all of the stops for that route. The stop locations are not as accurate as they could be, due to the way the TTC exposes this data for routes with multiple branches.

It's not useful, per se, I just thought it was interesting.
