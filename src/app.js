var terms = require('./terms.json');
ngi.cards('_ngi:terms', terms);

// Define the Splash screen.
ngi.cards('_ngi:init.splash', {
  icon: './images/pump.png'
});


var myKey = 'OhmQDg5GfzarF86N6PnNoGszJemFq18E';

//get current position and stations before initializing
function getCurrentPosition() {
  return new Promise(function(resolve) {
    gm.info.getCurrentPosition(function(position) {
      ngi.state.set('currentLat', position.coords.latitude);
      ngi.state.set('currentLng', position.coords.longitude);
      resolve();
    }, true);
  })
}

//get the list of gas stations using the current location and build card
var remote = {
  buildCards: function() {
    var requestUrl = 'https://api.tomtom.com/search/2/poiSearch/gas%20station.json?limit=12=&radius=2000&key=' + myKey
    + '&lat=' + ngi.state.get('currentLat') + '&lon=' + ngi.state.get('currentLng');
    return ngi.http.get(requestUrl)
      .then(function(response) {

        var list = _(response.payload.results).filter(function(item) {
          return item.type = 'POI';
        }).map(function(item) {
          var add = item.address;
          var address = add.streetNumber + ' ' + add.streetName + ', ' + add.municipality + ', ' + add.countrySubdivision + ' ' + add.postalCode;
          return {
            //title: item.poi.name,
            title: item.poi.name + ' ' + (item.dist * 0.000621371).toFixed(1) + 'mi',
            $distance: item.dist,
            $position: item.position,
            body: '<p>' + address + '</p>',
            $stringAddress: address,
            $address: {
              street: add.streetNumber + ' ' + add.streetName,
              city: add.municipality,
              state: add.countrySubdivision,
              zip: add.postalCode,
              country: add.countryCode,
            }
          }
        }).sortBy('distance').value();

        ngi.state.set('stations', list);
        return list;
      });
  }
}

/*
MapView, FullMap
Neither GM nor the Driver First Framework provide a tile server to use with your application.
If you'd like to use a map layout you will need to specify a server URL which you have access to.
Tile Server URLs should follow the standard tile layer {x}/{y}/{z} template, e.g. http://{s}.somedomain.com/blah/{z}/{x}/{y}{r}.png.
The Map Server URL may be specified globally (in the ngi.init configuration) or locally to each map (using the layers route configuration property).
*/

ngi.flow('gasStation', {
    entry: 'listStations'
  })
  .addRoute('listStations', {
    layout: 'VerticalList',
    title: 'Select a Station',
    beforeEnter: function() {
      //console.log('before enter, this will run before entry to the route');
    },
    listActions: [
      {
        default: true,
        action: function(index) {
          // var card      = _.get(this, 'content[' + index + ']');
          // var position = _.get(card, '$position');
          this.route('stationLocation');
        }
      }
    ],
    links: {
      detail:'stationLocation'
    }
  })
  .addRoute('stationLocation', {
    layout: 'Detail',
    actions: [{
      label: 'Set Navigation',
      action: function(index) {
        var self = this;
        //this.content is the card associated
        var dest = { address: this.content.$stringAddress }
        console.log('clicked to route to station', dest);
        gm.nav.setDestination(success, failure, dest, true);

        var card = ngi.cards('gasStation.result').get(0).value();
        //ngi.cards('flow.view', card, true); //remove previous card

        //update result card and reroute
        function success(list) {
          ngi.util.set(card, 'body', '<p>Destination has been set.</p>');
          //ngi.cards('gasStation.view', newCards, true); //if replacing
          self.route('result')
        }

        function failure(err) {
          ngi.util.set(card, 'body', '<p>Having trouble setting destination</p>');
          self.route('result')
        }
      }
    }],
    links: {
      detail:'result'
    }
  })
  .addRoute('result', {
    layout: 'Detail', //Modal - not working
    actions: [{
      label: 'close',
      action: function() {
        this.exit('gasStation');
      }
    }],
    links: {
      exit: {
        gasStation: 'gasStation'
      }
    }
  })

ngi.cards('gasStation.listStations', ngi.state.get('stations'));

//example for generating cards with remote call
ngi.cards('myflow.view', {
  remote: {
    url: 'http://www.mywebsite.com/api/v1/stuff',
    refresh: 10 * 60 * 1000,
    transform: function(payload, headers) {
      var cards = payload.map(function(item) {
        return {
          title: item.name,
          images: [item.picture]
        };
      });

      return cards;
    }
  }
});

ngi.cards('gasStation.result', { title: '' }); //this is not updating

//before entering app, collect the current position
//and list of stations based off of that location
getCurrentPosition().then(function() {
  remote.buildCards().then(function(response) {
      console.log('response', response);
      ngi.init('gasStation');
    })
  })
